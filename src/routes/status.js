const express = require("express");
const router = express.Router();
const whatsapp = require("../whatsapp");

/**
 * GET /api/status/all
 * Lista todas as instâncias e seus status
 */
router.get("/all", (req, res) => {
    res.json({
        success: true,
        data: whatsapp.getAllStatus(),
    });
});

/**
 * GET /api/status
 * Retorna o status de uma instância específica
 */
router.get("/", (req, res) => {
    const sessionId = req.query.sessionId || "default";
    const status = whatsapp.getStatus(sessionId);
    if (!status) return res.status(404).json({ success: false, error: "Sessão não encontrada" });

    res.json({
        success: true,
        data: status,
    });
});

/**
 * GET /api/status/qr
 * Retorna o QR Code de uma sessão específica
 */
router.get("/qr", async (req, res) => {
    try {
        const sessionId = req.query.sessionId || "default";
        const status = whatsapp.getStatus(sessionId);

        if (!status) return res.status(404).json({ success: false, error: "Sessão não encontrada" });

        if (status.status === "connected") {
            return res.json({
                success: true,
                data: { connected: true, qrCode: null },
            });
        }

        const qrDataURL = await whatsapp.getQRCodeDataURL(sessionId);

        res.json({
            success: true,
            data: {
                connected: false,
                qrCode: qrDataURL,
            },
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message,
        });
    }
});

/**
 * POST /api/status/create
 * Cria uma nova sessão
 */
router.post("/create", async (req, res) => {
    try {
        const { sessionId } = req.body;
        if (!sessionId) return res.status(400).json({ success: false, error: "sessionId é obrigatório" });

        await whatsapp.startWhatsApp(sessionId);
        res.json({ success: true, message: `Sessão ${sessionId} iniciada` });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * GET /api/status/filters
 */
router.get("/filters", (req, res) => {
    res.json({
        success: true,
        data: whatsapp.getFilters(),
    });
});

/**
 * POST /api/status/filters
 */
router.post("/filters", (req, res) => {
    const { keywords, mediaTypes } = req.body;
    const newFilters = whatsapp.setFilters(keywords, mediaTypes);
    res.json({
        success: true,
        data: newFilters,
    });
});

/**
 * POST /api/status/logout
 */
router.post("/logout", async (req, res) => {
    try {
        const sessionId = req.body.sessionId || "default";
        await whatsapp.logout(sessionId);
        res.json({
            success: true,
            message: "Sessão desconectada com sucesso",
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message,
        });
    }
});

module.exports = router;
