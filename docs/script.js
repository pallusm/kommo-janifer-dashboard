const fallbackData = {
  period: '07/05/2026 a 22/05/2026',
  updatedAt: '22/05/2026 18:00',
  phrases: [
    {
      key: 'acompanhamento',
      label: 'Olá, gostaria de saber mais sobre o acompanhamento com a Dra. Janifer',
      valid: 10,
      discarded: 15,
      origins: {
        Instagram: 7,
        Tráfego: 1,
        'Sem origem': 2
      },
      funnel: {}
    },
    {
      key: 'agendamento',
      label: 'Olá, gostaria de informações sobre agendamento com a Dra. Janifer.',
      valid: 19,
      discarded: 6,
      origins: {
        Instagram: 9,
        Tráfego: 0,
        'Sem origem': 10
      },
      funnel: {}
    }
  ],
  funnel: {},
  commercialStatus: {},
  quality: {
    conversionReasons: {},
    lossReasons: {},
    anonymizedReports: []
  }
};

const formatPercent = (value) => `${Math.round(value)}%`;
const sum = (items, selector) => items.reduce((total, item) => total + selector(item), 0);

async function loadData() {
  try {
    const response = await fetch('./data.json', { cache: 'no-store' });
    if (!response.ok) throw new Error('data.json indisponivel');
    return await response.json();
  } catch {
    return fallbackData;
  }
}

function calculate(data) {
  const valid = sum(data.phrases, (item) => item.valid);
  const discarded = sum(data.phrases, (item) => item.discarded);
  const sample = valid + discarded;
  const origins = data.phrases.reduce((acc, item) => {
    for (const [origin, value] of Object.entries(item.origins)) {
      acc[origin] = (acc[origin] || 0) + value;
    }
    return acc;
  }, {});
  const topPhrase = data.phrases.slice().sort((a, b) => b.valid - a.valid)[0];
  const funnel = data.funnel || data.phrases.reduce((acc, item) => {
    for (const [stage, value] of Object.entries(item.funnel || {})) {
      acc[stage] = (acc[stage] || 0) + value;
    }
    return acc;
  }, {});

  return {
    valid,
    discarded,
    sample,
    validRate: sample ? (valid / sample) * 100 : 0,
    origins,
    funnel,
    topPhrase
  };
}

function setText(id, value) {
  document.querySelector(`#${id}`).textContent = value;
}

function renderKpis(data, totals) {
  setText('period-label', data.period);
  setText('updated-label', `Última coleta: ${data.updatedAt}`);
  setText('kpi-validos', totals.valid);
  setText('kpi-validos-detail', `${formatPercent(totals.validRate)} da amostra lida`);
  setText('kpi-amostra', totals.sample);
  setText('kpi-descartados', `${totals.discarded} descartados`);
  setText('kpi-instagram', totals.origins.Instagram || 0);
  setText('kpi-instagram-share', `${formatPercent(((totals.origins.Instagram || 0) / totals.valid) * 100 || 0)} dos válidos`);
  setText('kpi-sem-origem', totals.origins['Sem origem'] || 0);
  setText('kpi-sem-origem-share', `${formatPercent(((totals.origins['Sem origem'] || 0) / totals.valid) * 100 || 0)} dos válidos`);
}

function renderPhrases(data) {
  const container = document.querySelector('#phrase-list');

  container.innerHTML = data.phrases
    .map((item) => {
      const sample = item.valid + item.discarded;
      const rate = sample ? (item.valid / sample) * 100 : 0;
      const originText = Object.entries(item.origins)
        .map(([origin, value]) => `<span class="chip">${origin}: ${value}</span>`)
        .join('');

      return `
        <article class="phrase-card">
          <div class="phrase-top">
            <p class="phrase-text">${item.label}</p>
            <div class="phrase-score">
              <strong>${item.valid}</strong>
              <span>válidos</span>
            </div>
          </div>
          <div class="progress-track" aria-hidden="true">
            <div class="progress-fill" style="width: ${rate}%"></div>
          </div>
          <div class="phrase-meta">
            <span class="chip">Taxa válida: ${formatPercent(rate)}</span>
            <span class="chip">Descartados: ${item.discarded}</span>
            ${originText}
          </div>
        </article>
      `;
    })
    .join('');
}

