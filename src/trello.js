/**
 * Módulo de integração simplificado com o Trello
 */

const TRELLO_BASE_URL = "https://api.trello.com/1";

let config = {
    apiKey: null,
    token: null,
    boardId: null,
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
            config.boardId = board.id; // Garante o ID longo
            console.log(`🔗 Trello Conectado: Board "${board.name}"`);
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
 * Adicionar Etiqueta Verde ao cartão
 */
async function addGreenLabel(cardId) {
    try {
        // 1. Ver se o board já tem uma etiqueta verde
        const labels = await trelloFetch(`/boards/${config.boardId}/labels`);
        let greenLabel = labels.find(l => l.color === "green");

        // 2. Se não tiver, cria uma
        if (!greenLabel) {
            greenLabel = await trelloFetch("/labels", "POST", {
                name: "Confirmado",
                color: "green",
                idBoard: config.boardId
            });
        }

        // 3. Tenta colocar a etiqueta no cartão
        // Usamos o endpoint de adicionar label por ID
        await trelloFetch(`/cards/${cardId}/idLabels`, "POST", {
            value: greenLabel.id
        });

        console.log(`   🎨 Etiqueta verde adicionada ao cartão ${cardId}`);
    } catch (error) {
        // Se o erro for "label already on card", ignoramos
        if (!error.message.includes("already")) {
            console.error(`   ⚠️ Erro na etiqueta: ${error.message}`);
        }
    }
}

/**
 * Adicionar Comentário
 */
async function addComment(cardId, text) {
    try {
        await trelloFetch(`/cards/${cardId}/actions/comments`, "POST", { text });
        console.log(`   💬 Comentário adicionado ao cartão ${cardId}`);
    } catch (error) {
        console.error(`   ⚠️ Erro no comentário: ${error.message}`);
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
        const cards = await trelloFetch(`/boards/${config.boardId}/cards?fields=name,desc,shortUrl`);

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

        // 1. Etiqueta
        try {
            await addGreenLabel(card.id);
        } catch (e) {
            console.error(`   ❌ Falha na etiqueta: ${e.message}`);
        }

        // 2. Comentário
        try {
            const time = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
            const note = `✅ **CONFIRMADO AUTOMATICAMENTE**\n📱 Mensagem detectada via WhatsApp\n💬 Texto: "${message.substring(0, 100)}..."\n🕐 ${time}`;
            await addComment(card.id, note);
            confirmed.push({ id: card.id, name: card.name });
        } catch (e) {
            console.error(`   ❌ Falha no comentário: ${e.message}`);
        }
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
