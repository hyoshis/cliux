(() => {
  const params = new URLSearchParams(location.search);
  const root = document.body.dataset.root;
  const C = window.AzdCatalog;
  const collection = params.get("collection") === "ai" ? "ai" : "";
  const records = window.AZD_CATALOG.templates.filter(template => !collection || template.collections.includes(collection));
  const state = C.parse(location.search, records);
  const direction = params.get("direction");
  const archived = params.get("from") === "archive" || (!params.has("from") && ["pathfinder", "blueprints"].includes(direction));
  const finder = params.get("from") === "finder";
  const hero = params.get("hero") !== "off";
  const layout = ["hero-cta", "hero-link"].includes(params.get("layout")) ? params.get("layout") : "";
  let listing = C.listingUrl({ root, state, collection, finder, hero, layout });
  if (archived) {
    const query = C.serialize(state, { collection, direction, step: ["1", "2", "3"].includes(params.get("step")) ? params.get("step") : "" });
    listing = `${root}archive/${direction === "blueprints" ? "blueprints" : "guided"}.html?${query}`;
  }
  for (const link of document.querySelectorAll("[data-back-to-results]")) {
    link.href = listing;
    if (finder) link.textContent = "\u2190 Back to your matches";
    else if (archived) link.textContent = "\u2190 Back to archived exploration";
  }
})();