function renderOrigins(totals) {
  const container = document.querySelector('#origin-bars');
  const max = Math.max(...Object.values(totals.origins), 1);

  container.innerHTML = Object.entries(totals.origins)
    .sort((a, b) => b[1] - a[1])
    .map(([origin, value]) => `
      <div class="bar-row">
        <div class="bar-label">
          <span>${origin}</span>
          <span>${value}</span>
        </div>
        <div class="bar-track" aria-hidden="true">
          <div class="bar-fill" style="width: ${(value / max) * 100}%"></div>
        </div>
      </div>
    `)
    .join('');
}

function renderFunnel(totals) {
  const container = document.querySelector('#funnel-bars');
  const entries = Object.entries(totals.funnel || {}).filter(([, value]) => value > 0);

  if (!entries.length) {
    container.innerHTML = `
      <article class="insight">
        <strong>Funil aguardando coleta</strong>
        <p>Quando a leitura da página Leads for executada, este bloco mostrará em quais etapas estão os leads encontrados nas conversas.</p>
      </article>
    `;
    return;
  }

  const max = Math.max(...entries.map(([, value]) => value), 1);

  container.innerHTML = entries
    .sort((a, b) => b[1] - a[1])
    .map(([stage, value]) => `
      <div class="bar-row">
        <div class="bar-label">
          <span>${stage}</span>
          <span>${value}</span>
        </div>
        <div class="bar-track" aria-hidden="true">
          <div class="bar-fill alt" style="width: ${(value / max) * 100}%"></div>
        </div>
      </div>
    `)
    .join('');
}

function renderInsights(totals) {
  const topPhraseShare = totals.valid && totals.topPhrase ? (totals.topPhrase.valid / totals.valid) * 100 : 0;
  const noOriginShare = totals.valid ? ((totals.origins['Sem origem'] || 0) / totals.valid) * 100 : 0;
  const instagramShare = totals.valid ? ((totals.origins.Instagram || 0) / totals.valid) * 100 : 0;
  const topPhraseLabel = totals.topPhrase?.key === 'agendamento' ? 'Agendamento' : 'Acompanhamento';

  document.querySelector('#insights').innerHTML = `
    <article class="insight">
      <strong>${topPhraseLabel} lidera a intenção capturada</strong>
      <p>A frase de maior volume representa ${formatPercent(topPhraseShare)} dos leads válidos da amostra.</p>
    </article>
    <article class="insight">
      <strong>Instagram concentra a principal origem identificada</strong>
      <p>${formatPercent(instagramShare)} dos válidos têm Instagram como origem preenchida.</p>
    </article>
    <article class="insight warning">
      <strong>Atribuição ainda tem perda relevante</strong>
      <p>${formatPercent(noOriginShare)} dos válidos estão sem origem, o que limita leitura de performance por canal.</p>
    </article>
  `;
}

function topPair(entries) {
  return Object.entries(entries || {})
    .filter(([, value]) => value > 0)
    .sort((a, b) => b[1] - a[1])[0] || null;
}

function countStages(funnel, names) {
  return names.reduce((total, name) => total + (funnel?.[name] || 0), 0);
}

