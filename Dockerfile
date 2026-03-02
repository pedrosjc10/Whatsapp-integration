# 1. Imagem base (Usando a versão LTS do Node)
FROM node:20-slim

# 2. Instalação básica de dependências do sistema
# Libs extras para o Baileys/Chrome se precisar
RUN apt-get update && apt-get install -y \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# 3. Criar diretório do app
WORKDIR /usr/src/app

# 4. Copiar só o package.json antes para ganhar velocidade no cache do Docker
COPY package*.json ./

# 5. Instalar dependências (Só as de produção)
RUN npm install --omit=dev

# 6. Copiar o código do projeto
COPY . .

# 7. Criar a pasta de sessões e dar permissão
RUN mkdir -p sessions && chmod 777 sessions

# 8. Porta do Dashboard
EXPOSE 3000

# 9. Comando para rodar
CMD ["npm", "start"]
