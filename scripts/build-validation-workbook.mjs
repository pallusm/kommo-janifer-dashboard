import fs from 'node:fs/promises';
import { SpreadsheetFile, Workbook } from '@oai/artifact-tool';

const outputDir = new URL('../outputs/', import.meta.url);
const outputPath = new URL('relatorio-primeiro-contato-kommo.xlsx', outputDir);

const workbook = Workbook.create();
const registros = workbook.worksheets.add('Registros');
const resumo = workbook.worksheets.add('Resumo');

const headers = [
  'Validado?',
  'Lead',
  'Conversa',
  'Data/hora',
  'Frase encontrada',
  'Primeiro contato?',
  'Origem',
  'Canal',
  'Responsavel',
  'Status/Funil',
  'Observacao'
];

const rows = [
  [
    'Sim',
    'Lead validado 1',
    'Conversa validada',
    new Date('2026-05-22T10:47:00-03:00'),
    'Olá, gostaria de saber mais sobre o acompanhamento com a Dra. Janifer',
    'Sim',
    'Tráfego',
    'WhatsApp Lite',
    'SDR',
    'Etapa01 - Conexão',
    'Caso validado por print; primeira mensagem visivel bate com a frase.'
  ],
  [
    'Sim',
    'Lead validado 2',
    'Conversa validada',
    new Date('2026-05-20T21:03:00-03:00'),
    'Olá, gostaria de informações sobre agendamento com a Dra. Janifer.',
    'Sim',
    '',
    'WhatsApp',
    'SDR',
    'Venda perdida: Plano de saúde',
    'Caso validado por print; origem nao preenchida no campo Origem.'
  ],
  [
    'Não',
    'Caso descartado',
    'Conversa validada',
    new Date('2026-05-22T14:56:00-03:00'),
    'Olá',
    'Não',
    '',
    'WhatsApp',
    'Enfermagem',
    'Conversa finalizada',
    'Exemplo descartado: havia mensagem anterior da pessoa, entao nao conta como primeiro contato.'
  ]
];

registros.getRange('A1:K1').values = [headers];
registros.getRange(`A2:K${rows.length + 1}`).values = rows;

registros.getRange('A1:K1').format = {
  fill: { color: '#1f4e79' },
  font: { color: '#ffffff', bold: true },
  alignment: { horizontal: 'center' }
};
registros.getRange('A:K').format = {
  font: { name: 'Arial', size: 10 },
  alignment: { vertical: 'top', wrapText: true }
};
registros.getRange('D:D').numberFormat = 'dd/mm/yyyy hh:mm';

resumo.getRange('A1:E1').values = [['Resumo de validacao', null, null, null, null]];
resumo.getRange('A3:B8').values = [
  ['Casos validados', null],
  ['Primeiro contato confirmado', null],
  ['Descartados', null],
  ['Acompanhamento Dra. Janifer', null],
  ['Informacoes/agendamento Dra. Janifer', null],
  ['Olá validos', null]
];
resumo.getRange('B3:B8').formulas = [
  ['=COUNTIFS(Registros!A:A,"Sim")'],
  ['=COUNTIFS(Registros!A:A,"Sim",Registros!F:F,"Sim")'],
  ['=COUNTIFS(Registros!A:A,"Não")'],
  ['=COUNTIFS(Registros!A:A,"Sim",Registros!E:E,"*acompanhamento com a Dra. Janifer*")'],
  ['=COUNTIFS(Registros!A:A,"Sim",Registros!E:E,"*informações sobre agendamento*")'],
  ['=COUNTIFS(Registros!A:A,"Sim",Registros!E:E,"Olá")']
];
resumo.getRange('D3:E6').values = [
  ['Origem', 'Casos validados'],
  ['Tráfego', null],
  ['Instagram', null],
  ['Sem origem preenchida', null]
];
resumo.getRange('E4:E6').formulas = [
  ['=COUNTIFS(Registros!A:A,"Sim",Registros!G:G,"Tráfego")'],
  ['=COUNTIFS(Registros!A:A,"Sim",Registros!G:G,"Instagram")'],
  ['=COUNTIFS(Registros!A:A,"Sim",Registros!G:G,"")']
];

resumo.getRange('A1:E1').format = {
  fill: { color: '#1f4e79' },
  font: { color: '#ffffff', bold: true, size: 14 },
  alignment: { horizontal: 'center' }
};
resumo.getRange('A3:A8').format = { font: { bold: true } };
resumo.getRange('D3:E3').format = {
  fill: { color: '#d9eaf7' },
  font: { bold: true }
};
resumo.getRange('A:E').format = {
  font: { name: 'Arial', size: 10 },
  alignment: { vertical: 'middle' }
};
await fs.mkdir(outputDir, { recursive: true });
const output = await SpreadsheetFile.exportXlsx(workbook);
await output.save(outputPath);

console.log(outputPath.pathname);
