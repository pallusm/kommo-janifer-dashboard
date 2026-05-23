import { loadEnv } from './env.mjs';
import { createKommoClient } from './kommo-client.mjs';
import { buildDashboardData, readStore, writeDashboardData, writeStore } from './store-utils.mjs';

loadEnv();

const kommo = createKommoClient();
const ONLY_MISSING = process.env.KOMMO_ENRICH_ONLY_MISSING !== '0';
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function normalize(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

function normalizeStageName(statusName) {
  const text = normalize(statusName);

  if (/ETAPA\s*0?1|CONEXAO/.test(text)) return '1 - Conexão';
  if (/ETAPA\s*0?2|OPORTUNIDADE/.test(text)) return '2 - Oportunidade';
  if (/ETAPA\s*0?3|AGENDADO|CONSULTA AGENDADA/.test(text)) return '3 - Agendado';
  if (/ETAPA\s*0?4|CONFIRMACAO DE PAGAMENTO|PAGAMENTO/.test(text)) return '4 - Confirmação de pagamento';
  if (/ETAPA\s*0?5|REAGENDAMENTO|REAGENDAR/.test(text)) return '5 - Reagendamento';
  return '';
}

function commercialStatus(statusName) {
  const text = normalize(statusName);

  if (/VENDA GANHA/.test(text)) return 'Convertido';
  if (/VENDA PERDIDA/.test(text)) return 'Perdido';
  return '';
}

const pipelinesResponse = await kommo.get('/api/v4/leads/pipelines');
const pipelines = pipelinesResponse?._embedded?.pipelines || [];
const statusById = new Map();
const pipelineById = new Map();

for (const pipeline of pipelines) {
  pipelineById.set(Number(pipeline.id), pipeline);

  for (const status of pipeline._embedded?.statuses || []) {
    statusById.set(Number(status.id), {
      ...status,
      pipeline
    });
  }
}

const store = readStore();
const leadIds = [...new Set(
  store.records
    .filter((record) => record.valido)
    .filter((record) => !ONLY_MISSING || !record.funil_etapa || record.funil_etapa === 'Sem etapa')
    .map((record) => String(record.lead || '').trim())
    .filter(Boolean)
)];
const enrichment = new Map();
let fetched = 0;
let failed = 0;

for (const [index, leadId] of leadIds.entries()) {
  try {
    const lead = await kommo.get(`/api/v4/leads/${leadId}`);
    const pipeline = pipelineById.get(Number(lead.pipeline_id));
    const status = statusById.get(Number(lead.status_id));
    const statusName = status?.name || '';
    const pipelineName = pipeline?.name || status?.pipeline?.name || '';
    const stageName = normalizeStageName(statusName);

    enrichment.set(leadId, {
      lead_nome: lead.name || '',
      funil_pipeline: pipelineName,
      funil_etapa: stageName || statusName,
      funil_valor: lead.price ? `R$${Number(lead.price).toLocaleString('pt-BR')}` : '',
      status_comercial: commercialStatus(statusName),
      kommo_status_id: lead.status_id,
      kommo_pipeline_id: lead.pipeline_id
    });
    fetched += 1;
    console.log(`Lead ${index + 1}/${leadIds.length} lido: ${leadId}`);
    await sleep(180);
  } catch (error) {
    failed += 1;
    console.warn(`Falha ao ler lead ${leadId}: ${error.message}`);
  }
}

let recordsUpdated = 0;
const records = store.records.map((record) => {
  const data = enrichment.get(String(record.lead || ''));

  if (!data) return record;
  recordsUpdated += 1;

  return {
    ...record,
    lead_nome: record.lead_nome || data.lead_nome,
    funil_pipeline: data.funil_pipeline || record.funil_pipeline,
    funil_etapa: data.funil_etapa || record.funil_etapa,
    funil_valor: data.funil_valor || record.funil_valor,
    status_comercial: data.status_comercial || record.status_comercial,
    kommo_status_id: data.kommo_status_id,
    kommo_pipeline_id: data.kommo_pipeline_id
  };
});

writeStore({
  ...store,
  records
});

const dashboard = buildDashboardData();
writeDashboardData(dashboard);

console.log(JSON.stringify({
  ok: true,
  mode: ONLY_MISSING ? 'missing_only' : 'all_valid',
  unique_leads_requested: leadIds.length,
  fetched,
  failed,
  records_updated: recordsUpdated,
  funnel: dashboard.funnel,
  commercialStatus: dashboard.commercialStatus
}, null, 2));
