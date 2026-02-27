const express = require("express");
const router = express.Router();
const whatsapp = require("../whatsapp");
const trello = require("../trello");

/**
 * POST /api/messages/send
 */
router.post("/send", async (req, res) => {
    try {
        const { number, text, sessionId } = req.body;

        if (!number || !text) {
            return res.status(400).json({
                success: false,
                error: "Campos 'number' e 'text' são obrigatórios",
            });
        }

        // 1. Enviar mensagem via WhatsApp (usando a sessão especificada ou default)
        const result = await whatsapp.sendTextMessage(sessionId || "default", number, text);

        // 2. Processar confirmação no Trello (sempre automático se bater com cartão)
        let trelloResult = null;
        try {
            trelloResult = await trello.processConfirmation(
                number,
                text,
                result.status
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
});

/**
 * GET /api/messages/sent
 */
router.get("/sent", (req, res) => {
    const sessionId = req.query.sessionId || "default";
    const messages = whatsapp.getSentMessages(sessionId);
    res.json({ success: true, data: messages });
});

/**
 * GET /api/messages/received
 */
router.get("/received", (req, res) => {
    const sessionId = req.query.sessionId || "default";
    const messages = whatsapp.getReceivedMessages(sessionId);
    res.json({ success: true, data: messages });
});

module.exports = router;
