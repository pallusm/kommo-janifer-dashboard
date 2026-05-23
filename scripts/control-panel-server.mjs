import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';
import { readStore, STORE_PATH } from './store-utils.mjs';

const HOST = '127.0.0.1';
const PORT = Number(process.env.KOMMO_PANEL_PORT || 8790);
const ROOT = process.cwd();
const PANEL_DIR = resolve(ROOT, 'control-panel');
const DOCS_DIR = resolve(ROOT, 'docs');
const RUNTIME_HOME = resolve(ROOT, '.runtime-home');
const OPEN_ON_START = process.argv.includes('--open');
const PUBLIC_URL = 'https://pallusm.github.io/kommo-janifer-dashboard/';
const PUBLIC_ORIGIN = 'https://pallusm.github.io';

let currentJob = null;
let lastJob = null;

function json(res, statusCode, body) {
  res.writeHead(statusCode, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store'
  });
  res.end(JSON.stringify(body, null, 2));
}

function notFound(res) {
  json(res, 404, { ok: false, error: 'Nao encontrado' });
}

function sendFile(res, filePath) {
  if (!existsSync(filePath) || !statSync(filePath).isFile()) {
    notFound(res);
    return;
  }

  const type = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.svg': 'image/svg+xml'
  }[extname(filePath)] || 'application/octet-stream';

  res.writeHead(200, { 'content-type': type });
  res.end(readFileSync(filePath));
}

function summarizeStore() {
  const store = readStore();
  const records = store.records || [];
  const valid = records.filter((record) => record.valido).length;
  const discarded = records.length - valid;
  const lastUpdate = store.updated_at || null;

  return {
    exists: existsSync(STORE_PATH),
    total: records.length,
    valid,
    discarded,
    lastUpdate
  };
}

function commandStep(label, command, args, options = {}) {
  return { label, command, args, options };
}

const JOBS = {
  auth: [
    commandStep('Abrir login seguro da Kommo', process.execPath, ['scripts/kommo-browser-auth-panel.mjs'])
  ],
  collect: [
    commandStep('Coletar conversas no Kommo', process.execPath, ['scripts/kommo-browser-collect.mjs'])
  ],
  scanLeads: [
    commandStep('Ler etapas do funil na pagina Leads', process.execPath, ['scripts/kommo-browser-scan-leads-board.mjs'])
  ],
  enrichApi: [
    commandStep('Enriquecer funil via API somente leitura', process.execPath, ['scripts/kommo-enrich-leads-api.mjs'])
  ],
  build: [
    commandStep('Atualizar arquivos do dashboard', process.execPath, ['scripts/build-dashboard-data.mjs'])
  ],
  publish: [
    commandStep('Atualizar arquivos do dashboard', process.execPath, ['scripts/build-dashboard-data.mjs']),
    commandStep('Preparar dados publicos', 'git', ['add', 'docs/data.json', 'site/data.json']),
    commandStep('Verificar se ha mudancas publicaveis', 'git', ['diff', '--cached', '--quiet'], { allowExitCodes: [0, 1], silentSuccessCode: 0 }),
    commandStep('Criar commit dos dados', 'git', ['commit', '-m', 'Update dashboard data'], { skipIfPreviousCode: 0 }),
    commandStep('Publicar no GitHub', 'git', ['push'], { skipIfPreviousCode: 0 })
  ],
  fullUpdate: [
    commandStep('Coletar conversas no Kommo', process.execPath, ['scripts/kommo-browser-collect.mjs']),
    commandStep('Ler etapas do funil na pagina Leads', process.execPath, ['scripts/kommo-browser-scan-leads-board.mjs']),
    commandStep('Enriquecer funil via API somente leitura', process.execPath, ['scripts/kommo-enrich-leads-api.mjs']),
    commandStep('Atualizar arquivos do dashboard', process.execPath, ['scripts/build-dashboard-data.mjs']),
    commandStep('Preparar dados publicos', 'git', ['add', 'docs/data.json', 'site/data.json']),
    commandStep('Verificar se ha mudancas publicaveis', 'git', ['diff', '--cached', '--quiet'], { allowExitCodes: [0, 1], silentSuccessCode: 0 }),
    commandStep('Criar commit dos dados', 'git', ['commit', '-m', 'Update dashboard data'], { skipIfPreviousCode: 0 }),
    commandStep('Publicar no GitHub', 'git', ['push'], { skipIfPreviousCode: 0 })
  ]
};

function appendLog(job, text) {
  const clean = String(text || '').replace(/\r/g, '');
  if (!clean) return;
  job.logs.push(clean);
  if (job.logs.join('').length > 50000) {
    job.logs = [job.logs.join('').slice(-40000)];
  }
}

