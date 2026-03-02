const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const User = require("../models/User");

const JWT_SECRET = process.env.JWT_SECRET || "minha_senha_super_secreta_123";

/**
 * POST /api/auth/register
 */
router.post("/register", async (req, res) => {
    try {
        const { email, password, trelloBoardId } = req.body;

        const userExists = await User.findOne({ email });
        if (userExists) return res.status(400).json({ success: false, error: "E-mail já cadastrado" });

        const user = await User.create({
            email,
            password,
            trelloConfig: {
                apiKey: process.env.TRELLO_API_KEY,
                token: process.env.TRELLO_TOKEN,
                boardId: trelloBoardId
            }
        });

        res.status(201).json({
            success: true,
            message: "Conta criada com sucesso! Faça login para continuar."
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * POST /api/auth/login
 */
router.post("/login", async (req, res) => {
    try {
        const { email, password } = req.body;

        // Busca usuário e inclui a senha para comparação
        const user = await User.findOne({ email }).select("+password");
        if (!user) return res.status(401).json({ success: false, error: "E-mail ou senha inválidos" });

        const isMatch = await user.comparePassword(password);
        if (!isMatch) return res.status(401).json({ success: false, error: "E-mail ou senha inválidos" });

        // Gerar Token JWT
        const token = jwt.sign({ id: user._id, sessionId: user.sessionId }, JWT_SECRET, {
            expiresIn: "7d"
        });

        // Enviar via Cookie seguro
        res.cookie("token", token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            maxAge: 7 * 24 * 60 * 60 * 1000 // 7 dias
        });

        res.json({
            success: true,
            message: "Login realizado com sucesso!",
            user: { email: user.email, sessionId: user.sessionId }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * GET /api/auth/me
 */
router.get("/me", async (req, res) => {
    try {
        const token = req.cookies.token;
        if (!token) return res.status(401).json({ success: false });

        const decoded = jwt.verify(token, JWT_SECRET);
        const user = await User.findById(decoded.id);

        if (!user) return res.status(401).json({ success: false });

        res.json({
            success: true,
            user: {
                email: user.email,
                sessionId: user.sessionId,
                trelloConfig: user.trelloConfig
            }
        });
    } catch (error) {
        res.status(401).json({ success: false });
    }
});

/**
 * POST /api/auth/filters
 * Atualiza os filtros do usuário em tempo real
 */
router.post("/filters", async (req, res) => {
    try {
        const { keywords, mediaTypes, sessionId } = req.body;
        const { instances } = require("../services/whatsapp/store");

        const filterKeywords = keywords ? keywords.split(",").map(k => k.trim()) : [];
        const filterMediaTypes = mediaTypes ? mediaTypes.split(",").map(t => t.trim()) : [];

        // Atualizar no Banco de Dados
        const user = await User.findOneAndUpdate(
            { sessionId },
            { filterKeywords, filterMediaTypes },
            { new: true }
        );

        if (!user) return res.status(404).json({ success: false, error: "Usuário não encontrado" });

        // Atualizar na Instância em memória (se existir)
        const instance = instances.get(sessionId);
        if (instance) {
            instance.filterKeywords = filterKeywords;
            instance.filterMediaTypes = filterMediaTypes;
        }

        res.json({ success: true, message: "Filtros atualizados com sucesso!" });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
