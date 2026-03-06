const mongoose = require("mongoose");

const connectDB = async () => {
    const MONGO_URI = process.env.MONGODB_URI;
    if (!MONGO_URI) {
        console.error("❌ ERRO: MONGODB_URI não configurado!");
        process.exit(1);
    }

    try {
        console.log("🍃 Conectando ao MongoDB Atlas...");
        await mongoose.connect(MONGO_URI, { dbName: 'whatsapp-saas' });
        console.log("✅ MongoDB Conectado!");
    } catch (err) {
        console.error("❌ Erro na Conexão com MongoDB:", err.message);
        process.exit(1);
    }
};

module.exports = connectDB;
