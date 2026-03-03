require("dotenv").config();

const express = require("express");
const path = require("path");
const mongoose = require("mongoose");
const cookieParser = require("cookie-parser");
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
    const MONGO_URI = process.env.MONGODB_URI;
    if (!MONGO_URI) {
        console.error("❌ ERRO: MONGODB_URI não configurado!");
        process.exit(1);
    }

    try {
        console.log("🍃 Conectando ao MongoDB Atlas...");
        // Garante que o banco se chamará 'whatsapp-saas'
        await mongoose.connect(MONGO_URI, { dbName: 'whatsapp-saas' });
        console.log("✅ MongoDB Conectado!");

        // Iniciar sessões do WhatsApp APÓS o DB estar pronto
        console.log("� Iniciando sessões do WhatsApp...");
        await initAllSessions();
    } catch (err) {
        console.error("❌ Erro Crítico na Inicialização:", err.message);
        // O Render reiniciará automaticamente se o processo for encerrado
        process.exit(1);
    }

    app.listen(PORT, "0.0.0.0", () => {
        console.log(`🚀 Servidor rodando em: http://localhost:${PORT}`);

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
