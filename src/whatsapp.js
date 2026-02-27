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
const trello = require("./trello");

const logger = pino({ level: "silent" });

// Armazenar chats em memória
const chatsMap = new Map();

let sock = null;
let qrCode = null;
let connectionStatus = "disconnected";
let connectedNumber = null;

// Histórico de mensagens
const sentMessages = [];
const receivedMessages = [];

/**
 * Inicializa a conexão com o WhatsApp
 */
async function startWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState(
        path.join(__dirname, "..", "auth_info")
    );

    const { version } = await fetchLatestBaileysVersion();

    sock = makeWASocket({
        version,
        logger,
        printQRInTerminal: false,
        auth: state,
        generateHighQualityLinkPreview: true,
    });

    sock.ev.on("connection.update", async (update) => {
        const { connection, lastDisconnect, qr } = update;
        if (qr) {
            qrCode = qr;
            connectionStatus = "awaiting_qr";
            qrcodeTerminal.generate(qr, { small: true });
            console.log("\n📱 QR Code gerado! Escaneie agora.\n");
        }

        if (connection === "close") {
            const statusCode = lastDisconnect?.error?.output?.statusCode;
            const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
            connectionStatus = "disconnected";
            if (shouldReconnect) {
                await delay(3000);
                startWhatsApp();
            }
        } else if (connection === "open") {
            connectionStatus = "connected";
            connectedNumber = sock.user?.id?.split(":")[0] || sock.user?.id;
            console.log(`\n✅ WhatsApp Conectado: ${connectedNumber}\n`);
        }
    });

    sock.ev.on("creds.update", saveCreds);

    // ESCUTAR MENSAGENS (Aqui está a mágica do Trello)
    sock.ev.on("messages.upsert", async ({ messages: msgs, type }) => {
        if (type !== "notify" && type !== "append") return;

        for (const msg of msgs) {
            const jid = msg.key.remoteJid;
            if (!jid || jid.endsWith("@g.us")) continue;

            const fromMe = msg.key.fromMe;
            const senderNumber = jid.split("@")[0];

            let content = "";
            if (msg.message?.conversation) content = msg.message.conversation;
            else if (msg.message?.extendedTextMessage?.text) content = msg.message.extendedTextMessage.text;
            else content = "[Mídia/Outro]";

            // LOGICA DE BUSCA DO TRELLO
            if (fromMe && content !== "[Mídia/Outro]") {
                const searchTerms = new Set();
                searchTerms.add(senderNumber);
                if (msg.pushName) searchTerms.add(msg.pushName);

                // Tentar resolver LID para número real
                if (jid.endsWith("@lid")) {
                    try {
                        const [resolved] = await sock.onWhatsApp(jid);
                        if (resolved && resolved.jid) {
                            searchTerms.add(resolved.jid.split("@")[0]);
                        }
                    } catch (e) { }
                }

                console.log(`\n📤 Você enviou: "${content.substring(0, 30)}..."`);
                console.log(`   🔎 Buscando Trello por: ${Array.from(searchTerms).join(" | ")}`);

                for (const term of searchTerms) {
                    trello.processConfirmation(term, content, "sent").catch(() => { });
                }
            } else if (!fromMe) {
                // Registrar mensagem recebida no histórico do Dashboard
                const receivedMsg = {
                    id: msg.key.id,
                    from: senderNumber,
                    pushName: msg.pushName || "Desconhecido",
                    content,
                    timestamp: new Date().toISOString()
                };
                receivedMessages.unshift(receivedMsg);
                if (receivedMessages.length > 500) receivedMessages.pop();

                console.log(`📩 Recebido de ${receivedMsg.pushName}: ${content.substring(0, 50)}`);
            }
        }
    });

    return sock;
}

/**
 * Enviar mensagem (API do Dashboard)
 */
async function sendTextMessage(number, text) {
    if (!sock || connectionStatus !== "connected") throw new Error("WhatsApp offline");
    const jid = number.replace(/\D/g, "") + "@s.whatsapp.net";
    const result = await sock.sendMessage(jid, { text });

    const msgRecord = {
        id: result.key.id,
        to: number,
        content: text,
        status: "sent",
        timestamp: new Date().toISOString()
    };
    sentMessages.unshift(msgRecord);
    return msgRecord;
}

// RESTANTE DAS FUNÇÕES (API)
module.exports = {
    startWhatsApp,
    sendTextMessage,
    getStatus: () => ({ status: connectionStatus, number: connectedNumber, hasQR: !!qrCode }),
    getQRCodeDataURL: async () => qrCode ? QRCode.toDataURL(qrCode) : null,
    getSentMessages: () => sentMessages,
    getReceivedMessages: () => receivedMessages,
    getChats: async () => [], // Simplificado
    logout: async () => sock && sock.logout(),
};