function renderDiagnostic(data, totals) {
  const topStage = topPair(totals.funnel);
  const topOrigin = topPair(totals.origins);
  const noOrigin = totals.origins['Sem origem'] || 0;
  const lost = countStages(totals.funnel, ['Venda perdida']) || (data.commercialStatus?.Perdido || 0);
  const standBy = countStages(totals.funnel, ['Stand By']);
  const payment = countStages(totals.funnel, ['4 - Confirmação de pagamento', 'Confirmação de pagamento']);
  const opportunity = countStages(totals.funnel, ['2 - Oportunidade', 'Oportunidade']);
  const connection = countStages(totals.funnel, ['1 - Conexão', 'Conexão']);
  const advanced = opportunity + payment;
  const noOriginShare = totals.valid ? (noOrigin / totals.valid) * 100 : 0;
  const lostShare = totals.valid ? (lost / totals.valid) * 100 : 0;

  const cards = [
    {
      label: 'Gargalo visível',
      value: topStage ? topStage[0] : 'Aguardando funil',
      detail: topStage ? `${topStage[1]} leads estão concentrados nesta etapa.` : 'Execute a leitura do board de Leads para ativar esta análise.',
      tone: topStage ? 'neutral' : 'warning'
    },
    {
      label: 'Canal dominante',
      value: topOrigin ? topOrigin[0] : 'Aguardando origem',
      detail: topOrigin ? `${topOrigin[1]} leads válidos vieram desta origem preenchida.` : 'Ainda não há origem suficiente para comparação.',
      tone: 'neutral'
    },
    {
      label: 'Perda de atribuição',
      value: formatPercent(noOriginShare),
      detail: `${noOrigin} leads válidos estão sem origem preenchida.`,
      tone: noOriginShare >= 25 ? 'warning' : 'neutral'
    },
    {
      label: 'Sinal de perda',
      value: lost,
      detail: `${formatPercent(lostShare)} dos válidos aparecem como venda perdida ou status perdido.`,
      tone: lost > 0 ? 'warning' : 'neutral'
    },
    {
      label: 'Fila de retomada',
      value: standBy,
      detail: 'Leads em Stand By merecem cadência própria de reativação.',
      tone: standBy > 0 ? 'warning' : 'neutral'
    },
    {
      label: 'Avanço comercial',
      value: advanced,
      detail: `${connection} em conexão, ${opportunity} em oportunidade e ${payment} em confirmação de pagamento.`,
      tone: advanced > 0 ? 'good' : 'neutral'
    }
  ];

  document.querySelector('#diagnostic-grid').innerHTML = cards
    .map((card) => `
      <article class="diagnostic-card ${card.tone}">
        <span>${card.label}</span>
        <strong>${card.value}</strong>
        <p>${card.detail}</p>
      </article>
    `)
    .join('');
}

function action(title, body, tag = 'Prioridade') {
  return { title, body, tag };
}

function renderActionList(selector, items) {
  document.querySelector(selector).innerHTML = items
    .map((item) => `
      <article class="action-item">
        <span>${item.tag}</span>
        <strong>${item.title}</strong>
        <p>${item.body}</p>
      </article>
    `)
    .join('');
}

function renderStrategicActions(data, totals) {
  const noOrigin = totals.origins['Sem origem'] || 0;
  const instagram = totals.origins.Instagram || 0;
  const traffic = totals.origins.Tráfego || 0;
  const lost = countStages(totals.funnel, ['Venda perdida']) || (data.commercialStatus?.Perdido || 0);
  const standBy = countStages(totals.funnel, ['Stand By']);
  const connection = countStages(totals.funnel, ['1 - Conexão', 'Conexão']);
  const opportunity = countStages(totals.funnel, ['2 - Oportunidade', 'Oportunidade']);
  const payment = countStages(totals.funnel, ['4 - Confirmação de pagamento', 'Confirmação de pagamento']);
  const topPhraseLabel = totals.topPhrase?.key === 'agendamento' ? 'agendamento' : 'acompanhamento';

  const sdrItems = [
    action(
      'Treinar passagem da conexão para oportunidade',
      `${connection || 0} leads aparecem na etapa de conexão. Vale revisar se a primeira resposta sempre fecha próxima ação clara: nome, cidade, formato de consulta e melhor horário.`,
      'Abordagem'
    ),
    action(
      'Criar roteiro de retomada para Stand By',
      `${standBy || 0} leads estão em espera. Use uma cadência curta com motivo, benefício e pergunta simples para reabrir conversa.`,
      'Follow-up'
    ),
    action(
      'Comparar as duas intenções de entrada',
      `A frase de ${topPhraseLabel} puxa mais volume na amostra. O próximo treino é comparar se a intenção também avança melhor no funil.`,
      'Qualificação'
    )
  ];

  if (lost > 0) {
    sdrItems.push(action(
      'Revisar conversas perdidas',
      `${lost} leads aparecem como perda. Classificar motivo antes de treinar evita atacar o sintoma errado.`,
      'Perda'
    ));
  }

  const managementItems = [
    action(
      'Acompanhar conversão por origem',
      `Instagram tem ${instagram} válidos e tráfego tem ${traffic}. A decisão de investimento deve cruzar volume, avanço de funil e perda.`,
      'Canal'
    ),
    action(
      'Olhar funil como indicador de capacidade',
      `Oportunidade tem ${opportunity || 0} leads e confirmação de pagamento tem ${payment || 0}. Isso ajuda a separar demanda gerada de receita provável.`,
      'Funil'
    ),
    action(
      'Criar rito semanal de perdas',
      'Toda semana, separar perdas por motivo: preço, plano, agenda, sem resposta, localidade e falta de clareza.',
      'Gestão'
    )
  ];

  const processItems = [
    action(
      'Obrigar origem antes do avanço',
      `${noOrigin} leads válidos estão sem origem. Sem isso, o dashboard perde força para decidir canal e verba.`,
      'Dados'
    ),
    action(
      'Automatizar enriquecimento incremental',
      'Manter a coleta lendo novos registros e atualizando apenas o que mudou reduz retrabalho e risco operacional.',
      'Automação'
    ),
    action(
      'Separar público de privado',
      'Conversas completas e nomes ficam locais; GitHub Pages recebe apenas números agregados e relatos anonimizados.',
      'Segurança'
    )
  ];

  const experimentItems = [
    action(
      'Teste de abordagem por intenção',
      'Comparar se leads de acompanhamento precisam de script mais educacional e leads de agendamento precisam de fechamento mais direto.',
      'Hipótese'
    ),
    action(
      'Teste de cadência para sem resposta',
      'Medir se uma sequência curta em 24h, 48h e 5 dias aumenta retomada sem pressionar o lead.',
      'Retomada'
    ),
    action(
      'Teste de qualificação antes de preço',
      'Validar se entender dor, objetivo e disponibilidade antes de falar de pagamento melhora avanço para confirmação.',
      'Conversão'
    )
  ];

  renderActionList('#sdr-actions', sdrItems);
  renderActionList('#management-actions', managementItems);
  renderActionList('#process-actions', processItems);
  renderActionList('#experiment-actions', experimentItems);
}

