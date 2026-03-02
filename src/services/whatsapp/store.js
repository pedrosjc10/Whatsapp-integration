/**
 * WhatsApp Store - Gerencia o estado das sessões e filtros
 */
const fs = require("fs");
const path = require("path");

const instances = new Map();

const startupTimestamp = Math.floor(Date.now() / 1000);

/**
 * Salva a configuração do Trello no disco para uma sessão específica
 */
function saveTrelloConfig(sessionId, config) {
    const sessionsPath = path.join(__dirname, "..", "..", "..", "sessions");
    const sessionDir = path.join(sessionsPath, sessionId);
    const configPath = path.join(sessionDir, "trello.json");

    if (!fs.existsSync(sessionDir)) {
        fs.mkdirSync(sessionDir, { recursive: true });
    }

    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    if (instances.has(sessionId)) {
        instances.get(sessionId).trelloConfig = config;
    }
    return config;
}

/**
 * Lê a configuração do Trello do disco para uma sessão
 */
function loadTrelloConfig(sessionId) {
    const configPath = path.join(__dirname, "..", "..", "..", "sessions", sessionId, "trello.json");
    if (fs.existsSync(configPath)) {
        try {
            return JSON.parse(fs.readFileSync(configPath, 'utf8'));
        } catch (e) {
            console.error(`Erro ao ler trello.json de ${sessionId}:`, e.message);
        }
    }
    return null;
}

module.exports = {
    instances,
    startupTimestamp,
    saveTrelloConfig,
    loadTrelloConfig
};
