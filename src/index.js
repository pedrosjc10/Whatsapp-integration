require("dotenv").config();

const express = require("express");
const path = require("path");
const cookieParser = require("cookie-parser");
const connectDB = require("./config/db");
const { initAllSessions } = require("./services/whatsapp");
const { protect } = require("./middlewares/authMiddleware");

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// 1. Rotas públicas
app.get("/login", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "login.html"));
});
app.use("/api/auth", require("./routes/auth"));

// 2. Proteção de arquivos estáticos
app.use(express.static(path.join(__dirname, "public"), { index: false }));

// 3. Rotas protegidas
app.use("/api/status", protect, require("./routes/status"));
app.use("/api/messages", protect, require("./routes/messages"));
app.use("/api/trello", protect, require("./routes/trello"));

app.get("/", protect, (req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Iniciar servidor
async function startServer() {
    // 1. Conectar ao Banco
    await connectDB();

    // 2. Iniciar sessões do WhatsApp
    console.log(" Iniciando sessões do WhatsApp...");
    await initAllSessions();

    // 3. Iniciar monitoramento do Trello (Notificações de novos cards)
    const trello = require("./services/trello");
    trello.startTrelloMonitor();

    // 4. Rodar Escuta
    app.listen(PORT, "0.0.0.0", () => {
        console.log(`🚀 Servidor rodando em: http://localhost:${PORT}`);
        console.log("🛑 Robô Fantasma DESATIVADO.");

        // Keep-Alive para Render
        const RENDER_URL = process.env.RENDER_EXTERNAL_URL;
        if (RENDER_URL) {
            console.log(`🛰️ Keep-Alive ativo para: ${RENDER_URL}`);
            setInterval(() => {
                fetch(RENDER_URL).catch(() => { });
            }, 600000);
        }
    });
}

startServer();
