# Upstash Redis Setup Guide

Este guia mostra como configurar o Upstash Redis com o projeto Sellaro.

## O que é Upstash?

Upstash é um serviço Redis serverless que oferece:
- ✅ **Redis gerenciado** - Sem necessidade de manutenção
- ✅ **Gratuito para começar** - Free tier generoso
- ✅ **Global** - Baixa latência em qualquer lugar
- ✅ **Escalável** - Cresce automaticamente
- ✅ **TLS/SSL** - Conexões seguras por padrão

## Passo 1: Criar conta no Upstash

1. Acesse: https://upstash.com
2. Clique em "Get Started" ou "Sign Up"
3. Faça login com GitHub, Google ou email

## Passo 2: Criar database Redis

1. No dashboard do Upstash, clique em "Create Database"
2. Configure:
   - **Name**: `sellaro-redis` (ou o nome que preferir)
   - **Type**: Redis
   - **Region**: Escolha a região mais próxima (ex: `us-east-1` para EUA)
   - **Eviction**: `noeviction` (recomendado para filas)
3. Clique em "Create"

## Passo 3: Obter credenciais de conexão

Após criar o database:

1. Na página do database, você verá várias opções de conexão
2. Copie a **Redis URL** (formato: `rediss://default:password@endpoint.upstash.io:6379`)

Exemplo:
```
rediss://default:AbCdEfGhIjKlMnOpQrStUvWxYz123456@us1-caring-hippo-12345.upstash.io:6379
```

## Passo 4: Configurar no projeto

1. Abra o arquivo `.env` no backend:
   ```bash
   cd c:/Projects/sellaro_backend
   code .env  # ou use seu editor preferido
   ```

2. Adicione a variável de ambiente com a URL do Upstash:
   ```env
   UPSTASH_REDIS_URL=rediss://default:SUA-SENHA@SEU-ENDPOINT.upstash.io:6379
   ```

3. **IMPORTANTE**: Substitua pela URL real que você copiou do Upstash!

## Passo 5: Testar conexão

```bash
cd c:/Projects/sellaro_backend
npm run build
node test-redis.js
```

Você deve ver:
```
🔍 Testing Redis connection...
📍 Host: seu-endpoint.upstash.io:6379
✅ Connected to Redis
✅ Redis is ready
📊 Test Results:
  PING: PONG
  SET: OK
  GET: Hello Redis
  DEL: 1 key(s) deleted
✅ All tests passed! Redis is working correctly.
```

## Passo 6: Iniciar o servidor

```bash
npm start
```

Logs esperados:
```
✅ Redis connected successfully
✅ Redis is ready to accept commands
🚀 Message worker started and listening for jobs...
🚀 Server running on http://0.0.0.0:3001
```

## Verificar no Dashboard Upstash

Após enviar algumas mensagens pelo Playground:

1. Acesse o dashboard do Upstash
2. Clique no seu database
3. Vá para a aba "Data Browser"
4. Você verá as chaves criadas pelo Bull:
   - `bull:message-processing:id`
   - `bull:message-processing:wait`
   - `bull:message-processing:active`
   - `bull:message-processing:completed`

## Monitoramento

### Via Dashboard Upstash

- **Commands**: Veja comandos Redis em tempo real
- **Metrics**: CPU, memória, operações por segundo
- **Data Browser**: Explore as chaves armazenadas

### Via Código

O projeto já tem logs integrados:
- `✅ Job XXX completed` - Job processado com sucesso
- `❌ Job XXX failed` - Job falhou
- `🔄 Processing job XXX` - Job sendo processado

## Limites do Free Tier

O Upstash oferece generosamente no plano gratuito:
- **10,000 comandos/dia**
- **256 MB de storage**
- **TLS/SSL incluído**

Para a maioria dos projetos em desenvolvimento, isso é mais que suficiente!

## Troubleshooting

### Erro: "unable to connect to Redis"

**Solução 1**: Verifique se a URL está correta
```bash
echo $UPSTASH_REDIS_URL
# Ou no Windows
echo %UPSTASH_REDIS_URL%
```

**Solução 2**: Certifique-se de usar `rediss://` (com dois S) para TLS

**Solução 3**: Verifique se a senha está correta (sem espaços extras)

### Erro: "WRONGPASS invalid password"

- Copie novamente a URL do Upstash
- Certifique-se de não ter caracteres extras
- A senha vem depois de `default:` na URL

### Erro: "Connection timeout"

- Verifique sua conexão de internet
- Tente usar outra região no Upstash
- Verifique se não há firewall bloqueando

### Erro: "MaxRetriesPerRequestError"

- Reinicie o servidor backend
- Verifique se o database Upstash está ativo no dashboard

## Comparação: Local vs Upstash

| Aspecto | Redis Local | Upstash |
|---------|-------------|---------|
| Setup | Manual | 2 minutos |
| Manutenção | Você gerencia | Gerenciado |
| Custo | Grátis | Free tier generoso |
| Escalabilidade | Manual | Automática |
| Backup | Configure você | Automático |
| TLS/SSL | Configure você | Incluído |
| Global | Não | Sim |
| Ideal para | Desenvolvimento | Dev + Produção |

## Migração de Local para Upstash

Se você estava usando Redis local:

1. Pare o servidor backend
2. Atualize o `.env` com `UPSTASH_REDIS_URL`
3. Comente ou remova as variáveis antigas:
   ```env
   # REDIS_HOST=localhost
   # REDIS_PORT=6379
   # REDIS_PASSWORD=
   ```
4. Reinicie o servidor
5. ✅ Pronto! O código detecta automaticamente o Upstash

## Produção

Para produção, considere:

1. **Upstash Pro**: Mais comandos e storage
2. **Multiple databases**: Separar dev/staging/prod
3. **Backup**: Configure snapshots automáticos
4. **Monitoring**: Ative alertas no Upstash
5. **Regions**: Use múltiplas regiões para redundância

## Links Úteis

- Dashboard: https://console.upstash.com
- Documentação: https://docs.upstash.com/redis
- Pricing: https://upstash.com/pricing
- Status: https://status.upstash.com
- Suporte: support@upstash.com

## Suporte

Se tiver problemas:
1. Verifique o dashboard do Upstash
2. Veja os logs do servidor backend
3. Execute `node test-redis.js`
4. Consulte a documentação: https://docs.upstash.com
