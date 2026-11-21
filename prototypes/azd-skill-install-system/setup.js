(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const setupCommand = 'azd tool install ai-dev';
  const foundryBundle = { id: 'microsoft.foundry' };
  const tools = [
    { id: 'azure-skills', name: 'Azure skills', detail: 'Guidance for building AI apps.' },
    { id: 'foundry-skills', name: 'Foundry skills', detail: 'Guidance for working with Foundry.' },
    { id: 'azure', name: 'Azure MCP', detail: 'Connect your assistant to Azure.' },
    { id: 'foundry', name: 'Foundry MCP (Preview)', detail: 'Work with models and agents.' },
    { id: 'agents', name: 'Foundry extensions', detail: 'Build and deploy agents.' },
    { id: 'learn', name: 'Microsoft Learn MCP', detail: 'Find official docs and examples.' },
  ];
  const toolNameWidth = Math.max(28, ...tools.map((item) => item.name.length + 2));
  const hosts = { copilot: 'GitHub Copilot CLI', claude: 'Claude Code' };
  const assistantChoices = [
    { value: 'copilot', targets: ['copilot'], label: hosts.copilot },
    { value: 'claude', targets: ['claude'], label: hosts.claude },
    { value: 'both', targets: ['copilot', 'claude'], label: 'GitHub Copilot CLI + Claude Code' },
  ];
  const scopeChoices = [
    { value: 'user', label: 'User level (all your projects)' },
    { value: 'project', label: 'Project level (this folder only)' },
  ];
  const projectPath = 'C:\\work\\my-ai-app';
  const stages = ['choose', 'install'];
  const timers = new Set();
  const inventory = new Map();
  const sharedTools = new Set();
  const outdatedTools = new Set();
  let selected = new Set(tools.map((item) => item.id));
  let assistantMode = 'both';
  let scope = 'user';
  let environment;
  let phase = 'command';
  let busy = false;
  let installedThisRun = 0;
  let currentPlan = [];

  function node(tag, text, className) {
    const element = document.createElement(tag);
    if (text !== undefined) element.textContent = text;
    if (className) element.className = className;
    return element;
  }

  function choiceRow(focused, checked, label, detail) {
    const row = node('div', undefined, `azd-choice${focused ? ' focused' : ''}`);
    row.append(`  ${focused ? '>' : ' '} [`, node('span', checked ? '\u2713' : ' ', checked ? 'azd-check' : undefined), `] ${label}`);
    if (detail) row.append(node('span', detail, 'azd-dim'));
    return row;
  }

  function keyHint(prompt) {
    const hint = node('div');
    [['\u2191\u2193', 'Move'], ['Space', 'Select'], ['Enter', 'Confirm']].forEach(([key, label], index) => {
      if (index) hint.append(node('span', ' \u2022 ', 'azd-dim'));
      hint.append(node('span', key, 'azd-key'), node('span', ` ${label}`, 'azd-dim'));
    });
    prompt.instructions.replaceChildren(node('div', '\u2500'.repeat(39), 'azd-dim'), hint);
  }

  class SetupTerminal extends window.AzdTerminal {
    select(message, options, onSelect, selectedIndex = 0) {
      super.select(message, options, onSelect, selectedIndex);
      const prompt = this.active;
      prompt.form.addEventListener('click', (event) => {
        const choice = event.target.closest('.azd-choice');
        if (!choice || this.active !== prompt) return;
        const choices = Array.from(prompt.form.querySelectorAll('.azd-choice'));
        const current = choices.findIndex((item) => item.getAttribute('aria-selected') === 'true');
        const target = choices.indexOf(choice);
        const distance = (target - current + choices.length) % choices.length;
        for (let index = 0; index < distance; index++) this.sendKey('ArrowDown');
        this.sendKey('Enter');
      });
    }

    selectTools(message, options, values, onSubmit) {
      const installed = options.filter(isCurrent);
      const choices = options.filter((option) => !isCurrent(option));
      const prompt = this.createPrompt(message, 'multi', '');
      keyHint(prompt);
      if (!choices.length) prompt.instructions.textContent = 'Enter to continue. Ctrl+C to cancel.';
      const answer = node('span', '', 'azd-answer');
      prompt.input.readOnly = true;
      prompt.row.append(answer, prompt.input);
      const list = node('div', undefined, 'azd-choice-list');
      list.id = `${prompt.id}-choices`;
      list.setAttribute('role', 'listbox');
      list.setAttribute('aria-label', message);
      list.setAttribute('aria-multiselectable', 'true');
      prompt.input.setAttribute('role', 'combobox');
      prompt.input.setAttribute('aria-controls', list.id);
      prompt.input.setAttribute('aria-expanded', 'true');
      const installedList = node('div');
      installedList.setAttribute('role', 'list');
      installedList.setAttribute('aria-label', 'Already installed tools');
      installed.forEach((option) => {
        const item = node('div', `        ${option.name.padEnd(toolNameWidth)}`, 'terminal-line');
        item.setAttribute('role', 'listitem');
        item.append(node('span', 'Already installed', 'azd-dim'));
        installedList.append(item);
      });
      prompt.form.append(list, installedList, prompt.error, prompt.instructions);
      let cursor = 0;
      const checked = new Set(choices.filter((option) => values.has(option.id)).map((option) => option.id));
      const render = () => {
        list.replaceChildren();
        choices.forEach((option, index) => {
          const detail = option.id === 'agents' && outdatedTools.has(foundryBundle.id)
            ? 'Update to latest' : option.detail;
          const item = choiceRow(cursor === index, checked.has(option.id), option.name.padEnd(toolNameWidth), detail);
          item.id = `${prompt.id}-choice-${index}`;
          item.setAttribute('role', 'option');
          item.setAttribute('aria-selected', String(checked.has(option.id)));
          item.addEventListener('click', () => {
            cursor = index;
            toggle();
          });
          list.append(item);
        });
        answer.textContent = choices.length
          ? `${checked.size} ${checked.size === 1 ? 'tool' : 'tools'} selected` : 'No changes needed';
        if (choices.length) prompt.input.setAttribute('aria-activedescendant', `${prompt.id}-choice-${cursor}`);
        else prompt.input.removeAttribute('aria-activedescendant');
        prompt.input.removeAttribute('aria-invalid');
        prompt.error.textContent = '';
        this.scroll();
      };
      const toggle = () => {
        if (!choices.length) return;
        const id = choices[cursor].id;
        if (checked.has(id)) checked.delete(id);
        else checked.add(id);
        render();
      };
      prompt.input.addEventListener('keydown', (event) => {
        if (!['ArrowDown', 'ArrowUp', ' '].includes(event.key)) return;
        event.preventDefault();
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
          if (!choices.length) return;
          cursor = (cursor + (event.key === 'ArrowDown' ? 1 : -1) + choices.length) % choices.length;
          render();
        } else toggle();
      });
      prompt.submit = () => {
        if (!checked.size && !installed.length) {
          prompt.input.setAttribute('aria-invalid', 'true');
          prompt.error.textContent = 'At least one option must be selected';
          this.scroll();
          return;
        }
        this.clear();
        this.answer(message, choices.filter((option) => checked.has(option.id)).map((option) => option.name).join(', ') || 'No changes selected');
        onSubmit(new Set([...installed.map((option) => option.id), ...checked]));
        this.focus();
      };
      render();
    }

    configure(message, defaults, onSubmit) {
      const prompt = this.createPrompt(message, 'multi', '');
      keyHint(prompt);
      prompt.input.readOnly = true;
      prompt.row.append(prompt.input);
      const list = node('div', undefined, 'azd-choice-list');
      list.id = `${prompt.id}-choices`;
      list.setAttribute('role', 'listbox');
      list.setAttribute('aria-label', message);
      list.setAttribute('aria-multiselectable', 'true');
      prompt.input.setAttribute('role', 'combobox');
      prompt.input.setAttribute('aria-controls', list.id);
      prompt.input.setAttribute('aria-expanded', 'true');
      const notice = node('div', '', 'azd-dim');
      prompt.form.append(list, notice, prompt.error, prompt.instructions);
      const checked = new Set(assistantChoices.find((choice) => choice.value === defaults.assistantMode).targets);
      const hostIds = Object.keys(hosts);
      let location = defaults.scope;
      let cursor = 0;
      const rowCount = hostIds.length + scopeChoices.length;
      const render = () => {
        list.replaceChildren();
        const addGroup = (label, choices, offset, radio) => {
          const group = node('div');
          group.setAttribute('role', 'group');
          group.setAttribute('aria-label', label);
          group.append(node('div', `  ${label}`, 'azd-setting-label'));
          choices.forEach((choice, index) => {
            const row = offset + index;
            const active = radio ? choice.value === location : checked.has(choice.value);
            const item = choiceRow(cursor === row, active, choice.label);
            item.id = `${prompt.id}-choice-${row}`;
            item.setAttribute('role', 'option');
            item.setAttribute('aria-selected', String(active));
            item.addEventListener('click', () => {
              cursor = row;
              toggle();
            });
            group.append(item);
          });
          list.append(group);
        };
        addGroup('Coding assistants', hostIds.map((value) => ({ value, label: hosts[value] })), 0, false);
        addGroup('Install location', scopeChoices, hostIds.length, true);
        notice.textContent = '';
        const hostLabel = hostIds.filter((value) => checked.has(value)).map((value) => hosts[value]).join(' + ');
        $('target-status').textContent = `${hostLabel || 'Select a coding assistant'} | ${location === 'project' ? 'Project level' : 'User level'}`;
        prompt.input.setAttribute('aria-activedescendant', `${prompt.id}-choice-${cursor}`);
        prompt.input.removeAttribute('aria-invalid');
        prompt.error.textContent = '';
        this.scroll();
      };
      const toggle = () => {
        if (cursor < hostIds.length) {
          const value = hostIds[cursor];
          if (checked.has(value)) checked.delete(value);
          else checked.add(value);
        } else location = scopeChoices[cursor - hostIds.length].value;
        render();
      };
      prompt.input.addEventListener('keydown', (event) => {
        if (!['ArrowDown', 'ArrowUp', ' '].includes(event.key)) return;
        event.preventDefault();
        if (event.key === ' ') toggle();
        else {
          cursor = (cursor + (event.key === 'ArrowDown' ? 1 : -1) + rowCount) % rowCount;
          render();
        }
      });
      prompt.submit = () => {
        if (!checked.size) {
          prompt.input.setAttribute('aria-invalid', 'true');
          prompt.error.textContent = 'At least one option must be selected';
          this.scroll();
          return;
        }
        const choice = assistantChoices.find((item) => item.targets.length === checked.size &&
          item.targets.every((value) => checked.has(value)));
        this.clear();
        this.answer(message, `${choice.label} | ${scopeChoices.find((item) => item.value === location).label}`);
        onSubmit({
          assistantMode: choice.value,
          scope: location,
        });
        this.focus();
      };
      render();
    }
  }

  const terminal = new SetupTerminal($('terminal-screen'), $('transcript'), $('interaction'), cancel);

  function later(action, delay = 300) {
    const timer = window.setTimeout(() => {
      timers.delete(timer);
      action();
    }, window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : delay);
    timers.add(timer);
  }

  const spinnerFrames = ['|       |', '|=      |', '|==     |', '|===    |', '|====   |', '|=====  |', '|====== |', '|=======|',
    '| ======|', '|  =====|', '|   ====|', '|    ===|', '|     ==|', '|      =|'];
  let spinner = null;

  function stopTimers() {
    if (spinner) window.clearInterval(spinner);
    spinner = null;
    timers.forEach((timer) => window.clearTimeout(timer));
    timers.clear();
    busy = false;
  }

  function line(text, kind) {
    terminal.line(text, kind);
  }

  function setPhase(next, message) {
    phase = next;
    const active = stages.indexOf(next === 'detect' || next === 'configure' ? 'choose' : next);
    document.querySelectorAll('[data-step]').forEach((item, index) => {
      item.classList.toggle('completed', next === 'ready' || (active !== -1 && index < active));
      if (index === active) item.setAttribute('aria-current', 'step');
      else item.removeAttribute('aria-current');
    });
    $('flow-status').textContent = message;
    const buttonLabels = { command: 'Run command', choose: 'Continue', configure: 'Install', ready: 'Run again' };
    $('continue-button').textContent = buttonLabels[next] || 'Enter';
    $('continue-button').disabled = busy;
    $('target-status').textContent = `${assistantChoice().label} | ${scope === 'project' ? 'Project level' : 'User level'}`;
  }

  function assistantChoice() {
    return assistantChoices.find((choice) => choice.value === assistantMode);
  }

  function inventoryKey(assistant, level = scope) {
    return `${assistant}|${level === 'project' ? projectPath : 'user'}`;
  }

  function isInstalled(item, assistant) {
    return Boolean(inventory.get(inventoryKey(assistant))?.has(item.id) ||
      (scope === 'project' && inventory.get(inventoryKey(assistant, 'user'))?.has(item.id)));
  }

  function isCurrent(item) {
    if (item.id === 'agents') {
      return sharedTools.has(foundryBundle.id) && !outdatedTools.has(foundryBundle.id);
    }
    return assistantChoice().targets.every((assistant) => isInstalled(item, assistant));
  }

  function components() {
    return tools.filter((item) => selected.has(item.id));
  }

  function shell(suggestion = '') {
    terminal.command(`PS ${projectPath}>`, handleCommand, suggestion);
    terminal.focus();
  }

  function reset() {
    stopTimers();
    terminal.clear();
    $('transcript').replaceChildren();
    inventory.clear();
    sharedTools.clear();
    outdatedTools.clear();
    selected = new Set(tools.map((item) => item.id));
    assistantMode = 'both';
    scope = 'user';
    installedThisRun = 0;
    currentPlan = [];
    environment = {
      node: $('environment').value !== 'runtime',
      foundryConnected: $('environment').value !== 'connection',
    };
    if ($('environment').value === 'existing') {
      Object.keys(hosts).forEach((assistant) => {
        inventory.set(inventoryKey(assistant, 'user'), new Set(tools.filter((item) => item.id !== 'agents').map((item) => item.id)));
      });
      sharedTools.add(foundryBundle.id);
      outdatedTools.add(foundryBundle.id);
    }
    $('restore-connection').hidden = true;
    setPhase('command', 'Ready to start');
    shell(setupCommand);
  }

  function handleCommand(command) {
    const match = command.match(/^azd tool install ai-dev(?: --agent (copilot|claude))?$/);
    if (match) {
      start(match[1]);
    } else if (command === 'clear' || command === 'cls') {
      $('transcript').replaceChildren();
      shell(setupCommand);
    } else {
      line(`ERROR: This prototype does not support "${command}".`, 'error');
      line(`Run ${setupCommand} to explore the proposed setup.`, 'muted');
      shell(setupCommand);
    }
  }

  function start(target) {
    installedThisRun = 0;
    $('restore-connection').hidden = true;
    assistantMode = target || assistantMode;
    setPhase('detect', 'Checking your environment');
    chooseWorkflow();
  }

  function chooseWorkflow() {
    setPhase('choose', 'Choose your tools, then press Enter to continue');
    terminal.selectTools('What would you like to install?', tools, selected, (values) => {
      selected = values;
      configureInstallation();
    });
    terminal.focus();
  }

  function configureInstallation() {
    setPhase('configure', 'Choose assistants and location, then press Enter to install');
    terminal.configure('Where should we install these tools?', { selected, assistantMode, scope }, (values) => {
      assistantMode = values.assistantMode;
      scope = values.scope;
      currentPlan = plan();
      if (currentPlan.some((item) => item.id === 'node')) confirmRuntime();
      else install();
    });
    terminal.focus();
  }

  function plan() {
    const items = components().map((item) => {
      if (item.id === 'agents') {
        return { ...item, existing: isCurrent(item), update: outdatedTools.has(foundryBundle.id) };
      }
      const targets = assistantChoice().targets.filter((assistant) => !isInstalled(item, assistant));
      return { ...item, targets, existing: targets.length === 0 };
    });
    if (!environment.node && selected.has('azure')) {
      items.unshift({ id: 'node', name: 'Node.js runtime', existing: false });
    }
    return items;
  }

  function confirmRuntime() {
    $('continue-button').textContent = 'Enter';
    line('WARNING: Node.js is a separate system dependency, not an assistant plugin.', 'warning');
    terminal.confirm('Include the system-wide Node.js installation?', (yes) => {
      if (yes) install();
      else {
        line('Node.js installation declined. No setup changes were made.', 'muted');
        line('Install a supported Node.js version, then run this setup again.', 'muted');
        setPhase('blocked', 'MCP prerequisite missing');
        shell(setupCommand);
      }
    });
  }

  function install() {
    terminal.clear();
    busy = true;
    $('terminal-screen').focus({ preventScroll: true });
    setPhase('install', 'Installing your approved setup');
    const queue = currentPlan.filter((item) => !item.existing);
    if ($('environment').value !== 'existing') {
      currentPlan.filter((item) => item.existing).forEach((item) => line(`  (-) Skipped: ${item.name} is already installed`, 'muted'));
    }
    if (!queue.length) {
      busy = false;
      line('Nothing to install.', 'heading');
      verifyConnection();
      return;
    }
    line(`Installing for ${assistantChoice().label}`, 'heading');
    const next = (index) => {
      if (index >= queue.length) {
        busy = false;
        verifyConnection();
        return;
      }
      const item = queue[index];
      const target = item.id === 'agents'
        ? `Foundry extensions (${foundryBundle.id})`
        : item.targets ? `${item.name} for ${item.targets.map((assistant) => hosts[assistant]).join(' + ')}`
        : `${item.name}${scope === 'project' ? ' (user level)' : ''}`;
      const label = `${item.update ? 'Updating' : 'Installing'} ${target}`;
      const doneLabel = `${item.update ? 'Updated' : 'Installed'} ${target}`;
      const progress = node('div', '', 'terminal-line spinner');
      const bar = node('span', '', 'spinner-bar');
      progress.dataset.label = label;
      progress.append('  ', bar, ` ${label}`);
      $('transcript').append(progress);
      terminal.scroll();
      let frame = 0;
      const paint = () => { bar.textContent = spinnerFrames[frame++ % spinnerFrames.length]; };
      paint();
      spinner = window.setInterval(paint, 90);
      later(() => {
        window.clearInterval(spinner);
        spinner = null;
        if (item.id === 'node') environment.node = true;
        else if (item.id === 'agents') {
          sharedTools.add(foundryBundle.id);
          outdatedTools.delete(foundryBundle.id);
        }
        else {
          item.targets.forEach((assistant) => {
            const key = inventoryKey(assistant);
            if (!inventory.has(key)) inventory.set(key, new Set());
            inventory.get(key).add(item.id);
          });
        }
        installedThisRun++;
        progress.replaceChildren('  ', node('span', '(\u2713) Done:', 'success'), ` ${doneLabel}`);
        progress.className = 'terminal-line';
        next(index + 1);
      }, 1100);
    };
    next(0);
  }

  function verifyConnection() {
    if (selected.has('foundry') && !environment.foundryConnected) {
      line('  (x) Failed: Connecting to Foundry MCP', 'error');
      line('  Foundry MCP did not respond. Check that your Foundry project is reachable.', 'error');
      line('WARNING: Your tools are installed, but the Foundry connection needs attention.', 'warning');
      $('restore-connection').hidden = false;
      recovery();
      return;
    }
    ready();
  }

  function recovery() {
    setPhase('blocked', 'Foundry connection needs attention');
    terminal.select('How would you like to continue?', [
      { value: 'retry', label: 'Check the connection again' },
      { value: 'finish', label: 'Finish for now' },
    ], (value) => {
      if (value === 'retry') verifyConnection();
      else {
        line('WARNING: Setup is incomplete. Restore the Foundry connection, then run setup again.', 'warning');
        shell(setupCommand);
      }
    });
    terminal.focus();
  }

  function ready() {
    $('restore-connection').hidden = true;
    setPhase('ready', 'Ready to build on Azure');
    line('SUCCESS: Your selected tools are ready.', 'success');
    const hasAny = (...ids) => ids.some((id) => selected.has(id));
    const suggestion = hasAny('foundry-skills', 'foundry', 'agents')
      ? 'Create a Foundry agent that answers questions from the docs in this repo, then deploy it with azd.'
      : hasAny('azure-skills', 'azure')
        ? 'Add a PostgreSQL database to this app and deploy it to Azure Container Apps with azd.'
        : 'Using Microsoft Learn, explain which Azure services this app needs and how azd would deploy them.';
    line(`Start a new session in ${assistantChoice().label.replace(' + ', ' or ')} and try:`, 'muted');
    line(`  "${suggestion}"`, 'progress');
    shell(setupCommand);
  }

  function cancel() {
    if (phase === 'ready') {
      line('Command cancelled. Your setup is unchanged.', 'muted');
      shell(setupCommand);
      return;
    }
    stopTimers();
    terminal.clear();
    $('transcript').querySelectorAll('.spinner').forEach((item) => {
      item.textContent = `  (-) Skipped: ${item.dataset.label}`;
      item.className = 'terminal-line muted';
    });
    const changed = installedThisRun > 0;
    line(changed ? 'WARNING: Setup cancelled. Completed installations were kept.' : 'WARNING: Setup cancelled. No changes were made.', 'warning');
    line(`Run ${setupCommand} whenever you want to continue.`, 'muted');
    setPhase(changed ? 'blocked' : 'command', changed ? 'Cancelled; completed items retained' : 'Cancelled without changes');
    shell(setupCommand);
  }

  $('environment').addEventListener('change', reset);
  $('reset-demo').addEventListener('click', reset);
  document.querySelectorAll('[data-key]').forEach((button) => {
    button.addEventListener('click', () => terminal.sendKey(button.dataset.key));
  });
  $('terminal-screen').addEventListener('keydown', (event) => {
    if (busy && (event.key === 'Escape' || (event.ctrlKey && event.key.toLowerCase() === 'c'))) {
      event.preventDefault();
      cancel();
    }
  });
  $('restore-connection').addEventListener('click', () => {
    environment.foundryConnected = true;
    $('restore-connection').hidden = true;
    line('Demo environment: Foundry endpoint is reachable again. Recheck to verify.', 'muted');
    $('flow-status').textContent = 'Connection restored in demo; recheck to verify';
    terminal.focus();
  });
  $('theme-toggle').addEventListener('click', () => {
    const light = document.documentElement.dataset.theme !== 'light';
    document.documentElement.dataset.theme = light ? 'light' : 'dark';
    $('theme-toggle').textContent = light ? 'Dark theme' : 'Light theme';
  });
  reset();
})();
