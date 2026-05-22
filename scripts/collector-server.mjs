import { createServer } from 'node:http';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

const PORT = Number(process.env.KOMMO_COLLECTOR_PORT || 8789);
const AUTO_PUBLISH = process.env.KOMMO_COLLECTOR_AUTO_PUBLISH === '1';
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

function importRecords(records) {
  const incomingRecords = records
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

  return {
    imported: incomingRecords.length,
    added,
    updated,
    total_records: nextStore.records.length
  };
}

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

function buildDashboardData() {
  const store = readJson(STORE_PATH, {
    updated_at: new Date().toISOString(),
    records: []
  });
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

  return data;
}

function publishDashboard() {
  execFileSync('git', ['add', 'docs/data.json', 'site/data.json'], { stdio: 'inherit' });

  try {
    execFileSync('git', ['commit', '-m', 'Update dashboard data'], { stdio: 'inherit' });
  } catch {
    return {
      published: false,
      reason: 'Sem mudancas para publicar'
    };
  }

  execFileSync('git', ['push'], { stdio: 'inherit' });

  return {
    published: true
  };
}

function sendJson(response, statusCode, body) {
  response.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  });
  response.end(JSON.stringify(body, null, 2));
}

async function readBody(request) {
  const chunks = [];

  for await (const chunk of request) {
    chunks.push(chunk);
  }

  return Buffer.concat(chunks).toString('utf8');
}

const server = createServer(async (request, response) => {
  if (request.method === 'OPTIONS') {
    sendJson(response, 200, { ok: true });
    return;
  }

  if (request.method === 'GET' && request.url === '/health') {
    sendJson(response, 200, {
      ok: true,
      auto_publish: AUTO_PUBLISH,
      store: STORE_PATH
    });
    return;
  }

  if (request.method === 'POST' && request.url === '/import') {
    try {
      const body = JSON.parse(await readBody(request));
      const records = Array.isArray(body) ? body : body.records || [];
      const importSummary = importRecords(records);
      const dashboard = buildDashboardData();
      const publish = AUTO_PUBLISH ? publishDashboard() : { published: false, reason: 'AUTO_PUBLISH desativado' };

      sendJson(response, 200, {
        ok: true,
        import: importSummary,
        dashboard,
        publish
      });
    } catch (error) {
      sendJson(response, 500, {
        ok: false,
        error: error.message
      });
    }
    return;
  }

  sendJson(response, 404, {
    ok: false,
    error: 'Endpoint nao encontrado'
  });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Coletor local ativo em http://127.0.0.1:${PORT}`);
  console.log('Health check: http://127.0.0.1:' + PORT + '/health');
  console.log(`Publicacao automatica: ${AUTO_PUBLISH ? 'ativa' : 'desativada'}`);
});
