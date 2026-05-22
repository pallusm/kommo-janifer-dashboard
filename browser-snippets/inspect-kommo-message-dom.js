(() => {
  const interestingWords = [
    'Olá',
    'Conversa',
    'WhatsApp',
    'SalesBot',
    'Robô',
    'Usuário responsável',
    'Origem'
  ];
  const rows = [];

  const isVisible = (element) => {
    const rect = element.getBoundingClientRect();
    const style = getComputedStyle(element);

    return (
      rect.width > 0 &&
      rect.height > 0 &&
      rect.bottom >= 0 &&
      rect.top <= window.innerHeight &&
      style.visibility !== 'hidden' &&
      style.display !== 'none'
    );
  };

  const compact = (value) => String(value || '').replace(/\s+/g, ' ').trim();

  const elements = [...document.querySelectorAll('body *')];

  for (const element of elements) {
    if (!isVisible(element)) continue;

    const text = compact(element.innerText || element.textContent);
    if (!text) continue;
    if (text.length > 700) continue;
    if (!interestingWords.some((word) => text.includes(word))) continue;

    const rect = element.getBoundingClientRect();
    const className = compact(element.className);
    const id = compact(element.id);
    const aria = compact(element.getAttribute('aria-label'));
    const dataAttrs = [...element.attributes]
      .filter((attribute) => attribute.name.startsWith('data-'))
      .map((attribute) => `${attribute.name}="${attribute.value}"`)
      .join(' ');

    rows.push({
      tag: element.tagName.toLowerCase(),
      top: Math.round(rect.top),
      left: Math.round(rect.left),
      width: Math.round(rect.width),
      height: Math.round(rect.height),
      id,
      className,
      aria,
      dataAttrs,
      text
    });
  }

  rows.sort((a, b) => a.top - b.top || a.left - b.left || a.text.length - b.text.length);

  console.table(rows.slice(0, 120));
  console.log('Total de elementos candidatos:', rows.length);
  console.log('Copie algumas linhas que contenham a bolha da primeira mensagem e o campo Origem.');

  return rows;
})();
