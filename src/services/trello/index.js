const api = require("./api");
const operations = require("./operations");
const stats = require("./stats");
const automation = require("./automation");

module.exports = {
    // API & Config
    isConfigValid: api.isConfigValid,

    // Operações
    processConfirmation: operations.processConfirmation,
    findCardsWithNumber: operations.findCardsWithNumber,
    getTargetListId: operations.getTargetListId,
    getActions: operations.getActions,

    // Leitura & Stats
    getBoardStats: stats.getBoardStats,
    getDetailedBoardStats: stats.getDetailedBoardStats,
    getUserBoards: stats.getUserBoards,
    getBoardInfo: stats.getBoardInfo,
    getBoardLists: stats.getBoardLists,

    // Automação
    checkNewCardsAndNotify: automation.checkNewCardsAndNotify,
    startTrelloMonitor: require("./monitor").startTrelloMonitor
};
