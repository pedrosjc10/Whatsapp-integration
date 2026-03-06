const { trelloFetch } = require("./api");

const trelloActions = [];

/**
 * Busca a lista de destino (ex: 'Concluído') e retorna o ID dela
 */
async function getTargetListId(config, listName = "Concluído") {
    try {
        const lists = await trelloFetch(`/boards/${config.boardId}/lists?fields=id,name`, config);
        const target = lists.find(l => l.name.toLowerCase().includes(listName.toLowerCase()));
        return target ? target.id : null;
    } catch (e) {
        console.error("Erro ao buscar lista no Trello:", e.message);
        return null;
    }
}

async function findCardsWithNumber(number, config) {
    if (!number) return [];

    // Limpar apenas números
    const cleanInput = number.replace(/\D/g, "");

    // Critério de segurança: Se não houver pelo menos 5 dígitos, ignoramos 
    // para evitar que nomes de usuários sem números (string vazia) batam com todos os cards
    if (cleanInput.length < 5) {
        return [];
    }

    const found = [];
    try {
        const cards = await trelloFetch(`/boards/${config.boardId}/cards?fields=name,desc,shortUrl,due,idLabels,dueComplete`, config);
        for (const card of cards) {
            const cardContentClean = (card.name + " " + (card.desc || "")).replace(/\D/g, "");
            if (cardContentClean.includes(cleanInput) || (cleanInput.length > 8 && cardContentClean.includes(cleanInput.slice(-8)))) {
                found.push(card);
            }
        }
    } catch (e) { console.error(`❌ Erro busca: ${e.message}`); }
    return found;
}

/**
 * Processa a confirmação vinda do WhatsApp: Encontra o card e move/etiqueta
 */
async function processConfirmation(number, message, status, config) {
    if (status === "failed") return { success: false };

    const cards = await findCardsWithNumber(number, config);
    if (cards.length === 0) return { success: true, count: 0 };

    const confirmed = [];

    for (const card of cards) {
        // Apenas registra a ação no dashboard, mas NÃO altera mais nada no Trello
        confirmed.push({ id: card.id, name: card.name, cardUrl: card.shortUrl });
    }

    trelloActions.unshift({ timestamp: new Date(), number, cardsConfirmed: confirmed.length, cards: confirmed });
    if (trelloActions.length > 100) trelloActions.pop();

    return { success: true, count: confirmed.length, confirmedCards: confirmed };
}

module.exports = {
    getTargetListId,
    findCardsWithNumber,
    processConfirmation,
    getActions: () => trelloActions
};
