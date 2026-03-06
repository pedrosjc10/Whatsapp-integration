const whatsapp = require("../services/whatsapp");
const trello = require("../services/trello");

exports.sendMessage = async (req, res) => {
    try {
        const messageContent = text || req.body.message;

        if (!number || !messageContent) {
            return res.status(400).json({
                success: false,
                error: "Campos 'number' e 'text' (ou 'message') são obrigatórios",
            });
        }

        const result = await whatsapp.sendTextMessage(sessionId || "default", number, messageContent);

        let trelloResult = null;
        try {
            // Pegar config do usuário se disponível
            let trelloConfig = req.user?.trelloConfig;

            // Se não, tentar pegar da instância
            if (!trelloConfig) {
                const status = whatsapp.getStatus(sessionId || "default");
                if (status && status.trelloConfig) trelloConfig = status.trelloConfig;
            }

            trelloResult = await trello.processConfirmation(
                number,
                messageContent,
                "sent", // Status no Trello é sempre "sent" para mensagens enviadas por aqui
                trelloConfig
            );
        } catch (trelloError) {
            console.error(`⚠️ Erro Trello: ${trelloError.message}`);
            trelloResult = { error: trelloError.message };
        }

        res.json({
            success: result.status !== "failed",
            data: {
                ...result,
                trello: trelloResult,
            },
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message,
        });
    }
};

exports.getSentMessages = (req, res) => {
    const sessionId = req.query.sessionId || "default";
    const messages = whatsapp.getSentMessages(sessionId);
    res.json({ success: true, data: messages });
};

exports.getReceivedMessages = (req, res) => {
    const sessionId = req.query.sessionId || "default";
    const messages = whatsapp.getReceivedMessages(sessionId);
    res.json({ success: true, data: messages });
};
