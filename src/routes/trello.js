const express = require("express");
const router = express.Router();
const trello = require("../services/trelloService");
const whatsapp = require("../services/whatsapp"); // Precisamos para pegar as instâncias
const store = require("../services/whatsapp/store");

/**
 * Helper para pegar o config da sessão ou o global (fallback opcional)
 */
function getSessionConfig(sessionId) {
    const status = whatsapp.getStatus(sessionId);
    // Tenta pegar da instância ativa
    const instance = store.instances.get(sessionId || "default");
    if (instance && instance.trelloConfig) return instance.trelloConfig;

    // Fallback para variáveis de ambiente (se você quiser manter um "admin" padrão)
    return {
        apiKey: process.env.TRELLO_API_KEY,
        token: process.env.TRELLO_TOKEN,
        boardId: process.env.TRELLO_BOARD_ID
    };
}

/**
 * POST /api/trello/config
 * Salva a configuração do Trello para uma sessão específica
 */
router.post("/config", async (req, res) => {
    try {
        const { sessionId, apiKey, token, boardId, targetListName } = req.body;

        if (!sessionId || !apiKey || !token || !boardId) {
            return res.status(400).json({ success: false, error: "Campos obrigatórios ausentes" });
        }

        const config = { apiKey, token, boardId };

        // Validar se as credenciais funcionam antes de salvar
        try {
            const board = await trello.getBoardInfo(config);

            // Buscar ID da lista (opcional, mas bom ter salvo)
            const listId = await trello.getTargetListId(config, targetListName || "Concluído");
            if (listId) config.targetListId = listId;

            // Salvar no disco e na memória
            store.saveTrelloConfig(sessionId, config);

            res.json({
                success: true,
                message: `Trello conectado com sucesso ao Board: ${board.name}`,
                data: { boardName: board.name }
            });
        } catch (e) {
            return res.status(401).json({ success: false, error: "Credenciais do Trello inválidas ou Board não encontrado" });
        }
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * GET /api/trello/status
 */
router.get("/status", async (req, res) => {
    try {
        const sessionId = req.query.sessionId || "default";
        const config = getSessionConfig(sessionId);

        if (!trello.isConfigValid(config)) {
            return res.json({
                success: true,
                data: { configured: false, message: "Trello não configurado para esta sessão." }
            });
        }

        const boardInfo = await trello.getBoardInfo(config);
        res.json({ success: true, data: { configured: true, board: boardInfo } });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * GET /api/trello/lists
 */
router.get("/lists", async (req, res) => {
    try {
        const sessionId = req.query.sessionId || "default";
        const config = getSessionConfig(sessionId);
        const lists = await trello.getBoardLists(config);
        res.json({ success: true, total: lists.length, data: lists });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * GET /api/trello/actions
 */
router.get("/actions", (req, res) => {
    const actions = trello.getActions();
    res.json({ success: true, data: actions });
});

module.exports = router;
