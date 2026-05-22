import { createServer } from 'node:http';
import { execFileSync } from 'node:child_process';
import {
  buildDashboardData,
  importRecords,
  STORE_PATH,
  writeDashboardData
} from './store-utils.mjs';

const PORT = Number(process.env.KOMMO_COLLECTOR_PORT || 8789);
const AUTO_PUBLISH = process.env.KOMMO_COLLECTOR_AUTO_PUBLISH === '1';

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
      writeDashboardData(dashboard);
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
