(() => {
  'use strict';

  const model = globalThis.AzdAddPlan;
  const output = document.getElementById('hybrid-output');
  const nextButton = document.getElementById('hybrid-next');
  const backButton = document.getElementById('hybrid-back');
  let draft = model.createDraft();
  let stage = 'select';
  let filter = '';
  let goalInput = '';
  let activeIndex = 0;
  let showErrors = false;
  let goalError = '';
  let selectionError = '';
  let suggestionStatus = '';
  let showAgent = false;

  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function line(text, className = '') {
    return element('p', `line ${className}`, text);
  }

  function resourceId(id) {
    return `resource-${id.replaceAll('.', '-')}`;
  }

  function fieldId(id, key) {
    return `field-${id}-${key}`;
  }

  function visibleResources() {
    const text = filter.toLowerCase().trim();
    return model.catalog.filter((item) => `${item.group} ${item.label} ${item.id}`.toLowerCase().includes(text));
  }

  function focusResource() {
    const visible = visibleResources();
    if (!visible.length) return;
    activeIndex = Math.max(0, Math.min(activeIndex, visible.length - 1));
    output.querySelectorAll('.resource-row').forEach((node, index) => {
      node.classList.toggle('is-active', index === activeIndex);
      node.tabIndex = index === activeIndex ? 0 : -1;
      node.querySelector('.resource-pointer').textContent = index === activeIndex ? '> ' : '  ';
    });
    const node = document.getElementById(resourceId(visible[activeIndex].id));
    node.focus({ preventScroll: true });
    node.scrollIntoView({ block: 'nearest' });
  }

  function updateAgent() {
    document.getElementById('agent-plan').textContent = JSON.stringify(model.buildPlan(draft), null, 2);
    document.getElementById('agent-panel').hidden = !showAgent;
    const toggle = document.getElementById('agent-toggle');
    toggle.setAttribute('aria-expanded', String(showAgent));
    toggle.textContent = showAgent ? 'Hide agent view' : 'Agent view';
  }

  function updateControls() {
    const plan = model.buildPlan(draft);
    const hidden = stage === 'select'
      ? plan.resources.filter((item) => !visibleResources().some((visible) => visible.id === item.id)).length : 0;
    document.getElementById('selection-count').textContent =
      `${plan.resources.length} selected${hidden ? ` / ${hidden} hidden by filter` : ''}`;
    nextButton.disabled = stage === 'select' && !plan.resources.length;
    nextButton.hidden = stage === 'done';
    backButton.disabled = stage === 'select';
    document.getElementById('next-label').textContent = stage === 'review' ? 'Approve plan'
      : stage === 'configure' || (draft.entry === 'goal' && plan.status === 'ready') ? 'Review plan'
      : `Configure ${plan.resources.length} resource${plan.resources.length === 1 ? '' : 's'}`;
    document.getElementById('hybrid-hint').textContent = stage === 'select'
      ? 'Arrows move / Space selects / / filters / Enter continues'
      : stage === 'configure' ? 'Edit values / Enter reviews / Esc goes back'
      : stage === 'review' ? 'Review the exact plan before approving'
      : 'Accepted in this browser only';
    document.getElementById('goal-examples').hidden = stage !== 'select';
    document.querySelectorAll('[data-stage]').forEach((item) => {
      if (item.dataset.stage === (stage === 'done' ? 'review' : stage)) item.setAttribute('aria-current', 'step');
      else item.removeAttribute('aria-current');
    });
    const notes = {
      select: 'All categories are expanded. Select what you need or try a goal. Goal suggestions are a keyword-based simulation, not live AI.',
      configure: 'These are required demo fields with sample defaults, not complete Azure schemas. Back, removal, and re-selection preserve your values. Never enter real secrets.',
      review: 'This is the same draft shown in Agent view. Review additions and reused resources; edit anything before approving. The configuration preview is illustrative.',
      done: 'A real implementation would apply only the approved plan to azure.yaml. Infrastructure generation and provisioning remain separate.'
    };
    document.getElementById('design-note').textContent = notes[stage];
    updateAgent();
  }

  function requestSuggestions() {
    const result = model.suggestResources(draft, goalInput);
    goalError = result.ok ? '' : result.message;
    if (result.ok) {
      suggestionStatus = `${result.suggested} suggested / ${result.added} newly selected${result.reuseHost ? ' / existing web host reused' : ''}. Review or adjust below.`;
      selectionError = '';
    }
    render('hybrid-goal');
  }

  function renderSelection() {
    const goalForm = element('form', 'goal-form');
    const label = element('label', '', 'Describe a goal (optional):');
    label.htmlFor = 'hybrid-goal';
    const row = element('div', 'goal-input-row');
    const input = element('input', 'goal-input');
    input.id = 'hybrid-goal';
    input.value = goalInput;
    input.placeholder = 'e.g. Add AI chat and file uploads to my app';
    input.autocomplete = 'off';
    input.setAttribute('aria-describedby', 'goal-error');
    if (goalError) input.setAttribute('aria-invalid', 'true');
    input.addEventListener('input', () => { goalInput = input.value; });
    const suggest = element('button', 'select-button', 'Suggest resources');
    suggest.id = 'suggest-button';
    suggest.type = 'submit';
    row.append(input, suggest);
    goalForm.append(label, row);
    goalForm.addEventListener('submit', (event) => {
      event.preventDefault();
      requestSuggestions();
    });
    output.append(goalForm);
    const error = line(goalError, 'error');
    error.id = 'goal-error';
    error.setAttribute('role', 'alert');
    const status = line(suggestionStatus, 'suggestion-status');
    status.id = 'suggestion-status';
    status.setAttribute('role', 'status');
    if (!goalError) error.hidden = true;
    if (!suggestionStatus) status.hidden = true;
    output.append(error, status);
    if (draft.reuseHost) output.append(line('Reuse existing host: web (Azure Container Apps). No additional host suggested.', 'reuse-line'));
    output.append(line('? Select resources to add:'));
    const filterRow = element('div', 'filter-row');
    const filterLabel = element('label', '', 'Filter:');
    filterLabel.htmlFor = 'hybrid-filter';
    const filterInput = element('input', 'terminal-input filter-input');
    filterInput.id = 'hybrid-filter';
    filterInput.value = filter;
    filterInput.placeholder = 'Type a resource or category name';
    filterInput.autocomplete = 'off';
    filterInput.spellcheck = false;
    filterInput.setAttribute('aria-describedby', 'selection-count');
    filterInput.addEventListener('input', () => {
      filter = filterInput.value;
      activeIndex = 0;
      const start = filterInput.selectionStart;
      const end = filterInput.selectionEnd;
      render('hybrid-filter');
      document.getElementById('hybrid-filter').setSelectionRange(start, end);
    });
    filterRow.append(filterLabel, filterInput);
    output.append(filterRow);
    if (selectionError) output.append(line(selectionError, 'error'));
    const visible = visibleResources();
    activeIndex = Math.max(0, Math.min(activeIndex, visible.length - 1));
    const groups = [...new Set(visible.map((item) => item.group))];
    for (const group of groups) {
      const section = element('section', 'resource-group');
      section.setAttribute('role', 'group');
      const heading = element('h2', 'group-heading', group);
      heading.id = `group-${group.replaceAll(' ', '-')}`;
      section.setAttribute('aria-labelledby', heading.id);
      section.append(heading);
      for (const item of visible.filter((entry) => entry.group === group)) {
        const index = visible.indexOf(item);
        const checked = draft.selected.has(item.id);
        const button = element('button', `resource-row${index === activeIndex ? ' is-active' : ''}`);
        button.type = 'button';
        button.id = resourceId(item.id);
        button.tabIndex = index === activeIndex ? 0 : -1;
        button.setAttribute('role', 'checkbox');
        button.setAttribute('aria-label', item.label);
        button.setAttribute('aria-checked', String(checked));
        const pointer = element('span', 'resource-pointer', index === activeIndex ? '> ' : '  ');
        const check = element('span', 'resource-check', checked ? '[x] ' : '[ ] ');
        pointer.setAttribute('aria-hidden', 'true');
        check.setAttribute('aria-hidden', 'true');
        button.append(pointer, check, element('span', 'resource-name', item.label));
        if (checked && draft.origins[item.id] === 'suggested') button.append(element('span', 'suggested-tag', 'suggested'));
        button.addEventListener('click', () => {
          activeIndex = index;
          model.toggleResource(draft, item.id);
          selectionError = '';
          render(button.id);
        });
        section.append(button);
        if (checked && draft.origins[item.id] === 'suggested') {
          section.append(line(draft.reasons[item.id], 'resource-reason'));
        }
      }
      output.append(section);
    }
    if (!visible.length) output.append(line('No matching resources. Clear the filter; your selections are retained.', 'context-line'));
  }

  function renderConfiguration() {
    output.append(line('? Configure the selected resources:'));
    const form = element('form', 'configuration-form');
    for (const item of model.catalog.filter((entry) => draft.selected.has(entry.id))) {
      const group = element('section', 'configuration-group');
      group.append(element('h2', '', item.label));
      for (const spec of item.fields) {
        const row = element('div', 'field-row');
        const label = element('label', '', `${spec.label}:`);
        label.htmlFor = fieldId(item.id, spec.key);
        const input = element('input', 'terminal-input field-input');
        input.id = label.htmlFor;
        input.value = draft.parameters[item.id][spec.key];
        input.autocomplete = 'off';
        input.spellcheck = false;
        input.setAttribute('aria-label', `${item.label}: ${spec.label}`);
        input.setAttribute('aria-required', 'true');
        const error = element('p', 'error field-error');
        error.id = `${input.id}-error`;
        error.setAttribute('role', 'alert');
        input.setAttribute('aria-describedby', error.id);
        function updateError() {
          const message = showErrors ? model.validateField(spec, input.value) : '';
          error.textContent = message;
          input.setAttribute('aria-invalid', String(Boolean(message)));
        }
        updateError();
        input.addEventListener('input', () => {
          model.updateField(draft, item.id, spec.key, input.value);
          updateError();
          updateControls();
        });
        row.append(label, input);
        group.append(row, error);
      }
      form.append(group);
    }
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      advance();
    });
    output.append(form);
  }

  function renderReview(plan) {
    output.append(line('? Review the resource plan:'));
    if (plan.reusedResources.length) {
      output.append(line('Reuse existing host: web (Azure Container Apps). No additional host added.', 'reuse-line'));
    }
    for (const item of plan.resources) {
      const section = element('section', 'review-resource');
      section.append(element('h2', '', item.type));
      section.append(line(Object.entries(item.parameters).map(([key, value]) => `${key}: ${value}`).join(' / '), 'review-values'));
      section.append(line(`Reason: ${item.reason}`, 'resource-reason'));
      output.append(section);
    }
    const actions = element('div', 'review-actions');
    for (const [id, label, target] of [['edit-resources', 'Edit resources', 'select'], ['edit-values', 'Edit values', 'configure']]) {
      const button = element('button', 'text-button', label);
      button.id = id;
      button.type = 'button';
      button.addEventListener('click', () => navigate(target));
      actions.append(button);
    }
    output.append(actions, line('Illustrative additions to azure.yaml (prototype schema, not deployment-ready):', 'context-line'));
    const lines = ['+ resources:'];
    for (const item of plan.resources) {
      lines.push(`+   - id: ${JSON.stringify(item.id)}`);
      Object.entries(item.parameters).forEach(([key, value]) => lines.push(`+     ${key}: ${JSON.stringify(value)}`));
    }
    const preview = element('pre', 'configuration-preview', lines.join('\n'));
    preview.setAttribute('aria-label', 'Illustrative configuration additions');
    output.append(preview);
  }

  function render(focusId) {
    const scroll = output.scrollTop;
    const plan = model.buildPlan(draft);
    const shell = element('p', 'line');
    shell.append(element('span', 'shell-prompt', '> '), element('span', 'shell-path', 'developer:~/my-azd-project'),
      document.createTextNode('$ azd add'));
    output.replaceChildren(shell, line('Existing project: web (Azure Container Apps)', 'context-line'));
    if (stage !== 'select') output.append(line(`? Resources to add: ${plan.resources.map((item) => item.type).join(', ')}`));
    if (stage === 'select') renderSelection();
    else if (stage === 'configure') renderConfiguration();
    else if (stage === 'review') renderReview(plan);
    else {
      output.append(line('? Approve this resource plan? Yes', 'answer'));
      output.append(line('SIMULATION COMPLETE: resource plan accepted.', 'success'));
      output.append(line('No project files were written. No Azure resources were provisioned.'));
      output.append(line('Next in the reference flow: azd infra gen, then azd provision.', 'context-line'));
    }
    output.scrollTop = scroll;
    updateControls();
    const defaultId = stage === 'select' ? 'hybrid-filter'
      : stage === 'configure' ? fieldId(plan.resources[0].id, model.catalog.find((item) => item.id === plan.resources[0].id).fields[0].key)
      : stage === 'review' ? 'hybrid-next' : 'hybrid-back';
    document.getElementById(focusId || defaultId).focus({ preventScroll: true });
  }

  function navigate(target) {
    stage = target;
    showErrors = false;
    draft.approved = false;
    output.scrollTop = 0;
    render();
  }

  function advance() {
    const plan = model.buildPlan(draft);
    if (stage === 'select') {
      if (!plan.resources.length) {
        selectionError = 'Select at least one resource to continue.';
        render();
        return;
      }
      navigate(draft.entry === 'goal' && plan.status === 'ready' ? 'review' : 'configure');
    } else if (stage === 'configure' || stage === 'review') {
      if (plan.status !== 'ready') {
        showFieldErrors(plan.unresolvedFields);
        return;
      }
      if (stage === 'configure') navigate('review');
      else {
        const result = model.acceptPlan(draft);
        if (!result.ok) {
          showFieldErrors(result.errors);
          return;
        }
        stage = 'done';
        output.scrollTop = 0;
        render();
      }
    }
  }

  function showFieldErrors(errors) {
    const first = errors[0];
    if (!first.resourceId) {
      stage = 'select';
      selectionError = first.message;
      render();
      return;
    }
    stage = 'configure';
    showErrors = true;
    render(fieldId(first.resourceId, first.field));
  }

  function back() {
    if (stage === 'select') return;
    navigate(stage === 'done' ? 'review' : stage === 'review' ? 'configure' : 'select');
  }

  document.querySelector('.terminal').addEventListener('keydown', (event) => {
    if (event.isComposing || event.ctrlKey || event.metaKey || event.altKey) return;
    const isInput = event.target instanceof HTMLInputElement;
    if (event.key === 'Escape') {
      event.preventDefault();
      if (stage === 'select' && filter) {
        filter = '';
        activeIndex = 0;
        render('hybrid-filter');
      } else if (stage === 'select') document.getElementById('hybrid-filter').focus();
      else back();
      return;
    }
    if (stage === 'configure' && isInput && event.key === 'Enter') {
      event.preventDefault();
      advance();
      return;
    }
    if (stage !== 'select') return;
    if (event.target.id === 'hybrid-filter' && ['ArrowDown', 'ArrowUp'].includes(event.key)) {
      event.preventDefault();
      activeIndex = event.key === 'ArrowDown' ? 0 : visibleResources().length - 1;
      focusResource();
    } else if (event.target.id === 'hybrid-filter' && event.key === 'Enter') {
      event.preventDefault();
      advance();
    } else if (!isInput && event.key === '/') {
      event.preventDefault();
      document.getElementById('hybrid-filter').focus();
    } else if (event.target.getAttribute('role') === 'checkbox') {
      const visible = visibleResources();
      const current = visible.findIndex((item) => resourceId(item.id) === event.target.id);
      if (['ArrowDown', 'ArrowUp'].includes(event.key)) {
        event.preventDefault();
        activeIndex = (current + (event.key === 'ArrowDown' ? 1 : -1) + visible.length) % visible.length;
        focusResource();
      } else if (event.key === ' ') {
        event.preventDefault();
        event.target.click();
      } else if (event.key === 'Enter') {
        event.preventDefault();
        advance();
      }
    }
  });

  nextButton.addEventListener('click', advance);
  backButton.addEventListener('click', back);
  document.getElementById('agent-toggle').addEventListener('click', () => {
    showAgent = !showAgent;
    updateAgent();
  });
  document.getElementById('hybrid-restart').addEventListener('click', () => {
    draft = model.createDraft();
    stage = 'select';
    filter = '';
    goalInput = '';
    activeIndex = 0;
    showErrors = false;
    goalError = '';
    selectionError = '';
    suggestionStatus = '';
    showAgent = false;
    output.scrollTop = 0;
    render();
  });
  for (const [id, goal] of [
    ['goal-chat', 'Add AI chat and file uploads to my app'],
    ['goal-orders', 'Process orders with a document database and a queue']
  ]) {
    document.getElementById(id).addEventListener('click', () => {
      goalInput = goal;
      requestSuggestions();
    });
  }
  render();
})();
