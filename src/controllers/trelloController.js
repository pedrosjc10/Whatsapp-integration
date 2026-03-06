const trello = require("../services/trello");
const store = require("../services/whatsapp/store");

/**
 * Helper para pegar o config da sessão ou o global
 */
function getTrelloConfig(req) {
    if (req.user && req.user.trelloConfig && req.user.trelloConfig.boardId && req.user.trelloConfig.apiKey) {
        return req.user.trelloConfig;
    }

    const sessionId = req.query.sessionId || req.body.sessionId || "default";
    const instance = store.instances.get(sessionId);
    if (instance && instance.trelloConfig) return instance.trelloConfig;

    return {
        apiKey: process.env.TRELLO_API_KEY,
        token: process.env.TRELLO_TOKEN,
        boardId: process.env.TRELLO_BOARD_ID
    };
}

exports.saveConfig = async (req, res) => {
    try {
        const { sessionId, apiKey, token, boardId, targetListName } = req.body;

        if (!sessionId || !apiKey || !token || !boardId) {
            return res.status(400).json({ success: false, error: "Campos obrigatórios ausentes" });
        }

        const config = { apiKey, token, boardId };

        try {
            const board = await trello.getBoardInfo(config);
            const listId = await trello.getTargetListId(config, targetListName || "Concluído");
            if (listId) config.targetListId = listId;

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
};

exports.getStatus = async (req, res) => {
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
};

exports.getLists = async (req, res) => {
    try {
        const config = getTrelloConfig(req);
        const lists = await trello.getBoardLists(config);
        res.json({ success: true, total: lists.length, data: lists });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

exports.getBoards = async (req, res) => {
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
};

exports.getStats = async (req, res) => {
    try {
        const config = getTrelloConfig(req);
        if (!trello.isConfigValid(config)) {
            return res.json({ success: false, error: "Trello não configurado" });
        }
        let listIds = req.query.listIds ? req.query.listIds.split(',') : undefined;
        const stats = await trello.getBoardStats(config, listIds);
        res.json({ success: true, data: stats });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

exports.getDetailedStats = async (req, res) => {
    try {
        const config = getTrelloConfig(req);
        if (!trello.isConfigValid(config)) {
            return res.json({ success: false, error: "Trello não configurado" });
        }
        let listIds = req.query.listIds ? req.query.listIds.split(',') : undefined;
        const stats = await trello.getDetailedBoardStats(config, listIds);
        res.json({ success: true, data: stats });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

exports.getActions = (req, res) => {
    res.json({ success: true, data: trello.getActions() });
};

