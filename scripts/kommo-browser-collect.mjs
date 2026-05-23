import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { buildDashboardData, importRecords, PHRASES, writeDashboardData } from './store-utils.mjs';
import { loadPlaywright } from './playwright-loader.mjs';

const KOMMO_BASE_URL = process.env.KOMMO_BASE_URL || 'https://institutotrizi.kommo.com';
const PROFILE_DIR = resolve(process.cwd(), '.auth', 'kommo-browser-profile');
const LIMIT = Number(process.env.KOMMO_COLLECT_LIMIT || 25);
const HEADLESS = process.env.KOMMO_HEADLESS === '1';
const AUTO_PUBLISH = process.env.KOMMO_COLLECTOR_AUTO_PUBLISH === '1';

const { chromium } = loadPlaywright();

mkdirSync(PROFILE_DIR, { recursive: true });

const context = await chromium.launchPersistentContext(PROFILE_DIR, {
  headless: HEADLESS,
  viewport: { width: 1440, height: 900 },
  slowMo: HEADLESS ? 0 : 60,
  args: ['--disable-crash-reporter', '--disable-crashpad']
});

const page = context.pages()[0] || await context.newPage();

function phraseSearchText(phrase) {
  if (phrase.key === 'acompanhamento') return 'acompanhamento com a Dra. Janifer';
  if (phrase.key === 'agendamento') return 'informações sobre agendamento com a Dra. Janifer';
  return phrase.label;
}

async function waitForKommo() {
  await page.goto(`${KOMMO_BASE_URL}/chats/`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);

  const url = page.url();
  if (!url.includes('kommo.com')) {
    throw new Error('Nao foi possivel abrir a Kommo. Rode npm run kommo:auth primeiro.');
  }
}

async function searchChats(query) {
  const searchInput = page.locator([
    '.search-container__input.js-inbox-search:visible:not([disabled])',
    'input[placeholder*="Buscar"]:visible:not([disabled])',
    'input[type="search"]:visible:not([disabled])',
    'input[type="text"]:visible:not([disabled])',
    'textarea:visible:not([disabled])'
  ].join(', ')).first();

  await searchInput.waitFor({ state: 'visible', timeout: 30000 });
  await searchInput.click();
  await page.keyboard.press('Meta+A').catch(() => {});
  await page.keyboard.press('Control+A').catch(() => {});
  await searchInput.fill(query, { timeout: 30000 });
  await page.waitForTimeout(3500);
}

