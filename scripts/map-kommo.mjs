import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadEnv } from './env.mjs';
import { createKommoClient } from './kommo-client.mjs';

loadEnv();

const kommo = createKommoClient();

async function tryGet(label, path, params = {}) {
  try {
    return {
      label,
      ok: true,
      data: await kommo.get(path, params)
    };
  } catch (error) {
    return {
      label,
      ok: false,
      error: error.message
    };
  }
}

function summarizeCustomFields(response) {
  const fields = response?.data?._embedded?.custom_fields || [];

  return fields.map((field) => ({
    id: field.id,
    name: field.name,
    code: field.code,
    type: field.type,
    sort: field.sort,
    enums: field.enums
  }));
}

function summarizePipelines(response) {
  const pipelines = response?.data?._embedded?.pipelines || [];

  return pipelines.map((pipeline) => ({
    id: pipeline.id,
    name: pipeline.name,
    sort: pipeline.sort,
    statuses: (pipeline._embedded?.statuses || []).map((status) => ({
      id: status.id,
      name: status.name,
      sort: status.sort,
      type: status.type
    }))
  }));
}

function summarizeTags(response) {
  const tags = response?.data?._embedded?.tags || [];

  return tags.map((tag) => ({
    id: tag.id,
    name: tag.name
  }));
}

function summarizeSources(response) {
  const embedded = response?.data?._embedded || {};
  const sources = embedded.sources || embedded.catalogs || [];

  return sources.map((source) => ({
    id: source.id,
    name: source.name,
    type: source.type,
    origin_code: source.origin_code,
    external_id: source.external_id
  }));
}

const results = await Promise.all([
  tryGet('account', '/api/v4/account'),
  tryGet('lead_custom_fields', '/api/v4/leads/custom_fields'),
  tryGet('contact_custom_fields', '/api/v4/contacts/custom_fields'),
  tryGet('company_custom_fields', '/api/v4/companies/custom_fields'),
  tryGet('pipelines', '/api/v4/leads/pipelines'),
  tryGet('lead_tags', '/api/v4/leads/tags'),
  tryGet('contact_tags', '/api/v4/contacts/tags'),
  tryGet('sources', '/api/v4/sources')
]);

const byLabel = Object.fromEntries(results.map((result) => [result.label, result]));

const map = {
  generated_at: new Date().toISOString(),
  account: byLabel.account.ok ? {
    id: byLabel.account.data.id,
    name: byLabel.account.data.name,
    subdomain: byLabel.account.data.subdomain,
    language: byLabel.account.data.language,
    currency: byLabel.account.data.currency
  } : byLabel.account,
  custom_fields: {
    leads: summarizeCustomFields(byLabel.lead_custom_fields),
    contacts: summarizeCustomFields(byLabel.contact_custom_fields),
    companies: summarizeCustomFields(byLabel.company_custom_fields)
  },
  pipelines: summarizePipelines(byLabel.pipelines),
  tags: {
    leads: summarizeTags(byLabel.lead_tags),
    contacts: summarizeTags(byLabel.contact_tags)
  },
  sources: summarizeSources(byLabel.sources),
  endpoint_status: Object.fromEntries(
    results.map((result) => [
      result.label,
      result.ok ? 'ok' : result.error
    ])
  )
};

mkdirSync(resolve(process.cwd(), 'data'), { recursive: true });
writeFileSync(resolve(process.cwd(), 'data', 'kommo-map.json'), JSON.stringify(map, null, 2));

console.log(JSON.stringify({
  account: map.account,
  lead_fields: map.custom_fields.leads.length,
  contact_fields: map.custom_fields.contacts.length,
  company_fields: map.custom_fields.companies.length,
  pipelines: map.pipelines.length,
  lead_tags: map.tags.leads.length,
  contact_tags: map.tags.contacts.length,
  sources: map.sources.length,
  endpoint_status: map.endpoint_status
}, null, 2));
