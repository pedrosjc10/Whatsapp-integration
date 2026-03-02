const trello = require("../trelloService");
const store = require("./store");

/**
 * Processador de Mensagens do WhatsApp
 */
async function processIncomingMessage(sessionId, sock, msg) {
    const { instances, getFilters, startupTimestamp } = store;
    const instanceData = instances.get(sessionId);

    const jid = msg.key.remoteJid;
    if (!jid || jid.endsWith("@g.us")) return;

    const fromMe = msg.key.fromMe;
    const senderNumber = jid.split("@")[0];
    const msgTimestamp = msg.messageTimestamp;

    // Evita processar mensagens antigas enviadas antes do bot ligar
    if (msgTimestamp < (startupTimestamp - 60)) return;

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

    // Lógica de Filtro
    const { keywords, mediaTypes } = getFilters();
    const isMediaOther = content === "[Mídia/Outro]";

    if (!isMediaOther) {
        let passFilter = true;
        if (keywords.length > 0 || mediaTypes.length > 0) {
            const hasKeyword = keywords.length > 0 && keywords.some(k => content.toLowerCase().includes(k));
            const hasMediaType = mediaTypes.length > 0 && mediaTypes.includes(mediaType);
            passFilter = hasKeyword || hasMediaType;
        }

        if (passFilter) {
            const searchTerms = new Set([senderNumber]);
            if (msg.pushName) searchTerms.add(msg.pushName);

            // Tenta resolver números mascarados (@lid) se necessário
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

    // Registrar no histórico do Dashboard (Apenas se não for enviado por mim, ou conforme sua regra)
    if (!fromMe && instanceData) {
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

module.exports = {
    processIncomingMessage
};
