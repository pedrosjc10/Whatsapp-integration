const fs = require("fs");
const path = require("path");
const { createConnection } = require("./connection");
const { handleIncoming } = require("./handlers");
const store = require("./store");

/**
 * Inicializa todas as sessões existentes em disco
 */
async function initAllSessions() {
    const User = require("../../models/User");
    const sessionsPath = path.join(__dirname, "..", "..", "..", "sessions");
    if (!fs.existsSync(sessionsPath)) {
        fs.mkdirSync(sessionsPath, { recursive: true });
    }

    try {
        const users = await User.find({});
        if (users.length === 0) {
            console.log("🆕 Nenhum usuário no banco. Criando sessão padrão...");
            createConnection("default", handleIncoming);
        } else {
            console.log(`📂 Carregando ${users.length} sessões de usuários do WhatsApp...`);
            for (const user of users) {
                createConnection(user.sessionId, handleIncoming);
            }
        }
    } catch (e) {
        console.error("Erro ao carregar sessões de usuários:", e.message);
        // Fallback para as pastas em disco se o banco falhar
        const sessions = fs.readdirSync(sessionsPath).filter(f => fs.statSync(path.join(sessionsPath, f)).isDirectory());
        for (const sessionId of sessions) {
            createConnection(sessionId, handleIncoming);
        }
    }
}

/**
 * Retorna status de todas as instâncias
 */
function getAllStatus() {
    const statuses = [];
    for (const [id, data] of store.instances) {
        statuses.push({
            id,
            status: data.status,
            number: data.number,
            hasQR: !!data.qrCode
        });
    }
    return statuses;
}

/**
 * Retorna status de uma instância específica
 */
function getStatus(sessionId) {
    const data = store.instances.get(sessionId || "default");
    return data ? { id: data.id, status: data.status, number: data.number, hasQR: !!data.qrCode } : null;
}

/**
 * Desconecta uma sessão
 */
async function logout(sessionId) {
    const instance = store.instances.get(sessionId || "default");
    if (instance && instance.sock) {
        await instance.sock.logout();
    }
}

module.exports = {
    initAllSessions,
    startWhatsApp: (sessionId) => createConnection(sessionId, handleIncoming),
    getAllStatus,
    getStatus,
    logout
};
