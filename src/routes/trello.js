const express = require("express");
const router = express.Router();
const trello = require("../services/trelloService");
const whatsapp = require("../services/whatsapp"); // Precisamos para pegar as instâncias
const store = require("../services/whatsapp/store");

/**
 * Helper para pegar o config da sessão ou o global (fallback opcional)
 */
/**
 * Helper para pegar o config da sessão ou o global (fallback opcional)
 */
function getTrelloConfig(req) {
    // 1. Prioridade total: Configuração salva no usuário logado (MongoDB)
    if (req.user && req.user.trelloConfig && req.user.trelloConfig.boardId && req.user.trelloConfig.apiKey) {
        return req.user.trelloConfig;
    }

    // 2. Segunda opção: Instância ativa em memória
    const sessionId = req.query.sessionId || req.body.sessionId || "default";
    const instance = store.instances.get(sessionId);
    if (instance && instance.trelloConfig) return instance.trelloConfig;

    // 3. Fallback: Variáveis de ambiente
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
        const config = getTrelloConfig(req);

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
        const config = getTrelloConfig(req);
        const lists = await trello.getBoardLists(config);
        res.json({ success: true, total: lists.length, data: lists });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * GET /api/trello/boards
 * Retorna todos os quadros que o usuário tem acesso
 */
router.get("/boards", async (req, res) => {
    try {
        const config = getTrelloConfig(req);
        if (!config || !config.apiKey || !config.token) {
            return res.json({ success: false, error: "Trello não configurado" });
        }
        const boards = await trello.getUserBoards(config);
        res.json({ success: true, data: boards });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * GET /api/trello/stats
 */
router.get("/stats", async (req, res) => {
    try {
        const config = getTrelloConfig(req);

        if (!trello.isConfigValid(config)) {
            return res.json({ success: false, error: "Trello não configurado" });
        }

        let listIds = undefined;
        if (req.query.listIds) {
            listIds = req.query.listIds.split(',');
        }

        const stats = await trello.getBoardStats(config, listIds);
        res.json({ success: true, data: stats });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * GET /api/trello/detailed-stats
 */
router.get("/detailed-stats", async (req, res) => {
    try {
        const config = getTrelloConfig(req);

        if (!trello.isConfigValid(config)) {
            return res.json({ success: false, error: "Trello não configurado" });
        }

        let listIds = undefined;
        if (req.query.listIds) {
            listIds = req.query.listIds.split(',');
        }

        const stats = await trello.getDetailedBoardStats(config, listIds);
        res.json({ success: true, data: stats });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * GET /api/trello/actions
 */
router.get("/actions", (req, res) => {
    res.json({ success: true, data: trello.getActions() });
});

module.exports = router;
