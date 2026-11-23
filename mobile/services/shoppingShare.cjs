// Only share the visible grocery list. Never include dietary preferences, identity, or account metadata.
function formatShoppingShare(categories, title) {
  const sections = Object.entries(categories || {}).flatMap(([category, items]) => {
    if (!Array.isArray(items)) return [];
    const safeItems = items.filter(item => typeof item === 'string' && item.trim()).map(item => '• ' + item.trim());
    return safeItems.length ? [[category, ...safeItems].join('\n')] : [];
  });
  return sections.length ? [title, ...sections].join('\n\n') : null;
}

module.exports = { formatShoppingShare };
