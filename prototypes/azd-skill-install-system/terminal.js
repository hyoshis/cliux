(function () {
  'use strict';

  let promptId = 0;

  function node(tag, text, className) {
    const result = document.createElement(tag);
    if (text !== undefined) result.textContent = text;
    if (className) result.className = className;
    return result;
  }

  function promptMessage(message) {
    const text = message.trimEnd();
    return /[?:.!;]$/.test(text) ? `${text} ` : `${text}: `;
  }

  class AzdTerminal {
    constructor(screen, transcript, interaction, onCancel) {
      this.screen = screen;
      this.transcript = transcript;
      this.interaction = interaction;
      this.onCancel = onCancel;
      this.active = null;
      this.lastCommand = '';
      screen.addEventListener('click', (event) => {
        if (!window.getSelection().toString() && !event.target.closest('a')) this.focus();
      });
    }

    scroll() {
      this.screen.scrollTop = this.screen.scrollHeight;
    }

    line(text, kind) {
      this.transcript.append(node('div', text, `terminal-line${kind ? ` ${kind}` : ''}`));
      this.scroll();
    }

    field(label, value) {
      this.line(`  ${label.padEnd(12)} ${value}`);
    }

    clear() {
      this.active = null;
      this.interaction.replaceChildren();
    }

    focus() {
      if (this.active) this.active.input.focus({ preventScroll: true });
    }

    answer(message, value) {
      const row = node('div', undefined, 'terminal-line');
      row.append(node('span', '? ', 'azd-question'), node('strong', promptMessage(message)),
        node('span', value, 'azd-answer'));
      this.transcript.append(row);
      this.scroll();
    }

    createPrompt(message, type, hint) {
      this.clear();
      const id = `azd-prompt-${++promptId}`;
      const form = node('form', undefined, `azd-prompt azd-${type}`);
      const row = node('div', undefined, 'azd-input-row');
      const label = node('label');
      label.htmlFor = id;
      if (type === 'command') label.textContent = `${message} `;
      else label.append(node('span', '? ', 'azd-question'), node('strong', promptMessage(message)));
      row.append(label);
      const input = node('input', undefined, 'azd-terminal-input');
      input.id = id;
      input.type = 'text';
      input.autocomplete = 'off';
      input.spellcheck = false;
      input.setAttribute('autocapitalize', 'off');
      input.setAttribute('aria-label', type === 'command' ? 'Terminal command' : message);
      const error = node('div', undefined, 'azd-validation');
      error.id = `${id}-error`;
      error.setAttribute('role', 'status');
      const instructions = node('div', hint, 'azd-key-hint');
      instructions.id = `${id}-hint`;
      input.setAttribute('aria-describedby', `${instructions.id} ${error.id}`);
      form.append(row);
      this.interaction.append(form);
      const prompt = { id, form, row, label, input, error, instructions, type, message };
      this.active = prompt;
      input.addEventListener('keydown', (event) => {
        if (event.isComposing) return;
        if (event.key === 'Escape' || (event.ctrlKey && event.key.toLowerCase() === 'c')) {
          event.preventDefault();
          this.line(type === 'command' ? `${message} ${input.value} ^C` : `? ${promptMessage(message)}^C`, 'muted');
          this.clear();
          this.onCancel();
          this.focus();
        }
      });
      form.addEventListener('submit', (event) => {
        event.preventDefault();
        if (this.active === prompt) prompt.submit();
      });
      return prompt;
    }

    select(message, options, onSelect, selected = 0) {
      if (!options.length) throw new Error('A terminal selection needs at least one choice.');
      const prompt = this.createPrompt(message, 'select', 'Use arrows to move, type to filter, Enter to select, Ctrl+C to cancel');
      const answer = node('span', options[selected].label, 'azd-answer');
      prompt.row.append(answer);
      const filterRow = node('div', undefined, 'azd-filter-row');
      filterRow.append(node('span', '  Filter: ', 'azd-dim'), prompt.input);
      prompt.input.placeholder = 'Type to filter list';
      const list = node('div', undefined, 'azd-choice-list');
      list.id = `${prompt.id}-choices`;
      list.setAttribute('role', 'listbox');
      list.setAttribute('aria-label', message);
      prompt.input.setAttribute('role', 'combobox');
      prompt.input.setAttribute('aria-autocomplete', 'list');
      prompt.input.setAttribute('aria-controls', list.id);
      prompt.input.setAttribute('aria-expanded', 'true');
      prompt.form.append(filterRow, list, prompt.error, prompt.instructions);
      let filtered = options;
      const render = () => {
        list.replaceChildren();
        filtered.forEach((option, index) => {
          const item = node('div', `  ${index === selected ? '>' : ' '} ${option.label}`, 'azd-choice');
          item.id = `${prompt.id}-choice-${index}`;
          item.setAttribute('role', 'option');
          item.setAttribute('aria-selected', String(index === selected));
          list.append(item);
        });
        if (filtered.length) {
          answer.textContent = filtered[selected].label;
          prompt.input.setAttribute('aria-activedescendant', `${prompt.id}-choice-${selected}`);
          prompt.input.removeAttribute('aria-invalid');
          prompt.error.textContent = '';
        } else {
          answer.textContent = '';
          prompt.input.removeAttribute('aria-activedescendant');
          prompt.input.setAttribute('aria-invalid', 'true');
          prompt.error.textContent = 'No options found matching the filter';
        }
        this.scroll();
      };
      prompt.input.addEventListener('input', () => {
        const filter = prompt.input.value.trim().toLowerCase();
        filtered = options.filter((option) => [option.label, option.value, ...(option.aliases || [])]
          .some((value) => String(value).toLowerCase().includes(filter)));
        selected = 0;
        render();
      });
      prompt.input.addEventListener('keydown', (event) => {
        if (event.isComposing || !['ArrowUp', 'ArrowDown'].includes(event.key)) return;
        event.preventDefault();
        if (!filtered.length) return;
        selected = (selected + (event.key === 'ArrowDown' ? 1 : -1) + filtered.length) % filtered.length;
        render();
      });
      prompt.submit = () => {
        if (!filtered.length) return;
        const choice = filtered[selected];
        this.clear();
        this.answer(message, choice.label);
        onSelect(choice.value);
        this.focus();
      };
      render();
    }

    confirm(message, onAnswer, defaultValue = false) {
      const prompt = this.createPrompt(message, 'confirm', 'Type y or n, then Enter. Ctrl+C cancels.');
      prompt.row.append(node('span', defaultValue ? '[Y/n] ' : '[y/N] ', 'azd-answer'), prompt.input);
      prompt.input.placeholder = defaultValue ? 'Yes' : 'No';
      prompt.form.append(prompt.error, prompt.instructions);
      prompt.submit = () => {
        const value = prompt.input.value.trim().toLowerCase();
        let answer;
        if (!value) answer = defaultValue;
        else if (['y', 'yes', 'true', '1'].includes(value)) answer = true;
        else if (['n', 'no', 'false', '0'].includes(value)) answer = false;
        else {
          prompt.input.setAttribute('aria-invalid', 'true');
          prompt.error.textContent = 'Enter a valid value (y/n).';
          this.scroll();
          return;
        }
        this.clear();
        this.answer(message, answer ? 'Yes' : 'No');
        onAnswer(answer);
        this.focus();
      };
      prompt.input.addEventListener('input', () => {
        prompt.input.removeAttribute('aria-invalid');
        prompt.error.textContent = '';
      });
      this.scroll();
    }

    command(prefix, onCommand, suggestion = '') {
      const prompt = this.createPrompt(prefix, 'command', 'Type a command and press Enter. This is a simulation, not a connected shell.');
      prompt.input.value = suggestion;
      prompt.row.append(prompt.input);
      prompt.form.append(prompt.error);
      prompt.input.setAttribute('aria-describedby', 'terminal-help');
      prompt.submit = () => {
        const command = prompt.input.value.trim();
        if (!command) return;
        this.lastCommand = command;
        this.clear();
        this.line(`${prefix} ${command}`, 'command');
        onCommand(command);
        this.focus();
      };
      prompt.input.addEventListener('keydown', (event) => {
        if (event.key === 'ArrowUp') {
          event.preventDefault();
          prompt.input.value = this.lastCommand;
        }
      });
      this.scroll();
    }

    sendKey(key) {
      if (!this.active) return;
      const input = this.active.input;
      this.focus();
      if (key === 'y' || key === 'n') {
        input.value = key;
        input.dispatchEvent(new Event('input', { bubbles: true }));
      } else {
        input.dispatchEvent(new KeyboardEvent('keydown', {
          key: key === 'Control+c' ? 'c' : key,
          ctrlKey: key === 'Control+c', bubbles: true, cancelable: true,
        }));
        if (key === 'Enter' && this.active && this.active.input === input) this.active.submit();
      }
    }
  }

  window.AzdTerminal = AzdTerminal;
})();
