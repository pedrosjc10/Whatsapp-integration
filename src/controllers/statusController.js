const whatsapp = require("../services/whatsapp");

exports.getAllStatus = (req, res) => {
    res.json({
        success: true,
        data: whatsapp.getAllStatus(),
    });
};

exports.getStatus = (req, res) => {
    const id = req.query.sessionId || "default";
    const status = whatsapp.getStatus(id);
    if (!status) {
        console.log(`⚠️ Sessão [${id}] não encontrada. Ativas:`, whatsapp.getAllStatus().map(s => s.id));
        return res.status(404).json({ success: false, error: "Sessão não encontrada" });
    }

    res.json({
        success: true,
        data: status,
    });
};

exports.getQR = async (req, res) => {
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
};

exports.createSession = async (req, res) => {
    try {
        const { sessionId } = req.body;
        if (!sessionId) return res.status(400).json({ success: false, error: "sessionId é obrigatório" });

        const fs = require("fs");
        const path = require("path");
        const authPath = path.join(__dirname, "..", "..", "sessions", sessionId);

        // Se a sessão NÃO está ativa, estamos tentando criar/reiniciar, limpamos a pasta antiga apenas se não houver um processo já em andamento
        const status = whatsapp.getStatus(sessionId);
        const isInProgress = status && (status.status === 'connecting' || status.status === 'awaiting_qr' || status.status === 'connected');

        if (!isInProgress) {
            if (fs.existsSync(authPath)) {
                console.log(`🧹 Limpando pasta de sessão antiga para forçar novo QR: ${sessionId}`);
                fs.rmSync(authPath, { recursive: true, force: true });
            }
        } else {
            console.log(`ℹ️ [${sessionId}] Reutilizando conexão existente (Status: ${status.status}).`);
        }

        await whatsapp.startWhatsApp(sessionId);
        res.json({ success: true, message: `Sessão ${sessionId} iniciada` });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

exports.getFilters = (req, res) => {
    res.json({
        success: true,
        data: whatsapp.getFilters(),
    });
};

exports.setFilters = (req, res) => {
    const { keywords, mediaTypes } = req.body;
    const newFilters = whatsapp.setFilters(keywords, mediaTypes);
    res.json({
        success: true,
        data: newFilters,
    });
};

exports.logout = async (req, res) => {
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
};
