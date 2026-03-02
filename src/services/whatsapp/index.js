const fs = require("fs");
const path = require("path");
const QRCode = require("qrcode");
const store = require("./store");
const { startWhatsApp } = require("./client");

/**
 * Inicializa todas as sessões existentes em disco
 */
async function initAllSessions() {
    const sessionsPath = path.join(__dirname, "..", "..", "..", "sessions");
    if (!fs.existsSync(sessionsPath)) {
        fs.mkdirSync(sessionsPath, { recursive: true });
    }

    const sessions = fs.readdirSync(sessionsPath).filter(f => fs.statSync(path.join(sessionsPath, f)).isDirectory());
    if (sessions.length === 0) {
        startWhatsApp("default");
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
        const instance = store.instances.get(sessionId || "default");
        if (!instance || instance.status !== "connected") throw new Error("WhatsApp offline");
        const jid = number.replace(/\D/g, "") + "@s.whatsapp.net";
        const result = await instance.sock.sendMessage(jid, { text });
        const msgRecord = { id: result.key.id, to: number, content: text, status: "sent", timestamp: new Date().toISOString() };
        instance.sentMessages.unshift(msgRecord);
        return msgRecord;
    },

    getAllStatus: () => {
        const statuses = [];
        for (const [id, data] of store.instances) {
            statuses.push({ id, status: data.status, number: data.number, hasQR: !!data.qrCode });
        }
        return statuses;
    },

    getStatus: (sessionId) => {
        const data = store.instances.get(sessionId || "default");
        return data ? { id: data.id, status: data.status, number: data.number, hasQR: !!data.qrCode } : null;
    },

    getQRCodeDataURL: async (sessionId) => {
        const data = store.instances.get(sessionId || "default");
        return (data && data.qrCode) ? QRCode.toDataURL(data.qrCode) : null;
    },

    getSentMessages: (sessionId) => store.instances.get(sessionId || "default")?.sentMessages || [],
    getReceivedMessages: (sessionId) => store.instances.get(sessionId || "default")?.receivedMessages || [],

    logout: async (sessionId) => {
        const instance = store.instances.get(sessionId || "default");
        if (instance && instance.sock) await instance.sock.logout();
    },

    getFilters: store.getFilters,
    setFilters: store.setFilters
};
