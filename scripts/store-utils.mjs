import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

export const STORE_PATH = resolve(process.cwd(), 'data', 'store.json');
export const DASHBOARD_DATA_PATH = resolve(process.cwd(), 'docs', 'data.json');
export const SITE_DATA_PATH = resolve(process.cwd(), 'site', 'data.json');

export const PHRASES = [
  {
    key: 'acompanhamento',
    label: 'Olá, gostaria de saber mais sobre o acompanhamento com a Dra. Janifer'
  },
  {
    key: 'agendamento',
    label: 'Olá, gostaria de informações sobre agendamento com a Dra. Janifer.'
  }
];

export function readJson(path, fallback) {
  if (!existsSync(path)) {
    return fallback;
  }

  return JSON.parse(readFileSync(path, 'utf8'));
}

export function writeJson(path, value) {
  mkdirSync(resolve(path, '..'), { recursive: true });
  writeFileSync(path, JSON.stringify(value, null, 2));
}

export function normalizeRecord(record) {
  return {
    rodada: record.rodada || '',
    frase_esperada: record.frase_esperada || '',
    lead: String(record.lead || ''),
    conversa: String(record.conversa || ''),
    lead_nome: record.lead_nome || '',
    origem: record.origem || '',
    data: record.data || '',
    remetente: record.remetente || '',
    primeira_mensagem: record.primeira_mensagem || '',
    frase_detectada: record.frase_detectada || '',
    funil_pipeline: record.funil_pipeline || '',
    funil_etapa: record.funil_etapa || '',
    funil_valor: record.funil_valor || '',
    status_comercial: record.status_comercial || '',
    motivo_conversao: record.motivo_conversao || '',
    motivo_nao_conversao: record.motivo_nao_conversao || '',
    relato_anonimizado: record.relato_anonimizado || '',
    valido: Boolean(record.valido)
  };
}

export function recordKey(record) {
  return [
    record.rodada,
    record.lead,
    record.conversa,
    record.data,
    record.frase_detectada
  ].join('|');
}

export function readStore() {
  return readJson(STORE_PATH, {
    version: 1,
    updated_at: null,
    records: []
  });
}

export function writeStore(store) {
  writeJson(STORE_PATH, {
    ...store,
    updated_at: new Date().toISOString()
  });
}

export function importRecords(records) {
  const incomingRecords = records
    .map(normalizeRecord)
    .filter((record) => record.lead || record.conversa || record.primeira_mensagem);
  const store = readStore();
  const byKey = new Map(store.records.map((record) => [recordKey(record), normalizeRecord(record)]));
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
    records: [...byKey.values()]
  };

  writeStore(nextStore);

  return {
    imported: incomingRecords.length,
    added,
    updated,
    total_records: nextStore.records.length
  };
}

export function formatDateTime(date) {
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'America/Sao_Paulo'
  }).format(date);
}

function emptyPhrase(phrase) {
  return {
    ...phrase,
    valid: 0,
    discarded: 0,
    origins: {},
    funnel: {}
  };
}

function addCount(target, key) {
  const normalizedKey = key || 'Sem informacao';
  target[normalizedKey] = (target[normalizedKey] || 0) + 1;
}

export function buildDashboardData() {
  const store = readStore();
  const phraseMap = new Map(PHRASES.map((phrase) => [phrase.label, emptyPhrase(phrase)]));
  const funnel = {};
  const commercialStatus = {};
  const quality = {
    conversionReasons: {},
    lossReasons: {},
    anonymizedReports: []
  };

  for (const rawRecord of store.records || []) {
    const record = normalizeRecord(rawRecord);
    const phrase = phraseMap.get(record.frase_esperada) || phraseMap.get(record.frase_detectada);

    if (!phrase) {
      continue;
    }

    if (record.valido) {
      phrase.valid += 1;
      addCount(phrase.origins, record.origem || 'Sem origem');
      addCount(phrase.funnel, record.funil_etapa || 'Sem etapa');
      addCount(funnel, record.funil_etapa || 'Sem etapa');

      if (record.status_comercial) {
        addCount(commercialStatus, record.status_comercial);
      }

      if (record.motivo_conversao) {
        addCount(quality.conversionReasons, record.motivo_conversao);
      }

      if (record.motivo_nao_conversao) {
        addCount(quality.lossReasons, record.motivo_nao_conversao);
      }

      if (record.relato_anonimizado) {
        quality.anonymizedReports.push({
          phrase: phrase.key,
          origin: record.origem || 'Sem origem',
          funnelStage: record.funil_etapa || 'Sem etapa',
          text: record.relato_anonimizado
        });
      }
    } else {
      phrase.discarded += 1;
    }
  }

  return {
    period: '07/05/2026 a 22/05/2026',
    updatedAt: formatDateTime(new Date(store.updated_at || Date.now())),
    phrases: [...phraseMap.values()],
    funnel,
    commercialStatus,
    quality
  };
}

export function writeDashboardData(data) {
  writeJson(DASHBOARD_DATA_PATH, data);
  writeJson(SITE_DATA_PATH, data);
}
