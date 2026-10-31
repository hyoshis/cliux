(() => {
  const C = window.AzdCatalog;
  const root = document.body.dataset.root || "";
  const finder = document.body.dataset.mode === "finder";
  const collection = document.body.dataset.collection || (finder && new URLSearchParams(location.search).get("collection") === "ai" ? "ai" : "");
  const records = window.AZD_CATALOG.templates.filter(template => !collection || template.collections.includes(collection));
  let state = C.parse(location.search, records);
  const hasCriteria = () => Boolean(state.q || C.facets.some(facet => state[facet.key].length));
  const context = () => ({ root, state, collection, from: finder ? "finder" : "catalog" });
  function syncUrl() {
    const query = C.serialize(state, { collection: finder ? collection : "" });
    history.replaceState(null, "", `${location.pathname}${query ? `?${query}` : ""}${location.hash}`);
  }
  function emptyState() {
    return `<div class="catalog-empty"><span class="catalog-task-icon" aria-hidden="true">?</span><h2>No example matches every criterion.</h2><p>Try removing a filter. Unknown metadata cannot confirm a match, and these ${records.length} examples don't represent the full live catalog.</p><button class="button" type="button" data-clear>Clear criteria</button><a href="https://azure.github.io/awesome-azd/templates/" target="_blank" rel="noopener">Search the full live catalog &#8599;</a></div>`;
  }
  function catalogRefresh() {
    const results = C.filter(records, state);
    document.getElementById("catalog-results").innerHTML = results.length ? results.map(template => C.card(template, context())).join("") : emptyState();
    const count = `${results.length} of ${records.length} examples${state.q ? ` for "${state.q}"` : ""}`;
    document.getElementById("catalog-result-count").textContent = count;
    document.getElementById("catalog-status").textContent = count;
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
      input.closest("label").querySelector("[data-option-count]").textContent = records.filter(template => C.matches(template, state, facet.key) && C.fieldValues(template, facet.field).includes(input.value)).length;
    }
    const activeCount = C.facets.reduce((count, facet) => count + state[facet.key].length, 0);
    document.getElementById("catalog-filter-toggle").textContent = `Filters${activeCount ? ` (${activeCount})` : ""}`;
    for (const link of document.querySelectorAll("[data-collection-link]")) {
      link.href = C.listingUrl({ root, state, collection: link.dataset.collectionLink });
    }
    syncUrl();
  }
  function clearCatalog() {
    state = C.parse("", records);
    document.getElementById("catalog-search").value = "";
    document.getElementById("catalog-sort").value = state.sort;
    catalogRefresh();
    document.getElementById("catalog-search").focus();
  }
  if (!finder) {
    const search = document.getElementById("catalog-search");
    const panel = document.getElementById("catalog-filters");
    panel.innerHTML = C.filterPanel(records, state);
    search.value = state.q;
    document.getElementById("catalog-sort").value = state.sort;
    search.addEventListener("input", () => { state.q = search.value; catalogRefresh(); });
    document.getElementById("catalog-sort").addEventListener("change", event => { state.sort = event.target.value; catalogRefresh(); });
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
      document.getElementById("catalog-sort").value = state.sort;
      panel.innerHTML = C.filterPanel(records, state);
      catalogRefresh();
    });
    catalogRefresh();
    return;
  }

  const form = document.getElementById("template-finder");
  form.elements.language.setAttribute("aria-label", "Language");
  form.elements.host.setAttribute("aria-label", "Default host");
  const heading = document.getElementById("finder-result-heading");
  const description = document.getElementById("finder-answer-description");
  const matches = document.getElementById("finder-matches");
  const examples = document.querySelector(".finder-examples");
  const criteria = document.getElementById("finder-criteria");
  const warnings = document.getElementById("finder-warnings");
  const results = document.getElementById("finder-results");
  const status = document.getElementById("finder-status");
  let messages = [];
  function selectedGoal() {
    return form.querySelector('input[name="goal"]:checked')?.value || "";
  }
  function restorePreferences() {
    for (const radio of form.querySelectorAll('input[name="goal"]')) radio.checked = state.tasks.includes(radio.value);
    form.elements.language.value = state.languages.length === 1 ? state.languages[0] : "";
    form.elements.host.value = state.hosts.length === 1 ? state.hosts[0] : "";
  }
  function showError(message) {
    heading.textContent = "Let's clarify your criteria.";
    description.textContent = message;
    matches.hidden = true;
    examples.hidden = false;
    status.textContent = message;
    heading.focus();
  }
  function finderRefresh(focus = false) {
    if (!hasCriteria()) {
      showError("Choose a goal, language or host, or describe an idea using catalog terms. No results have been assumed.");
      syncUrl();
      return;
    }
    if (state.unavailable.length) messages = [...new Set([...messages, `Saved criteria not available in this collection: ${state.unavailable.join("; ")}.`])];
    const found = C.filter(records, state);
    matches.hidden = false;
    examples.hidden = true;
    heading.textContent = found.length ? `${found.length} matching ${found.length === 1 ? "starting point" : "starting points"}.` : "No confirmed match yet.";
    description.textContent = "Review the criteria below. Remove anything that doesn't describe your intent; every remaining group must match.";
    status.textContent = `${found.length} of ${records.length} examples match your criteria.`;
    criteria.innerHTML = C.chips(state);
    warnings.innerHTML = messages.map(message => `<p class="finder-warning">${C.escape(message)}</p>`).join("");
    results.innerHTML = found.length ? found.map(template => {
      const evidence = C.facets.flatMap(facet => {
        const values = state[facet.key].filter(value => C.fieldValues(template, facet.field).includes(value));
        return values.length ? [`${facet.label}: ${values.join(", ")}`] : [];
      });
      if (state.q) evidence.push(`Catalog text contains: ${state.q}`);
      return `<article class="finder-result">${C.card(template, context())}<div class="finder-match-evidence"><b>Why it matches</b><ul>${evidence.map(item => `<li>${C.escape(item)}</li>`).join("")}</ul></div></article>`;
    }).join("") : emptyState();
    document.getElementById("finder-open-catalog").href = C.listingUrl({ root, state, collection });
    syncUrl();
    if (focus) heading.focus();
  }
  function submitIdea() {
    const text = form.elements.idea.value.trim();
    const inferred = text ? C.infer(text, records) : { state: C.parse("", records), warnings: [], recognized: false };
    const goal = selectedGoal();
    for (const [key, explicit] of [["tasks", goal], ["languages", form.elements.language.value], ["hosts", form.elements.host.value]]) {
      if (explicit && inferred.state[key].length && !inferred.state[key].includes(explicit)) {
        showError(`Your description suggests ${inferred.state[key].join(" or ")}, but you selected ${explicit}. Update the description or the selection so they agree.`);
        return;
      }
      if (explicit) inferred.state[key] = [explicit];
    }
    if (!C.facets.some(facet => inferred.state[facet.key].length)) {
      showError(inferred.warnings[0] || "We couldn't identify a supported goal or stack from that description. Try a quick choice or an example. This is a keyword matcher, not a general-purpose AI assistant.");
      return;
    }
    state = inferred.state;
    messages = inferred.warnings;
    if (text) messages.push("Matched only the visible catalog criteria. Other details in your description still need repository review. Nothing was sent to an AI service.");
    finderRefresh(true);
  }
  function resetFinder() {
    form.reset();
    state = C.parse("", records);
    messages = [];
    heading.textContent = "A little context goes a long way.";
    description.textContent = "Try an example or choose your own goal. You can edit every inferred criterion before deciding.";
    matches.hidden = true;
    examples.hidden = false;
    status.textContent = "Finder cleared. Choose a goal or describe your idea.";
    syncUrl();
    form.querySelector('input[name="goal"]').focus();
  }
  form.addEventListener("submit", event => { event.preventDefault(); submitIdea(); });
  document.getElementById("clear-finder-goal").addEventListener("click", () => {
    for (const radio of form.querySelectorAll('input[name="goal"]')) radio.checked = false;
    window.announce("Goal preference cleared. Choose another goal or describe your idea.");
  });
  document.getElementById("finder-reset").addEventListener("click", resetFinder);
  document.addEventListener("click", event => {
    const button = event.target.closest("button");
    if (!button) return;
    if (button.dataset.example) {
      form.reset();
      form.elements.idea.value = button.dataset.example;
      submitIdea();
    } else if (button.dataset.remove) {
      if (button.dataset.remove === "q") state.q = "";
      else state[button.dataset.remove] = state[button.dataset.remove].filter(value => value !== button.dataset.value);
      if (button.dataset.remove === "tasks") {
        for (const radio of form.querySelectorAll('input[name="goal"]')) if (radio.value === button.dataset.value) radio.checked = false;
      } else if (button.dataset.remove === "languages" && form.elements.language.value === button.dataset.value) form.elements.language.value = "";
      else if (button.dataset.remove === "hosts" && form.elements.host.value === button.dataset.value) form.elements.host.value = "";
      finderRefresh();
      (criteria.querySelector("button") && !matches.hidden ? criteria.querySelector("button") : heading).focus();
    } else if (button.hasAttribute("data-clear")) resetFinder();
  });
  window.addEventListener("popstate", () => {
    state = C.parse(location.search, records);
    restorePreferences();
    if (hasCriteria()) finderRefresh();
    else resetFinder();
  });
  restorePreferences();
  if (hasCriteria()) finderRefresh();
})();
