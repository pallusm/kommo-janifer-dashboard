import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const STORE_PATH = resolve(process.cwd(), 'data', 'store.json');
const IMPORT_PATH = resolve(process.cwd(), 'imports', 'scan-results.json');

function readJson(path, fallback) {
  if (!existsSync(path)) {
    return fallback;
  }

  return JSON.parse(readFileSync(path, 'utf8'));
}

function normalizeRecord(record) {
  return {
    rodada: record.rodada || '',
    frase_esperada: record.frase_esperada || '',
    lead: String(record.lead || ''),
    conversa: String(record.conversa || ''),
    origem: record.origem || '',
    data: record.data || '',
    remetente: record.remetente || '',
    primeira_mensagem: record.primeira_mensagem || '',
    frase_detectada: record.frase_detectada || '',
    valido: Boolean(record.valido)
  };
}

function recordKey(record) {
  return [
    record.rodada,
    record.lead,
    record.conversa,
    record.data,
    record.frase_detectada
  ].join('|');
}

if (!existsSync(IMPORT_PATH)) {
  console.error(`Arquivo de importacao nao encontrado: ${IMPORT_PATH}`);
  console.error('Cole o JSON copiado do scanner em imports/scan-results.json e rode novamente.');
  process.exit(1);
}

const incoming = readJson(IMPORT_PATH, []);
const incomingRecords = (Array.isArray(incoming) ? incoming : incoming.records || [])
  .map(normalizeRecord)
  .filter((record) => record.lead || record.conversa || record.primeira_mensagem);

const store = readJson(STORE_PATH, {
  version: 1,
  updated_at: null,
  records: []
});
const byKey = new Map(store.records.map((record) => [recordKey(record), record]));
let added = 0;
let updated = 0;

for (const record of incomingRecords) {
  const key = recordKey(record);

  if (byKey.has(key)) {
    byKey.set(key, {
      ...byKey.get(key),
      ...record
    });
    updated += 1;
  } else {
    byKey.set(key, record);
    added += 1;
  }
}

const nextStore = {
  version: 1,
  updated_at: new Date().toISOString(),
  records: [...byKey.values()]
};

mkdirSync(resolve(process.cwd(), 'data'), { recursive: true });
writeFileSync(STORE_PATH, JSON.stringify(nextStore, null, 2));

console.log(JSON.stringify({
  imported: incomingRecords.length,
  added,
  updated,
  total_records: nextStore.records.length,
  store: STORE_PATH
}, null, 2));
