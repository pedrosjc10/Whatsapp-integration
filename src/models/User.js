const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema({
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true
    },
    password: {
        type: String,
        required: true,
        select: false // Não retorna a senha nas buscas por padrão
    },
    sessionId: {
        type: String,
        required: true,
        unique: true,
        default: () => `session_${Math.random().toString(36).substr(2, 9)}`
    },
    // Configurações do Trello por usuário
    trelloConfig: {
        apiKey: String,
        token: String,
        boardId: String,
        targetListId: String,
        targetListName: { type: String, default: "Concluído" }
    },
    // Filtros por usuário
    filterKeywords: {
        type: [String],
        default: []
    },
    filterMediaTypes: {
        type: [String],
        default: []
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
}, { bufferCommands: false });

// Encriptar senha antes de salvar
userSchema.pre("save", async function (next) {
    if (!this.isModified("password")) return next();
    this.password = await bcrypt.hash(this.password, 10);
});

// Método para comparar senhas
userSchema.methods.comparePassword = async function (candidatePassword) {
    return await bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.models.User || mongoose.model("User", userSchema);
