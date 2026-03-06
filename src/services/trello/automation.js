const { trelloFetch } = require("./api");



/**
 * Monitora criação de novos cards
 */
async function checkNewCardsAndNotify(config, lastId, onNewCard) {
    try {
        const cards = await trelloFetch(`/boards/${config.boardId}/cards?fields=name,shortUrl,idList&filter=open&limit=100`, config);
        // console.log(`🔍 Board ${config.boardId}: ${cards?.length || 0} cards encontrados.`);
        if (!cards || cards.length === 0) return lastId;

        const sortedCards = cards.sort((a, b) => a.id.localeCompare(b.id));

        if (!lastId) {
            return sortedCards[sortedCards.length - 1].id;
        }

        const newCards = sortedCards.filter(c => c.id > lastId);

        if (newCards.length > 0) {
            const lists = await trelloFetch(`/boards/${config.boardId}/lists?fields=name`, config);
            const listMap = {};
            lists.forEach(l => listMap[l.id] = l.name);

            for (const card of newCards) {
                card.listName = listMap[card.idList] || "Desconhecida";
                await onNewCard(card);
            }
        }
        return newCards.length > 0 ? newCards[newCards.length - 1].id : lastId;
    } catch (e) {
        console.error("❌ Erro ao verificar novos cards:", e.message);
        return lastId;
    }
}


module.exports = {
    checkNewCardsAndNotify
};
