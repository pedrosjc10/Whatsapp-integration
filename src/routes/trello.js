const express = require("express");
const router = express.Router();
const trello = require("../trello");

/**
 * GET /api/trello/status
 * Status da integração com o Trello
 */
router.get("/status", async (req, res) => {
    try {
        const configured = trello.isConfigured();

        if (!configured) {
            return res.json({
                success: true,
                data: {
                    configured: false,
                    message: "Trello não configurado. Crie um arquivo .env com as credenciais.",
                },
            });
        }

        const boardInfo = await trello.getBoardInfo();

        res.json({
            success: true,
            data: {
                configured: true,
                board: boardInfo,
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
 * GET /api/trello/lists
 * Listar as listas do board
 */
router.get("/lists", async (req, res) => {
    try {
        const lists = await trello.getBoardLists();

        res.json({
            success: true,
            total: lists.length,
            data: lists.map((l) => ({
                id: l.id,
                name: l.name,
                closed: l.closed,
            })),
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message,
        });
    }
});

/**
 * POST /api/trello/search
 * Buscar cartões que contenham um número de telefone
 *
 * Body: { "number": "5511999998888" }
 */
router.post("/search", async (req, res) => {
    try {
        const { number } = req.body;

        if (!number) {
            return res.status(400).json({
                success: false,
                error: "Campo 'number' é obrigatório",
            });
        }

        const cards = await trello.findCardsWithNumber(number);

        res.json({
            success: true,
            total: cards.length,
            data: cards,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message,
        });
    }
});

/**
 * GET /api/trello/actions
 * Listar histórico de ações do Trello (confirmações automáticas)
 */
router.get("/actions", (req, res) => {
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const offset = parseInt(req.query.offset) || 0;

    const actions = trello.getActions();
    const paginated = actions.slice(offset, offset + limit);

    res.json({
        success: true,
        pagination: {
            total: actions.length,
            limit,
            offset,
            hasMore: offset + limit < actions.length,
        },
        data: paginated,
    });
});

module.exports = router;
