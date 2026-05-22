import { loadEnv } from './env.mjs';
import { createKommoClient } from './kommo-client.mjs';

loadEnv();

const kommo = createKommoClient();
const account = await kommo.get('/api/v4/account');

console.log(JSON.stringify({
  name: account.name,
  id: account.id,
  subdomain: account.subdomain,
  country: account.country,
  currency: account.currency,
  language: account.language
}, null, 2));
