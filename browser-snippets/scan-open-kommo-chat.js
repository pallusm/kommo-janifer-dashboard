(() => {
  const TARGET_PHRASES = [
    'Olá, gostaria de saber mais sobre o acompanhamento com a Dra. Janifer',
    'Olá',
    'Olá, gostaria de informações sobre agendamento com a Dra. Janifer.'
  ];

  const normalize = (value) =>
    String(value || '')
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();

  const fullBodyText = document.body.innerText;
  const bodyText = fullBodyText.includes('Busca e filtro')
    ? fullBodyText.slice(fullBodyText.indexOf('Busca e filtro'))
    : fullBodyText;
  const lines = bodyText
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  const leadMatch = fullBodyText.match(/(?:Lead #|Autolead: Lead #)(\d+)/);
  const conversationMatch = bodyText.match(/Conversa Nº\s*(A\d+)/i);
  const dateTimePattern = /(?:Hoje|Ontem|\d{2}\/\d{2}\/\d{4})\s+\d{2}:\d{2}/;
  const teamPrefixes = /^(SDR|Salesbot|SalesBot|Recepção|Enfermagem|Robô|Bot)\b[: ]/i;

  const messageCandidates = lines
    .map((line, index) => ({ line, index }))
    .filter(({ line }) => dateTimePattern.test(line))
    .map(({ line, index }) => {
      const dateMatch = line.match(dateTimePattern);
      const textAfterDate = line.slice((dateMatch?.index || 0) + dateMatch[0].length).trim();
      const sameLineWithoutSender = textAfterDate.replace(/^[A-Za-zÀ-ÿ ]{2,40}\s+/, '').trim();
      const nextLine = lines[index + 1] || '';
      const messageText = sameLineWithoutSender || nextLine;

      return {
        date: dateMatch?.[0] || '',
        text: messageText,
        raw: line
      };
    })
    .filter((message) => message.text)
    .filter((message) => !/Criar:|Usuário responsável|Movido para|SalesBot \[|Robô O valor|Lead closed|Fechar conversa|Nenhuma tarefa/i.test(message.text))
    .filter((message) => !teamPrefixes.test(message.text));

  const firstIncomingMessage =
    messageCandidates.find((message) =>
      TARGET_PHRASES.some((phrase) => normalize(message.text).startsWith(normalize(phrase)))
    ) || messageCandidates[0] || null;

  const matchedPhrase = firstIncomingMessage
    ? TARGET_PHRASES.find((phrase) => normalize(firstIncomingMessage.text).startsWith(normalize(phrase)))
    : null;

  const result = {
    lead: leadMatch?.[1] || null,
    conversa: conversationMatch?.[1] || null,
    primeira_mensagem_detectada: firstIncomingMessage,
    frase_detectada: matchedPhrase,
    valido_pelas_3_frases: Boolean(matchedPhrase),
    candidatos_de_mensagem: messageCandidates.slice(0, 8)
  };

  console.table([{
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
