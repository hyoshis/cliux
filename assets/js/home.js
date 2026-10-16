(() => {
  const search = document.getElementById('prototype-search');
  const clearSearch = document.getElementById('clear-search');
  const filters = [...document.querySelectorAll('[data-filter]')];
  const cards = [...document.querySelectorAll('.prototype-card')];
  const resultCount = document.getElementById('result-count');
  const emptyState = document.getElementById('empty-state');
  const normalize = (text) => text.normalize('NFKC').toLocaleLowerCase().trim();
  const entries = cards.map((card) => ({
    card,
    categories: card.dataset.categories.split(' '),
    text: normalize(`${card.textContent} ${card.dataset.keywords} ${card.querySelector('a').getAttribute('href')}`)
  }));
  let activeFilter = 'all';

  function updateResults() {
    const terms = normalize(search.value).split(/\s+/).filter(Boolean);
    const matchesSearch = entries.filter((entry) => terms.every((term) => entry.text.includes(term)));
    let visibleCount = 0;

    entries.forEach((entry) => {
      const matches = matchesSearch.includes(entry) &&
        (activeFilter === 'all' || entry.categories.includes(activeFilter));
      entry.card.hidden = !matches;
      if (matches) visibleCount += 1;
    });

    filters.forEach((filter) => {
      const category = filter.dataset.filter;
      filter.setAttribute('aria-pressed', String(category === activeFilter));
      filter.querySelector('[data-filter-count]').textContent = matchesSearch.filter((entry) =>
        category === 'all' || entry.categories.includes(category)
      ).length;
    });

    resultCount.textContent = visibleCount === cards.length
      ? `Showing all ${visibleCount} prototypes`
      : `Showing ${visibleCount} of ${cards.length} prototypes`;
    emptyState.hidden = visibleCount !== 0;
    clearSearch.hidden = search.value.length === 0;
  }

  search.addEventListener('input', updateResults);
  search.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      search.value = '';
      updateResults();
    }
  });
  clearSearch.addEventListener('click', () => {
    search.value = '';
    updateResults();
    search.focus();
  });
  filters.forEach((filter) => filter.addEventListener('click', () => {
    activeFilter = filter.dataset.filter;
    updateResults();
  }));
  document.getElementById('reset-search').addEventListener('click', () => {
    search.value = '';
    activeFilter = 'all';
    updateResults();
    search.focus();
  });
  document.addEventListener('keydown', (event) => {
    const target = event.target;
    if (event.key !== '/' || event.ctrlKey || event.metaKey || event.altKey ||
        target.isContentEditable || target.closest('input, textarea, select, button')) return;
    event.preventDefault();
    search.focus();
  });

  updateResults();
  document.getElementById('catalog-tools').hidden = false;
})();
