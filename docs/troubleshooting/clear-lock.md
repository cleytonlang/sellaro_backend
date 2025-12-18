# Limpar Lock de Thread Travada

## Usando curl:

```bash
curl -X DELETE http://localhost:3001/api/admin/thread-lock/thread_5HiKZPQ8PF5aAhdWFs0kQnSj
```

## Ou verificar o status primeiro:

```bash
curl http://localhost:3001/api/admin/thread-lock/thread_5HiKZPQ8PF5aAhdWFs0kQnSj
```

## Endpoints criados:

1. **GET /api/admin/thread-lock/:thread_id** - Verifica o status do lock
2. **DELETE /api/admin/thread-lock/:thread_id** - Força a limpeza do lock

## Exemplo de resposta ao limpar:

```json
{
  "success": true,
  "message": "Thread lock cleared successfully",
  "data": {
    "thread_id": "thread_5HiKZPQ8PF5aAhdWFs0kQnSj",
    "was_locked": true,
    "ttl_seconds": 245,
    "active_run": "run_xyz123"
  }
}
```
