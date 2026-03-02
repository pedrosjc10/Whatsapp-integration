const jwt = require("jsonwebtoken");
const User = require("../models/User");

const JWT_SECRET = process.env.JWT_SECRET || "minha_senha_super_secreta_123";

/**
 * Middleware para proteger rotas
 */
async function protect(req, res, next) {
    let token;

    // 1. Verificar se o token existe nos cookies
    if (req.cookies && req.cookies.token) {
        token = req.cookies.token;
    }

    if (!token) {
        // Se for uma requisição de página (não API), redirecionar
        if (req.headers.accept && req.headers.accept.includes("text/html")) {
            return res.redirect("/login");
        }
        return res.status(401).json({ success: false, error: "Acesso negado. Faça login." });
    }

    try {
        // 2. Validar o token
        const decoded = jwt.verify(token, JWT_SECRET);

        // 3. Buscar o usuário no banco
        const user = await User.findById(decoded.id);
        if (!user) throw new Error("Usuário não encontrado");

        // 4. Injetar o usuário na requisição para uso posterior
        req.user = user;
        next();
    } catch (error) {
        if (req.headers.accept && req.headers.accept.includes("text/html")) {
            return res.redirect("/login");
        }
        return res.status(401).json({ success: false, error: "Sessão inválida" });
    }
}

module.exports = { protect };