function renderQuality(data) {
  const quality = data.quality || {};
  const conversionReasons = Object.entries(quality.conversionReasons || {});
  const lossReasons = Object.entries(quality.lossReasons || {});
  const reports = quality.anonymizedReports || [];

  if (!conversionReasons.length && !lossReasons.length && !reports.length) {
    document.querySelector('#quality-insights').innerHTML = `
      <article class="insight">
        <strong>Camada qualitativa preparada</strong>
        <p>O próximo avanço é classificar conversão, perda, objeções e relatos anonimizados sem publicar dados sensíveis.</p>
      </article>
      <article class="insight warning">
        <strong>Dados completos continuam locais</strong>
        <p>Conversas e nomes não entram no GitHub Pages; aqui entram apenas padrões e exemplos anonimizados.</p>
      </article>
    `;
    return;
  }

  const reasonText = [...conversionReasons, ...lossReasons]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([reason, value]) => `<span class="chip">${reason}: ${value}</span>`)
    .join('');
  const reportText = reports
    .slice(0, 2)
    .map((report) => `<p>${report.text}</p>`)
    .join('');

  document.querySelector('#quality-insights').innerHTML = `
    <article class="insight">
      <strong>Motivos e objeções recorrentes</strong>
      <div class="phrase-meta">${reasonText || '<span class="chip">Aguardando classificação</span>'}</div>
    </article>
    <article class="insight">
      <strong>Relatos anonimizados</strong>
      ${reportText || '<p>Aguardando relatos anonimizados.</p>'}
    </article>
  `;
}

function topEntry(entries) {
  return Object.entries(entries || {}).sort((a, b) => b[1] - a[1])[0]?.[0] || 'Aguardando coleta';
}

function renderTable(data) {
  document.querySelector('#summary-rows').innerHTML = data.phrases
    .map((item) => {
      const sample = item.valid + item.discarded;
      const rate = sample ? (item.valid / sample) * 100 : 0;

      return `
        <tr>
          <td>${item.label}</td>
          <td class="number-good">${item.valid}</td>
          <td class="number-warn">${item.discarded}</td>
          <td>${formatPercent(rate)}</td>
          <td>${item.origins.Instagram || 0}</td>
          <td>${item.origins.Tráfego || 0}</td>
          <td>${item.origins['Sem origem'] || 0}</td>
          <td>${topEntry(item.funnel)}</td>
        </tr>
      `;
    })
    .join('');
}

loadData().then((data) => {
  const totals = calculate(data);
  renderKpis(data, totals);
  renderPhrases(data);
  renderOrigins(totals);
  renderFunnel(totals);
  renderInsights(totals);
  renderDiagnostic(data, totals);
  renderStrategicActions(data, totals);
  renderQuality(data);
  renderTable(data);
});
