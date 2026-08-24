(() => {
  'use strict';

  const ARCHIVE_API = 'https://cozy-archive.colbysthickey.workers.dev';
  const sessionKey = 'cozyArchiveSession';
  const rootEl = document.documentElement;
  const modeToggle = document.querySelector('.mode-toggle');
  const themeMeta = document.querySelector('meta[name="theme-color"]');
  const accessPanel = document.querySelector('[data-admin-access]');
  const authViews = document.querySelectorAll('[data-admin-auth-view]');
  const authLive = document.querySelector('[data-admin-auth-live]');
  const authRetryButton = document.querySelector('[data-admin-auth-retry]');
  const dashboard = document.querySelector('[data-admin-dashboard]');
  const displayName = document.querySelector('[data-admin-display-name]');
  const logoutButtons = document.querySelectorAll('[data-admin-logout]');
  const refreshButton = document.querySelector('[data-admin-refresh]');
  const refreshLabel = document.querySelector('[data-admin-refresh-label]');
  const pendingCount = document.querySelector('[data-admin-count]');
  const queue = document.querySelector('[data-admin-queue]');
  const emptyState = document.querySelector('[data-admin-empty]');
  const moreNote = document.querySelector('[data-admin-more]');
  const dashboardStatus = document.querySelector('[data-admin-status]');
  const rejectDialog = document.querySelector('#archive-reject-dialog');
  const rejectContext = document.querySelector('[data-reject-context]');
  const rejectCancelButton = document.querySelector('[data-reject-cancel]');
  const rejectConfirmButton = document.querySelector('[data-reject-confirm]');

  let activeAuthRequest = null;
  let activeQueueRequest = null;
  const activeImageRequests = new Map();
  const activeModerationRequests = new Map();
  const imageObjectUrls = new Map();
  const pendingUploads = new Map();
  let currentUser = null;
  let rejectingUploadId = null;

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
  if (!accessPanel || !dashboard || !queue) return;

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

  const safeJson = async (response) => {
    try {
      return await response.json();
    } catch (error) {
      return null;
    }
  };

  const reasonableText = (value, maximumLength = 300) => {
    if (typeof value !== 'string') return '';
    const text = value.trim();
    return text && text.length <= maximumLength ? text : '';
  };

  const backendError = (payload) => reasonableText(payload && payload.error);

  const setAuthState = (state, message = '') => {
    authViews.forEach((view) => {
      view.hidden = view.dataset.adminAuthView !== state;
    });
    accessPanel.dataset.authState = state;
    accessPanel.setAttribute('aria-busy', String(state === 'checking'));
    accessPanel.hidden = state === 'authorized';
    dashboard.hidden = state !== 'authorized';
    if (authLive) authLive.textContent = message;
  };

  const setDashboardStatus = (message = '', state = '') => {
    if (!dashboardStatus) return;
    dashboardStatus.textContent = message;
    if (state) dashboardStatus.dataset.state = state;
    else delete dashboardStatus.dataset.state;
  };

  const setRefreshBusy = (busy) => {
    if (refreshButton) refreshButton.disabled = busy || activeModerationRequests.size > 0;
    if (refreshLabel) refreshLabel.textContent = busy ? 'Refreshing…' : 'Refresh';
    queue.setAttribute('aria-busy', String(busy));
  };

  const revokeImageUrl = (id) => {
    const url = imageObjectUrls.get(id);
    if (!url) return;
    URL.revokeObjectURL(url);
    imageObjectUrls.delete(id);
  };

  const abortImageRequest = (id) => {
    const request = activeImageRequests.get(id);
    if (!request) return;
    window.clearTimeout(request.timeout);
    request.controller.abort();
    activeImageRequests.delete(id);
  };

  const abortAllImages = () => {
    Array.from(activeImageRequests.keys()).forEach(abortImageRequest);
  };

  const abortAllModeration = () => {
    activeModerationRequests.forEach((request) => {
      window.clearTimeout(request.timeout);
      request.controller.abort();
    });
    activeModerationRequests.clear();
  };

  const clearQueue = ({ abortModeration = true } = {}) => {
    if (activeQueueRequest) {
      window.clearTimeout(activeQueueRequest.timeout);
      activeQueueRequest.controller.abort();
      activeQueueRequest = null;
    }
    abortAllImages();
    if (abortModeration) abortAllModeration();
    imageObjectUrls.forEach((url) => URL.revokeObjectURL(url));
    imageObjectUrls.clear();
    pendingUploads.clear();
    queue.replaceChildren();
    if (pendingCount) pendingCount.textContent = 'Pending: 0';
    if (emptyState) emptyState.hidden = true;
    if (moreNote) moreNote.hidden = true;
    setRefreshBusy(false);
  };

  const closeRejectDialog = () => {
    rejectingUploadId = null;
    if (rejectContext) rejectContext.textContent = '';
    if (rejectDialog && rejectDialog.open) rejectDialog.close();
  };

  const leaveDashboard = () => {
    closeRejectDialog();
    clearQueue();
    currentUser = null;
    if (displayName) displayName.textContent = '';
    setDashboardStatus();
  };

  const expireSession = () => {
    removeSession();
    leaveDashboard();
    setAuthState('signed-out', 'Your archive session expired. Please sign in again.');
  };

  const denyAccess = (message = 'You do not have permission to access Archive moderation.') => {
    leaveDashboard();
    setAuthState('denied', message);
  };

  const getAuthenticatedUser = (payload) => {
    if (!payload || payload.authenticated !== true || !payload.user || typeof payload.user !== 'object') return null;
    const name = reasonableText(payload.user.displayName, 80)
      || reasonableText(payload.user.username, 80);
    if (!name) return null;
    return { displayName: name, isAdmin: payload.user.isAdmin === true };
  };

  const friendlyMimeType = (mimeType) => {
    if (mimeType === 'image/png') return 'PNG';
    if (mimeType === 'image/jpeg') return 'JPEG';
    if (mimeType === 'image/webp') return 'WebP';
    return 'Image';
  };

  const formatFileSize = (value) => {
    const bytes = Number(value);
    if (!Number.isFinite(bytes) || bytes < 0) return 'Size unavailable';
    if (bytes < 1024) return `${Math.round(bytes)} B`;
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatUploadDate = (value) => {
    const source = reasonableText(value, 80);
    if (!source) return 'Date unavailable';
    const sqliteMatch = source.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})(?:\.\d+)?$/);
    const normalized = sqliteMatch
      ? `${sqliteMatch[1]}-${sqliteMatch[2]}-${sqliteMatch[3]}T${sqliteMatch[4]}:${sqliteMatch[5]}:${sqliteMatch[6]}Z`
      : source;
    const date = new Date(normalized);
    if (Number.isNaN(date.getTime())) return 'Date unavailable';
    try {
      return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date);
    } catch (error) {
      return date.toLocaleString();
    }
  };

  const normalizeUpload = (value) => {
    if (!value || typeof value !== 'object') return null;
    const id = Number(value.id);
    if (!Number.isSafeInteger(id) || id <= 0) return null;
    const uploader = reasonableText(value.uploader, 80) || 'Unknown member';
    const caption = reasonableText(value.caption, 240);
    return {
      id,
      uploader,
      caption,
      mimeType: reasonableText(value.mimeType, 80),
      fileSize: value.fileSize,
      uploadedAt: value.uploadedAt
    };
  };

  const createTextElement = (tagName, className, text) => {
    const element = document.createElement(tagName);
    if (className) element.className = className;
    element.textContent = text;
    return element;
  };

  const updateQueueSummary = () => {
    const count = pendingUploads.size;
    if (pendingCount) pendingCount.textContent = `Pending: ${count}`;
    if (emptyState) emptyState.hidden = count !== 0;
  };

  const showImageUnavailable = (card) => {
    const loading = card.querySelector('[data-image-loading]');
    const image = card.querySelector('[data-admin-image]');
    const unavailable = card.querySelector('[data-image-unavailable]');
    if (loading) loading.hidden = true;
    if (image) {
      image.hidden = true;
      image.removeAttribute('src');
    }
    if (unavailable) unavailable.hidden = false;
  };

  const loadPrivateImage = async (upload, card) => {
    if (activeImageRequests.has(upload.id)) return;
    const token = readSession();
    if (!token) {
      expireSession();
      return;
    }

    const controller = new AbortController();
    const request = {
      controller,
      timeout: window.setTimeout(() => controller.abort(), 15000)
    };
    activeImageRequests.set(upload.id, request);

    try {
      const response = await fetch(`${ARCHIVE_API}/api/admin/uploads/${upload.id}/image`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` },
        credentials: 'omit',
        cache: 'no-store',
        signal: controller.signal
      });

      if (activeImageRequests.get(upload.id) !== request || !card.isConnected) return;
      if (response.status === 401) {
        expireSession();
        return;
      }
      if (response.status === 403) {
        denyAccess();
        return;
      }
      if (!response.ok) {
        showImageUnavailable(card);
        return;
      }

      const blob = await response.blob();
      if (activeImageRequests.get(upload.id) !== request || !card.isConnected) return;
      if (!blob.size) {
        showImageUnavailable(card);
        return;
      }

      const objectUrl = URL.createObjectURL(blob);
      imageObjectUrls.set(upload.id, objectUrl);
      const image = card.querySelector('[data-admin-image]');
      const loading = card.querySelector('[data-image-loading]');
      const unavailable = card.querySelector('[data-image-unavailable]');
      image.addEventListener('load', () => {
        if (loading) loading.hidden = true;
        if (unavailable) unavailable.hidden = true;
        image.hidden = false;
      }, { once: true });
      image.addEventListener('error', () => {
        revokeImageUrl(upload.id);
        showImageUnavailable(card);
      }, { once: true });
      image.src = objectUrl;
    } catch (error) {
      if (activeImageRequests.get(upload.id) === request && error.name !== 'AbortError') {
        showImageUnavailable(card);
      }
    } finally {
      window.clearTimeout(request.timeout);
      if (activeImageRequests.get(upload.id) === request) activeImageRequests.delete(upload.id);
    }
  };

  const setCardBusy = (card, action = '') => {
    const approveButton = card.querySelector('[data-approve]');
    const rejectButton = card.querySelector('[data-reject]');
    const cardStatus = card.querySelector('[data-card-status]');
    const busy = Boolean(action);
    card.setAttribute('aria-busy', String(busy));
    approveButton.disabled = busy;
    rejectButton.disabled = busy;
    approveButton.textContent = action === 'approve' ? 'Approving…' : 'Approve';
    rejectButton.textContent = action === 'reject' ? 'Rejecting…' : 'Reject';
    if (cardStatus) cardStatus.textContent = action === 'approve'
      ? 'Approving screenshot…'
      : action === 'reject'
        ? 'Rejecting screenshot…'
        : '';
  };

  const removePendingCard = (id, message) => {
    abortImageRequest(id);
    revokeImageUrl(id);
    const card = queue.querySelector(`[data-upload-id="${id}"]`);
    if (card) card.remove();
    pendingUploads.delete(id);
    updateQueueSummary();
    setDashboardStatus(message, 'success');
  };

  const moderationErrorMessage = (status, payload) => {
    const provided = backendError(payload);
    if (provided) return provided;
    if (status === 500 || status === 503) return 'Archive moderation is temporarily unavailable. Please try again.';
    return 'The moderation action could not be completed. Please try again.';
  };

  const moderateUpload = async (id, action) => {
    if (activeModerationRequests.has(id)) return;
    const upload = pendingUploads.get(id);
    const card = queue.querySelector(`[data-upload-id="${id}"]`);
    if (!upload || !card) return;
    const token = readSession();
    if (!token) {
      expireSession();
      return;
    }

    const controller = new AbortController();
    const request = {
      controller,
      timeout: window.setTimeout(() => controller.abort(), 15000)
    };
    activeModerationRequests.set(id, request);
    setCardBusy(card, action);
    setRefreshBusy(false);
    setDashboardStatus();

    try {
      const response = await fetch(`${ARCHIVE_API}/api/admin/uploads/${id}/${action}`, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${token}`
        },
        credentials: 'omit',
        signal: controller.signal
      });
      const payload = await safeJson(response);
      if (activeModerationRequests.get(id) !== request) return;

      if (response.status === 401) {
        expireSession();
        return;
      }
      if (response.status === 403) {
        denyAccess();
        return;
      }
      if (response.status === 404) {
        removePendingCard(id, 'This screenshot is no longer waiting for review.');
        return;
      }
      if (response.status === 409) {
        removePendingCard(id, 'This screenshot was already reviewed. The queue has been updated.');
        return;
      }
      if (response.ok && payload && payload.ok === true) {
        removePendingCard(
          id,
          action === 'approve'
            ? 'Screenshot approved and removed from the pending queue.'
            : 'Screenshot rejected and removed from storage.'
        );
        return;
      }

      setCardBusy(card);
      const message = moderationErrorMessage(response.status, payload);
      const cardStatus = card.querySelector('[data-card-status]');
      if (cardStatus) cardStatus.textContent = message;
      setDashboardStatus(message, 'error');
    } catch (error) {
      if (activeModerationRequests.get(id) !== request) return;
      setCardBusy(card);
      if (error.name !== 'AbortError') {
        const message = 'The moderation action could not be completed. Please try again.';
        const cardStatus = card.querySelector('[data-card-status]');
        if (cardStatus) cardStatus.textContent = message;
        setDashboardStatus(message, 'error');
      }
    } finally {
      window.clearTimeout(request.timeout);
      if (activeModerationRequests.get(id) === request) activeModerationRequests.delete(id);
      setRefreshBusy(Boolean(activeQueueRequest));
    }
  };

  const openRejectConfirmation = (upload, triggerButton) => {
    if (!rejectDialog || typeof rejectDialog.showModal !== 'function') return;
    rejectingUploadId = upload.id;
    rejectContext.textContent = upload.caption
      ? `“${upload.caption}” — submitted by ${upload.uploader}`
      : `Submitted by ${upload.uploader}`;
    rejectDialog.dataset.restoreUploadId = String(upload.id);
    rootEl.classList.add('modal-open');
    rejectDialog.showModal();
    window.requestAnimationFrame(() => rejectCancelButton.focus());
  };

  const createQueueCard = (upload) => {
    const card = document.createElement('article');
    card.className = 'archive-moderation-card section-card';
    card.dataset.uploadId = String(upload.id);

    const media = document.createElement('div');
    media.className = 'archive-moderation-media';
    const loading = createTextElement('div', 'archive-image-loading', 'Loading screenshot…');
    loading.dataset.imageLoading = '';
    loading.setAttribute('role', 'status');
    const image = document.createElement('img');
    image.dataset.adminImage = '';
    image.alt = `Screenshot submitted by ${upload.uploader}`;
    image.hidden = true;
    const unavailable = createTextElement('div', 'archive-image-unavailable', 'Screenshot preview unavailable.');
    unavailable.dataset.imageUnavailable = '';
    unavailable.hidden = true;
    media.append(loading, image, unavailable);

    const content = document.createElement('div');
    content.className = 'archive-moderation-content';
    content.append(createTextElement('p', 'eyebrow', 'Pending review'));
    const caption = createTextElement(
      'h3',
      upload.caption ? 'archive-moderation-caption' : 'archive-moderation-caption is-empty',
      upload.caption || 'No caption provided.'
    );
    content.append(caption);

    const uploader = createTextElement('p', 'archive-moderation-uploader', `Uploaded by ${upload.uploader}`);
    const metadata = document.createElement('dl');
    metadata.className = 'archive-moderation-meta';
    const addMeta = (label, value) => {
      const group = document.createElement('div');
      group.append(createTextElement('dt', '', label), createTextElement('dd', '', value));
      metadata.append(group);
    };
    addMeta('Submitted', formatUploadDate(upload.uploadedAt));
    addMeta('Image', `${formatFileSize(upload.fileSize)} · ${friendlyMimeType(upload.mimeType)}`);

    const cardStatus = createTextElement('p', 'archive-card-status', '');
    cardStatus.dataset.cardStatus = '';
    cardStatus.setAttribute('role', 'status');
    cardStatus.setAttribute('aria-live', 'polite');

    const actions = document.createElement('div');
    actions.className = 'archive-moderation-actions';
    const approveButton = createTextElement('button', 'button button-primary archive-approve-button', 'Approve');
    approveButton.type = 'button';
    approveButton.dataset.approve = '';
    approveButton.addEventListener('click', () => moderateUpload(upload.id, 'approve'));
    const rejectButton = createTextElement('button', 'archive-reject-button', 'Reject');
    rejectButton.type = 'button';
    rejectButton.dataset.reject = '';
    rejectButton.addEventListener('click', () => openRejectConfirmation(upload, rejectButton));
    actions.append(approveButton, rejectButton);

    content.append(uploader, metadata, cardStatus, actions);
    card.append(media, content);
    return card;
  };

  const replaceQueue = (uploads, hasMore) => {
    abortAllImages();
    imageObjectUrls.forEach((url) => URL.revokeObjectURL(url));
    imageObjectUrls.clear();
    pendingUploads.clear();
    queue.replaceChildren();

    const fragment = document.createDocumentFragment();
    uploads.forEach((upload) => {
      pendingUploads.set(upload.id, upload);
      fragment.append(createQueueCard(upload));
    });
    queue.append(fragment);
    if (moreNote) moreNote.hidden = hasMore !== true;
    updateQueueSummary();
    uploads.forEach((upload) => {
      const card = queue.querySelector(`[data-upload-id="${upload.id}"]`);
      if (card) loadPrivateImage(upload, card);
    });
  };

  const loadPendingQueue = async () => {
    if (activeQueueRequest || activeModerationRequests.size > 0 || !currentUser || currentUser.isAdmin !== true) return;
    const token = readSession();
    if (!token) {
      expireSession();
      return;
    }

    const controller = new AbortController();
    const request = {
      controller,
      timeout: window.setTimeout(() => controller.abort(), 10000)
    };
    activeQueueRequest = request;
    setRefreshBusy(true);
    setDashboardStatus('Loading pending screenshots…');

    try {
      const response = await fetch(`${ARCHIVE_API}/api/admin/pending`, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${token}`
        },
        credentials: 'omit',
        cache: 'no-store',
        signal: controller.signal
      });
      const payload = await safeJson(response);
      if (activeQueueRequest !== request) return;

      if (response.status === 401) {
        expireSession();
        return;
      }
      if (response.status === 403) {
        denyAccess();
        return;
      }
      if (!response.ok || !payload || payload.ok !== true || !Array.isArray(payload.uploads)) {
        const message = backendError(payload) || 'The pending queue could not be loaded. Please try again.';
        setDashboardStatus(message, 'error');
        return;
      }

      const uploads = payload.uploads.map(normalizeUpload).filter(Boolean);
      replaceQueue(uploads, payload.hasMore === true);
      setDashboardStatus(uploads.length
        ? `${uploads.length} screenshot${uploads.length === 1 ? '' : 's'} ready for review.`
        : 'No screenshots are waiting for review.');
    } catch (error) {
      if (activeQueueRequest !== request) return;
      if (error.name !== 'AbortError') {
        setDashboardStatus('The pending queue could not be loaded. Please try again.', 'error');
      }
    } finally {
      window.clearTimeout(request.timeout);
      if (activeQueueRequest === request) activeQueueRequest = null;
      setRefreshBusy(false);
    }
  };

  const verifySession = async () => {
    const token = readSession();
    if (!token) {
      leaveDashboard();
      setAuthState('signed-out');
      return;
    }

    if (activeAuthRequest) {
      window.clearTimeout(activeAuthRequest.timeout);
      activeAuthRequest.controller.abort();
    }
    const controller = new AbortController();
    const request = {
      controller,
      timeout: window.setTimeout(() => controller.abort(), 7000)
    };
    activeAuthRequest = request;
    setAuthState('checking', 'Checking moderation access.');

    try {
      const response = await fetch(`${ARCHIVE_API}/api/me`, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${token}`
        },
        credentials: 'omit',
        cache: 'no-store',
        signal: controller.signal
      });
      const payload = await safeJson(response);
      if (activeAuthRequest !== request) return;

      if (response.status === 401) {
        expireSession();
        return;
      }
      if (response.status === 403) {
        denyAccess();
        return;
      }
      if (!response.ok) {
        setAuthState('unavailable', 'Archive moderation is temporarily unavailable.');
        return;
      }

      const user = getAuthenticatedUser(payload);
      if (!user) {
        setAuthState('unavailable', 'Archive moderation is temporarily unavailable.');
        return;
      }
      if (!user.isAdmin) {
        denyAccess();
        return;
      }

      currentUser = user;
      if (displayName) displayName.textContent = user.displayName;
      setAuthState('authorized', `Authorized as ${user.displayName}.`);
      loadPendingQueue();
    } catch (error) {
      if (activeAuthRequest !== request) return;
      setAuthState('unavailable', 'Archive moderation is temporarily unavailable.');
    } finally {
      window.clearTimeout(request.timeout);
      if (activeAuthRequest === request) activeAuthRequest = null;
    }
  };

  const logout = () => {
    if (activeAuthRequest) {
      window.clearTimeout(activeAuthRequest.timeout);
      activeAuthRequest.controller.abort();
      activeAuthRequest = null;
    }
    removeSession();
    leaveDashboard();
    setAuthState('signed-out', 'You have been logged out.');
  };

  logoutButtons.forEach((button) => button.addEventListener('click', logout));
  if (authRetryButton) authRetryButton.addEventListener('click', verifySession);
  if (refreshButton) refreshButton.addEventListener('click', loadPendingQueue);

  if (rejectDialog && rejectCancelButton && rejectConfirmButton) {
    rejectCancelButton.addEventListener('click', closeRejectDialog);
    rejectConfirmButton.addEventListener('click', () => {
      const id = rejectingUploadId;
      closeRejectDialog();
      if (id !== null) moderateUpload(id, 'reject');
    });
    rejectDialog.addEventListener('cancel', (event) => {
      event.preventDefault();
      closeRejectDialog();
    });
    rejectDialog.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      closeRejectDialog();
    });
    rejectDialog.addEventListener('click', (event) => {
      if (event.target === rejectDialog) closeRejectDialog();
    });
    rejectDialog.addEventListener('close', () => {
      rootEl.classList.remove('modal-open');
      const id = Number(rejectDialog.dataset.restoreUploadId);
      delete rejectDialog.dataset.restoreUploadId;
      const button = queue.querySelector(`[data-upload-id="${id}"] [data-reject]`);
      if (button && !button.disabled) button.focus();
    });
  }

  window.addEventListener('pagehide', () => {
    if (activeAuthRequest) {
      window.clearTimeout(activeAuthRequest.timeout);
      activeAuthRequest.controller.abort();
    }
    clearQueue();
  }, { once: true });

  verifySession();
})();
