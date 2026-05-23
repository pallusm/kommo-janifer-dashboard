import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { readStore, writeJson, writeStore } from './store-utils.mjs';
import { loadPlaywright } from './playwright-loader.mjs';

const KOMMO_BASE_URL = process.env.KOMMO_BASE_URL || 'https://institutotrizi.kommo.com';
const PROFILE_DIR = resolve(process.cwd(), '.auth', 'kommo-browser-profile');
const SNAPSHOT_PATH = resolve(process.cwd(), 'data', 'leads-board-snapshot.json');
const HEADLESS = process.env.KOMMO_HEADLESS === '1';
const HORIZONTAL_STEPS = Number(process.env.KOMMO_BOARD_HORIZONTAL_STEPS || 6);
const VERTICAL_STEPS = Number(process.env.KOMMO_BOARD_VERTICAL_STEPS || 8);

const { chromium } = loadPlaywright();

mkdirSync(PROFILE_DIR, { recursive: true });

const context = await chromium.launchPersistentContext(PROFILE_DIR, {
  headless: HEADLESS,
  viewport: { width: 1920, height: 1080 },
  slowMo: HEADLESS ? 0 : 60,
  args: ['--disable-crash-reporter', '--disable-crashpad']
});

const page = context.pages()[0] || await context.newPage();

async function scrollBoard() {
  await page.waitForTimeout(2500);

  for (let horizontalIndex = 0; horizontalIndex < HORIZONTAL_STEPS; horizontalIndex += 1) {
    await page.mouse.wheel(0, -10000);
    await page.waitForTimeout(700);

    for (let verticalIndex = 0; verticalIndex < VERTICAL_STEPS; verticalIndex += 1) {
      await page.mouse.wheel(0, 900);
      await page.waitForTimeout(700);
    }

    await page.mouse.wheel(900, -10000);
    await page.waitForTimeout(900);
  }

  await page.mouse.wheel(-10000, -10000);
  await page.waitForTimeout(1000);
}

function normalizeStageName(value) {
  const text = String(value || '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();

  if (/ETAPA\s*0?1|CONEXAO/.test(text)) return '1 - Conexão';
  if (/ETAPA\s*0?2|OPORTUNIDADE/.test(text)) return '2 - Oportunidade';
  if (/ETAPA\s*0?3|AGENDADO/.test(text)) return '3 - Agendado';
  if (/ETAPA\s*0?4|CONFIRMACAO DE PAGAMENTO|PAGAMENTO/.test(text)) return '4 - Confirmação de pagamento';
  if (/ETAPA\s*0?5|REAGENDAMENTO/.test(text)) return '5 - Reagendamento';
  return '';
}

try {
  await page.goto(`${KOMMO_BASE_URL}/leads/`, { waitUntil: 'domcontentloaded' });
  await scrollBoard();

  const snapshot = await page.evaluate(() => {
    const textOf = (element) => String(element?.innerText || element?.textContent || '').replace(/\s+/g, ' ').trim();
    const visible = (element) => {
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
    };
    const normalizeStage = (text) => {
      const normalized = String(text || '')
        .normalize('NFD')
        .replace(/\p{Diacritic}/gu, '')
        .replace(/\s+/g, ' ')
        .trim()
        .toUpperCase();

      if (/ETAPA\s*0?1|CONEXAO/.test(normalized)) return '1 - Conexão';
      if (/ETAPA\s*0?2|OPORTUNIDADE/.test(normalized)) return '2 - Oportunidade';
      if (/ETAPA\s*0?3|AGENDADO/.test(normalized)) return '3 - Agendado';
      if (/ETAPA\s*0?4|CONFIRMACAO DE PAGAMENTO|PAGAMENTO/.test(normalized)) return '4 - Confirmação de pagamento';
      if (/ETAPA\s*0?5|REAGENDAMENTO/.test(normalized)) return '5 - Reagendamento';
      return '';
    };
    const columnHeadings = [...document.querySelectorAll('body *')]
      .filter(visible)
      .map((element) => {
        const text = textOf(element);
        const rect = element.getBoundingClientRect();

        return {
          text: normalizeStage(text),
          rawText: text,
          left: rect.left,
          right: rect.right,
          top: rect.top,
          width: rect.width
        };
      })
      .filter((item) => item.text && !/Lead #\d+/.test(item.rawText))
      .filter((item) => item.width > 100 && item.width < 700 && item.top < 300)
      .sort((a, b) => a.left - b.left);
    const uniqueColumns = [];
    const seenColumns = new Set();

    for (const heading of columnHeadings) {
      const key = `${heading.text}-${Math.round(heading.left / 80)}`;

      if (!seenColumns.has(key)) {
        seenColumns.add(key);
        uniqueColumns.push(heading);
      }
    }

    const cards = [...document.querySelectorAll('body *')]
      .filter(visible)
      .map((element) => {
        const text = textOf(element);
        const rect = element.getBoundingClientRect();
        const lead = text.match(/Lead #(\d+)/)?.[1] || '';

        return {
          lead,
          text,
          left: rect.left,
          top: rect.top,
          width: rect.width
        };
      })
      .filter((item) => item.lead && item.width > 120 && item.width < 620 && item.text.length < 260)
      .map((card) => {
        const heading = uniqueColumns
          .filter((item) => card.left >= item.left - 40)
          .sort((a, b) => b.left - a.left)[0] || uniqueColumns[0];
        const name = card.text.split(/Lead #\d+/)[0].trim();
        const value = card.text.match(/R\$\s?[\d.,]+/)?.[0] || '';

        return {
          lead: card.lead,
          lead_nome: name,
          funil_etapa: heading?.text || '',
          funil_valor: value,
          raw: card.text
        };
      });
    const byLead = new Map();

    for (const card of cards) {
      if (!byLead.has(card.lead)) {
        byLead.set(card.lead, card);
      }
    }

    return {
      captured_at: new Date().toISOString(),
      url: location.href,
      columns: uniqueColumns.map((item) => item.text),
      leads: [...byLead.values()]
    };
  });

  const normalizedSnapshot = {
    ...snapshot,
    columns: [...new Set(snapshot.columns.map(normalizeStageName).filter(Boolean))],
    leads: snapshot.leads.map((lead) => ({
      ...lead,
      funil_etapa: normalizeStageName(lead.funil_etapa)
    })).filter((lead) => lead.funil_etapa)
  };

  writeJson(SNAPSHOT_PATH, normalizedSnapshot);

  const byLead = new Map(normalizedSnapshot.leads.map((lead) => [String(lead.lead), lead]));
  const store = readStore();
  let updated = 0;

  const records = store.records.map((record) => {
    const boardLead = byLead.get(String(record.lead));

    if (!boardLead) return record;
    updated += 1;

    return {
      ...record,
      lead_nome: record.lead_nome || boardLead.lead_nome,
      funil_etapa: boardLead.funil_etapa || record.funil_etapa,
      funil_valor: boardLead.funil_valor || record.funil_valor
    };
  });

  writeStore({
    ...store,
    records
  });

  console.log(JSON.stringify({
    ok: true,
    snapshot: SNAPSHOT_PATH,
    columns_seen: normalizedSnapshot.columns,
    leads_visible_on_board: normalizedSnapshot.leads.length,
    records_enriched: updated
  }, null, 2));
} finally {
  await context.close();
}
