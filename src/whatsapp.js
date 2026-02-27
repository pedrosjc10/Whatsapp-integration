const makeWASocket = require("@whiskeysockets/baileys").default;
const {
    useMultiFileAuthState,
    DisconnectReason,
    fetchLatestBaileysVersion,
    delay,
} = require("@whiskeysockets/baileys");
const pino = require("pino");
const path = require("path");
const qrcodeTerminal = require("qrcode-terminal");
const QRCode = require("qrcode");
const fs = require("fs");
const trello = require("./trello");

const logger = pino({ level: "silent" });

// Filtros dinâmicos (iniciam com o que está no .env)
let filterKeywords = process.env.TRELLO_FILTER_KEYWORDS ?
    process.env.TRELLO_FILTER_KEYWORDS.toLowerCase().split(",").map(k => k.trim()) : [];
let filterMediaTypes = process.env.TRELLO_FILTER_MEDIA_TYPES ?
    process.env.TRELLO_FILTER_MEDIA_TYPES.toLowerCase().split(",").map(t => t.trim()) : [];

// Timestamp de quando o bot ligou
const startupTimestamp = Math.floor(Date.now() / 1000);

// Gerenciamento de múltiplas instâncias
const instances = new Map();

/**
 * Inicializa uma instância do WhatsApp
 * @param {string} sessionId Nome da sessão (ex: 'user1', 'comercial')
 */
async function startWhatsApp(sessionId = "default") {
    if (instances.has(sessionId) && instances.get(sessionId).status === "connected") {
        return instances.get(sessionId).sock;
    }

    const authPath = path.join(__dirname, "..", "sessions", sessionId);
    if (!fs.existsSync(authPath)) {
        fs.mkdirSync(authPath, { recursive: true });
    }

    const { state, saveCreds } = await useMultiFileAuthState(authPath);
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        version,
        logger,
        printQRInTerminal: false,
        auth: state,
        generateHighQualityLinkPreview: true,
    });

    const instanceData = {
        id: sessionId,
        sock,
        qrCode: null,
        status: "disconnected",
        number: null,
        sentMessages: [],
        receivedMessages: []
    };
    instances.set(sessionId, instanceData);

    sock.ev.on("connection.update", async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            instanceData.qrCode = qr;
            instanceData.status = "awaiting_qr";
            console.log(`\n📱 [${sessionId}] QR Code gerado!`);
        }

        if (connection === "close") {
            const statusCode = lastDisconnect?.error?.output?.statusCode;
            const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

            console.log(`📡 [${sessionId}] Conexão fechada. Motivo: ${statusCode}. Reconectando: ${shouldReconnect}`);

            instanceData.qrCode = null;
            instanceData.status = "disconnected";
            instanceData.number = null;

            if (shouldReconnect) {
                // Tenta reconectar apenas se não foi um logout proposital
                await delay(3000);
                if (instances.has(sessionId)) {
                    startWhatsApp(sessionId);
                }
            } else {
                console.log(`🚪 [${sessionId}] Logout/Encerramento detectado. Limpando...`);
                try {
                    // Encerra o socket de vez para não sobrar nada na memória
                    sock.ev.removeAllListeners();
                    sock.end();
                    if (fs.existsSync(authPath)) {
                        fs.rmSync(authPath, { recursive: true, force: true });
                    }
                } catch (e) {
                    console.error(`Erro ao limpar ${sessionId}:`, e);
                }
                instances.delete(sessionId);
            }
        } else if (connection === "open") {
            instanceData.status = "connected";
            instanceData.qrCode = null;
            instanceData.number = sock.user?.id?.split(":")[0] || sock.user?.id;
            console.log(`\n✅ [${sessionId}] WhatsApp Conectado: ${instanceData.number}\n`);
        }
    });

    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("messages.upsert", async ({ messages: msgs, type }) => {
        if (type !== "notify" && type !== "append") return;

        for (const msg of msgs) {
            const jid = msg.key.remoteJid;
            if (!jid || jid.endsWith("@g.us")) continue;

            const fromMe = msg.key.fromMe;
            const senderNumber = jid.split("@")[0];
            const msgTimestamp = msg.messageTimestamp;

            if (msgTimestamp < (startupTimestamp - 60)) continue;

            let content = "";
            let mediaType = "text";

            if (msg.message?.conversation) content = msg.message.conversation;
            else if (msg.message?.extendedTextMessage?.text) content = msg.message.extendedTextMessage.text;
            else if (msg.message?.imageMessage) { content = "[Imagem] " + (msg.message.imageMessage.caption || ""); mediaType = "image"; }
            else if (msg.message?.videoMessage) { content = "[Vídeo] " + (msg.message.videoMessage.caption || ""); mediaType = "video"; }
            else if (msg.message?.audioMessage) { content = "[Áudio]"; mediaType = "audio"; }
            else if (msg.message?.documentMessage) { content = "[Documento] " + (msg.message.documentMessage.fileName || ""); mediaType = "document"; }
            else if (msg.message?.stickerMessage) { content = "[Sticker]"; mediaType = "sticker"; }
            else { content = "[Mídia/Outro]"; mediaType = "other"; }

            // LOGICA DE FILTRO DO TRELLO (Funciona para enviadas e recebidas)
            const isMediaOther = content === "[Mídia/Outro]";

            if (!isMediaOther) {
                let passFilter = true;
                if (filterKeywords.length > 0 || filterMediaTypes.length > 0) {
                    const hasKeyword = filterKeywords.length > 0 && filterKeywords.some(k => content.toLowerCase().includes(k));
                    const hasMediaType = filterMediaTypes.length > 0 && filterMediaTypes.includes(mediaType);
                    passFilter = hasKeyword || hasMediaType;
                }

                if (passFilter) {
                    const searchTerms = new Set([senderNumber]);
                    if (msg.pushName) searchTerms.add(msg.pushName);

                    if (jid.endsWith("@lid")) {
                        try {
                            const [resolved] = await sock.onWhatsApp(jid);
                            if (resolved && resolved.jid) searchTerms.add(resolved.jid.split("@")[0]);
                        } catch (e) { }
                    }

                    console.log(`\n${fromMe ? '📤' : '📥'} [${sessionId}] Filtro Passou: ${content.substring(0, 30)}...`);
                    for (const term of searchTerms) {
                        trello.processConfirmation(term, content, fromMe ? "sent" : "received").catch(() => { });
                    }
                }
            }

            if (!fromMe) {
                // Registrar mensagem recebida no histórico do Dashboard
                const receivedMsg = {
                    id: msg.key.id,
                    from: senderNumber,
                    pushName: msg.pushName || "Desconhecido",
                    content,
                    timestamp: new Date().toISOString()
                };
                instanceData.receivedMessages.unshift(receivedMsg);
                if (instanceData.receivedMessages.length > 500) instanceData.receivedMessages.pop();
            }
        }
    });

    return sock;
}

