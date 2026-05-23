import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadPlaywright } from './playwright-loader.mjs';

const KOMMO_URL = process.env.KOMMO_URL || 'https://institutotrizi.kommo.com/';
const PROFILE_DIR = resolve(process.cwd(), '.auth', 'kommo-browser-profile');
const TIMEOUT_MS = Number(process.env.KOMMO_AUTH_TIMEOUT_MS || 10 * 60 * 1000);

const { chromium } = loadPlaywright();

mkdirSync(PROFILE_DIR, { recursive: true });

const context = await chromium.launchPersistentContext(PROFILE_DIR, {
  headless: false,
  viewport: { width: 1440, height: 900 },
  slowMo: 40,
  args: ['--disable-crash-reporter', '--disable-crashpad']
});

const page = context.pages()[0] || await context.newPage();
await page.goto(KOMMO_URL, { waitUntil: 'domcontentloaded' });

console.log('Navegador aberto para autenticar a Kommo.');
console.log('Faca login manualmente. Nenhuma senha sera salva no projeto.');
console.log('A sessao local sera salva em .auth/, que nao sobe para o Git.');

const startedAt = Date.now();

while (Date.now() - startedAt < TIMEOUT_MS) {
  await page.waitForTimeout(2000);

  const isInsideKommo = await page.evaluate(() => {
    const text = document.body?.innerText || '';
    return Boolean(
      document.querySelector('.nav__menu, .left-menu, a[href*="/chats"], a[href*="/leads"]') ||
      /Leads|Chats|Painel|Configurações/i.test(text)
    );
  }).catch(() => false);

  if (isInsideKommo && page.url().includes('institutotrizi.kommo.com')) {
    await page.goto(KOMMO_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    await context.close();
    console.log('Sessao local salva com sucesso.');
    process.exit(0);
  }
}

await context.close();
throw new Error('Tempo esgotado para autenticar. Abra novamente e tente fazer login antes do limite.');
