# Redis Setup Guide

Este projeto usa Redis com Bull para processar filas de mensagens assíncronas.

## Por que Redis é necessário?

O Redis é usado para:
- **Bull Queue**: Gerenciar filas de processamento de mensagens
- **Processamento assíncrono**: Enviar mensagens para OpenAI sem bloquear a API
- **Escalabilidade**: Permitir múltiplos workers processando mensagens simultaneamente

## Como instalar Redis

### Opção 1: Docker (Recomendado)

```bash
# Baixar e rodar Redis em container
docker run -d -p 6379:6379 --name redis redis:alpine

# Verificar se está rodando
docker ps

# Parar o Redis
docker stop redis

# Iniciar o Redis novamente
docker start redis

# Ver logs
docker logs redis
```

### Opção 2: WSL (Windows Subsystem for Linux)

```bash
# Abrir WSL
wsl

# Instalar Redis
sudo apt update
sudo apt install redis-server

# Iniciar Redis
redis-server

# Em outro terminal WSL, testar conexão
redis-cli ping
# Deve retornar: PONG
```

### Opção 3: Memurai (Redis para Windows nativo)

1. Baixe o Memurai Developer Edition (gratuito): https://www.memurai.com/get-memurai
2. Instale o executável
3. O Memurai será instalado como serviço do Windows
4. Acesse via `localhost:6379`

### Opção 4: Redis Stack (Oficial para Windows)

1. Baixe: https://redis.io/docs/install/install-stack/windows/
2. Instale usando o instalador MSI
3. Redis Stack inclui Redis + módulos extras

## Verificar se Redis está rodando

### Via Bash/WSL:
```bash
redis-cli ping
# Deve retornar: PONG
```

### Via Node.js (testar conexão):
```bash
cd c:/Projects/sellaro_backend
node -e "const Redis = require('ioredis'); const redis = new Redis(); redis.ping().then(console.log).catch(console.error).finally(() => redis.quit())"
```

## Configuração do Projeto

### Variáveis de Ambiente (.env)

```env
# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
```

Se você estiver usando Redis em produção ou com senha:
```env
REDIS_HOST=seu-redis-host.com
REDIS_PORT=6379
REDIS_PASSWORD=sua-senha-secreta
```

## Testando o Sistema de Filas

Após o Redis estar rodando:

1. **Iniciar o backend:**
   ```bash
   cd c:/Projects/sellaro_backend
   npm start
   ```

2. **Verificar logs:**
   - Você deve ver: `✅ Redis connected successfully`
   - E também: `🚀 Message worker started and listening for jobs...`

3. **Enviar mensagem pelo Playground:**
   - Abra o frontend e envie uma mensagem
   - No backend você verá:
     - `🔄 Processing job XXX for conversation YYY`
     - `✅ Job XXX completed for conversation YYY`

## Troubleshooting

### Erro: "ECONNREFUSED"
- **Problema**: Redis não está rodando
- **Solução**: Inicie o Redis usando uma das opções acima

### Erro: "MaxRetriesPerRequestError"
- **Problema**: Redis está configurado mas inacessível
- **Solução**:
  - Verifique se o Redis está rodando: `redis-cli ping`
  - Verifique a porta: `netstat -ano | findstr :6379`
  - Verifique as credenciais no `.env`

### Erro: "WRONGPASS"
- **Problema**: Senha do Redis incorreta
- **Solução**: Atualize `REDIS_PASSWORD` no `.env`

### Redis está rodando mas Bull não funciona
- **Solução**: Reinicie o backend após iniciar o Redis
- O worker precisa conectar ao Redis no startup

## Monitoramento

### Bull Board (Dashboard visual - Opcional)

Você pode adicionar o Bull Board para monitorar as filas visualmente:

```bash
npm install @bull-board/express @bull-board/api
```

Isso permite acessar uma interface web para ver jobs em processamento, completados e falhados.

## Comandos Úteis Redis

```bash
# Conectar ao Redis CLI
redis-cli

# Ver todas as chaves
KEYS *

# Ver jobs na fila Bull
KEYS bull:message-processing:*

# Limpar todas as chaves (CUIDADO!)
FLUSHALL

# Ver informações do servidor
INFO

# Monitorar comandos em tempo real
MONITOR
```

## Produção

Para produção, considere:
- **Redis Cloud** (Upstash, Redis Labs, AWS ElastiCache)
- **Persistência**: Configure RDB ou AOF
- **Segurança**: Use senha forte e SSL/TLS
- **Monitoramento**: Configure alertas para falhas
- **Backup**: Configure backups automáticos
