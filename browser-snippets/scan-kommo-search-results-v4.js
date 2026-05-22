(() => {
  const LIMIT = 25;
  const PHRASES = {
    acompanhamento: 'Olá, gostaria de saber mais sobre o acompanhamento com a Dra. Janifer',
    agendamento: 'Olá, gostaria de informações sobre agendamento com a Dra. Janifer.'
  };
  const TARGET_PHRASES = [
    PHRASES.acompanhamento,
    PHRASES.agendamento
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
  const normalizedQuery = normalize(queryText);
  const expectedPhrase = (() => {
    if (normalizedQuery.includes('acompanhamento')) return PHRASES.acompanhamento;
    if (normalizedQuery.includes('agendamento')) return PHRASES.agendamento;
    return null;
  })();

  const findPhrase = (text) => {
    const normalizedText = normalize(text);

    for (const phrase of TARGET_PHRASES) {
      if (normalizedText.startsWith(normalize(phrase))) return phrase;
    }

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
    const validMessages = messages.filter((message) => message.in_period && message.phrase);
    const firstIncomingMessage = validMessages[0] || null;
    const phraseMatchesQuery = expectedPhrase ? firstIncomingMessage?.phrase === expectedPhrase : true;

    return {
      busca: queryText,
      frase_esperada: expectedPhrase || '',
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

  if (!expectedPhrase) {
    console.warn('Busca nao reconhecida. Use: acompanhamento com a Dra. Janifer ou informações sobre agendamento com a Dra. Janifer.');
  }

  if (!initialItems.length) {
    console.warn('Nenhum resultado encontrado na lista lateral. Pesquise uma das 2 frases na busca da Kommo antes de rodar.');
    return [];
  }

  const plannedIds = initialItems.map((item) => item.dataId);
  const results = [];
  const seenResults = new Set();

  (async () => {
    console.log(`Busca detectada: ${queryText || '(vazia)'}`);
    console.log(`Frase esperada: ${expectedPhrase || '(nao reconhecida)'}`);
    console.log(`Limite desta rodada: ${LIMIT}`);

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

    const summary = results.reduce((acc, item) => {
      const bucket = item.valido ? 'validos' : 'descartados';
      acc[bucket] += 1;
      if (item.valido) {
        const origem = item.origem || 'Sem origem';
        acc.por_origem[origem] = (acc.por_origem[origem] || 0) + 1;
        acc.por_frase[item.frase_detectada] = (acc.por_frase[item.frase_detectada] || 0) + 1;
      }
      return acc;
    }, { validos: 0, descartados: 0, por_origem: {}, por_frase: {} });

    window.__kommoPrimeiroContatoResultados = results;
    window.__kommoPrimeiroContatoResumo = summary;
    console.log('Resumo da rodada:', summary);
    console.log('Resultados finais salvos em window.__kommoPrimeiroContatoResultados');
    console.log('Para copiar JSON: copy(JSON.stringify(window.__kommoPrimeiroContatoResultados, null, 2))');
    console.log('Para copiar resumo: copy(JSON.stringify(window.__kommoPrimeiroContatoResumo, null, 2))');
  })();

  return 'Scanner v4 iniciado para as 2 frases. Aguarde as tabelas no console.';
})();
