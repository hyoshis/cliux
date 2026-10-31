const { test } = require("node:test");
const assert = require("node:assert/strict");
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
  assert.equal(C.listingUrl({ state, finder: true }), "find.html?language=Python&framework=React");
});

test("a declared host service does not establish a default host", () => {
  const state = C.parse("?language=Java&service=Azure+Container+Apps", templates);
  assert.deepEqual(ids(state), ["azure-samples/azure-search-openai-demo-java"]);
  state.hosts = ["Azure Container Apps"];
  assert.deepEqual(ids(state), []);
});

test("plain-language examples become inspectable metadata constraints", () => {
  assert.deepEqual(ids(C.infer("A Python app to chat with PDF documents on Container Apps", templates).state), ["azure-samples/azure-search-openai-demo"]);
  assert.deepEqual(ids(C.infer("A TypeScript MCP server on Azure Functions", templates).state), ["azure-samples/remote-mcp-functions-typescript"]);
  assert.deepEqual(ids(C.infer("Django with PostgreSQL on App Service", templates).state), ["azure-samples/msdocs-django-postgresql-sample-app"]);
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
