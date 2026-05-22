import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { importRecords, readJson, STORE_PATH } from './store-utils.mjs';

const IMPORT_PATH = resolve(process.cwd(), 'imports', 'scan-results.json');

if (!existsSync(IMPORT_PATH)) {
  console.error(`Arquivo de importacao nao encontrado: ${IMPORT_PATH}`);
  console.error('Cole o JSON copiado do scanner em imports/scan-results.json e rode novamente.');
  process.exit(1);
}

const incoming = readJson(IMPORT_PATH, []);
const records = Array.isArray(incoming) ? incoming : incoming.records || [];
const summary = importRecords(records);

console.log(JSON.stringify({
  ...summary,
  store: STORE_PATH
}, null, 2));
