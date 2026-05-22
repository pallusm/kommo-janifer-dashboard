(() => {
  const TARGET_PHRASES = [
    'Olá, gostaria de saber mais sobre o acompanhamento com a Dra. Janifer',
    'Olá, gostaria de informações sobre agendamento com a Dra. Janifer.',
    'Olá'
  ];
  const START_DATE = new Date(2026, 4, 7, 0, 0, 0);
  const END_DATE = new Date(2026, 4, 22, 23, 59, 59);

  const normalize = (value) =>
    String(value || '')
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();

  const parseKommoDate = (value) => {
    const match = String(value || '').match(/(Hoje|Ontem|\d{2}\/\d{2}\/\d{4})\s+(\d{2}):(\d{2})/);
    if (!match) return null;

    const [, day, hour, minute] = match;

    if (day === 'Hoje') return new Date(2026, 4, 22, Number(hour), Number(minute), 0);
    if (day === 'Ontem') return new Date(2026, 4, 21, Number(hour), Number(minute), 0);

    const [dd, mm, yyyy] = day.split('/').map(Number);
    return new Date(yyyy, mm - 1, dd, Number(hour), Number(minute), 0);
  };

  const inPeriod = (dateText) => {
    const parsed = parseKommoDate(dateText);
    return parsed && parsed >= START_DATE && parsed <= END_DATE;
  };

  const findPhrase = (text) => {
    const normalizedText = normalize(text);

    for (const phrase of TARGET_PHRASES.filter((item) => item !== 'Olá')) {
      if (normalizedText.includes(normalize(phrase))) return phrase;
    }

    const cleaned = normalize(text).replace(/[!.?]/g, '').trim();
    if (cleaned === 'ola') return 'Olá';

    return null;
  };

  const datePattern = /(?:Hoje|Ontem|\d{2}\/\d{2}\/\d{4})\s+\d{2}:\d{2}/;
  const rightSideStart = window.innerWidth * 0.45;
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const rows = [];

  while (walker.nextNode()) {
    const text = walker.currentNode.textContent.replace(/\s+/g, ' ').trim();
    if (!text) continue;

    const rect = walker.currentNode.parentElement?.getBoundingClientRect();
    if (!rect || rect.width === 0 || rect.height === 0) continue;
    if (rect.left < rightSideStart) continue;
    if (rect.bottom < 0 || rect.top > window.innerHeight) continue;

    rows.push({
      text,
      top: Math.round(rect.top),
      left: Math.round(rect.left)
    });
  }

  rows.sort((a, b) => a.top - b.top || a.left - b.left);

  const merged = [];
  for (const row of rows) {
    const previous = merged[merged.length - 1];

    if (previous && Math.abs(previous.top - row.top) <= 5) {
      previous.text = `${previous.text} ${row.text}`.replace(/\s+/g, ' ').trim();
    } else {
      merged.push({ ...row });
    }
  }

  const bodyText = document.body.innerText;
  const lead = location.href.match(/detail\/(\d+)/)?.[1] || bodyText.match(/Lead #(\d+)/)?.[1] || null;
  const conversa =
    bodyText.match(/Conversa Nº\s*(A\d+)/i)?.[1] ||
    bodyText.match(/№\s*(A\d+)/i)?.[1] ||
    null;
  const originIndex = merged.findIndex((row) => /campo «Origem»/i.test(row.text));
  const origem = originIndex >= 0 ? merged.slice(originIndex, originIndex + 4).map((row) => row.text).join(' ') : '';
  const origemMatch = origem.match(/está definido para «([^»]+)»/i);
  const candidates = [];

  for (let index = 0; index < merged.length; index += 1) {
    const phrase = findPhrase(merged[index].text);
    if (!phrase) continue;

    let dateText = '';
    let sender = '';

    for (let back = index - 1; back >= 0 && back >= index - 8; back -= 1) {
      const dateMatch = merged[back].text.match(datePattern);

      if (dateMatch) {
        dateText = dateMatch[0];
        sender = merged[back + 1]?.text || '';
        break;
      }
    }

    if (!dateText || !inPeriod(dateText)) continue;

    candidates.push({
      date: dateText,
      sender,
      text: merged[index].text,
      phrase
    });
  }

  const firstIncomingMessage = candidates[0] || null;
  const result = {
    versao: 'v6',
    periodo: '07/05/2026 a 22/05/2026',
    lead,
    conversa,
    origem: origemMatch?.[1] || null,
    primeira_mensagem_detectada: firstIncomingMessage,
    frase_detectada: firstIncomingMessage?.phrase || null,
    valido_pelas_3_frases: Boolean(firstIncomingMessage?.phrase),
    candidatos_de_mensagem: candidates.slice(0, 8),
    linhas_lidas_lado_direito: merged.slice(0, 80).map((row) => row.text)
  };

  console.table([{
    versao: result.versao,
    periodo: result.periodo,
    lead: result.lead,
    conversa: result.conversa,
    origem: result.origem || '',
    data: result.primeira_mensagem_detectada?.date || '',
    remetente: result.primeira_mensagem_detectada?.sender || '',
    primeira_mensagem: result.primeira_mensagem_detectada?.text || '',
    frase_detectada: result.frase_detectada || '',
    valido: result.valido_pelas_3_frases ? 'Sim' : 'Não'
  }]);
  console.log('Resultado completo:', result);

  return result;
})();
