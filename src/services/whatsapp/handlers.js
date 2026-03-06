const trello = require("../trello"); // Usando o novo serviço modularizado
const store = require("./store");

/**
 * Processador de Mensagens do WhatsApp
 * Lida com filtros e integração com Trello
 */
async function processIncomingMessage(sessionId, sock, msg) {
    const { instances, startupTimestamp } = store;
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

    const keywords = instanceData?.filterKeywords || [];
    const mediaTypes = instanceData?.filterMediaTypes || [];

    const isMediaOther = content === "[Mídia/Outro]";

    if (!isMediaOther) {
        let passFilter = true;
        if (keywords.length > 0 || mediaTypes.length > 0) {
            const hasKeyword = keywords.length > 0 && keywords.some(k => content.toLowerCase().includes(k.toLowerCase()));
            const hasMediaType = mediaTypes.length > 0 && mediaTypes.includes(mediaType.toLowerCase());
            passFilter = hasKeyword || hasMediaType;
        }

        if (passFilter) {
            const searchTerms = new Set([senderNumber]);
            if (msg.pushName) searchTerms.add(msg.pushName);

            // Tenta resolver números @lid apenas se estiver conectado
            if (jid.endsWith("@lid") && instanceData?.status === "connected") {
                try {
                    const [resolved] = await sock.onWhatsApp(jid);
                    if (resolved && resolved.jid) searchTerms.add(resolved.jid.split("@")[0]);
                } catch (e) {
                    console.log(`⚠️ [${sessionId}] Não foi possível resolver @lid (conexão instável)`);
                }
            }

            console.log(`\n${fromMe ? '📤' : '📥'} [${sessionId}] Filtro Passou: ${content.substring(0, 30)}...`);
            for (const term of searchTerms) {
                if (instanceData?.trelloConfig && instanceData?.status === "connected") {
                    try {
                        await trello.processConfirmation(term, content, fromMe ? "sent" : "received", instanceData.trelloConfig);
                    } catch (e) {
                        console.error(`⚠️ [${sessionId}] Erro ao sincronizar com Trello:`, e.message);
                    }
                }
            }
        }
    }

    // Registrar no histórico do Dashboard
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
    handleIncoming: processIncomingMessage
};
