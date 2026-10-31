(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.AzdCatalog = api;
})(globalThis, function () {
  const escape = value => String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
  const facets = [
    { key: "tasks", param: "task", field: "task", label: "What you want to build", open: true },
    { key: "languages", param: "language", field: "languages", label: "Language", open: true },
    { key: "services", param: "service", field: "services", label: "Azure services", open: true },
    { key: "hosts", param: "host", field: "host", label: "Default hosting" },
    { key: "frameworks", param: "framework", field: "frameworks", label: "Framework" },
    { key: "databases", param: "database", field: "databases", label: "Database / retrieval" },
    { key: "iac", param: "iac", field: "iac", label: "Infrastructure as code" },
    { key: "authorship", param: "authorship", field: "authorship", label: "Authored by" },
    { key: "tools", param: "tool", field: "tools", label: "Tools" },
    { key: "topics", param: "topic", field: "topics", label: "Topic" }
  ];
  const fieldValues = (template, field) => Array.isArray(template[field]) ? template[field] : template[field] ? [template[field]] : [];
  const options = (records, facet) => [...new Set(records.flatMap(template => fieldValues(template, facet.field)))].sort((a, b) => a.localeCompare(b));
  function parse(search, records) {
    const query = new URLSearchParams(search);
    const state = { q: query.get("q") || "", sort: query.get("sort") === "az" ? "az" : "editorial", unavailable: [] };
    for (const facet of facets) {
      const allowed = options(records, facet);
      const requested = query.getAll(facet.param).flatMap(value => value.split(",")).filter(Boolean);
      state[facet.key] = [...new Set(requested.filter(value => allowed.includes(value)))];
      state.unavailable.push(...requested.filter(value => !allowed.includes(value)).map(value => `${facet.label}: ${value}`));
    }
    return state;
  }
  function serialize(state, extra = {}) {
    const query = new URLSearchParams();
    if (state.q) query.set("q", state.q);
    for (const facet of facets) if (state[facet.key]?.length) query.set(facet.param, state[facet.key].join(","));
    if (state.sort === "az") query.set("sort", "az");
    for (const [key, value] of Object.entries(extra)) if (value) query.set(key, value);
    return query.toString();
  }
  function matches(template, state, ignoredKey) {
    const text = [template.title, template.subtitle, template.description, template.id, template.author, ...facets.flatMap(facet => fieldValues(template, facet.field))].join(" ").toLowerCase();
    const tokens = (state.q || "").trim().toLowerCase().split(/\s+/).filter(Boolean);
    return tokens.every(token => text.includes(token)) && facets.every(facet =>
      facet.key === ignoredKey || !state[facet.key]?.length || fieldValues(template, facet.field).some(value => state[facet.key].includes(value))
    );
  }
  function filter(records, state) {
    const result = records.filter(template => matches(template, state));
    if (state.sort === "az") result.sort((a, b) => a.title.localeCompare(b.title));
    return result;
  }
  function detailUrl(template, { root = "", state = {}, collection = "", from = "catalog" } = {}) {
    const query = serialize(state, { collection, from });
    return `${root}templates/${template.id}/index.html${query ? `?${query}` : ""}`;
  }
  function listingUrl({ root = "", state = {}, collection = "", finder = false } = {}) {
    const query = serialize(state, { collection: finder ? collection : "" });
    return `${root}${finder ? "find.html" : collection ? "templates/ai/index.html" : "catalog.html"}${query ? `?${query}` : ""}`;
  }
  function icon(task) {
    const paths = {
      "Chat with documents": "M6 3h8l4 4v14H6z M14 3v5h5 M9 12h6 M9 16h6",
      "Query a database": "M4 6c0-4 16-4 16 0s-16 4-16 0v12c0 4 16 4 16 0V6 M4 12c0 4 16 4 16 0",
      "Build an MCP server": "M8 5 2 12l6 7 M16 5l6 7-6 7 M14 3l-4 18",
      "Build a web app": "M3 4h18v16H3z M3 9h18 M6 6.5h1 M10 6.5h1 M7 13h4 M7 16h8",
      "Build an AI agent": "M6 8h12l3 3v9H3v-9z M12 3v5 M9 13h.1 M15 13h.1 M8 17h8",
      "Start with infrastructure": "M3 4h7v7H3z M14 4h7v7h-7z M8 16h8v5H8z M6 11v3h12v-3 M12 14v2"
    };
    return `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[task] || paths["Build a web app"]}"/></svg>`;
  }
  function card(template, config = {}) {
    const id = `template-${template.id.replace(/[^a-z0-9]/g, "-")}`;
    const host = template.host || "Hosting options in repository";
    const languages = template.languages.length ? template.languages : ["Bring your own code"];
    return `<a class="catalog-card" href="${detailUrl(template, config)}" aria-labelledby="${id}">
      <div class="catalog-card-top"><span class="catalog-task-icon">${icon(template.task)}</span><span class="catalog-author">${escape(template.authorship)} authored</span></div>
      <span class="catalog-task">${escape(template.task)}</span>
      <h2 id="${id}">${escape(template.title)}</h2>
      <p class="catalog-card-summary">${escape(template.description)}</p>
      <div class="catalog-card-tags">${languages.map(language => `<span class="tag">${escape(language)}</span>`).join("")}${template.iac ? `<span class="tag">${escape(template.iac)}</span>` : ""}</div>
      <div class="catalog-card-host">${escape(host)}</div>
      <div class="catalog-card-bottom"><span>View template <span aria-hidden="true">&#8594;</span></span><small>${template.collections.includes("ai") ? "AI collection" : "azd template"}</small></div>
    </a>`;
  }
  function filterPanel(records, state) {
    return `<div class="catalog-filter-heading"><h2>Filter templates</h2><button class="link-button" type="button" data-clear>Clear all</button></div>${facets.map(facet => {
      const values = options(records, facet);
      return `<details class="catalog-facet" data-facet-section="${facet.key}" ${facet.open || state[facet.key]?.length ? "open" : ""}><summary>${escape(facet.label)}<span>${values.length}</span></summary><fieldset><legend class="sr-only">${escape(facet.label)}</legend>${values.map(value => {
        const count = records.filter(template => matches(template, state, facet.key) && fieldValues(template, facet.field).includes(value)).length;
        return `<label class="catalog-filter-option"><input type="checkbox" data-facet="${facet.key}" value="${escape(value)}" ${state[facet.key]?.includes(value) ? "checked" : ""}><span>${escape(value)}</span><small data-option-count>${count}</small></label>`;
      }).join("")}</fieldset></details>`;
    }).join("")}<p class="catalog-filter-footnote">Any option within a group; all selected groups together. Counts reflect the other filters. Unknown metadata does not satisfy a filter.</p>`;
  }
  function chips(state) {
    const values = [];
    if (state.q) values.push(`<button type="button" class="filter-chip" data-remove="q" aria-label="Remove search: ${escape(state.q)}">Search: ${escape(state.q)} <span aria-hidden="true">&#215;</span></button>`);
    for (const facet of facets) for (const value of state[facet.key] || []) {
      values.push(`<button type="button" class="filter-chip" data-remove="${facet.key}" data-value="${escape(value)}" aria-label="Remove filter: ${escape(value)}">${escape(value)} <span aria-hidden="true">&#215;</span></button>`);
    }
    return values.join("");
  }
  function infer(text, records) {
    const state = parse("", records);
    const lower = text.toLowerCase();
    const warnings = [];
    if (/\b(?:without|avoid|except|not|no|never|excluding|exclude|cannot|can['’]t|don['’]t)\b|\banything\s+but\b/.test(lower)) {
      return { state, warnings: ["This keyword matcher cannot safely interpret exclusions or negation. Choose your criteria below instead."], recognized: false };
    }
    const add = (key, value) => {
      const facet = facets.find(item => item.key === key);
      if (options(records, facet).includes(value) && !state[key].includes(value)) state[key].push(value);
    };
    for (const facet of facets) {
      if (["tasks", "authorship", "topics", "tools"].includes(facet.key)) continue;
      for (const value of options(records, facet)) {
        const pattern = value.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        if (new RegExp(`(?:^|\\W)${pattern}(?=$|\\W)`, "i").test(lower)) add(facet.key, value);
      }
    }
    if (/(?:^|\W)(?:c#|\.net|dotnet)(?=$|\W)/.test(lower)) add("languages", "C# / .NET");
    if (/\b(?:website|web\s*app|django|aspire)\b/.test(lower)) add("tasks", "Build a web app");
    if (/\b(?:postgres|postgresql|database|sql|rows|tables)\b/.test(lower) && !state.tasks.length) add("tasks", "Query a database");
    if (/\b(?:pdfs?|documents?|knowledge|rag|citations?)\b/.test(lower) && !state.tasks.length) add("tasks", "Chat with documents");
    if (/\bmcp\b/.test(lower)) add("tasks", "Build an MCP server");
    if (/\b(?:agent|agents)\b/.test(lower) && !/\bmcp\b/.test(lower) && !state.tasks.length) add("tasks", "Build an AI agent");
    if (/\bterraform\b/.test(lower) && !state.tasks.length) add("tasks", "Start with infrastructure");
    if (/\b(?:container apps|aca)\b/.test(lower)) add("hosts", "Azure Container Apps");
    if (/\bapp service\b/.test(lower)) add("hosts", "Azure App Service");
    if (/\b(?:azure )?functions\b/.test(lower)) add("hosts", "Azure Functions");
    if (/\b(?:postgres|postgresql)\b/.test(lower)) add("databases", "Azure Database for PostgreSQL");
    if (/\bai search\b/.test(lower)) add("services", "Azure AI Search");
    if (/\b(?:cheap|free|budget|cost|secure|private|compliant|hipaa|gdpr|region|quota|production)\b/.test(lower)) warnings.push("Cost, security, compliance, region and quota requirements are not validated by this matcher. Review them on the template page and in the repository.");
    return { state, warnings, recognized: facets.some(facet => state[facet.key].length) };
  }
  return { escape, facets, fieldValues, options, parse, serialize, matches, filter, detailUrl, listingUrl, icon, card, filterPanel, chips, infer };
});
