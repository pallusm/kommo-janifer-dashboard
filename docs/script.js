const data = [
  {
    lead: 'Lead validado 1',
    conversa: 'Conversa validada',
    data: '22/05/2026 10:47',
    frase: 'Olá, gostaria de saber mais sobre o acompanhamento com a Dra. Janifer',
    origem: 'Tráfego',
    status: 'Validado'
  },
  {
    lead: 'Lead validado 2',
    conversa: 'Conversa validada',
    data: '20/05/2026 21:03',
    frase: 'Olá, gostaria de informações sobre agendamento com a Dra. Janifer.',
    origem: 'Sem origem preenchida',
    status: 'Validado'
  },
  {
    lead: 'Caso descartado',
    conversa: 'Conversa validada',
    data: '22/05/2026 14:56',
    frase: 'Olá',
    origem: 'Sem origem preenchida',
    status: 'Descartado'
  }
];

const rows = document.querySelector('#rows');
const validos = data.filter((item) => item.status === 'Validado');
const descartados = data.filter((item) => item.status === 'Descartado');

document.querySelector('#total-validos').textContent = validos.length;
document.querySelector('#total-trafego').textContent = validos.filter((item) => item.origem === 'Tráfego').length;
document.querySelector('#total-sem-origem').textContent = validos.filter((item) => item.origem === 'Sem origem preenchida').length;
document.querySelector('#total-descartados').textContent = descartados.length;

rows.innerHTML = data
  .map((item) => `
    <tr>
      <td>${item.lead}</td>
      <td>${item.conversa}</td>
      <td>${item.data}</td>
      <td>${item.frase}</td>
      <td>${item.origem}</td>
      <td class="${item.status === 'Validado' ? 'ok' : 'no'}">${item.status}</td>
    </tr>
  `)
  .join('');
