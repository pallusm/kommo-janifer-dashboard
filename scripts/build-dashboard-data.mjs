import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const STORE_PATH = resolve(process.cwd(), 'data', 'store.json');
const DASHBOARD_DATA_PATH = resolve(process.cwd(), 'docs', 'data.json');
const SITE_DATA_PATH = resolve(process.cwd(), 'site', 'data.json');

const PHRASES = [
  {
    key: 'acompanhamento',
    label: 'Olá, gostaria de saber mais sobre o acompanhamento com a Dra. Janifer'
  },
  {
    key: 'agendamento',
    label: 'Olá, gostaria de informações sobre agendamento com a Dra. Janifer.'
  }
];

function emptyPhrase(phrase) {
  return {
    ...phrase,
    valid: 0,
    discarded: 0,
    origins: {}
  };
}

function formatDateTime(date) {
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'America/Sao_Paulo'
  }).format(date);
}

if (!existsSync(STORE_PATH)) {
  console.error(`Store local nao encontrado: ${STORE_PATH}`);
  console.error('Rode npm run import:scan depois de colar resultados em imports/scan-results.json.');
  process.exit(1);
}

const store = JSON.parse(readFileSync(STORE_PATH, 'utf8'));
const phraseMap = new Map(PHRASES.map((phrase) => [phrase.label, emptyPhrase(phrase)]));

for (const record of store.records || []) {
  const phrase = phraseMap.get(record.frase_esperada) || phraseMap.get(record.frase_detectada);

  if (!phrase) {
    continue;
  }

  if (record.valido) {
    phrase.valid += 1;
    const origin = record.origem || 'Sem origem';
    phrase.origins[origin] = (phrase.origins[origin] || 0) + 1;
  } else {
    phrase.discarded += 1;
  }
}

const data = {
  period: '07/05/2026 a 22/05/2026',
  updatedAt: formatDateTime(new Date(store.updated_at || Date.now())),
  phrases: [...phraseMap.values()]
};

writeFileSync(DASHBOARD_DATA_PATH, JSON.stringify(data, null, 2));
writeFileSync(SITE_DATA_PATH, JSON.stringify(data, null, 2));

console.log(JSON.stringify({
  output: DASHBOARD_DATA_PATH,
  mirror: SITE_DATA_PATH,
  phrases: data.phrases.map((phrase) => ({
    key: phrase.key,
    valid: phrase.valid,
    discarded: phrase.discarded,
    origins: phrase.origins
  }))
}, null, 2));
