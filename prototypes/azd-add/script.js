(() => {
  'use strict';

  const categories = ['AI', 'Database', 'Host service', 'Key Vault', 'Messaging', 'Storage account'];
  const aiTypes = ['Azure OpenAI model', 'Azure AI services model', 'Azure AI Search'];
  const simulatedGroups = {
    Database: ['Azure Cosmos DB', 'Azure SQL Database', 'Azure Database for PostgreSQL'],
    'Host service': ['Azure Container Apps', 'Azure App Service', 'Azure Functions'],
    'Key Vault': ['Secret', 'Key', 'Certificate'],
    Messaging: ['Azure Service Bus queue', 'Azure Service Bus topic', 'Azure Event Hubs']
  };
  const questions = {
    category: 'What would you like to add?',
    ai: 'Which type of AI resource?',
    Database: 'Which type of database resource?',
    'Host service': 'Which type of host service?',
    'Key Vault': 'What would you like to add to Key Vault?',
    Messaging: 'Which type of messaging resource?',
    storage: 'What type of data do you want to store?',
    container: 'Input a blob container name to be created:',
    review: 'Accept changes to azure.yaml?'
  };
  const referenceText = 'The category and AI-type menus follow your screenshots. Blob storage includes the full preview-and-accept flow. Database, Host service, Key Vault, and Messaging use simulated choices.';
  const output = document.getElementById('terminal-output');
  const backButton = document.getElementById('back-button');
  const continueButton = document.getElementById('continue-button');
  const referenceNote = document.getElementById('reference-note');
  const stepLabel = document.getElementById('step-label');
  const keyboardHint = document.getElementById('keyboard-hint');
  let state;
  let previousStates;

  function initialState() {
    return { step: 'category', activeIndex: 1, filter: '', history: [], container: 'container1', accepted: null };
  }

  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function shell(command) {
    const line = element('p', 'line');
    line.append(element('span', 'shell-prompt', '> '), element('span', 'shell-path', 'developer:~/my-azd-project'),
      document.createTextNode('$' + (command ? ` ${command}` : '')));
    return line;
  }

  function question(text, answer) {
    const line = element('p', 'question');
    line.append(element('span', 'prompt-mark', '? '), document.createTextNode(text));
    if (answer) line.append(element('span', 'answer', ` ${answer}`));
    return line;
  }

  function options() {
    const values = state.step === 'category' ? categories
      : state.step === 'ai' ? aiTypes
      : state.step === 'storage' ? ['Blobs']
      : state.step === 'review' ? ['Yes', 'No']
      : Object.hasOwn(simulatedGroups, state.step) ? simulatedGroups[state.step] : [];
    return values.filter((value) => value.toLowerCase().includes(state.filter.toLowerCase().trim()));
  }

  function activeAnswer() {
    return options()[state.activeIndex];
  }

  function transition(update) {
    previousStates.push({ ...state, history: [...state.history] });
    update();
    state.activeIndex = 0;
    state.filter = '';
    render();
  }

  function record(answer) {
    state.history.push({ text: questions[state.step], answer });
  }

  function renderMenu() {
    const choices = options();
    const list = element('div', 'menu');
    list.id = 'resource-options';
    list.setAttribute('role', 'listbox');
    list.setAttribute('aria-label', questions[state.step]);
    const hasFilter = state.step !== 'review';

    if (hasFilter) {
      const row = element('div', 'filter-row');
      const label = element('label', '', 'Filter:');
      label.id = 'filter-label';
      label.htmlFor = 'resource-filter';
      const input = element('input', 'terminal-input filter-input');
      input.id = 'resource-filter';
      input.value = state.filter;
      input.placeholder = 'Type to filter list';
      input.autocomplete = 'off';
      input.spellcheck = false;
      input.setAttribute('role', 'combobox');
      input.setAttribute('aria-autocomplete', 'list');
      input.setAttribute('aria-expanded', 'true');
      input.setAttribute('aria-controls', list.id);
      input.setAttribute('aria-labelledby', 'active-question filter-label');
      input.setAttribute('aria-describedby', 'keyboard-hint');
      input.addEventListener('input', () => {
        state.filter = input.value;
        state.activeIndex = 0;
        refreshMenu();
      });
      input.addEventListener('keydown', menuKeydown);
      row.append(label, input);
      output.append(row);
    } else {
      list.tabIndex = 0;
      list.addEventListener('keydown', menuKeydown);
    }

    choices.forEach((choice, index) => {
      const button = element('button', 'option', choice);
      button.type = 'button';
      button.id = `resource-option-${index}`;
      button.tabIndex = -1;
      button.setAttribute('role', 'option');
      button.setAttribute('aria-label', choice);
      button.setAttribute('aria-selected', String(index === state.activeIndex));
      button.addEventListener('click', () => {
        state.activeIndex = index;
        updateActiveOption();
        advance();
      });
      list.append(button);
    });
    output.append(list);
    if (!choices.length) {
      const message = element('p', 'line no-results', 'No matches. Clear the filter to see the list.');
      message.id = 'no-results';
      message.setAttribute('role', 'status');
      output.append(message);
    }
    if (state.step === 'category' && !state.filter) {
      const ellipsis = element('p', 'line ellipsis', '...');
      ellipsis.title = 'Additional items were not visible in the reference screenshot.';
      output.append(ellipsis);
    }
    updateActiveOption();
  }

  function refreshMenu() {
    const input = document.getElementById('resource-filter');
    const start = input.selectionStart;
    const end = input.selectionEnd;
    render();
    const replacement = document.getElementById('resource-filter');
    replacement.setSelectionRange(start, end);
  }

  function updateActiveOption() {
    const choices = options();
    const answer = activeAnswer();
    output.querySelectorAll('.option').forEach((button, index) => {
      button.setAttribute('aria-selected', String(index === state.activeIndex));
    });
    const controller = document.getElementById('resource-filter') || document.getElementById('resource-options');
    if (answer) controller.setAttribute('aria-activedescendant', `resource-option-${state.activeIndex}`);
    else controller.removeAttribute('aria-activedescendant');
    document.getElementById('current-answer').textContent = answer ? ` ${answer}` : '';
    continueButton.disabled = !choices.length;
    if (state.step === 'review') {
      continueButton.firstChild.textContent = answer === 'No' ? 'Keep unchanged ' : 'Accept ';
    }
  }

  function menuKeydown(event) {
    if (event.isComposing || event.ctrlKey || event.metaKey || event.altKey) return;
    const choices = options();
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!choices.length) return;
      const delta = event.key === 'ArrowDown' ? 1 : -1;
      state.activeIndex = (state.activeIndex + delta + choices.length) % choices.length;
      updateActiveOption();
    } else if (event.key === 'Enter') {
      event.preventDefault();
      advance();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      if (state.filter) {
        state.filter = '';
        state.activeIndex = 0;
        render();
      } else {
        goBack();
      }
    }
  }

  function renderContainer() {
    const form = element('form', 'container-form');
    const line = element('div', 'question');
    const label = element('label', '', questions.container);
    label.htmlFor = 'container-name';
    const input = element('input', 'terminal-input container-input');
    input.id = 'container-name';
    input.name = 'container';
    input.value = state.container;
    input.autocomplete = 'off';
    input.spellcheck = false;
    input.setAttribute('aria-describedby', 'container-error');
    input.addEventListener('input', () => {
      state.container = input.value;
      input.removeAttribute('aria-invalid');
      document.getElementById('container-error').textContent = '';
    });
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      advance();
    });
    line.append(element('span', 'prompt-mark', '? '), label, input);
    form.append(line);
    output.append(form);
    const error = element('p', 'error');
    error.id = 'container-error';
    error.setAttribute('role', 'alert');
    output.append(error);
  }

  function renderDiff() {
    const title = element('p', 'line');
    title.append(document.createTextNode('Previewing changes to '), element('span', 'file-name', 'azure.yaml'),
      document.createTextNode(':'));
    output.append(title);
    const diff = element('div', 'diff');
    diff.setAttribute('role', 'region');
    diff.setAttribute('aria-label', 'Proposed additions to azure.yaml');
    ['+  storage:', '+    type: storage', '+    containers:', `+      - ${state.container}`].forEach((line) => {
      diff.append(element('p', 'diff-line', line));
    });
    output.append(diff);
  }

  function render() {
    const selectionComplete = state.step === 'ai-selected' || state.step === 'simulation-selected';
    output.replaceChildren(shell('azd add'));
    state.history.forEach((entry) => output.append(question(entry.text, entry.answer)));
    if (state.step === 'review' || state.step === 'done') renderDiff();
    if (state.step === 'done') {
      output.append(question(questions.review, state.accepted ? 'Yes' : 'No'));
      if (state.accepted) {
        output.append(element('p', 'line success', 'SUCCESS: azure.yaml updated.'));
        const nextSteps = element('p', 'line');
        nextSteps.append(document.createTextNode('Run '), element('code', '', 'azd infra gen'),
          document.createTextNode(' to re-generate the infrastructure, then run '),
          element('code', '', 'azd provision'),
          document.createTextNode(' to provision these changes anytime later.'));
        output.append(nextSteps);
      } else {
        output.append(element('p', 'line', 'No changes made to azure.yaml.'));
      }
      output.append(shell());
    } else if (state.step === 'container') {
      renderContainer();
    } else if (!selectionComplete) {
      const currentQuestion = question(questions[state.step], activeAnswer());
      currentQuestion.id = 'active-question';
      let answer = currentQuestion.querySelector('.answer');
      if (!answer) {
        answer = element('span', 'answer');
        currentQuestion.append(answer);
      }
      answer.id = 'current-answer';
      output.append(currentQuestion);
      renderMenu();
    }

    const labels = {
      category: 'Choose a resource category',
      ai: 'Choose an AI resource type',
      'ai-selected': 'AI type selected - end of supplied reference',
      Database: 'Choose a database resource (simulation)',
      'Host service': 'Choose a host service (simulation)',
      'Key Vault': 'Choose a Key Vault item (simulation)',
      Messaging: 'Choose a messaging resource (simulation)',
      'simulation-selected': 'Simulated resource selected',
      storage: 'Choose a storage data type',
      container: 'Name the blob container',
      review: 'Review the proposed change',
      done: state.accepted ? 'Changes accepted - next commands' : 'Changes declined'
    };
    stepLabel.textContent = labels[state.step];
    if (state.step === 'ai-selected') {
      referenceNote.textContent = 'AI type selected. Follow-up configuration was not included in the screenshots, so this branch stops here. Try the Blob storage example for the complete preview-and-accept flow.';
    } else if (state.step === 'simulation-selected') {
      referenceNote.textContent = `${state.history.at(-1).answer} selected. This simulation stops at resource selection; no YAML changes are generated. Try the Blob storage example for the complete preview-and-accept flow.`;
    } else if (Object.hasOwn(simulatedGroups, state.step)) {
      referenceNote.textContent = `The ${state.step} menu uses simulated items to demonstrate resource selection. These choices are not from the supplied screenshots.`;
    } else {
      referenceNote.textContent = referenceText;
    }
    backButton.disabled = previousStates.length === 0;
    continueButton.hidden = selectionComplete || state.step === 'done';
    continueButton.firstChild.textContent = state.step === 'container' ? 'Continue '
      : state.step === 'review' ? (activeAnswer() === 'No' ? 'Keep unchanged ' : 'Accept ') : 'Select ';
    if (state.step === 'container') continueButton.disabled = false;
    keyboardHint.textContent = state.step === 'container' ? 'Enter to confirm'
      : selectionComplete || state.step === 'done' ? 'Use Back to revisit, or Restart'
      : 'Use arrows to move';
    const focusTarget = document.getElementById('resource-filter') || document.getElementById('container-name')
      || document.getElementById('resource-options') || backButton;
    focusTarget.focus({ preventScroll: true });
  }

  function advance() {
    if (state.step === 'container') {
      const input = document.getElementById('container-name');
      const value = input.value.trim();
      if (!/^[a-z0-9](?:[a-z0-9-]{1,61})[a-z0-9]$/.test(value) || value.includes('--')) {
        input.setAttribute('aria-invalid', 'true');
        document.getElementById('container-error').textContent =
          'Use 3-63 lowercase letters or numbers, with single hyphens only between letters or numbers.';
        input.focus();
        return;
      }
      transition(() => {
        state.container = value;
        record(value);
        state.step = 'review';
      });
      return;
    }
    const answer = activeAnswer();
    if (!answer) return;
    if (!['category', 'ai', 'storage', 'review'].includes(state.step) &&
        !Object.hasOwn(simulatedGroups, state.step)) return;
    transition(() => {
      if (state.step === 'review') {
        state.accepted = answer === 'Yes';
        state.step = 'done';
      } else {
        record(answer);
        state.step = state.step === 'category'
          ? (answer === 'AI' ? 'ai' : answer === 'Storage account' ? 'storage' : answer)
          : state.step === 'ai' ? 'ai-selected'
          : state.step === 'storage' ? 'container' : 'simulation-selected';
      }
    });
  }

  function goBack() {
    if (!previousStates.length) return;
    state = previousStates.pop();
    render();
  }

  function restart(category) {
    state = initialState();
    previousStates = [];
    if (category) state.activeIndex = categories.indexOf(category);
    render();
    if (category) advance();
  }

  document.querySelector('.terminal').addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !event.isComposing) {
      event.preventDefault();
      goBack();
    }
  });
  backButton.addEventListener('click', goBack);
  continueButton.addEventListener('click', advance);
  document.getElementById('restart-button').addEventListener('click', () => restart());
  document.getElementById('ai-example').addEventListener('click', () => restart('AI'));
  document.getElementById('storage-example').addEventListener('click', () => restart('Storage account'));
  restart();
})();
