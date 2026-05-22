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
      }
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
      }
    }
  ]
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

  return {
    valid,
    discarded,
    sample,
    validRate: sample ? (valid / sample) * 100 : 0,
    origins,
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

function renderInsights(totals) {
  const agendamentoShare = totals.valid ? (totals.topPhrase.valid / totals.valid) * 100 : 0;
  const noOriginShare = totals.valid ? ((totals.origins['Sem origem'] || 0) / totals.valid) * 100 : 0;
  const instagramShare = totals.valid ? ((totals.origins.Instagram || 0) / totals.valid) * 100 : 0;

  document.querySelector('#insights').innerHTML = `
    <article class="insight">
      <strong>Agendamento lidera a intenção capturada</strong>
      <p>A frase de maior volume representa ${formatPercent(agendamentoShare)} dos leads válidos da amostra.</p>
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
  renderInsights(totals);
  renderTable(data);
});
