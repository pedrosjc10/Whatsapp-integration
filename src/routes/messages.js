const express = require("express");
const router = express.Router();
const whatsapp = require("../whatsapp");
const trello = require("../trello");

/**
 * POST /api/messages/send
 * Enviar uma mensagem de texto + confirmar automaticamente no Trello
 */
router.post("/send", async (req, res) => {
    try {
        const { number, text } = req.body;

        if (!number || !text) {
            return res.status(400).json({
                success: false,
                error: "Campos 'number' e 'text' são obrigatórios",
            });
        }

        // 1. Enviar mensagem via WhatsApp
        const result = await whatsapp.sendTextMessage(number, text);

        // 2. Processar confirmação no Trello (automático)
        let trelloResult = null;
        try {
            trelloResult = await trello.processConfirmation(
                number,
                text,
                result.status
            );
        } catch (trelloError) {
            console.error(`⚠️ Erro Trello (não bloqueante): ${trelloError.message}`);
            trelloResult = { error: trelloError.message };
        }

        // 3. Retornar resposta completa
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
 * POST /api/messages/send-bulk
 * Enviar mensagens em lote + confirmar automaticamente no Trello
 */
router.post("/send-bulk", async (req, res) => {
    try {
        const { messages } = req.body;

        if (!messages || !Array.isArray(messages) || messages.length === 0) {
            return res.status(400).json({
                success: false,
                error: "Campo 'messages' deve ser um array com pelo menos uma mensagem",
            });
        }

        const results = await whatsapp.sendBulkMessages(messages);

        // Processar confirmações no Trello para cada mensagem enviada
        const resultsWithTrello = [];
        for (let i = 0; i < results.length; i++) {
            let trelloResult = null;
            try {
                trelloResult = await trello.processConfirmation(
                    messages[i].number,
                    messages[i].text,
                    results[i].status
                );
            } catch (trelloError) {
                trelloResult = { error: trelloError.message };
            }

            resultsWithTrello.push({
                ...results[i],
                trello: trelloResult,
            });
        }

        const totalSent = results.filter((r) => r.status === "sent").length;
        const totalFailed = results.filter((r) => r.status === "failed").length;

        res.json({
            success: true,
            summary: {
                total: messages.length,
                sent: totalSent,
                failed: totalFailed,
            },
            data: resultsWithTrello,
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
    const messages = whatsapp.getSentMessages();
    res.json({ success: true, data: messages });
});

/**
 * GET /api/messages/received
 */
router.get("/received", (req, res) => {
    const messages = whatsapp.getReceivedMessages();
    res.json({ success: true, data: messages });
});

module.exports = router;
