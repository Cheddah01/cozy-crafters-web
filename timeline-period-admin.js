(() => {
  'use strict';

  const API = 'https://cozy-archive.colbysthickey.workers.dev';
  const SESSION_KEY = 'cozyArchiveSession';
  const root = document.documentElement;
  const panel = document.querySelector('[data-admin-panel="timeline"]');
  const list = document.querySelector('[data-timeline-period-list]');
  const empty = document.querySelector('[data-timeline-period-empty]');
  const status = document.querySelector('[data-timeline-period-status]');
  const addButton = document.querySelector('[data-timeline-period-add]');
  const dialog = document.querySelector('#timeline-period-dialog');
  const dialogTitle = document.querySelector('[data-timeline-period-dialog-title]');
  const form = document.querySelector('[data-timeline-period-form]');
  const labelInput = document.querySelector('[data-timeline-period-label]');
  const startInput = document.querySelector('[data-timeline-period-start]');
  const endInput = document.querySelector('[data-timeline-period-end]');
  const colorInput = document.querySelector('[data-timeline-period-color]');
  const colorValue = document.querySelector('[data-timeline-period-color-value]');
  const preview = document.querySelector('[data-timeline-period-preview]');
  const previewLabel = document.querySelector('[data-timeline-period-preview-label]');
  const formStatus = document.querySelector('[data-timeline-period-form-status]');
  const closeButton = document.querySelector('[data-timeline-period-close]');
  const cancelButton = document.querySelector('[data-timeline-period-cancel]');
  const saveButton = document.querySelector('[data-timeline-period-save]');
  const deleteDialog = document.querySelector('#timeline-period-delete-dialog');
  const deleteContext = document.querySelector('[data-timeline-period-delete-context]');
  const deleteCancel = document.querySelector('[data-timeline-period-delete-cancel]');
  const deleteConfirm = document.querySelector('[data-timeline-period-delete-confirm]');

  if (!panel || !list || !empty || !addButton || !dialog || !form || !labelInput
    || !startInput || !endInput || !colorInput) return;

  const periods = new Map();
  let active = false;
  let loaded = false;
  let loadRequest = null;
  let mutationRequest = null;
  let editingId = null;
  let deletingId = null;

  const readSession = () => {
    try {
      return sessionStorage.getItem(SESSION_KEY);
    } catch (error) {
      return null;
    }
  };

  const validDate = (value) => {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const [year, month, day] = value.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    return date.getUTCFullYear() === year
      && date.getUTCMonth() === month - 1
      && date.getUTCDate() === day;
  };

  const reasonableText = (value, maximumLength) => {
    if (typeof value !== 'string') return '';
    const text = value.trim();
    return text && text.length <= maximumLength ? text : '';
  };

  const normalizePeriod = (value) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const id = Number(value.id);
    const label = reasonableText(value.label, 50);
    const startDate = value.startDate;
    const endDate = value.endDate;
    const color = typeof value.color === 'string' && /^#[0-9a-f]{6}$/i.test(value.color)
      ? value.color.toLowerCase()
      : '';
    if (!Number.isSafeInteger(id) || id <= 0 || !label || !validDate(startDate)
      || !validDate(endDate) || startDate > endDate || !color) return null;
    return Object.freeze({ id, label, startDate, endDate, color });
  };

  const safeJson = async (response) => {
    try {
      return await response.json();
    } catch (error) {
      return null;
    }
  };

  const backendError = (payload) => reasonableText(payload && payload.error, 300);

  const formatDate = (value) => {
    if (!validDate(value)) return value;
    const [year, month, day] = value.split('-').map(Number);
    return new Intl.DateTimeFormat('en', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      timeZone: 'UTC'
    }).format(new Date(Date.UTC(year, month - 1, day)));
  };

  const setStatus = (message = '', state = '') => {
    if (!status) return;
    status.textContent = message;
    if (state) status.dataset.state = state;
    else delete status.dataset.state;
  };

  const setFormStatus = (message = '', state = '') => {
    if (!formStatus) return;
    formStatus.textContent = message;
    if (state) formStatus.dataset.state = state;
    else delete formStatus.dataset.state;
  };

  const dispatchSessionProblem = (responseStatus) => {
    if (responseStatus === 401) {
      document.dispatchEvent(new CustomEvent('cozy-admin-session-expired'));
      return true;
    }
    if (responseStatus === 403) {
      document.dispatchEvent(new CustomEvent('cozy-admin-access-denied'));
      return true;
    }
    return false;
  };

  const sortedPeriods = () => Array.from(periods.values())
    .sort((a, b) => a.startDate.localeCompare(b.startDate) || a.id - b.id);

  const syncBusy = () => {
    const busy = Boolean(loadRequest || mutationRequest);
    list.setAttribute('aria-busy', String(Boolean(loadRequest)));
    addButton.disabled = busy;
    if (saveButton) saveButton.disabled = busy;
    list.querySelectorAll('button').forEach((button) => { button.disabled = busy; });
  };

  const createButton = (className, text, action, id) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = className;
    button.textContent = text;
    button.dataset[action] = '';
    button.dataset.timelinePeriodId = String(id);
    return button;
  };

  const render = () => {
    const rows = sortedPeriods().map((period) => {
      const row = document.createElement('div');
      const swatch = document.createElement('span');
      const copy = document.createElement('div');
      const name = document.createElement('strong');
      const dates = document.createElement('span');
      const color = document.createElement('span');
      const actions = document.createElement('div');
      const edit = createButton('timeline-period-admin-edit', 'Edit', 'timelinePeriodEdit', period.id);
      const remove = createButton('timeline-period-admin-delete', 'Delete', 'timelinePeriodDelete', period.id);

      row.className = 'timeline-period-admin-row';
      row.dataset.timelinePeriodId = String(period.id);
      swatch.className = 'timeline-period-admin-swatch';
      swatch.style.setProperty('--timeline-period-color', period.color);
      swatch.setAttribute('aria-hidden', 'true');
      copy.className = 'timeline-period-admin-copy';
      name.textContent = period.label;
      dates.textContent = `${formatDate(period.startDate)} – ${formatDate(period.endDate)}`;
      color.className = 'timeline-period-admin-color-value';
      color.textContent = period.color;
      actions.className = 'timeline-period-admin-actions';
      copy.append(name, dates);
      actions.append(edit, remove);
      row.append(swatch, copy, color, actions);
      return row;
    });
    list.replaceChildren(...rows);
    empty.hidden = rows.length !== 0 || Boolean(loadRequest);
    syncBusy();
  };

  const syncPreview = () => {
    const color = /^#[0-9a-f]{6}$/i.test(colorInput.value) ? colorInput.value : '#62bd47';
    const label = labelInput.value.trim().slice(0, 50) || 'Period name';
    if (colorValue) colorValue.textContent = color.toLowerCase();
    if (preview) preview.style.setProperty('--timeline-period-color', color);
    if (previewLabel) previewLabel.textContent = label;
  };

  const closeEditor = () => {
    editingId = null;
    setFormStatus();
    if (dialog.open) dialog.close();
  };

  const openEditor = (period = null) => {
    if (loadRequest || mutationRequest) return;
    editingId = period ? period.id : null;
    form.reset();
    labelInput.value = period ? period.label : '';
    startInput.value = period ? period.startDate : '';
    endInput.value = period ? period.endDate : '';
    colorInput.value = period ? period.color : '#62bd47';
    if (dialogTitle) dialogTitle.textContent = period ? 'Edit period' : 'Add period';
    if (saveButton) saveButton.textContent = period ? 'Save Changes' : 'Publish Period';
    setFormStatus();
    syncPreview();
    root.classList.add('modal-open');
    dialog.showModal();
    window.requestAnimationFrame(() => labelInput.focus());
  };

  const overlappingPeriod = (startDate, endDate) => sortedPeriods().find((period) => (
    period.id !== editingId && startDate <= period.endDate && endDate >= period.startDate
  ));

  const loadPeriods = async () => {
    const token = readSession();
    if (!token) {
      document.dispatchEvent(new CustomEvent('cozy-admin-session-expired'));
      return;
    }
    if (loadRequest) {
      window.clearTimeout(loadRequest.timeout);
      loadRequest.controller.abort();
    }
    const controller = new AbortController();
    const request = { controller, timeout: window.setTimeout(() => controller.abort(), 12000) };
    loadRequest = request;
    setStatus('Loading timeline periods…');
    syncBusy();

    try {
      const response = await fetch(`${API}/api/admin/timeline`, {
        headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
        credentials: 'omit',
        cache: 'no-store',
        signal: controller.signal
      });
      const payload = await safeJson(response);
      if (loadRequest !== request) return;
      if (dispatchSessionProblem(response.status)) return;
      if (!response.ok || !payload || payload.ok !== true) {
        setStatus(backendError(payload) || 'Timeline periods could not be loaded.', 'error');
        return;
      }
      const next = Array.isArray(payload.periods)
        ? payload.periods.map(normalizePeriod).filter(Boolean)
        : [];
      periods.clear();
      next.forEach((period) => periods.set(period.id, period));
      loaded = true;
      setStatus(next.length ? `${next.length} ${next.length === 1 ? 'period' : 'periods'} published.` : 'No periods published yet.');
      render();
    } catch (error) {
      if (loadRequest !== request) return;
      if (error.name !== 'AbortError') setStatus('Timeline periods could not be loaded.', 'error');
    } finally {
      window.clearTimeout(request.timeout);
      if (loadRequest === request) loadRequest = null;
      render();
    }
  };

  const savePeriod = async () => {
    if (loadRequest || mutationRequest) return;
    const label = labelInput.value.trim();
    const startDate = startInput.value;
    const endDate = endInput.value;
    const color = colorInput.value.toLowerCase();

    if (!label || label.length > 50) {
      labelInput.setCustomValidity('Enter a period name of 50 characters or fewer.');
      labelInput.reportValidity();
      labelInput.setCustomValidity('');
      return;
    }
    if (!validDate(startDate) || !validDate(endDate) || startDate > endDate) {
      setFormStatus('Choose a valid start and end date. The end cannot be before the start.', 'error');
      return;
    }
    if (!/^#[0-9a-f]{6}$/.test(color)) {
      setFormStatus('Choose a valid band color.', 'error');
      return;
    }
    const overlap = overlappingPeriod(startDate, endDate);
    if (overlap) {
      setFormStatus(`This overlaps “${overlap.label}”. Adjust one of the date ranges first.`, 'error');
      return;
    }

    const token = readSession();
    if (!token) {
      document.dispatchEvent(new CustomEvent('cozy-admin-session-expired'));
      return;
    }
    const creating = editingId === null;
    const id = editingId;
    const controller = new AbortController();
    const request = { controller, timeout: window.setTimeout(() => controller.abort(), 15000) };
    mutationRequest = request;
    setFormStatus(creating ? 'Publishing period…' : 'Saving period…');
    syncBusy();

    try {
      const response = await fetch(
        creating ? `${API}/api/admin/timeline/periods` : `${API}/api/admin/timeline/periods/${id}`,
        {
          method: creating ? 'POST' : 'PUT',
          headers: {
            Accept: 'application/json',
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          credentials: 'omit',
          body: JSON.stringify({ label, startDate, endDate, color }),
          signal: controller.signal
        }
      );
      const payload = await safeJson(response);
      if (mutationRequest !== request) return;
      if (dispatchSessionProblem(response.status)) return;
      if (!response.ok || !payload || payload.ok !== true) {
        setFormStatus(backendError(payload) || 'The timeline period could not be saved.', 'error');
        return;
      }
      const saved = normalizePeriod(payload.period);
      if (!saved) {
        setFormStatus('The period was saved, but its response was invalid. Refresh the page.', 'error');
        loaded = false;
        return;
      }
      periods.set(saved.id, saved);
      closeEditor();
      render();
      setStatus(creating ? 'Timeline period published.' : 'Timeline period updated.');
    } catch (error) {
      if (mutationRequest !== request) return;
      if (error.name !== 'AbortError') setFormStatus('The timeline period could not be saved.', 'error');
    } finally {
      window.clearTimeout(request.timeout);
      if (mutationRequest === request) mutationRequest = null;
      syncBusy();
    }
  };

  const closeDeleteDialog = () => {
    deletingId = null;
    if (deleteContext) deleteContext.textContent = '';
    if (deleteDialog && deleteDialog.open) deleteDialog.close();
  };

  const openDeleteDialog = (period) => {
    if (!deleteDialog || !deleteContext || mutationRequest) return;
    deletingId = period.id;
    deleteContext.textContent = `${period.label} · ${formatDate(period.startDate)} – ${formatDate(period.endDate)}`;
    root.classList.add('modal-open');
    deleteDialog.showModal();
  };

  const deletePeriod = async (id) => {
    const token = readSession();
    if (!token) {
      document.dispatchEvent(new CustomEvent('cozy-admin-session-expired'));
      return;
    }
    const controller = new AbortController();
    const request = { controller, timeout: window.setTimeout(() => controller.abort(), 15000) };
    mutationRequest = request;
    setStatus('Deleting timeline period…');
    syncBusy();
    try {
      const response = await fetch(`${API}/api/admin/timeline/periods/${id}`, {
        method: 'DELETE',
        headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
        credentials: 'omit',
        signal: controller.signal
      });
      const payload = await safeJson(response);
      if (mutationRequest !== request) return;
      if (dispatchSessionProblem(response.status)) return;
      if (response.status === 404 || (response.ok && payload && payload.ok === true)) {
        periods.delete(id);
        render();
        setStatus('Timeline period deleted.');
        return;
      }
      setStatus(backendError(payload) || 'The timeline period could not be deleted.', 'error');
    } catch (error) {
      if (mutationRequest !== request) return;
      if (error.name !== 'AbortError') setStatus('The timeline period could not be deleted.', 'error');
    } finally {
      window.clearTimeout(request.timeout);
      if (mutationRequest === request) mutationRequest = null;
      syncBusy();
    }
  };

  const clearState = () => {
    if (loadRequest) {
      window.clearTimeout(loadRequest.timeout);
      loadRequest.controller.abort();
      loadRequest = null;
    }
    if (mutationRequest) {
      window.clearTimeout(mutationRequest.timeout);
      mutationRequest.controller.abort();
      mutationRequest = null;
    }
    if (dialog.open) dialog.close();
    closeDeleteDialog();
    periods.clear();
    loaded = false;
    active = false;
    setStatus();
    render();
  };

  addButton.addEventListener('click', () => openEditor());
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    savePeriod();
  });
  labelInput.addEventListener('input', syncPreview);
  colorInput.addEventListener('input', syncPreview);
  if (closeButton) closeButton.addEventListener('click', closeEditor);
  if (cancelButton) cancelButton.addEventListener('click', closeEditor);
  dialog.addEventListener('cancel', (event) => {
    event.preventDefault();
    closeEditor();
  });
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) closeEditor();
  });
  dialog.addEventListener('close', () => {
    if (!document.querySelector('dialog[open]')) root.classList.remove('modal-open');
    if (active && !addButton.disabled) addButton.focus();
  });

  list.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-timeline-period-id]');
    if (!button || loadRequest || mutationRequest) return;
    const id = Number(button.dataset.timelinePeriodId);
    const period = periods.get(id);
    if (!period) return;
    if (button.hasAttribute('data-timeline-period-edit')) openEditor(period);
    if (button.hasAttribute('data-timeline-period-delete')) openDeleteDialog(period);
  });

  if (deleteDialog && deleteCancel && deleteConfirm) {
    deleteCancel.addEventListener('click', closeDeleteDialog);
    deleteConfirm.addEventListener('click', () => {
      const id = deletingId;
      closeDeleteDialog();
      if (id !== null) deletePeriod(id);
    });
    deleteDialog.addEventListener('cancel', (event) => {
      event.preventDefault();
      closeDeleteDialog();
    });
    deleteDialog.addEventListener('click', (event) => {
      if (event.target === deleteDialog) closeDeleteDialog();
    });
    deleteDialog.addEventListener('close', () => {
      if (!document.querySelector('dialog[open]')) root.classList.remove('modal-open');
    });
  }

  document.addEventListener('cozy-admin-tab-change', (event) => {
    active = event.detail && event.detail.tabName === 'timeline';
    if (active && !loaded && !loadRequest) loadPeriods();
  });
  document.addEventListener('cozy-admin-timeline-refresh', () => {
    if (active) loadPeriods();
  });
  document.addEventListener('cozy-admin-leave', clearState);
  window.addEventListener('pagehide', clearState, { once: true });

  syncPreview();
  render();
})();
