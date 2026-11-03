(() => {
  const C = window.AzdCatalog;
  const root = document.body.dataset.root || "";
  const collection = document.body.dataset.collection || "";
  const records = window.AZD_CATALOG.templates.filter(template => !collection || template.collections.includes(collection));
  const previewWeights = window.AZD_CATALOG.display.previewWeights;
  let state = C.parse(location.search, records);
  const search = document.getElementById("catalog-search");
  const panel = document.getElementById("catalog-filters");
  const idea = document.getElementById("catalog-idea");
  const searchBox = document.getElementById("catalog-search-box");
  const modeToggle = document.getElementById("catalog-describe");
  const previewNote = document.getElementById("catalog-idea-preview");
  const shortcut = document.getElementById("catalog-search-shortcut");
  const sort = document.getElementById("catalog-sort");
  let ideaMode = false;
  const hasCriteria = () => Boolean(state.q || C.facets.some(facet => state[facet.key].length));
  const context = () => ({ root, state, collection, from: "catalog", highlightFeatured: !hasCriteria() && state.sort === "editorial" });
  function syncUrl() {
    const query = C.serialize(state);
    history.replaceState(null, "", `${location.pathname}${query ? `?${query}` : ""}${location.hash}`);
  }
  function emptyState() {
    return `<div class="catalog-empty"><h2>No example matches every criterion.</h2><p>Try removing a filter. These ${records.length} examples don't represent the full live catalog.</p><button class="button" type="button" data-clear>Start over</button><a href="https://azure.github.io/awesome-azd/templates/" target="_blank" rel="noopener">Search the full live catalog &#8599;</a></div>`;
  }
  function catalogRefresh() {
    const results = C.filter(records, state);
    document.getElementById("catalog-results").innerHTML = results.length ? results.map(template => C.card(template, context())).join("") : emptyState();
    const preview = !hasCriteria();
    const matchingTotal = C.count(results, previewWeights);
    const count = `${results.length ? `1\u2013${results.length} of ${matchingTotal}` : "0"} templates${state.q ? ` for "${state.q}"` : ""}`;
    document.getElementById("catalog-result-count").textContent = count;
    document.getElementById("catalog-status").textContent = count;
    const pagination = document.getElementById("catalog-pagination");
    if (pagination) pagination.hidden = !preview;
    let note = document.getElementById("catalog-query-note");
    if (!note) {
      note = document.createElement("p");
      note.id = "catalog-query-note";
      note.className = "finder-warning";
      document.getElementById("catalog-discovery").append(note);
    }
    note.hidden = !state.unavailable.length;
    note.textContent = state.unavailable.length ? `These saved criteria are unavailable in this collection and were not applied: ${state.unavailable.join("; ")}.` : "";
    document.getElementById("catalog-active-filters").innerHTML = C.chips(state);
    for (const input of document.querySelectorAll("[data-facet]")) {
      const facet = C.facets.find(item => item.key === input.dataset.facet);
      input.checked = state[facet.key].includes(input.value);
      if (input.checked) input.closest("details").open = true;
      input.closest("label").querySelector("[data-option-count]").textContent = C.count(records.filter(template => C.matches(template, state, facet.key) && C.fieldValues(template, facet.field).includes(input.value)), previewWeights);
    }
    const activeCount = C.facets.reduce((count, facet) => count + state[facet.key].length, 0);
    document.getElementById("catalog-filter-toggle").textContent = `Filters${activeCount ? ` (${activeCount})` : ""}`;
    for (const link of document.querySelectorAll("[data-collection-link]")) {
      link.href = C.listingUrl({ root, state, collection: link.dataset.collectionLink });
    }
    syncUrl();
  }
  function setIdeaMode(expanded) {
    ideaMode = expanded;
    search.hidden = expanded;
    idea.hidden = !expanded;
    shortcut.hidden = expanded;
    previewNote.hidden = !expanded;
    searchBox.dataset.mode = expanded ? "idea" : "keyword";
    modeToggle.setAttribute("aria-expanded", String(expanded));
    modeToggle.textContent = expanded ? "Back to keyword search" : "Or describe the app you want to build";
    if (expanded && !idea.value) idea.value = search.value;
    (expanded ? idea : search).focus();
  }
  function clearCatalog() {
    state = C.parse("", records);
    document.getElementById("catalog-search").value = "";
    sort.value = state.sort;
    idea.value = "";
    catalogRefresh();
    (ideaMode ? idea : search).focus();
  }
  panel.innerHTML = C.filterPanel(records, state, previewWeights);
  search.value = state.q;
  sort.value = state.sort;
  search.addEventListener("input", () => { state.q = search.value; catalogRefresh(); });
  sort.addEventListener("change", event => { state.sort = event.target.value; catalogRefresh(); });
  panel.addEventListener("change", event => {
    const input = event.target;
    if (!input.dataset.facet) return;
    const values = state[input.dataset.facet];
    state[input.dataset.facet] = input.checked ? [...new Set([...values, input.value])] : values.filter(value => value !== input.value);
    catalogRefresh();
  });
  modeToggle.addEventListener("click", () => setIdeaMode(!ideaMode));
  document.getElementById("catalog-filter-toggle").addEventListener("click", event => {
    const open = event.currentTarget.getAttribute("aria-expanded") !== "true";
    event.currentTarget.setAttribute("aria-expanded", String(open));
    panel.dataset.open = String(open);
  });
  document.addEventListener("click", event => {
    const button = event.target.closest("button");
    if (!button) return;
    if (button.hasAttribute("data-clear")) clearCatalog();
    if (button.dataset.remove) {
      if (button.dataset.remove === "q") { state.q = ""; search.value = ""; }
      else state[button.dataset.remove] = state[button.dataset.remove].filter(value => value !== button.dataset.value);
      catalogRefresh();
      (document.querySelector("#catalog-active-filters button") || (ideaMode ? idea : search)).focus();
    }
  });
  document.addEventListener("keydown", event => {
    if (event.key === "/" && !event.ctrlKey && !event.metaKey && !["INPUT", "SELECT", "TEXTAREA"].includes(document.activeElement.tagName) && !document.activeElement.isContentEditable) {
      event.preventDefault(); (ideaMode ? idea : search).focus();
    }
    if (event.key === "Escape" && document.activeElement === search && state.q) {
      state.q = ""; search.value = ""; catalogRefresh();
    }
    if (event.key === "Escape" && document.activeElement === idea) setIdeaMode(false);
  });
  window.addEventListener("popstate", () => {
    state = C.parse(location.search, records);
    search.value = state.q;
    sort.value = state.sort;
    idea.value = "";
    setIdeaMode(false);
    panel.innerHTML = C.filterPanel(records, state, previewWeights);
    catalogRefresh();
  });
  catalogRefresh();
  if (location.hash === "#catalog-describe") {
    setIdeaMode(true);
  }
})();