async function getResultIds() {
  return page.evaluate((limit) => {
    const textOf = (element) => String(element?.innerText || element?.textContent || '').replace(/\s+/g, ' ').trim();
    const items = [...document.querySelectorAll('.notification-inner')]
      .map((element) => {
        const text = textOf(element);
        const conversa = text.match(/A\d+/)?.[0] || element.id?.match(/\d+/)?.[0] || element.dataset.id || '';
        const dataId = element.dataset.id || conversa || text.slice(0, 80);

        return { dataId, conversa, text };
      })
      .filter((item) => item.conversa && item.text);
    const seen = new Set();

    return items
      .filter((item) => {
        const key = item.dataId || item.conversa;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, limit)
      .map((item) => item.dataId);
  }, LIMIT);
}

async function clickResult(dataId) {
  return page.evaluate((targetDataId) => {
    const textOf = (element) => String(element?.innerText || element?.textContent || '').replace(/\s+/g, ' ').trim();
    const items = [...document.querySelectorAll('.notification-inner')].map((element) => {
      const text = textOf(element);
      const conversa = text.match(/A\d+/)?.[0] || element.id?.match(/\d+/)?.[0] || element.dataset.id || '';
      const dataId = element.dataset.id || conversa || text.slice(0, 80);
      const link = element.querySelector('.js-navigate-link') || element;

      return { dataId, conversa, link };
    });
    const item = items.find((candidate) => candidate.dataId === targetDataId);

    if (!item) return null;
    item.link.click();
    return item.conversa;
  }, dataId);
}

async function scanOpenConversation(expectedPhrase) {
  return page.evaluate(({ expectedPhraseLabel, phraseKey, phrases }) => {
    const START_DATE = new Date(2026, 4, 7, 0, 0, 0);
    const END_DATE = new Date(2026, 4, 22, 23, 59, 59);
    const textOf = (element) => String(element?.innerText || element?.textContent || '').replace(/\s+/g, ' ').trim();
    const normalize = (value) =>
      String(value || '').normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/\s+/g, ' ').trim().toLowerCase();
    const parseKommoDate = (value) => {
      const match = String(value || '').match(/(Hoje|Ontem|\d{2}\/\d{2}\/\d{4})\s+(\d{2}):(\d{2})/);
      if (!match) return null;
      const [, day, hour, minute] = match;
      if (day === 'Hoje') return new Date(2026, 4, 22, Number(hour), Number(minute), 0);
      if (day === 'Ontem') return new Date(2026, 4, 21, Number(hour), Number(minute), 0);
      const [dd, mm, yyyy] = day.split('/').map(Number);
      return new Date(yyyy, mm - 1, dd, Number(hour), Number(minute), 0);
    };
    const inPeriod = (dateText) => {
      const parsed = parseKommoDate(dateText);
      return parsed && parsed >= START_DATE && parsed <= END_DATE;
    };
    const findPhrase = (text) => {
      const normalizedText = normalize(text);
      const phrase = phrases.find((item) => normalizedText.startsWith(normalize(item.label)));
      return phrase?.label || '';
    };
    const lead = location.href.match(/detail\/(\d+)/)?.[1] || document.body.innerText.match(/Lead #(\d+)/)?.[1] || '';
    const rawOrigem = textOf(document.querySelector('[data-id="86758"]')).replace(/^Origem\s*/i, '').trim();
    const origem = rawOrigem && rawOrigem !== 'Selecione' ? rawOrigem : '';
    const leadName = textOf(document.querySelector('.card-top-name, .linked-form__cf, .card-entity-form__top-name')).replace(/Lead #\d+/g, '').trim();
    const stageText = [...document.querySelectorAll('.pipeline-select, .card-entity-form__fields, .card-fields__fields-block, .card-holder__fields')]
      .map(textOf)
      .find((text) => /Etapa|Venda perdida|Conversa Finalizada|Oportunidade|Agendado|Pagamento|Reagendamento/i.test(text)) || '';
    const stageMatch = stageText.match(/(ETapa\d+\s*-\s*[^#\n]+|Etapa\s*\d+[^#\n]+|Venda perdida[:\s][^#\n]+|Conversa Finalizada|Oportunidade|Agendado|Confirmação de Pagamento|Reagendamento)/i);
    const funilEtapa = stageMatch?.[1]?.replace(/\s+/g, ' ').trim() || '';
    const messages = [...document.querySelectorAll('.feed-note-incoming')]
      .map((note) => {
        const noteText = textOf(note);
        const date = noteText.match(/(?:Hoje|Ontem|\d{2}\/\d{2}\/\d{4})\s+\d{2}:\d{2}/)?.[0] || '';
        const sender = textOf(note.querySelector('.feed-note__amojo-user')) || '';
        const message = textOf(note.querySelector('.feed-note__message_paragraph')) || textOf(note.querySelector('.feed-note__message-text')) || '';
        const conversa = textOf(note.querySelector('.feed-note__talk-outgoing-title')) || noteText.match(/Conversa\s+№\s*(A\d+)/i)?.[0] || '';
        const conversaId = conversa.match(/A\d+/)?.[0] || null;
        const phrase = findPhrase(message);

        return { date, sender, text: message, conversa: conversaId, phrase, in_period: inPeriod(date) };
      })
      .filter((message) => message.text);
    const firstIncomingMessage = messages.find((message) => message.in_period && message.phrase) || null;

    return {
      rodada: phraseKey,
      frase_esperada: expectedPhraseLabel,
      lead,
      conversa: firstIncomingMessage?.conversa || messages[0]?.conversa || '',
      lead_nome: leadName,
      origem,
      data: firstIncomingMessage?.date || '',
      remetente: firstIncomingMessage?.sender || '',
      primeira_mensagem: firstIncomingMessage?.text || '',
      frase_detectada: firstIncomingMessage?.phrase || '',
      funil_etapa: funilEtapa,
      valido: firstIncomingMessage?.phrase === expectedPhraseLabel
    };
  }, {
    expectedPhraseLabel: expectedPhrase.label,
    phraseKey: expectedPhrase.key,
    phrases: PHRASES
  });
}

const allResults = [];

try {
  await waitForKommo();

  for (const phrase of PHRASES) {
    const query = phraseSearchText(phrase);
    console.log(`Buscando: ${query}`);
    await searchChats(query);
    const resultIds = await getResultIds();
    const phraseResults = [];
    const seenResults = new Set();

    console.log(`Resultados planejados para ${phrase.key}: ${resultIds.length}`);

    for (const [index, dataId] of resultIds.entries()) {
      const conversa = await clickResult(dataId);
      if (!conversa) {
        console.log(`Resultado ${index + 1}/${resultIds.length} nao encontrado depois da navegacao.`);
        continue;
      }

      console.log(`Abrindo ${phrase.key} ${index + 1}/${resultIds.length}: ${conversa}`);
      await page.waitForTimeout(3500);

      const scanned = await scanOpenConversation(phrase);
      const key = `${scanned.lead || ''}-${scanned.conversa || ''}-${scanned.data || ''}-${scanned.primeira_mensagem || ''}`;

      if (!seenResults.has(key)) {
        seenResults.add(key);
        phraseResults.push(scanned);
        allResults.push(scanned);
      }
    }

    console.table(phraseResults.map((record) => ({
      lead: record.lead,
      conversa: record.conversa,
      origem: record.origem,
      funil: record.funil_etapa,
      data: record.data,
      valido: record.valido
    })));
  }

  const importSummary = importRecords(allResults);
  const dashboard = buildDashboardData();
  writeDashboardData(dashboard);

  console.log(JSON.stringify({
    ok: true,
    import: importSummary,
    validos: allResults.filter((record) => record.valido).length,
    descartados: allResults.filter((record) => !record.valido).length
  }, null, 2));

  if (AUTO_PUBLISH) {
    console.log('Publicacao automatica fica disponivel no proximo passo controlado.');
  }
} finally {
  await context.close();
}
