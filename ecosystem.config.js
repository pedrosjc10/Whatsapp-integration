module.exports = {
    apps: [
        {
            name: "whatsapp-trello-bot",
            script: "src/index.js",
            instances: 1,
            autorestart: true,
            watch: false,
            max_memory_restart: "1G",
            env: {
                NODE_ENV: "production",
            },
            // Isso garante que se o servidor reiniciar sozinho, o bot volta
            exp_backoff_restart_delay: 100,
        },
    ],
};
