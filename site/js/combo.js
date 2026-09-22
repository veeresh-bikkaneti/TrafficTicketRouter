// combo.js — dependency-free accessible typeahead combobox.
// Enhances a native <select>: the select stays in the DOM (visually hidden)
// as the source of truth for value, options, and 'change' events, so existing
// page logic (population, race guards, wizard flow) is untouched. The visible
// <input> adds type-to-filter with full keyboard support and ARIA combobox
// semantics. No network, no storage, no PII — everything stays in the page.

export function enhanceSelect(select) {
  const doc = select.ownerDocument;
  const base = select.id || 'combo';
  const inputId = `${base}-input`;
  const listId = `${base}-listbox`;

  // Wrap: <div class="combo"><input><ul role=listbox></ul><select hidden></div>
  const wrap = doc.createElement('div');
  wrap.className = 'combo';
  select.parentNode.insertBefore(wrap, select);
  wrap.appendChild(select);

  const input = doc.createElement('input');
  input.type = 'text';
  input.id = inputId;
  input.className = 'combo-input';
  input.setAttribute('role', 'combobox');
  input.setAttribute('aria-expanded', 'false');
  input.setAttribute('aria-autocomplete', 'list');
  input.setAttribute('aria-controls', listId);
  input.setAttribute('autocomplete', 'off');
  input.setAttribute('autocapitalize', 'off');
  input.setAttribute('spellcheck', 'false');
  const describedBy = select.getAttribute('aria-describedby');
  if (describedBy) {
    input.setAttribute('aria-describedby', describedBy);
    select.removeAttribute('aria-describedby');
  }
  wrap.insertBefore(input, select);

  const list = doc.createElement('ul');
  list.id = listId;
  list.className = 'combo-list';
  list.setAttribute('role', 'listbox');
  list.hidden = true;
  wrap.appendChild(list);

  // The select is now a data mirror only: not focusable, not announced.
  select.hidden = true;
  select.tabIndex = -1;
  select.setAttribute('aria-hidden', 'true');

  // Point the visible <label> at the input instead of the hidden select.
  const label = select.id ? doc.querySelector(`label[for="${select.id}"]`) : null;
  if (label) label.htmlFor = inputId;

  // ---- option model, read lazily from the select so repopulation just works ----
  const readOptions = () => {
    const out = [];
    for (const o of select.options) {
      if (o.value === '' || o.disabled) continue; // value="" is the placeholder
      out.push({ value: o.value, label: o.textContent });
    }
    return out;
  };
  const readPlaceholder = () => {
    const ph = select.querySelector('option[value=""]');
    return ph ? ph.textContent : input.placeholder;
  };

  let filtered = [];
  let activeIndex = -1;

  function syncInputToSelect() {
    const sel = select.selectedOptions && select.selectedOptions[0];
    input.value = sel && sel.value !== '' ? sel.textContent : '';
    input.placeholder = readPlaceholder();
  }

  function setActive(i) {
    activeIndex = i;
    const items = list.querySelectorAll('.combo-option');
    items.forEach((el, idx) => el.classList.toggle('active', idx === i));
    if (i >= 0 && items[i]) {
      input.setAttribute('aria-activedescendant', items[i].id);
      items[i].scrollIntoView({ block: 'nearest' });
    } else {
      input.removeAttribute('aria-activedescendant');
    }
  }

  function renderList(autoFirst) {
    list.textContent = '';
    if (filtered.length === 0) {
      const li = doc.createElement('li');
      li.className = 'combo-empty';
      li.setAttribute('aria-disabled', 'true');
      li.textContent = 'No matches — try a different spelling.';
      list.appendChild(li);
    } else {
      filtered.forEach((o, i) => {
        const li = doc.createElement('li');
        li.className = 'combo-option';
        li.id = `${listId}-opt-${i}`;
        li.setAttribute('role', 'option');
        li.setAttribute('aria-selected', o.value === select.value ? 'true' : 'false');
        li.textContent = o.label;
        li.addEventListener('mousedown', (e) => {
          // mousedown fires before blur: select now, and keep focus on the input.
          e.preventDefault();
          choose(i);
        });
        list.appendChild(li);
      });
    }
    // When the user typed a query, highlight the top match so Enter picks it
    // (standard typeahead behavior). On plain focus-open there is no active
    // option, so Enter can't accidentally pick the first item in the list.
    if (autoFirst && filtered.length > 0) {
      setActive(0);
      return;
    }
    // Otherwise preselect the already-chosen option when it is visible.
    const selIdx = filtered.findIndex((o) => o.value === select.value);
    setActive(selIdx);
  }

  function open(fullList) {
    const q = fullList ? '' : input.value;
    const query = q.trim().toLowerCase();
    filtered = readOptions().filter((o) => o.label.toLowerCase().includes(query));
    renderList(!fullList && query !== '');
    list.hidden = false;
    input.setAttribute('aria-expanded', 'true');
  }

  function close() {
    list.hidden = true;
    input.setAttribute('aria-expanded', 'false');
    input.removeAttribute('aria-activedescendant');
    activeIndex = -1;
  }

  const isOpen = () => !list.hidden;

  function commit(value) {
    select.value = value;
    syncInputToSelect();
    close();
    // Existing page logic listens for 'change' on the select.
    select.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function choose(i) {
    const o = filtered[i];
    if (o) commit(o.value);
  }

  function revertInput() {
    // Restore the input text to the committed selection (or the placeholder).
    syncInputToSelect();
  }

  // ---- events ----
  input.addEventListener('focus', () => {
    open(true); // full list on focus; typing narrows it
    input.select();
  });

  input.addEventListener('input', () => {
    if (input.value === '' && select.value !== '') {
      // Cleared the text: same as re-picking the placeholder option.
      commit('');
      open(true);
      return;
    }
    open(false);
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!isOpen()) {
        open(true);
        return;
      }
      const dir = e.key === 'ArrowDown' ? 1 : -1;
      const next = activeIndex + dir;
      if (next >= 0 && next < filtered.length) setActive(next);
    } else if (e.key === 'Enter') {
      if (isOpen() && activeIndex >= 0) {
        e.preventDefault();
        choose(activeIndex);
      }
    } else if (e.key === 'Escape') {
      if (isOpen()) {
        e.preventDefault();
        revertInput();
        close();
      }
    }
  });

  input.addEventListener('blur', () => {
    // If the text doesn't match the committed selection, revert it —
    // a half-typed query is never submitted as a value.
    close();
    revertInput();
  });

  // Keep the combobox in sync when the page repopulates the select
  // (e.g. picking a state reloads the county list).
  const mo = new MutationObserver(() => {
    syncInputToSelect();
    if (isOpen()) open(false);
  });
  mo.observe(select, { childList: true });

  syncInputToSelect();
  return { input, select };
}
