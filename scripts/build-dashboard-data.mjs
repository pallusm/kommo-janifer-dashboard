import { existsSync } from 'node:fs';
import {
  buildDashboardData,
  DASHBOARD_DATA_PATH,
  SITE_DATA_PATH,
  STORE_PATH,
  writeDashboardData
} from './store-utils.mjs';

if (!existsSync(STORE_PATH)) {
  console.error(`Store local nao encontrado: ${STORE_PATH}`);
  console.error('Rode npm run import:scan depois de colar resultados em imports/scan-results.json.');
  process.exit(1);
}

const data = buildDashboardData();
writeDashboardData(data);

console.log(JSON.stringify({
  output: DASHBOARD_DATA_PATH,
  mirror: SITE_DATA_PATH,
  phrases: data.phrases.map((phrase) => ({
    key: phrase.key,
    valid: phrase.valid,
    discarded: phrase.discarded,
    origins: phrase.origins,
    funnel: phrase.funnel
  })),
  funnel: data.funnel,
  commercialStatus: data.commercialStatus
}, null, 2));
