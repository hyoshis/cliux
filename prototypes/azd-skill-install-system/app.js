(function () {
  'use strict';

  const { scenarios, states, getScenario, decide, buildPlan, resolveInstallation } = window.SkillLab;
  const pages = Array.from(document.querySelectorAll('.page'));
  const stateSelect = document.getElementById('environment-state');
  const resultSelect = document.getElementById('install-result');
  const designSelect = document.getElementById('cli-design');
  const flowStatus = document.getElementById('flow-status');
  const declines = new Set();
  const choicesByScenario = new Map();
  const installations = new Map();
  const designs = {
    companion: 'A contextual yes/no invitation, then native assistant and scope prompts. Consent to explore comes before refinement; the final plan needs its own confirmation.',
    wizard: 'An explicit setup command opens a native package, assistant, and scope wizard. A plain-text plan and one final confirmation precede installation.',
    defaults: 'Show the known assistant, scope, contents, and source as plain text. One arrow-key choice installs the reviewed plan, opens customization, or declines.',
  };
  let scenario = getScenario('foundry');
  let environment = 'missing';
  let installResult = 'success';
  let design = 'defaults';
  let choices;
  let selectedPlan;
  let completed = [];
  let failed = [];
  let loaded = false;
  let managed = false;
  let reviewAction = 'install';
  let selectedInventoryKey;
  let currentPage;
  let toastTimer;
  let initialCommand = true;
  const terminal = new window.AzdTerminal(
    document.getElementById('terminal-screen'),
    document.getElementById('transcript'),
    document.getElementById('interaction'),
    cancelSetup,
  );

  function element(tag, text, className) {
    const node = document.createElement(tag);
    if (text !== undefined) node.textContent = text;
    if (className) node.className = className;
    return node;
  }

  function line(text, kind) {
    terminal.line(text, kind);
  }

  function status(text) {
    flowStatus.textContent = text;
    document.getElementById('activate-session').disabled = !selectedPlan || !completed.length || failed.length > 0 || loaded;
  }

  function toast(message) {
    const node = document.getElementById('toast');
    window.clearTimeout(toastTimer);
    node.textContent = message;
    node.hidden = false;
    toastTimer = window.setTimeout(() => { node.hidden = true; }, 6500);
  }

  function contextKey() {
    const project = scenario.project ? (scenario.id === 'project' ? 'agent-app' : 'team-app') : 'no-project';
    return `${project}|${choices.assistant}|${scenario.id}|${scenario.skills.map((skill) => skill.id).join(',')}`;
  }

  function shellPrefix() {
    return `PS C:\\work${scenario.project ? `\\${scenario.id === 'project' ? 'agent-app' : 'team-app'}` : ''}>`;
  }

  function shell() {
    terminal.command(shellPrefix(), handleCommand);
  }

  function cancelSetup() {
    line(completed.length ? 'Cancelled. Installed components were retained.' : 'Cancelled. No optional skill installation started.', 'warning');
    line('Your original azd workflow remains available.', 'muted');
    status('Cancelled; original task remains available');
    shell();
  }

  function resetMemory() {
    declines.clear();
    installations.clear();
    choicesByScenario.clear();
    toast('Demo installations and decline preferences cleared. No real files changed.');
    begin(true);
  }

  function skip() {
    choicesByScenario.set(scenario.id, { ...choices });
    declines.add(contextKey());
    line('Skill installation skipped. No assistant files or MCP settings changed.', 'muted');
    line(scenario.continuation, 'heading');
    line('To set up later, run: azd tool configure', 'muted');
    status('Skipped; original task remains available');
    shell();
  }

  function showPlan(plan = buildPlan(scenario.id, choices.assistant, choices.scope, choices.packageKind)) {
    line(reviewAction === 'update' ? 'Skill update plan' : 'Skill installation plan', 'heading');
    plan.items.forEach((item, index) => terminal.field(index === 0 ? 'Install:' : '', item));
    terminal.field('Assistant:', plan.host);
    terminal.field('Scope:', plan.scopeLabel);
    terminal.field('Location:', plan.location);
    terminal.field('Publisher:', 'Microsoft');
    terminal.field('Source:', plan.source);
    if (plan.packageKind === 'plugin') {
      line('The full Azure plugin includes both Azure and Foundry MCP configuration.', 'warning');
    }
    line('No Azure permissions are granted. Authentication and tool approval are separate.', 'muted');
    return plan;
  }

  function approve() {
    selectedPlan = buildPlan(scenario.id, choices.assistant, choices.scope, choices.packageKind);
    choicesByScenario.set(scenario.id, { ...choices });
    declines.delete(contextKey());
    executeInstall();
  }

  function confirmPlan() {
    showPlan();
    status(reviewAction === 'update' ? 'Awaiting update confirmation' : 'Awaiting final installation confirmation');
    terminal.confirm(reviewAction === 'update' ? 'Update this installation?' : 'Install these components?', (yes) => {
      if (yes) approve();
      else if (reviewAction === 'update') {
        line('Update skipped. Current guidance remains usable.', 'muted');
        status('Update skipped; current version retained');
        shell();
      } else skip();
    });
  }

  function selectScope(onComplete) {
    if (!scenario.project) {
      choices.scope = 'user';
      line('No project is open. Installation applies across projects for the selected assistant only.', 'muted');
      onComplete();
      return;
    }
    status('Choose an installation scope');
    terminal.select('Select the installation scope', [
      { value: 'project', label: 'This project only (recommended)' },
      { value: 'user', label: 'Across my projects, for this assistant only' },
    ], (value) => {
      choices.scope = value;
      onComplete();
    }, choices.scope === 'user' ? 1 : 0);
  }

  function selectAssistant(onComplete) {
    status('Choose one coding assistant');
    terminal.select('Select a coding assistant', [
      { value: 'copilot', label: 'GitHub Copilot CLI' },
      { value: 'claude', label: 'Claude Code' },
    ], (value) => {
      choices.assistant = value;
      selectScope(onComplete);
    }, choices.assistant === 'claude' ? 1 : 0);
  }

  function renderReview(mode = design) {
    if (reviewAction === 'update') {
      line('A compatible update is available. The target, scope, and capability set are unchanged.', 'muted');
      confirmPlan();
    } else if (mode === 'companion') {
      choices.packageKind = 'skills';
      line(`Recommended: ${scenario.skills.map((skill) => skill.id).join(', ')}`, 'heading');
      line('Adds task-specific guidance to your coding assistant. Publisher: Microsoft.', 'muted');
      status('Optional companion invitation; no changes yet');
      terminal.confirm(scenario.question, (yes) => {
        if (yes) selectAssistant(confirmPlan);
        else skip();
      });
    } else if (mode === 'wizard') {
      status('Choose the Azure capabilities to add');
      terminal.select('Select what to install', [
        { value: 'skills', label: 'Relevant Azure skills only' },
        { value: 'plugin', label: 'Full Azure plugin (skills + Azure and Foundry MCP configuration)' },
      ], (value) => {
        choices.packageKind = value;
        selectAssistant(confirmPlan);
      }, choices.packageKind === 'plugin' ? 1 : 0);
    } else {
      showPlan();
      status('Review defaults; Enter on the install choice approves this plan');
      terminal.select('How would you like to continue?', [
        { value: 'install', label: 'Install with the settings above' },
        { value: 'customize', label: 'Change assistant or installation scope' },
        { value: 'skip', label: 'Not now' },
      ], (value) => {
        if (value === 'install') approve();
        else if (value === 'customize') selectAssistant(confirmPlan);
        else skip();
      });
    }
  }

  function executeInstall() {
    terminal.clear();
    completed = [];
    failed = [];
    loaded = false;
    managed = true;
    line(`${reviewAction === 'update' ? 'Updating' : 'Installing'} selected components for ${selectedPlan.host}...`, 'heading');
    if (installResult === 'failure') {
      failed = [...selectedPlan.items];
      line('ERROR: Unable to download from the approved source.', 'error');
      line('No new items installed. Existing guidance remains unchanged.', 'warning');
      recovery();
    } else if (installResult === 'partial') {
      if (selectedPlan.items.length > 1) {
        completed = selectedPlan.items.slice(0, -1);
        failed = selectedPlan.items.slice(-1);
        completed.forEach((item) => line(`(\u2713) Done: ${item}`, 'success'));
        failed.forEach((item) => line(`ERROR: Could not register ${item}.`, 'error'));
      } else {
        completed = [...selectedPlan.items];
        failed = ['Host discovery registration'];
        line(`(\u2713) Done: Downloaded ${completed[0]}`, 'success');
        line('ERROR: Host discovery registration did not complete.', 'error');
      }
      line('Installation is incomplete. Successful items have been retained.', 'warning');
      recovery();
    } else {
      completed = [...selectedPlan.items];
      completed.forEach((item) => line(`(\u2713) Done: ${item}`, 'success'));
      loaded = installResult === 'active';
      receipt();
    }
  }

  function recovery() {
    terminal.field('Completed:', completed.length ? completed.join(', ') : 'None');
    terminal.field('Still missing:', failed.join(', '));
    status(completed.length ? 'Partial installation; not ready' : 'Installation failed');
    terminal.confirm('Retry only the failed items?', (yes) => {
      if (!yes) {
        line('Retry skipped. Your original workflow remains available.', 'muted');
        status('Incomplete installation retained; retry skipped');
        shell();
        return;
      }
      line('Retrying the approved source and host registration...', 'muted');
      failed.forEach((item) => line(`(\u2713) Retry succeeded: ${item}`, 'success'));
      completed = [...selectedPlan.items];
      failed = [];
      receipt();
    });
  }

  function rememberInstallation() {
    const project = selectedPlan.scope === 'user' ? 'all-projects' : selectedPlan.projectKey;
    selectedInventoryKey = `${selectedPlan.assistant}|${project}|${selectedPlan.packageKind}|${selectedPlan.skills.join(',')}`;
    installations.set(selectedInventoryKey, { plan: selectedPlan, loaded, managed });
  }

  function managementId() {
    return selectedPlan.packageKind === 'plugin' ? 'azure-skills' : selectedPlan.skills[0];
  }

  function receipt() {
    terminal.clear();
    rememberInstallation();
    line('SUCCESS: Selected components installed.', 'success');
    terminal.field('Assistant:', selectedPlan.host);
    terminal.field('Scope:', selectedPlan.scopeLabel);
    if (loaded) line('The assistant has discovered and loaded the guidance.', 'success');
    else line(`Start a new ${selectedPlan.host} session to load the guidance.`, 'warning');
    if (selectedPlan.packageKind === 'plugin') {
      line('MCP configuration is installed. Server startup and Azure sign-in are separate.', 'muted');
    }
    line('Manage this installation: azd tool list', 'muted');
    status(loaded ? 'Loaded; ready for guidance only' : 'Installed; new session or supported reload required');
    shell();
  }

  function activateSession() {
    if (!selectedPlan || !completed.length || failed.length || loaded) return;
    terminal.clear();
    loaded = true;
    rememberInstallation();
    line('New assistant session: guidance discovered and loaded.', 'success');
    line('No cloud operations have been requested or approved.', 'muted');
    status('Loaded; ready for guidance only');
    shell();
    terminal.focus();
  }

  function manage() {
    if (!selectedPlan || !completed.length) {
      line('No installed guidance found for the selected assistant and scope.', 'muted');
      shell();
      return;
    }
    showPlan(selectedPlan);
    terminal.field('Ownership:', managed ? 'azd-managed example' : 'Project-bundled or externally managed');
    terminal.field('Readiness:', loaded ? 'Loaded in the current demo session' : 'New session required');
    if (managed) {
      line(`Update:    azd tool update ${managementId()}`, 'muted');
      line(`Uninstall: azd tool uninstall ${managementId()}`, 'muted');
    } else {
      line('Use the original owner or installer to update or remove these files.', 'muted');
    }
    status('Inspecting one installation; no changes made');
    shell();
  }

  function confirmRemoval() {
    showPlan(selectedPlan);
    line('Only installer-owned files at this target and scope will be removed.', 'warning');
    terminal.confirm('Uninstall this skill installation?', (yes) => {
      if (yes) {
        if (selectedInventoryKey) installations.delete(selectedInventoryKey);
        completed = [];
        loaded = false;
        line('SUCCESS: Selected installation removed.', 'success');
        line('Other assistants, other scopes, and the companion extension were not changed.', 'muted');
        status('Selected installation removed');
      } else {
        line('Uninstall cancelled. Installed guidance was retained.', 'muted');
        status('Removal cancelled; installation retained');
      }
      shell();
    });
  }

  function evaluate() {
    const existing = environment === 'missing'
      ? resolveInstallation(Array.from(installations.values()), scenario.id, choices.assistant) : undefined;
    const decision = existing
      ? { action: 'reuse', reason: 'Existing guidance is available to this assistant. No duplicate download.' }
      : declines.has(contextKey()) && environment === 'missing' && scenario.id !== 'setup'
      ? { action: 'suppress', reason: 'This recommendation was previously declined. Not asking again.' }
      : decide(scenario.id, environment);
    line(decision.reason, decision.action === 'prompt' || decision.action === 'update' ? 'heading' : 'muted');
    terminal.clear();
    switch (decision.action) {
      case 'prompt':
        if (environment === 'changed') line('This task needs a different capability set from the recommendation you declined.', 'warning');
        renderReview();
        break;
      case 'update':
        selectedPlan = buildPlan(scenario.id, choices.assistant, choices.scope, choices.packageKind);
        completed = [...selectedPlan.items];
        managed = true;
        loaded = true;
        reviewAction = 'update';
        renderReview();
        break;
      case 'reuse':
        selectedPlan = existing ? existing.plan : buildPlan(scenario.id, choices.assistant, choices.scope, choices.packageKind);
        choices = { assistant: selectedPlan.assistant, scope: selectedPlan.scope, packageKind: selectedPlan.packageKind };
        completed = [...selectedPlan.items];
        loaded = existing ? existing.loaded : true;
        managed = existing ? existing.managed : environment === 'installed';
        if (existing) rememberInstallation();
        line(`Using installed guidance for ${selectedPlan.host}.`, 'success');
        if (!loaded) line('The files are installed; open a new assistant session to load them.', 'warning');
        status('Reused existing guidance; no install prompt');
        shell();
        break;
      case 'suppress':
        line('Set up guidance later with: azd tool configure', 'muted');
        status('Suppressed; previous decline respected');
        shell();
        break;
      case 'plan':
        line(JSON.stringify({
          kind: 'optional_skill_plan', proposedSchema: true, installAuthorized: false,
          skills: scenario.skills.map((skill) => skill.id), assistant: choices.assistant,
          scope: choices.scope, source: 'microsoft/azure-skills',
          next: 'Use an explicitly approved setup step; preserve the original command exit status.',
        }, null, 2), 'muted');
        status('Machine-readable plan; no interactive azd prompt or install');
        shell();
        break;
      case 'conflict':
        line('WARNING: Custom content was left untouched. Resolve the ownership or version conflict before installing.', 'warning');
        status('Conflict; custom files preserved');
        shell();
        break;
      case 'prerequisite':
        line('No supported coding assistant was detected. Installing an assistant is a separate step.', 'warning');
        line('Continue without skills, or run setup after choosing a supported assistant.', 'muted');
        status('No host detected; no installation attempted');
        shell();
        break;
      case 'blocked':
        line('ERROR: Organization policy does not allow this source.', 'error');
        line('Ask your administrator for an approved source. No alternate download was attempted.', 'muted');
        status('Blocked by policy; no bypass');
        shell();
        break;
      case 'offline':
        line('WARNING: The approved source is unreachable. Existing files are unchanged.', 'warning');
        line('Run azd tool configure after connectivity is restored.', 'muted');
        status('Offline; original task remains available');
        shell();
        break;
      case 'none':
        line(scenario.continuation, 'success');
        status('No assistance intent; no skill prompt');
        shell();
        break;
      default:
        throw new Error(`Unhandled decision: ${decision.action}`);
    }
  }

  function runScenario() {
    completed = [];
    failed = [];
    loaded = false;
    managed = false;
    selectedPlan = undefined;
    selectedInventoryKey = undefined;
    reviewAction = 'install';
    choices = { ...(choicesByScenario.get(scenario.id) || {
      assistant: 'copilot', scope: scenario.project ? 'project' : 'user',
      packageKind: scenario.id === 'setup' ? 'plugin' : 'skills',
    }) };
    if (scenario.proposedCommand) line('Assistant setup entry point (proposed command).', 'muted');
    scenario.before.forEach((text) => line(text.replace(/ \(simulated\)/g, ''), 'muted'));
    if (scenario.entry === 'help' && environment === 'ci') {
      line('AI troubleshooting was explicitly requested by the non-interactive caller.', 'muted');
      evaluate();
    } else if (scenario.entry === 'help') {
      status('Failure alone does not trigger a skill offer');
      terminal.confirm('Ask your coding assistant for help with this failure?', (yes) => {
        if (yes) {
          line('Starting the requested AI troubleshooting handoff.', 'heading');
          evaluate();
        } else {
          line('Original deployment error retained. No AI handoff or skill installation started.', 'muted');
          status('No AI help requested; no skill recommendation');
          shell();
        }
      });
    } else evaluate();
  }

  function handleCommand(command) {
    const normalized = command.trim().replace(/\s+/g, ' ').toLowerCase();
    if (initialCommand || normalized === scenario.command.toLowerCase()) {
      if (normalized !== scenario.command.toLowerCase()) {
        line(`This prototype starts with: ${scenario.command}`, 'error');
        terminal.command(shellPrefix(), handleCommand, scenario.command);
        return;
      }
      initialCommand = false;
      runScenario();
    } else if (normalized === 'azd tool configure') {
      reviewAction = 'install';
      if (!scenario.skills.length) {
        line('Choose an assistant-setup scenario to explore skill installation.', 'muted');
        shell();
      } else {
        const gate = decide(scenario.id, environment);
        if (['blocked', 'conflict', 'prerequisite', 'offline', 'plan'].includes(gate.action)) evaluate();
        else renderReview('wizard');
      }
    } else if (normalized === 'azd tool list') manage();
    else if (selectedPlan && completed.length && managed && normalized === `azd tool update ${managementId()}`) {
      reviewAction = 'update';
      renderReview();
    } else if (selectedPlan && completed.length && managed && normalized === `azd tool uninstall ${managementId()}`) confirmRemoval();
    else if (normalized === 'azd extension uninstall azure.ai.agents' && scenario.id === 'foundry') {
      line('SUCCESS: Companion extension removed. Shared Foundry guidance was retained.', 'success');
      status('Extension removed; shared skill retained');
      shell();
    } else {
      line('This is a scripted prototype, not a connected shell. No command was executed.', 'error');
      line(`Supported: ${scenario.command}, azd tool configure, azd tool list`, 'muted');
      if (selectedPlan && managed) line(`Also: azd tool update ${managementId()}, azd tool uninstall ${managementId()}`, 'muted');
      shell();
    }
  }

  function begin(moveFocus) {
    terminal.transcript.replaceChildren();
    terminal.clear();
    selectedPlan = undefined;
    completed = [];
    failed = [];
    loaded = false;
    initialCommand = true;
    document.getElementById('scenario-title').textContent = scenario.title;
    document.getElementById('scenario-group').textContent = scenario.group.toUpperCase();
    document.getElementById('scenario-why').textContent = scenario.why;
    document.getElementById('scenario-trigger').textContent = `Trigger: ${scenario.trigger}`;
    document.getElementById('design-description').textContent = designs[design];
    stateSelect.value = environment;
    resultSelect.value = installResult;
    designSelect.value = design;
    document.querySelectorAll('.scenario-button').forEach((button) => {
      button.setAttribute('aria-pressed', String(button.dataset.scenario === scenario.id));
    });
    status('Press Enter to run the suggested command');
    terminal.command(shellPrefix(), handleCommand, scenario.command);
    if (moveFocus) terminal.focus();
  }

  function writeLabRoute() {
    const query = new URLSearchParams({ scenario: scenario.id, state: environment, result: installResult, design });
    const next = `#lab?${query}`;
    if (window.location.hash === next) begin(true);
    else window.location.hash = next;
  }

  function route() {
    const raw = window.location.hash.slice(1) || 'overview';
    const [target, queryText = ''] = raw.split('?');
    const anchor = document.getElementById(target);
    let page = pages.find((item) => item.id === target);
    if (!page && anchor) page = anchor.closest('.page');
    if (!page && target === 'main') page = pages.find((item) => item.id === (currentPage || 'overview'));
    if (!page) {
      page = document.getElementById('overview');
      toast('This section link is not recognized. Showing the recommendation.');
    }
    const changedPage = currentPage !== page.id;
    pages.forEach((item) => { item.hidden = item !== page; });
    document.querySelectorAll('[data-page]').forEach((link) => {
      if (link.dataset.page === page.id) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });
    currentPage = page.id;
    document.title = `${page.querySelector('h1').textContent.trim().replace(/\s+/g, ' ')} | azd skills strategy`;
    if (page.id === 'lab') {
      const query = new URLSearchParams(queryText);
      const id = query.get('scenario') || scenario.id;
      const state = query.get('state') || 'missing';
      const result = query.get('result') || 'success';
      const selectedDesign = query.get('design') || (id === 'setup' ? 'wizard' : 'defaults');
      const validScenario = scenarios.some((item) => item.id === id);
      const validState = states.some((item) => item.id === state);
      const validResult = ['success', 'active', 'failure', 'partial'].includes(result);
      const validDesign = Object.hasOwn(designs, selectedDesign);
      scenario = getScenario(validScenario ? id : 'foundry');
      environment = validState ? state : 'missing';
      installResult = validResult ? result : 'success';
      design = validDesign ? selectedDesign : 'defaults';
      if (!validScenario || !validState || !validResult || !validDesign) toast('Some scenario-link settings were not recognized. Valid defaults are shown in the lab controls.');
      begin(false);
    }
    if (changedPage) window.scrollTo({ top: 0, behavior: 'instant' });
    if (anchor && anchor !== page && anchor.id !== 'main') anchor.scrollIntoView();
  }

  const scenarioButtons = document.getElementById('scenario-buttons');
  let lastGroup;
  scenarios.forEach((item) => {
    if (item.group !== lastGroup) {
      scenarioButtons.append(element('p', item.group, 'scenario-group-label'));
      lastGroup = item.group;
    }
    const button = element('button', undefined, 'scenario-button');
    button.type = 'button';
    button.dataset.scenario = item.id;
    button.setAttribute('aria-pressed', 'false');
    button.append(element('span', item.number), element('span', item.title));
    button.addEventListener('click', () => {
      scenario = item;
      environment = 'missing';
      installResult = 'success';
      design = item.id === 'setup' ? 'wizard' : 'defaults';
      writeLabRoute();
    });
    scenarioButtons.append(button);
  });
  states.forEach((item) => {
    const option = element('option', item.label);
    option.value = item.id;
    option.title = item.description;
    stateSelect.append(option);
  });
  stateSelect.addEventListener('change', () => {
    environment = stateSelect.value;
    writeLabRoute();
  });
  resultSelect.addEventListener('change', () => {
    installResult = resultSelect.value;
    writeLabRoute();
  });
  designSelect.addEventListener('change', () => {
    design = designSelect.value;
    writeLabRoute();
  });
  document.getElementById('restart-scenario').addEventListener('click', () => begin(true));
  document.getElementById('reset-demo').addEventListener('click', resetMemory);
  document.getElementById('activate-session').addEventListener('click', activateSession);
  document.querySelectorAll('[data-terminal-key]').forEach((button) => {
    button.addEventListener('click', () => terminal.sendKey(button.dataset.terminalKey));
  });
  document.querySelectorAll('[data-compare-filter]').forEach((button) => {
    button.addEventListener('click', () => {
      const selected = button.dataset.compareFilter;
      document.querySelectorAll('[data-compare-filter]').forEach((item) => {
        item.setAttribute('aria-pressed', String(item === button));
      });
      document.querySelectorAll('[data-column]').forEach((cell) => {
        cell.hidden = selected !== 'all' && cell.dataset.column !== selected;
      });
    });
  });
  let printDetails = [];
  window.addEventListener('beforeprint', () => {
    printDetails = Array.from(document.querySelectorAll('details')).filter((item) => !item.open);
    printDetails.forEach((item) => { item.open = true; });
  });
  window.addEventListener('afterprint', () => { printDetails.forEach((item) => { item.open = false; }); });
  document.getElementById('print-button').addEventListener('click', () => window.print());
  document.getElementById('share-button').addEventListener('click', async () => {
    if (!navigator.clipboard || !window.isSecureContext) {
      toast('Clipboard access is unavailable here. Copy the browser address to share this view.');
      return;
    }
    try {
      await navigator.clipboard.writeText(window.location.href);
      const local = window.location.protocol === 'file:' || ['localhost', '127.0.0.1'].includes(window.location.hostname);
      toast(local ? 'Local preview link copied. Publish the static folder before sharing outside this machine.' : 'View link copied, including the scenario, CLI design option, and test conditions.');
    } catch (error) {
      toast(`Could not copy the view link (${error.name}). Copy the browser address instead.`);
    }
  });
  window.addEventListener('hashchange', route);
  window.addEventListener('load', () => {
    const target = window.location.hash.slice(1).split('?')[0];
    if (pages.some((page) => page.id === target)) window.requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  });
  route();
})();
