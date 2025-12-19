# Configuração do Resend para Envio de Emails

Este documento explica como configurar o serviço de email Resend no sistema.

## 1. Obter API Key do Resend

1. Acesse [https://resend.com](https://resend.com)
2. Crie uma conta ou faça login
3. Vá para **API Keys** no painel
4. Clique em **Create API Key**
5. Copie a chave gerada (começa com `re_`)

## 2. Configurar Domínio (Opcional mas Recomendado)

Para enviar emails do seu próprio domínio:

1. No painel do Resend, vá para **Domains**
2. Clique em **Add Domain**
3. Digite seu domínio (ex: `seudominio.com`)
4. Adicione os registros DNS fornecidos no seu provedor de domínio
5. Aguarde a verificação (pode levar até 48 horas)

## 3. Configurar Variáveis de Ambiente

Adicione as seguintes variáveis ao arquivo `.env`:

```env
# Resend (Email service)
RESEND_API_KEY=re_sua_chave_aqui
RESEND_FROM_EMAIL=noreply@seudominio.com
```

### Opções de Email Remetente:

- **Com domínio verificado**: Use `noreply@seudominio.com`
- **Sem domínio (sandbox)**: Use `onboarding@resend.dev` (somente para testes, limitado)

## 4. Como Funciona

### Trigger de Email

Quando um trigger do tipo `SEND_EMAIL` é acionado:

1. O assistente responde com o identificador do trigger na mensagem
2. O sistema detecta o identificador
3. Busca os dados do lead no banco de dados
4. Envia um email para os destinatários configurados com:
   - Assunto personalizado
   - Conteúdo personalizado
   - Dados do formulário do lead

### Estrutura do Email

O email enviado contém:
- **Header**: Título "Novo Lead Capturado"
- **Content**: Conteúdo personalizado do trigger
- **Lead Data**: Lista formatada com todos os dados do formulário

### Múltiplos Destinatários

Para enviar para múltiplos emails, separe-os por vírgula:
```
vendas@empresa.com,suporte@empresa.com,admin@empresa.com
```

## 5. Logs e Monitoramento

### Logs de Trigger

Todos os envios de email são registrados na tabela `trigger_log`:
- `success`: true/false
- `data`: informações do envio (destinatários, assunto, data)
- `error_message`: mensagem de erro se houver falha

### Console Logs

O sistema registra no console:
```
[JOB xxx] Preparing to send email to: email@example.com
[JOB xxx] Email subject: Assunto do Email
[JOB xxx] Email sent successfully to: email@example.com
```

### Painel do Resend

Acesse [https://resend.com/emails](https://resend.com/emails) para:
- Ver todos os emails enviados
- Status de entrega
- Aberturas e cliques
- Logs de erros

## 6. Limites e Custos

### Plano Gratuito:
- 100 emails/dia
- 3,000 emails/mês
- Sem domínio personalizado (apenas sandbox)

### Plano Pago (a partir de $20/mês):
- 50,000 emails/mês inclusos
- Domínio personalizado
- Emails ilimitados de destinatários

## 7. Troubleshooting

### Erro: "Failed to send email"
- Verifique se a API key está correta
- Verifique se o domínio está verificado (se não estiver usando sandbox)
- Verifique os logs no painel do Resend

### Erro: "No valid recipient emails provided"
- Verifique se o campo `recipients` está preenchido no trigger
- Verifique se os emails estão no formato correto

### Emails não estão sendo entregues
- Verifique a pasta de spam
- Verifique se o domínio está verificado
- Verifique o status no painel do Resend

## 8. Exemplo de Uso

1. Crie um trigger do tipo "Enviar email"
2. Preencha:
   - **Emails destinatários**: `vendas@empresa.com`
   - **Assunto**: `Novo lead capturado: {{nome}}`
   - **Conteúdo**: `Olá! Um novo lead foi capturado no formulário.`
3. Configure o assistente para incluir o identificador do trigger na resposta
4. Quando o assistente responder com o identificador, o email será enviado automaticamente

## 9. Segurança

- A API key é armazenada em variável de ambiente (nunca no código)
- Nunca compartilhe sua API key publicamente
- Use variáveis de ambiente diferentes para desenvolvimento/produção
- Considere usar diferentes domínios para dev/prod

## 10. Recursos Adicionais

- [Documentação Resend](https://resend.com/docs)
- [API Reference](https://resend.com/docs/api-reference/introduction)
- [SDKs](https://resend.com/docs/send-with-nodejs)
