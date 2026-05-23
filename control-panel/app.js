const buttons = [...document.querySelectorAll('button[data-run]')];
const logs = document.querySelector('#logs');
const jobStatus = document.querySelector('#job-status');
const sessionStatus = document.querySelector('#session-status');
const sessionCard = document.querySelector('#session-card');

let pollTimer = null;

function formatDate(value) {
  if (!value) return 'Nunca atualizado';
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short'
  }).format(new Date(value));
}

function setBusy(isBusy) {
  for (const button of buttons) {
    button.disabled = isBusy;
  }

  document.body.classList.toggle('running', isBusy);
}

function renderJob(job) {
  if (!job) {
    jobStatus.textContent = 'Nenhuma ação em andamento.';
    logs.textContent = 'Pronto.';
    setBusy(false);
    return;
  }

  const statusLabel = {
    running: 'Rodando agora...',
    success: 'Concluído com sucesso.',
    failed: 'Ação interrompida. Veja o log abaixo.'
  }[job.status] || job.status;

  jobStatus.textContent = statusLabel;
  const text = (job.logs || []).join('').trim();
  const browserBlocked = /bootstrap_check_in|Crashpad|Target page, context or browser has been closed|Permission denied/i.test(text);
  const helper = browserBlocked
    ? '\n\nOrientacao: este painel provavelmente foi iniciado de dentro do Codex. Para coletar, abra o arquivo "Abrir Painel Kommo.command" diretamente na pasta do projeto e rode a acao por la.'
    : '';

  logs.textContent = `${text || 'Aguardando primeira resposta...'}${helper}`;
  logs.scrollTop = logs.scrollHeight;
  setBusy(job.status === 'running');
  document.body.classList.toggle('success', job.status === 'success');
}

async function refreshStatus() {
  let response;
  let status;

  try {
    response = await fetch('/api/status', { cache: 'no-store' });
    status = await response.json();
  } catch {
    jobStatus.textContent = 'Painel local desligado. Abra o atalho local novamente.';
    logs.textContent = 'Nao consegui conversar com o servidor local em 127.0.0.1:8790.';
    setBusy(false);
    return;
  }

  const store = status.store || {};

  sessionStatus.textContent = status.sessionSaved ? 'Sessão salva' : 'Sessão pendente';
  sessionCard.classList.toggle('session-ok', Boolean(status.sessionSaved));
  document.querySelector('#store-total').textContent = store.total || 0;
  document.querySelector('#store-valid').textContent = store.valid || 0;
  document.querySelector('#store-discarded').textContent = store.discarded || 0;
  document.querySelector('#store-updated').textContent = `Última atualização: ${formatDate(store.lastUpdate)}`;
  document.querySelector('#public-dashboard').href = status.publicUrl;
  document.querySelector('#local-dashboard').href = status.localDashboardUrl;

  renderJob(status.job);

  if (status.job?.status === 'running' && !pollTimer) {
    pollTimer = setInterval(refreshStatus, 1200);
  }

  if (status.job?.status !== 'running' && pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

async function runAction(kind) {
  setBusy(true);
  logs.textContent = 'Iniciando...';
  jobStatus.textContent = 'Preparando ação...';

  let result;

  try {
    const response = await fetch(`/api/run/${kind}`, { method: 'POST' });
    result = await response.json();
  } catch {
    jobStatus.textContent = 'Painel local desligado.';
    logs.textContent = 'Abra o atalho local novamente e tente mais uma vez.';
    setBusy(false);
    return;
  }

  if (!result.ok) {
    jobStatus.textContent = result.error || 'Não foi possível iniciar.';
    setBusy(false);
    return;
  }

  await refreshStatus();
}

for (const button of buttons) {
  button.addEventListener('click', () => runAction(button.dataset.run));
}

refreshStatus().catch((error) => {
  jobStatus.textContent = `Falha ao carregar status: ${error.message}`;
});
