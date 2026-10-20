# Agenda da Família

Aplicação de agenda familiar que mantém a essência visual de um Kanban: cada coluna é um dia da semana e cada cartão é um compromisso. A rotina de toda a família fica visível de uma vez, e as atividades podem ser arrastadas entre os dias para serem remarcadas.

## O que dá para fazer

- **Uma família, vários logins**: cada pessoa pode criar a própria conta e entrar na mesma família usando um código de convite.
- **Cadastrar a família** em `Família`, com nome, papel (mãe, pai, filha...), cor, emoji, e-mail para convites e telefone WhatsApp.
- **Filtrar a agenda por pessoa** ou por categoria (escola, saúde, esporte, trabalho, lazer etc.).
- **Visualizar a semana em colunas** de segunda a domingo, com navegação entre semanas.
- **Visão Calendário** com todos os eventos e tarefas do mês agrupados por dia, mostrando somente os dias que têm atividades.
- **Arrastar compromissos entre os dias** para mudar a data. A coluna **Sem data** funciona como caixa de entrada para organizar depois.
- **Eventos com vários participantes**: uma consulta, viagem ou programa pode envolver mais de uma pessoa da família.
- **Dois tipos de card**:
  - **Evento**: tem data, horário, participantes e pode enviar convite de calendário.
  - **Tarefa**: tem um dia, não tem horário e pode ser compartilhada ou direcionada a outro membro — inclusive sem incluir quem criou.
- **Convites de calendário por e-mail**: ao criar um evento, o sistema envia um arquivo `.ics` para o e-mail de cada participante, permitindo adicionar o compromisso à agenda do Gmail, Outlook etc.
- **Reenviar convites** ou **cancelar** a atividade (o cancelamento também é enviado por e-mail).
- **Checklist "O que levar / preparar"** e **recados da família** em cada atividade.
- **Resumo do dia** na tela inicial, reunindo eventos e tarefas de todas as agendas.
- **Múltiplas agendas** (por exemplo, "Rotina da família", "Escola das meninas", "Trabalho"), com nome e descrição editáveis.

## Como funcionam os logins da família

1. A primeira pessoa cria a conta normalmente. Isso cria uma família e um código de convite.
2. Em `Família`, ela copia o código.
3. As demais pessoas criam a própria conta e informam o código no cadastro.
4. Quem já tem uma conta sem agendas também pode entrar em `Família` → **"Já tem uma conta e quer entrar em outra família?"**.

> Dica: cadastre o e-mail da pessoa antes de compartilhar o código. Assim, quando ela criar a conta, o login será vinculado ao cadastro que já existe na família (sem duplicar a pessoa).

Todas as pessoas da mesma família enxergam as mesmas agendas. Cada uma tem o próprio e-mail e senha.

## Como funcionam os convites por e-mail

Ao criar uma atividade com participantes que têm e-mail cadastrado, a API:

- gera um convite **iCalendar (`.ics`)** com data, horário, local, participantes e detalhes;
- envia para cada participante, com o convite anexado e também como parte `text/calendar`;
- adiciona o evento à agenda do e-mail quando a pessoa aceita o convite.

O envio depende de configuração de e-mail no servidor. Sem configuração, a atividade é salva normalmente e a interface avisa que o envio ainda não está configurado.

### Configuração de e-mail

Copie `.env.example` para `.env` e configure **uma** das opções:

**SMTP (recomendado para convites de calendário)**

```env
MAIL_FROM="Agenda da Família <agenda@seudominio.com>"
MAIL_FROM_EMAIL=agenda@seudominio.com
SMTP_HOST=smtp.seudominio.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=agenda@seudominio.com
SMTP_PASS=sua-senha-ou-app-password
```

No Gmail, é necessário usar uma **senha de app** e permitir SMTP. Em provedores como Zoho, Brevo, SendGrid e Mailgun, use as credenciais SMTP fornecidas por eles.

