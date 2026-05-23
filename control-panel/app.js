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
  logs.textContent = (job.logs || []).join('').trim() || 'Aguardando primeira resposta...';
  logs.scrollTop = logs.scrollHeight;
  setBusy(job.status === 'running');
  document.body.classList.toggle('success', job.status === 'success');
}

async function refreshStatus() {
  const response = await fetch('/api/status', { cache: 'no-store' });
  const status = await response.json();
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

  const response = await fetch(`/api/run/${kind}`, { method: 'POST' });
  const result = await response.json();

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
