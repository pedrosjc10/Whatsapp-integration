const makeWASocket = require("@whiskeysockets/baileys").default;
const {
    useMultiFileAuthState,
    DisconnectReason,
    fetchLatestBaileysVersion,
    delay,
} = require("@whiskeysockets/baileys");
const pino = require("pino");
const path = require("path");
const fs = require("fs");
const store = require("./store");
const { processIncomingMessage } = require("./processor");

const logger = pino({ level: "silent" });

/**
 * Inicializa uma instância do WhatsApp (Socket)
 */
async function startWhatsApp(sessionId = "default") {
    const { instances } = store;

    if (instances.has(sessionId) && instances.get(sessionId).status === "connected") {
        return instances.get(sessionId).sock;
    }

    const authPath = path.join(__dirname, "..", "..", "..", "sessions", sessionId);
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
        receivedMessages: [],
        trelloConfig: store.loadTrelloConfig(sessionId)
    };
    instances.set(sessionId, instanceData);

    // Eventos de Conexão
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
                await delay(3000);
                if (instances.has(sessionId)) {
                    startWhatsApp(sessionId);
                }
            } else {
                console.log(`🚪 [${sessionId}] Logout/Encerramento detectado. Limpando...`);
                try {
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

    // Eventos de Mensagem
    sock.ev.on("messages.upsert", async ({ messages: msgs, type }) => {
        if (type !== "notify" && type !== "append") return;

        for (const msg of msgs) {
            await processIncomingMessage(sessionId, sock, msg);
        }
    });

    return sock;
}

module.exports = {
    startWhatsApp
};
