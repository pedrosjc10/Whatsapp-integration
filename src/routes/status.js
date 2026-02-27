const express = require("express");
const router = express.Router();
const whatsapp = require("../whatsapp");

/**
 * GET /api/status
 * Retorna o status da conexão com o WhatsApp
 */
router.get("/", (req, res) => {
    res.json({
        success: true,
        data: whatsapp.getStatus(),
    });
});

/**
 * GET /api/status/qr
 * Retorna o QR Code como Data URL (base64) para exibir no frontend
 */
router.get("/qr", async (req, res) => {
    try {
        const status = whatsapp.getStatus();

        if (status.status === "connected") {
            return res.json({
                success: true,
                data: { connected: true, qrCode: null },
            });
        }

        const qrDataURL = await whatsapp.getQRCodeDataURL();

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
 * GET /api/status/chats
 * Listar conversas/chats
 */
router.get("/chats", async (req, res) => {
    try {
        const chats = await whatsapp.getChats();

        res.json({
            success: true,
            total: chats.length,
            data: chats,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message,
        });
    }
});

/**
 * POST /api/status/logout
 * Desconectar do WhatsApp
 */
router.post("/logout", async (req, res) => {
    try {
        await whatsapp.logout();

        res.json({
            success: true,
            message: "Desconectado com sucesso",
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message,
        });
    }
});

module.exports = router;
