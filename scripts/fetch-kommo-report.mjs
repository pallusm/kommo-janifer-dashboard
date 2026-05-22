import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadEnv } from './env.mjs';
import { createKommoClient } from './kommo-client.mjs';

const PHRASES = [
  'Olá, gostaria de saber mais sobre o acompanhamento com a Dra. Janifer',
  'Olá',
  'Olá, gostaria de informações sobre agendamento com a Dra. Janifer.'
];

const ORIGIN_KEYWORDS = {
  instagram: ['instagram', 'insta', 'ig'],
  trafego: ['trafego', 'tráfego', 'utm', 'facebook ads', 'meta ads', 'google ads', 'anuncio', 'anúncio']
};

loadEnv();

const daysBack = Number(process.env.KOMMO_DAYS_BACK || 15);
const maxLeads = Number(process.env.KOMMO_MAX_LEADS || 50);
const fromDate = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000);
const fromTimestamp = Math.floor(fromDate.getTime() / 1000);
const kommo = createKommoClient();

function normalize(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
}

function collectText(value, output = []) {
  if (value === null || value === undefined) {
    return output;
  }

  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    output.push(String(value));
    return output;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      collectText(item, output);
    }
    return output;
  }

  if (typeof value === 'object') {
    for (const item of Object.values(value)) {
      collectText(item, output);
    }
  }

  return output;
}

function findPhrases(text) {
  const normalized = normalize(text);

  return PHRASES.filter((phrase) => normalized.includes(normalize(phrase)));
}

function getCustomFieldValues(lead, fieldName) {
  const field = (lead.custom_fields_values || []).find((item) => item.field_name === fieldName);

  return (field?.values || []).map((item) => item.value);
}

function findOrigins(lead) {
  const originValues = getCustomFieldValues(lead, 'Origem').map(String);
  const tagValues = (lead._embedded?.tags || []).map((tag) => tag.name);
  const sourceText = [...originValues, ...tagValues].join('\n');
  const normalized = normalize(sourceText);

  return Object.fromEntries(
    Object.entries(ORIGIN_KEYWORDS).map(([origin, keywords]) => [
      origin,
      keywords.some((keyword) => normalized.includes(normalize(keyword)))
    ])
  );
}

async function getLeadNotes(leadId) {
  try {
    return await kommo.getAll(`/api/v4/leads/${leadId}/notes`);
  } catch (error) {
    return [{
      error: error.message
    }];
  }
}

const account = await kommo.get('/api/v4/account');
const pipelines = await kommo.getAll('/api/v4/leads/pipelines');
const pipelineById = new Map(pipelines.map((pipeline) => [pipeline.id, pipeline]));
let allLeads = [];

if (maxLeads > 0) {
  const leadPage = await kommo.get('/api/v4/leads', {
    'filter[updated_at][from]': fromTimestamp,
    with: 'contacts',
    limit: maxLeads,
    page: 1
  });
  allLeads = leadPage?._embedded?.leads || [];
} else {
  allLeads = await kommo.getAll('/api/v4/leads', {
    'filter[updated_at][from]': fromTimestamp,
    with: 'contacts'
  });
}

const leads = allLeads;

const enrichedLeads = [];

for (const [index, lead] of leads.entries()) {
  console.error(`Lendo notas do lead ${index + 1}/${leads.length}: ${lead.id}`);
  const notes = await getLeadNotes(lead.id);
  const searchableText = collectText({ lead, notes }).join('\n');
  const matchedPhrases = findPhrases(searchableText);
  const origins = findOrigins(lead);
  const originField = getCustomFieldValues(lead, 'Origem');
  const campaignField = getCustomFieldValues(lead, 'Campanha');
  const pipeline = pipelineById.get(lead.pipeline_id);

  enrichedLeads.push({
    id: lead.id,
    name: lead.name,
    price: lead.price,
    status_id: lead.status_id,
    pipeline_id: lead.pipeline_id,
    pipeline_name: pipeline?.name,
    created_at: lead.created_at,
    updated_at: lead.updated_at,
    responsible_user_id: lead.responsible_user_id,
    origin_field: originField,
    campaign_field: campaignField,
    matched_phrases: matchedPhrases,
    origins,
    tags: lead._embedded?.tags || [],
    notes_count: notes.filter((note) => !note.error).length,
    notes_errors: notes.filter((note) => note.error)
  });
}

const summary = {
  total_leads: enrichedLeads.length,
  leads_with_any_phrase: enrichedLeads.filter((lead) => lead.matched_phrases.length > 0).length,
  by_phrase: Object.fromEntries(
    PHRASES.map((phrase) => [
      phrase,
      enrichedLeads.filter((lead) => lead.matched_phrases.includes(phrase)).length
    ])
  ),
  by_origin: Object.fromEntries(
    Object.keys(ORIGIN_KEYWORDS).map((origin) => [
      origin,
      enrichedLeads.filter((lead) => lead.origins[origin]).length
    ])
  )
};

const report = {
  generated_at: new Date().toISOString(),
  account: {
    id: account.id,
    name: account.name,
    subdomain: account.subdomain,
    language: account.language,
    currency: account.currency
  },
  period: {
    days_back: daysBack,
    from: fromDate.toISOString(),
    total_leads_found_before_limit: allLeads.length,
    max_leads_processed: maxLeads
  },
  summary,
  leads: enrichedLeads
};

mkdirSync(resolve(process.cwd(), 'data'), { recursive: true });
writeFileSync(
  resolve(process.cwd(), 'data', 'kommo-report.json'),
  JSON.stringify(report, null, 2)
);

console.log(JSON.stringify(summary, null, 2));
