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

  const findPhrase = (text) => {
    const normalizedText = normalize(text);

    for (const phrase of TARGET_PHRASES.filter((item) => item !== 'Olá')) {
      if (normalizedText.startsWith(normalize(phrase))) return phrase;
    }

    const cleaned = normalize(text).replace(/[!.?]/g, '').trim();
    return cleaned === 'ola' ? 'Olá' : null;
  };

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

  const textOf = (element) => String(element?.innerText || element?.textContent || '').replace(/\s+/g, ' ').trim();
  const lead =
    location.href.match(/detail\/(\d+)/)?.[1] ||
    document.body.innerText.match(/Lead #(\d+)/)?.[1] ||
    null;
  const origem =
    textOf(document.querySelector('[data-id="86758"]'))
      .replace(/^Origem\s*/i, '')
      .trim() || null;
  const incomingNotes = [...document.querySelectorAll('.feed-note-incoming')];
  const messages = incomingNotes
    .map((note) => {
      const noteText = textOf(note);
      const date = noteText.match(/(?:Hoje|Ontem|\d{2}\/\d{2}\/\d{4})\s+\d{2}:\d{2}/)?.[0] || '';
      const sender = textOf(note.querySelector('.feed-note__amojo-user')) || '';
      const message =
        textOf(note.querySelector('.feed-note__message_paragraph')) ||
        textOf(note.querySelector('.feed-note__message-text')) ||
        '';
      const conversa =
        textOf(note.querySelector('.feed-note__talk-outgoing-title')) ||
        noteText.match(/Conversa\s+№\s*(A\d+)/i)?.[0] ||
        '';
      const conversaId = conversa.match(/A\d+/)?.[0] || null;
      const phrase = findPhrase(message);

      return {
        date,
        sender,
        text: message,
        conversa: conversaId,
        phrase,
        in_period: inPeriod(date)
      };
    })
    .filter((message) => message.text);

  const validMessages = messages.filter((message) => message.in_period && message.phrase);
  const firstIncomingMessage = validMessages[0] || null;

  const result = {
    versao: 'v7',
    periodo: '07/05/2026 a 22/05/2026',
    lead,
    conversa: firstIncomingMessage?.conversa || messages[0]?.conversa || null,
    origem,
    primeira_mensagem_detectada: firstIncomingMessage,
    frase_detectada: firstIncomingMessage?.phrase || null,
    valido_pelas_3_frases: Boolean(firstIncomingMessage?.phrase),
    mensagens_recebidas_visiveis: messages
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
