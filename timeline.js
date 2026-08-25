(() => {
  'use strict';

  const TIMELINE_API = 'https://cozy-archive.colbysthickey.workers.dev/api/timeline';
  const rootEl = document.documentElement;
  const modeToggle = document.querySelector('.mode-toggle');
  const themeMeta = document.querySelector('meta[name="theme-color"]');
  const board = document.querySelector('[data-timeline-board]');
  const loading = document.querySelector('[data-timeline-loading]');
  const empty = document.querySelector('[data-timeline-empty]');
  const errorState = document.querySelector('[data-timeline-error]');
  const retryButton = document.querySelector('[data-timeline-retry]');
  const explorer = document.querySelector('[data-timeline-explorer]');
  const scroller = document.querySelector('[data-timeline-scroller]');
  const track = document.querySelector('[data-timeline-track]');
  const controls = document.querySelector('[data-timeline-controls]');
  const previousButton = document.querySelector('[data-timeline-previous]');
  const nextButton = document.querySelector('[data-timeline-next]');
  const status = document.querySelector('[data-timeline-status]');

  let activeRequest = null;
  let events = [];
  let periods = [];
  let currentIndex = 0;
  let scrollFrame = null;
  let dragging = false;
  let pointerStart = 0;
  let scrollStart = 0;

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
  if (!board || !loading || !empty || !errorState || !explorer || !scroller || !track) return;

  const reasonableText = (value, maximumLength) => {
    if (typeof value !== 'string') return '';
    const text = value.trim();
    return text && text.length <= maximumLength ? text : '';
  };

  const validDate = (value) => {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const [year, month, day] = value.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    return date.getUTCFullYear() === year
      && date.getUTCMonth() === month - 1
      && date.getUTCDate() === day;
  };

  const safeImageUrl = (value, id) => {
    if (typeof value !== 'string' || !value || value.length > 1000) return '';
    try {
      const url = new URL(value, TIMELINE_API);
      if (url.origin !== new URL(TIMELINE_API).origin) return '';
      const expectedPath = `/api/timeline/events/${id}/image`;
      return url.pathname === expectedPath && !url.search && !url.hash ? url.href : '';
    } catch (error) {
      return '';
    }
  };

  const normalizeEvent = (value) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const id = Number(value.id);
    const title = reasonableText(value.title, 80);
    const description = typeof value.description === 'string'
      ? value.description.trim().slice(0, 280)
      : '';
    const eventDate = value.eventDate;
    if (!Number.isSafeInteger(id) || id <= 0 || !title || !validDate(eventDate)) return null;
    return Object.freeze({
      id,
      title,
      description,
      eventDate,
      imageUrl: safeImageUrl(value.imageUrl, id)
    });
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

  const dateParts = (value) => {
    const [year, month, day] = value.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    return {
      year: String(year),
      long: new Intl.DateTimeFormat('en', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        timeZone: 'UTC'
      }).format(date)
    };
  };

  const setStatus = (message = '') => {
    if (status) status.textContent = message;
  };

  const setView = (view) => {
    loading.hidden = view !== 'loading';
    empty.hidden = view !== 'empty';
    errorState.hidden = view !== 'error';
    explorer.hidden = view !== 'events';
    if (controls) controls.hidden = view !== 'events' || events.length < 2;
    board.setAttribute('aria-busy', String(view === 'loading'));
  };

  const createEventCard = (event, index) => {
    const article = document.createElement('article');
    const card = document.createElement('div');
    const year = document.createElement('span');
    const title = document.createElement('h3');
    const date = document.createElement('time');
    const description = document.createElement('p');
    const connector = document.createElement('div');
    const dot = document.createElement('span');
    const formatted = dateParts(event.eventDate);

    article.className = 'timeline-event';
    article.dataset.timelineIndex = String(index);
    article.setAttribute('aria-label', `${formatted.long}: ${event.title}`);
    card.className = 'timeline-event-card';

    if (event.imageUrl) {
      const media = document.createElement('div');
      const image = document.createElement('img');
      media.className = 'timeline-event-media';
      image.src = event.imageUrl;
      image.alt = '';
      image.loading = index >= events.length - 2 ? 'eager' : 'lazy';
      image.decoding = 'async';
      image.addEventListener('error', () => media.remove(), { once: true });
      media.append(image);
      card.append(media);
    }

    year.className = 'timeline-event-year';
    year.textContent = formatted.year;
    title.textContent = event.title;
    date.className = 'timeline-event-date';
    date.dateTime = event.eventDate;
    date.textContent = formatted.long;
    description.className = 'timeline-event-description';
    description.textContent = event.description || 'A moment from the Cozy Crafters story.';
    connector.className = 'timeline-connector';
    dot.className = 'timeline-dot';
    dot.setAttribute('aria-hidden', 'true');
    connector.append(dot);
    card.append(year, title, date, description);
    article.append(card, connector);
    return article;
  };

  const eventElements = () => Array.from(track.querySelectorAll('.timeline-event'));

  const dateValue = (value) => {
    const [year, month, day] = value.split('-').map(Number);
    return Date.UTC(year, month - 1, day);
  };

  const renderPeriodBands = () => {
    const previousLayer = track.querySelector('.timeline-period-layer');
    if (previousLayer) previousLayer.remove();
    track.classList.toggle('has-periods', Boolean(periods.length && events.length));
    if (!periods.length || !events.length) return;

    const elements = eventElements();
    if (!elements.length) return;

    const groupedAnchors = [];
    elements.forEach((element, index) => {
      const timestamp = dateValue(events[index].eventDate);
      const center = element.offsetLeft + element.offsetWidth / 2;
      const existing = groupedAnchors[groupedAnchors.length - 1];
      if (existing && existing.timestamp === timestamp) {
        existing.total += center;
        existing.count += 1;
        existing.center = existing.total / existing.count;
      } else {
        groupedAnchors.push({ timestamp, center, total: center, count: 1 });
      }
    });

    const firstElement = elements[0];
    const lastElement = elements[elements.length - 1];
    const leftEdge = firstElement.offsetLeft;
    const rightEdge = lastElement.offsetLeft + lastElement.offsetWidth;

    const coordinateForDate = (value) => {
      const timestamp = dateValue(value);
      if (groupedAnchors.length === 1) {
        const only = groupedAnchors[0];
        if (timestamp < only.timestamp) return leftEdge;
        if (timestamp > only.timestamp) return rightEdge;
        return only.center;
      }
      const first = groupedAnchors[0];
      const last = groupedAnchors[groupedAnchors.length - 1];
      if (timestamp < first.timestamp) return leftEdge;
      if (timestamp > last.timestamp) return rightEdge;
      if (timestamp === first.timestamp) return first.center;
      if (timestamp === last.timestamp) return last.center;

      for (let index = 1; index < groupedAnchors.length; index += 1) {
        const right = groupedAnchors[index];
        if (timestamp > right.timestamp) continue;
        const left = groupedAnchors[index - 1];
        const dateSpan = right.timestamp - left.timestamp;
        if (dateSpan <= 0) return left.center;
        const progress = (timestamp - left.timestamp) / dateSpan;
        return left.center + (right.center - left.center) * progress;
      }
      return rightEdge;
    };

    const layer = document.createElement('div');
    layer.className = 'timeline-period-layer';
    layer.setAttribute('aria-label', 'Timeline periods');

    periods.forEach((period) => {
      const band = document.createElement('div');
      const start = coordinateForDate(period.startDate);
      const end = coordinateForDate(period.endDate);
      const left = Math.min(start, end);
      const width = Math.max(18, Math.abs(end - start));
      band.className = 'timeline-period-band';
      band.style.left = `${left}px`;
      band.style.width = `${width}px`;
      band.style.setProperty('--timeline-period-color', period.color);
      band.textContent = period.label;
      band.title = `${period.label}: ${dateParts(period.startDate).long} – ${dateParts(period.endDate).long}`;
      layer.append(band);
    });

    track.append(layer);
  };

  const updateCurrentEvent = () => {
    const elements = eventElements();
    if (!elements.length) return;
    const scrollerCenter = scroller.scrollLeft + scroller.clientWidth / 2;
    let nearestIndex = 0;
    let nearestDistance = Number.POSITIVE_INFINITY;

    elements.forEach((element, index) => {
      const center = element.offsetLeft + element.offsetWidth / 2;
      const distance = Math.abs(center - scrollerCenter);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestIndex = index;
      }
    });

    currentIndex = nearestIndex;
    elements.forEach((element, index) => {
      if (index === nearestIndex) element.setAttribute('aria-current', 'true');
      else element.removeAttribute('aria-current');
    });
    if (previousButton) previousButton.disabled = nearestIndex === 0;
    if (nextButton) nextButton.disabled = nearestIndex === elements.length - 1;
  };

  const scheduleCurrentEventUpdate = () => {
    if (scrollFrame !== null) return;
    scrollFrame = window.requestAnimationFrame(() => {
      scrollFrame = null;
      updateCurrentEvent();
    });
  };

  const scrollToEvent = (index, behavior = 'smooth') => {
    const elements = eventElements();
    if (!elements.length) return;
    const safeIndex = Math.max(0, Math.min(elements.length - 1, index));
    const element = elements[safeIndex];
    const target = element.offsetLeft - (scroller.clientWidth - element.offsetWidth) / 2;
    if (behavior === 'auto') {
      const previousScrollBehavior = scroller.style.scrollBehavior;
      scroller.style.scrollBehavior = 'auto';
      scroller.scrollLeft = target;
      scroller.style.scrollBehavior = previousScrollBehavior;
      return;
    }
    scroller.scrollTo({ left: target, behavior: 'smooth' });
  };

  const renderEvents = () => {
    track.replaceChildren(...events.map(createEventCard));
    setView(events.length ? 'events' : 'empty');
    if (!events.length) {
      setStatus('No timeline events have been published yet.');
      return;
    }
    renderPeriodBands();
    const label = `${events.length} timeline ${events.length === 1 ? 'event' : 'events'} loaded.`;
    setStatus(label);
    const showNewest = () => {
      window.requestAnimationFrame(() => {
        scrollToEvent(events.length - 1, 'auto');
        updateCurrentEvent();
        setStatus(`${label} Showing the newest event.`);
      });
    };
    if (document.readyState === 'complete') showNewest();
    else window.addEventListener('load', showNewest, { once: true });
  };

  const loadTimeline = async () => {
    if (activeRequest) {
      window.clearTimeout(activeRequest.timeout);
      activeRequest.controller.abort();
    }

    setView('loading');
    setStatus('Loading timeline events…');
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 8000);
    activeRequest = { controller, timeout };

    try {
      const response = await fetch(TIMELINE_API, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        credentials: 'omit',
        cache: 'no-store',
        signal: controller.signal
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload || payload.ok !== true || !Array.isArray(payload.events)) {
        throw new Error('Invalid timeline response');
      }

      const normalized = payload.events.map(normalizeEvent).filter(Boolean);
      const seenIds = new Set();
      events = normalized
        .filter((event) => {
          if (seenIds.has(event.id)) return false;
          seenIds.add(event.id);
          return true;
        })
        .sort((a, b) => a.eventDate.localeCompare(b.eventDate) || a.id - b.id);
      const normalizedPeriods = Array.isArray(payload.periods)
        ? payload.periods.map(normalizePeriod).filter(Boolean)
        : [];
      const seenPeriodIds = new Set();
      periods = normalizedPeriods
        .filter((period) => {
          if (seenPeriodIds.has(period.id)) return false;
          seenPeriodIds.add(period.id);
          return true;
        })
        .sort((a, b) => a.startDate.localeCompare(b.startDate) || a.id - b.id);
      renderEvents();
    } catch (error) {
      if (controller.signal.aborted && activeRequest && activeRequest.controller !== controller) return;
      events = [];
      periods = [];
      track.replaceChildren();
      setView('error');
      setStatus('The timeline could not be loaded.');
    } finally {
      window.clearTimeout(timeout);
      if (activeRequest && activeRequest.controller === controller) activeRequest = null;
    }
  };

  if (previousButton) previousButton.addEventListener('click', () => scrollToEvent(currentIndex - 1));
  if (nextButton) nextButton.addEventListener('click', () => scrollToEvent(currentIndex + 1));
  if (retryButton) retryButton.addEventListener('click', loadTimeline);

  scroller.addEventListener('keydown', (event) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    scrollToEvent(currentIndex + (event.key === 'ArrowRight' ? 1 : -1));
  });

  scroller.addEventListener('pointerdown', (event) => {
    if (event.pointerType !== 'mouse' || event.button !== 0) return;
    dragging = true;
    pointerStart = event.clientX;
    scrollStart = scroller.scrollLeft;
    scroller.classList.add('is-dragging');
    scroller.setPointerCapture(event.pointerId);
  });

  scroller.addEventListener('pointermove', (event) => {
    if (!dragging) return;
    scroller.scrollLeft = scrollStart - (event.clientX - pointerStart);
  });

  const stopDragging = () => {
    dragging = false;
    scroller.classList.remove('is-dragging');
  };

  scroller.addEventListener('pointerup', stopDragging);
  scroller.addEventListener('pointercancel', stopDragging);
  scroller.addEventListener('scroll', scheduleCurrentEventUpdate, { passive: true });
  window.addEventListener('resize', () => {
    renderPeriodBands();
    scheduleCurrentEventUpdate();
  }, { passive: true });
  window.addEventListener('pagehide', () => {
    if (!activeRequest) return;
    window.clearTimeout(activeRequest.timeout);
    activeRequest.controller.abort();
  }, { once: true });

  loadTimeline();
})();

