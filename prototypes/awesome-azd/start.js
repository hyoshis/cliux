(() => {
  const C = window.AzdCatalog;
  const params = new URLSearchParams(location.search);
  const state = C.parse(location.search, window.AZD_CATALOG.templates);
  const collection = params.get("collection") === "ai" ? "ai" : "";
  const hero = params.get("hero") !== "off";
  const layout = ["hero-cta", "hero-link"].includes(params.get("layout")) ? params.get("layout") : "";
  const back = C.listingUrl({ root: document.body.dataset.root || "", state, collection, hero, layout });
  for (const link of document.querySelectorAll("[data-back-to-catalog]")) link.href = back;
})();
