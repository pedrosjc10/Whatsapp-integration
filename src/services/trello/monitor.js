const trello = require("../trello/automation");
// whatsapp será carregado dinamicamente para evitar dependência circular

/**
 * Inicia o monitoramento de novos cartões para todas as sessões ativas
 */
function startTrelloMonitor() {
    console.log("👁️ Iniciando monitoramento de novos cartões no Trello...");

    // Mapa para evitar alertas duplicados caso contas diferentes monitorem o mesmo board
    const recentlyNotifiedCards = new Set();

    setInterval(async () => {
        const User = require("../../models/User");
        const whatsapp = require("../whatsapp");

        try {
            // Busca todos os usuários que têm o Trello configurado no banco
            const users = await User.find({
                "trelloConfig.boardId": { $exists: true, $ne: null },
                "trelloConfig.apiKey": { $exists: true, $ne: null }
            });

            if (users.length === 0) return;

            for (const user of users) {
                const sessionId = user.sessionId;
                const config = user.trelloConfig;
                const lastId = user.lastTrelloCardId;

                try {
                    console.log(`🔍 [Monitor] Verificando board ${config.boardId} para ${user.email}...`);

                    const newLastId = await trello.checkNewCardsAndNotify(
                        config,
                        lastId,
                        async (card) => {
                            // Se este card já foi notificado hoje (por esse ou outro número), ignoramos
                            if (recentlyNotifiedCards.has(card.id)) {
                                return;
                            }
                            // Agora registramos para que os próximos números ignorem esse arquivo
                            recentlyNotifiedCards.add(card.id);

                            // Mantém no máximo 500 cartões no histórico para economizar memória e evitar que crashe
                            if (recentlyNotifiedCards.size > 500) {
                                const iter = recentlyNotifiedCards.values();
                                recentlyNotifiedCards.delete(iter.next().value);
                            }

                            const listName = card.listName;
                            // Encontra um número de 10 a 15 dígitos diretamente no texto original da lista
                            const match = listName.match(/\d{10,15}/);

                            if (match) {
                                const targetNumber = match[0];

                                // Verifica conexão apenas no momento do envio
                                const status = whatsapp.getStatus(sessionId);
                                if (!status || status.status !== "connected") {
                                    console.log(`⚠️ [${sessionId}] Card detectado para ${user.email}, mas WhatsApp desconectado. Notificação ignorada.`);
                                    return;
                                }

                                const message = `🔔 *Novo Pedido/Card Criado!*\n\n*Card:* ${card.name}\n*Lista:* ${listName}\n*Link:* ${card.shortUrl}`;
                                console.log(`📩 [${sessionId}] Enviando notificação para ${targetNumber} sobre o card ${card.name}`);

                                try {
                                    await whatsapp.sendTextMessage(sessionId, targetNumber, message);
                                    console.log(`✅ [${sessionId}] Notificação enviada!`);
                                } catch (err) {
                                    console.error(`❌ [${sessionId}] Erro ao enviar: ${err.message}`);
                                }
                            } else {
                                console.log(`ℹ️ [${sessionId}] Card "${card.name}" ignorado (sem número na lista).`);
                            }
                        }
                    );

                    // Atualiza o ID no banco para não repetir na próxima rodada ou em reboots
                    if (newLastId && newLastId !== lastId) {
                        user.lastTrelloCardId = newLastId;
                        await user.save();

                        if (!lastId) {
                            console.log(`📌 [${sessionId}] Monitor Trello vinculado ao Board ${config.boardId} (${user.email}).`);
                        }
                    }
                } catch (err) {
                    console.error(`❌ Erro no board do usuário ${user.email}:`, err.message);
                }
            }
        } catch (err) {
            console.error(`❌ Erro fatal no Monitor Trello:`, err.message);
        }
    }, 15000);
}

module.exports = {
    startTrelloMonitor
};
