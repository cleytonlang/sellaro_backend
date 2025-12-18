# Documentação do Backend Sellaro

Este diretório contém toda a documentação técnica do backend do sistema Sellaro, organizada por categorias para facilitar a consulta e manutenção.

## Estrutura da Documentação

### 📋 Setup e Configuração
Documentos relacionados à configuração inicial e integrações de terceiros.

- [Redis Setup](./setup/REDIS_SETUP.md) - Configuração do Redis para filas e cache
- [Upstash Setup](./setup/UPSTASH_SETUP.md) - Configuração do Upstash Redis (cloud)
- [Quick Start Upstash](./setup/QUICK_START_UPSTASH.md) - Guia rápido de início com Upstash

### 🔧 Troubleshooting
Guias para resolução de problemas e debugging.

- [Thread Lock Solution](./troubleshooting/THREAD_LOCK_SOLUTION.md) - Solução para problemas de lock em threads
- [Clear Lock](./troubleshooting/clear-lock.md) - Como limpar locks travados
- [Test Functions](./troubleshooting/test-functions.md) - Funções de teste e debugging
- [Suggested System Prompt](./troubleshooting/suggested-system-prompt.md) - Prompts do sistema para assistente

## Como Usar Esta Documentação

1. **Configurando o backend pela primeira vez?** Comece pela seção de [Setup e Configuração](#-setup-e-configuração)
2. **Enfrentando um problema?** Veja o [Troubleshooting](#-troubleshooting)

## Manutenção da Documentação

Ao adicionar nova documentação:
- Coloque o arquivo na categoria apropriada
- Atualize este README.md com o link para o novo documento
- Use nomes descritivos para os arquivos
- Inclua um título claro e objetivo no documento
