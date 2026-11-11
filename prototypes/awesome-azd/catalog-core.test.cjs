const { test } = require("node:test");
const assert = require("node:assert/strict");
const { existsSync, readFileSync } = require("node:fs");
const path = require("node:path");
const C = require("./catalog-core.js");
const { templates } = require("./templates.json");
const ids = state => C.filter(templates, state).map(template => template.id);

test("the official-style navbar has only Templates interactive and no attribution strip", () => {
  const pages = [
    ["catalog.html", ""],
    ["catalog-no-hero.html", ""],
    ["catalog-hero-cta.html", ""],
    ["catalog-hero-link.html", ""],
    ["start-with-code.html", ""],
    [path.join("templates", ...templates[0].id.split("/"), "index.html"), "../../../"]
  ];
  assert(existsSync(path.join(__dirname, "assets", "azd-logo.png")));
  assert(existsSync(path.join(__dirname, "assets", "official-navbar-LICENSE.txt")));
  for (const [filename, root] of pages) {
    const html = readFileSync(path.join(__dirname, filename), "utf8");
    const header = html.match(/<header class="product-header selected-header">[\s\S]*?<\/header>/)[0];
    const links = [...header.matchAll(/<a href="([^"]+)"[^>]*>([^<]+)<\/a>/g)];
    assert.equal((header.match(/<a\b/g) || []).length, 1);
    assert.deepEqual(links.map(link => [link[1], link[2]]), [[`${root}catalog.html`, "Templates"]]);
    assert(!/<(?:button|input|select|textarea)\b|\btabindex=/i.test(header));
    assert(header.includes(`src="${root}assets/azd-logo.png"`));
    for (const item of ["Extensions", "Hosting", "Contribute", "Docs", "Resources", "Add a template"]) assert(header.includes(item));
    assert(!html.includes('class="creator"'));
  }
});

test("facets intersect across groups and union within a group", () => {
  const state = C.parse("?language=Python,C%23+%2F+.NET&framework=Blazor&host=Azure+Container+Apps", templates);
  assert.deepEqual(ids(state), ["azure-samples/azure-search-openai-demo-csharp"]);
  state.frameworks = [];
  assert(ids(state).includes("azure-samples/azure-search-openai-demo"));
  assert(ids(state).includes("fboucher/aspireazstorage"));
  assert(!ids(state).includes("azure-samples/azure-search-openai-demo-java"));
});

test("query round trip preserves service, framework, database, IaC, authorship, tools and topics", () => {
  const state = C.parse("?service=Azure+Container+Apps&framework=.NET+Aspire&database=Azure+Table+Storage&iac=Bicep&authorship=Community&tool=Docker&topic=Observability", templates);
  const restored = C.parse(C.serialize(state), templates);
  assert.deepEqual(restored, state);
  assert.deepEqual(ids(restored), ["fboucher/aspireazstorage"]);
});

test("AI app type filters combine with stack preferences and use readable chips", () => {
  const state = C.parse("?type=ai&language=Python&sort=za", templates);
  const results = C.filter(templates, state);
  assert.deepEqual(state.types, ["ai"]);
  assert(results.length > 1);
  assert(results.every(template => template.collections.includes("ai") && template.languages.includes("Python")));
  assert.deepEqual(C.parse(C.serialize(state), templates), state);
  assert(C.chips(state).includes('aria-label="Remove filter: AI application"'));
  state.languages = ["PHP"];
  assert.deepEqual(C.filter(templates, state), []);
});

