(() => {
  const form = document.getElementById("agent-finder");
  const output = document.getElementById("finder-output");
  const C = window.AzdCatalog;
  const records = window.AZD_CATALOG.templates;
  for (const [name, key, placeholder] of [["task", "tasks", "Any goal"], ["language", "languages", "Any language"], ["host", "hosts", "No preference"]]) {
    const selected = form.elements[name].value;
    const facet = C.facets.find(item => item.key === key);
    form.elements[name].innerHTML = `<option value="">${placeholder}</option>${C.options(records, facet).map(value => `<option>${C.escape(value)}</option>`).join("")}`;
    if (C.options(records, facet).includes(selected)) form.elements[name].value = selected;
  }
  form.addEventListener("submit", event => {
    event.preventDefault();
    const state = C.parse("", records);
    for (const [name, key] of [["task", "tasks"], ["language", "languages"], ["host", "hosts"]]) state[key] = form.elements[name].value ? [form.elements[name].value] : [];
    if (!C.facets.some(facet => state[facet.key].length)) {
      output.innerHTML = "<h3>Choose at least one criterion.</h3><p>No task or stack has been assumed. Choose a goal, language or host to test the matching contract.</p>";
      return;
    }
    const matches = C.filter(records, state);
    const constraint = [form.elements.task.value || "any goal", form.elements.language.value || "any language", form.elements.host.value || "any host"].join(" / ");
    output.innerHTML = `<p class="eyebrow">SHARED MATCHING ENGINE &middot; ${records.length}-RECORD SAMPLE</p><h3>${matches.length} confirmed ${matches.length === 1 ? "match" : "matches"}</h3><p>${C.escape(constraint)}</p>` +
      (matches.length ? matches.map(template => `<article class="evidence-result"><h4><a href="${C.detailUrl(template)}">${C.escape(template.title)} &#8599;</a></h4><ul><li>Task: ${C.escape(template.task)} (editorial label).</li><li>Language: ${C.escape(template.languages.join(", ") || "not specified")}.</li><li>Default host: ${C.escape(template.host || "unknown; repository review required")}.</li><li>Prerequisites: ${template.prerequisites ? "repository requirements included on the detail page." : "not fully specified; do not infer readiness."}</li></ul><p>${C.escape(template.caveat)}</p><a class="text-link" href="templates/${template.id}/index.md">Read the supporting record as Markdown &#8599;</a></article>`).join("") + `<div class="warning">Matching metadata is not deployment validation. Review requirements, permissions, costs and region availability. Nothing has been deployed.</div>` :
        `<article class="evidence-result"><h4>No sample confirms every constraint.</h4><p>Unknown hosting is not a match. This prototype does not contain every template in the full live catalog.</p><p>Relax a constraint, or <a href="catalog.html">inspect the example catalog</a> and review the repository requirements.</p></article>`);
  });
})();
