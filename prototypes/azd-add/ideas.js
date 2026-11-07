(() => {
  'use strict';

  const model = globalThis.AzdAddPlan;
  const output = document.getElementById('idea-output');
  const quickPicks = new Set(['ai.openai', 'ai.search', 'database.cosmos', 'database.sql', 'messaging.queue', 'storage.blobs']);
  const capabilities = [
    { label: 'Add AI chat', resourceId: 'ai.openai', reason: 'An OpenAI model powers the chat capability.' },
    { label: 'Store uploaded files', resourceId: 'storage.blobs', reason: 'Blob storage holds your uploaded files.' },
    { label: 'Search my data', resourceId: 'ai.search', reason: 'AI Search indexes and retrieves your data.' },
    { label: 'Process background work', resourceId: 'messaging.queue', reason: 'A queue buffers work for asynchronous processing.' },
    { label: 'Store application data', resourceId: 'database.cosmos', reason: 'Demo assumption: Cosmos DB for document data.' }
  ];
  const descriptions = {
    resources: 'Browse categories, or type to find a resource directly.',
    goal: 'For users who know the outcome, but not which Azure services to choose.',
    capability: 'For common app tasks, without needing Azure expertise or a free-form prompt.'
  };
  const modes = Object.keys(descriptions);
  let mode = 'resources';

  function createState(key) {
    return { draft: model.createDraft(), stage: key === 'capability' ? 'capabilities' : key, filter: '', showAll: key === 'resources', expandedGroups: new Set(), filteredClosedGroups: new Set(), goal: '', activeIndex: 0, editId: null, editFieldIndex: 0, showErrors: false, error: '' };
  }
  const states = Object.fromEntries(modes.map((key) => [key, createState(key)]));
  const state = () => states[mode];
  const displayName = (item) => item.id === 'storage.blobs' ? 'Blob storage' : item.label;
  const nodeId = (id) => `choice-${id.replaceAll('.', '-')}`;
  const groupId = (group) => `category-${group.toLowerCase().replaceAll(' ', '-')}`;
  const fieldId = (id, key) => `value-${id}-${key}`;

  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }
  function line(text, className = '') {
    return element('p', `line ${className}`, text);
  }
  function action(label, id, callback) {
    const button = element('button', 'text-button idea-secondary', label);
    button.type = 'button';
    if (id) button.id = id;
    button.dataset.terminalAction = 'true';
    button.addEventListener('click', callback);
    button.addEventListener('focus', () => {
      const controls = terminalControls();
      const index = controls.indexOf(button);
      if (index >= 0) focusChoice(controls, index, false);
    });
    return button;
  }

  function terminalControls() {
    return [...output.querySelectorAll('[role="checkbox"], [data-category-group], [data-terminal-action]')];
  }

  function visibleResources() {
    const current = state();
    const query = current.filter.toLowerCase().trim();
    return model.catalog.filter((item) => query
      ? `${item.group} ${displayName(item)} ${item.id}`.toLowerCase().includes(query)
      : current.showAll || quickPicks.has(item.id) || current.draft.selected.has(item.id));
  }

  function navigate(stage) {
    state().stage = stage;
    state().activeIndex = 0;
    state().error = '';
    state().showErrors = false;
    state().draft.approved = false;
    render();
  }

  function categoryExpanded(group) {
    return state().filter.trim() ? !state().filteredClosedGroups.has(group) : state().expandedGroups.has(group);
  }

  function setCategoryExpanded(group, expanded) {
    const current = state();
    if (current.filter.trim()) {
      if (expanded) current.filteredClosedGroups.delete(group);
      else current.filteredClosedGroups.add(group);
    } else if (expanded) current.expandedGroups.add(group);
    else current.expandedGroups.delete(group);
    render(groupId(group));
  }

  function renderCategories(items) {
    const current = state();
    const groups = [...new Set(items.map((item) => item.group))];
    for (const group of groups) {
      const resources = items.filter((item) => item.group === group);
      const selected = resources.filter((item) => current.draft.selected.has(item.id)).length;
      const expanded = categoryExpanded(group);
      const header = element('button', 'idea-row idea-category');
      header.id = groupId(group);
      header.type = 'button';
      header.dataset.categoryGroup = group;
      header.setAttribute('aria-expanded', String(expanded));
      header.setAttribute('aria-label', `${group}, ${resources.length} resources${selected ? `, ${selected} selected` : ''}`);
      const marker = element('span', 'idea-marker', expanded ? '  [-] ' : '  [+] ');
      marker.setAttribute('aria-hidden', 'true');
      header.append(marker, element('span', '', `${group} (${resources.length})${selected ? ` / ${selected} selected` : ''}`));
      header.addEventListener('click', () => setCategoryExpanded(group, !categoryExpanded(group)));
      header.addEventListener('focus', () => {
        const controls = terminalControls();
        focusChoice(controls, controls.indexOf(header), false);
      });
      output.append(header);
      if (expanded) renderChoices(resources);
    }
    if (groups.length) {
      const allExpanded = groups.every(categoryExpanded);
      output.append(action(allExpanded ? 'Collapse all categories' : 'Expand all categories', 'expand-all', () => {
        if (current.filter.trim()) current.filteredClosedGroups = allExpanded ? new Set(groups) : new Set();
        else current.expandedGroups = allExpanded ? new Set() : new Set(groups);
        current.activeIndex = 0;
        render();
      }));
    }
  }

  function renderChoices(items, isCapability = false) {
    const current = state();
    items.forEach((item) => {
      const index = terminalControls().length;
      const id = isCapability ? item.resourceId : item.id;
      const checked = current.draft.selected.has(id);
      const nested = current.stage === 'resources' && current.showAll;
      const button = element('button', `idea-row${nested ? ' idea-tree-resource' : ''}${index === current.activeIndex ? ' is-active' : ''}`);
      if (!isCapability) button.dataset.resourceGroup = item.group;
      button.id = nodeId(id);
      button.type = 'button';
      button.tabIndex = index === current.activeIndex ? 0 : -1;
      button.setAttribute('role', 'checkbox');
      button.setAttribute('aria-label', isCapability ? item.label : displayName(item));
      button.setAttribute('aria-checked', String(checked));
      const marker = element('span', 'idea-marker', `${index === current.activeIndex ? '> ' : '  '}${checked ? '[x] ' : '[ ] '}`);
      marker.setAttribute('aria-hidden', 'true');
      button.append(marker, element('span', '', isCapability ? item.label : displayName(item)));
      button.addEventListener('click', () => {
        current.activeIndex = index;
        const selected = model.toggleResource(current.draft, id);
        if (isCapability) {
          if (selected) {
            current.draft.origins[id] = 'capability';
            current.draft.reasons[id] = item.reason;
          }
          current.draft.reuseHost = current.draft.selected.size > 0;
          current.draft.goal = capabilities.filter((entry) => current.draft.selected.has(entry.resourceId))
            .map((entry) => entry.label).join(' + ');
        }
        current.error = '';
        const rowRemainsVisible = isCapability || visibleResources().some((entry) => entry.id === id);
        render(rowRemainsVisible ? button.id : 'idea-filter');
      });
      output.append(button);
    });
  }

  function renderResources() {
    const current = state();
    output.append(line('? Select resources to add:'));
    const row = element('div', 'filter-row');
    const label = element('label', '', 'Filter:');
    label.htmlFor = 'idea-filter';
    const input = element('input', 'terminal-input filter-input');
    input.id = label.htmlFor;
    input.value = current.filter;
    input.placeholder = 'Find a resource or category';
    input.autocomplete = 'off';
    input.spellcheck = false;
    input.setAttribute('aria-describedby', 'idea-status');
    input.addEventListener('input', () => {
      current.filter = input.value;
      current.filteredClosedGroups.clear();
      current.activeIndex = 0;
      const start = input.selectionStart;
      const end = input.selectionEnd;
      render('idea-filter');
      document.getElementById('idea-filter').setSelectionRange(start, end);
    });
    row.append(label, input);
    output.append(row);
    const visible = visibleResources();
    if (current.showAll) renderCategories(visible);
    else renderChoices(visible);
    if (!visible.length) output.append(line('No matches. Clear the filter; your selections are retained.', 'context-line'));
    if (!current.showAll) {
      output.append(action('Browse all 16 resource types', 'browse-all', () => {
        current.showAll = true;
        current.filter = '';
        current.activeIndex = 0;
        render();
      }));
    }
  }

  function renderGoal() {
    const current = state();
    const form = element('form', 'goal-entry');
    const label = element('label', '', '? What do you want to add?');
    label.htmlFor = 'idea-goal';
    const input = element('input', 'terminal-input idea-goal');
    input.id = label.htmlFor;
    input.value = current.goal;
    input.placeholder = 'e.g. Add chat and file uploads to my app';
    input.autocomplete = 'off';
    input.setAttribute('aria-label', 'What do you want to add?');
    input.setAttribute('aria-describedby', 'idea-error');
    input.setAttribute('aria-invalid', String(Boolean(current.error)));
    input.addEventListener('input', () => {
      current.goal = input.value;
      current.error = '';
      input.setAttribute('aria-invalid', 'false');
      const error = document.getElementById('idea-error');
      error.textContent = '';
      error.hidden = true;
    });
    form.append(label, input);
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      advance();
    });
    output.append(form, action('Try: AI chat with file uploads', 'goal-example', () => {
      current.goal = 'Add AI chat and file uploads to my app';
      advance();
    }));
    output.append(action('Choose specific resources instead', 'manual-resources', () => navigate('resources')));
  }

  function renderCapabilities() {
    output.append(line('? What should your app do?'));
    renderChoices(capabilities, true);
    output.append(action('Choose a specific resource instead', 'manual-resources', () => navigate('resources')));
  }

  function editResource(id, withErrors = false) {
    state().editId = id;
    state().editFieldIndex = 0;
    navigate('edit');
    if (withErrors) {
      state().showErrors = true;
      const first = model.buildPlan(state().draft).unresolvedFields.find((error) => error.resourceId === id);
      state().editFieldIndex = model.catalog.find((item) => item.id === id).fields.findIndex((field) => field.key === first.field);
      render(fieldId(id, first.field));
    }
  }

  function renderReview(plan) {
    output.append(line(`? Add these ${plan.resources.length} resource${plan.resources.length === 1 ? '' : 's'}?`));
    if (plan.reusedResources.length) output.append(line('Reuse your existing web host.', 'compact-reuse'));
    for (const item of plan.resources) {
      const spec = model.catalog.find((entry) => entry.id === item.id);
      const row = element('div', 'compact-resource');
      const values = spec.fields.map((field) => `${field.label}: ${item.parameters[field.key]}`).join(' / ');
      row.append(element('span', 'compact-resource-name', displayName(spec)), element('span', 'compact-resource-values', values));
      output.append(row);
      if (item.origin !== 'manual') output.append(line(item.reason, 'compact-reason'));
      plan.unresolvedFields.filter((error) => error.resourceId === item.id)
        .forEach((error) => output.append(line(error.message, 'error')));
    }
    output.append(line('? What would you like to do?'));
    const menu = element('div', 'idea-review-menu');
    menu.id = 'idea-review-menu';
    menu.tabIndex = 0;
    menu.setAttribute('role', 'listbox');
    menu.setAttribute('aria-label', 'Review actions');
    function addOption(label, id, callback) {
      const button = action(label, id, callback);
      button.className = 'option';
      button.setAttribute('role', 'option');
      button.setAttribute('aria-label', label);
      button.setAttribute('aria-selected', 'false');
      menu.append(button);
    }
    addOption(plan.status === 'ready'
      ? `Add ${plan.resources.length} resource${plan.resources.length === 1 ? '' : 's'}`
      : 'Fix required values', 'add-resources', advance);
    plan.resources.forEach((item) => {
      addOption(`Edit ${displayName(model.catalog.find((entry) => entry.id === item.id))}`,
        `edit-${item.id}`, () => editResource(item.id));
    });
    addOption('Change resources', 'change-resources', () => navigate('resources'));
    output.append(menu);
    const details = element('details', 'idea-preview');
    const summary = element('summary', '', 'Preview configuration (illustrative)');
    summary.dataset.terminalAction = 'true';
    details.append(summary);
    const lines = ['+ resources:'];
    plan.resources.forEach((item) => {
      lines.push(`+   - id: ${JSON.stringify(item.id)}`);
      Object.entries(item.parameters).forEach(([key, value]) => lines.push(`+     ${key}: ${JSON.stringify(value)}`));
    });
    details.append(element('pre', '', lines.join('\n')));
    output.append(details);
  }

  function renderEdit() {
    const current = state();
    const item = model.catalog.find((entry) => entry.id === current.editId);
    output.append(line(`? Edit ${displayName(item)}:`));
    const form = element('form', 'idea-edit-form');
    item.fields.slice(0, current.editFieldIndex).forEach((spec) => {
      form.append(line(`  ${spec.label}: ${current.draft.parameters[item.id][spec.key]}`));
    });
    const spec = item.fields[current.editFieldIndex];
    {
      const row = element('div', 'idea-field');
      const label = element('label', '', `${spec.label}:`);
      label.htmlFor = fieldId(item.id, spec.key);
      const input = element('input', 'terminal-input');
      input.id = label.htmlFor;
      input.value = current.draft.parameters[item.id][spec.key];
      input.autocomplete = 'off';
      input.spellcheck = false;
      input.setAttribute('aria-label', `${displayName(item)}: ${spec.label}`);
      input.setAttribute('aria-required', 'true');
      const error = element('p', 'error idea-field-error');
      error.id = `${input.id}-error`;
      error.setAttribute('role', 'alert');
      input.setAttribute('aria-describedby', error.id);
      function updateError() {
        const message = current.showErrors ? model.validateField(spec, input.value) : '';
        error.textContent = message;
        input.setAttribute('aria-invalid', String(Boolean(message)));
      }
      updateError();
      input.addEventListener('input', () => {
        model.updateField(current.draft, item.id, spec.key, input.value);
        updateError();
        updateControls();
      });
      row.append(label, input);
      form.append(row, error);
    }
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      advance();
    });
    output.append(form);
  }

  function updateControls() {
    const current = state();
    const plan = model.buildPlan(current.draft);
    const stage = current.stage;
    const next = document.getElementById('idea-next');
    next.hidden = stage === 'done';
    next.disabled = ['resources', 'capabilities'].includes(stage) && !plan.resources.length;
    document.getElementById('idea-next-label').textContent = stage === 'goal' ? 'Suggest resources'
      : stage === 'edit' ? (current.editFieldIndex < model.catalog.find((item) => item.id === current.editId).fields.length - 1 ? 'Next field' : 'Confirm value')
      : stage === 'review' ? terminalControls()[current.activeIndex].textContent
      : 'Review selection';
    document.getElementById('idea-back').disabled = stage === (mode === 'capability' ? 'capabilities' : mode);
    document.getElementById('idea-status').textContent = ['resources', 'capabilities'].includes(stage)
      ? `${plan.resources.length} selected${stage === 'resources' ? ` / Type filters${current.showAll ? ' / Left/Right groups' : ''}` : ''} / Space selects / Enter reviews`
      : stage === 'edit' ? 'Enter confirms / Esc goes back'
      : stage === 'review' ? 'Up/Down choose / Enter confirms'
      : stage === 'done' ? 'Complete / Esc returns to review' : 'Enter suggests / Up/Down for shortcuts';
  }

  function render(focusId) {
    const current = state();
    const plan = model.buildPlan(current.draft);
    const shell = element('p', 'line');
    shell.append(element('span', 'shell-prompt', '> '), element('span', 'shell-path', 'developer:~/my-azd-project'),
      document.createTextNode('$ azd add'));
    output.replaceChildren(shell);
    if (current.stage === 'resources') renderResources();
    else if (current.stage === 'goal') renderGoal();
    else if (current.stage === 'capabilities') renderCapabilities();
    else if (current.stage === 'review') renderReview(plan);
    else if (current.stage === 'edit') renderEdit();
    else {
      output.append(line(`SIMULATION COMPLETE: ${plan.resources.length} resources accepted.`, 'success'));
      output.append(line('No project files were written. No Azure resources were provisioned.'));
      output.append(line('Next in the reference flow: azd infra gen, then azd provision.', 'context-line'));
    }
    const error = line(current.error, 'error');
    error.id = 'idea-error';
    error.hidden = !current.error;
    error.setAttribute('role', 'alert');
    output.append(error);
    const controls = terminalControls();
    if (controls.length) focusChoice(controls, Math.max(0, Math.min(current.activeIndex, controls.length - 1)), false);
    updateControls();
    const defaultId = current.stage === 'resources'
      ? (current.showAll && !current.filter.trim() && controls[current.activeIndex]?.dataset.categoryGroup ? controls[current.activeIndex].id : 'idea-filter')
      : current.stage === 'goal' ? 'idea-goal'
      : current.stage === 'capabilities' ? controls[current.activeIndex].id
      : current.stage === 'edit' ? fieldId(current.editId, model.catalog.find((item) => item.id === current.editId).fields[current.editFieldIndex].key)
      : current.stage === 'done' ? 'idea-terminal' : 'idea-review-menu';
    document.getElementById(focusId || defaultId).focus({ preventScroll: true });
  }

  function advance() {
    const current = state();
    const plan = model.buildPlan(current.draft);
    if (current.stage === 'goal') {
      const result = model.suggestResources(current.draft, current.goal);
      if (!result.ok) {
        current.error = result.message;
        render('idea-goal');
        return;
      }
      navigate('review');
    } else if (['resources', 'capabilities'].includes(current.stage)) {
      if (!plan.resources.length) {
        current.error = `Select at least one item with Space to continue.${current.stage === 'resources' && current.showAll ? ' Right opens a category.' : ''}`;
        render();
        return;
      }
      navigate('review');
    } else if (current.stage === 'edit') {
      const item = model.catalog.find((entry) => entry.id === current.editId);
      const spec = item.fields[current.editFieldIndex];
      if (model.validateField(spec, current.draft.parameters[item.id][spec.key])) {
        current.showErrors = true;
        render(fieldId(item.id, spec.key));
        return;
      }
      if (current.editFieldIndex < item.fields.length - 1) {
        current.editFieldIndex += 1;
        current.showErrors = false;
        render();
      } else navigate('review');
    } else if (current.stage === 'review') {
      const result = model.acceptPlan(current.draft);
      if (!result.ok) {
        const first = result.errors[0];
        if (!first.resourceId) navigate(mode === 'capability' ? 'capabilities' : mode);
        else editResource(first.resourceId, true);
        return;
      }
      current.stage = 'done';
      render();
    }
  }

  function back() {
    const current = state();
    if (current.stage === 'edit' && current.editFieldIndex > 0) {
      current.editFieldIndex -= 1;
      current.showErrors = false;
      render();
    } else if (current.stage === 'edit' || current.stage === 'done') navigate('review');
    else if (current.stage === 'review' || (current.stage === 'resources' && mode !== 'resources')) {
      navigate(mode === 'capability' ? 'capabilities' : mode);
    }
  }

  function switchConcept(key, focusTab = false) {
    mode = key;
    document.querySelectorAll('[role="tab"]').forEach((tab) => {
      const selected = tab.id === `tab-${mode}`;
      tab.setAttribute('aria-selected', String(selected));
      tab.tabIndex = selected ? 0 : -1;
    });
    document.getElementById('idea-panel').setAttribute('aria-labelledby', `tab-${mode}`);
    document.getElementById('idea-description').textContent = descriptions[mode];
    render(focusTab ? `tab-${mode}` : undefined);
  }

  function focusChoice(rows, index, focus = true) {
    state().activeIndex = index;
    rows.forEach((row, rowIndex) => {
      const active = rowIndex === index;
      row.classList.toggle('is-active', active);
      row.tabIndex = active ? 0 : -1;
      if (row.getAttribute('role') === 'checkbox') {
        row.querySelector('.idea-marker').textContent =
          `${active ? '> ' : '  '}${row.getAttribute('aria-checked') === 'true' ? '[x] ' : '[ ] '}`;
      } else if (row.dataset.categoryGroup) {
        row.querySelector('.idea-marker').textContent =
          `${active ? '> ' : '  '}${row.getAttribute('aria-expanded') === 'true' ? '[-] ' : '[+] '}`;
      } else if (row.getAttribute('role') === 'option') row.setAttribute('aria-selected', String(active));
    });
    if (focus) rows[index].focus();
    updateControls();
  }

  function confirmSelection(target) {
    if (target?.id === 'idea-back') back();
    else if (target?.dataset.terminalAction) target.click();
    else if (state().stage === 'review') terminalControls()[state().activeIndex].click();
    else advance();
  }

  document.querySelector('.idea-tabs').addEventListener('keydown', (event) => {
    if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
    event.preventDefault();
    switchConcept(modes[(modes.indexOf(mode) + (event.key === 'ArrowRight' ? 1 : -1) + modes.length) % modes.length], true);
  });
  modes.forEach((key) => document.getElementById(`tab-${key}`).addEventListener('click', () => switchConcept(key)));
  document.querySelector('.terminal').addEventListener('keydown', (event) => {
    if (event.isComposing || event.ctrlKey || event.metaKey || event.altKey) return;
    const current = state();
    if (event.key === 'Escape') {
      event.preventDefault();
      if (current.stage === 'resources' && current.filter) {
        current.filter = '';
        current.activeIndex = 0;
        render(current.showAll ? undefined : 'idea-filter');
      } else back();
      return;
    }
    const isInput = event.target instanceof HTMLInputElement;
    if (event.key === 'Enter') {
      event.preventDefault();
      confirmSelection(isInput ? undefined : event.target);
      return;
    }
    const rows = terminalControls();
    if (isInput && !['idea-filter', 'idea-goal'].includes(event.target.id)) return;
    if (!isInput && current.stage === 'resources' && current.showAll &&
        ['ArrowRight', 'ArrowLeft'].includes(event.key)) {
      event.preventDefault();
      const selected = rows.includes(event.target) ? event.target : rows[current.activeIndex];
      const group = selected?.dataset.categoryGroup;
      if (group) {
        if (event.key === 'ArrowRight') {
          if (!categoryExpanded(group)) setCategoryExpanded(group, true);
          else {
            const childIndex = rows.findIndex((row) => row.dataset.resourceGroup === group);
            if (childIndex >= 0) focusChoice(rows, childIndex);
          }
        } else if (categoryExpanded(group)) setCategoryExpanded(group, false);
      } else if (event.key === 'ArrowLeft' && selected?.dataset.resourceGroup) {
        const parentIndex = rows.findIndex((row) => row.dataset.categoryGroup === selected.dataset.resourceGroup);
        if (parentIndex >= 0) focusChoice(rows, parentIndex);
      }
    } else if (['ArrowDown', 'ArrowUp'].includes(event.key) && rows.length) {
      event.preventDefault();
      const focusedIndex = rows.indexOf(event.target);
      const index = isInput ? (event.key === 'ArrowDown' ? 0 : rows.length - 1)
        : ((focusedIndex >= 0 ? focusedIndex : current.activeIndex) + (event.key === 'ArrowDown' ? 1 : -1) + rows.length) % rows.length;
      focusChoice(rows, index);
    } else if (!isInput && event.key === ' ') {
      const selected = rows.includes(event.target) ? event.target : rows[current.activeIndex];
      if (selected?.getAttribute('role') === 'checkbox') {
        event.preventDefault();
        selected.click();
      } else if (selected?.dataset.categoryGroup) {
        event.preventDefault();
      }
    } else if (!isInput && event.key === '/' && current.stage === 'resources') {
      event.preventDefault();
      document.getElementById('idea-filter').focus();
    } else if (!isInput && current.stage === 'resources' &&
               (event.key.length === 1 || event.key === 'Backspace')) {
      event.preventDefault();
      const input = document.getElementById('idea-filter');
      input.focus({ preventScroll: true });
      const start = input.selectionStart;
      const end = input.selectionEnd;
      const from = event.key === 'Backspace' && start === end ? Math.max(0, start - 1) : start;
      input.setRangeText(event.key === 'Backspace' ? '' : event.key, from, end, 'end');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }
  });
  document.getElementById('idea-terminal').addEventListener('pointerdown', (event) => {
    if (event.target instanceof Element && !event.target.closest('input, button, a, label, summary')) {
      document.getElementById('idea-terminal').focus({ preventScroll: true });
    }
  });
  document.getElementById('idea-next').addEventListener('click', () => confirmSelection());
  document.getElementById('idea-back').addEventListener('click', back);
  document.getElementById('idea-restart').addEventListener('click', () => {
    states[mode] = createState(mode);
    render();
  });
  render();
})();
