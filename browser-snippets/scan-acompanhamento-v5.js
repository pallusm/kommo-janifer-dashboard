(() => {
  const LIMIT = 25;
  const EXPECTED_PHRASE = 'Olá, gostaria de saber mais sobre o acompanhamento com a Dra. Janifer';
  const OTHER_PHRASE = 'Olá, gostaria de informações sobre agendamento com a Dra. Janifer.';
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

    if (normalizedText.startsWith(normalize(EXPECTED_PHRASE))) return EXPECTED_PHRASE;
    if (normalizedText.startsWith(normalize(OTHER_PHRASE))) return OTHER_PHRASE;

    return null;
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
    const firstIncomingMessage = messages.find((message) => message.in_period && message.phrase) || null;

    return {
      rodada: 'acompanhamento',
      frase_esperada: EXPECTED_PHRASE,
      lead,
      conversa: firstIncomingMessage?.conversa || messages[0]?.conversa || null,
      origem,
      data: firstIncomingMessage?.date || '',
      remetente: firstIncomingMessage?.sender || '',
      primeira_mensagem: firstIncomingMessage?.text || '',
      frase_detectada: firstIncomingMessage?.phrase || '',
      valido: firstIncomingMessage?.phrase === EXPECTED_PHRASE
    };
  };

  const plannedIds = getResultItems().slice(0, LIMIT).map((item) => item.dataId);

  if (!plannedIds.length) {
    console.warn('Nenhum resultado encontrado. Pesquise acompanhamento com a Dra. Janifer antes de rodar.');
    return [];
  }

  const results = [];
  const seenResults = new Set();

  (async () => {
    console.log(`Rodada: acompanhamento. Frase esperada: ${EXPECTED_PHRASE}`);

    for (const [index, dataId] of plannedIds.entries()) {
      const currentItem = getResultItems().find((item) => item.dataId === dataId);

      if (!currentItem) continue;

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

    const summary = results.reduce((acc, item) => {
      if (item.valido) {
        acc.validos += 1;
        const origem = item.origem || 'Sem origem';
        acc.por_origem[origem] = (acc.por_origem[origem] || 0) + 1;
      } else {
        acc.descartados += 1;
      }
      return acc;
    }, { rodada: 'acompanhamento', validos: 0, descartados: 0, por_origem: {} });

    window.__kommoAcompanhamentoResultados = results;
    window.__kommoAcompanhamentoResumo = summary;
    console.log('Resumo da rodada:', summary);
    console.log('Copiar JSON: copy(JSON.stringify(window.__kommoAcompanhamentoResultados, null, 2))');
    console.log('Copiar resumo: copy(JSON.stringify(window.__kommoAcompanhamentoResumo, null, 2))');
  })();

  return 'Scanner acompanhamento v5 iniciado.';
})();
