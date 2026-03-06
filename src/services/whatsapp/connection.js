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
const User = require("../../models/User");

const qrcode = require("qrcode-terminal");

const logger = pino({ level: "silent" });

/**
 * Inicializa uma instância do WhatsApp (Socket)
 */
async function createConnection(sessionId = "default", onMessage) {
    const { instances } = store;

    // Trava de segurança: Se já estiver tentando conectar ou já conectado, não abre outra para o mesmo ID
    const existing = instances.get(sessionId);
    if (existing && (existing.status === "connected" || existing.status === "connecting" || existing.status === "awaiting_qr")) {
        console.log(`ℹ️ [${sessionId}] Sessão já em andamento (Status: ${existing.status}). Pulando nova conexão.`);
        return existing.sock;
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
        auth: state,
        generateHighQualityLinkPreview: true,
    });

    // Carregar dados extras do banco (Trello e Filtros)
    let trelloConfig = store.loadTrelloConfig(sessionId);
    let filterKeywords = [];
    let filterMediaTypes = [];

    try {
        const user = await User.findOne({ sessionId });
        if (user) {
            trelloConfig = user.trelloConfig;
            filterKeywords = user.filterKeywords || [];
            filterMediaTypes = user.filterMediaTypes || [];
        }
    } catch (e) {
        console.error(`Erro ao carregar dados do usuário no StartWhatsApp [${sessionId}]:`, e.message);
    }

    const instanceData = {
        id: sessionId,
        sock,
        qrCode: null,
        status: "connecting",
        number: null,
        sentMessages: [],
        receivedMessages: [],
        trelloConfig,
        filterKeywords,
        filterMediaTypes
    };
    instances.set(sessionId, instanceData);

    // Eventos de Conexão
    sock.ev.on("connection.update", async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            instanceData.qrCode = qr;
            instanceData.status = "awaiting_qr";
            console.log(`\n📱 [${sessionId}] QR Code gerado! Escaneie abaixo:`);
            qrcode.generate(qr, { small: true });
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
                    createConnection(sessionId, onMessage);
                }
            } else {
                console.log(`🚪 [${sessionId}] Logout/Encerramento detectado. Reiniciando para novo QR Code...`);
                try {
                    sock.ev.removeAllListeners("connection.update");
                    sock.ev.removeAllListeners("creds.update");
                    sock.ev.removeAllListeners("messages.upsert");
                    sock.end(); // Garante o fechamento total antes de apagar arquivos

                    if (fs.existsSync(authPath)) {
                        fs.rmSync(authPath, { recursive: true, force: true });
                    }

                    // Delay para garantir que arquivos foram liberados
                    await delay(3000);

                    // Reinicia a conexão no mesmo ID para gerar novo QR
                    createConnection(sessionId, onMessage);
                } catch (e) {
                    console.error(`Erro ao reiniciar ${sessionId} pós-logout:`, e);
                }
            }
        } else if (connection === "open") {
            instanceData.status = "connected";
            instanceData.qrCode = null;
            instanceData.number = sock.user?.id?.split(":")[0] || sock.user?.id;
            console.log(`\n✅ [${sessionId}] WhatsApp Conectado: ${instanceData.number}\n`);
        }
    });

    sock.ev.on("creds.update", async () => {
        try {
            await saveCreds();
        } catch (e) {
            console.error(`⚠️ [${sessionId}] Erro ao salvar credenciais:`, e.message);
        }
    });

    // Repassar mensagens para o processador externo
    sock.ev.on("messages.upsert", async ({ messages, type }) => {
        try {
            if (type === "notify" || type === "append") {
                for (const msg of messages) {
                    await onMessage(sessionId, sock, msg).catch(e => {
                        console.error(`⚠️ [${sessionId}] Erro ao processar mensagem individual:`, e.message);
                    });
                }
            }
        } catch (e) {
            console.error(`⚠️ [${sessionId}] Erro crítico no fluxo de mensagens:`, e.message);
        }
    });

    return sock;
}

module.exports = {
    createConnection
};
