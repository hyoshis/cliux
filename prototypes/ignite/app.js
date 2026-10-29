(function () {
  'use strict';

  const screen = document.getElementById('screen');
  const transcript = document.getElementById('transcript');
  const hint = document.getElementById('hint');
  const title = document.getElementById('terminal-title');
  const restart = document.getElementById('restart');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const project = { key: 'terraform', provider: 'Terraform', name: 'Order Processing', folder: 'order-processing', template: 'contoso/order-processing-terraform', environment: 'orders-dev', entry: 'main.tf', service: 'api' };
  let controller;
  let activeInput = null;
  let promptId = 0;
  let lastAssistant = 'copilot';
  let skillInstallation = null;

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (character) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    })[character]);
  }

  function scroll() {
    screen.scrollTop = screen.scrollHeight;
  }

  function line(text, className = '') {
    const element = document.createElement('div');
    element.className = `line ${className}`;
    element.textContent = text;
    transcript.appendChild(element);
    scroll();
    return element;
  }

  function field(label, value, className = '') {
    const padding = ' '.repeat(Math.max(1, 18 - label.length));
    return line(`  ${label}${padding}${value}`, className);
  }

  function shellPrefix() {
    return `PS C:\\work\\${project.folder}>`;
  }

  function setNotes(context, heading, bullets, preview = false) {
    document.getElementById('notes-command').textContent = context;
    document.getElementById('notes-title').textContent = heading;
    document.getElementById('notes-preview').hidden = !preview;
    document.getElementById('skills-evidence').hidden = !preview;
    document.querySelector('.notes-footnote').hidden = preview;
    document.getElementById('notes-list').replaceChildren(...bullets.map((text) => {
      const item = document.createElement('li');
      item.textContent = text;
      return item;
    }));
  }

  function setHint(text) {
    hint.textContent = text;
  }

  function wait(milliseconds, signal, readingPause = false) {
    return new Promise((resolve, reject) => {
      if (signal.aborted) {
        reject(signal.reason);
        return;
      }
      const timer = window.setTimeout(() => {
        signal.removeEventListener('abort', abort);
        resolve();
      }, reducedMotion.matches && !readingPause ? 25 : milliseconds);
      function abort() {
        window.clearTimeout(timer);
        reject(signal.reason);
      }
      signal.addEventListener('abort', abort, { once: true });
    });
  }

  async function progress(description, signal, milliseconds = 650) {
    const element = line(`( ) ${description}`, 'orange');
    await wait(milliseconds, signal);
    element.className = 'line';
    element.innerHTML = `<span class="green">(\u2713) Done:</span> ${escapeHtml(description)}`;
    scroll();
  }

  function resizeInput(input) {
    input.style.height = '0px';
    input.style.height = `${input.scrollHeight}px`;
    scroll();
  }

  async function automaticPrompt({ prefix, value, choices, validate, command }, signal) {
    if (signal.aborted) throw signal.reason;
    const choice = choices.find((item) => item.key === value);
    if (choices.length && !choice) throw new Error(`Invalid demo default for "${prefix}".`);
    const answer = choice ? choice.key : value.trim();
    const error = validate ? validate(answer) : '';
    if (error) throw new Error(error);
    const shown = choice ? choice.label : answer;
    setHint(command
      ? 'The demo sends this prepared request automatically. No input needed.'
      : 'The demo uses the shown default automatically. No input needed.');
    if (command) line('Prepared request (sent automatically by the demo)', 'dim output-heading');
    const output = line(command ? `${prefix} ${shown}` : `? ${prefix}`, command ? 'white command-line' : '');
    // Reading pauses remain useful when reduced motion is enabled.
    await wait(command ? 2200 : 1400, signal, true);
    if (!command) {
      output.innerHTML = `<span class="blue">?</span> ${escapeHtml(prefix)} <span class="blue">${escapeHtml(shown)}</span> <span class="dim">(demo default)</span>`;
    }
    scroll();
    return answer;
  }

  function request({ prefix, value = '', label, choices = [], validate, command = false, auto = !command }, signal) {
    if (auto) return automaticPrompt({ prefix, value, choices, validate, command }, signal);
    return new Promise((resolve, reject) => {
      if (signal.aborted) {
        reject(signal.reason);
        return;
      }
      const form = document.createElement('form');
      form.className = command ? 'prompt command-prompt' : 'prompt';
      const id = ++promptId;
      if (command) {
        const cue = document.createElement('p');
        cue.className = 'command-cue';
        cue.id = `command-cue-${id}`;
        cue.textContent = prefix === '>' ? 'Your request \u00b7 Press Enter to send'
          : 'Next command \u00b7 Press Enter to run';
        form.appendChild(cue);
      }
      const row = document.createElement('div');
      row.className = 'input-line';
      const prefixElement = document.createElement('span');
      prefixElement.className = 'prompt-prefix white';
      if (command) prefixElement.textContent = prefix;
      else prefixElement.innerHTML = `<span class="question blue">?</span> ${escapeHtml(prefix)}`;
      const input = document.createElement('textarea');
      input.className = `terminal-input${command ? ' command-input' : ''}`;
      input.rows = 1;
      input.value = value;
      input.spellcheck = false;
      input.setAttribute('autocapitalize', 'off');
      input.setAttribute('autocomplete', 'off');
      input.setAttribute('aria-label', label || prefix);
      if (command) input.setAttribute('aria-describedby', `command-cue-${id}`);
      row.append(prefixElement, input);
      form.appendChild(row);
      let selected = 0;
      let list = null;
      if (choices.length) {
        list = document.createElement('div');
        list.className = 'choice-list';
        list.id = `choices-${id}`;
        list.setAttribute('role', 'listbox');
        list.setAttribute('aria-label', prefix);
        input.setAttribute('role', 'combobox');
        input.setAttribute('aria-controls', list.id);
        input.setAttribute('aria-expanded', 'true');
        input.setAttribute('aria-autocomplete', 'list');
        form.appendChild(list);
      }

      function matchChoice(answer) {
        const normalized = answer.trim().toLowerCase();
        return choices.findIndex((choice) => [choice.key, choice.label, ...(choice.aliases || [])].some((item) => item.toLowerCase() === normalized));
      }

      function renderChoices() {
        if (!list) return;
        list.innerHTML = choices.map((choice, index) => `<div class="choice" id="choice-${id}-${index}" role="option" aria-selected="${index === selected}">  ${index === selected ? '>' : ' '} ${escapeHtml(choice.label)}${choice.description ? ` <span class="choice-description">- ${escapeHtml(choice.description)}</span>` : ''}</div>`).join('');
        input.setAttribute('aria-activedescendant', `choice-${id}-${selected}`);
        scroll();
      }

      function cleanup() {
        signal.removeEventListener('abort', abort);
        if (activeInput === input) activeInput = null;
        form.remove();
      }

      function abort() {
        line(`${command ? '' : '? '}${prefix} ${input.value} ^C`, 'dim');
        cleanup();
        reject(signal.reason);
      }

      function submit() {
        let answer = input.value.trim();
        let shown = answer;
        if (choices.length) {
          const index = answer === '' ? selected : matchChoice(answer);
          if (index < 0) {
            line(`ERROR: Choose ${choices.map((choice) => choice.key).join(' or ')}, or use the arrow keys.`, 'error');
            input.setAttribute('aria-invalid', 'true');
            return;
          }
          answer = choices[index].key;
          shown = choices[index].label;
        }
        const error = validate ? validate(answer) : '';
        if (error) {
          line(`ERROR: ${error}`, 'error');
          input.setAttribute('aria-invalid', 'true');
          input.focus({ preventScroll: true });
          return;
        }
        const output = document.createElement('div');
        output.className = command ? 'line command-line' : 'line';
        output.innerHTML = `${command ? `<span class="white">${escapeHtml(prefix)}</span>` : `<span class="blue">?</span> ${escapeHtml(prefix)}`} <span class="${command ? 'white' : 'blue'}">${escapeHtml(shown)}</span>`;
        cleanup();
        transcript.appendChild(output);
        scroll();
        resolve(answer);
      }

      form.addEventListener('submit', (event) => {
        event.preventDefault();
        submit();
      });
      input.addEventListener('input', () => {
        input.removeAttribute('aria-invalid');
        const index = choices.length ? matchChoice(input.value) : -1;
        if (index >= 0) {
          selected = index;
          renderChoices();
        }
        resizeInput(input);
      });
      input.addEventListener('keydown', (event) => {
        if (event.isComposing) return;
        if (event.key === 'Escape') {
          event.preventDefault();
          input.value = value;
          input.removeAttribute('aria-invalid');
          selected = 0;
          renderChoices();
          resizeInput(input);
          if (command) input.setSelectionRange(value.length, value.length);
          else input.select();
        } else if (choices.length && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) {
          event.preventDefault();
          selected = (selected + (event.key === 'ArrowDown' ? 1 : -1) + choices.length) % choices.length;
          input.value = choices[selected].key;
          renderChoices();
          resizeInput(input);
          input.select();
        } else if (event.key === 'Enter' && !event.shiftKey) {
          event.preventDefault();
          submit();
        }
      });
      signal.addEventListener('abort', abort, { once: true });
      screen.appendChild(form);
      activeInput = input;
      renderChoices();
      resizeInput(input);
      input.focus({ preventScroll: true });
      if (command) input.setSelectionRange(value.length, value.length);
      else input.select();
      scroll();
    });
  }

  function normalizeCommand(value) {
    return value.trim().replace(/\s+/g, ' ').toLowerCase();
  }

  async function command(suggested, accepted, signal) {
    setHint('Press Enter to run the highlighted command. The next one appears automatically.');
    while (!signal.aborted) {
      const value = await request({
        prefix: shellPrefix(), value: suggested, command: true, label: `Command. Suggested: ${suggested}`,
        validate: (answer) => answer ? '' : 'Enter a command. The next suggested command is shown at this prompt.',
      }, signal);
      if (['help', '?'].includes(value.toLowerCase())) {
        line('This is a scripted CLI prototype, not a connected shell.', 'dim');
        line(`Next command: ${suggested}`, 'blue');
        line('Press Enter only for highlighted commands. The demo fills setup prompts automatically.', 'dim');
        continue;
      }
      if (accepted(value)) return value;
      line('ERROR: This prototype supports the suggested command at this step. No shell command was executed.', 'error');
      line(`Try: ${suggested}`, 'dim');
    }
    throw signal.reason;
  }

  function exactCommand(suggested, aliases, signal) {
    const accepted = [suggested, ...aliases].map(normalizeCommand);
    return command(suggested, (value) => accepted.includes(normalizeCommand(value)), signal);
  }

  async function choose(prefix, choices, signal) {
    return request({ prefix, value: choices[0].key, choices }, signal);
  }

  async function confirm(prefix, signal) {
    const answer = await request({
      prefix: `${prefix} (Y/n)`, value: 'Yes',
      validate: (value) => ['', 'y', 'yes', 'n', 'no'].includes(value.toLowerCase()) ? '' : 'Type y for Yes or n for No, then press Enter.',
    }, signal);
    return !['n', 'no'].includes(answer.toLowerCase());
  }

  async function initialize(team, signal) {
    setNotes('azd init', 'Make the platform investment reusable.', [
      'Your platform team already built the right starting point.',
      "The developer gets Order Processing's app code, Terraform infrastructure, and onboarding together.",
      'The developer starts from approved patterns, not a wiki and three scripts.',
    ]);
    const suggested = `azd init --template ${team.template} .`;
    const input = await command(suggested, (value) => {
      const normalized = normalizeCommand(value);
      return normalized === 'azd init' || normalized === normalizeCommand(suggested) || normalized === normalizeCommand(`azd init --template ${team.template}`);
    }, signal);
    line('Initializing an app to run on Azure (azd init)', 'white');
    if (normalizeCommand(input) === 'azd init') {
      await choose('Select a platform-approved template:', [
        { key: team.key, label: team.template, description: `${team.name} / ${team.provider}`, aliases: ['1'] },
      ], signal);
    }
    field('Template:', team.template, 'dim');
    field('Team:', team.name, 'dim');
    setNotes('azd init / environment', 'Give the developer a repeatable start.', [
      'Names the development environment for this project.',
      'Uses the same platform-owned app and infrastructure patterns.',
      'A name alone does not enforce resource isolation.',
    ]);
    const environment = await request({
      prefix: 'Enter a new environment name:', value: team.environment,
      validate: (value) => /^[a-z][a-z0-9-]{1,30}[a-z0-9]$/.test(value) ? '' : 'For this demo, use 3-32 lowercase letters, numbers, or hyphens; start with a letter and end with a letter or number.',
    }, signal);
    setHint('Initializing the simulated project...');
    setNotes('azd init', 'Bring the platform into the workspace.', [
      'Copies the application and project configuration.',
      'Keeps the existing Terraform modules as the starting point.',
      'Replaces setup rediscovery with a repeatable onboarding path.',
    ]);
    await progress('Copying the platform template into your workspace', signal);
    await progress(`Creating azd environment ${environment}`, signal, 450);
    line('  azure.yaml        Application and infrastructure configuration', 'dim');
    line(`  infra\\${team.entry.padEnd(10)} Platform-owned ${team.provider} infrastructure`, 'dim');
    line('  README.md         Team onboarding guidance', 'dim');
    line('SUCCESS: Your app is initialized!', 'green');
    return environment;
  }

  function assistantName(value) {
    return value === 'claude' ? 'Claude Code' : 'GitHub Copilot';
  }

  async function recommendSkills(team, signal) {
    setNotes('Azure Skills recommendation', 'The developer is not building alone.', [
      'The project is onboarded. The coding agent still needs relevant Azure guidance.',
      'Shows Microsoft as the publisher and the source repository.',
      'Illustrates a consent-first installation flow using labeled demo defaults.',
    ], true);
    line('[Design preview - not shipped] azd recommends Azure Skills for this project.', 'amber output-heading');
    line('Next: Azure work with a coding assistant. Relevant Azure guidance is not installed.');
    field('Deployment:', 'azure-deploy', 'blue');
    field('Troubleshooting:', 'azure-diagnostics', 'blue');
    field('Publisher:', 'Microsoft');
    field('Source:', 'https://github.com/microsoft/azure-skills', 'dim');
    if (!await confirm('Install the recommended Azure skills?', signal)) {
      line('Skipped Azure Skills installation. No changes were made to your coding assistant.', 'dim');
      return;
    }
    setNotes('Azure Skills / target assistant', 'Install only where the developer chooses.', [
      'Targets GitHub Copilot or Claude Code.',
      'Does not silently install into every assistant.',
      'Keeps the source and installation choice reviewable.',
    ], true);
    const assistant = await choose('Select a coding assistant:', [
      { key: 'copilot', label: 'GitHub Copilot', aliases: ['1', 'github copilot'] },
      { key: 'claude', label: 'Claude Code', aliases: ['2', 'claude code'] },
    ], signal);
    setNotes('Azure Skills / installation scope', 'Make the change and its scope explicit.', [
      'Project scope keeps guidance local to this workspace.',
      'User scope makes it available across projects for the selected assistant.',
      'Neither choice grants Azure permissions or replaces platform controls.',
    ], true);
    const scope = await choose('Select the installation scope:', [
      { key: 'project', label: 'This project only (recommended)', description: 'No user-wide changes', aliases: ['1', 'local', 'this project'] },
      { key: 'user', label: 'Across my projects', description: 'Only for the selected assistant', aliases: ['2', 'global', 'user-wide'] },
    ], signal);
    field('Assistant:', assistantName(assistant));
    field('Scope:', scope === 'project' ? `C:\\work\\${team.folder} only` : 'Across your projects, for this assistant');
    setHint('Simulating the proposed skill installation...');
    setNotes('Azure Skills / installation', 'Add relevant guidance, not hidden access.', [
      `Installs the selected guidance for ${assistantName(assistant)} only.`,
      scope === 'project' ? 'Changes only this project in the proposed experience.' : 'Makes guidance available across projects for this assistant.',
      'Installed guidance still needs to be loaded in an assistant session.',
    ], true);
    await progress('Installing Azure deployment guidance (azure-deploy)', signal);
    await progress('Installing Azure troubleshooting guidance (azure-diagnostics)', signal);
    skillInstallation = { assistant, scope };
    lastAssistant = assistant;
    line(`SUCCESS: Azure skills installed for ${assistantName(assistant)}.`, 'green');
    line('Installed, not yet loaded. Start a new assistant session to use the guidance.', 'amber');
    setHint('Skill setup is complete in the demo. Continuing to the assistant...');
    await wait(1800, signal, true);
  }

  async function deploy(team, environment, signal) {
    setNotes('azd up', 'From a platform-approved start to a running service.', [
      'Packages the application code.',
      "Provisions Azure resources from the platform's Terraform.",
      'Deploys the service using the project configuration.',
    ]);
    await exactCommand('azd up', [], signal);
    setHint('One command coordinates packaging, infrastructure, and deployment. This execution is simulated.');
    line('Using prepared demo defaults: Contoso Development / East US 2.', 'dim');
    line('Packaging services (azd package)', 'white output-heading');
    setNotes('azd up / package', 'Prepare the application for deployment.', [
      'Builds and packages the API service.',
      'Uses the application configuration supplied with the template.',
      'Keeps packaging inside the same azd up workflow.',
    ]);
    await progress(`Packaging service ${team.service}`, signal, 600);
    line('Provisioning Azure resources (azd provision)', 'white output-heading');
    setNotes('azd up / provision', "Use the team's existing Terraform.", [
      'Provisions from infra\\main.tf, not a rewritten stack.',
      'Creates the Azure resources defined by the platform-owned template.',
      'Permissions and isolation remain responsibilities of platform controls.',
    ]);
    await progress(`Provisioning from the platform's infra\\${team.entry}`, signal, 800);
    line('Deploying services (azd deploy)', 'white output-heading');
    setNotes('azd up / deploy', 'Turn the starting point into a running service.', [
      'Publishes the API to the provisioned environment.',
      `Uses the named environment ${environment}.`,
      'Returns a service endpoint; this demonstration is simulated.',
    ]);
    await progress(`Deploying service ${team.service} to ${environment}`, signal, 650);
    line('SUCCESS: Your application was provisioned and deployed to Azure.', 'green');
    field('Endpoint:', `https://${environment}.example.invalid`, 'blue');
  }

  async function showAgent(signal) {
    const assistantCommand = lastAssistant === 'claude' ? 'claude' : 'copilot';
    setNotes(assistantCommand, 'Bring the agent onto the paved road.', [
      'Opens a separate prepared assistant session.',
      'Azure Skills are preloaded for this illustration, not automatically loaded by installation.',
      skillInstallation ? 'Combines the project starting point with relevant Azure guidance.' : 'Your skipped installation remains unchanged; this is a separately prepared setup.',
    ]);
    await exactCommand(assistantCommand, [], signal);
    line(`${assistantName(lastAssistant)} - prepared assistant session / illustrative output`, 'blue');
    line(skillInstallation
      ? 'Prepared separately with skills preloaded; installation alone does not load an existing session.'
      : 'Installation was skipped. This separate prepared session has skills preloaded; it is not the result of that skipped flow.', 'dim');
    field('Loaded skills:', 'azure-deploy, azure-diagnostics', 'dim');
    const task = "Add a health endpoint to this service. Follow the project's existing conventions, keep its infrastructure provider unchanged, and explain any deployment changes before making them.";
    setNotes('Coding assistant task', 'Work with the project, not around it.', [
      'Requests a bounded change: add a health endpoint.',
      'Explicitly preserves the Terraform infrastructure provider.',
      'Asks for deployment impact to be explained before changes are made.',
    ]);
    await request({
      prefix: '>', value: task, command: true, auto: true, label: 'Prepared assistant task',
      validate: (value) => value === task ? '' : 'This is a prepared response for the suggested task. Use the prefilled task to continue.',
    }, signal);
    setHint('Showing the prepared assistant response...');
    await wait(600, signal);
    line('Proposed change: GET /health, following the sample service\'s Express route pattern.');
    line('Infrastructure: Terraform unchanged. No deployment configuration changes proposed.');
    line('Review the diff before applying it. No changes have been applied.', 'dim');
    line('src\\api\\server.js  +4 -0  (illustrative diff; not applied)', 'dim');
    line("+ app.get('/health', (_req, res) => {", 'green');
    line("+   res.status(200).json({ status: 'ok' });", 'green');
    line('+ });', 'green');
    line('+', 'green');
    line('AI-generated content may be incorrect. Skills supply guidance, not a guarantee of correctness.', 'amber');
    setNotes('Assistant response / proposed diff', 'One platform investment. People and agents.', [
      'The project carries the platform-owned app and Terraform patterns forward.',
      'The prepared assistant adds a health endpoint without changing the infrastructure provider.',
      'The developer gets a reviewable diff, not a blind edit. Guidance does not guarantee correctness.',
    ]);
  }

  async function run(signal) {
    const environment = await initialize(project, signal);
    await deploy(project, environment, signal);
    await recommendSkills(project, signal);
    await showAgent(signal);
    line('DEMO COMPLETE', 'green completion-status');
    line('All walkthrough steps are finished. No commands were executed.', 'dim');
    setNotes('Demo complete', 'From platform patterns to useful work.', [
      'The developer followed the platform-owned Terraform starting point through init and up.',
      'Skill-installation consent, assistant selection, and scope were illustrated using labeled demo defaults.',
      'The prepared assistant offered a bounded change for human review.',
    ]);
    setHint('All steps are complete. Click Restart demo when you want to begin again.');
    restart.hidden = false;
    scroll();
  }

  function reportFailure(error, signal) {
    if (signal.aborted) return;
    line(`ERROR: The prototype could not continue: ${error.message}`, 'error');
    setNotes('Demo stopped', 'The prototype could not continue.', [
      error.message,
      'No shell commands, installations, or cloud requests were executed.',
      'Use Restart demo to begin again.',
    ]);
    restart.hidden = false;
    setHint('The demo stopped. Use Restart demo to begin again.');
    console.error(error);
  }

  function start() {
    if (controller) controller.abort();
    controller = new AbortController();
    const signal = controller.signal;
    screen.querySelectorAll('.prompt').forEach((prompt) => prompt.remove());
    transcript.replaceChildren();
    restart.hidden = true;
    activeInput = null;
    lastAssistant = 'copilot';
    skillInstallation = null;
    title.textContent = 'PowerShell - order-processing';
    run(signal).catch((error) => reportFailure(error, signal));
  }

  screen.addEventListener('click', (event) => {
    if (event.target.closest('textarea') || window.getSelection()?.toString()) return;
    if (activeInput) activeInput.focus({ preventScroll: true });
  });
  screen.addEventListener('keydown', (event) => {
    if (event.target !== screen || !activeInput) return;
    if (event.key === 'Enter') {
      event.preventDefault();
      activeInput.focus({ preventScroll: true });
      activeInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    } else if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
      event.preventDefault();
      activeInput.focus({ preventScroll: true });
      activeInput.value = event.key;
      resizeInput(activeInput);
    }
  });
  restart.addEventListener('click', start);
  window.addEventListener('resize', () => {
    if (activeInput) resizeInput(activeInput);
  });
  start();
})();