function runStep(job, step, previousCode) {
  return new Promise((resolveStep, rejectStep) => {
    if (step.options?.skipIfPreviousCode === previousCode) {
      appendLog(job, `\n- ${step.label}: sem novas mudancas para publicar.\n`);
      resolveStep(previousCode);
      return;
    }

    appendLog(job, `\n== ${step.label} ==\n`);

    const isBrowserStep = step.args.some((arg) => String(arg).includes('kommo-browser-'));
    const extraEnv = {};

    if (isBrowserStep) {
      mkdirSync(resolve(RUNTIME_HOME, 'Library', 'Application Support'), { recursive: true });
      mkdirSync(resolve(ROOT, '.tmp'), { recursive: true });

      Object.assign(extraEnv, {
        HOME: RUNTIME_HOME,
        PLAYWRIGHT_BROWSERS_PATH: resolve(process.env.HOME || '', 'Library', 'Caches', 'ms-playwright'),
        XDG_CONFIG_HOME: resolve(RUNTIME_HOME, '.config'),
        XDG_CACHE_HOME: resolve(RUNTIME_HOME, '.cache'),
        TMPDIR: resolve(ROOT, '.tmp')
      });
    }

    const child = spawn(step.command, step.args, {
      cwd: ROOT,
      env: {
        ...process.env,
        ...extraEnv,
        KOMMO_HEADLESS: process.env.KOMMO_HEADLESS || '0'
      },
      shell: false
    });

    child.stdout.on('data', (chunk) => appendLog(job, chunk));
    child.stderr.on('data', (chunk) => appendLog(job, chunk));
    child.on('error', rejectStep);
    child.on('close', (code) => {
      const allowed = step.options?.allowExitCodes || [0];

      if (!allowed.includes(code)) {
        rejectStep(new Error(`${step.label} falhou com codigo ${code}`));
        return;
      }

      if (step.options?.silentSuccessCode !== code) {
        appendLog(job, `\n${step.label} concluido.\n`);
      }

      resolveStep(code);
    });
  });
}

async function runJob(kind) {
  if (currentJob) {
    return currentJob;
  }

  const steps = JOBS[kind];
  if (!steps) {
    throw new Error('Acao desconhecida.');
  }

  const job = {
    id: `${Date.now()}`,
    kind,
    status: 'running',
    startedAt: new Date().toISOString(),
    finishedAt: null,
    logs: []
  };

  currentJob = job;
  lastJob = job;

  queueMicrotask(async () => {
    let previousCode = 0;

    try {
      for (const step of steps) {
        previousCode = await runStep(job, step, previousCode);
      }

      job.status = 'success';
      appendLog(job, '\nTudo pronto.\n');
    } catch (error) {
      job.status = 'failed';
      appendLog(job, `\nFalha: ${error.message}\n`);
    } finally {
      job.finishedAt = new Date().toISOString();
      currentJob = null;
    }
  });

  return job;
}

function panelStatus() {
  return {
    ok: true,
    publicUrl: PUBLIC_URL,
    localDashboardUrl: `http://${HOST}:${PORT}/dashboard/`,
    sessionSaved: existsSync(resolve(ROOT, '.auth', 'kommo-browser-profile')),
    store: summarizeStore(),
    job: currentJob || lastJob,
    hints: [
      'Se coleta ou leitura do funil falharem ao abrir o navegador, feche esta aba e abra o arquivo Abrir Painel Kommo.command pela pasta do projeto.',
      'O painel aberto de dentro do Codex pode ser bloqueado pelo macOS para automacao de navegador.'
    ]
  };
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${HOST}:${PORT}`);

  if (req.method === 'GET' && url.pathname === '/api/status') {
    if (req.headers.origin === PUBLIC_ORIGIN) {
      res.setHeader('access-control-allow-origin', PUBLIC_ORIGIN);
    }

    json(res, 200, panelStatus());
    return;
  }

  if (req.method === 'GET' && url.pathname === '/api/job') {
    json(res, 200, { ok: true, job: currentJob || lastJob });
    return;
  }

  if (req.method === 'POST' && url.pathname.startsWith('/api/run/')) {
    const origin = req.headers.origin || '';
    const localOrigin = `http://${HOST}:${PORT}`;

    if (origin && origin !== localOrigin) {
      json(res, 403, { ok: false, error: 'Acoes locais so podem ser iniciadas pelo painel local.' });
      return;
    }

    try {
      const kind = url.pathname.replace('/api/run/', '');
      const job = await runJob(kind);
      json(res, 202, { ok: true, job });
    } catch (error) {
      json(res, 400, { ok: false, error: error.message });
    }
    return;
  }

  if (req.method === 'GET' && url.pathname.startsWith('/dashboard/')) {
    const relative = url.pathname.replace('/dashboard/', '') || 'index.html';
    sendFile(res, join(DOCS_DIR, relative));
    return;
  }

  if (req.method === 'GET') {
    const relative = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
    sendFile(res, join(PANEL_DIR, relative));
    return;
  }

  notFound(res);
});

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    const url = `http://${HOST}:${PORT}/`;
    spawn('open', [url], { detached: true, stdio: 'ignore' }).unref();
    process.exit(0);
  }

  throw error;
});

server.listen(PORT, HOST, () => {
  const url = `http://${HOST}:${PORT}/`;
  console.log(`Painel local ativo em ${url}`);

  if (OPEN_ON_START) {
    spawn('open', [url], { detached: true, stdio: 'ignore' }).unref();
  }
});