**Resend (alternativa sem SMTP)**

```env
MAIL_FROM="Agenda da Família <agenda@seudominio.com>"
RESEND_API_KEY=re_xxxxxxxxx
```

O domínio do remetente precisa estar verificado no provedor. O convite é enviado como anexo `.ics`.

Também é recomendado definir:

```env
APP_URL=https://sua-agenda.vercel.app
MAIL_REPLY_TO=seu-email@seudominio.com
```

## Avisos por WhatsApp (n8n)

O fluxo do n8n usa os telefones cadastrados em `Família` para enviar:

- **Domingo às 22:00** — agenda dos próximos 7 dias de cada pessoa.
- **Todos os dias às 07:00** — eventos e tarefas do dia. Se não houver nada, envia uma mensagem avisando que o dia está livre.
- **A cada 10 minutos** — lembrete para eventos que começam em aproximadamente 1 hora.

### Cadastro do telefone

Em `Família`, edite cada pessoa e preencha o campo **WhatsApp**. Pode informar com máscara; o sistema normaliza os dígitos e adiciona o código do Brasil (55) quando o número tem DDD + número.

### API usada pelo n8n

Os endpoints ficam protegidos pela chave `NOTIFICATIONS_API_KEY`, enviada no header `x-api-key`:

```text
GET /api/notifications/daily
GET /api/notifications/weekly
GET /api/notifications/reminders
```

Exemplo de resposta:

```json
{
  "messages": [
    {
      "name": "Ana",
      "phone": "5511999999999",
      "message": "🌞 Bom dia, Ana! ..."
    }
  ]
}
```

O fluxo do n8n envia cada item para a API do WhatsApp com `phone` e `message`.

### Variáveis necessárias

- `NOTIFICATIONS_API_KEY` — mesma chave usada no n8n.
- `NOTIFICATIONS_FAMILY_ID` — ID da família que receberá os avisos (opcional; recomendado para não incluir contas de teste).
- `APP_TIMEZONE` — fuso usado nos cálculos (padrão: `America/Sao_Paulo`).
- `APP_URL` — URL pública da aplicação.

Na Vercel, cadastre também `NOTIFICATIONS_API_KEY` e `APP_TIMEZONE` em **Settings → Environment Variables**.

## Estrutura do projeto

```
client/   React + Vite (frontend)
server/   Express + SQLite/Postgres (API)
api/      Entry point usado na Vercel
scripts/  Testes de schema, queries e geração de convites
```

No banco:

- `families` → famílias e códigos de convite
- `users` → contas de login vinculadas a uma família
- `boards` → agendas compartilhadas pela família
- `lists` → lista interna padrão de cada agenda
- `cards` → atividades/compromissos
- `card_members` → participantes de cada atividade
- `members` → pessoas da família (com ou sem login)
- `checklist_items` e `comments` → checklist e recados

Atividades antigas que não tinham data aparecem automaticamente na coluna **Sem data**. Basta arrastá-las para um dia para entrarem na rotina. A migração também cria uma família para cada conta antiga e vincula o usuário ao membro correspondente.

## Rodando localmente

```bash
npm install
npm install --prefix server
npm install --prefix client
npm run dev
```

- Frontend: http://localhost:5173
- API: http://localhost:3001

O banco local é SQLite em `server/data/kanban.db` e é criado/migrado automaticamente na primeira execução.

## Produção

Defina as variáveis:

- `DATABASE_URL` — string de conexão do PostgreSQL
- `JWT_SECRET` — segredo dos tokens de sessão
- `APP_URL` — URL pública usada nos e-mails
- `MAIL_FROM`, `SMTP_*` ou `RESEND_API_KEY` — envio dos convites

O schema e as migrações são verificados automaticamente na inicialização.

## Build e testes

```bash
npm run build
node scripts/test-pg-queries.js
node scripts/test-calendar-invite.js
```
