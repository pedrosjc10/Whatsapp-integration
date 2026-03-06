const { trelloFetch, trelloFetchLight } = require("./api");

/**
 * Retorna as estatísticas básicas do Board (pendentes, atrasados, concluídos)
 */
async function getBoardStats(config, filterListIds) {
    const stats = { pending: 0, overdue: 0, completed: 0, total: 0 };
    const now = new Date();

    try {
        const cards = await trelloFetch(`/boards/${config.boardId}/cards?fields=due,dueComplete,idList`, config);

        cards.forEach(card => {
            if (filterListIds && filterListIds.length > 0 && !filterListIds.includes(card.idList)) return;

            stats.total++;
            if (card.dueComplete) {
                stats.completed++;
            } else if (card.due && new Date(card.due) < now) {
                stats.overdue++;
            } else {
                stats.pending++;
            }
        });
    } catch (e) {
        console.error(`Erro ao buscar stats:`, e.message);
    }
    return stats;
}

/**
 * Retorna estatísticas detalhadas cruzando Lista x Etiquetas
 */
async function getDetailedBoardStats(config, filterListIds) {
    let labelMap = {};
    let listMap = {};

    try {
        const [lists, labels, cards] = await Promise.all([
            trelloFetch(`/boards/${config.boardId}/lists?fields=name&filter=open`, config),
            trelloFetch(`/boards/${config.boardId}/labels?fields=name,color`, config),
            trelloFetch(`/boards/${config.boardId}/cards?fields=idList,idLabels,name&filter=open&limit=1000`, config)
        ]);

        labels.forEach(l => {
            labelMap[l.id] = l.name || l.color;
        });

        lists.forEach(l => {
            listMap[l.id] = {
                id: l.id,
                name: l.name,
                stats: {}
            };
        });

        cards.forEach(card => {
            const list = listMap[card.idList];
            if (list) {
                if (card.idLabels && card.idLabels.length > 0) {
                    card.idLabels.forEach(labelId => {
                        const labelName = labelMap[labelId];
                        if (labelName) {
                            list.stats[labelName] = (list.stats[labelName] || 0) + 1;
                        }
                    });
                } else {
                    list.stats["Sem etiqueta"] = (list.stats["Sem etiqueta"] || 0) + 1;
                }
            }
        });

    } catch (e) {
        console.error(`Erro ao buscar detailed stats:`, e.message);
    }

    const allLabelNames = [...new Set(Object.values(labelMap))];
    let resultData = Object.values(listMap);

    if (filterListIds && filterListIds.length > 0) {
        resultData = resultData.filter(l => filterListIds.includes(l.id));
    }

    resultData.forEach(list => {
        allLabelNames.forEach(labelName => {
            if (list.stats[labelName] === undefined) list.stats[labelName] = 0;
        });
        if (list.stats["Sem etiqueta"] === undefined) list.stats["Sem etiqueta"] = 0;
    });

    return {
        labels: allLabelNames.concat(["Sem etiqueta"]),
        data: resultData,
        allLists: Object.values(listMap).map(l => ({ id: l.id, name: l.name }))
    };
}

module.exports = {
    getBoardStats,
    getDetailedBoardStats,
    getUserBoards: (config) => trelloFetchLight(`/members/me/boards?fields=name,id`, config),
    getBoardInfo: (config) => trelloFetch(`/boards/${config.boardId}`, config),
    getBoardLists: (config) => trelloFetch(`/boards/${config.boardId}/lists`, config)
};
