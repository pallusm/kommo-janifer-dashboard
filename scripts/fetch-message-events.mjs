import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadEnv } from './env.mjs';
import { createKommoClient } from './kommo-client.mjs';

loadEnv();

const daysBack = Number(process.env.KOMMO_DAYS_BACK || 15);
const pageLimit = Number(process.env.KOMMO_EVENTS_PAGE_LIMIT || 250);
const maxPages = Number(process.env.KOMMO_EVENTS_MAX_PAGES || 40);
const fromDate = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000);
const fromTimestamp = Math.floor(fromDate.getTime() / 1000);
const kommo = createKommoClient();

function originFromEvent(event) {
  const origin = event.value_after?.[0]?.message?.origin || '';

  if (origin.includes('instagram')) {
    return 'instagram';
  }

  if (origin.includes('wa') || origin.includes('whatsapp')) {
    return 'whatsapp';
  }

  return origin || 'unknown';
}

function messageMetaFromEvent(event) {
  const message = event.value_after?.[0]?.message || {};

  return {
    event_id: event.id,
    event_type: event.type,
    lead_id: event.entity_id,
    created_at: event.created_at,
    origin: originFromEvent(event),
    message_id: message.id,
    talk_id: message.talk_id,
    raw_origin: message.origin
  };
}

const events = [];
let page = 1;

while (page <= maxPages) {
  console.error(`Lendo eventos pagina ${page}/${maxPages}`);

  const response = await kommo.get('/api/v4/events', {
    'filter[created_at][from]': fromTimestamp,
    'filter[type][]': 'incoming_chat_message',
    limit: pageLimit,
    page
  });
  const pageEvents = response?._embedded?.events || [];

  events.push(...pageEvents.map(messageMetaFromEvent));

  if (!response?._links?.next?.href || pageEvents.length === 0) {
    break;
  }

  page += 1;
}

const uniqueLeads = new Set(events.map((event) => event.lead_id).filter(Boolean));
const uniqueTalks = new Set(events.map((event) => event.talk_id).filter(Boolean));
const uniqueMessages = new Set(events.map((event) => event.message_id).filter(Boolean));

const byOrigin = events.reduce((acc, event) => {
  acc[event.origin] = (acc[event.origin] || 0) + 1;
  return acc;
}, {});

const byLead = events.reduce((acc, event) => {
  const key = String(event.lead_id || 'unknown');
  acc[key] ||= {
    lead_id: event.lead_id,
    total_messages: 0,
    by_origin: {}
  };
  acc[key].total_messages += 1;
  acc[key].by_origin[event.origin] = (acc[key].by_origin[event.origin] || 0) + 1;
  return acc;
}, {});

const report = {
  generated_at: new Date().toISOString(),
  period: {
    days_back: daysBack,
    from: fromDate.toISOString()
  },
  summary: {
    total_incoming_message_events: events.length,
    unique_leads: uniqueLeads.size,
    unique_talks: uniqueTalks.size,
    unique_messages: uniqueMessages.size,
    by_origin: byOrigin,
    pages_read: page
  },
  leads: Object.values(byLead).sort((a, b) => b.total_messages - a.total_messages),
  events
};

mkdirSync(resolve(process.cwd(), 'data'), { recursive: true });
writeFileSync(
  resolve(process.cwd(), 'data', 'kommo-message-events.json'),
  JSON.stringify(report, null, 2)
);

console.log(JSON.stringify(report.summary, null, 2));
