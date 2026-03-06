const store = require("./store");

/**
 * Envia mensagem de texto simples
 */
async function sendTextMessage(sessionId, number, text) {
    const instance = store.instances.get(sessionId || "default");
    if (!instance || instance.status !== "connected") {
        throw new Error(`Sessão ${sessionId || 'default'} não está conectada.`);
    }

    const jid = number.replace(/\D/g, "") + "@s.whatsapp.net";
    const result = await instance.sock.sendMessage(jid, { text });

    const msgRecord = {
        id: result.key.id,
        to: number,
        content: text,
        status: "sent",
        timestamp: new Date().toISOString()
    };

    instance.sentMessages.unshift(msgRecord);
    if (instance.sentMessages.length > 500) instance.sentMessages.pop();

    return msgRecord;
}

/**
 * Retorna histórico de mensagens
 */
function getMessages(sessionId, type = "sent") {
    const instance = store.instances.get(sessionId || "default");
    if (!instance) return [];
    return type === "sent" ? instance.sentMessages : instance.receivedMessages;
}

module.exports = {
    sendTextMessage,
    getMessages
};
