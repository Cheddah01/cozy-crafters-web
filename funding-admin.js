(() => {
  'use strict';

  const API = 'https://cozy-archive.colbysthickey.workers.dev';
  const sessionKey = 'cozyArchiveSession';
  const form = document.querySelector('[data-funding-admin-form]');
  if (!form) return;

  const enabledInput = form.querySelector('[data-funding-enabled]');
  const titleInput = form.querySelector('[data-funding-title-input]');
  const descriptionInput = form.querySelector('[data-funding-description-input]');
  const currentInput = form.querySelector('[data-funding-current-input]');
  const targetInput = form.querySelector('[data-funding-target-input]');
  const currencyInput = form.querySelector('[data-funding-currency-input]');
  const urlInput = form.querySelector('[data-funding-url-input]');
  const saveButton = form.querySelector('[data-funding-save]');
  const status = form.querySelector('[data-funding-admin-status]');
  const controls = Array.from(form.querySelectorAll('input, textarea, select, button'));

  let activeRequest = null;
  let loaded = false;

  const readSession = () => {
    try {
      return sessionStorage.getItem(sessionKey);
    } catch (error) {
      return null;
    }
  };

  const safeJson = async (response) => {
    try {
      return await response.json();
    } catch (error) {
      return null;
    }
  };

  const setStatus = (message = '', state = '') => {
    if (!status) return;
    status.textContent = message;
    if (state) status.dataset.state = state;
    else delete status.dataset.state;
  };

  const setBusy = (busy, label = 'Save Funding Goal') => {
    form.setAttribute('aria-busy', String(busy));
    controls.forEach((control) => {
      control.disabled = busy;
    });
    if (saveButton) saveButton.textContent = busy ? label : 'Save Funding Goal';
  };

  const cancelRequest = () => {
    if (!activeRequest) return;
    window.clearTimeout(activeRequest.timeout);
    activeRequest.controller.abort();
    activeRequest = null;
  };

  const handleAccessError = (response) => {
    if (response.status === 401) {
      document.dispatchEvent(new CustomEvent('cozy-admin-session-expired'));
      return true;
    }
    if (response.status === 403) {
      document.dispatchEvent(new CustomEvent('cozy-admin-access-denied'));
      return true;
    }
    return false;
  };

  const normalizeGoal = (payload) => {
    const goal = payload && payload.goal;
    if (!goal || typeof goal !== 'object') return null;
    const currentAmount = Number(goal.currentAmount);
    const targetAmount = Number(goal.targetAmount);
    if (typeof goal.enabled !== 'boolean') return null;
    if (typeof goal.title !== 'string' || typeof goal.description !== 'string') return null;
    if (!Number.isFinite(currentAmount) || currentAmount < 0) return null;
    if (!Number.isFinite(targetAmount) || targetAmount <= 0) return null;
    if (typeof goal.currency !== 'string' || typeof goal.contributionUrl !== 'string') return null;
    return {
      enabled: goal.enabled,
      title: goal.title,
      description: goal.description,
      currentAmount,
      targetAmount,
      currency: goal.currency,
      contributionUrl: goal.contributionUrl
    };
  };

  const fillForm = (goal) => {
    enabledInput.checked = goal.enabled;
    titleInput.value = goal.title;
    descriptionInput.value = goal.description;
    currentInput.value = String(goal.currentAmount);
    targetInput.value = String(goal.targetAmount);
    currencyInput.value = goal.currency;
    urlInput.value = goal.contributionUrl;
  };

  const beginRequest = () => {
    cancelRequest();
    const controller = new AbortController();
    const request = {
      controller,
      timeout: window.setTimeout(() => controller.abort(), 10000)
    };
    activeRequest = request;
    return request;
  };

  const loadGoal = async ({ force = false } = {}) => {
    if ((loaded && !force) || activeRequest) return;
    const token = readSession();
    if (!token) {
      document.dispatchEvent(new CustomEvent('cozy-admin-session-expired'));
      return;
    }

    const request = beginRequest();
    setBusy(true, 'Loading…');
    setStatus('Loading the current funding goal…');

    try {
      const response = await fetch(`${API}/api/admin/funding-goal`, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${token}`
        },
        credentials: 'omit',
        cache: 'no-store',
        signal: request.controller.signal
      });
      const payload = await safeJson(response);
      if (activeRequest !== request || handleAccessError(response)) return;
      const goal = normalizeGoal(payload);
      if (!response.ok || !payload || payload.ok !== true || !goal) {
        setStatus((payload && payload.error) || 'The funding goal could not be loaded. Please try again.', 'error');
        return;
      }

      fillForm(goal);
      loaded = true;
      setStatus('Funding goal loaded.');
    } catch (error) {
      if (activeRequest !== request) return;
      setStatus('The funding goal could not be loaded. Please try again.', 'error');
    } finally {
      window.clearTimeout(request.timeout);
      if (activeRequest === request) activeRequest = null;
      setBusy(false);
    }
  };

  const formPayload = () => ({
    enabled: enabledInput.checked,
    title: titleInput.value.trim(),
    description: descriptionInput.value.trim(),
    currentAmount: Number(currentInput.value),
    targetAmount: Number(targetInput.value),
    currency: currencyInput.value,
    contributionUrl: urlInput.value.trim()
  });

  const saveGoal = async () => {
    if (activeRequest) return;
    if (!form.reportValidity()) {
      setStatus('Check the highlighted fields before saving.', 'error');
      return;
    }

    const token = readSession();
    if (!token) {
      document.dispatchEvent(new CustomEvent('cozy-admin-session-expired'));
      return;
    }

    const request = beginRequest();
    setBusy(true, 'Saving…');
    setStatus('Saving the funding goal…');

    try {
      const response = await fetch(`${API}/api/admin/funding-goal`, {
        method: 'PUT',
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        credentials: 'omit',
        body: JSON.stringify(formPayload()),
        signal: request.controller.signal
      });
      const payload = await safeJson(response);
      if (activeRequest !== request || handleAccessError(response)) return;
      const goal = normalizeGoal(payload);
      if (!response.ok || !payload || payload.ok !== true || !goal) {
        setStatus((payload && payload.error) || 'The funding goal could not be saved. Please try again.', 'error');
        return;
      }

      fillForm(goal);
      loaded = true;
      setStatus('Funding goal saved. The public site will update automatically.', 'success');
      document.dispatchEvent(new CustomEvent('cozy-funding-goal-updated', { detail: { goal } }));
    } catch (error) {
      if (activeRequest !== request) return;
      setStatus('The funding goal could not be saved. Please try again.', 'error');
    } finally {
      window.clearTimeout(request.timeout);
      if (activeRequest === request) activeRequest = null;
      setBusy(false);
    }
  };

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    saveGoal();
  });

  document.addEventListener('cozy-admin-tab-change', (event) => {
    if (event.detail && event.detail.tabName === 'funding' && event.detail.load !== false) {
      loadGoal();
    }
  });

  document.addEventListener('cozy-admin-funding-refresh', () => loadGoal({ force: true }));
  document.addEventListener('cozy-admin-leave', () => {
    cancelRequest();
    loaded = false;
    form.reset();
    setStatus();
    setBusy(false);
  });
  window.addEventListener('pagehide', cancelRequest, { once: true });
})();
