(() => {
  const TARGET_PHRASES = [
    'Olá, gostaria de saber mais sobre o acompanhamento com a Dra. Janifer',
    'Olá',
    'Olá, gostaria de informações sobre agendamento com a Dra. Janifer.'
  ];
  const TEAM_SENDERS = ['SDR', 'Salesbot', 'SalesBot', 'Recepção', 'Enfermagem', 'Robô', 'Bot'];
  const START_DATE = new Date(2026, 4, 7, 0, 0, 0);
  const END_DATE = new Date(2026, 4, 22, 23, 59, 59);

  const normalize = (value) =>
    String(value || '')
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();

  const stripTeamTail = (text) => {
    let cleaned = String(text || '').trim();

    for (const sender of TEAM_SENDERS) {
      const pattern = new RegExp(`\\s+${sender}\\s*$`, 'i');
      cleaned = cleaned.replace(pattern, '').trim();
    }

    return cleaned;
  };

  const findPhrase = (text) => {
    const cleaned = stripTeamTail(text);
    const normalizedText = normalize(cleaned);
    const longPhrases = TARGET_PHRASES.filter((phrase) => normalize(phrase) !== 'ola');

    for (const phrase of longPhrases) {
      if (normalizedText.startsWith(normalize(phrase))) return phrase;
    }

    if (/^ola[!.?]*$/i.test(normalize(cleaned).replace(/\s/g, ''))) {
      return 'Olá';
    }

    return null;
  };

  const parseKommoDate = (value) => {
    const match = String(value || '').match(/(Hoje|Ontem|\d{2}\/\d{2}\/\d{4})\s+(\d{2}):(\d{2})/);
    if (!match) return null;

    const [, day, hour, minute] = match;
    const date = new Date(2026, 4, 22, Number(hour), Number(minute), 0);

    if (day === 'Ontem') date.setDate(date.getDate() - 1);
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(day)) {
      const [dd, mm, yyyy] = day.split('/').map(Number);
      return new Date(yyyy, mm - 1, dd, Number(hour), Number(minute), 0);
    }

    return date;
  };

  const inPeriod = (dateText) => {
    const parsed = parseKommoDate(dateText);
    return parsed && parsed >= START_DATE && parsed <= END_DATE;
  };

  const cleanMessage = (text) => {
    const phrase = findPhrase(text);
    if (!phrase) return stripTeamTail(text);

    const words = String(text || '').split(/\s+/);

    for (let index = 0; index < words.length; index += 1) {
      const candidate = stripTeamTail(words.slice(index).join(' '));

      if (findPhrase(candidate) === phrase) {
        return candidate;
      }
    }

    return stripTeamTail(text);
  };

  const datePattern = /(?:Hoje|Ontem|\d{2}\/\d{2}\/\d{4})\s+\d{2}:\d{2}/;
  const conversationSideStart = window.innerWidth * 0.54;
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const textNodes = [];

  while (walker.nextNode()) {
    const text = walker.currentNode.textContent.replace(/\s+/g, ' ').trim();
    if (!text) continue;

    const rect = walker.currentNode.parentElement?.getBoundingClientRect();
    if (!rect || rect.width === 0 || rect.height === 0) continue;
    if (rect.left < conversationSideStart) continue;
    if (rect.bottom < 0 || rect.top > window.innerHeight) continue;

    textNodes.push({ text, top: Math.round(rect.top), left: Math.round(rect.left) });
  }

  textNodes.sort((a, b) => a.top - b.top || a.left - b.left);

  const lines = [];

  for (const node of textNodes) {
    const previous = lines[lines.length - 1];

    if (previous && Math.abs(previous.top - node.top) <= 4) {
      previous.text = `${previous.text} ${node.text}`.replace(/\s+/g, ' ').trim();
    } else {
      lines.push({ ...node });
    }
  }

  const bodyText = document.body.innerText;
  const lead = location.href.match(/detail\/(\d+)/)?.[1] || bodyText.match(/Lead #(\d+)/)?.[1] || null;
  const conversa = bodyText.match(/Conversa Nº\s*(A\d+)/i)?.[1] || null;
  const candidates = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index].text;
    const dateMatch = line.match(datePattern);

    if (!dateMatch || !inPeriod(dateMatch[0])) continue;
    if (/Criar:|Usuário responsável|Movido para|Robô O valor|Lead closed|Fechar conversa|Nenhuma tarefa|Você quer que eu/i.test(line)) continue;

    const afterDate = line.slice(dateMatch.index + dateMatch[0].length).trim();
    const sender = afterDate || null;
    if (TEAM_SENDERS.some((name) => normalize(sender).startsWith(normalize(name)))) continue;

    const nearbyText = [line, lines[index + 1]?.text, lines[index + 2]?.text].filter(Boolean).join(' ');
    const messageText = cleanMessage(nearbyText);
    const phrase = findPhrase(messageText);

    if (!phrase) continue;

    candidates.push({
      date: dateMatch[0],
      sender,
      text: messageText,
      phrase
    });
  }

  const firstIncomingMessage = candidates[0] || null;

  const result = {
    versao: 'v4',
    periodo: '07/05/2026 a 22/05/2026',
    lead,
    conversa,
    primeira_mensagem_detectada: firstIncomingMessage,
    frase_detectada: firstIncomingMessage?.phrase || null,
    valido_pelas_3_frases: Boolean(firstIncomingMessage?.phrase),
    candidatos_de_mensagem: candidates.slice(0, 8),
    linhas_lidas_lado_direito: lines.slice(0, 30).map((line) => line.text)
  };

  console.table([{
    versao: result.versao,
    periodo: result.periodo,
    lead: result.lead,
    conversa: result.conversa,
    data: result.primeira_mensagem_detectada?.date || '',
    remetente: result.primeira_mensagem_detectada?.sender || '',
    primeira_mensagem: result.primeira_mensagem_detectada?.text || '',
    frase_detectada: result.frase_detectada || '',
    valido: result.valido_pelas_3_frases ? 'Sim' : 'Não'
  }]);
  console.log('Resultado completo:', result);

  return result;
})();
