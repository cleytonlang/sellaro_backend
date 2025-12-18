# Solução para Erro de Thread com Run Ativo

## Problema

O erro ocorria quando múltiplas mensagens eram processadas simultaneamente pela fila para a mesma thread da OpenAI:

```
Error: 400 Can't add messages to thread_xxx while a run run_xxx is active.
```

## Causa Raiz

- Múltiplos jobs na fila tentavam processar mensagens para a mesma thread simultaneamente
- A OpenAI API não permite adicionar mensagens ou criar runs enquanto outro run está ativo
- Não havia sincronização entre os workers da fila

## Solução Implementada

### 1. Sistema de Lock por Thread (`threadLockService.ts`)

Criado um serviço de lock usando Redis que:

- **Adquire lock exclusivo** por thread antes de processar mensagens
- **Aguarda até 5 minutos** para obter o lock se estiver ocupado
- **Registra run ativo** no Redis durante o processamento
- **Estende automaticamente** o TTL do lock durante operações longas
- **Libera automaticamente** o lock ao finalizar (sucesso ou erro)

**Principais métodos:**

```typescript
// Aguarda e adquire lock (com retry automático)
waitForLock(threadId, lockId): Promise<boolean>

// Registra run ativo
setActiveRun(threadId, runId): Promise<void>

// Verifica se thread está bloqueada
isLocked(threadId): Promise<boolean>

// Libera lock
releaseLock(threadId, lockId): Promise<boolean>
```

### 2. Verificação de Runs Ativos (`openaiService.ts`)

Adicionados métodos para verificar e aguardar runs ativos:

```typescript
// Verifica se há run ativo na thread
hasActiveRun(userId, threadId): Promise<{hasActive, activeRunId}>

// Aguarda conclusão de runs ativos
waitForActiveRunsToComplete(userId, threadId, maxWait): Promise<boolean>
```

### 3. Atualização do `sendMessageAndGetResponse`

O método agora:

1. **Gera um lockId único** usando UUID
2. **Aguarda e adquire lock** para a thread
3. **Verifica runs ativos** antes de prosseguir
4. **Aguarda conclusão** se encontrar run ativo
5. **Adiciona mensagem** do usuário
6. **Cria e executa run** do assistente
7. **Registra run ativo** no Redis
8. **Monitora execução** com polling a cada 1 segundo
9. **Estende lock** a cada 10 segundos para operações longas
10. **Libera lock** sempre ao finalizar (finally block)

### 4. Tratamento de Erros no Worker (`messageWorker.ts`)

Adicionada detecção específica para erros de thread ocupada, permitindo retry automático via Bull.

## Configuração Redis

O serviço funciona com:

- **Upstash Redis** (via `UPSTASH_REDIS_URL`)
- **Redis tradicional** (via `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`)

## Parâmetros Configuráveis

```typescript
LOCK_TTL = 300 // 5 minutos
LOCK_RETRY_DELAY = 1000 // 1 segundo
MAX_LOCK_WAIT = 300000 // 5 minutos
```

## Fluxo de Processamento

### Cenário: Usuário envia 2 mensagens rápidas na mesma conversa

**Mensagem 1:**
```
1. Entra na fila Bull ✅
2. Worker pega o job ✅
3. Verifica se thread está locked → NÃO ✅
4. Adquire lock da thread 🔒
5. Cria run na OpenAI 🚀
6. Aguarda resposta (10-30s) ⏳
7. Recebe resposta ✅
8. Libera lock 🔓
9. Salva no banco ✅
```

**Mensagem 2 (enviada enquanto Mensagem 1 está processando):**
```
1. Entra na fila Bull ✅
2. Worker pega o job ✅
3. Verifica se thread está locked → SIM! ⚠️
4. Lança exceção "Thread is currently processing another message"
5. Bull coloca o job de volta na fila com backoff (2s → 4s → 8s...)
6. Após 2 segundos, worker tenta novamente
7. Verifica se thread está locked → NÃO (Mensagem 1 terminou) ✅
8. Adquire lock e processa normalmente 🔒
```

