require("dotenv").config();

const express = require("express");
const path = require("path");
const mongoose = require("mongoose");
const cookieParser = require("cookie-parser");
const { initAllSessions } = require("./services/whatsapp");
const { protect } = require("./middlewares/authMiddleware");
// O Trello agora é dinâmico, não precisa de inicialização global fixa.

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// 1. Primeiro as rotas públicas
app.get("/login", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "login.html"));
});
app.use("/api/auth", require("./routes/auth"));

// 2. Proteger o resto dos arquivos estáticos (CSS, JS)
app.use(express.static(path.join(__dirname, "public"), { index: false }));

// 3. Rotas Protegidas
app.use("/api/status", protect, require("./routes/status"));
app.use("/api/messages", protect, require("./routes/messages"));
app.use("/api/trello", protect, require("./routes/trello"));

// Rota raiz - agora protegida com unhas e dentes
app.get("/", protect, (req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Iniciar servidor
async function startServer() {
    // Conectar ao MongoDB primeiro
    const MONGO_URI = process.env.MONGODB_URI;
    if (!MONGO_URI) {
        console.error("❌ ERRO: MONGODB_URI não configurado no .env");
        process.exit(1);
    }

    try {
        await mongoose.connect(MONGO_URI);
        console.log("🍃 Conectado ao MongoDB Atlas!");
    } catch (err) {
        console.error("❌ Erro ao conectar ao MongoDB:", err.message);
        process.exit(1);
    }

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

        // Iniciar conexão com WhatsApp
        console.log("🔄 Iniciando sessões do WhatsApp...\n");
        await initAllSessions();

        // --- SISTEMA KEEP-ALIVE PARA O RENDER ---
        const RENDER_URL = process.env.RENDER_EXTERNAL_URL || "https://whatsapp-integration-a7t1.onrender.com";
        if (RENDER_URL) {
            console.log(`⏰ Sistema Keep-Alive ativado para: ${RENDER_URL}`);
            // Pinga a cada 10 minutos (600.000 ms)
            setInterval(async () => {
                try {
                    const response = await fetch(RENDER_URL);
                    console.log(`🛰️ Keep-Alive Ping: status ${response.status}`);
                } catch (err) {
                    console.error("❌ Erro no Ping Keep-Alive:", err.message);
                }
            }, 600000);
        }
    });
}

startServer();
