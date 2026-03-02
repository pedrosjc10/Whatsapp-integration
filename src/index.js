require("dotenv").config();

const express = require("express");
const path = require("path");
const { initAllSessions } = require("./services/whatsapp");
const { initTrello } = require("./services/trelloService");

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Servir arquivos estáticos (dashboard)
app.use(express.static(path.join(__dirname, "public")));

// Rotas da API
app.use("/api/status", require("./routes/status"));
app.use("/api/messages", require("./routes/messages"));
app.use("/api/trello", require("./routes/trello"));

// Rota raiz - serve o dashboard
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Iniciar servidor
app.listen(PORT, async () => {
    console.log(`
╔══════════════════════════════════════════════════════╗
║       🟢 WhatsApp + Trello Integration API           ║
║                                                      ║
║  Dashboard:  http://localhost:${PORT}                  ║
║  API:        http://localhost:${PORT}/api               ║
║                                                      ║
║  WhatsApp Endpoints:                                 ║
║    GET  /api/status            - Status conexão       ║
║    GET  /api/status/qr         - QR Code              ║
║    GET  /api/status/chats      - Listar chats          ║
║    POST /api/messages/send     - Enviar mensagem      ║
║    POST /api/messages/send-bulk - Envio em lote       ║
║    GET  /api/messages/sent     - Msgs enviadas        ║
║    GET  /api/messages/received - Msgs recebidas       ║
║                                                      ║
║  Trello Endpoints:                                   ║
║    GET  /api/trello/status     - Status Trello        ║
║    GET  /api/trello/lists      - Listas do board      ║
║    POST /api/trello/search     - Buscar cartões       ║
║    GET  /api/trello/actions    - Histórico ações      ║
╚══════════════════════════════════════════════════════╝
  `);

    // Iniciar integração Trello
    await initTrello();

    // Iniciar conexão com WhatsApp
    console.log("🔄 Iniciando sessões do WhatsApp...\n");
    await initAllSessions();
});
