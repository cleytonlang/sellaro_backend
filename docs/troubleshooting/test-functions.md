# Testando Function Calling

## Assistente: Gabriela (cmj7y3sj80075np0qt7on8fdu)

### Funções configuradas:

1. **move_lead_column** - Trigger: "dia de chuva"
2. **add_lead_comment** - Trigger: "dia de sol"

### Como testar:

1. **Para testar move_lead_column:**
   - Envie uma mensagem: "Quero agendar para um dia de chuva"
   - Você precisa fornecer: `lead_id` e `column_id` válidos

2. **Para testar add_lead_comment:**
   - Envie uma mensagem: "Quero agendar para um dia de sol"
   - Você precisa fornecer: `lead_id` válido

### Problema identificado:

As funções exigem IDs reais (lead_id, column_id), mas o assistente não tem contexto sobre quais IDs usar. Você tem duas opções:

#### Opção 1: Melhorar o system prompt
Adicione ao system prompt do assistente:
```
Você tem acesso a funções para gerenciar leads. Quando precisar usar as funções:
- Para move_lead_column, sempre use lead_id="LEAD_ID_AQUI" e column_id="COLUMN_ID_AQUI"
- Para add_lead_comment, sempre use lead_id="LEAD_ID_AQUI"

Sempre pergunte ao usuário qual lead ele quer modificar antes de chamar as funções.
```

#### Opção 2: Modificar as funções para não exigir IDs
Tornar os IDs opcionais e usar o lead da conversa atual.

## Exemplo de teste completo:

```
Usuário: "Quero agendar para um dia de chuva. O lead é ABC123 e quero mover para a coluna XYZ789"
```

O assistente deve interpretar isso e chamar:
```javascript
move_lead_column({
  lead_id: "ABC123",
  column_id: "XYZ789",
  reason: "Cliente solicitou agendamento para dia de chuva"
})
```
