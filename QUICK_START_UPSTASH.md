# 🚀 Quick Start - Upstash Redis

Guia rápido para configurar Upstash Redis em **2 minutos**.

## Passo 1: Obter URL do Upstash (30 segundos)

1. Acesse: https://console.upstash.com
2. Faça login
3. Clique no seu database Redis (ou crie um novo)
4. Copie a **Redis URL** (exemplo: `rediss://default:xxx@xxx.upstash.io:6379`)

## Passo 2: Configurar no projeto (30 segundos)

1. Abra o arquivo `.env` no backend
2. Adicione a linha:
   ```env
   UPSTASH_REDIS_URL=rediss://default:SUA-SENHA@SEU-ENDPOINT.upstash.io:6379
   ```
3. **Substitua pela URL real que você copiou!**

## Passo 3: Testar (30 segundos)

```bash
cd c:/Projects/sellaro_backend
node test-redis.js
```

✅ **Sucesso?** Você deve ver:
```
🔍 Testing Upstash Redis connection...
📍 Upstash Host: xxx.upstash.io:6379
🔐 Protocol: rediss: (TLS enabled)
✅ Connected to Redis
✅ Redis is ready
📊 Test Results:
  PING: PONG
  SET: OK
  GET: Hello Redis
  DEL: 1 key(s) deleted
✅ All tests passed! Redis is working correctly.
```

❌ **Erro?** Veja troubleshooting abaixo.

## Passo 4: Iniciar servidor (30 segundos)

```bash
npm start
```

✅ **Sucesso?** Você deve ver:
```
✅ Redis connected successfully
✅ Redis is ready to accept commands
🚀 Message worker started and listening for jobs...
🚀 Server running on http://0.0.0.0:3001
```

## 🎉 Pronto!

Agora você pode:
- ✅ Enviar mensagens pelo Playground
- ✅ Mensagens são processadas em fila (Bull)
- ✅ OpenAI responde de forma assíncrona
- ✅ Monitorar no dashboard do Upstash

---

## 🔧 Troubleshooting Rápido

### Erro: "unable to connect"
```bash
# Verifique se a URL está correta
node -e "console.log(process.env.UPSTASH_REDIS_URL)"
```
- ✅ Deve mostrar sua URL completa
- ❌ Se mostrar `undefined`, adicione no `.env`

### Erro: "WRONGPASS"
- Copie a URL novamente do Upstash (pode ter mudado)
- Cole no `.env` substituindo a antiga
- Reinicie o servidor

### Erro: Ainda não funciona
1. Verifique se o database está ativo no dashboard Upstash
2. Teste com: `node test-redis.js`
3. Veja os logs completos
4. Consulte `UPSTASH_SETUP.md` para guia detalhado

---

## 📊 Monitorar no Upstash

1. Acesse: https://console.upstash.com
2. Clique no seu database
3. Vá em **Data Browser**
4. Você verá as chaves do Bull:
   - `bull:message-processing:*`
   - Chaves de jobs, completed, failed, etc.

---

## 📁 Arquivos de Referência

- **Guia Completo**: `UPSTASH_SETUP.md`
- **Configuração Redis**: `src/config/redis.ts`
- **Fila Bull**: `src/queues/messageQueue.ts`
- **Exemplo .env**: `.env.upstash.example`
- **Teste**: `test-redis.js`

---

## 🆘 Precisa de Ajuda?

- 📖 Documentação Upstash: https://docs.upstash.com/redis
- 💬 Dashboard: https://console.upstash.com
- 🐛 Status: https://status.upstash.com

---

**Tempo total**: ~2 minutos ⏱️
