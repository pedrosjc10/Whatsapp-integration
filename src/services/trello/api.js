const TRELLO_BASE_URL = "https://api.trello.com/1";

// Garantir compatibilidade com Node < 18
if (typeof fetch === "undefined") {
    var fetch = require("node-fetch");
}

/**
 * Valida se uma configuração do Trello é válida
 */
function isConfigValid(config) {
    return !!(config && config.apiKey && config.token && config.boardId);
}

/**
 * Fetch leve que só precisa de apiKey e token (não exige boardId)
 */
async function trelloFetchLight(endpoint, config, method = "GET", body = null) {
    if (!config || !config.apiKey || !config.token) throw new Error("API Key e Token do Trello são obrigatórios");

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
 * Request genérico para a API do Trello (Exige BoardId)
 */
async function trelloFetch(endpoint, config, method = "GET", body = null) {
    if (!isConfigValid(config)) throw new Error("Configuração do Trello incompleta (apiKey, token e boardId são necessários)");
    return trelloFetchLight(endpoint, config, method, body);
}

module.exports = {
    isConfigValid,
    trelloFetch,
    trelloFetchLight
};
