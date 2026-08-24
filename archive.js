(() => {
  'use strict';

  const sessionKey = 'cozyArchiveSession';
  const meEndpoint = 'https://cozy-archive.colbysthickey.workers.dev/api/me';
  const authPanel = document.querySelector('[data-archive-auth]');
  const authViews = document.querySelectorAll('[data-auth-view]');
  const liveRegion = document.querySelector('[data-archive-auth-live]');
  const authNote = document.querySelector('[data-auth-note]');
  const displayName = document.querySelector('[data-archive-display-name]');
  const logoutButton = document.querySelector('[data-archive-logout]');
  const retryButton = document.querySelector('[data-archive-retry]');
  const rootEl = document.documentElement;
  const modeToggle = document.querySelector('.mode-toggle');
  const themeMeta = document.querySelector('meta[name="theme-color"]');
  let activeRequest = null;

  const syncTheme = () => {
    const night = rootEl.classList.contains('night');
    if (themeMeta) themeMeta.content = night ? '#142c52' : '#7cc4f5';
    if (modeToggle) modeToggle.setAttribute('aria-pressed', String(night));
  };

  if (modeToggle) {
    modeToggle.addEventListener('click', () => {
      rootEl.classList.toggle('night');
      try {
        localStorage.setItem('cc-theme', rootEl.classList.contains('night') ? 'night' : 'day');
      } catch (error) {}
      syncTheme();
    });
  }

  syncTheme();

  if (!authPanel) return;

  const readSession = () => {
    try {
      return sessionStorage.getItem(sessionKey);
    } catch (error) {
      return null;
    }
  };

  const removeSession = () => {
    try {
      sessionStorage.removeItem(sessionKey);
    } catch (error) {}
  };

  const setAuthState = (state, message = '') => {
    authViews.forEach((view) => {
      view.hidden = view.dataset.authView !== state;
    });
    authPanel.dataset.authState = state;
    authPanel.setAttribute('aria-busy', String(state === 'checking'));
    if (authNote) authNote.textContent = state === 'logged-out' ? message : '';
    if (liveRegion) liveRegion.textContent = message;
  };

  const getSafeDisplayName = (payload) => {
    if (!payload || payload.authenticated !== true || !payload.user || typeof payload.user !== 'object') {
      return null;
    }

    const candidate = typeof payload.user.displayName === 'string' && payload.user.displayName.trim()
      ? payload.user.displayName.trim()
      : typeof payload.user.username === 'string'
        ? payload.user.username.trim()
        : '';

    return candidate ? candidate.slice(0, 80) : null;
  };

  const verifyStoredSession = async () => {
    const token = readSession();
    if (!token) {
      setAuthState('logged-out');
      return;
    }

    if (activeRequest) activeRequest.abort();
    const controller = new AbortController();
    activeRequest = controller;
    const timeout = window.setTimeout(() => controller.abort(), 7000);
    setAuthState('checking', 'Checking your archive session.');

    try {
      const response = await fetch(meEndpoint, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${token}`
        },
        credentials: 'omit',
        cache: 'no-store',
        signal: controller.signal
      });

      if (activeRequest !== controller) return;

      if (response.status === 401) {
        removeSession();
        setAuthState('logged-out', 'Your archive session expired. Please sign in again.');
        return;
      }

      if (!response.ok) {
        setAuthState('unavailable', 'Archive login status is temporarily unavailable.');
        return;
      }

      const safeName = getSafeDisplayName(await response.json());
      if (!safeName) {
        setAuthState('unavailable', 'Archive login status is temporarily unavailable.');
        return;
      }

      displayName.textContent = safeName;
      setAuthState('logged-in', `Signed in as ${safeName}.`);
    } catch (error) {
      if (activeRequest !== controller) return;
      setAuthState('unavailable', 'Archive login status is temporarily unavailable.');
    } finally {
      window.clearTimeout(timeout);
      if (activeRequest === controller) activeRequest = null;
    }
  };

  if (logoutButton) {
    logoutButton.addEventListener('click', () => {
      if (activeRequest) {
        activeRequest.abort();
        activeRequest = null;
      }
      removeSession();
      displayName.textContent = '';
      setAuthState('logged-out', 'You have been logged out.');
    });
  }

  if (retryButton) retryButton.addEventListener('click', verifyStoredSession);

  verifyStoredSession();
})();
