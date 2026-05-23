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
    classifiedOrigins: {},
    intentMatches: {},
    funnel: {}
  };
}

function addCount(target, key) {
  const normalizedKey = key || 'Sem informacao';
  target[normalizedKey] = (target[normalizedKey] || 0) + 1;
}

export function classifyOrigin(origin) {
  const raw = String(origin || '').trim();
  const normalized = raw
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

  if (!normalized || normalized === 'selecione' || normalized === 'sem origem') {
    return {
      origin: 'Sem origem confiável',
      detectedBy: 'Nenhum campo confiável',
      confidence: 'Sem confiança'
    };
  }

  if (/trafego|tráfego|meta|ads|anuncio|anúncio|campanha|paid|cpc|facebook/.test(normalized)) {
    return {
      origin: 'Tráfego pago',
      detectedBy: 'Campo Origem do Kommo',
      confidence: 'Média'
    };
  }

  if (/instagram|direct|ig/.test(normalized)) {
    return {
      origin: 'Instagram',
      detectedBy: 'Campo Origem do Kommo',
      confidence: 'Média'
    };
  }

  return {
    origin: raw,
    detectedBy: 'Campo Origem do Kommo',
    confidence: 'Baixa'
  };
}

export function classifyIntent(record) {
  if (record.valido && record.frase_detectada && record.frase_detectada === record.frase_esperada) {
    return 'Match exato';
  }

  if (record.frase_detectada) {
    return 'Match forte';
  }

  return record.valido ? 'Match não classificado' : 'Descartado';
}

export function buildDashboardData() {
  const store = readStore();
  const phraseMap = new Map(PHRASES.map((phrase) => [phrase.label, emptyPhrase(phrase)]));
  const funnel = {};
  const commercialStatus = {};
  const classifiedOrigins = {};
  const originConfidence = {};
  const intentMatches = {};
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
      const originClassification = classifyOrigin(record.origem);
      const intentMatch = classifyIntent(record);

      phrase.valid += 1;
      addCount(phrase.origins, record.origem || 'Sem origem');
      addCount(phrase.classifiedOrigins || (phrase.classifiedOrigins = {}), originClassification.origin);
      addCount(phrase.intentMatches || (phrase.intentMatches = {}), intentMatch);
      addCount(phrase.funnel, record.funil_etapa || 'Sem etapa');
      addCount(classifiedOrigins, originClassification.origin);
      addCount(originConfidence, originClassification.confidence);
      addCount(intentMatches, intentMatch);
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
    criteria: {
      periodType: 'Data da mensagem recebida',
      validLead: 'Primeira mensagem recebida no período começa com uma das duas frases monitoradas.',
      discardedLead: 'Resultado encontrado na busca, mas sem confirmação de primeira mensagem válida no período.',
      originSources: ['Campo Origem do Kommo', 'Leitura do board de Leads', 'Enriquecimento GET da API Kommo'],
      publicDataPolicy: 'GitHub Pages recebe apenas dados agregados; detalhes ficam no armazenamento local.'
    },
    phrases: [...phraseMap.values()],
    funnel,
    commercialStatus,
    classifiedOrigins,
    originConfidence,
    intentMatches,
    quality
  };
}

export function writeDashboardData(data) {
  writeJson(DASHBOARD_DATA_PATH, data);
  writeJson(SITE_DATA_PATH, data);
}
