/**
 * Módulo de integração simplificado com o Trello
 */

const TRELLO_BASE_URL = "https://api.trello.com/1";

let config = {
    apiKey: null,
    token: null,
    boardId: null,
    targetListId: null,
};

// Log de ações do Trello
const trelloActions = [];

/**
 * Inicializar configuração do Trello
 */
async function initTrello() {
    config.apiKey = process.env.TRELLO_API_KEY;
    config.token = process.env.TRELLO_TOKEN;
    config.boardId = process.env.TRELLO_BOARD_ID;

    const isConfigured = config.apiKey && config.token && config.boardId;

    if (isConfigured) {
        try {
            const board = await trelloFetch(`/boards/${config.boardId}?fields=id,name`);
            config.boardId = board.id;
            console.log(`🔗 Trello Conectado: Board "${board.name}"`);

            // Buscar ID da lista de destino (Concluído)
            const listName = process.env.TRELLO_CONFIRMED_LIST_NAME || "Concluído";
            const lists = await trelloFetch(`/boards/${config.boardId}/lists?fields=id,name`);
            const target = lists.find(l => l.name.toLowerCase().includes(listName.toLowerCase()));

            if (target) {
                config.targetListId = target.id;
                console.log(`📌 Lista de destino configurada: "${target.name}" (${target.id})`);
            } else {
                console.warn(`⚠️ Lista "${listName}" não encontrada no board.`);
                console.log("   Colunas disponíveis no seu board:");
                lists.forEach(l => console.log(`   - ${l.name}`));
                console.log("   Dica: Ajuste o TRELLO_CONFIRMED_LIST_NAME no arquivo .env para um desses nomes.");
            }
        } catch (error) {
            console.error(`❌ Erro Trello: ${error.message}`);
        }
    }
    return isConfigured;
}

function isConfigured() {
    return config.apiKey && config.token && config.boardId;
}

/**
 * Request para API do Trello
 */
async function trelloFetch(endpoint, method = "GET", body = null) {
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
        throw new Error(`API ${res.status}: ${text}`);
    }
    return res.json();
}

/**
 * Atualiza a etiqueta do cartão (Remove anteriores e coloca a nova)
 * @param {string} cardId ID do cartão
 * @param {Array} existingLabelIds IDs das etiquetas atuais no cartão
 * @param {string} color Cor da nova etiqueta ('green' ou 'yellow')
 */
async function updateCardLabel(cardId, existingLabelIds, color) {
    try {
        // 1. Remover etiquetas atuais do cartão para ele ter apenas UMA
        if (existingLabelIds && existingLabelIds.length > 0) {
            for (const labelId of existingLabelIds) {
                try {
                    await trelloFetch(`/cards/${cardId}/idLabels/${labelId}`, "DELETE");
                } catch (e) {
                    // Ignora erros ao tentar remover etiquetas que podem já ter sumido
                }
            }
        }

        // 2. Ver se o board já tem a etiqueta da cor desejada
        const labels = await trelloFetch(`/boards/${config.boardId}/labels`);
        let targetLabel = labels.find(l => l.color === color);

        // 3. Se não tiver no board, cria uma
        if (!targetLabel) {
            const name = color === "green" ? "Confirmado" : "Expirado/Atrasado";
            targetLabel = await trelloFetch("/labels", "POST", {
                name,
                color,
                idBoard: config.boardId
            });
        }

        // 4. Coloca a etiqueta no cartão
        await trelloFetch(`/cards/${cardId}/idLabels`, "POST", {
            value: targetLabel.id
        });

        console.log(`   🎨 Etiqueta ${color} aplicada ao cartão ${cardId}`);
    } catch (error) {
        console.error(`   ⚠️ Erro ao atualizar etiqueta (${color}): ${error.message}`);
    }
}


/**
 * Buscar cartões com o número
 */
async function findCardsWithNumber(number) {
    if (!isConfigured()) return [];

    const cleanInput = number.replace(/\D/g, "");

    const found = [];
    try {
        const cards = await trelloFetch(`/boards/${config.boardId}/cards?fields=name,desc,shortUrl,due,idLabels,dueComplete`);

        for (const card of cards) {
            // Limpa o conteúdo do cartão para comparar números puros
            const cardContentClean = (card.name + " " + (card.desc || "")).replace(/\D/g, "");

            // Se o número limpo que buscamos estiver dentro do conteúdo limpo do cartão
            if (cardContentClean.includes(cleanInput) || (cleanInput.length > 8 && cardContentClean.includes(cleanInput.slice(-8)))) {
                console.log(`   ✅ Encontrado no cartão: "${card.name}"`);
                found.push(card);
            }
        }
    } catch (e) {
        console.error(`❌ Erro busca: ${e.message}`);
    }
    return found;
}

/**
 * PROCESSAMENTO PRINCIPAL
 */
async function processConfirmation(number, message, status) {
    if (!isConfigured() || status === "failed") return { success: false };

    console.log(`🚀 Iniciando processo Trello para: ${number}`);
    const cards = await findCardsWithNumber(number);

    if (cards.length === 0) {
        console.log(`ℹ️ Nenhum cartão encontrado para o número ${number}`);
        return { success: true, count: 0 };
    }

    console.log(`🎯 Trello: Encontrado ${cards.length} cartão(ões) para ${number}`);

    const confirmed = [];
    for (const card of cards) {
        console.log(`   🛠️ Processando cartão: "${card.name}" (${card.id})`);

        // 1. Determinar cor da etiqueta (Verde vs Amarelo para expirados)
        let labelColor = "green";
        if (card.due) {
            const dueDate = new Date(card.due);
            const now = new Date();
            // Se a data passou e não está marcada como completa
            if (dueDate < now && !card.dueComplete) {
                console.log(`   ⏰ Cartão expira(ou) em ${dueDate.toLocaleString()}. Usando AMARRELO.`);
                labelColor = "yellow";
            }
        }

        // 2. Aplicar etiqueta (Remove as antigas e coloca a nova)
        try {
            await updateCardLabel(card.id, card.idLabels, labelColor);
        } catch (e) {
            console.error(`   ❌ Falha na etiqueta: ${e.message}`);
        }

        // 3. Mover para a lista de concluídos e marcar prazo como concluído
        try {
            const updateBody = {
                dueComplete: true
            };

            if (config.targetListId) {
                updateBody.idList = config.targetListId;
                console.log(`   📦 Movendo cartão para lista ID: ${config.targetListId}`);
            }

            await trelloFetch(`/cards/${card.id}`, "PUT", updateBody);
        } catch (e) {
            console.error(`   ❌ Falha ao mover/concluir cartão: ${e.message}`);
        }

        // Confirmamos que o cartão foi processado
        confirmed.push({ id: card.id, name: card.name, cardUrl: card.shortUrl });
    }

    const action = {
        timestamp: new Date(),
        number,
        cardsConfirmed: confirmed.length,
        cards: confirmed
    };
    trelloActions.unshift(action);
    if (trelloActions.length > 100) trelloActions.pop();

    console.log(`✅ Finalizado: ${confirmed.length} cartões atualizados.`);
    return { success: true, cardsConfirmed: confirmed.length, confirmedCards: confirmed };
}

module.exports = {
    initTrello,
    isConfigured,
    processConfirmation,
    getActions: () => trelloActions,
    getBoardInfo: async () => trelloFetch(`/boards/${config.boardId}`),
    getBoardLists: async () => trelloFetch(`/boards/${config.boardId}/lists`),
    findCardsWithNumber
};
