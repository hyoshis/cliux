import { readFile, mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import assert from "node:assert/strict";
import Catalog from "./catalog-core.js";

const directory = path.dirname(fileURLToPath(import.meta.url));
const catalog = JSON.parse(await readFile(path.join(directory, "templates.json"), "utf8"));
const { catalogTotal, aiTotal, serviceTotal, languageTotal, pageSize, previewWeights } = catalog.display;
assert(Number.isInteger(catalogTotal) && catalogTotal >= catalog.templates.length);
assert(Number.isInteger(pageSize) && pageSize > 0);
for (const value of [aiTotal, serviceTotal, languageTotal]) assert(Number.isInteger(value) && value > 0);
assert.equal(Catalog.count(catalog.templates, previewWeights), catalogTotal, "Preview weights must total the displayed catalog size.");
assert.equal(Catalog.count(catalog.templates.filter(template => template.collections.includes("ai")), previewWeights), aiTotal, "AI preview weights must total the displayed AI collection size.");
const check = process.argv.includes("--check");
const baseUrl = "https://hyoshis.github.io/cliux/prototypes/awesome-azd/";
const { escape, facets, parse, card, filterPanel, icon } = Catalog;
const ids = new Set();
const sourceIds = new Set();
for (const template of catalog.templates) {
  assert.match(template.id, /^[a-z0-9_.-]+\/[a-z0-9_.-]+$/, "IDs must be lowercase owner/repository pairs.");
  assert(!ids.has(template.id), `Duplicate identity: ${template.id}`);
  assert(!sourceIds.has(template.sourceId.toLowerCase()), `Duplicate UUID: ${template.sourceId}`);
  assert.match(template.sourceId, /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i);
  assert.equal(template.repository.toLowerCase(), `https://github.com/${template.id}`);
  for (const field of ["languages", "services", "frameworks", "databases", "tools", "topics", "features", "collections"]) assert(Array.isArray(template[field]), `${template.id}: ${field} must be an array.`);
  assert(template.prerequisites === null || (Array.isArray(template.prerequisites) && template.prerequisites.length));
  assert(template.host === null || template.services.includes(template.host));
  assert(template.initCommand === null || template.initCommand.startsWith("azd init -t "));
  if (template.repositoryStats) {
    for (const key of ["forks", "stars"]) assert(Number.isInteger(template.repositoryStats[key]) && template.repositoryStats[key] >= 0, `${template.id}: invalid ${key} snapshot.`);
  }
  assert(template.flow.length > 1);
  for (const url of [template.repository, template.readme, template.launchUrl].filter(Boolean)) assert.equal(new URL(url).protocol, "https:");
  if (template.detail != null) {
    const detail = template.detail;
    assert(typeof detail === "object" && !Array.isArray(detail), `${template.id}: detail must be an object.`);
    for (const field of ["title", "about", "lastUpdated"]) {
      if (detail[field] != null) assert(typeof detail[field] === "string" && detail[field].trim(), `${template.id}: invalid detail ${field}.`);
    }
    for (const field of ["creators", "languages", "models", "tags", "resources"]) {
      if (detail[field] != null) assert(Array.isArray(detail[field]), `${template.id}: detail ${field} must be an array.`);
    }
    for (const image of [detail.aboutImage, detail.architectureImage].filter(image => image != null)) {
      assert(typeof image.alt === "string" && image.alt.trim(), `${template.id}: images need alternative text.`);
      assert.equal(new URL(image.src).protocol, "https:");
    }
    for (const creator of detail.creators ?? []) {
      assert(typeof creator.name === "string" && creator.name.trim(), `${template.id}: creators need names.`);
      if (creator.url != null) assert.equal(new URL(creator.url).protocol, "https:");
    }
    for (const value of [...(detail.languages ?? []), ...(detail.models ?? []), ...(detail.tags ?? [])]) assert(typeof value === "string" && value.trim());
    for (const resource of detail.resources ?? []) {
      assert(typeof resource.name === "string" && resource.name.trim(), `${template.id}: resources need names.`);
      if (resource.description != null) assert(typeof resource.description === "string" && resource.description.trim());
      if (resource.icon != null) {
        assert(typeof resource.icon === "string" && resource.icon.trim(), `${template.id}: resource icons need URLs.`);
        assert.equal(new URL(resource.icon).protocol, "https:");
      }
    }
    for (const url of [detail.source, detail.codespacesUrl, detail.vscodeUrl].filter(Boolean)) assert.equal(new URL(url).protocol, "https:");
  }
  ids.add(template.id);
  sourceIds.add(template.sourceId.toLowerCase());
}
const artifacts = new Map();
function header(root = "", active = "templates") {
  return `<header class="product-header selected-header">
<span class="product-brand"><img class="product-logo" src="${root}assets/azd-logo.png" width="32" height="32" alt="">Azure Developer CLI</span>
<nav aria-label="Main"><a href="${root}catalog.html" ${active === "templates" ? 'aria-current="page"' : ""}>Templates</a><span>Extensions</span><span>Hosting <svg class="header-caret" viewBox="0 0 12 12" width="12" height="12" fill="currentColor" aria-hidden="true"><path d="m2 4 4 4 4-4z"/></svg></span><span>Contribute</span><span>Docs</span><span>Resources</span></nav>
<div class="header-end" aria-hidden="true"><span class="header-preview-icon"><svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M20.9 13A9 9 0 0 1 11 3.1 9 9 0 1 0 20.9 13Z"/></svg></span><span class="header-preview-icon"><svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/></svg></span><span class="header-add-template">Add a template</span></div>
</header>`;
}
function head(title, description, root = "", markdown = "", appendBrand = true) {
  return `<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex"><meta name="description" content="${escape(description)}"><title>${escape(title)}${appendBrand ? " | Awesome azd" : ""}</title><link rel="stylesheet" href="${root}styles.css"><link rel="stylesheet" href="${root}catalog.css"><link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&amp;family=JetBrains+Mono:wght@400;500&amp;display=swap"><link rel="describedby" href="${root}llms.txt">${markdown ? `<link rel="alternate" type="text/markdown" href="${markdown}">` : ""}<script src="${root}study.js" defer></script>`;
}
function footer(root = "") {
  return `<footer class="product-footer product-wrap selected-footer"><div><a href="${root}llms.txt">llms.txt</a><a href="${root}templates.json">Prototype JSON</a><a href="${root}index.html#audit">Research &amp; rationale</a></div></footer>`;
}
function agentUtility(root = "") {
  return `<section class="catalog-agent-utility" id="coding-agent" aria-labelledby="coding-agent-heading"><div><h2 id="coding-agent-heading">Use with your coding agent</h2><p>Share the catalog index to help your agent find templates and follow their setup instructions.</p><small>${catalog.templates.length} prototype examples, not the full live catalog.</small></div><div class="agent-utility-actions"><button class="button" data-copy="${baseUrl}llms.txt">Copy agent link</button><a class="text-link" href="${root}llms.txt">View llms.txt</a><a class="text-link" href="${root}templates.json">Prototype JSON</a></div></section>`;
}
function pagination(total, count) {
  const pages = Math.ceil(total / pageSize);
  const button = page => `<button type="button" disabled aria-label="Page ${page}" ${page === 1 ? 'aria-current="page"' : ""} title="Visual preview: only page 1 is populated.">${page}</button>`;
  return `<div class="catalog-pagination" id="catalog-pagination"><p>1&ndash;${count} of ${total} templates</p><nav aria-label="Pagination preview"><button type="button" disabled aria-label="Previous page">&#8592;</button>${Array.from({ length: Math.min(5, pages) }, (_, index) => button(index + 1)).join("")}${pages > 5 ? `<span aria-hidden="true">&hellip;</span>${button(pages)}` : ""}<button type="button" disabled aria-label="Next page" title="Visual preview: only page 1 is populated.">&#8594;</button></nav></div>`;
}
function startPage() {
  const installCommands = [["windows", "Windows", "winget install microsoft.azd"], ["mac", "macOS", "brew tap azure/azd && brew install azd"], ["linux", "Linux", "curl -fsSL https://aka.ms/install-azd.sh | bash"]];
  const copyIcon = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true"><rect x="8" y="8" width="11" height="13" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h3"/></svg>`;
  const [, , defaultInstall] = installCommands[0];
  const installCommand = `<div class="catalog-start-command catalog-start-install"><label class="catalog-start-os"><span class="sr-only">Operating system</span><select data-install-os>${installCommands.map(([value, label, text]) => `<option value="${value}" data-command="${escape(text)}">${label}</option>`).join("")}</select></label><pre><code data-install-command>${escape(defaultInstall)}</code></pre><button class="catalog-copy-command" type="button" data-copy="${escape(defaultInstall)}" data-install-copy aria-label="Copy install command" title="Copy command">${copyIcon}</button></div>`;
  const command = text => `<div class="catalog-start-command"><pre><code>${escape(text)}</code></pre><button class="catalog-copy-command" type="button" data-copy="${escape(text)}" aria-label="Copy ${escape(text)} command" title="Copy command"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true"><rect x="8" y="8" width="11" height="13" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h3"/></svg></button></div>`;
  return `<!doctype html>
<!-- Generated by node generate.mjs. Do not edit. -->
<html lang="en"><head>${head("Start with your own code", "Initialize and deploy a new app or your existing code with Azure Developer CLI.")}<link rel="canonical" href="${baseUrl}start-with-code.html"><script src="catalog.js" defer></script><script src="catalog-core.js" defer></script><script src="start.js" defer></script></head>
<body class="catalog-page" data-mode="start" data-root=""><a class="skip" href="#main">Skip to content</a>${header()}
<main id="main" class="product-wrap catalog-start-page"><div class="breadcrumb"><a data-back-to-catalog href="catalog.html">&#8592; Back to templates</a></div>
<h1>Start with your own code</h1><p class="catalog-start-lead">Start from scratch or use your existing code. Open a terminal in your project folder, or an empty folder for a new app.</p>
<div class="catalog-start-body">
<section class="catalog-start-prerequisite" aria-labelledby="start-install"><h2 id="start-install">Prerequisite: Install azd</h2><p>If you don't have the Azure Developer CLI yet, install it for your operating system:</p>${installCommand}</section>
<section class="catalog-start-step" aria-labelledby="start-initialize"><h2 id="start-initialize">1. Initialize your app</h2>${command("azd init")}<p>When prompted, use the arrow keys to pick one of these options:</p><figure class="catalog-start-terminal"><pre aria-label="azd init prompt with three options: Scan current directory, Select a template, and Set up with GitHub Copilot (Preview)"><span class="term-q">?</span> <span class="term-strong">How do you want to initialize your app?</span>  <span class="term-dim">[Use arrows to move, type to filter]</span>
<span class="term-pick">&gt; Scan current directory</span>
  <span class="term-dim">Select a template</span>
  <span class="term-pick">Set up with GitHub Copilot</span> <span class="term-preview">(Preview)</span></pre></figure><dl class="catalog-start-choices"><div><dt>Scan current directory</dt><dd>Prepares your existing app for Azure.</dd></div><div><dt>Set up with GitHub Copilot</dt><dd>Gets AI help building a new app or preparing existing code.</dd></div></dl></section>
<section class="catalog-start-step" aria-labelledby="start-deploy"><h2 id="start-deploy">2. Provision and deploy</h2><p>Review the generated files, then create the Azure resources and deploy your app:</p>${command("azd up")}</section>
</div>
</main>${footer()}</body></html>`;
}
function catalogPage(collection = "", { showHero = true, heroCta = false, heroLink = false, utilityCta = false, isMain = false } = {}) {
  const root = collection ? "../../" : "";
  const records = catalog.templates.filter(template => !collection || template.collections.includes(collection));
  const state = parse("", records);
  const visible = Catalog.filter(records, state).slice(0, pageSize);
  const total = collection ? aiTotal : catalogTotal;
  const heroLayout = !showHero ? "" : heroLink ? "hero-link" : heroCta ? "hero-cta" : "";
  const layout = isMain ? "" : heroLayout;
  const setupAction = className => `<a class="${escape(className)}" href="${escape(Catalog.startUrl({ root, state, collection, hero: showHero, layout }))}" data-start-code>Start with my own code</a>`;
  const discovery = `<div class="catalog-discovery enhanced-only" id="catalog-discovery"><div class="catalog-search-group"><div class="catalog-search selected-search"><span aria-hidden="true"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"><circle cx="10" cy="10" r="7"/><path d="m15.5 15.5 5.5 5.5"/></svg></span><label class="sr-only" for="catalog-search">Search templates</label><input id="catalog-search" type="search" placeholder="Describe the app you want to build or search with keywords" title="This prototype currently matches keywords. Natural-language matching is not connected." autocomplete="off"><kbd aria-hidden="true">/</kbd></div>
</div><div class="catalog-sort-group"><label class="catalog-sort-control"><span class="sr-only">Sort templates</span><select id="catalog-sort" aria-describedby="catalog-sort-help" title="Popularity is based on GitHub stars. Date sorting is a visual preview only."><option value="popular">Most Popular</option><option value="newest" disabled>New to Old</option><option value="oldest" disabled>Old to New</option><option value="az">Alphabetical (A - Z)</option><option value="za">Alphabetical (Z - A)</option></select></label>${heroLayout || !utilityCta ? "" : `<p class="catalog-own-code">${setupAction("link-button")}</p>`}</div><span id="catalog-sort-help" class="sr-only">Most Popular sorts by GitHub stars. Date sorting options are disabled previews.</span></div>`;
  const config = { root, state, collection, from: "catalog", hero: showHero, layout };
  const canonical = `${baseUrl}${collection ? "templates/ai/" : "catalog.html"}`;
  const listing = {
    "@context": "https://schema.org", "@type": "ItemList",
    name: collection ? "Awesome azd AI collection prototype" : "Awesome azd template catalog prototype",
    itemListElement: visible.map((template, index) => ({ "@type": "ListItem", position: index + 1, name: template.title, url: `${baseUrl}templates/${template.id}/` }))
  };
  return `<!doctype html>
<!-- Generated from templates.json by node generate.mjs. Do not edit. -->
<html lang="en"><head>${head(collection ? "AI templates" : "Awesome azd redesigned", "Discover, understand and start with an Azure Developer CLI template. Browse by goal, language, framework, Azure services and infrastructure.", root, "index.md", Boolean(collection))}<link rel="canonical" href="${canonical}"><script type="application/ld+json">${JSON.stringify(listing).replaceAll("<", "\\u003c")}</script><script src="${root}catalog.js" defer></script><script src="${root}catalog-core.js" defer></script><script src="${root}catalog-ui.js" defer></script></head>
<body class="catalog-page" data-root="${root}" data-collection="${collection}" data-mode="catalog" data-hero="${showHero}" data-layout="${layout}"><a class="skip" href="#main">Skip to content</a>${header(root)}
<main id="main"><div class="product-wrap">${showHero ? `<section class="selected-hero${heroLayout ? " hero-cta-layout" : ""}${heroLayout === "hero-link" ? " hero-link-layout" : ""}"><div class="hero-intro"><h1>${collection ? "Your next AI app." : "Your next app."} <span>Ready to build.</span></h1><p>Explore application and infrastructure templates to build and deploy on Azure.</p></div>${heroLayout ? `<div class="hero-code-action"><p>Have your own code, or starting from scratch?</p>${setupAction(heroLayout === "hero-link" ? "button" : "button blue")}</div>` : ""}</section>` : `<h1 class="sr-only">${collection ? "AI app templates" : "Templates"}</h1>`}
${discovery}
<noscript><style>.enhanced-only{display:none!important}.selected-catalog-layout{grid-template-columns:1fr!important}</style><p class="evidence-note">Interactive filtering needs JavaScript. All ${records.length} template detail pages below are fully readable without it. You can also use the <a href="${root}templates.json">catalog JSON</a>.</p></noscript>
<div id="catalog-status" class="sr-only" role="status" aria-live="polite" aria-atomic="true"></div><button class="button catalog-mobile-filters enhanced-only" id="catalog-filter-toggle" aria-controls="catalog-filters" aria-expanded="false">Filters</button>
<div class="selected-catalog-layout"><aside class="catalog-filter-panel enhanced-only" id="catalog-filters" aria-label="Template filters">${filterPanel(records, state, previewWeights)}</aside><section class="selected-results" aria-label="Template results"><div class="active-filters" id="catalog-active-filters" role="group" aria-label="Applied filters"></div><div class="selected-template-grid" id="catalog-results">${visible.map(template => card(template, config)).join("")}</div>${pagination(total, visible.length)}</section></div>
${agentUtility(root)}</div></main>${footer(root)}</body></html>
`;
}
function collectionRedirectPage(showHero = true) {
  const root = "../../";
  const destination = `${root}${showHero ? "catalog.html" : "catalog-no-hero.html"}`;
  return `<!doctype html>
<!-- Generated from templates.json by node generate.mjs. Do not edit. -->
<html lang="en"><head>${head("AI app templates", "Find AI apps using the catalog's Template type filter.", root, "index.md")}<script>
const query = new URLSearchParams(location.search);
query.set("type", "ai");
query.delete("collection");
location.replace("${destination}?" + query.toString() + location.hash);
</script></head>
<body class="catalog-page"><a class="skip" href="#main">Skip to content</a>${header(root)}
<main id="main" class="product-wrap"><section class="finder-hero"><h1>Find AI app templates in the catalog.</h1><p>Use the Template type filter to browse AI apps.</p><a class="button blue" href="${destination}?type=ai">Open AI app templates &#8594;</a></section></main>${footer(root)}</body></html>
`;
}
function finderPage() {
  return `<!doctype html>
<!-- Generated from templates.json by node generate.mjs. Do not edit. -->
<html lang="en"><head>${head("Find templates", "Search and filter templates directly in the catalog.", "", "find.md")}<script>
const query = new URLSearchParams(location.search);
const destination = query.get("collection") === "ai" ? "templates/ai/index.html" : "catalog.html";
query.delete("collection");
location.replace(destination + (query.size ? "?" + query.toString() : ""));
</script></head>
<body class="catalog-page"><a class="skip" href="#main">Skip to content</a>${header()}
<main id="main" class="product-wrap"><section class="finder-hero"><h1>Find templates in the catalog.</h1><p>Search by keyword or use filters to find your starting point.</p><p><a class="button blue" href="catalog.html">Open the template catalog &#8594;</a></p><p><a href="templates/ai/index.html">Open the AI collection &#8594;</a></p></section></main>${footer()}</body></html>`;
}
function agentRedirectPage() {
  return `<!doctype html>
<!-- Generated by node generate.mjs. Do not edit. -->
<html lang="en"><head>${head("Use with your coding agent", "Coding-agent links are now available directly in the template catalog.")}<meta http-equiv="refresh" content="0; url=catalog.html#coding-agent"></head>
<body class="catalog-page"><a class="skip" href="#main">Skip to content</a>${header()}
<main id="main" class="product-wrap"><section class="finder-hero"><h1>Coding-agent links have moved.</h1><p>Use the catalog index and shared template records directly from the gallery.</p><a class="button" href="catalog.html#coding-agent">Open the catalog tools &#8594;</a></section></main>${footer()}</body></html>
`;
}
function detailContent(template) {
  const detail = template.detail ?? {};
  return {
    title: detail.title ?? template.title,
    about: detail.about ?? template.description,
    aboutImage: detail.aboutImage,
    architectureImage: detail.architectureImage,
    creators: detail.creators ?? [{ name: template.author }],
    lastUpdated: detail.lastUpdated,
    languages: detail.languages ?? template.languages,
    models: detail.models ?? [],
    tags: detail.tags ?? template.topics,
    resources: detail.resources ?? [...new Set([...template.services, ...template.databases])].map(name => ({ name }))
  };
}
function detailLaunchLinks(template) {
  const detail = template.detail ?? {};
  const launch = template.launchUrl ? new URL(template.launchUrl) : null;
  const isCodespaces = launch && (launch.hostname === "codespaces.new" || (launch.hostname === "github.com" && launch.pathname.startsWith("/codespaces/")));
  const isVscode = launch && launch.hostname === "vscode.dev";
  return [
    { kind: "codespaces", url: detail.codespacesUrl ?? (isCodespaces ? template.launchUrl : null), label: "Open in GitHub Codespaces" },
    { kind: "vscode", url: detail.vscodeUrl ?? (isVscode ? template.launchUrl : null), label: "Open in VS Code for the Web" },
    { kind: "environment", url: launch && !isCodespaces && !isVscode ? template.launchUrl : null, label: "Open development environment" }
  ].filter(link => link.url);
}
function detailImage(image, kind, externalArrow, showInline = false) {
  if (!image) return "";
  if (showInline) return `<figure class="detail-media detail-media-${kind} detail-media-plain"><img src="${escape(image.src)}" alt="${escape(image.alt)}" decoding="async"></figure>`;
  return `<figure class="detail-media detail-media-${kind}"><a href="${escape(image.src)}" target="_blank" rel="noopener"><img src="${escape(image.src)}" alt="${escape(image.alt)}" decoding="async"><span>View full size${externalArrow}</span></a></figure>`;
}
function detailResourceName(resource) {
  const name = escape(resource.name);
  return resource.icon ? `<span class="detail-resource-name"><img class="detail-resource-icon" src="${escape(resource.icon)}" alt="" width="32" height="32"><span>${name}</span></span>` : name;
}
function referenceDetailLinks(template, launchLinks) {
  const vscodeIcon = `<img src="https://azure.github.io/ai-app-templates/img/vscode.svg" alt="" width="20" height="20">`;
  const externalIcon = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 4h6v6M20 4l-9 9M20 13v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h5"/></svg>`;
  const links = [
    ...launchLinks.filter(link => link.kind === "vscode"),
    ...launchLinks.filter(link => link.kind === "codespaces"),
    ...launchLinks.filter(link => !["vscode", "codespaces"].includes(link.kind))
  ];
  return links.map(link => `<a class="${link.kind === "vscode" ? "detail-action-primary" : link.kind === "github" ? "detail-action-link" : "detail-action-secondary"}" href="${escape(link.url)}" target="_blank" rel="noopener" aria-label="${escape(link.label)} (opens in a new tab)">${link.kind === "vscode" ? vscodeIcon : externalIcon}<span>${escape(link.label)}</span></a>`).join("");
}
function detailPage(template) {
  const root = "../../../";
  const canonical = `${baseUrl}templates/${template.id}/`;
  const detail = detailContent(template);
  const launchLinks = detailLaunchLinks(template);
  const resourceDescriptions = detail.resources.some(resource => resource.description);
  const resourceIcons = detail.resources.some(resource => resource.icon);
  const isTypographyPreview = ["azure-samples/azure-search-openai-demo", "azure-samples/aisearch-openai-rag-audio"].includes(template.id);
  const isReferencePreview = template.id === "azure-samples/azure-search-openai-demo";
  const externalArrow = isReferencePreview ? "" : " &#8599;";
  // Fluent UI System Icons (MIT); see the license in assets.
  const fluentOpenIcon = `<svg class="detail-external-icon" width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path fill="currentColor" d="M4.49999 3C3.67157 3 3 3.67157 3 4.5V11.5C3 12.3284 3.67157 13 4.49999 13H11.5C12.3284 13 12.9999 12.3284 12.9999 11.5V9.26923C12.9999 8.99309 13.2238 8.76923 13.4999 8.76923C13.7761 8.76923 13.9999 8.99309 13.9999 9.26923V11.5C13.9999 12.8807 12.8807 14 11.5 14H4.49999C3.11928 14 2 12.8807 2 11.5V4.5C2 3.11929 3.11928 2 4.49999 2H6.73075C7.00689 2 7.23074 2.22386 7.23074 2.5C7.23074 2.77614 7.00689 3 6.73075 3H4.49999ZM8.76926 2.5C8.76926 2.22386 8.99311 2 9.26925 2H13.5C13.7761 2 14 2.22386 14 2.5V6.73077C14 7.00691 13.7761 7.23077 13.5 7.23077C13.2239 7.23077 13 7.00691 13 6.73077V3.70711L9.6228 7.08433C9.42754 7.27959 9.11096 7.27959 8.9157 7.08433C8.72044 6.88906 8.72044 6.57248 8.9157 6.37722L12.2929 3H9.26925C8.99311 3 8.76926 2.77614 8.76926 2.5Z"/></svg>`;
  const summaryLabel = (label, icon) => isReferencePreview
    ? `<img src="https://azure.github.io/ai-app-templates/img/${icon}.svg" alt="" width="20" height="20">${label}`
    : label;
  const previewStyles = isTypographyPreview ? `<link rel="stylesheet" href="${root}detail-preview.css">` : "";
  const commandMarkup = isReferencePreview
    ? escape(template.initCommand).replace(/^(azd init )(-t) (.+)$/, '$1<span class="detail-command-option">$2</span> <span class="detail-command-template">$3</span>')
    : isTypographyPreview
      ? escape(template.initCommand).replace(/^(azd init -t )(.+)$/, '$1<span class="detail-command-template">$2</span>')
      : escape(template.initCommand);
  const copyButton = isReferencePreview
    ? `<button class="catalog-copy-command detail-copy-command" type="button" data-copy="${escape(template.initCommand)}" aria-label="Copy command" title="Copy command"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true"><rect x="8" y="8" width="11" height="13" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h3"/></svg></button>`
    : `<button class="button blue" data-copy="${escape(template.initCommand)}">Copy command</button>`;
  const startLinks = isReferencePreview
    ? referenceDetailLinks(template, launchLinks)
    : `${launchLinks.map(link => `<a href="${escape(link.url)}" target="_blank" rel="noopener">${link.label} &#8599;</a>`).join("")}<a href="${escape(template.repository)}" target="_blank" rel="noopener">View on GitHub &#8599;</a>`;
  const creatorLinks = detail.creators.map(creator => creator.url ? `<a href="${escape(creator.url)}" target="_blank" rel="noopener">${escape(creator.name)}</a>` : escape(creator.name)).join(", ");
  const tagChips = detail.tags.map(tag => `<span class="tag">${escape(tag)}</span>`).join("");
  const repositoryName = new URL(template.repository).pathname.split("/").filter(Boolean).join(" / ");
  const stars = template.repositoryStats?.stars;
  const referenceRepository = `<div class="detail-repository-meta"><a href="${escape(template.repository)}" target="_blank" rel="noopener" aria-label="${escape(repositoryName)} on GitHub (opens in a new tab)">${escape(repositoryName)}</a>${stars == null ? "" : `<span aria-hidden="true">&bull;</span><span class="detail-repository-star" title="${stars.toLocaleString("en-US")} stars (snapshot)"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" aria-hidden="true"><path d="M12 3 14.8 8.7 21.1 9.6 16.6 14 17.7 20.3 12 17.3 6.3 20.3 7.4 14 2.9 9.6 9.2 8.7Z"/></svg><span aria-hidden="true">${new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(stars)}</span><span class="sr-only">${stars.toLocaleString("en-US")} stars (snapshot)</span></span>`}</div>`;
  const referenceByline = `<div class="detail-hero-byline">${detail.creators.length ? `<span>by ${creatorLinks}</span><span aria-hidden="true">&bull;</span>` : ""}<a href="${escape(template.repository)}" target="_blank" rel="noopener" aria-label="View on GitHub (opens in a new tab)">View on GitHub</a></div>`;
  const summarySection = `<section class="detail-summary" aria-labelledby="summary-heading"><h2 id="summary-heading">Summary</h2><dl>
${!isReferencePreview && detail.creators.length ? `<div><dt>${summaryLabel("Created by", "Person")}</dt><dd>${creatorLinks}</dd></div>` : ""}
${detail.lastUpdated ? `<div><dt>${summaryLabel("Last updated", "Calendar")}</dt><dd>${escape(detail.lastUpdated)}</dd></div>` : ""}
${detail.languages.length ? `<div><dt>${summaryLabel("Languages", "Code")}</dt><dd>${escape(detail.languages.join(", "))}</dd></div>` : ""}
${detail.models.length ? `<div><dt>${summaryLabel("Models", "Cube")}</dt><dd>${escape(detail.models.join(", "))}</dd></div>` : ""}
${detail.tags.length ? `<div${isReferencePreview ? ' class="detail-summary-tags"' : ""}><dt>${summaryLabel("Tags", "Tag")}</dt><dd class="tags">${tagChips}</dd></div>` : ""}
<div${isReferencePreview ? ' class="detail-summary-cost"' : ""}><dt>${summaryLabel("Estimated cost", "Calculator")}</dt><dd><a href="https://azure.microsoft.com/pricing/calculator/" target="_blank" rel="noopener"${isReferencePreview ? ' aria-label="Pricing calculator (opens in a new tab)"' : ""}>Pricing calculator${isReferencePreview ? fluentOpenIcon : externalArrow}</a></dd></div>
</dl></section>`;
  return `<!doctype html>
<!-- Generated from templates.json by node generate.mjs. Do not edit. -->
<html lang="en"><head>${head(detail.title, detail.about, root, "index.md")}${previewStyles}<link rel="canonical" href="${canonical}"><meta property="og:title" content="${escape(detail.title)}"><meta property="og:description" content="${escape(detail.about)}"><meta property="og:type" content="website"><meta property="og:url" content="${canonical}"><script src="${root}catalog.js" defer></script><script src="${root}catalog-core.js" defer></script><script src="${root}detail.js" defer></script></head>
<body class="catalog-page" data-mode="detail" data-root="${root}"><a class="skip" href="#main">Skip to content</a>${header(root)}
<main id="main" class="product-wrap"><div class="breadcrumb${isReferencePreview ? " detail-breadcrumb-reference" : ""}"><a data-back-to-results href="${root}catalog.html">${isReferencePreview ? `<span aria-hidden="true">&#8592;</span><span>Back to templates</span>` : "&#8592; Back to templates"}</a></div>
<div class="selected-detail-layout${isReferencePreview ? " selected-detail-reference" : ""}"><div class="selected-detail-content">
<header class="selected-detail-hero">${isReferencePreview ? referenceRepository : `<a class="detail-repository" href="${escape(template.repository)}" target="_blank" rel="noopener">${escape(template.id)}${externalArrow}</a>`}<h1>${escape(detail.title)}</h1>${isReferencePreview ? referenceByline : ""}<p class="detail-description">${escape(detail.about)}</p></header>
${isReferencePreview && detail.aboutImage ? `<figure class="detail-media detail-media-screenshot detail-media-plain"><img src="${escape(detail.aboutImage.src)}" alt="${escape(detail.aboutImage.alt)}" decoding="async"></figure>` : detailImage(detail.aboutImage, "screenshot", externalArrow)}
<section id="architecture" aria-labelledby="architecture-heading"><h2 id="architecture-heading">Architecture</h2>${detail.architectureImage ? detailImage(detail.architectureImage, "architecture", externalArrow, isReferencePreview) : `<p>Architecture image is not available in this prototype.</p>`}</section>
${detail.resources.length ? `<section id="resources" aria-labelledby="resources-heading"><h2 id="resources-heading">Resources included</h2>${resourceDescriptions ? `<div class="table-scroll"><table class="detail-resource-table${resourceIcons ? " detail-resource-table-with-icons" : ""}"><thead><tr><th scope="col">Resource</th><th scope="col">Description</th></tr></thead><tbody>${detail.resources.map(resource => `<tr><th scope="row">${detailResourceName(resource)}</th><td>${escape(resource.description || "")}</td></tr>`).join("")}</tbody></table></div>` : `<ul class="detail-resource-list">${detail.resources.map(resource => `<li>${detailResourceName(resource)}</li>`).join("")}</ul>`}</section>` : ""}
</div><aside class="selected-start-panel" aria-label="Template actions and summary">
<section class="detail-start${isReferencePreview ? " detail-start-reference" : ""}" aria-labelledby="start-heading">${isReferencePreview ? `<div class="detail-start-header"><h2 id="start-heading">Get started</h2></div>` : `<h2 id="start-heading">Get started</h2>`}${template.initCommand ? `<div class="selected-command"><code>${commandMarkup}</code>${copyButton}</div><p>Use the Azure Developer CLI (azd) to deploy this template. <a href="https://aka.ms/azd" target="_blank" rel="noopener"${isReferencePreview ? ' aria-label="Learn more about azd (opens in a new tab)"' : ""}>Learn more about azd${isReferencePreview ? fluentOpenIcon : externalArrow}</a></p>` : `<a class="button blue" href="${escape(template.readme)}" target="_blank" rel="noopener">Open setup instructions${externalArrow}</a>`}
${isReferencePreview && template.initCommand ? `<div class="detail-start-separator">or</div>` : ""}<div class="detail-start-links">${startLinks}</div></section>
${summarySection}</aside></div></main></body></html>`;
}
function markdownPage(template) {
  const detail = detailContent(template);
  return `# ${detail.title}

> ${detail.about}
${detail.aboutImage ? `\n![${detail.aboutImage.alt}](${detail.aboutImage.src})\n` : ""}

[${template.id}](${template.repository}) | [Human-readable page](index.html)

## Architecture

${detail.architectureImage ? `![${detail.architectureImage.alt}](${detail.architectureImage.src})` : "Architecture image is not available in this prototype."}

${detail.resources.length ? `## Resources included\n\n${detail.resources.map(resource => `- ${resource.name}${resource.description ? `: ${resource.description}` : ""}`).join("\n")}\n` : ""}
## Get started

${template.initCommand ? `\`\`\`sh\n${template.initCommand}\n\`\`\`\n\nUse the Azure Developer CLI (azd) to deploy this template. [Learn more about azd](https://aka.ms/azd).` : `[Open setup instructions](${template.readme}).`}
${detailLaunchLinks(template).map(link => `[${link.label}](${link.url}).`).join("\n")}
## Summary

${detail.creators.length ? `- Created by: ${detail.creators.map(creator => creator.url ? `[${creator.name}](${creator.url})` : creator.name).join(", ")}\n` : ""}${detail.lastUpdated ? `- Last updated: ${detail.lastUpdated}\n` : ""}${detail.languages.length ? `- Languages: ${detail.languages.join(", ")}\n` : ""}${detail.models.length ? `- Models: ${detail.models.join(", ")}\n` : ""}${detail.tags.length ? `- Tags: ${detail.tags.join(", ")}\n` : ""}- Estimated cost: [Pricing calculator](https://azure.microsoft.com/pricing/calculator/)
`;
}
artifacts.set("catalog.js", `// Generated from templates.json. Run node generate.mjs; do not edit.\nwindow.AZD_CATALOG = ${JSON.stringify(catalog, null, 2).replaceAll("<", "\\u003c")};\n`);
const studyHtml = await readFile(path.join(directory, "study.html"), "utf8");
artifacts.set("index.html", studyHtml
  .replace("<!doctype html>", "<!doctype html>\n<!-- Generated from study.html by node generate.mjs. Do not edit. -->")
  .replaceAll('href="explore.html?direction=catalog"', 'href="catalog.html"')
  .replaceAll('href="explore.html?direction=pathfinder"', 'href="archive/guided.html"')
  .replaceAll('href="explore.html?direction=blueprints"', 'href="archive/blueprints.html"')
  .replaceAll('href="templates/azure-samples/azure-search-openai-demo/"', 'href="templates/azure-samples/azure-search-openai-demo/index.html"')
  .replaceAll("same six sample records", `same ${catalog.templates.length} sample records`)
  .replaceAll("ALTERNATIVE", "ARCHIVED"));
artifacts.set("catalog.html", catalogPage("", { heroLink: true, isMain: true }));
artifacts.set("start-with-code.html", startPage());
artifacts.set("catalog-hero-cta.html", catalogPage("", { heroCta: true }));
artifacts.set("catalog-hero-link.html", catalogPage("", { heroLink: true }));
artifacts.set("catalog-no-hero.html", catalogPage("", { showHero: false, utilityCta: true }));
artifacts.set("find.html", finderPage());
artifacts.set("agents.html", agentRedirectPage());
artifacts.set(path.join("templates", "ai", "index.html"), collectionRedirectPage());
artifacts.set(path.join("templates", "ai", "no-hero.html"), collectionRedirectPage(false));
for (const template of catalog.templates) {
  const folder = path.join("templates", template.id.replaceAll("/", path.sep));
  artifacts.set(path.join(folder, "index.html"), detailPage(template));
  artifacts.set(path.join(folder, "index.md"), markdownPage(template));
}
function listingMarkdown(records, root = "") {
  return `# Awesome azd template catalog prototype\n\n> ${records.length} source-linked examples, not the full production catalog. Hero totals, filter counts and pagination are visual mocks; only the records below exist in this prototype. Repository stars and forks are GitHub snapshots, not deployment metrics. One shared record source powers human and agent views.\n\n${records.map(template => `- [${template.title}](${root}templates/${template.id}/index.md): ${template.task}; ${template.languages.join(", ") || "bring your own code"}; ${template.iac || "infrastructure not specified"}.`).join("\n")}\n\nFilter with [prototype JSON](${root}templates.json), then read a template's Markdown before choosing. The ${catalog.schemaVersion} schema is a design sample, not the production contract. Unknown fields must not satisfy constraints. Use the [existing production catalog](https://azure.github.io/awesome-azd/templates.json) for the full inventory and follow its [schema](https://github.com/Azure/awesome-azd/blob/main/docs/templates-schema.md). [Retrieval guide](${root}agent-guide.md).\n`;
}
artifacts.set("index.md", listingMarkdown(catalog.templates));
artifacts.set("find.md", `# Find templates\n\nSearch by keyword or use filters in the [template catalog](catalog.html). The separate app-description mode has been removed. Legacy find.html links redirect to the catalog, preserving saved criteria and the AI collection.\n\n[Catalog index](index.md) | [Structured records](templates.json) | [Agent retrieval guide](agent-guide.md)\n`);
artifacts.set(path.join("templates", "ai", "index.md"), listingMarkdown(catalog.templates.filter(template => template.collections.includes("ai")), "../../"));
artifacts.set("llms.txt", `# Awesome azd catalog-first prototype

> ${catalog.templates.length} source-linked design examples, not the full Awesome azd catalog. The local ${catalog.schemaVersion} schema is not the production contract.

Read the catalog JSON, shortlist declared matches, then read template Markdown and the linked repository setup instructions. Null or unlisted metadata means unknown, not supported; service tags do not establish default hosting. Do not infer costs, model availability, security or deployment readiness. Review repository hooks and obtain approval before execution or cloud changes.

Share this index explicitly: automatic discovery is not guaranteed. The intended production location is /awesome-azd/llms.txt.

## Prototype retrieval

- [Prototype JSON](templates.json): The ${catalog.templates.length} sample records shared by the gallery and generated Markdown; schemaVersion ${catalog.schemaVersion}.
- [Template index](index.md): Links to each example's Markdown, repository and setup guidance.
- [Retrieval guide](agent-guide.md): Sample fields, matching rules and source limitations.

## Existing production catalog

- [Production JSON](https://azure.github.io/awesome-azd/templates.json): Full published inventory from the existing canonical catalog; not replaced by this prototype.
- [Production schema](https://github.com/Azure/awesome-azd/blob/main/docs/templates-schema.md): Field definitions and gallery filtering rules.

The production JSON is a flat array, unlike this prototype's templates array. For gallery discovery, include only records whose templateType is absent, null or empty. Entries such as extension.ai.agent are for specialized azd flows that build agents, not coding-agent access to the gallery. Production records provide discovery metadata; follow each source link for complete setup requirements. Evolve the existing catalog for richer metadata rather than create an agent-only dataset.

## Optional

- [AI collection](templates/ai/index.md): A view of the same prototype records, not another inventory.
- [Source initiative](${catalog.provenance.initiative}): Consolidation scope and launch requirements.
- [llms.txt proposal](https://llmstxt.org/): Discovery guidance, not access control or guaranteed agent support.
`);
const archiveShell = await readFile(path.join(directory, "explore.html"), "utf8");
for (const [filename, direction] of [["guided.html", "pathfinder"], ["blueprints.html", "blueprints"]]) {
  artifacts.set(path.join("archive", filename), archiveShell
    .replace('<body class="product" data-root="">', `<body class="product" data-root="../" data-archived="true" data-force-direction="${direction}">`)
    .replace("Interactive concept &middot; not production", "Archived direction &middot; not the selected design")
    .replace('href="index.html#directions"', 'href="index.html#archive"')
    .replace("Back to design study", "Back to the selected design")
    .replace("<span>EXPLORATIONS</span>", "<span>ARCHIVED EXPLORATION</span>")
    .replace(/6 sample records/g, `${catalog.templates.length} sample records`)
    .replace(/six sample records/g, "sample records")
    .replace(/(href|src)="(?!https?:|#|\?)([^"]+)"/g, '$1="../$2"'));
}
for (const [filename, content] of artifacts) {
  const target = path.join(directory, filename);
  if (check) assert.equal(await readFile(target, "utf8"), content, `${filename} is stale; run node generate.mjs.`);
  else { await mkdir(path.dirname(target), { recursive: true }); await writeFile(target, content, "utf8"); }
}
console.log(`${check ? "Verified" : "Generated"} ${artifacts.size} artifacts from ${catalog.templates.length} unique records.`);
