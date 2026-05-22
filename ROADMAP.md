# Roadmap consolidado

Objetivo: transformar o projeto em um dashboard de inteligencia comercial para a Dra. Janifer, partindo da coleta segura de primeiros contatos no Kommo e evoluindo para analise de funil, conversao e qualidade da abordagem.

## Principios de seguranca

- Trabalhar somente com conta Kommo autorizada.
- Usar apenas leitura: nao criar, editar, apagar, enviar mensagens, alterar status, alterar responsaveis ou interferir no trabalho das SDRs/Closers.
- Manter dados sensiveis e conversas completas apenas localmente.
- Publicar no GitHub Pages somente dados agregados ou relatos anonimizados.
- Preferir processo incremental e auditavel, para nao reprocessar tudo sem necessidade.

## Estado atual

- Repositorio GitHub criado: `pallusm/kommo-janifer-dashboard`.
- GitHub Pages ativo para o dashboard publico.
- Dashboard inicial criado com dados agregados por frase e origem.
- Coleta via interface da Kommo validada em modo somente leitura.
- Duas frases finais definidas:
  - `Olá, gostaria de saber mais sobre o acompanhamento com a Dra. Janifer`
  - `Olá, gostaria de informações sobre agendamento com a Dra. Janifer.`
- Pipeline incremental criado:
  - `data/store.json` local para detalhes;
  - `docs/data.json` publico com agregados;
  - deduplicacao de registros;
  - scripts para importar, gerar dashboard e publicar.
- Coletor local criado para reduzir copia e cola:
  - recebe dados do navegador em `http://127.0.0.1:8789/import`;
  - atualiza store local;
  - recalcula dados do dashboard.

## Fase 1: coleta operacional estavel

Objetivo: transformar a coleta atual em um fluxo repetivel, simples e confiavel.

- Rodar coletor local antes das buscas na Kommo.
- Executar um scanner para a frase de acompanhamento.
- Executar outro scanner para a frase de agendamento.
- Deduplicar automaticamente leads ja vistos.
- Atualizar o dashboard local sem copiar JSON manualmente.
- Publicar somente agregados no GitHub Pages.
- Registrar falhas de coleta, como lead aberto sem mensagem visivel ou origem vazia.

Resultado esperado: conseguir atualizar o dashboard de entrada de leads com poucos passos e baixo risco.

## Fase 2: leitura da pagina Leads e funil

Objetivo: cruzar os leads encontrados nas conversas com a etapa atual no funil de vendas.

- Coletar informacoes da pagina Leads/board.
- Identificar em qual coluna/etapa esta cada lead consultado na aba Chats.
- Relacionar cada lead com fases como:
  - oportunidade;
  - agendado;
  - confirmacao de pagamento;
  - reagendamento;
  - venda perdida;
  - outras fases existentes no funil.
- Cruzar etapa do funil com:
  - frase de entrada;
  - origem;
  - data de entrada;
  - responsavel;
  - status atual.
- Medir progressao por frase e por origem.

Resultado esperado: deixar de medir apenas volume e passar a medir qualidade e avanço comercial.

## Fase 3: conversao e resultado comercial

Objetivo: descobrir quais leads converteram, quais nao converteram e onde o processo perde oportunidades.

- Classificar leads em convertidos, em andamento, perdidos e sem resposta.
- Medir taxa de conversao por frase de entrada.
- Medir taxa de conversao por origem.
- Medir taxa de conversao por etapa do funil.
- Identificar gargalos:
  - muitos leads parados em uma etapa;
  - muitos leads sem resposta;
  - muitos leads perdidos apos preco/plano/agenda;
  - origem com muito volume e baixa conversao.

Resultado esperado: dashboard com leitura comercial, nao apenas operacional.

## Fase 4: analise qualitativa das conversas

Objetivo: transformar conversas em insights acionaveis para melhorar atendimento e conversao.

- Mapear motivos de conversao:
  - urgencia;
  - confianca na Dra. Janifer;
  - indicacao;
  - dor/sintoma explicito;
  - facilidade de agenda;
  - preco aceito;
  - qualidade/velocidade da abordagem.
- Mapear motivos de nao conversao:
  - preco;
  - plano de saude;
  - sem resposta;
  - localidade;
  - agenda;
  - falta de clareza;
  - lead frio/curioso.
- Extrair relatos anonimizados diretamente das conversas.
- Identificar objeções recorrentes.
- Identificar padroes de abordagem que parecem ajudar ou atrapalhar.
- Sugerir melhorias para SDRs e Closers.

Resultado esperado: area de insights qualitativos no dashboard, com exemplos anonimizados e recomendações praticas.

## Fase 5: experiencia visual do dashboard

Objetivo: criar um dashboard sofisticado, clean, funcional e com leitura executiva para cliente.

- Refinar hierarquia visual dos KPIs.
- Criar visoes por periodo, origem, frase e etapa do funil.
- Criar area de insights automaticos.
- Criar area de funil com progressao dos leads.
- Criar area qualitativa com relatos anonimizados.
- Separar visao executiva de visao operacional.
- Manter o site publico sem dados sensiveis.

Resultado esperado: um dashboard bonito o suficiente para apresentacao e util o suficiente para tomada de decisao.

## Fase 6: automacao de longo prazo

Objetivo: reduzir manutencao manual e evitar reprocessamento desnecessario.

- Salvar ultimo ponto processado por frase e por fonte.
- Buscar apenas novos resultados desde a ultima coleta.
- Criar rotina local de atualizacao.
- Avaliar uso futuro de API/webhooks oficiais quando houver credenciais adequadas.
- Preparar exportacoes periodicas.
- Criar logs locais para auditoria.

Resultado esperado: atualizacao incremental, segura e previsivel.

## Proxima revisao juntos

Pontos para decidir:

- Qual fase vem primeiro: estabilizar coleta, ler funil ou melhorar visual?
- Qual nivel de automacao e confortavel agora?
- Quais dados podem aparecer no dashboard publico?
- Como classificar conversao e perda no Kommo?
- Quais etapas do funil devem entrar no primeiro cruzamento?
- Qual formato de insight qualitativo seria mais valioso para o cliente?
