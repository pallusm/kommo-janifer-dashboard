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

  const cleanFromPhrase = (text, phrase) => {
    if (!phrase) return text;

    const words = String(text || '').split(/\s+/);

    for (let index = 0; index < words.length; index += 1) {
      const candidate = words.slice(index).join(' ').trim();

      if (normalize(candidate).startsWith(normalize(phrase))) {
        return candidate;
      }
    }

    return text;
  };

  const datePattern = /(?:Hoje|Ontem|\d{2}\/\d{2}\/\d{4})\s+\d{2}:\d{2}/;
  const rightSideStart = window.innerWidth * 0.52;
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const nodes = [];

  while (walker.nextNode()) {
    const text = walker.currentNode.textContent.replace(/\s+/g, ' ').trim();
    if (!text) continue;

    const rect = walker.currentNode.parentElement?.getBoundingClientRect();
    if (!rect || rect.width === 0 || rect.height === 0) continue;
    if (rect.left < rightSideStart) continue;
    if (rect.bottom < 0 || rect.top > window.innerHeight) continue;

    nodes.push({ text, top: Math.round(rect.top), left: Math.round(rect.left) });
  }

  nodes.sort((a, b) => a.top - b.top || a.left - b.left);

  const lines = [];
  for (const node of nodes) {
    const previous = lines[lines.length - 1];
    if (previous && Math.abs(previous.top - node.top) <= 5) {
      previous.text = `${previous.text} ${node.text}`.replace(/\s+/g, ' ').trim();
    } else {
      lines.push({ ...node });
    }
  }

  const chunks = [];
  let current = null;

  for (const line of lines) {
    const dateMatch = line.text.match(datePattern);

    if (dateMatch) {
      if (current) chunks.push(current);
      current = {
        date: dateMatch[0],
        text: line.text
      };
      continue;
    }

    if (current) {
      current.text = `${current.text} ${line.text}`.replace(/\s+/g, ' ').trim();
    }
  }

  if (current) chunks.push(current);

  const candidates = chunks
    .filter((chunk) => inPeriod(chunk.date))
    .filter((chunk) => !/Criar:|Usuário responsável|Movido para|Robô O valor|Lead closed|Fechar conversa|Nenhuma tarefa|Você quer que eu/i.test(chunk.text))
    .map((chunk) => {
      const phrase = findPhrase(chunk.text);
      return {
        date: chunk.date,
        text: cleanFromPhrase(chunk.text, phrase),
        phrase
      };
    })
    .filter((chunk) => chunk.phrase);

  const bodyText = document.body.innerText;
  const firstIncomingMessage = candidates[0] || null;
  const lead = location.href.match(/detail\/(\d+)/)?.[1] || bodyText.match(/Lead #(\d+)/)?.[1] || null;
  const conversa = bodyText.match(/Conversa Nº\s*(A\d+)/i)?.[1] || null;
  const result = {
    versao: 'v5',
    periodo: '07/05/2026 a 22/05/2026',
    lead,
    conversa,
    primeira_mensagem_detectada: firstIncomingMessage,
    frase_detectada: firstIncomingMessage?.phrase || null,
    valido_pelas_3_frases: Boolean(firstIncomingMessage?.phrase),
    candidatos_de_mensagem: candidates.slice(0, 8),
    linhas_lidas_lado_direito: lines.slice(0, 40).map((line) => line.text)
  };

  console.table([{
    versao: result.versao,
    periodo: result.periodo,
    lead: result.lead,
    conversa: result.conversa,
    data: result.primeira_mensagem_detectada?.date || '',
    primeira_mensagem: result.primeira_mensagem_detectada?.text || '',
    frase_detectada: result.frase_detectada || '',
    valido: result.valido_pelas_3_frases ? 'Sim' : 'Não'
  }]);
  console.log('Resultado completo:', result);

  return result;
})();
