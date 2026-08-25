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
      renderEvents();
    } catch (error) {
      if (controller.signal.aborted && activeRequest && activeRequest.controller !== controller) return;
      events = [];
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
  window.addEventListener('resize', scheduleCurrentEventUpdate, { passive: true });
  window.addEventListener('pagehide', () => {
    if (!activeRequest) return;
    window.clearTimeout(activeRequest.timeout);
    activeRequest.controller.abort();
  }, { once: true });

  loadTimeline();
})();
