(() => {
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const rows = [];
  const rightSideStart = window.innerWidth * 0.45;

  while (walker.nextNode()) {
    const text = walker.currentNode.textContent.replace(/\s+/g, ' ').trim();
    if (!text) continue;

    const rect = walker.currentNode.parentElement?.getBoundingClientRect();
    if (!rect || rect.width === 0 || rect.height === 0) continue;
    if (rect.left < rightSideStart) continue;
    if (rect.bottom < 0 || rect.top > window.innerHeight) continue;

    rows.push({
      top: Math.round(rect.top),
      left: Math.round(rect.left),
      text
    });
  }

  rows.sort((a, b) => a.top - b.top || a.left - b.left);
  console.table(rows.slice(0, 80));
  console.log('Total de textos visiveis no lado direito:', rows.length);
  return rows;
})();
