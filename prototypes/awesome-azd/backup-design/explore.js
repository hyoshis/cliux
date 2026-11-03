(() => {
  const root = document.body.dataset.root || "";
  const mount = document.getElementById("exploration");
  const params = new URLSearchParams(location.search);
  const directions = ["catalog", "pathfinder", "blueprints"];
  const direction = document.body.dataset.forceDirection || (directions.includes(params.get("direction")) ? params.get("direction") : "catalog");
  const collection = document.body.dataset.collection === "ai" || params.get("collection") === "ai" ? "ai" : "";
  if (direction === "catalog") {
    const query = new URLSearchParams(location.search);
    query.delete("direction");
    query.delete("step");
    query.delete("collection");
    location.replace(`${root}${collection ? "templates/ai/index.html" : "catalog.html"}${query.size ? `?${query}` : ""}`);
    return;
  }
  const data = window.AZD_CATALOG.templates.filter(template => !collection || template.collections.includes(collection));
  const unique = values => [...new Set(values)];
  const tasks = unique(data.map(template => template.task));
  const languages = unique(data.flatMap(template => template.languages));
  const hosts = unique(data.map(template => template.host).filter(Boolean));
  const services = unique(data.flatMap(template => template.services)).sort();
  const validValues = (value, allowed) => (value || "").split(",").filter(item => allowed.includes(item));
  function readState() {
    const query = new URLSearchParams(location.search);
    const result = {
      q: query.get("q") || "",
      tasks: validValues(query.get("task"), tasks),
      languages: validValues(query.get("language"), languages),
      hosts: validValues(query.get("host"), hosts),
      services: validValues(query.get("service"), services),
      sort: query.get("sort") === "az" ? "az" : "editorial",
      step: Number(query.get("step")) || 1
    };
    if (![1, 2, 3].includes(result.step)) result.step = 1;
    if (result.step > 1 && !result.tasks.length) result.step = 1;
    if (direction === "pathfinder" && !query.has("step") && result.tasks.length) result.step = 3;
    if (direction === "pathfinder") {
      result.tasks = result.tasks.slice(0, 1);
      result.hosts = [];
      result.services = [];
      result.q = "";
    }
    return result;
  }
  const state = readState();
  let filtersOpen = false;
  const escape = value => String(value).replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
  const icons = { "Chat with documents": "{}", "Query a database": "[]", "Build an MCP server": ">_", "Build a web app": "#", "Build an AI agent": "AI", "Start with infrastructure": "tf"};
  const descriptions = {
    "Chat with documents": "Answers grounded in your own knowledge.",
    "Query a database": "Make structured data conversational.",
    "Build an MCP server": "Connect an agent to your tools.",
    "Build a web app": "Start with an application and infrastructure.",
    "Build an AI agent": "Build a knowledge-grounded agent.",
    "Start with infrastructure": "Bring your own application code."
  };
  function stateParams(overrides = {}) {
    const values = {
      direction, q: state.q, task: state.tasks.join(","), language: state.languages.join(","),
      host: state.hosts.join(","), service: state.services.join(","), sort: state.sort === "az" ? "az" : "",
      step: direction === "pathfinder" ? state.step : "", ...overrides
    };
    const result = new URLSearchParams();
    for (const [key, value] of Object.entries(values)) if (value) result.set(key, value);
    return result;
  }
  function listingUrl(nextDirection = direction, nextCollection = collection) {
    if (nextDirection === "catalog") return `${root}${nextCollection ? "templates/ai/index.html" : "catalog.html"}?${stateParams({ direction: "", step: "" })}`;
    return `${root}archive/${nextDirection === "pathfinder" ? "guided" : "blueprints"}.html?${stateParams({ collection: nextCollection, direction: nextDirection, step: nextDirection === "pathfinder" ? state.step : "" })}`;
  }
  function detailUrl(template) {
    const query = stateParams({ collection, from: "archive", step: direction === "pathfinder" ? state.step : "" });
    return `${root}templates/${template.id}/index.html?${query}`;
  }
  function syncUrl(push = false) {
    const url = `${location.pathname}?${stateParams()}`;
    if (push) history.pushState(null, "", url);
    else history.replaceState(null, "", url);
    for (const link of document.querySelectorAll("[data-direction]")) {
      link.href = listingUrl(link.dataset.direction);
      if (link.dataset.direction === direction) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    }
    document.querySelector("[data-gallery-link]").href = listingUrl();
  }
  function matches() {
    const tokens = state.q.toLowerCase().trim().split(/\s+/).filter(Boolean);
    const results = data.filter(template => {
      const text = [template.title, template.subtitle, template.description, template.id, template.author, template.task, ...template.languages, ...template.services, template.iac, template.collections.length ? "ai" : "", template.task === "Chat with documents" ? "rag retrieval augmented generation" : ""].join(" ").toLowerCase();
      return tokens.every(token => text.includes(token)) &&
        (!state.tasks.length || state.tasks.includes(template.task)) &&
        (!state.languages.length || template.languages.some(language => state.languages.includes(language))) &&
        (!state.hosts.length || state.hosts.includes(template.host)) &&
        (!state.services.length || template.services.some(service => state.services.includes(service)));
    });
    if (state.sort === "az") results.sort((a, b) => a.title.localeCompare(b.title));
    return results;
  }
  function flow(template) {
    return `<div class="flow" aria-label="Conceptual flow: ${escape(template.flow.join(" to "))}">${template.flow.map((node, index) => `${index ? '<span class="flow-arrow" aria-hidden="true">&#8594;</span>' : ""}<span class="flow-node">${escape(node)}</span>`).join("")}</div>`;
  }
  function card(template, guided = false) {
    return `<article class="template-card">
      <div class="card-kicker"><span>${escape(template.authorship)} authored</span><span>${template.collections.includes("ai") ? "AI COLLECTION" : "ALL TEMPLATES"}</span></div>
      <div class="template-icon" aria-hidden="true">${icons[template.task]}</div>
      <h2><a href="${detailUrl(template)}">${escape(template.title)}</a></h2>
      <p>${escape(template.description)}</p>
      ${guided ? `<div class="match-note">Matches your goal${state.languages.length ? ` + ${escape(state.languages.join(" / "))}` : ""}. Requirements still need review.</div>` : ""}
      <div class="tags"><span class="tag task">${escape(template.task)}</span>${template.languages.map(language => `<span class="tag">${escape(language)}</span>`).join("")}</div>
      <div class="card-meta"><b>${escape(template.host || "Default host not verified")}</b><br>${escape(template.iac)} &middot; ${escape(template.author)}</div>
      <div class="card-footer"><a href="${detailUrl(template)}" aria-label="View template: ${escape(template.title)}">View template <span aria-hidden="true">&#8594;</span></a><span>${template.initCommand ? "azd init available" : "Review setup"}</span></div>
    </article>`;
  }
  function blueprint(template) {
    const serviceTags = `<div class="tags service-tags" aria-label="Declared services">${template.services.map(service => `<span class="tag ${state.services.includes(service) ? "task" : ""}">${escape(service)}</span>`).join("")}</div>`;
    return `<article class="blueprint-card"><div class="blueprint-visual">${flow(template)}<div class="small">CONCEPTUAL FLOW &middot; NOT A VERIFIED TOPOLOGY</div></div>${card(template).replace('<article class="template-card">', '<div class="template-card">').replace('<div class="card-meta">', `${serviceTags}<div class="card-meta">`).replace("</article>", "</div>")}</article>`;
  }
  function searchBox() {
    return `<label class="catalog-search"><span aria-hidden="true">&#8981;</span><span class="sr-only">Search sample templates</span><input id="template-search" type="search" value="${escape(state.q)}" placeholder="Search by task, language, service, or template..." autocomplete="off"><kbd aria-hidden="true">/</kbd></label>`;
  }
  function collectionTabs() {
    return `<nav class="collection-tabs" aria-label="Template collections"><a href="${listingUrl(direction, "")}" ${!collection ? 'aria-current="page"' : ""}>All templates</a><a href="${listingUrl(direction, "ai")}" ${collection ? 'aria-current="page"' : ""}>AI collection</a><small>${data.length} sample records &middot; not the full catalog</small></nav>`;
  }
  function facet(name, label, values, field) {
    return `<fieldset class="filter-group"><legend>${label}</legend>${values.map(value => {
      const count = data.filter(template => field === "languages" ? template.languages.includes(value) : template[field] === value).length;
      return `<label class="filter-option"><input type="checkbox" name="${name}" value="${escape(value)}" ${state[name].includes(value) ? "checked" : ""}><span>${escape(value)}</span><small>${count}</small></label>`;
    }).join("")}</fieldset>`;
  }
  function sortControl() {
    return `<label>Sort by <select id="sort" aria-label="Sort templates"><option value="editorial" ${state.sort === "editorial" ? "selected" : ""}>Editorial order</option><option value="az" ${state.sort === "az" ? "selected" : ""}>Title A&ndash;Z</option></select></label>`;
  }
  function renderCatalog() {
    return `<div class="product-wrap"><section class="catalog-hero"><div><p class="eyebrow">${collection ? "THE AI COLLECTION" : "FIND YOUR STARTING POINT"}</p><h1>${collection ? "Build with AI.<br>Start with context." : "Your next app<br>starts here."}</h1><p>${collection ? "Document chat, database RAG, and more. The same catalog, curated for AI. Understand the template before you deploy." : "Find an azd template for what you want to build. Explore the stack, understand the requirements, then make it yours."}</p></div><aside class="hero-aside"><b>Not sure which services you need?</b><p>Start with a goal and your preferred language. We'll narrow the sample catalog without guessing readiness.</p><a href="${listingUrl("pathfinder")}">Try the guided start &#8594;</a></aside></section>
      ${searchBox()}${collectionTabs()}<button class="button filter-toggle" id="filter-toggle" aria-expanded="${filtersOpen}" aria-controls="catalog-filters">Filters</button><div class="catalog-layout"><aside class="filter-sidebar" id="catalog-filters" data-mobile-open="${filtersOpen}" aria-label="Filter templates"><div class="filter-title"><b>Filter by</b><button class="link-button" data-reset>Clear all</button></div>${facet("tasks", "What you want to build", tasks, "task")}${facet("languages", "Language", languages, "languages")}${facet("hosts", "Verified default host", hosts, "host")}<p class="filter-note">OR within a group, AND between groups. Unknown default hosts do not match a hosting filter. Counts show the sample collection, before filters.</p></aside><section aria-label="Template results"><div class="results-toolbar"><span id="result-count"></span>${sortControl()}</div><div class="active-filters" id="active-filters"></div><div class="template-grid" id="results"></div></section></div></div>`;
  }
  function renderGuided() {
    const step = state.step;
    const goal = state.tasks[0];
    let content;
    if (step === 1) {
      content = `<p class="eyebrow">A LITTLE DIRECTION GOES A LONG WAY</p><h1>What do you<br>want to build?</h1><p>You don't need to know the Azure service names. Start with the problem you want to solve.</p><div class="guide-choices">${tasks.map((task, index) => `<button class="guide-choice" data-goal="${escape(task)}"><span>0${index + 1}</span><div><b>${escape(task)}</b><small>${escape(descriptions[task])}</small></div><i aria-hidden="true">&#8594;</i></button>`).join("")}</div>`;
    } else if (step === 2) {
      content = `<p class="eyebrow">YOUR GOAL / ${escape(goal.toUpperCase())}</p><h1>What language<br>feels like home?</h1><p>We'll match your goal and language. That's it. No account, no deployment, no AI-generated guesswork.</p><div class="guide-stack">${languages.map(language => `<button data-stack="${escape(language)}">${escape(language)}</button>`).join("")}<button data-stack="">No preference</button></div>`;
    } else {
      content = `<p class="eyebrow">YOUR STARTING POINT / NOT A READINESS GUARANTEE</p><h1>A smaller shortlist.<br>A clearer next step.</h1><p>${escape(goal)}${state.languages.length ? `, using ${escape(state.languages.join(" or "))}` : ", in any language"}. Open a template to review its stack, requirements, and supported setup.</p><button class="link-button" data-step="2">Change language</button>`;
    }
    return `<section class="guide-main"><div class="product-wrap"><div class="guide-topline"><span>GUIDED START &middot; STEP ${step} OF 3</span><a href="${root}explore.html?direction=catalog">Browse all templates &#8599;</a></div><div class="guide-intro">${step > 1 ? `<button class="link-button" data-step="${step - 1}" style="margin-bottom:1.5rem">&#8592; Back</button>` : ""}${content}<div class="guide-note">Deterministic matching against ${data.length} sample records. No model call. No hidden scoring. ${collection ? "You are browsing the AI collection." : "All azd templates remain part of the same catalog."}</div></div></div></section>${step === 3 ? `<section class="guide-results product-wrap" aria-label="Matching templates"><div class="results-toolbar"><span id="result-count"></span>${sortControl()}</div><div class="active-filters" id="active-filters"></div><div class="template-grid" id="results"></div></section>` : ""}`;
  }
  function selectFacet(name, label, values) {
    const selected = state[name][0];
    return `<label><span class="sr-only">${label}</span><select class="finder-select" aria-label="${label}" data-select-facet="${name}"><option value="">${label}: all</option>${values.map(value => `<option ${selected === value ? "selected" : ""}>${escape(value)}</option>`).join("")}</select></label>`;
  }
  function renderAtlas() {
    return `<section class="atlas-hero"><div class="product-wrap"><div><p class="eyebrow">LOOK INSIDE BEFORE YOU BUILD</p><h1>An architecture<br>you can start from.</h1><p>See how the pieces connect. Choose a service to find templates that declare it, then check the default host and full requirements. ${collection ? "Viewing the AI collection." : "AI and non-AI templates, together."}</p></div><div>${flow(data[0])}<div class="atlas-key">AN EXAMPLE CONCEPTUAL FLOW &middot; NOT DEPLOYMENT VALIDATION</div></div></div></section><div class="product-wrap">${collectionTabs()}<div class="atlas-filters">${searchBox()}${selectFacet("services", "Declared service", services)}${selectFacet("hosts", "Verified default host", hosts)}${selectFacet("tasks", "Task", tasks)}${selectFacet("languages", "Language", languages)}<button class="link-button" data-reset>Reset</button></div><p class="filter-note">Service tags describe declared integrations, not default provisioning. A hosting filter only matches a verified default host.</p><section style="padding-block:2rem 4rem" aria-label="Blueprint results"><div class="results-toolbar"><span id="result-count"></span>${sortControl()}</div><div class="active-filters" id="active-filters"></div><div class="atlas-grid" id="results"></div></section></div>`;
  }
  function renderResults() {
    const container = document.getElementById("results");
    const announcement = document.getElementById("results-announcement");
    if (!container) {
      announcement.textContent = `Guided start, step ${state.step} of 3.`;
      return;
    }
    const results = matches();
    const summary = `${results.length} of ${data.length} sample templates${state.q ? ` for "${state.q}"` : ""}`;
    document.getElementById("result-count").textContent = summary;
    announcement.textContent = summary;
    container.innerHTML = results.length ? results.map(template => direction === "blueprints" ? blueprint(template) : card(template, direction === "pathfinder")).join("") :
      `<div class="empty-state"><h2>No sample templates match every filter.</h2><p>Try a different task or language. Unknown hosting never counts as a confirmed match. The full catalog may have more options.</p><button class="button" data-reset>${direction === "pathfinder" ? "Start again" : "Clear search and filters"}</button></div>`;
    const chips = [];
    if (state.q) chips.push(`<button class="filter-chip" data-remove="q">Search: ${escape(state.q)} &#215;</button>`);
    for (const name of ["tasks", "languages", "hosts", "services"]) {
      for (const value of state[name]) chips.push(`<button class="filter-chip" data-remove="${name}" data-value="${escape(value)}" aria-label="Remove filter: ${escape(value)}">${escape(value)} &#215;</button>`);
    }
    document.getElementById("active-filters").innerHTML = chips.join("");
    const filterToggle = document.getElementById("filter-toggle");
    if (filterToggle) {
      const count = state.tasks.length + state.languages.length + state.hosts.length + state.services.length;
      filterToggle.textContent = `Filters${count ? ` (${count} active)` : ""}`;
    }
  }
  function render(focusHeading = false, push = false) {
    mount.innerHTML = direction === "catalog" ? renderCatalog() : direction === "pathfinder" ? renderGuided() : renderAtlas();
    syncUrl(push);
    renderResults();
    if (focusHeading) {
      const heading = mount.querySelector("h1");
      heading.tabIndex = -1;
      heading.focus({ preventScroll: true });
      mount.scrollIntoView({ behavior: "instant" });
    }
  }
  mount.addEventListener("input", event => {
    if (event.target.id !== "template-search") return;
    state.q = event.target.value;
    syncUrl();
    renderResults();
  });
  mount.addEventListener("change", event => {
    const input = event.target;
    if (input.id === "sort") state.sort = input.value;
    else if (input.dataset.selectFacet) state[input.dataset.selectFacet] = input.value ? [input.value] : [];
    else if (input.matches('input[type="checkbox"]')) {
      state[input.name] = input.checked ? unique([...state[input.name], input.value]) : state[input.name].filter(value => value !== input.value);
    } else return;
    syncUrl();
    renderResults();
  });
  mount.addEventListener("click", event => {
    const target = event.target.closest("button");
    if (!target) return;
    if (target.id === "filter-toggle") {
      filtersOpen = !filtersOpen;
      target.setAttribute("aria-expanded", String(filtersOpen));
      document.getElementById("catalog-filters").dataset.mobileOpen = String(filtersOpen);
    } else if (target.hasAttribute("data-reset")) {
      state.q = ""; state.tasks = []; state.languages = []; state.hosts = []; state.services = []; state.step = 1;
      render(direction === "pathfinder", direction === "pathfinder");
      if (direction !== "pathfinder") document.getElementById("template-search").focus();
    } else if (target.dataset.remove) {
      if (target.dataset.remove === "q") state.q = "";
      else state[target.dataset.remove] = state[target.dataset.remove].filter(value => value !== target.dataset.value);
      const resetGuidedStep = direction === "pathfinder" && !state.tasks.length;
      if (resetGuidedStep) state.step = 1;
      render(resetGuidedStep, resetGuidedStep);
      if (!resetGuidedStep) (mount.querySelector(".filter-chip") || document.getElementById("template-search")).focus();
    } else if (target.dataset.goal) {
      state.tasks = [target.dataset.goal]; state.languages = []; state.hosts = []; state.q = ""; state.step = 2;
      render(true, true);
    } else if (target.hasAttribute("data-stack")) {
      state.languages = target.dataset.stack ? [target.dataset.stack] : []; state.step = 3;
      render(true, true);
    } else if (target.dataset.step) {
      state.step = Number(target.dataset.step);
      render(true, true);
    }
  });
  window.addEventListener("popstate", () => {
    Object.assign(state, readState());
    render(true);
  });
  document.addEventListener("keydown", event => {
    if (event.key === "/" && !event.ctrlKey && !event.metaKey && !["INPUT", "SELECT", "TEXTAREA"].includes(document.activeElement.tagName)) {
      const search = document.getElementById("template-search");
      if (search) { event.preventDefault(); search.focus(); }
    }
    if (event.key === "Escape" && document.activeElement.id === "template-search" && state.q) {
      state.q = ""; document.activeElement.value = ""; syncUrl(); renderResults();
    }
  });
  document.title = `${collection ? "AI collection" : "Templates"} / ${{catalog: "Catalog first", pathfinder: "Guided start", blueprints: "Blueprint atlas"}[direction]} | Awesome azd concept`;
  render();
})();
