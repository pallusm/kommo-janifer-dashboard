# Dashboard Kommo Janifer

Projeto para consultar dados do CRM Kommo via API, inicialmente em modo somente leitura.

## Objetivo inicial

- Buscar dados dos ultimos 15 dias.
- Procurar as frases:
  - `Olá, gostaria de saber mais sobre o acompanhamento com a Dra. Janifer`
  - `Olá, gostaria de informações sobre agendamento com a Dra. Janifer.`
- Separar sinais de origem, especialmente trafego e Instagram.
- Evoluir depois para dashboard/site automatizado para apresentar ao cliente.

## Segurança

- Nao salvar login/senha no repositorio.
- Quando a interface for necessaria, usar sessao local salva em `.auth/`, ignorada pelo Git.
- Preferir API oficial quando os dados estiverem disponiveis por API.
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
- `browser-snippets/scan-acompanhamento-v5.js`: coletor da frase de acompanhamento.
- `browser-snippets/scan-agendamento-v5.js`: coletor da frase de agendamento.

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

## Fluxo incremental

O dashboard publico le apenas `docs/data.json`, com dados agregados. Os detalhes coletados ficam no arquivo local `data/store.json`, que nao sobe para o Git.

### Robo local com navegador

Este e o fluxo recomendado para automatizar sem guardar senha.

1. Na primeira vez, abra o navegador de autenticacao:

```bash
npm run kommo:auth
```

Faca login manualmente na Kommo. Depois volte ao terminal e pressione Enter. A sessao fica salva apenas em `.auth/`, que nao sobe para o Git.

2. Para coletar automaticamente as duas frases na aba Chats:

```bash
npm run kommo:collect
```

Esse comando abre o navegador, entra na Kommo usando a sessao local, pesquisa as duas frases, abre resultados visiveis, coleta dados, deduplica e atualiza o dashboard local.

3. Para tentar cruzar os leads coletados com a pagina Leads/funil:

```bash
npm run kommo:scan-leads
```

4. Para preencher leads que ainda ficaram sem etapa usando a API somente leitura:

```bash
npm run kommo:enrich-api
```

Esse comando consulta por ID apenas os leads ja coletados e atualiza funil/status no store local.

5. Para publicar depois de conferir:

```bash
npm run publish:dashboard
```

### Coletor local com snippets

Este modo continua disponivel como alternativa controlada.

1. No terminal do projeto, ligue o coletor local:

```bash
npm run collector
```

2. Na Kommo, abra a aba Chats e pesquise:

```text
acompanhamento com a Dra. Janifer
```

3. No console do Chrome, rode o conteudo de:

```text
browser-snippets/scan-acompanhamento-auto-post-v6.js
```

4. Depois pesquise:

```text
informações sobre agendamento com a Dra. Janifer
```

5. No console do Chrome, rode o conteudo de:

```text
browser-snippets/scan-agendamento-auto-post-v6.js
```

Os scanners enviam os resultados para `http://127.0.0.1:8789/import`. O coletor local deduplica, atualiza `data/store.json` e recalcula `docs/data.json` e `site/data.json`.

Para publicar depois de conferir:

```bash
npm run publish:dashboard
```

Se quiser que o coletor tente publicar automaticamente a cada importacao, use:

```bash
npm run collector:publish
```

### Modo manual de contingencia

Use este fluxo apenas se o coletor local nao estiver disponivel.

1. Rode um scanner manual na Kommo.
2. No console, copie os resultados com um destes comandos:

```js
copy(JSON.stringify(window.__kommoAcompanhamentoResultados, null, 2))
```

ou

```js
copy(JSON.stringify(window.__kommoAgendamentoResultados, null, 2))
```

3. Cole o JSON em `imports/scan-results.json`.
4. Importe para o store local:

```bash
npm run import:scan
```

5. Gere os agregados publicos:

```bash
npm run build:dashboard
```

6. Publique o dashboard:

```bash
npm run publish:dashboard
```

## Plano futuro

O arquivo `ROADMAP.md` guarda o desejo de evoluir para analise qualitativa: conversao, nao conversao, motivos, relatos anonimizados e melhorias de abordagem.