test("Use case shows all eight requested choices in order and preserves saved criteria", () => {
  const panel = C.filterPanel(templates, C.parse("", templates));
  const group = panel.match(/<details class="catalog-facet" data-facet-section="tasks"[\s\S]*?<\/details>/)[0];
  assert.deepEqual([...group.matchAll(/<span class="catalog-filter-value"><span>([^<]+)<\/span>/g)].map(match => match[1]), [
    "Web apps", "APIs", "AI agents", "MCP servers",
    "Document Q&A", "Data queries with AI", "Workflow automation", "Infrastructure"
  ].map(C.escape));
  const saved = C.parse("?task=Chat+with+documents", templates);
  assert(C.filter(templates, saved).length > 0);
  assert(C.chips(saved).includes(C.escape("Document Q&A")));
  const api = C.parse("?task=Build+an+API", templates);
  assert.deepEqual(api.tasks, ["Build an API"]);
  assert.deepEqual(C.filter(templates, api), []);
});

test("alphabetical sorting works in both directions with filters and saved navigation", () => {
  const originalIds = templates.map(template => template.id);
  for (const sort of ["az", "za"]) {
    const state = C.parse(`?sort=${sort}&language=Python`, templates);
    const results = C.filter(templates, state);
    assert(results.length > 1);
    assert(results.every(template => template.languages.includes("Python")));
    assert.deepEqual(results.map(template => template.title), results.map(template => template.title).sort((a, b) => (sort === "za" ? -1 : 1) * a.localeCompare(b)));
    assert.deepEqual(C.parse(C.serialize(state), templates), state);
    const link = C.detailUrl(results[0], { state });
    assert.equal(new URLSearchParams(link.split("?")[1]).get("sort"), sort);
  }
  assert.deepEqual(templates.map(template => template.id), originalIds);
});

test("product navigation returns to the catalog, not the design-study landing page", () => {
  const state = C.parse("?language=Python&framework=React", templates);
  assert.equal(C.listingUrl({ state }), "catalog.html?language=Python&framework=React");
  assert.equal(C.listingUrl({ root: "../../../", state }), "../../../catalog.html?language=Python&framework=React");
  assert.equal(C.listingUrl({ state, collection: "ai" }), "catalog.html?type=ai&language=Python&framework=React");
  assert.equal(C.listingUrl({ state, finder: true }), "catalog.html?language=Python&framework=React");
  assert.equal(C.listingUrl({ state, collection: "ai", finder: true }), "catalog.html?type=ai&language=Python&framework=React");
});

test("the no-hero variant is preserved across collections and template navigation", () => {
  const state = C.parse("?language=Python&sort=za", templates);
  assert.equal(C.listingUrl({ state, hero: false }), "catalog-no-hero.html?language=Python&sort=za");
  assert.equal(C.listingUrl({ root: "../../", state, collection: "ai", hero: false }), "../../catalog-no-hero.html?type=ai&language=Python&sort=za");
  const detail = C.detailUrl(templates[0], { state, hero: false });
  assert.equal(new URLSearchParams(detail.split("?")[1]).get("hero"), "off");
  for (const filename of ["catalog-no-hero.html"]) {
    const html = readFileSync(path.join(__dirname, filename), "utf8");
    assert(!html.includes('<section class="selected-hero">'));
    assert(html.includes('data-hero="false"'));
    assert(html.includes('<h1 class="sr-only">'));
    assert(html.includes('id="catalog-search"'));
    assert(html.includes('id="catalog-sort"'));
    assert(html.includes('hero=off'));
  }
});

test("a declared host service does not establish a default host", () => {
  const state = C.parse("?language=Java&service=Azure+Container+Apps", templates);
  assert.deepEqual(ids(state), ["azure-samples/azure-search-openai-demo-java"]);
  state.hosts = ["Azure Container Apps"];
  assert.deepEqual(ids(state), []);
});

test("plain-language examples become inspectable metadata constraints", () => {
  const idea = C.infer("A Python app that answers questions about PDFs", templates);
  assert.deepEqual(idea.state.tasks, ["Chat with documents"]);
  assert.deepEqual(idea.state.languages, ["Python"]);
  assert.equal(idea.state.q, "");
  assert(C.chips(idea.state).includes('data-remove="tasks"'));
  assert(C.chips(idea.state).includes('data-remove="languages"'));
  assert.deepEqual(ids(C.infer("A Python app to chat with PDF documents on Container Apps", templates).state), ["azure-samples/azure-search-openai-demo"]);
  assert.deepEqual(ids(C.infer("A TypeScript MCP server on Azure Functions", templates).state), ["azure-samples/remote-mcp-functions-typescript"]);
  assert.deepEqual(ids(C.infer("Django with PostgreSQL on App Service", templates).state), ["azure-samples/msdocs-django-postgresql-sample-app"]);
});

