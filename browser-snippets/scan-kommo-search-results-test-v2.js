(() => {
  const LIMIT = 5;
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

  const queryText = textOf(document.querySelector('input[type="text"], input[type="search"], .search__input'));
  const expectedPhrase = TARGET_PHRASES.find((phrase) => normalize(phrase).includes(normalize(queryText)) || normalize(queryText).includes(normalize(phrase)));

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

  const getResultItems = () => {
    const items = [...document.querySelectorAll('.notification-inner')]
      .map((element) => {
        const text = textOf(element);
        const conversa = text.match(/A\d+/)?.[0] || element.id?.match(/\d+/)?.[0] || element.dataset.id || '';
        const dataId = element.dataset.id || conversa || text.slice(0, 80);
        const link = element.querySelector('.js-navigate-link') || element;

        return { dataId, conversa, text, link };
      })
      .filter((item) => item.conversa && item.text);

    const seen = new Set();
    return items.filter((item) => {
      const key = item.dataId || item.conversa;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  };

  const scanOpenConversation = () => {
    const lead =
      location.href.match(/detail\/(\d+)/)?.[1] ||
      document.body.innerText.match(/Lead #(\d+)/)?.[1] ||
      null;
    const rawOrigem = textOf(document.querySelector('[data-id="86758"]')).replace(/^Origem\s*/i, '').trim();
    const origem = rawOrigem && rawOrigem !== 'Selecione' ? rawOrigem : '';
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
    const phraseMatchesQuery = expectedPhrase ? firstIncomingMessage?.phrase === expectedPhrase : true;

    return {
      lead,
      conversa: firstIncomingMessage?.conversa || messages[0]?.conversa || null,
      origem,
      data: firstIncomingMessage?.date || '',
      remetente: firstIncomingMessage?.sender || '',
      primeira_mensagem: firstIncomingMessage?.text || '',
      frase_detectada: firstIncomingMessage?.phrase || '',
      frase_bate_com_busca: phraseMatchesQuery,
      valido: Boolean(firstIncomingMessage?.phrase) && phraseMatchesQuery
    };
  };

  const initialItems = getResultItems().slice(0, LIMIT);

  if (!initialItems.length) {
    console.warn('Nenhum resultado encontrado na lista lateral. Pesquise uma frase na busca da Kommo antes de rodar.');
    return [];
  }

  const plannedIds = initialItems.map((item) => item.dataId);
  const results = [];
  const seenResults = new Set();

  (async () => {
    for (const [index, dataId] of plannedIds.entries()) {
      const currentItem = getResultItems().find((item) => item.dataId === dataId);

      if (!currentItem) {
        console.warn(`Resultado ${index + 1}/${plannedIds.length} nao encontrado depois da navegacao.`);
        continue;
      }

      console.log(`Abrindo resultado ${index + 1}/${plannedIds.length}: ${currentItem.conversa}`);
      currentItem.link.click();
      await sleep(3000);

      const scanned = scanOpenConversation();
      const key = `${scanned.lead || ''}-${scanned.conversa || ''}-${scanned.data || ''}-${scanned.primeira_mensagem || ''}`;

      if (!seenResults.has(key)) {
        seenResults.add(key);
        results.push(scanned);
      }

      console.table(results);
    }

    window.__kommoPrimeiroContatoResultados = results;
    console.log('Resultados finais salvos em window.__kommoPrimeiroContatoResultados');
    console.log('Para copiar como JSON: copy(JSON.stringify(window.__kommoPrimeiroContatoResultados, null, 2))');
  })();

  return 'Scanner v2 iniciado. Aguarde as tabelas no console.';
})();
