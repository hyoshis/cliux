(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const setupCommand = 'azd tool install ai-dev';
  const tools = [
    { id: 'skills', name: 'Azure + Foundry skills', detail: 'Guidance for building AI apps.' },
    { id: 'azure', name: 'Azure MCP', detail: 'Connect your assistant to Azure.' },
    { id: 'foundry', name: 'Foundry MCP (Preview)', detail: 'Work with models and agents.' },
    { id: 'agents', name: 'Foundry extensions for azd', detail: 'Build and deploy agents.' },
    { id: 'learn', name: 'Microsoft Learn MCP', detail: 'Find official docs and examples.' },
  ];
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
  let selected = new Set(tools.map((item) => item.id));
  let assistantMode = 'copilot';
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
      const prompt = this.createPrompt(message, 'multi', '');
      keyHint(prompt);
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
      prompt.form.append(list, prompt.error, prompt.instructions);
      let cursor = 0;
      const checked = new Set(values);
      const render = () => {
        list.replaceChildren();
        options.forEach((option, index) => {
          const item = choiceRow(cursor === index, checked.has(option.id), option.name.padEnd(28), option.detail);
          item.id = `${prompt.id}-choice-${index}`;
          item.setAttribute('role', 'option');
          item.setAttribute('aria-selected', String(checked.has(option.id)));
          item.addEventListener('click', () => {
            cursor = index;
            toggle();
          });
          list.append(item);
        });
        answer.textContent = `${checked.size} tools selected`;
        prompt.input.setAttribute('aria-activedescendant', `${prompt.id}-choice-${cursor}`);
        prompt.input.removeAttribute('aria-invalid');
        prompt.error.textContent = '';
        this.scroll();
      };
      const toggle = () => {
        const id = options[cursor].id;
        if (checked.has(id)) checked.delete(id);
        else checked.add(id);
        render();
      };
      prompt.input.addEventListener('keydown', (event) => {
        if (!['ArrowDown', 'ArrowUp', ' '].includes(event.key)) return;
        event.preventDefault();
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
          cursor = (cursor + (event.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length;
          render();
        } else toggle();
      });
      prompt.submit = () => {
        if (!checked.size) {
          prompt.input.setAttribute('aria-invalid', 'true');
          prompt.error.textContent = 'At least one option must be selected';
          this.scroll();
          return;
        }
        this.clear();
        this.answer(message, options.filter((option) => checked.has(option.id)).map((option) => option.name).join(', '));
        onSubmit(new Set(checked));
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

  function stopTimers() {
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
    selected = new Set(tools.map((item) => item.id));
    assistantMode = 'copilot';
    scope = 'user';
    installedThisRun = 0;
    currentPlan = [];
    environment = {
      node: $('environment').value !== 'runtime',
      foundryConnected: $('environment').value !== 'connection',
    };
    if ($('environment').value === 'existing') {
      inventory.set(inventoryKey('copilot', 'user'), new Set(tools.filter((item) => item.id !== 'agents').map((item) => item.id)));
      sharedTools.add('agents');
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
      if (item.id === 'agents') return { ...item, existing: sharedTools.has(item.id) };
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
    line('Node.js is a separate system dependency, not an assistant plugin.', 'warning');
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
    const reused = currentPlan.filter((item) => item.existing);
    reused.forEach((item) => line(`  (-) Reused: ${item.name}`, 'muted'));
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
      const label = item.targets ? `${item.name} (${item.targets.map((assistant) => hosts[assistant]).join(' + ')})`
        : `${item.name}${scope === 'project' ? ' (user level)' : ''}`;
      const progress = node('div', `  |===    | ${label}`, 'terminal-line progress');
      $('transcript').append(progress);
      terminal.scroll();
      later(() => {
        if (item.id === 'node') environment.node = true;
        else if (item.id === 'agents') sharedTools.add(item.id);
        else {
          item.targets.forEach((assistant) => {
            const key = inventoryKey(assistant);
            if (!inventory.has(key)) inventory.set(key, new Set());
            inventory.get(key).add(item.id);
          });
        }
        installedThisRun++;
        progress.textContent = `  (\u2713) Done: ${label}`;
        progress.className = 'terminal-line success';
        next(index + 1);
      }, 360);
    };
    next(0);
  }

  function verifyConnection() {
    if (selected.has('foundry') && !environment.foundryConnected) {
      line('  (x) Failed: Foundry MCP did not respond.', 'error');
      line('Your tools are installed, but the Foundry connection needs attention.', 'warning');
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
        line('Setup remains incomplete. Restore the Foundry connection and run setup again.', 'warning');
        shell(setupCommand);
      }
    });
    terminal.focus();
  }

  function ready() {
    $('restore-connection').hidden = true;
    setPhase('ready', 'Ready to build on Azure');
    line('SUCCESS: Your selected tools are ready.', 'success');
    if (selected.has('skills')) line('Try asking your assistant: "Help me build an AI app on Azure."', 'progress');
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
    $('transcript').querySelectorAll('.progress').forEach((item) => {
      if (item.textContent.includes('|===')) {
        item.textContent = item.textContent.replace('|===    |', '(-) Cancelled:');
        item.className = 'terminal-line muted';
      }
    });
    const changed = installedThisRun > 0;
    line(changed ? 'Setup cancelled. Completed installations have been retained.' : 'Setup cancelled. No installation changes were made.', 'warning');
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