/**
 * Inicializa todas as sessões existentes em disco
 */
async function initAllSessions() {
    const sessionsPath = path.join(__dirname, "..", "sessions");
    if (!fs.existsSync(sessionsPath)) {
        fs.mkdirSync(sessionsPath);
        // Migrar default se existir
        const oldAuth = path.join(__dirname, "..", "auth_info");
        if (fs.existsSync(oldAuth) && fs.existsSync(path.join(oldAuth, "creds.json"))) {
            const defaultPath = path.join(sessionsPath, "default");
            fs.renameSync(oldAuth, defaultPath);
        }
    }

    const sessions = fs.readdirSync(sessionsPath).filter(f => fs.statSync(path.join(sessionsPath, f)).isDirectory());
    if (sessions.length === 0) {
        startWhatsApp("default"); // Sempre inicia pelo menos uma
    } else {
        for (const sessionId of sessions) {
            startWhatsApp(sessionId);
        }
    }
}

module.exports = {
    startWhatsApp,
    initAllSessions,
    sendTextMessage: async (sessionId, number, text) => {
        const instance = instances.get(sessionId || "default");
        if (!instance || instance.status !== "connected") throw new Error("WhatsApp offline");
        const jid = number.replace(/\D/g, "") + "@s.whatsapp.net";
        const result = await instance.sock.sendMessage(jid, { text });
        const msgRecord = { id: result.key.id, to: number, content: text, status: "sent", timestamp: new Date().toISOString() };
        instance.sentMessages.unshift(msgRecord);
        return msgRecord;
    },
    getAllStatus: () => {
        const statuses = [];
        for (const [id, data] of instances) {
            statuses.push({ id, status: data.status, number: data.number, hasQR: !!data.qrCode });
        }
        return statuses;
    },
    getStatus: (sessionId) => {
        const data = instances.get(sessionId || "default");
        return data ? { id: data.id, status: data.status, number: data.number, hasQR: !!data.qrCode } : null;
    },
    getQRCodeDataURL: async (sessionId) => {
        const data = instances.get(sessionId || "default");
        return (data && data.qrCode) ? QRCode.toDataURL(data.qrCode) : null;
    },
    getSentMessages: (sessionId) => instances.get(sessionId || "default")?.sentMessages || [],
    getReceivedMessages: (sessionId) => instances.get(sessionId || "default")?.receivedMessages || [],
    logout: async (sessionId) => {
        const instance = instances.get(sessionId || "default");
        if (instance && instance.sock) await instance.sock.logout();
    },
    getFilters: () => ({ keywords: filterKeywords, mediaTypes: filterMediaTypes }),
    setFilters: (keywords, mediaTypes) => {
        if (Array.isArray(keywords)) filterKeywords = keywords.map(k => k.toLowerCase().trim());
        if (Array.isArray(mediaTypes)) filterMediaTypes = mediaTypes.map(t => t.toLowerCase().trim());
        return { keywords: filterKeywords, mediaTypes: filterMediaTypes };
    }
};
