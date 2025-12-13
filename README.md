# Sellaro Backend

Backend da aplicação Sellaro construído com Fastify, Prisma e TypeScript.

## Tecnologias

- **Fastify** - Framework web rápido e eficiente
- **Prisma** - ORM moderno para Node.js
- **TypeScript** - Tipagem estática
- **PostgreSQL** - Banco de dados relacional
- **bcryptjs** - Hash de senhas

## Estrutura do Projeto

```
sellaro_backend/
├── src/
│   ├── controllers/      # Lógica de negócio
│   ├── routes/          # Definição de rotas
│   ├── middlewares/     # Middlewares (auth, etc)
│   ├── services/        # Serviços auxiliares
│   ├── types/           # Tipos TypeScript
│   ├── utils/           # Utilitários (prisma, etc)
│   └── server.ts        # Arquivo principal do servidor
├── prisma/
│   └── schema.prisma    # Schema do banco de dados
├── .env.example         # Exemplo de variáveis de ambiente
└── package.json
```

## Instalação

1. Clone o repositório e entre na pasta:
```bash
cd sellaro_backend
```

2. Instale as dependências:
```bash
npm install
```

3. Configure as variáveis de ambiente:
```bash
cp .env.example .env
```

Edite o arquivo `.env` com suas configurações:
```
DATABASE_URL=postgresql://user:password@localhost:5432/sellaro
CORS_ORIGIN=http://localhost:3000
PORT=3001
```

4. Configure o banco de dados:
```bash
# Gerar o Prisma Client
npm run prisma:generate

# Executar as migrations
npm run prisma:migrate

# Ou fazer push do schema (desenvolvimento)
npm run prisma:push
```

## Executando

### Desenvolvimento
```bash
npm run dev
```

O servidor estará rodando em `http://localhost:3001`

### Produção
```bash
# Build
npm run build

# Start
npm start
```

## API Endpoints

### Autenticação
- `POST /api/auth/register` - Registrar novo usuário
- `POST /api/auth/login` - Fazer login
- `POST /api/auth/logout` - Fazer logout
- `GET /api/auth/me` - Obter usuário atual

### Usuários
- `GET /api/users` - Listar todos os usuários
- `GET /api/users/:id` - Obter usuário por ID
- `PUT /api/users/:id` - Atualizar usuário
- `DELETE /api/users/:id` - Deletar usuário

### Formulários
- `POST /api/forms` - Criar formulário
- `GET /api/forms` - Listar formulários (filtro: ?userId=xxx)
- `GET /api/forms/:id` - Obter formulário por ID
- `GET /api/forms/embed/:embedCode` - Obter formulário por código embed
- `PUT /api/forms/:id` - Atualizar formulário
- `DELETE /api/forms/:id` - Deletar formulário

### Leads
- `POST /api/leads` - Criar lead
- `GET /api/leads` - Listar leads (filtros: ?userId=xxx&form_id=xxx&status=xxx)
- `GET /api/leads/:id` - Obter lead por ID
- `PUT /api/leads/:id` - Atualizar lead
- `DELETE /api/leads/:id` - Deletar lead

### Assistentes
- `POST /api/assistants` - Criar assistente
- `GET /api/assistants` - Listar assistentes (filtro: ?userId=xxx)
- `GET /api/assistants/:id` - Obter assistente por ID
- `PUT /api/assistants/:id` - Atualizar assistente
- `DELETE /api/assistants/:id` - Deletar assistente

### Conversações
- `POST /api/conversations` - Criar conversação
- `GET /api/conversations` - Listar conversações (filtros: ?lead_id=xxx&assistant_id=xxx)
- `GET /api/conversations/:id` - Obter conversação por ID
- `POST /api/conversations/:id/messages` - Adicionar mensagem
- `PUT /api/conversations/:id` - Atualizar conversação

### Kanban
- `POST /api/kanban` - Criar coluna kanban
- `GET /api/kanban` - Listar colunas (filtro: ?userId=xxx)
- `GET /api/kanban/:id` - Obter coluna por ID
- `PUT /api/kanban/:id` - Atualizar coluna
- `DELETE /api/kanban/:id` - Deletar coluna
- `POST /api/kanban/reorder` - Reordenar colunas

### Health Check
- `GET /health` - Verificar status do servidor

## Scripts Disponíveis

- `npm run dev` - Inicia o servidor em modo desenvolvimento com hot-reload
- `npm run build` - Compila TypeScript para JavaScript
- `npm start` - Inicia o servidor em modo produção
- `npm run prisma:generate` - Gera o Prisma Client
- `npm run prisma:migrate` - Executa migrations
- `npm run prisma:push` - Faz push do schema para o DB (desenvolvimento)
- `npm run prisma:studio` - Abre o Prisma Studio

## Modelos do Banco de Dados

### User
Usuários da plataforma

### Session
Sessões de autenticação

### Account
Contas vinculadas aos usuários

### Assistant
Assistentes de IA configurados

### Form
Formulários criados

### Lead
Leads capturados pelos formulários

### Conversation
Conversas entre leads e assistentes

### Message
Mensagens nas conversações

### LeadEvent
Eventos relacionados aos leads

### KanbanColumn
Colunas do quadro kanban

## Segurança

- Senhas são hasheadas com bcryptjs
- CORS configurado
- Helmet para headers de segurança
- Autenticação via token de sessão

## Licença

ISC