test("catalog discovery keeps keyword search without app-description controls or hero stats", () => {
  for (const filename of ["catalog.html", "catalog-no-hero.html"]) {
    const html = readFileSync(path.join(__dirname, filename), "utf8");
    const hero = html.match(/<section class="selected-hero[^"]*">[\s\S]*?<\/section>/)?.[0] || "";
    assert(!hero.includes("<br>"));
    assert(!hero.includes("<dl"));
    assert(!hero.includes("hero-stat"));
    assert(html.includes('id="catalog-search" type="search"'));
    assert(!html.includes('id="catalog-describe"'));
    assert(!html.includes('id="catalog-idea"'));
    assert(!html.includes("Or describe the app you want to build"));
    assert(!html.includes('id="catalog-result-heading"'));
    assert(!html.includes('id="catalog-result-count"'));
    assert(html.includes('id="catalog-status" class="sr-only" role="status"'));
    assert(html.includes('id="catalog-active-filters" role="group" aria-label="Applied filters"'));
    assert(!html.includes('name="goal"'));
    assert(!html.includes("Find a template for your goal"));
    assert(!html.includes('aria-label="Template collections"'));
    assert(html.includes('data-facet-section="types" open'));
    assert(html.includes('data-facet="types" value="ai"'));
    assert(html.includes('placeholder="Describe the app you want to build or search with keywords"'));
  }
});

test("catalog search and sorting share a toolbar above the filters and results", () => {
  for (const filename of ["catalog.html", "catalog-no-hero.html"]) {
    const html = readFileSync(path.join(__dirname, filename), "utf8");
    const discovery = html.indexOf('id="catalog-discovery"');
    const search = html.indexOf('id="catalog-search"');
    const sort = html.indexOf('id="catalog-sort"');
    const results = html.indexOf('<div class="selected-catalog-layout">');
    assert(discovery >= 0 && discovery < search && search < sort && sort < results);
    assert.equal([...html.matchAll(/id="catalog-sort"/g)].length, 1);
    assert.match(html.slice(discovery, results), /class="catalog-sort-control"/);
    const dropdown = html.match(/<select id="catalog-sort"[\s\S]*?<\/select>/)[0];
    assert.deepEqual([...dropdown.matchAll(/<option[^>]*>([^<]+)<\/option>/g)].map(match => match[1]), [
      "Most Popular", "New to Old", "Old to New", "Alphabetical (A - Z)", "Alphabetical (Z - A)"
    ]);
    assert(dropdown.includes('<option value="oldest" disabled>Old to New</option>'));
    assert(dropdown.includes('<option value="newest" disabled>New to Old</option>'));
  }
});

