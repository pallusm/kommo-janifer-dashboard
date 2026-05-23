import { mkdirSync } from 'node:fs';
import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { resolve } from 'node:path';
import { loadPlaywright } from './playwright-loader.mjs';

const KOMMO_URL = process.env.KOMMO_URL || 'https://institutotrizi.kommo.com/';
const PROFILE_DIR = resolve(process.cwd(), '.auth', 'kommo-browser-profile');

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

console.log('');
console.log('Navegador de autenticacao aberto.');
console.log('Faca login manualmente no Kommo. A senha nao sera salva no projeto.');
console.log('Apenas a sessao local do navegador ficara em .auth/, que nao sobe para o Git.');
console.log('');

const rl = createInterface({ input, output });
await rl.question('Depois que a conta Kommo estiver aberta, pressione Enter aqui para salvar a sessao local...');
rl.close();

await page.goto(KOMMO_URL, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1500);
await context.close();

console.log('Sessao local salva com sucesso.');
