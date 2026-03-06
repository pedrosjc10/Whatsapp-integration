const QRCode = require("qrcode");
const manager = require("./manager");
const messaging = require("./messaging");
const store = require("./store");

module.exports = {
    // Gerenciamento de Sessão
    initAllSessions: manager.initAllSessions,
    startWhatsApp: manager.startWhatsApp,
    getAllStatus: manager.getAllStatus,
    getStatus: manager.getStatus,
    logout: manager.logout,

    // Mensagens e QR
    sendTextMessage: messaging.sendTextMessage,
    getSentMessages: (sessionId) => messaging.getMessages(sessionId, "sent"),
    getReceivedMessages: (sessionId) => messaging.getMessages(sessionId, "received"),

    getQRCodeDataURL: async (sessionId) => {
        const id = sessionId || "default";
        const data = store.instances.get(id);
        if (data && data.qrCode) {
            return await QRCode.toDataURL(data.qrCode);
        }
        return null;
    },

    // Filtros
    getFilters: store.getFilters,
    setFilters: store.setFilters
};
