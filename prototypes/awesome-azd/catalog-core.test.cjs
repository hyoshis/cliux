const { test } = require("node:test");
const assert = require("node:assert/strict");
const { existsSync, readFileSync } = require("node:fs");
const path = require("node:path");
const C = require("./catalog-core.js");
const { templates } = require("./templates.json");
const ids = state => C.filter(templates, state).map(template => template.id);

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

test("product navigation returns to the catalog, not the design-study landing page", () => {
  const state = C.parse("?language=Python&framework=React", templates);
  assert.equal(C.listingUrl({ state }), "catalog.html?language=Python&framework=React");
  assert.equal(C.listingUrl({ root: "../../../", state }), "../../../catalog.html?language=Python&framework=React");
  assert.equal(C.listingUrl({ state, collection: "ai" }), "templates/ai/index.html?language=Python&framework=React");
  assert.equal(C.listingUrl({ state, finder: true }), "catalog.html?language=Python&framework=React#catalog-describe");
  assert.equal(C.listingUrl({ state, collection: "ai", finder: true }), "templates/ai/index.html?language=Python&framework=React#catalog-describe");
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

test("app descriptions share the catalog results without duplicating goal selection", () => {
  for (const filename of ["catalog.html", path.join("templates", "ai", "index.html")]) {
    const html = readFileSync(path.join(__dirname, filename), "utf8");
    assert(html.includes('<summary>Describe your app</summary>'));
    assert(html.includes('id="catalog-idea-form"'));
    assert(html.includes('id="catalog-active-filters" role="group" aria-label="Applied filters"'));
    assert(!html.includes('name="goal"'));
    assert(!html.includes("Find a template for your goal"));
  }
});

test("legacy finder redirects keep saved criteria and collection without a second goal picker", () => {
  const { runInNewContext } = require("node:vm");
  const html = readFileSync(path.join(__dirname, "find.html"), "utf8");
  assert(!html.includes('id="template-finder"'));
  assert(html.includes('href="catalog.html#catalog-describe"'));
  const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
  for (const [search, expected] of [
    ["", "catalog.html#catalog-describe"],
    ["?task=Chat+with+documents&language=Python", "catalog.html?task=Chat+with+documents&language=Python#catalog-describe"],
    ["?collection=ai&language=Python&framework=Django", "templates/ai/index.html?language=Python&framework=Django#catalog-describe"]
  ]) {
    let destination;
    runInNewContext(script, { URLSearchParams, location: { search, replace: value => { destination = value; } } });
    assert.equal(destination, expected);
  }
});

test("coding-agent retrieval lives in the catalog with working nested resource links", () => {
  for (const [filename, root] of [["catalog.html", ""], [path.join("templates", "ai", "index.html"), "../../"]]) {
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

test("the original catalog shows the AI agent first among three featured templates", () => {
  const html = readFileSync(path.join(__dirname, "catalog.html"), "utf8");
  assert(html.includes('<section class="selected-hero"'));
  assert(!html.includes("catalog-design-switch"));
  assert(!html.includes("catalog-scope-note"));
  const results = html.slice(html.indexOf('id="catalog-results"'));
  const links = [...results.matchAll(/<article class="catalog-card promoted-card">\s*<a class="catalog-card-link" href="([^"]+)"/g)];
  assert.equal(links.length, 3);
  assert.equal(new Set(links.map(match => match[1])).size, 3);
  assert.equal(links[0][1], C.detailUrl(templates[0]));
  const cards = [...results.matchAll(/<article class="catalog-card(?: promoted-card)?">/g)];
  assert.equal(cards.length, 20);
  const elementIds = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
  assert.equal(new Set(elementIds).size, elementIds.length, "Featured and regular cards must not duplicate element IDs");
});

test("featured templates are promoted only before a search or filter is applied", () => {
  const records = [templates[1], templates[0]];
  const state = C.parse("", records);
  const resultIds = () => C.filter(records, state).map(template => template.id);
  assert.deepEqual(resultIds(), [templates[0].id, templates[1].id]);
  state.q = "azure";
  assert.deepEqual(resultIds(), records.map(template => template.id));
  state.q = "";
  state.languages = ["Python"];
  assert.deepEqual(resultIds(), records.map(template => template.id));
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
