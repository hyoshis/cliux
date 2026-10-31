(() => {
  "use strict";

  const terminal = document.getElementById("prototype-terminal");
  const scenarioSelect = document.getElementById("prototype-scenario");
  const routeSelect = document.getElementById("prototype-route");
  const status = document.getElementById("prototype-status");
  const concepts = ["progressive", "upfront"];
  const scenarios = ["saved", "multiple", "stale", "region", "targets", "agent"];
  const subscriptions = {
    sandbox: { name: "Developer Sandbox", id: "00000000-0000-4000-8000-000000007c21", source: "saved default" },
    team: { name: "Team Development", id: "00000000-0000-4000-8000-000000009e42", source: "selected for this project" }
  };
  const regions = { westeurope: "West Europe", northeurope: "North Europe" };
  const annotations = {
    prepare: ["01", "Start with the app, not the object model.", "Confirm the supported app azd detected. Local preparation does not require the developer to understand an azd environment.", "Can someone explain the next action without learning environment terminology?", "prepare"],
    upfront: ["01", "One summary, but more concepts upfront.", "This alternative groups app, environment, subscription, and region settings during init. It is shorter than serial prompts, but cloud concepts arrive before local setup is complete.", "Does this summary reduce effort, or just relocate the same conceptual burden?", "prepare"],
    prepared: ["02", "Local completion is not cloud completion.", "State exactly what finished. Offer one next command rather than a list of lifecycle operations. Accepting setup has not authorized Azure changes.", "Does the developer know that nothing has been deployed?", "prepare"],
    review: ["03", "Make consequences legible before consent.", "Resolve known settings, explain their source, and keep edits one step away. Show billing destination and public access before a deliberate deployment choice.", "Can the user identify destination, region, exposure, and resource changes?", "review"],
    subscription: ["02", "Ask only for the unresolved decision.", "Multiple eligible subscriptions do not provide enough evidence to choose a billing scope. A remembered value is not a license to silently switch destinations.", "Is the tenant / subscription association unambiguous?", "review"],
    stale: ["02", "An invalid default is a reason to stop.", "Explain the unavailable setting. Offer a deliberate replacement rather than silently falling back to another subscription.", "Can the user recover without an unintended billing-scope change?", "review"],
    region: ["02", "Respect the intended geography.", "A region restriction must not trigger an automatic move. Offer illustrative eligible alternatives and preserve the decision boundary.", "Does the user understand why the region needs to change?", "review"],
    targets: ["02", "Reveal environments when multiplicity matters.", "An environment becomes useful vocabulary when there is more than one configured copy. Show the selected target clearly instead of hiding a consequential distinction.", "Can the developer distinguish development, staging, and production?", "review"],
    edit: ["03", "An escape hatch, not a second wizard.", "Edit a specific setting and return to the same review. Values are saved to this simulated project only, not global defaults.", "Can the user make one correction without re-entering unrelated values?", "review"],
    resources: ["03", "Details must be grounded in a real plan.", "This is an illustrative resource inventory, not an Azure-generated preview. Engineering must validate plan coverage across Bicep, Terraform, hooks, and extensions.", "Would the real implementation disclose what it cannot preview?", "review"],
    production: ["03", "Production is not just another label.", "The fixture marks this as a production target. Explicit acknowledgment protects the boundary; a target name alone would not prove its classification in a real product.", "Is production authorization explicit rather than inferred from no-prompt behavior?", "review"],
    complete: ["04", "Remember the association. Keep the destination visible.", "Repeat use reuses resolved settings. Changes to destination or material consequences should trigger the appropriate review again.", "Would a repeat run avoid unnecessary questions without hiding a target change?", "deploy"],
    cancelled: ["--", "A clear exit is part of the design.", "Stopping is a valid outcome. Cancellation does not pretend that deployment happened or erase previously completed local preparation.", "Does the cancellation message accurately describe what has and has not changed?", "prepare"],
    agent: ["--", "Same resolver. No interactive UI.", "Non-interactive callers should receive a clear missing-decision error, not a guessed billing destination. Dashboard controls below demonstrate recovery; they are not CLI prompts.", "Can a caller correct the missing value without parsing a human wizard?", "review"]
  };
  let state;
  let lastConfig = "";

  function escape(value) {
    return String(value).replace(/[&<>"']/g, (character) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[character]);
  }
  function line(text, className = "") {
    return `<p class="${className}">${escape(text)}</p>`;
  }
  function choices(items) {
    return `<div class="terminal-options" role="group" aria-label="Terminal choices">${items.map(([action, label]) =>
      `<button type="button" class="terminal-choice" data-action="${action}">${escape(label)}</button>`).join("")}</div>`;
  }
  function values(rows) {
    return `<dl class="term-values">${rows.map(([label, value, source]) =>
      `<dt>${escape(label)}</dt><dd>${escape(value)}${source ? ` <small>(${escape(source)})</small>` : ""}</dd>`).join("")}</dl>`;
  }
  function command() {
    return state.route === "template" ? "azd init --template todo-nodejs-mongo" : "azd init";
  }
  function subscriptionRows() {
    const sub = state.subscription ? subscriptions[state.subscription] : null;
    return [
      ["Tenant", "Example Development Tenant", "illustrative"],
      ["Subscription", sub ? `${sub.name} (...${sub.id.slice(-4)})` : "Needs a choice", sub ? state.subscriptionSource : "unresolved"],
      ["Region", regions[state.region], state.regionSource]
    ];
  }
  function back(action = "back", label = "Back to review") {
    return `<button type="button" class="term-back" data-action="${action}">&lt; ${escape(label)}</button>`;
  }
  function configKey() {
    const params = new URL(location.href).searchParams;
    const concept = concepts.includes(params.get("concept")) ? params.get("concept") : "progressive";
    const scenario = scenarios.includes(params.get("scenario")) ? params.get("scenario") : "saved";
    const route = params.get("route") === "template" ? "template" : "code";
    return { concept, scenario, route, key: `${concept}:${scenario}:${route}` };
  }
  function reset(config = configKey(), focus = false) {
    lastConfig = config.key;
    state = {
      concept: config.concept, scenario: config.scenario, route: config.route,
      stage: config.scenario === "agent" ? "agent" : config.concept === "upfront" ? "upfront" : "prepare",
      prepared: false, deployed: false, subscription: config.scenario === "multiple" || config.scenario === "stale" ? null : "sandbox",
      subscriptionSource: "saved default", region: "westeurope", regionSource: "saved default",
      regionResolved: config.scenario !== "region", subscriptionResolved: config.scenario !== "stale",
      targetResolved: config.scenario !== "targets", environment: config.route === "template" ? "todo-nodejs-mongo-dev" : "checkout-dev",
      app: config.route === "template" ? "todo-nodejs-mongo" : "checkout",
      language: "Node.js", port: 3000, publicAccess: true, resume: null,
      editReturn: null, regionReturn: "edit", formError: ""
    };
    scenarioSelect.value = config.scenario;
    routeSelect.value = config.route;
    document.querySelectorAll("[data-concept]").forEach((button) => {
      button.setAttribute("aria-pressed", String(button.dataset.concept === config.concept));
    });
    status.textContent = "Select a terminal option to advance. Changing concept, starting point, or scenario restarts the simulation.";
    render(focus);
  }
  function setConfig(change) {
    const url = new URL(location.href);
    Object.entries(change).forEach(([key, value]) => url.searchParams.set(key, value));
    history.replaceState(null, "", url);
    reset(configKey(), false);
  }
  function annotate(key) {
    const [number, title, body, watch, progress] = annotations[key];
    document.getElementById("annotation-number").textContent = number;
    document.getElementById("annotation-title").textContent = title;
    document.getElementById("annotation-body").textContent = body;
    document.getElementById("annotation-watch").textContent = watch;
    document.querySelectorAll("[data-progress]").forEach((step) => {
      if (step.dataset.progress === progress) step.setAttribute("aria-current", "step");
      else step.removeAttribute("aria-current");
    });
    document.getElementById("terminal-stage").textContent =
      progress === "prepare" ? "LOCAL PREPARATION" : progress === "review" ? "DESTINATION & CONSENT" : "SIMULATED OUTCOME";
  }
  function resolveFor(resume) {
    state.resume = resume;
    if (!state.subscriptionResolved) state.stage = "stale";
    else if (!state.subscription) state.stage = "subscription";
    else if (!state.regionResolved) state.stage = "region";
    else if (!state.targetResolved) state.stage = "targets";
    else {
      state.stage = resume;
      if (resume === "prepared") state.prepared = true;
      state.resume = null;
    }
  }
  function render(focus = true) {
    let html = "";
    let annotation = state.stage;
    const name = state.app;
    const fullCommand = line(command(), "term-command");
    const cloudCommand = line("azd up", "term-command");
    const sampleNotice = state.route === "template"
      ? line("Template code and hooks require trust before execution.", "term-warning") + line("This simulation does not download or execute them.", "term-dim")
      : line("Detected a supported app in the current directory.", "term-dim");

    switch (state.stage) {
      case "prepare":
        html = fullCommand + sampleNotice + line("Prepare this app for Azure", "term-title") +
          values([["App", name], ["Runtime", state.language], ["Port", state.port], ["Files", "azure.yaml and supporting azd files"]]) +
          line("No Azure resources will be created by this simulated step.", "term-dim") +
          choices([["prepare", "Prepare this app"], ["detect", "Change detected settings"], ["starting-options", "Other starting options"], ["cancel", "Cancel"]]);
        break;
      case "upfront":
        html = fullCommand + sampleNotice + line("Review proposed setup", "term-title") +
          values([["App", name], ["Runtime", state.language], ["Environment", state.environment, "generated once"], ...subscriptionRows()]) +
          line("Cloud settings are being requested during local init.", "term-dim") +
          line("Accepting this setup does not authorize deployment.", "term-warning") +
          choices([["accept-setup", "Use these settings and prepare app"], ["edit-setup", "Change a setting"], ["cancel", "Cancel"]]);
        break;
      case "prepared":
        html = fullCommand + line("App prepared for Azure. (Simulation)", "term-success") +
          line("Project configuration and supporting files would be generated.", "term-dim") +
          line("No Azure resources have been created.", "term-dim") +
          (state.concept === "upfront" ? line("Cloud settings are remembered for this simulated project.", "term-dim") : "") +
          choices([["run-up", "Run azd up to review deployment"], ["cancel", "Stop here; deploy later"]]);
        break;
      case "review":
        html = cloudCommand + line("Review deployment settings", "term-title") +
          values([["App", name], ...(state.scenario === "targets" ? [["Environment", state.environment, "explicit target"]] : []),
            ...subscriptionRows(), ["Hosting", "Azure Container Apps", "illustrative recommendation"],
            ["Public access", state.publicAccess ? "Website reachable on the internet" : "External ingress disabled", "reviewed setting"]]) +
          line("Azure resources would be created or updated and may incur charges.", "term-warning") +
          line("Resource inventory is illustrative; no live plan was run.", "term-dim") +
          choices([["deploy", "Deploy with these settings (simulate)"], ["edit-cloud", "Change a setting"], ["resources", "Review resource changes"], ["advanced", "Advanced settings"], ["cancel", "Cancel deployment"]]);
        break;
      case "subscription":
        html = line(state.prepared ? "azd up" : command(), "term-command") +
          line("Choose the subscription for this project", "term-title") +
          line("Tenant: Example Development Tenant (illustrative)", "term-dim") +
          line("More than one eligible subscription; none selected automatically.", "term-warning") +
          values(Object.entries(subscriptions).map(([, sub]) => [sub.name, sub.id, "illustrative ID"])) +
          choices([["subscription-sandbox", "Developer Sandbox"], ["subscription-team", "Team Development"], ["cancel", "Cancel"]]);
        break;
      case "confirm-region":
        annotation = "subscription";
        html = line("Recheck region for the selected subscription", "term-title") +
          line(`Region: ${regions[state.region]} (${state.region})`, "term-dim") +
          line("Fixture check: eligible for this sample workload.", "term-success") +
          line("Real deployment still needs policy, capability, and quota checks.", "term-warning") +
          choices([["confirm-saved-region", "Keep this region after revalidation"], ["edit-region", "Choose another region"], ["cancel", "Cancel"]]);
        break;
      case "stale":
        html = line(state.prepared ? "azd up" : command(), "term-command") +
          line("Saved subscription is unavailable.", "term-error") +
          line("The saved choice cannot be used with this account.", "term-dim") +
          line("No replacement subscription has been selected.", "term-warning") +
          choices([["replace-subscription", "Choose another subscription"], ["cancel", "Cancel without changing destination"]]);
        break;
      case "region":
        html = line(state.prepared ? "azd up" : command(), "term-command") +
          line("The saved region cannot be used for this sample workload.", "term-error") +
          line("Saved region: West Europe (westeurope)", "term-dim") +
          line("Fixture policy permits North Europe. No region was changed.", "term-warning") +
          choices([["region-north", "Use North Europe for this project"], ["cancel", "Cancel and keep the original setting"]]);
        break;
      case "targets":
        html = line(state.prepared ? "azd up" : command(), "term-command") +
          line("Choose which configured copy to update", "term-title") +
          line("azd calls each configured copy an environment.", "term-dim") +
          line("These are existing targets in this illustrative fixture.", "term-dim") +
          choices([["target-dev", "checkout-dev - development"], ["target-staging", "checkout-staging - staging"], ["target-prod", "checkout-prod - production"], ["cancel", "Cancel"]]);
        break;
      case "edit":
        html = line("Change one setting", "term-title") +
          line("Changes apply to this simulated project, not global defaults.", "term-dim") +
          choices([["edit-subscription", "Subscription"], ["edit-region", "Region"], ["edit-access", "Public access"],
            ...(state.editReturn === "upfront" ? [["edit-environment", "Environment name"]] : []),
            ["edit-detection", "Detected app and port"], ["back", "Back without changes"]]);
        break;
      case "choose-region":
        annotation = "edit";
        html = line("Choose a region", "term-title") +
          line("Illustrative eligible regions for the selected subscription.", "term-dim") +
          (state.scenario !== "region" ? choices([["choose-west", "West Europe (westeurope)"], ["choose-north", "North Europe (northeurope)"], ["back-region", "Back without changes"]])
            : choices([["choose-north", "North Europe (northeurope)"], ["back-region", "Back without changes"]]));
        break;
      case "access":
        annotation = "edit";
        html = line("Website access", "term-title") +
          line("Choose whether the sample website has public ingress.", "term-dim") +
          choices([["access-public", "Public - website reachable on the internet"], ["access-private", "Private - disable external ingress"], ["back-edit", "Back without changes"]]);
        break;
      case "detect":
        annotation = state.prepared ? "edit" : "prepare";
        html = line("Review detected app settings", "term-title") +
          line("Fixture configuration only; no source files are modified.", "term-dim") +
          `<form class="term-form" id="detection-form"><label>Runtime<select name="runtime"><option${state.language === "Node.js" ? " selected" : ""}>Node.js</option><option${state.language === "Python" ? " selected" : ""}>Python</option></select></label>` +
          `<label>Listening port<input name="port" inputmode="numeric" type="number" min="1" max="65535" step="1" required value="${state.port}"></label>` +
          `<button type="submit" class="term-submit">Save app settings</button></form>` + back("back-detect", "Back without changes");
        break;
      case "advanced":
        annotation = "edit";
        html = line("Advanced deployment settings", "term-title") +
          values([["Environment", state.environment, "persisted identity"], ["Port", state.port], ["Config scope", "this project only"]]) +
          line("Environment identity helps distinguish configured copies.", "term-dim") +
          line("After deployment, changing it may change resource identity.", "term-warning") +
          choices([["edit-environment", "Edit environment name before deployment"], ["back-review", "Back to deployment review"]]);
        break;
      case "environment":
        annotation = "edit";
        html = line("Environment name", "term-title") +
          line("Use 1-64 letters, digits, or hyphens; begin with a letter.", "term-dim") +
          line("Changing a deployed identity may create another set of resources.", "term-warning") +
          `<form class="term-form" id="environment-form"><label>Name<input name="environment" required maxlength="64" pattern="[A-Za-z][A-Za-z0-9-]{0,63}" value="${escape(state.environment)}" aria-describedby="environment-error"></label>` +
          `<p class="term-error" id="environment-error" role="alert">${escape(state.formError)}</p><button class="term-submit" type="submit">Save environment name</button></form>` +
          back("back-environment", "Back without changes");
        break;
      case "resources":
        html = line("Illustrative resource changes - not an Azure plan", "term-title") +
          values([["Scope", `${subscriptions[state.subscription].name} / ${regions[state.region]}`],
            ["Resource group", state.environment], ["Hosting", "Container Apps environment and app"],
            ["Supporting", "Container registry; monitoring workspace"], ["Ingress", state.publicAccess ? "Public HTTPS website" : "External ingress disabled"]]) +
          line("SKU, price, identity, network, and template-specific changes need", "term-warning") +
          line("a real resolved plan. Hooks and extensions may add side effects.", "term-warning") +
          line("No price estimate or complete preview is claimed.", "term-dim") +
          back("back-review", "Back to deployment review");
        break;
      case "production":
        html = cloudCommand + line("Production target selected: checkout-prod", "term-warning") +
          line("This fixture represents existing production resources.", "term-dim") +
          line("No cloud changes have been made.", "term-dim") +
          `<form class="term-form" id="production-form"><label class="term-checkbox"><input type="checkbox" name="acknowledge" required> I intend to update the production target in this simulation.</label><button class="term-submit" type="submit">Confirm simulated production deployment</button></form>` +
          back("back-review", "Return without deploying");
        break;
      case "complete":
        html = cloudCommand + line("Simulated deployment complete.", "term-success") +
          values([["App", name], ["Subscription", subscriptions[state.subscription].name], ["Region", regions[state.region]], ["Environment", state.environment]]) +
          line("In a real run, azd would show the actual deployed endpoints.", "term-dim") +
          line("This prototype created no resources, URLs, files, or charges.", "term-warning") +
          choices([["repeat", "Simulate another update with saved settings"], ["restart", "Restart this scenario"]]);
        break;
      case "repeat":
        annotation = "complete";
        html = cloudCommand + line("Using this project's saved destination.", "term-success") +
          values([["Subscription", subscriptions[state.subscription].name], ["Region", regions[state.region]], ["Environment", state.environment]]) +
          line("No destination picker is needed when settings remain valid.", "term-dim") +
          line("Material changes would still require the appropriate review.", "term-warning") +
          choices([["review-again", "Review settings for another simulated update"], ["restart", "Restart this scenario"]]);
        break;
      case "cancelled":
        html = line("Stopped. No Azure operations were performed.", "term-warning") +
          line(state.prepared ? "Local preparation had completed in this simulation." : "Local preparation was not completed.", "term-dim") +
          line("No new destination was applied by cancellation.", "term-dim") +
          choices([["restart", "Restart this scenario"]]);
        break;
      case "starting-options":
        annotation = "prepare";
        html = line("Choose a starting point", "term-title") +
          choices([["start-code", "Prepare the existing app"], ["start-template", "Start from a sample template"], ["start-minimal", "Create minimal project configuration"], ["cancel", "Cancel"]]);
        break;
      case "minimal":
        annotation = "prepared";
        html = line("azd init --minimal", "term-command") +
          line("Minimal project configuration prepared. (Simulation)", "term-success") +
          line("No deployable app components are configured yet.", "term-dim") +
          line("Next: use azd add to configure components before deployment.", "term-dim") +
          choices([["restart", "Return to the app preparation scenario"]]);
        break;
      case "agent":
        html = line(state.route === "template" ? "azd init --template todo-nodejs-mongo --no-prompt" : "azd init --from-code --no-prompt", "term-command") +
          line("Project setup and generated identity resolved. (Simulation)", "term-success") +
          line("azd up --no-prompt", "term-command") +
          line("ERROR: Subscription could not be resolved unambiguously.", "term-error") +
          line("Provide --subscription <id> and a valid --location.", "term-dim") +
          line("No interactive picker or guessed billing scope.", "term-warning") +
          line("Dashboard demonstration control (not a CLI prompt):", "term-dim") +
          choices([["agent-supply", "Demonstrate explicit caller inputs"], ["restart", "Restart"]]);
        break;
      case "agent-ready":
        annotation = "agent";
        html = line(`azd up --subscription ${subscriptions.sandbox.id} --location northeurope --no-prompt`, "term-command") +
          line("Required destination values resolved from explicit inputs.", "term-success") +
          line("A real invocation proceeds only under the caller's authorization.", "term-dim") +
          line("This dashboard does not execute the command.", "term-warning") +
          line("Resolved target: Developer Sandbox / North Europe", "term-dim") +
          choices([["restart", "Restart the agent scenario"]]);
        break;
      default:
        throw new Error(`Unknown prototype stage: ${state.stage}`);
    }
    terminal.innerHTML = html;
    terminal.dataset.stage = state.stage;
    document.getElementById("terminal-caption").textContent = `${name} - ${state.concept === "progressive" ? "progressive setup" : "upfront review"}`;
    annotate(annotation);
    if (focus) {
      const target = terminal.querySelector("input, select, button") || terminal;
      target.focus({ preventScroll: true });
      status.textContent = `Simulation: ${annotations[annotation][1]} No real Azure changes.`;
    }
  }

  terminal.addEventListener("click", (event) => {
    const action = event.target.closest("[data-action]")?.dataset.action;
    if (!action) return;
    switch (action) {
      case "prepare": state.prepared = true; state.stage = "prepared"; break;
      case "accept-setup": resolveFor("prepared"); break;
      case "run-up": resolveFor("review"); break;
      case "deploy": state.stage = state.environment === "checkout-prod" ? "production" : "complete"; state.deployed = state.stage === "complete"; break;
      case "detect": state.editReturn = "prepare"; state.stage = "detect"; break;
      case "edit-setup": state.editReturn = "upfront"; state.stage = "edit"; break;
      case "edit-cloud": state.editReturn = "review"; state.stage = "edit"; break;
      case "replace-subscription": state.stage = "subscription"; break;
      case "subscription-sandbox":
      case "subscription-team":
        state.subscription = action === "subscription-sandbox" ? "sandbox" : "team";
        state.subscriptionSource = "selected for this project";
        state.subscriptionResolved = true;
        // A billing-scope change invalidates dependent region validation.
        state.regionResolved = false;
        if (state.scenario === "region") state.stage = "region";
        else state.stage = "confirm-region";
        break;
      case "confirm-saved-region":
        state.regionResolved = true;
        if (state.resume) resolveFor(state.resume);
        else state.stage = state.editReturn || "review";
        break;
      case "edit-subscription": state.stage = "subscription"; break;
      case "edit-region":
        state.regionReturn = state.stage === "confirm-region" ? "confirm-region" : "edit";
        state.stage = "choose-region";
        break;
      case "region-north":
        state.region = "northeurope"; state.regionSource = "selected for this project"; state.regionResolved = true;
        if (state.resume) resolveFor(state.resume);
        else state.stage = state.editReturn || "review";
        break;
      case "choose-west":
      case "choose-north":
        state.region = action === "choose-west" ? "westeurope" : "northeurope";
        state.regionSource = "selected for this project"; state.regionResolved = true;
        if (state.resume) resolveFor(state.resume);
        else state.stage = state.editReturn || "review";
        break;
      case "target-dev":
      case "target-staging":
      case "target-prod":
        state.environment = { "target-dev": "checkout-dev", "target-staging": "checkout-staging", "target-prod": "checkout-prod" }[action];
        state.targetResolved = true;
        resolveFor(state.resume || "review");
        break;
      case "edit-access": state.stage = "access"; break;
      case "access-public":
      case "access-private": state.publicAccess = action === "access-public"; state.stage = state.editReturn || "review"; break;
      case "edit-detection": state.stage = "detect"; break;
      case "edit-environment":
        if (state.stage === "advanced") state.editReturn = "advanced";
        state.formError = ""; state.stage = "environment"; break;
      case "back": state.stage = state.editReturn || "review"; break;
      case "back-detect": state.stage = state.editReturn || "prepare"; break;
      case "back-environment": state.stage = state.editReturn === "advanced" ? "advanced" : "edit"; break;
      case "back-edit": state.stage = "edit"; break;
      case "back-region": state.stage = state.regionReturn; break;
      case "back-review": state.stage = "review"; break;
      case "resources": state.stage = "resources"; break;
      case "advanced": state.stage = "advanced"; break;
      case "cancel": state.stage = "cancelled"; break;
      case "repeat": state.stage = "repeat"; break;
      case "review-again": state.stage = "review"; break;
      case "starting-options": state.stage = "starting-options"; break;
      case "start-minimal": state.stage = "minimal"; break;
      case "start-code": setConfig({ route: "code" }); return;
      case "start-template": setConfig({ route: "template" }); return;
      case "agent-supply": state.stage = "agent-ready"; break;
      case "restart": reset(configKey(), true); return;
      default: throw new Error(`Unknown prototype action: ${action}`);
    }
    render();
  });

  terminal.addEventListener("submit", (event) => {
    event.preventDefault();
    const form = event.target;
    if (!form.reportValidity()) return;
    const data = new FormData(form);
    if (form.id === "detection-form") {
      const port = Number(data.get("port"));
      if (!Number.isInteger(port) || port < 1 || port > 65535) return;
      state.language = data.get("runtime");
      state.port = port;
      state.stage = state.editReturn || "prepare";
    } else if (form.id === "environment-form") {
      const name = String(data.get("environment")).trim();
      const fixtureTargets = ["checkout-dev", "checkout-staging", "checkout-prod"];
      if (fixtureTargets.includes(name) && name !== state.environment && state.scenario === "targets") {
        state.formError = "That name belongs to an existing fixture target. Select that environment explicitly instead of adopting it by name.";
        render();
        return;
      }
      if (state.deployed && name !== state.environment) {
        state.formError = "This simulated target is already deployed. Use an explicit new-environment workflow; an identity edit is not a harmless rename.";
        render();
        return;
      }
      state.environment = name;
      state.stage = state.editReturn === "advanced" ? "advanced" : "upfront";
    } else if (form.id === "production-form") {
      state.deployed = true;
      state.stage = "complete";
    } else {
      throw new Error(`Unknown prototype form: ${form.id}`);
    }
    render();
  });

  terminal.addEventListener("keydown", (event) => {
    const current = event.target.closest(".terminal-choice");
    if (!current || !["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    const options = [...current.parentElement.querySelectorAll(".terminal-choice")];
    const index = options.indexOf(current);
    const next = event.key === "Home" ? 0 : event.key === "End" ? options.length - 1
      : (index + (event.key === "ArrowDown" ? 1 : -1) + options.length) % options.length;
    event.preventDefault();
    options[next].focus();
  });
  document.querySelectorAll("[data-concept]").forEach((button) => {
    button.addEventListener("click", () => setConfig({ concept: button.dataset.concept }));
  });
  scenarioSelect.addEventListener("change", () => setConfig({ scenario: scenarioSelect.value }));
  routeSelect.addEventListener("change", () => setConfig({ route: routeSelect.value }));
  document.getElementById("reset-prototype").addEventListener("click", () => reset(configKey(), true));
  window.addEventListener("prototypeconfig", () => {
    const config = configKey();
    if (config.key !== lastConfig) reset(config, false);
  });
  reset();
})();
