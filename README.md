# Dashboard Kommo Janifer

Projeto para consultar dados do CRM Kommo via API, inicialmente em modo somente leitura.

## Objetivo inicial

- Buscar dados dos ultimos 15 dias.
- Procurar as frases:
  - `Olá, gostaria de saber mais sobre o acompanhamento com a Dra. Janifer`
  - `Olá`
  - `Olá, gostaria de informações sobre agendamento com a Dra. Janifer.`
- Separar sinais de origem, especialmente trafego e Instagram.
- Evoluir depois para dashboard/site automatizado para apresentar ao cliente.

## Segurança

- Nao usar login/senha.
- Usar apenas API.
- Nao alterar nada no Kommo sem autorizacao.
- Comecar com consultas `GET` somente leitura para mapear conta, leads, tags, origens e conversas/anotacoes.

## Primeiro passo

Crie um arquivo `.env` usando o `.env.example` como base e cole o token nele.

Depois rode:

```bash
npm run check:account
```

Se a conta aparecer corretamente, rode:

```bash
npm run fetch:kommo
```

O relatorio sera salvo em `data/kommo-report.json`.

Para comecar com uma amostra pequena, ajuste `KOMMO_MAX_LEADS` no `.env`.

## Descobertas iniciais

- Conta Kommo validada localmente via API somente leitura.
- Foram encontrados campos de leads para UTM, `Campanha` e `Origem`.
- O campo `Origem` tem valores como `Instagram`, `Trafego`, `Site` e `Google`.
- Foram encontrados funis separados para Whatsapp, Instagram e Formulario.
- O token OAuth atual permite ler eventos como `incoming_chat_message`, mas esses eventos trazem IDs de mensagem/conversa, nao o texto completo da mensagem.
- Para ler historico completo de mensagens de chat, a documentacao da Kommo indica a API de Chats, que usa credenciais de canal (`scope_id` e segredo), ou webhooks para capturar mensagens novas.

## Scanner via interface

Como a aba Chats mostra o texto das mensagens, o projeto tambem tem snippets para rodar no console do Chrome enquanto a Kommo esta aberta.

- `browser-snippets/scan-open-kommo-chat-v7.js`: le a conversa aberta.
- `browser-snippets/scan-kommo-search-results-v4.js`: coletor semi-automatico com validacao explicita das 2 frases longas usadas no relatorio.

Fluxo seguro:

1. Pesquisar uma das frases na aba Chats da Kommo.
2. Rodar primeiro o scanner de teste.
3. Conferir os resultados no console.
4. So depois aumentar o limite.

Os snippets nao enviam mensagem, nao salvam campos e nao alteram leads. O teste semi-automatico apenas abre resultados da lista lateral para leitura.

## Site

A primeira versao do dashboard esta em `site/` e uma copia pronta para GitHub Pages esta em `docs/`.

Para abrir localmente, use o arquivo:

`docs/index.html`
