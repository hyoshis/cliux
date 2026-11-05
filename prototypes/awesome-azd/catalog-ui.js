(() => {
  const C = window.AzdCatalog;
  const root = document.body.dataset.root || "";
  const collection = document.body.dataset.collection || "";
  const hero = document.body.dataset.hero !== "false";
  const layout = document.body.dataset.layout || "";
  const records = window.AZD_CATALOG.templates.filter(template => !collection || template.collections.includes(collection));
  const previewWeights = window.AZD_CATALOG.display.previewWeights;
  let state = C.parse(location.search, records);
  const search = document.getElementById("catalog-search");
  const panel = document.getElementById("catalog-filters");
  const sort = document.getElementById("catalog-sort");
  const hasCriteria = () => Boolean(state.q.trim() || C.facets.some(facet => state[facet.key].length));
  const context = () => ({ root, state, collection, hero, layout, from: "catalog", highlightFeatured: !hasCriteria() });
  function syncUrl() {
    const query = C.serialize(state);
    history.replaceState(null, "", `${location.pathname}${query ? `?${query}` : ""}${location.hash}`);
  }
  function emptyState() {
    return `<div class="catalog-empty"><h2>No matching templates</h2><p>Try different keywords or filters. You can also start from scratch or use your own code.</p><div class="catalog-empty-actions"><button class="button" type="button" data-clear>Clear search and filters</button><a class="button blue" href="${C.escape(C.startUrl(context()))}" data-start-code>Start with my own code</a></div></div>`;
  }
  function catalogRefresh() {
    const results = C.filter(records, state);
    document.getElementById("catalog-results").innerHTML = results.length ? results.map(template => C.card(template, context())).join("") : emptyState();
    const preview = !hasCriteria();
    const matchingTotal = C.count(results, previewWeights);
    const count = `${results.length ? `1\u2013${results.length} of ${matchingTotal}` : "0"} templates${state.q ? ` for "${state.q}"` : ""}`;
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
    for (const link of document.querySelectorAll("[data-start-code]")) link.href = C.startUrl(context());
    syncUrl();
  }
  function clearCatalog() {
    state = C.parse("", records);
    document.getElementById("catalog-search").value = "";
    sort.value = state.sort;
    catalogRefresh();
    search.focus();
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
      (document.querySelector("#catalog-active-filters button") || search).focus();
    }
  });
  document.addEventListener("keydown", event => {
    if (event.key === "/" && !event.ctrlKey && !event.metaKey && !["INPUT", "SELECT", "TEXTAREA"].includes(document.activeElement.tagName) && !document.activeElement.isContentEditable) {
      event.preventDefault(); search.focus();
    }
    if (event.key === "Escape" && document.activeElement === search && state.q) {
      state.q = ""; search.value = ""; catalogRefresh();
    }
  });
  window.addEventListener("popstate", () => {
    state = C.parse(location.search, records);
    search.value = state.q;
    sort.value = state.sort;
    panel.innerHTML = C.filterPanel(records, state, previewWeights);
    catalogRefresh();
  });
  catalogRefresh();
})();
