(() => {
  "use strict";

  const chapters = [...document.querySelectorAll(".chapter")];
  const chapterLinks = [...document.querySelectorAll(".chapter-nav a")];
  const main = document.getElementById("main");
  const chapterNames = {
    overview: "The opportunity", current: "Current experience", competitive: "Competitive signals",
    playground: "Prototype playground", defaults: "Default logic", "edge-cases": "Edges & guardrails",
    delivery: "Delivery & validation", sources: "Evidence & sources"
  };
  const journeys = {
    code: {
      title: "Existing code", badge: "Environment usually deferred",
      description: "Ordinary supported app scanning; Aspire is a separate branch.",
      init: ["Choose Scan current directory (or use --from-code).", "Scan supported code and review detected services / databases.", "Confirm components; configure ports and database details where required.", "Generate azure.yaml and supporting files."],
      up: ["Resolve an environment if missing; authenticate when needed.", "Resolve tenant / subscription, location, and required parameters.", "Package, provision, and deploy the app."],
      note: "If an environment name is explicitly supplied during init, the environment is initialized earlier."
    },
    template: {
      title: "Sample or custom template", badge: "Environment initialized at init",
      description: "A specified --template bypasses the entry-path choice.",
      init: ["Choose a template or pass --template.", "Resolve the destination directory and handle existing-file / template warnings.", "Retrieve the template and initialize an environment; prompt for a name when unresolved.", "Write template assets and initialize required extensions."],
      up: ["Authenticate and resolve missing cloud settings as needed.", "Resolve required template parameters and any additional prompts.", "Package, provision, and deploy."],
      note: "Hooks and extensions may introduce additional execution or installation boundaries. --up can offer deployment after template initialization."
    },
    aspire: {
      title: "Aspire app", badge: "Environment needed before generation",
      description: "The AppHost branch has different generation dependencies.",
      init: ["Scan supported code and load the detected AppHost manifest.", "Confirm the app and exposed services.", "Initialize the environment before project-artifact generation.", "Generate project artifacts and handle duplicate files."],
      up: ["Resolve authentication, cloud destination, and required values as needed.", "Package, provision, and deploy the Aspire app."],
      note: "The dependency on environment creation needs engineering validation before applying the ordinary-code design unchanged."
    },
    minimal: {
      title: "Minimal / blank project", badge: "No environment required immediately",
      description: "--minimal creates basic project configuration without scanning an app.",
      init: ["Use --minimal, or continue through the scan path without selected components.", "Generate minimal azure.yaml configuration.", "Initialize an environment now only if explicitly named."],
      up: ["First add / configure deployable components, for example with azd add.", "Resolve environment and cloud settings when needed.", "Provision and deploy once the app configuration is ready."],
      note: "Minimal setup is a valid starting point, not proof the app is ready to deploy."
    },
    repeat: {
      title: "Already initialized project", badge: "Reuse or create an environment",
      description: "Without an explicit init mode, an existing azure.yaml changes the command path.",
      init: ["Resolve the project and any requested environment.", "Interactive use offers reuse of the recorded environment or creation of another.", "No-prompt use can reuse the recorded default; explicit inputs can select another.", "Persist the resolved association and initialize required extensions."],
      up: ["Use the selected environment and existing configuration.", "Resolve missing values if any.", "Apply the normal packaging / provisioning / deployment workflow."],
      note: "Partial-init state and stale associations need recovery, not an instruction to start over."
    }
  };

  function showChapter(focus = false) {
    const requested = location.hash.slice(1);
    const id = Object.hasOwn(chapterNames, requested) ? requested : "overview";
    chapters.forEach((chapter) => {
      chapter.hidden = chapter.id !== id;
      chapter.classList.toggle("chapter-enter", chapter.id === id);
    });
    chapterLinks.forEach((link) => {
      if (link.hash === `#${id}`) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    });
    document.title = `${chapterNames[id]} | azd smart defaults`;
    if (focus) {
      main.focus({ preventScroll: true });
      window.scrollTo({ top: 0, behavior: "instant" });
    }
  }

  document.addEventListener("click", (event) => {
    const anchor = event.target.closest("a[href]");
    if (!anchor || event.defaultPrevented || event.button !== 0 ||
        event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    const url = new URL(anchor.href);
    if (url.origin !== location.origin || url.pathname !== location.pathname ||
        !Object.hasOwn(chapterNames, url.hash.slice(1))) return;
    event.preventDefault();
    const current = new URL(location.href);
    url.searchParams.forEach((value, key) => current.searchParams.set(key, value));
    current.hash = url.hash;
    history.pushState(null, "", current);
    showChapter(true);
    window.dispatchEvent(new Event("prototypeconfig"));
  });
  window.addEventListener("popstate", () => {
    showChapter(true);
    window.dispatchEvent(new Event("prototypeconfig"));
  });
  window.addEventListener("hashchange", () => showChapter(true));

  function showJourney(path) {
    const journey = journeys[path];
    document.querySelectorAll("[data-path]").forEach((button) => {
      button.setAttribute("aria-pressed", String(button.dataset.path === path));
    });
    const list = (items) => items.map((item) => `<li>${item}</li>`).join("");
    document.getElementById("current-journey").innerHTML =
      `<div class="journey-heading"><div><h3>${journey.title}</h3><p>${journey.description}</p></div><span class="badge badge-green">${journey.badge}</span></div>` +
      `<div class="journey-columns"><div class="journey-phase"><h4>&gt; azd init</h4><ol>${list(journey.init)}</ol></div>` +
      `<div class="journey-phase"><h4>&gt; azd up / next steps</h4><ol>${list(journey.up)}</ol></div></div><div class="journey-note">${journey.note}</div>`;
  }
  document.querySelectorAll("[data-path]").forEach((button) => {
    button.addEventListener("click", () => showJourney(button.dataset.path));
  });
  document.querySelectorAll("[data-competitor]").forEach((button) => {
    button.addEventListener("click", () => showCompetitor(button.dataset.competitor));
  });
  function showCompetitor(id) {
    document.querySelectorAll("[data-competitor]").forEach((button) => {
      button.setAttribute("aria-pressed", String(button.dataset.competitor === id));
    });
    document.querySelectorAll(".competitor-panel").forEach((panel) => {
      panel.hidden = panel.id !== `competitor-${id}`;
    });
  }

  let toastTimer;
  document.getElementById("share-button").addEventListener("click", async () => {
    const status = document.getElementById("share-status");
    clearTimeout(toastTimer);
    status.hidden = false;
    status.textContent = "Copying view link...";
    if (!navigator.clipboard?.writeText) {
      status.textContent = "Clipboard access is unavailable. Copy the view URL from your browser's address bar.";
    } else {
      try {
        await navigator.clipboard.writeText(location.href);
        const local = location.protocol === "file:" || ["localhost", "127.0.0.1", "[::1]"].includes(location.hostname);
        status.textContent = local
          ? "Local preview link copied. It only works on this computer; publish the folder for stakeholder sharing."
          : "View link copied, including the selected concept and scenario. The simulation starts fresh when opened.";
      } catch (error) {
        status.textContent = `Link not copied (${error.name}). Copy the URL from your browser's address bar.`;
      }
    }
    toastTimer = setTimeout(() => { status.hidden = true; }, 9000);
  });
  document.getElementById("print-button").addEventListener("click", () => window.print());
  let printDetails = [];
  window.addEventListener("beforeprint", () => {
    printDetails = [...document.querySelectorAll("details")].map((element) => ({ element, open: element.open }));
    printDetails.forEach(({ element }) => { element.open = true; });
  });
  window.addEventListener("afterprint", () => {
    printDetails.forEach(({ element, open }) => { element.open = open; });
  });

  document.body.classList.add("enhanced");
  showJourney("code");
  showCompetitor("fly");
  showChapter();
})();
