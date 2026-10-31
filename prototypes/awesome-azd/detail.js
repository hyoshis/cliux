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
  let listing = C.listingUrl({ root, state, collection, finder });
  if (archived) {
    const query = C.serialize(state, { collection, direction, step: ["1", "2", "3"].includes(params.get("step")) ? params.get("step") : "" });
    listing = `${root}archive/${direction === "blueprints" ? "blueprints" : "guided"}.html?${query}`;
  }
  for (const link of document.querySelectorAll("[data-back-to-results]")) {
    link.href = listing;
    if (finder) link.textContent = "\u2190 Back to your matches";
    else if (archived) link.textContent = "\u2190 Back to archived exploration";
  }
  const links = [...document.querySelectorAll(".detail-section-nav a[href^='#']")];
  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        for (const link of links) {
          if (link.hash === `#${entry.target.id}`) link.setAttribute("aria-current", "location");
          else link.removeAttribute("aria-current");
        }
      }
    }, { rootMargin: "-10% 0px -65% 0px" });
    for (const link of links) {
      const section = document.querySelector(link.hash);
      if (section) observer.observe(section);
    }
  }
})();