**Fluxo simplificado:**
```
Job 1 (Thread A) → Verifica Lock → Adquire Lock → Processa → Libera Lock
Job 2 (Thread A) → Verifica Lock → OCUPADO! → Retry (2s) → Verifica → Adquire → Processa
Job 3 (Thread B) → Verifica Lock → Adquire Lock → Processa (paralelo)
```

## Benefícios

✅ **Elimina erro "Can't add messages while run is active"**
✅ **Workers não ficam bloqueados** - verificam e fazem retry se thread ocupada
✅ **Sincronização automática** entre workers usando Redis locks
✅ **Processamento paralelo** para threads diferentes
✅ **Retry inteligente** com backoff exponencial (2s → 4s → 8s → 16s → 32s)
✅ **Lock com timeout** para evitar deadlocks (5 minutos)
✅ **Extensão automática** de lock para operações longas
✅ **Cleanup automático** em caso de erro
✅ **Ordem garantida** - mensagens processadas na ordem FIFO por thread
✅ **Escalabilidade** - múltiplos workers podem processar threads diferentes simultaneamente

## Logs

O sistema fornece logs detalhados:

- 🔐 Tentativa de adquirir lock
- 🔒 Lock adquirido
- 🔓 Lock liberado
- ⏸️ Thread ocupada, job vai fazer retry
- ⏳ Aguardando run ativo
- 🚀 Run iniciado
- ✅ Run concluído
- ⚠️ Avisos e erros
- 🔄 Tentativas de retry do Bull

## Dependências Adicionadas

```json
{
  "dependencies": {
    "ioredis": "^5.8.2",
    "uuid": "^13.0.0"
  },
  "devDependencies": {
    "@types/uuid": "^11.0.3"
  }
}
```

## O que acontece se o usuário enviar mensagens rapidamente?

### Comportamento do Sistema:

Quando o usuário envia múltiplas mensagens antes da primeira ser respondida:

1. **Todas as mensagens entram na fila** imediatamente ✅
2. **Primeira mensagem** é processada normalmente
3. **Mensagens seguintes** fazem verificação rápida:
   - Detectam que thread está ocupada
   - Lançam exceção imediatamente (não ficam travadas)
   - Retornam para a fila com backoff
4. **Retry automático** após 2 segundos
5. **Processamento sequencial** garantido na ordem FIFO

### Vantagens desta abordagem:

- ❌ **SEM bloqueio de workers** - workers ficam livres para processar outras threads
- ✅ **Retry inteligente** - backoff exponencial evita sobrecarga
- ✅ **Ordem preservada** - mensagens processadas na ordem correta
- ✅ **Sem perda de mensagens** - Bull queue garante persistência
- ✅ **Visibilidade** - jobs aparecem como "waiting" ou "delayed" na fila

### Timeline de exemplo:

```
T=0s:   Usuário envia Mensagem 1
T=0.1s: Worker pega Msg1, adquire lock, inicia run
T=2s:   Usuário envia Mensagem 2
T=2.1s: Worker pega Msg2, vê lock, faz retry (delay 2s)
T=5s:   Usuário envia Mensagem 3
T=5.1s: Worker pega Msg3, vê lock, faz retry (delay 2s)
T=10s:  Msg1 completa, libera lock
T=4.1s: Msg2 retry, adquire lock, processa
T=25s:  Msg2 completa, libera lock
T=7.1s: Msg3 retry, adquire lock, processa
T=40s:  Msg3 completa
```

## Arquivos Modificados

1. ✅ `src/services/threadLockService.ts` (novo)
2. ✅ `src/services/openaiService.ts` (atualizado)
3. ✅ `src/workers/messageWorker.ts` (atualizado)
4. ✅ `src/queues/messageQueue.ts` (atualizado)

## Testando a Solução

1. Envie múltiplas mensagens rapidamente para a mesma conversa
2. Observe os logs mostrando:
   - Primeiro job adquire lock imediatamente
   - Segundo job aguarda o primeiro finalizar
   - Lock é liberado após processamento
   - Segundo job adquire lock e processa

## Manutenção

- Monitore logs Redis para problemas de conexão
- Ajuste `LOCK_TTL` se operations levarem mais de 5 minutos
- Ajuste `MAX_LOCK_WAIT` conforme necessário para seu caso de uso