(() => {
  'use strict';

  const API_ROOT = 'https://cozy-archive.colbysthickey.workers.dev';
  const SESSION_KEY = 'cozyArchiveSession';
  const LOGIN_RETURN_KEY = 'cozyTimelineLoginReturn';
  const MAXIMUM_FILE_SIZE = 8 * 1024 * 1024;
  const ALLOWED_IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);

  const authPanel = document.querySelector('[data-timeline-auth]');
  const authViews = document.querySelectorAll('[data-timeline-auth-view]');
  const authStatus = document.querySelector('[data-timeline-auth-status]');
  const displayName = document.querySelector('[data-timeline-display-name]');
  const loginLink = document.querySelector('[data-timeline-login]');
  const logoutButton = document.querySelector('[data-timeline-logout]');
  const authRetryButton = document.querySelector('[data-timeline-auth-retry]');
  const suggestOpenButton = document.querySelector('[data-timeline-suggest-open]');
  const mineOpenButton = document.querySelector('[data-timeline-mine-open]');

  const suggestionDialog = document.querySelector('#timeline-suggestion-dialog');
  const suggestionForm = document.querySelector('[data-timeline-suggestion-form]');
  const suggestionViews = document.querySelectorAll('[data-timeline-suggestion-view]');
  const suggestionCloseButton = document.querySelector('[data-timeline-suggest-close]');
  const suggestionCancelButton = document.querySelector('[data-timeline-suggest-cancel]');
  const suggestionDoneButton = document.querySelector('[data-timeline-suggest-done]');
  const titleInput = document.querySelector('[data-timeline-suggestion-title]');
  const titleCount = document.querySelector('[data-timeline-title-count]');
  const dateInput = document.querySelector('[data-timeline-suggestion-date]');
  const descriptionInput = document.querySelector('[data-timeline-suggestion-description]');
  const descriptionCount = document.querySelector('[data-timeline-description-count]');
  const imageInput = document.querySelector('[data-timeline-suggestion-image]');
  const imagePicker = document.querySelector('[data-timeline-image-picker]');
  const imagePreview = document.querySelector('[data-timeline-image-preview]');
  const imagePreviewElement = document.querySelector('[data-timeline-image-preview-img]');
  const imageName = document.querySelector('[data-timeline-image-name]');
  const imageSize = document.querySelector('[data-timeline-image-size]');
  const imageRemoveButton = document.querySelector('[data-timeline-image-remove]');
  const suggestionStatus = document.querySelector('[data-timeline-suggestion-status]');
  const suggestionSubmitButton = document.querySelector('[data-timeline-suggest-submit]');
  const suggestionSubmitLabel = document.querySelector('[data-timeline-suggest-submit-label]');

  const mineDialog = document.querySelector('#timeline-my-suggestions-dialog');
  const mineCloseButton = document.querySelector('[data-timeline-mine-close]');
  const mineRetryButton = document.querySelector('[data-timeline-mine-retry]');
  const mineStatus = document.querySelector('[data-timeline-mine-status]');
  const mineLoading = document.querySelector('[data-timeline-mine-loading]');
  const mineEmpty = document.querySelector('[data-timeline-mine-empty]');
  const mineList = document.querySelector('[data-timeline-mine-list]');
  const mineError = document.querySelector('[data-timeline-mine-error]');

  if (!authPanel) return;

  let activeAuthRequest = null;
  let activeSubmissionRequest = null;
  let activeMineRequest = null;
  let previewUrl = null;
  let selectedImage = null;

  const readSession = () => {
    try {
      return sessionStorage.getItem(SESSION_KEY);
    } catch (error) {
      return null;
    }
  };

  const removeSession = () => {
    try {
      sessionStorage.removeItem(SESSION_KEY);
    } catch (error) {}
  };

  const safeResponseJson = async (response) => {
    try {
      return await response.json();
    } catch (error) {
      return null;
    }
  };

  const setAuthState = (state, message = '') => {
    authViews.forEach((view) => {
      view.hidden = view.dataset.timelineAuthView !== state;
    });
    authPanel.dataset.authState = state;
    authPanel.setAttribute('aria-busy', String(state === 'checking'));
    if (suggestOpenButton) suggestOpenButton.disabled = state !== 'logged-in';
    if (mineOpenButton) mineOpenButton.disabled = state !== 'logged-in';
    if (authStatus) authStatus.textContent = message;
    if (state !== 'logged-in') {
      if (suggestionDialog?.open) suggestionDialog.close();
      if (mineDialog?.open) mineDialog.close();
    }
  };

  const expireSession = () => {
    removeSession();
    if (displayName) displayName.textContent = '';
    setAuthState('logged-out', 'Your Discord session expired. Please sign in again.');
  };

  const verifySession = async () => {
    const token = readSession();
    if (!token) {
      setAuthState('logged-out');
      return;
    }

    if (activeAuthRequest) activeAuthRequest.abort();
    const controller = new AbortController();
    activeAuthRequest = controller;
    const timeout = window.setTimeout(() => controller.abort(), 7000);
    setAuthState('checking', 'Checking your Discord session…');

    try {
      const response = await fetch(`${API_ROOT}/api/me`, {
        method: 'GET',
        headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
        credentials: 'omit',
        cache: 'no-store',
        signal: controller.signal
      });
      if (activeAuthRequest !== controller) return;
      if (response.status === 401) {
        expireSession();
        return;
      }
      const payload = await safeResponseJson(response);
      const rawName = payload?.user?.displayName || payload?.user?.username;
      const safeName = typeof rawName === 'string' ? rawName.trim().slice(0, 80) : '';
      if (!response.ok || payload?.authenticated !== true || !safeName) {
        setAuthState('unavailable', 'Discord login status could not be checked.');
        return;
      }
      if (displayName) displayName.textContent = safeName;
      setAuthState('logged-in', `Signed in as ${safeName}.`);
    } catch (error) {
      if (activeAuthRequest !== controller) return;
      setAuthState('unavailable', 'Discord login status could not be checked.');
    } finally {
      window.clearTimeout(timeout);
      if (activeAuthRequest === controller) activeAuthRequest = null;
    }
  };

  const setSuggestionView = (view) => {
    suggestionViews.forEach((element) => {
      element.hidden = element.dataset.timelineSuggestionView !== view;
    });
  };

  const setSuggestionStatus = (message = '', state = '') => {
    if (!suggestionStatus) return;
    suggestionStatus.textContent = message;
    if (state) suggestionStatus.dataset.state = state;
    else delete suggestionStatus.dataset.state;
  };

  const formatFileSize = (bytes) => bytes < 1024 * 1024
    ? `${Math.max(1, Math.round(bytes / 1024))} KB`
    : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;

  const revokePreview = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl = null;
  };

  const clearSelectedImage = () => {
    selectedImage = null;
    revokePreview();
    if (imageInput) imageInput.value = '';
    if (imagePreviewElement) imagePreviewElement.removeAttribute('src');
    if (imagePreview) imagePreview.hidden = true;
    if (imagePicker) imagePicker.hidden = false;
  };

  const chooseImage = (file) => {
    if (!file) {
      clearSelectedImage();
      return;
    }
    if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
      clearSelectedImage();
      setSuggestionStatus('Choose a PNG, JPEG, or WebP image.', 'error');
      return;
    }
    if (!Number.isFinite(file.size) || file.size <= 0 || file.size > MAXIMUM_FILE_SIZE) {
      clearSelectedImage();
      setSuggestionStatus('Screenshots must be 8 MB or smaller.', 'error');
      return;
    }
    clearSelectedImage();
    selectedImage = file;
    previewUrl = URL.createObjectURL(file);
    if (imagePreviewElement) imagePreviewElement.src = previewUrl;
    if (imageName) imageName.textContent = file.name.slice(0, 120);
    if (imageSize) imageSize.textContent = formatFileSize(file.size);
    if (imagePicker) imagePicker.hidden = true;
    if (imagePreview) imagePreview.hidden = false;
    setSuggestionStatus();
  };

  const resetSuggestionForm = () => {
    if (activeSubmissionRequest) {
      activeSubmissionRequest.abort();
      activeSubmissionRequest = null;
    }
    suggestionForm?.reset();
    clearSelectedImage();
    if (titleCount) titleCount.textContent = '0';
    if (descriptionCount) descriptionCount.textContent = '0';
    if (dateInput) {
      const today = new Date().toISOString().slice(0, 10);
      dateInput.max = today;
    }
    if (suggestionSubmitButton) suggestionSubmitButton.disabled = false;
    if (suggestionSubmitLabel) suggestionSubmitLabel.textContent = 'Submit for Review';
    setSuggestionStatus();
    setSuggestionView('form');
  };

  const closeSuggestionDialog = () => {
    if (suggestionDialog?.open) suggestionDialog.close();
  };

  const validDate = (value) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const [year, month, day] = value.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    return date.getUTCFullYear() === year
      && date.getUTCMonth() === month - 1
      && date.getUTCDate() === day;
  };

  const submissionErrorMessage = (status, payload) => {
    if (payload && typeof payload.error === 'string' && payload.error.trim()) {
      return payload.error.trim().slice(0, 240);
    }
    if (status === 401) return 'Your Discord session expired. Please sign in again.';
    if (status === 413) return 'Screenshots must be 8 MB or smaller.';
    if (status === 415) return 'Choose a PNG, JPEG, or WebP image.';
    if (status === 429) return 'You have reached the suggestion limit for now. Please try again later.';
    return 'Your suggestion could not be sent. Please try again.';
  };

  const submitSuggestion = async (event) => {
    event.preventDefault();
    const token = readSession();
    if (!token) {
      expireSession();
      return;
    }
    const title = titleInput?.value.trim() || '';
    const eventDate = dateInput?.value || '';
    const description = descriptionInput?.value.trim() || '';
    const today = new Date().toISOString().slice(0, 10);
    if (!title || title.length > 80) {
      setSuggestionStatus('Enter an event title of 80 characters or fewer.', 'error');
      titleInput?.focus();
      return;
    }
    if (!validDate(eventDate) || eventDate > today) {
      setSuggestionStatus('Choose a valid date that is not in the future.', 'error');
      dateInput?.focus();
      return;
    }
    if (description.length > 280) {
      setSuggestionStatus('Keep the description to 280 characters or fewer.', 'error');
      descriptionInput?.focus();
      return;
    }

    const formData = new FormData();
    formData.append('title', title);
    formData.append('eventDate', eventDate);
    formData.append('description', description);
    if (selectedImage) formData.append('image', selectedImage, selectedImage.name);

    if (activeSubmissionRequest) activeSubmissionRequest.abort();
    const controller = new AbortController();
    activeSubmissionRequest = controller;
    const timeout = window.setTimeout(() => controller.abort(), 20000);
    if (suggestionSubmitButton) suggestionSubmitButton.disabled = true;
    if (suggestionSubmitLabel) suggestionSubmitLabel.textContent = 'Sending…';
    setSuggestionStatus('Sending your suggestion…');

    try {
      const response = await fetch(`${API_ROOT}/api/timeline/submissions`, {
        method: 'POST',
        headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
        credentials: 'omit',
        body: formData,
        signal: controller.signal
      });
      const payload = await safeResponseJson(response);
      if (response.status === 401) {
        expireSession();
        return;
      }
      if (!response.ok || payload?.ok !== true) {
        setSuggestionStatus(submissionErrorMessage(response.status, payload), 'error');
        return;
      }
      clearSelectedImage();
      setSuggestionView('success');
    } catch (error) {
      if (controller.signal.aborted && activeSubmissionRequest !== controller) return;
      setSuggestionStatus(
        controller.signal.aborted
          ? 'The request took too long. Please try again.'
          : 'Your suggestion could not be sent. Please check your connection and try again.',
        'error'
      );
    } finally {
      window.clearTimeout(timeout);
      if (activeSubmissionRequest === controller) activeSubmissionRequest = null;
      if (suggestionSubmitButton) suggestionSubmitButton.disabled = false;
      if (suggestionSubmitLabel) suggestionSubmitLabel.textContent = 'Submit for Review';
    }
  };

  const formatSubmissionDate = (value) => {
    if (!validDate(value)) return 'Unknown date';
    const [year, month, day] = value.split('-').map(Number);
    return new Intl.DateTimeFormat('en', {
      year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC'
    }).format(new Date(Date.UTC(year, month - 1, day)));
  };

  const normalizeSubmission = (value) => {
    if (!value || typeof value !== 'object') return null;
    const id = Number(value.id);
    const title = typeof value.title === 'string' ? value.title.trim().slice(0, 80) : '';
    const status = ['pending', 'approved', 'rejected'].includes(value.status) ? value.status : '';
    if (!Number.isSafeInteger(id) || id <= 0 || !title || !status || !validDate(value.eventDate)) return null;
    return { id, title, status, eventDate: value.eventDate };
  };

  const renderMine = (submissions) => {
    if (!mineList) return;
    mineList.replaceChildren();
    submissions.forEach((submission) => {
      const article = document.createElement('article');
      const copy = document.createElement('div');
      const title = document.createElement('h3');
      const date = document.createElement('time');
      const badge = document.createElement('span');
      const statusLabels = { pending: 'Waiting for review', approved: 'Approved', rejected: 'Not approved' };
      article.className = `timeline-my-item status-${submission.status}`;
      title.textContent = submission.title;
      date.dateTime = submission.eventDate;
      date.textContent = formatSubmissionDate(submission.eventDate);
      badge.className = 'timeline-my-badge';
      badge.textContent = statusLabels[submission.status];
      copy.append(title, date);
      article.append(copy, badge);
      mineList.append(article);
    });
  };

  const setMineView = (view) => {
    if (mineLoading) mineLoading.hidden = view !== 'loading';
    if (mineEmpty) mineEmpty.hidden = view !== 'empty';
    if (mineList) mineList.hidden = view !== 'list';
    if (mineError) mineError.hidden = view !== 'error';
  };

  const loadMine = async () => {
    const token = readSession();
    if (!token) {
      expireSession();
      return;
    }
    if (activeMineRequest) activeMineRequest.abort();
    const controller = new AbortController();
    activeMineRequest = controller;
    const timeout = window.setTimeout(() => controller.abort(), 8000);
    setMineView('loading');
    if (mineStatus) mineStatus.textContent = 'Loading your suggestions…';

    try {
      const response = await fetch(`${API_ROOT}/api/my/timeline-submissions`, {
        method: 'GET',
        headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
        credentials: 'omit',
        cache: 'no-store',
        signal: controller.signal
      });
      if (response.status === 401) {
        expireSession();
        return;
      }
      const payload = await safeResponseJson(response);
      if (!response.ok || payload?.ok !== true || !Array.isArray(payload.submissions)) {
        throw new Error('Invalid suggestions response');
      }
      const submissions = payload.submissions.map(normalizeSubmission).filter(Boolean);
      renderMine(submissions);
      setMineView(submissions.length ? 'list' : 'empty');
      if (mineStatus) {
        mineStatus.textContent = submissions.length
          ? `${submissions.length} ${submissions.length === 1 ? 'suggestion' : 'suggestions'} found.`
          : 'You have not submitted any timeline suggestions yet.';
      }
    } catch (error) {
      if (activeMineRequest !== controller) return;
      setMineView('error');
      if (mineStatus) mineStatus.textContent = 'Your suggestions could not be loaded.';
    } finally {
      window.clearTimeout(timeout);
      if (activeMineRequest === controller) activeMineRequest = null;
    }
  };

  if (loginLink) {
    loginLink.addEventListener('click', () => {
      try {
        sessionStorage.setItem(LOGIN_RETURN_KEY, '1');
      } catch (error) {}
    });
  }
  logoutButton?.addEventListener('click', () => {
    removeSession();
    if (displayName) displayName.textContent = '';
    setAuthState('logged-out', 'You have been logged out.');
  });
  authRetryButton?.addEventListener('click', verifySession);

  titleInput?.addEventListener('input', () => {
    if (titleInput.value.length > 80) titleInput.value = titleInput.value.slice(0, 80);
    if (titleCount) titleCount.textContent = String(titleInput.value.length);
  });
  descriptionInput?.addEventListener('input', () => {
    if (descriptionInput.value.length > 280) descriptionInput.value = descriptionInput.value.slice(0, 280);
    if (descriptionCount) descriptionCount.textContent = String(descriptionInput.value.length);
  });
  imageInput?.addEventListener('change', () => chooseImage(imageInput.files?.[0] || null));
  imageRemoveButton?.addEventListener('click', clearSelectedImage);
  suggestionForm?.addEventListener('submit', submitSuggestion);

  suggestOpenButton?.addEventListener('click', () => {
    if (authPanel.dataset.authState !== 'logged-in' || !suggestionDialog?.showModal) return;
    resetSuggestionForm();
    suggestionDialog.showModal();
    document.documentElement.classList.add('modal-open');
    window.setTimeout(() => titleInput?.focus(), 0);
  });
  suggestionCloseButton?.addEventListener('click', closeSuggestionDialog);
  suggestionCancelButton?.addEventListener('click', closeSuggestionDialog);
  suggestionDoneButton?.addEventListener('click', closeSuggestionDialog);
  suggestionDialog?.addEventListener('cancel', (event) => {
    event.preventDefault();
    closeSuggestionDialog();
  });
  suggestionDialog?.addEventListener('click', (event) => {
    if (event.target === suggestionDialog) closeSuggestionDialog();
  });
  suggestionDialog?.addEventListener('close', () => {
    document.documentElement.classList.remove('modal-open');
    resetSuggestionForm();
    suggestOpenButton?.focus();
  });

  mineOpenButton?.addEventListener('click', () => {
    if (authPanel.dataset.authState !== 'logged-in' || !mineDialog?.showModal) return;
    mineDialog.showModal();
    document.documentElement.classList.add('modal-open');
    loadMine();
  });
  const closeMineDialog = () => {
    if (mineDialog?.open) mineDialog.close();
  };
  mineCloseButton?.addEventListener('click', closeMineDialog);
  mineRetryButton?.addEventListener('click', loadMine);
  mineDialog?.addEventListener('cancel', (event) => {
    event.preventDefault();
    closeMineDialog();
  });
  mineDialog?.addEventListener('click', (event) => {
    if (event.target === mineDialog) closeMineDialog();
  });
  mineDialog?.addEventListener('close', () => {
    document.documentElement.classList.remove('modal-open');
    if (activeMineRequest) {
      activeMineRequest.abort();
      activeMineRequest = null;
    }
    mineOpenButton?.focus();
  });

  window.addEventListener('pagehide', () => {
    activeAuthRequest?.abort();
    activeSubmissionRequest?.abort();
    activeMineRequest?.abort();
    revokePreview();
  }, { once: true });

  resetSuggestionForm();
  verifySession();
})();
