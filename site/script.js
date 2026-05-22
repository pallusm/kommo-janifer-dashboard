const data = [
  {
    frase: 'Olá, gostaria de saber mais sobre o acompanhamento com a Dra. Janifer',
    validos: 10,
    descartados: 15,
    origem: {
      Instagram: 7,
      Tráfego: 1,
      'Sem origem': 2
    }
  },
  {
    frase: 'Olá, gostaria de informações sobre agendamento com a Dra. Janifer.',
    validos: 19,
    descartados: 6,
    origem: {
      Instagram: 9,
      Tráfego: 0,
      'Sem origem': 10
    }
  }
];

const rows = document.querySelector('#rows');
const totals = data.reduce((acc, item) => {
  acc.validos += item.validos;
  acc.descartados += item.descartados;
  acc.instagram += item.origem.Instagram || 0;
  acc.trafego += item.origem.Tráfego || 0;
  acc.semOrigem += item.origem['Sem origem'] || 0;
  return acc;
}, {
  validos: 0,
  descartados: 0,
  instagram: 0,
  trafego: 0,
  semOrigem: 0
});

document.querySelector('#total-validos').textContent = totals.validos;
document.querySelector('#total-instagram').textContent = totals.instagram;
document.querySelector('#total-trafego').textContent = totals.trafego;
document.querySelector('#total-sem-origem').textContent = totals.semOrigem;
document.querySelector('#total-descartados').textContent = totals.descartados;

rows.innerHTML = data
  .map((item) => `
    <tr>
      <td>${item.frase}</td>
      <td class="ok">${item.validos}</td>
      <td class="no">${item.descartados}</td>
      <td>${item.origem.Instagram || 0}</td>
      <td>${item.origem.Tráfego || 0}</td>
      <td>${item.origem['Sem origem'] || 0}</td>
    </tr>
  `)
  .join('');
