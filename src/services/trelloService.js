/**
 * Módulo de integração dinâmico com o Trello (Multi-board)
 */

const TRELLO_BASE_URL = "https://api.trello.com/1";

// Log de ações global (Poderia ser por sessão no futuro)
const trelloActions = [];

/**
 * Valida se uma configuração do Trello é válida
 */
function isConfigValid(config) {
    return !!(config && config.apiKey && config.token && config.boardId);
}

/**
 * Request genérico para a API do Trello
 */
async function trelloFetch(endpoint, config, method = "GET", body = null) {
    if (!isConfigValid(config)) throw new Error("Configuração do Trello incompleta");

    const sep = endpoint.includes("?") ? "&" : "?";
    const url = `${TRELLO_BASE_URL}${endpoint}${sep}key=${config.apiKey}&token=${config.token}`;

    const options = {
        method,
        headers: { "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : null
    };

    const res = await fetch(url, options);
    if (!res.ok) {
        const text = await res.text();
        throw new Error(`Trello API ${res.status}: ${text}`);
    }
    return res.json();
}

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

/**
 * Atualiza etiquetas
 */
async function updateCardLabel(cardId, existingLabelIds, color, config) {
    try {
        if (existingLabelIds && existingLabelIds.length > 0) {
            for (const labelId of existingLabelIds) {
                try { await trelloFetch(`/cards/${cardId}/idLabels/${labelId}`, config, "DELETE"); } catch (e) { }
            }
        }
        const labels = await trelloFetch(`/boards/${config.boardId}/labels`, config);
        let targetLabel = labels.find(l => l.color === color);
        if (!targetLabel) {
            const name = color === "green" ? "Confirmado" : "Expirado/Atrasado";
            targetLabel = await trelloFetch("/labels", config, "POST", { name, color, idBoard: config.boardId });
        }
        await trelloFetch(`/cards/${cardId}/idLabels`, config, "POST", { value: targetLabel.id });
    } catch (error) {
        console.error(`⚠️ Erro etiqueta: ${error.message}`);
    }
}

/**
 * Busca cartões por número
 */
async function findCardsWithNumber(number, config) {
    if (!isConfigValid(config)) return [];
    const cleanInput = number.replace(/\D/g, "");
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
 * PROCESSAMENTO PRINCIPAL
 */
async function processConfirmation(number, message, status, config) {
    if (!isConfigValid(config) || status === "failed") return { success: false };

    const cards = await findCardsWithNumber(number, config);
    if (cards.length === 0) return { success: true, count: 0 };

    const targetListId = config.targetListId || await getTargetListId(config);
    const confirmed = [];

    for (const card of cards) {
        let labelColor = "green";
        if (card.due) {
            const dueDate = new Date(card.due);
            if (dueDate < new Date() && !card.dueComplete) labelColor = "yellow";
        }

        await updateCardLabel(card.id, card.idLabels, labelColor, config);

        try {
            const updateBody = { dueComplete: true };
            if (targetListId) updateBody.idList = targetListId;
            await trelloFetch(`/cards/${card.id}`, config, "PUT", updateBody);
        } catch (e) { }
        confirmed.push({ id: card.id, name: card.name, cardUrl: card.shortUrl });
    }

    trelloActions.unshift({ timestamp: new Date(), number, cardsConfirmed: confirmed.length, cards: confirmed });
    if (trelloActions.length > 100) trelloActions.pop();

    return { success: true, count: confirmed.length, confirmedCards: confirmed };
}

module.exports = {
    isConfigValid,
    processConfirmation,
    findCardsWithNumber,
    getTargetListId,
    getBoardInfo: (config) => trelloFetch(`/boards/${config.boardId}`, config),
    getBoardLists: (config) => trelloFetch(`/boards/${config.boardId}/lists`, config),
    getActions: () => trelloActions
};