test("catalog CTAs navigate to the standalone setup page instead of opening a dialog", () => {
  for (const filename of ["catalog.html", "catalog-no-hero.html"]) {
    const html = readFileSync(path.join(__dirname, filename), "utf8");
    const cta = html.match(/<a\b[^>]*data-start-code[^>]*>[\s\S]*?<\/a>/)[0];
    assert(cta.includes('href="start-with-code.html'));
    assert.doesNotMatch(cta, /&#8594;|\u2192/);
    assert(!html.includes("<dialog"));
    assert(!html.includes("data-open-setup"));
    if (filename === "catalog.html") {
      assert(!html.includes('class="catalog-own-code"'));
    } else {
      const ownCode = html.match(/<p class="catalog-own-code">[\s\S]*?<\/p>/)[0];
      assert(ownCode.includes("Start with my own code"));
      assert(!ownCode.includes("Have your own code?"));
      assert(ownCode.includes('href="start-with-code.html?hero=off" data-start-code'));
      assert(html.indexOf(ownCode) > html.indexOf('id="catalog-sort"'));
      assert(html.indexOf(ownCode) < html.indexOf('id="catalog-results"'));
    }
  }
});

test("the setup page includes both commands and the initialization choices", () => {
  const html = readFileSync(path.join(__dirname, "start-with-code.html"), "utf8");
  const heading = html.match(/<h1>([\s\S]*?)<\/h1>/)[1].replace(/<[^>]+>/g, "");
  assert.equal(heading, "Start with your own code");
  assert(!html.includes('class="catalog-start-intro"'));
  assert(!html.includes('class="catalog-start-step-number"'));
  assert.equal([...html.matchAll(/<section class="catalog-start-step"/g)].length, 2);
  assert(html.includes('<section class="catalog-start-prerequisite" aria-labelledby="start-install"><h2 id="start-install">Prerequisite: Install azd</h2>'));
  assert(html.includes('<h2 id="start-initialize">1. Initialize your app</h2>'));
  assert(html.includes('<h2 id="start-deploy">2. Provision and deploy</h2>'));
  assert.equal([...html.matchAll(/<pre><code[^>]*>/g)].length, 3);
  assert(html.includes('data-back-to-catalog href="catalog.html"'));
  assert.deepEqual([...html.matchAll(/<code[^>]*>([^<]+)<\/code>/g)].map(match => match[1]), ["winget install microsoft.azd", "azd init", "azd up"]);
  assert.deepEqual([...html.matchAll(/data-copy="([^"]+)"/g)].map(match => match[1]), ["winget install microsoft.azd", "azd init", "azd up"]);
  assert.deepEqual([...html.matchAll(/<option value="([^"]+)"/g)].map(match => match[1]), ["windows", "mac", "linux"]);
  assert(html.includes("How do you want to initialize your app?"));
  assert(html.includes('<dt>Scan current directory</dt>'));
  assert(html.includes('<dt>Set up with GitHub Copilot</dt>'));
  assert(!html.includes("Read the setup guide"));
  assert(!html.includes("Deploying to Azure can incur charges."));
});

test("setup page navigation preserves filters, sorting and the originating catalog variant", () => {
  const { runInNewContext } = require("node:vm");
  const script = readFileSync(path.join(__dirname, "start.js"), "utf8");
  const state = C.parse("?type=ai&language=Python&sort=za", templates);
  for (const options of [{ state }, { state, hero: false }, { state, layout: "hero-cta" }, { state, layout: "hero-link" }]) {
    const start = new URL(C.startUrl(options), "https://example.com/");
    const back = { href: "" };
    runInNewContext(script, {
      URLSearchParams,
      location: { search: start.search },
      window: { AzdCatalog: C, AZD_CATALOG: { templates } },
      document: { body: { dataset: { root: "" } }, querySelectorAll: () => [back] }
    });
    assert.equal(start.pathname, "/start-with-code.html");
    assert.deepEqual(C.parse(start.search, templates), state);
    assert.equal(back.href, C.listingUrl(options));
  }
});

test("the hero CTA variant moves the setup action into the hero and preserves return links", () => {
  const html = readFileSync(path.join(__dirname, "catalog-hero-cta.html"), "utf8");
  const hero = html.match(/<section class="selected-hero hero-cta-layout">[\s\S]*?<\/section>/)[0];
  assert(hero.includes('class="hero-code-action"'));
  assert(hero.includes('class="button blue" href="start-with-code.html?layout=hero-cta" data-start-code'));
  assert(hero.includes("Start with my own code"));
  assert(!html.includes('class="catalog-own-code"'));
  const state = C.parse("?language=Python&sort=za", templates);
  const detail = C.detailUrl(templates[0], { state, layout: "hero-cta" });
  assert.equal(new URLSearchParams(detail.split("?")[1]).get("layout"), "hero-cta");
  assert.equal(C.listingUrl({ state, layout: "hero-cta" }), "catalog-hero-cta.html?language=Python&sort=za");
});

test("the quieter hero uses a secondary button and preserves its own return navigation", () => {
  const html = readFileSync(path.join(__dirname, "catalog-hero-link.html"), "utf8");
  const hero = html.match(/<section class="selected-hero hero-cta-layout hero-link-layout">[\s\S]*?<\/section>/)[0];
  assert(hero.includes('class="button" href="start-with-code.html?layout=hero-link" data-start-code'));
  assert(hero.includes("Start with my own code"));
  assert(!hero.includes('class="button blue"'));
  assert(!html.includes('class="catalog-own-code"'));
  const state = C.parse("?language=Python&sort=za", templates);
  const detail = C.detailUrl(templates[0], { state, layout: "hero-link" });
  assert.equal(new URLSearchParams(detail.split("?")[1]).get("layout"), "hero-link");
  assert.equal(C.listingUrl({ state, layout: "hero-link" }), "catalog-hero-link.html?language=Python&sort=za");
});

test("the selected hero design is the main catalog and its detail links return to the main route", () => {
  const main = readFileSync(path.join(__dirname, "catalog.html"), "utf8");
  const prototype = readFileSync(path.join(__dirname, "catalog-hero-link.html"), "utf8");
  const hero = /<section class="selected-hero hero-cta-layout hero-link-layout">[\s\S]*?<\/section>/;
  const heroMarkup = html => html.match(hero)[0].replace(/ href="[^"]*"/g, "");
  assert.equal(heroMarkup(main), heroMarkup(prototype));
  assert(main.includes('data-layout=""'));
  const links = [...main.matchAll(/<a class="catalog-card-link" href="([^"]+)"/g)];
  assert(links.length > 0);
  assert(links.every(link => !link[1].includes("layout=")));
});

test("AI collection routes redirect to the type filter while preserving criteria and layout", () => {
  const { runInNewContext } = require("node:vm");
  for (const [filename, destination] of [["index.html", "catalog.html"], ["no-hero.html", "catalog-no-hero.html"]]) {
    const html = readFileSync(path.join(__dirname, "templates", "ai", filename), "utf8");
    const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
    let redirected;
    runInNewContext(script, {
      URLSearchParams,
      location: { search: "?language=Python&sort=za&collection=ai", hash: "#main", replace: value => { redirected = value; } }
    });
    const url = new URL(redirected, `https://example.com/templates/ai/${filename}`);
    assert.equal(url.pathname, `/${destination}`);
    assert.equal(url.searchParams.get("type"), "ai");
    assert.equal(url.searchParams.get("language"), "Python");
    assert.equal(url.searchParams.get("sort"), "za");
    assert.equal(url.searchParams.has("collection"), false);
    assert.equal(url.hash, "#main");
  }
});

test("legacy finder redirects keep saved criteria and collection without a second goal picker", () => {
  const { runInNewContext } = require("node:vm");
  const html = readFileSync(path.join(__dirname, "find.html"), "utf8");
  assert(!html.includes('id="template-finder"'));
  assert(html.includes('href="catalog.html"'));
  const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
  for (const [search, expected] of [
    ["", "catalog.html"],
    ["?task=Chat+with+documents&language=Python", "catalog.html?task=Chat+with+documents&language=Python"],
    ["?collection=ai&language=Python&framework=Django", "templates/ai/index.html?language=Python&framework=Django"]
  ]) {
    let destination;
    runInNewContext(script, { URLSearchParams, location: { search, replace: value => { destination = value; } } });
    assert.equal(destination, expected);
  }
});

test("coding-agent retrieval lives in the catalog with working nested resource links", () => {
  for (const [filename, root] of [["catalog.html", ""], ["catalog-no-hero.html", ""]]) {
    const html = readFileSync(path.join(__dirname, filename), "utf8");
    assert(!html.includes("agents.html"));
    assert(!html.includes("catalog-agent-band"));
    const utility = html.match(/<section class="catalog-agent-utility"[\s\S]*?<\/section>/)[0];
    assert(utility.includes('id="coding-agent"'));
    assert(utility.includes('aria-labelledby="coding-agent-heading"'));
    assert(!utility.includes("<form"));
    for (const resource of ["llms.txt", "templates.json"]) {
      assert(utility.includes(`href="${root}${resource}"`));
      assert(existsSync(path.resolve(__dirname, path.dirname(filename), root, resource)));
    }
    const copyLink = utility.match(/data-copy="([^"]+)"/)[1];
    assert.equal(copyLink, new URL(`${root}llms.txt`, `https://hyoshis.github.io/cliux/prototypes/awesome-azd/${filename.replaceAll(path.sep, "/")}`).href);
    assert(html.includes(`rel="describedby" href="${root}llms.txt"`));
    assert(html.includes('rel="alternate" type="text/markdown" href="index.md"'));
  }
  for (const template of templates) {
    const html = readFileSync(path.join(__dirname, "templates", template.id, "index.html"), "utf8");
    assert(!html.includes("agents.html"));
    assert(html.includes('rel="alternate" type="text/markdown" href="index.md"'));
    assert(html.includes('rel="describedby" href="../../../llms.txt"'));
  }
});

test("AI app tiles and the template type option share the star icon", () => {
  const ai = templates.find(template => template.collections.includes("ai"));
  const other = templates.find(template => !template.collections.includes("ai"));
  const aiCard = C.card(ai);
  const otherCard = C.card(other);
  assert(aiCard.includes('class="catalog-card-ai" title="AI app template"'));
  assert(aiCard.includes("AI app template: "));
  assert(!otherCard.includes('class="catalog-card-ai"'));
  const state = C.parse("?type=ai", templates);
  const panel = C.filterPanel(templates, state);
  const typeGroup = panel.match(/<details class="catalog-facet" data-facet-section="types"[\s\S]*?<\/details>/)[0];
  assert(typeGroup.includes('value="ai" checked'));
  assert(typeGroup.includes(">AI application</span>"));
  assert(typeGroup.includes(aiCard.match(/<svg class="ai-template-icon"[\s\S]*?<\/svg>/)[0]));
});

test("the retired agents route redirects to catalog tools without a matching demo", () => {
  const html = readFileSync(path.join(__dirname, "agents.html"), "utf8");
  assert(html.includes('http-equiv="refresh" content="0; url=catalog.html#coding-agent"'));
  assert(html.includes('href="catalog.html#coding-agent"'));
  assert(!html.includes("agents.js"));
  assert(!html.includes("<form"));
  assert(!existsSync(path.join(__dirname, "agents.js")));
  for (const filename of ["index.html", "study.html", "explore.html", path.join("archive", "guided.html"), path.join("archive", "blueprints.html")]) {
    assert(!readFileSync(path.join(__dirname, filename), "utf8").includes("agents.html"), filename);
  }
});

test(".NET alias and missing application language stay distinct", () => {
  assert.deepEqual(ids(C.infer(".NET document chat", templates).state), ["azure-samples/azure-search-openai-demo-csharp"]);
  const state = C.parse("?iac=Terraform&language=Python", templates);
  assert.deepEqual(ids(state), []);
});

test("unsupported and negative requests are not silently converted into matches", () => {
  assert.equal(C.infer("quantum fluid simulation", templates).recognized, false);
  for (const phrase of ["document chat without Python", "document chat, no Python", "anything but Python", "I cannot use Python", "never use Java"]) {
    const negative = C.infer(phrase, templates);
    assert.equal(negative.recognized, false);
    assert(negative.warnings[0].includes("exclusions"));
  }
  const cost = C.infer("secure free Python document chat", templates);
  assert.equal(cost.recognized, true);
  assert(cost.warnings.some(warning => warning.includes("not validated")));
});

test("unavailable saved criteria are explicitly reported", () => {
  const ai = templates.filter(template => template.collections.includes("ai"));
  const state = C.parse("?framework=Django&language=Python", ai);
  assert.deepEqual(state.frameworks, []);
  assert.deepEqual(state.unavailable, ["Framework: Django"]);
});

test("escaped search content cannot become card markup or unescaped query attributes", () => {
  const state = C.parse("", templates);
  state.q = '"><img src=x onerror=alert(1)>';
  assert(C.chips(state).includes("&lt;img"));
  assert(!C.chips(state).includes("<img"));
  const link = C.detailUrl(templates[0], { state, from: "finder" });
  assert(link.includes("index.html?"));
  assert(!link.includes("<img"));
  assert.equal(new URLSearchParams(link.split("?")[1]).get("from"), "finder");
});

test("featured cards have distinct accessible labels and retain detail navigation context", () => {
  const template = templates[0];
  const state = C.parse("?sort=az", templates);
  const regular = C.card(template, { state });
  const featured = C.card(template, { state, featured: true });
  assert.match(featured, /class="catalog-card featured-card"/);
  assert.match(featured, /<h3 id="featured-[^"]+">/);
  assert.notEqual(featured.match(/aria-labelledby="([^"]+)"/)[1], regular.match(/aria-labelledby="([^"]+)"/)[1]);
  assert(featured.includes(`href="${C.escape(C.detailUrl(template, { state }))}"`));
  assert(!featured.includes("catalog-card-host"));
  const unhighlighted = C.card(template, { state, highlightFeatured: false });
  assert(!unhighlighted.includes("catalog-featured-badge"));
  assert(!unhighlighted.includes("promoted-card"));
});

test("the catalog defaults to featured templates followed by popularity", () => {
  const html = readFileSync(path.join(__dirname, "catalog.html"), "utf8");
  assert.match(html, /<section class="selected-hero(?: [^"]*)?"/);
  assert(!html.includes("catalog-design-switch"));
  assert(!html.includes("catalog-scope-note"));
  const results = html.slice(html.indexOf('id="catalog-results"'));
  const links = [...results.matchAll(/<article class="catalog-card promoted-card">\s*<a class="catalog-card-link" href="([^"]+)"/g)];
  assert.equal(links.length, 3);
  assert.equal(new Set(links.map(match => match[1])).size, 3);
  assert.equal(links[0][1], C.detailUrl(templates[0]));
  const cards = [...results.matchAll(/<article class="catalog-card(?: promoted-card)?">/g)];
  assert.equal(cards.length, 20);
  const cardLinks = [...results.matchAll(/<a class="catalog-card-link" href="([^"]+)"/g)].map(match => match[1]);
  assert.deepEqual(cardLinks, C.filter(templates, C.parse("", templates)).map(template => C.escape(C.detailUrl(template))));
  const elementIds = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
  assert.equal(new Set(elementIds).size, elementIds.length, "Featured and regular cards must not duplicate element IDs");
});

test("popularity pins featured results only before searching or filtering", () => {
  const records = [templates[0], templates[1]];
  const state = C.parse("", records);
  const resultIds = () => C.filter(records, state).map(template => template.id);
  assert.equal(state.sort, "popular");
  assert.deepEqual(resultIds(), [templates[0].id, templates[1].id]);
  state.q = "azure";
  assert.deepEqual(resultIds(), [templates[1].id, templates[0].id]);
  state.q = "";
  state.languages = ["Python"];
  assert.deepEqual(resultIds(), [templates[1].id, templates[0].id]);
});

test("all three featured templates stay first for every unfiltered sort order", () => {
  const featuredIds = templates.filter(template => template.featured).map(template => template.id).sort();
  assert.equal(featuredIds.length, 3);
  for (const sort of ["popular", "az", "za"]) {
    for (const q of ["", "   "]) {
      const state = C.parse(`?sort=${sort}`, templates);
      state.q = q;
      const results = C.filter(templates, state);
      assert.deepEqual(results.slice(0, 3).map(template => template.id).sort(), featuredIds);
      assert(results.slice(3).every(template => !template.featured));
    }
  }
});

test("Template type and Use case start expanded, Tools is hidden, and Authored by is last and collapsed", () => {
  const html = C.filterPanel(templates, C.parse("", templates));
  const groups = [...html.matchAll(/<details class="catalog-facet" data-facet-section="([^"]+)"([^>]*)>/g)];
  assert.deepEqual(groups.map(group => group[1]), ["types", "tasks", "languages", "frameworks", "databases", "iac", "authorship"]);
  assert(groups.slice(0, 2).every(group => /\bopen\b/.test(group[2])));
  assert(groups.slice(2).every(group => !/\bopen\b/.test(group[2])));
  const filtered = C.filterPanel(templates, C.parse("?language=Python", templates));
  assert(filtered.includes('data-facet-section="languages" open'));
});

test("popularity puts unknown star counts last and resolves ties alphabetically", () => {
  const records = [
    { ...templates[0], title: "Unknown", repositoryStats: undefined },
    { ...templates[0], title: "Zero", repositoryStats: { stars: 0 } },
    { ...templates[0], title: "Zulu", repositoryStats: { stars: 7 } },
    { ...templates[0], title: "Alpha", repositoryStats: { stars: 7 } }
  ];
  assert.deepEqual(C.filter(records, C.parse("", records)).map(template => template.title), ["Alpha", "Zulu", "Zero", "Unknown"]);
  assert.deepEqual(records.map(template => template.title), ["Unknown", "Zero", "Zulu", "Alpha"]);
});

test("card copy controls are outside the template link and hosting is a tag", () => {
  const template = templates[0];
  const html = C.card(template);
  const link = html.match(/<a class="catalog-card-link"[\s\S]*?<\/a>/)[0];
  assert(!link.includes("<button"));
  assert(html.includes(`data-copy="${C.escape(template.initCommand)}"`));
  assert(link.includes(`<span class="tag">${C.escape(template.host)}</span>`));
  assert(!html.includes("View template"));
  assert(!html.includes("catalog-card-host"));
  assert(!html.includes('class="catalog-task"'));
  assert(!html.includes('class="catalog-task-icon"'));
  assert(html.includes("Microsoft Authored"));
});

test("cards with unknown init commands link to setup instead of inventing a command", () => {
  const template = { ...templates[0], initCommand: null };
  const html = C.card(template);
  assert(!html.includes("catalog-copy-command"));
  assert(html.includes(`href="${C.escape(template.readme)}"`));
  assert(html.includes("View setup instructions"));
});

test("repository stars render compactly without showing forks or replacing authorship", () => {
  const template = { ...templates[0], repositoryStats: { forks: 5474, stars: 7801 } };
  const html = C.card(template);
  assert(!html.includes("5.5k"));
  assert(html.includes("7.8k"));
  assert(!html.includes("5,474 forks"));
  assert(html.includes("7,801 stars"));
  assert(html.includes("Microsoft Authored"));
  assert(html.includes("catalog-featured-badge"));
});

test("preview option counts respect filters while group counts describe filter items", () => {
  const records = [templates[0], templates[1]];
  const weights = { [records[0].id]: 7, [records[1].id]: 3 };
  const state = C.parse("", records);
  assert.equal(C.count(C.filter(records, state), weights), 10);
  state.tasks = [records[0].task];
  assert.equal(C.count(C.filter(records, state), weights), 7);
  const html = C.filterPanel(records, state, weights);
  assert(html.includes('title="Filter items">2</span>'));
  assert.throws(() => C.count(records, {}), /Invalid preview weight/);
});
