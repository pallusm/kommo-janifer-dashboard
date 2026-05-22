import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { readStore, writeJson, writeStore } from './store-utils.mjs';
import { loadPlaywright } from './playwright-loader.mjs';

const KOMMO_BASE_URL = process.env.KOMMO_BASE_URL || 'https://institutotrizi.kommo.com';
const PROFILE_DIR = resolve(process.cwd(), '.auth', 'kommo-browser-profile');
const SNAPSHOT_PATH = resolve(process.cwd(), 'data', 'leads-board-snapshot.json');
const HEADLESS = process.env.KOMMO_HEADLESS === '1';

const { chromium } = loadPlaywright();

mkdirSync(PROFILE_DIR, { recursive: true });

const context = await chromium.launchPersistentContext(PROFILE_DIR, {
  headless: HEADLESS,
  viewport: { width: 1920, height: 1080 },
  slowMo: HEADLESS ? 0 : 60
});

const page = context.pages()[0] || await context.newPage();

try {
  await page.goto(`${KOMMO_BASE_URL}/leads/`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(4000);

  const snapshot = await page.evaluate(() => {
    const textOf = (element) => String(element?.innerText || element?.textContent || '').replace(/\s+/g, ' ').trim();
    const visible = (element) => {
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
    };
    const columnHeadings = [...document.querySelectorAll('body *')]
      .filter(visible)
      .map((element) => {
        const text = textOf(element);
        const rect = element.getBoundingClientRect();
        return { text, left: rect.left, right: rect.right, top: rect.top, width: rect.width };
      })
      .filter((item) => /ETAPA|OPORTUNIDADE|AGENDADO|PAGAMENTO|REAGENDAMENTO|VENDA/i.test(item.text))
      .filter((item) => item.width > 120 && item.top < 220)
      .sort((a, b) => a.left - b.left);
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
      .filter((item) => item.lead && item.width > 120)
      .map((card) => {
        const heading = columnHeadings
          .filter((item) => card.left >= item.left - 20)
          .sort((a, b) => b.left - a.left)[0] || columnHeadings[0];
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
      columns: columnHeadings.map((item) => item.text),
      leads: [...byLead.values()]
    };
  });

  writeJson(SNAPSHOT_PATH, snapshot);

  const byLead = new Map(snapshot.leads.map((lead) => [String(lead.lead), lead]));
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
    leads_visible_on_board: snapshot.leads.length,
    records_enriched: updated
  }, null, 2));
} finally {
  await context.close();
}
