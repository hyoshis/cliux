(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.AzdCatalog = api;
})(globalThis, function () {
  const escape = value => String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
  const compactNumber = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });
  const aiIcon = '<svg class="ai-template-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M12 3 14.5 9.5 21 12 14.5 14.5 12 21 9.5 14.5 3 12 9.5 9.5Z"/></svg>';
  const facets = [
    { key: "types", param: "type", field: "collections", label: "Template type", labels: { ai: "AI application" }, open: true },
    {
      key: "tasks", param: "task", field: "task", label: "Use case", open: true,
      values: ["Build a web app", "Build an API", "Build an AI agent", "Build an MCP server", "Chat with documents", "Query a database", "Automate a workflow", "Start with infrastructure"],
      labels: {
        "Build a web app": "Web apps",
        "Build an API": "APIs",
        "Build an AI agent": "AI agents",
        "Build an MCP server": "MCP servers",
        "Chat with documents": "Document Q&A",
        "Query a database": "Data queries with AI",
        "Automate a workflow": "Workflow automation",
        "Start with infrastructure": "Infrastructure"
      }
    },
    { key: "languages", param: "language", field: "languages", label: "Language" },
    { key: "services", param: "service", field: "services", label: "Azure services", open: true },
    { key: "hosts", param: "host", field: "host", label: "Default hosting" },
    { key: "frameworks", param: "framework", field: "frameworks", label: "Framework" },
    { key: "databases", param: "database", field: "databases", label: "Database / retrieval" },
    { key: "iac", param: "iac", field: "iac", label: "Infrastructure as code" },
    { key: "tools", param: "tool", field: "tools", label: "Tools" },
    { key: "topics", param: "topic", field: "topics", label: "Topic" },
    { key: "authorship", param: "authorship", field: "authorship", label: "Authored by" }
  ];
  const fieldValues = (template, field) => Array.isArray(template[field]) ? template[field] : template[field] ? [template[field]] : [];
  const valueLabel = (facet, value) => facet.labels?.[value] ?? value;
  const options = (records, facet) => facet.values ? [...facet.values] : [...new Set(records.flatMap(template => fieldValues(template, facet.field)))].sort((a, b) => a.localeCompare(b));
  function parse(search, records) {
    const query = new URLSearchParams(search);
    const state = { q: query.get("q") || "", sort: ["az", "za"].includes(query.get("sort")) ? query.get("sort") : "popular", unavailable: [] };
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
    if (["az", "za"].includes(state.sort)) query.set("sort", state.sort);
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
    if (["az", "za"].includes(state.sort)) result.sort((a, b) => (state.sort === "za" ? -1 : 1) * a.title.localeCompare(b.title));
    else if (state.sort === "popular") result.sort((a, b) => (b.repositoryStats?.stars ?? -1) - (a.repositoryStats?.stars ?? -1) || a.title.localeCompare(b.title));
    if (!(state.q || "").trim() && facets.every(facet => !state[facet.key]?.length)) result.sort((a, b) => Number(Boolean(b.featured)) - Number(Boolean(a.featured)));
    return result;
  }
  function count(records, weights = null) {
    if (weights === null) return records.length;
    return records.reduce((total, template) => {
      const weight = weights[template.id];
      if (!Number.isInteger(weight) || weight < 1) throw new RangeError(`Invalid preview weight for ${template.id}`);
      return total + weight;
    }, 0);
  }
  function detailUrl(template, { root = "", state = {}, collection = "", from = "catalog", hero = true, layout = "" } = {}) {
    const query = serialize(state, { collection, from, hero: hero ? "" : "off", layout: hero && ["hero-cta", "hero-link"].includes(layout) ? layout : "" });
    return `${root}templates/${template.id}/index.html${query ? `?${query}` : ""}`;
  }
  function listingUrl({ root = "", state = {}, collection = "", hero = true, layout = "" } = {}) {
    const query = serialize(collection === "ai" ? { ...state, types: ["ai"] } : state);
    const page = !hero ? "catalog-no-hero.html" : layout === "hero-cta" ? "catalog-hero-cta.html" : layout === "hero-link" ? "catalog-hero-link.html" : "catalog.html";
    return `${root}${page}${query ? `?${query}` : ""}`;
  }
  function startUrl({ root = "", state = {}, collection = "", hero = true, layout = "" } = {}) {
    const query = serialize(state, { collection, hero: hero ? "" : "off", layout: hero && ["hero-cta", "hero-link"].includes(layout) ? layout : "" });
    return `${root}start-with-code.html${query ? `?${query}` : ""}`;
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
    const featured = config.featured;
    const id = `${featured ? "featured" : "template"}-${template.id.replace(/[^a-z0-9]/g, "-")}`;
    const heading = featured ? "h3" : "h2";
    const service = template.host || template.services[0];
    const languages = template.languages.length ? template.languages : ["Bring your own code"];
    const highlighted = template.featured && config.highlightFeatured !== false;
    const authorshipIcon = template.authorship === "Microsoft" ? "authored-microsoft.svg" : template.authorship === "Community" ? "authored-community.svg" : "";
    const authorshipMark = authorshipIcon ? `<img class="catalog-authorship-icon" src="${escape((config.root ?? "") + "assets/" + authorshipIcon)}" width="14" height="14" alt="" aria-hidden="true">` : "";
    const badge = highlighted ? `<span class="catalog-featured-badge"><svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor" aria-hidden="true"><path d="M12 3 14.8 8.7 21.1 9.6 16.6 14 17.7 20.3 12 17.3 6.3 20.3 7.4 14 2.9 9.6 9.2 8.7Z"/></svg>Featured</span>` : "";
    const stats = template.repositoryStats;
    const repositoryStats = stats ? `<div class="catalog-repo-stats"><span class="catalog-repo-stat" title="${stats.stars.toLocaleString("en-US")} stars"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" aria-hidden="true"><path d="M12 3 14.8 8.7 21.1 9.6 16.6 14 17.7 20.3 12 17.3 6.3 20.3 7.4 14 2.9 9.6 9.2 8.7Z"/></svg><span aria-hidden="true">${compactNumber.format(stats.stars).toLowerCase()}</span><span class="sr-only">${stats.stars.toLocaleString("en-US")} stars</span></span></div>` : "";
    const typeMark = template.collections.includes("ai") ? `<span class="catalog-card-ai" title="AI app template">${aiIcon}<span class="sr-only">AI app template: </span></span>` : "";
    return `<article class="catalog-card${featured ? " featured-card" : highlighted ? " promoted-card" : ""}">
      <a class="catalog-card-link" href="${escape(detailUrl(template, config))}" aria-labelledby="${id}">
      <div class="catalog-card-top"><span class="catalog-author">${authorshipMark}${escape(template.authorship)} Authored</span>${badge}</div>
      <${heading} id="${id}">${typeMark}${escape(template.title)}</${heading}>
      <p class="catalog-card-summary">${escape(template.description)}</p>
      <div class="catalog-card-meta"><div class="catalog-card-tags">${languages.map(language => `<span class="tag">${escape(language)}</span>`).join("")}${template.iac ? `<span class="tag">${escape(template.iac)}</span>` : ""}${service ? `<span class="tag">${escape(service)}</span>` : ""}</div>${repositoryStats}</div>
      </a>
      ${template.initCommand ? `<div class="catalog-card-command"><code title="${escape(template.initCommand)}">${escape(template.initCommand)}</code><button class="catalog-copy-command" type="button" data-copy="${escape(template.initCommand)}" aria-label="Copy init command for ${escape(template.title)}" title="Copy init command"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true"><rect x="8" y="8" width="11" height="13" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h3"/></svg></button></div>` : `<a class="catalog-card-setup" href="${escape(template.readme)}" target="_blank" rel="noopener">View setup instructions &#8599;</a>`}
    </article>`;
  }
  function filterPanel(records, state, weights = null) {
    return `<div class="catalog-filter-heading"><h2>Filter templates</h2><button class="link-button" type="button" data-clear>Clear all</button></div>${facets.filter(facet => !["services", "hosts", "topics", "tools"].includes(facet.key)).map(facet => {
      const values = options(records, facet);
      const candidates = records.filter(template => matches(template, state, facet.key));
      return `<details class="catalog-facet" data-facet-section="${facet.key}" ${facet.open || state[facet.key]?.length ? "open" : ""}><summary>${escape(facet.label)}<span title="Filter items">${values.length}</span></summary><fieldset><legend class="sr-only">${escape(facet.label)}</legend>${values.map(value => {
        const optionCount = count(candidates.filter(template => fieldValues(template, facet.field).includes(value)), weights);
        const mark = facet.key === "types" && value === "ai" ? aiIcon : "";
        return `<label class="catalog-filter-option"><input type="checkbox" data-facet="${facet.key}" value="${escape(value)}" ${state[facet.key]?.includes(value) ? "checked" : ""}><span class="catalog-filter-value">${mark}<span>${escape(valueLabel(facet, value))}</span></span><small data-option-count>${optionCount}</small></label>`;
      }).join("")}</fieldset></details>`;
    }).join("")}`;
  }
  function chips(state) {
    const values = [];
    if (state.q) values.push(`<button type="button" class="filter-chip" data-remove="q" aria-label="Remove search: ${escape(state.q)}">Search: ${escape(state.q)} <span aria-hidden="true">&#215;</span></button>`);
    for (const facet of facets) for (const value of state[facet.key] || []) {
      values.push(`<button type="button" class="filter-chip" data-remove="${facet.key}" data-value="${escape(value)}" aria-label="Remove filter: ${escape(valueLabel(facet, value))}">${escape(valueLabel(facet, value))} <span aria-hidden="true">&#215;</span></button>`);
    }
    return values.join("");
  }
  function infer(text, records) {
    const state = parse("", records);
    const lower = text.toLowerCase();
    const warnings = [];
    if (/\b(?:without|avoid|except|not|no|never|excluding|exclude|cannot|can['’]t|don['’]t)\b|\banything\s+but\b/.test(lower)) {
      return { state, warnings: ["This keyword matcher cannot safely interpret exclusions or negation. Use the catalog filters instead."], recognized: false };
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
  return { escape, facets, fieldValues, options, parse, serialize, matches, filter, count, detailUrl, listingUrl, startUrl, icon, card, filterPanel, chips, infer };
});
