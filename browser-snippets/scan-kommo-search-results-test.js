(() => {
  const LIMIT = 3;
  const TARGET_PHRASES = [
    'Olá, gostaria de saber mais sobre o acompanhamento com a Dra. Janifer',
    'Olá, gostaria de informações sobre agendamento com a Dra. Janifer.',
    'Olá'
  ];
  const START_DATE = new Date(2026, 4, 7, 0, 0, 0);
  const END_DATE = new Date(2026, 4, 22, 23, 59, 59);
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const textOf = (element) => String(element?.innerText || element?.textContent || '').replace(/\s+/g, ' ').trim();
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

  const scanOpenConversation = () => {
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

    return {
      lead,
      conversa: firstIncomingMessage?.conversa || messages[0]?.conversa || null,
      origem,
      data: firstIncomingMessage?.date || '',
      remetente: firstIncomingMessage?.sender || '',
      primeira_mensagem: firstIncomingMessage?.text || '',
      frase_detectada: firstIncomingMessage?.phrase || '',
      valido: Boolean(firstIncomingMessage?.phrase)
    };
  };

  const resultLinks = [...document.querySelectorAll('.notification-inner .js-navigate-link, .notification-inner')]
    .filter((element) => textOf(element).match(/A\d+/))
    .slice(0, LIMIT);

  if (!resultLinks.length) {
    console.warn('Nenhum resultado encontrado na lista lateral. Pesquise uma frase na busca da Kommo antes de rodar.');
    return [];
  }

  const results = [];

  (async () => {
    for (const [index, item] of resultLinks.entries()) {
      console.log(`Abrindo resultado ${index + 1}/${resultLinks.length}`);
      item.click();
      await sleep(2500);
      results.push(scanOpenConversation());
      console.table(results);
    }

    window.__kommoPrimeiroContatoResultados = results;
    console.log('Resultados finais salvos em window.__kommoPrimeiroContatoResultados');
    console.log('Para copiar como JSON: copy(JSON.stringify(window.__kommoPrimeiroContatoResultados, null, 2))');
  })();

  return 'Scanner iniciado. Aguarde as tabelas no console.';
})();
