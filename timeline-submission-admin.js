(() => {
  'use strict';

  const API_ROOT = 'https://cozy-archive.colbysthickey.workers.dev';
  const SESSION_KEY = 'cozyArchiveSession';
  const MAX_IMAGE_SIZE = 8 * 1024 * 1024;
  const ALLOWED_IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);

  const panel = document.querySelector('[data-admin-panel="timeline"]');
  const list = document.querySelector('[data-timeline-submission-list]');
  const empty = document.querySelector('[data-timeline-submission-empty]');
  const loading = document.querySelector('[data-timeline-submission-loading]');
  const status = document.querySelector('[data-timeline-submission-status]');
  const count = document.querySelector('[data-timeline-submission-count]');
  const refreshButton = document.querySelector('[data-timeline-submission-refresh]');
  const dialog = document.querySelector('#timeline-submission-review-dialog');
  const form = document.querySelector('[data-timeline-submission-form]');
  const closeButton = document.querySelector('[data-timeline-submission-close]');
  const cancelButton = document.querySelector('[data-timeline-submission-cancel]');
  const approveButton = document.querySelector('[data-timeline-submission-approve]');
  const rejectButton = document.querySelector('[data-timeline-submission-reject]');
  const author = document.querySelector('[data-timeline-submission-author]');
  const titleInput = document.querySelector('[data-timeline-submission-title]');
  const dateInput = document.querySelector('[data-timeline-submission-date]');
  const descriptionInput = document.querySelector('[data-timeline-submission-description]');
  const originalImage = document.querySelector('[data-timeline-submission-original-image]');
  const imagePreview = document.querySelector('[data-timeline-submission-image-preview]');
  const replacementInput = document.querySelector('[data-timeline-submission-replacement]');
  const replacementLabel = document.querySelector('[data-timeline-submission-replacement-label]');
  const removeImageRow = document.querySelector('[data-timeline-submission-remove-row]');
  const removeImageInput = document.querySelector('[data-timeline-submission-remove-image]');
  const formStatus = document.querySelector('[data-timeline-submission-form-status]');

  if (!panel || !list || !empty || !dialog || !form || !titleInput || !dateInput || !descriptionInput) return;

  const submissions = new Map();
  let active = false;
  let loaded = false;
  let activeRequest = null;
  let reviewingId = null;
  let imageObjectUrl = null;
  let imageRequest = null;

  const readSession = () => {
    try { return sessionStorage.getItem(SESSION_KEY); } catch (error) { return null; }
  };

  const safeJson = async (response) => {
    try { return await response.json(); } catch (error) { return null; }
  };

  const validDate = (value) => {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const [year, month, day] = value.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    return date.getUTCFullYear() === year
      && date.getUTCMonth() === month - 1
      && date.getUTCDate() === day;
  };

  const safeSubmissionImageUrl = (value, id) => {
    if (typeof value !== 'string' || !value || value.length > 1000) return '';
    try {
      const url = new URL(value, API_ROOT);
      const expected = `/api/admin/timeline/submissions/${id}/image`;
      return url.origin === new URL(API_ROOT).origin
        && url.pathname === expected
        && !url.search
        && !url.hash
        ? url.href
        : '';
    } catch (error) {
      return '';
    }
  };

  const normalizeSubmission = (value) => {
    if (!value || typeof value !== 'object') return null;
    const id = Number(value.id);
    const title = typeof value.title === 'string' ? value.title.trim().slice(0, 80) : '';
    const description = typeof value.description === 'string' ? value.description.trim().slice(0, 280) : '';
    const submitter = typeof value.submitter === 'string' ? value.submitter.trim().slice(0, 80) : 'Discord user';
    const eventDate = value.eventDate;
    if (!Number.isSafeInteger(id) || id <= 0 || !title || !validDate(eventDate)) return null;
    return Object.freeze({
      id,
      title,
      description,
      submitter,
      eventDate,
      hasImage: value.hasImage === true,
      imageUrl: safeSubmissionImageUrl(value.imageUrl, id)
    });
  };

  const dispatchSessionProblem = (statusCode) => {
    if (statusCode === 401) {
      document.dispatchEvent(new CustomEvent('cozy-admin-session-expired'));
      return true;
    }
    if (statusCode === 403) {
      document.dispatchEvent(new CustomEvent('cozy-admin-access-denied'));
      return true;
    }
    return false;
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

  const syncSummary = () => {
    const size = submissions.size;
    if (count) count.textContent = `${size} pending`;
    empty.hidden = size !== 0 || Boolean(activeRequest);
  };

  const formatDate = (value) => {
    const [year, month, day] = value.split('-').map(Number);
    return new Intl.DateTimeFormat('en', {
      year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC'
    }).format(new Date(Date.UTC(year, month - 1, day)));
  };

  const createRow = (submission) => {
    const article = document.createElement('article');
    const icon = document.createElement('span');
    const copy = document.createElement('div');
    const title = document.createElement('h4');
    const details = document.createElement('p');
    const description = document.createElement('p');
    const review = document.createElement('button');
    article.className = 'timeline-submission-review-row';
    article.dataset.timelineSubmissionId = String(submission.id);
    icon.className = 'timeline-submission-review-icon';
    icon.textContent = submission.hasImage ? '🖼️' : '✍️';
    title.textContent = submission.title;
    details.className = 'timeline-submission-review-meta';
    details.textContent = `${formatDate(submission.eventDate)} · Suggested by ${submission.submitter}`;
    description.className = submission.description ? '' : 'is-empty';
    description.textContent = submission.description || 'No description included.';
    review.className = 'button button-primary';
    review.type = 'button';
    review.textContent = 'Review';
    review.addEventListener('click', () => openReview(submission));
    copy.append(title, details, description);
    article.append(icon, copy, review);
    return article;
  };

  const render = () => {
    const ordered = Array.from(submissions.values()).sort((a, b) => a.id - b.id);
    list.replaceChildren(...ordered.map(createRow));
    syncSummary();
  };

  const loadSubmissions = async () => {
    if (activeRequest) return;
    const token = readSession();
    if (!token) {
      document.dispatchEvent(new CustomEvent('cozy-admin-session-expired'));
      return;
    }
    const controller = new AbortController();
    const request = { controller, timeout: window.setTimeout(() => controller.abort(), 10000), type: 'load' };
    activeRequest = request;
    if (loading) loading.hidden = false;
    empty.hidden = true;
    list.setAttribute('aria-busy', 'true');
    if (refreshButton) refreshButton.disabled = true;
    setStatus('Loading community suggestions…');

    try {
      const response = await fetch(`${API_ROOT}/api/admin/timeline/submissions`, {
        method: 'GET',
        headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
        credentials: 'omit',
        cache: 'no-store',
        signal: controller.signal
      });
      const payload = await safeJson(response);
      if (activeRequest !== request) return;
      if (dispatchSessionProblem(response.status)) return;
      if (!response.ok || payload?.ok !== true || !Array.isArray(payload.submissions)) {
        throw new Error('Invalid timeline submissions response');
      }
      submissions.clear();
      payload.submissions.map(normalizeSubmission).filter(Boolean)
        .forEach((submission) => submissions.set(submission.id, submission));
      loaded = true;
      render();
      setStatus(submissions.size
        ? `${submissions.size} community ${submissions.size === 1 ? 'suggestion is' : 'suggestions are'} waiting for review.`
        : 'No community suggestions are waiting for review.');
    } catch (error) {
      if (activeRequest !== request) return;
      setStatus('Community suggestions could not be loaded. Please try again.', 'error');
    } finally {
      window.clearTimeout(request.timeout);
      if (activeRequest === request) activeRequest = null;
      if (loading) loading.hidden = true;
      list.setAttribute('aria-busy', 'false');
      if (refreshButton) refreshButton.disabled = false;
      syncSummary();
    }
  };

  const clearImagePreview = () => {
    imageRequest?.abort();
    imageRequest = null;
    if (imageObjectUrl) URL.revokeObjectURL(imageObjectUrl);
    imageObjectUrl = null;
    imagePreview?.removeAttribute('src');
    if (originalImage) originalImage.hidden = true;
  };

  const loadSubmissionImage = async (submission) => {
    clearImagePreview();
    if (!submission.hasImage || !submission.imageUrl) return;
    const token = readSession();
    if (!token) return;
    const controller = new AbortController();
    imageRequest = controller;
    try {
      const response = await fetch(submission.imageUrl, {
        headers: { Authorization: `Bearer ${token}` },
        credentials: 'omit',
        cache: 'no-store',
        signal: controller.signal
      });
      if (!response.ok || !String(response.headers.get('Content-Type') || '').startsWith('image/')) return;
      const blob = await response.blob();
      if (imageRequest !== controller) return;
      imageObjectUrl = URL.createObjectURL(blob);
      if (imagePreview) imagePreview.src = imageObjectUrl;
      if (originalImage) originalImage.hidden = false;
    } catch (error) {
      // The text details remain reviewable if the private image cannot be loaded.
    } finally {
      if (imageRequest === controller) imageRequest = null;
    }
  };

  const openReview = (submission) => {
    if (activeRequest || !dialog.showModal) return;
    reviewingId = submission.id;
    form.reset();
    titleInput.value = submission.title;
    dateInput.value = submission.eventDate;
    descriptionInput.value = submission.description;
    if (author) author.textContent = submission.submitter;
    if (replacementLabel) replacementLabel.textContent = 'Choose a replacement image';
    if (removeImageRow) removeImageRow.hidden = !submission.hasImage;
    setFormStatus();
    loadSubmissionImage(submission);
    document.documentElement.classList.add('modal-open');
    dialog.showModal();
    titleInput.focus({ preventScroll: true });
  };

  const closeReview = () => {
    if (dialog.open) dialog.close();
  };

  const mutateSubmission = async (action) => {
    if (activeRequest || reviewingId === null) return;
    const token = readSession();
    if (!token) {
      document.dispatchEvent(new CustomEvent('cozy-admin-session-expired'));
      return;
    }
    const submissionId = reviewingId;
    const body = new FormData();
    if (action === 'approve') {
      const title = titleInput.value.trim();
      const eventDate = dateInput.value;
      const description = descriptionInput.value.trim();
      if (!title || title.length > 80) {
        setFormStatus('Enter an event title of 80 characters or fewer.', 'error');
        titleInput.focus();
        return;
      }
      if (!validDate(eventDate)) {
        setFormStatus('Choose a valid event date.', 'error');
        dateInput.focus();
        return;
      }
      if (description.length > 280) return;
      const replacement = replacementInput?.files?.[0] || null;
      if (replacement && (!ALLOWED_IMAGE_TYPES.has(replacement.type) || replacement.size > MAX_IMAGE_SIZE)) {
        setFormStatus('Choose a PNG, JPEG, or WebP image no larger than 8 MB.', 'error');
        return;
      }
      body.append('title', title);
      body.append('eventDate', eventDate);
      body.append('description', description);
      body.append('removeImage', String(Boolean(removeImageInput?.checked && !replacement)));
      if (replacement) body.append('image', replacement, replacement.name);
    }

    const controller = new AbortController();
    const request = { controller, timeout: window.setTimeout(() => controller.abort(), 20000), type: action };
    activeRequest = request;
    if (approveButton) approveButton.disabled = true;
    if (rejectButton) rejectButton.disabled = true;
    setFormStatus(action === 'approve' ? 'Publishing this event…' : 'Rejecting this suggestion…');

    try {
      const response = await fetch(`${API_ROOT}/api/admin/timeline/submissions/${submissionId}/${action}`, {
        method: 'POST',
        headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
        credentials: 'omit',
        body: action === 'approve' ? body : undefined,
        signal: controller.signal
      });
      const payload = await safeJson(response);
      if (activeRequest !== request) return;
      if (dispatchSessionProblem(response.status)) return;
      if (!response.ok || payload?.ok !== true) {
        setFormStatus(
          typeof payload?.error === 'string' ? payload.error.slice(0, 300) : 'The suggestion could not be reviewed. Please try again.',
          'error'
        );
        return;
      }
      submissions.delete(submissionId);
      closeReview();
      render();
      setStatus(action === 'approve' ? 'Suggestion approved and published.' : 'Suggestion rejected.', 'success');
      if (action === 'approve') document.dispatchEvent(new CustomEvent('cozy-admin-timeline-refresh'));
    } catch (error) {
      if (activeRequest !== request) return;
      setFormStatus('The suggestion could not be reviewed. Please try again.', 'error');
    } finally {
      window.clearTimeout(request.timeout);
      if (activeRequest === request) activeRequest = null;
      if (approveButton) approveButton.disabled = false;
      if (rejectButton) rejectButton.disabled = false;
    }
  };

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    mutateSubmission('approve');
  });
  rejectButton?.addEventListener('click', () => {
    const submission = submissions.get(reviewingId);
    if (!submission) return;
    if (window.confirm(`Reject “${submission.title}”? The submitter will see it as not approved.`)) {
      mutateSubmission('reject');
    }
  });
  closeButton?.addEventListener('click', closeReview);
  cancelButton?.addEventListener('click', closeReview);
  refreshButton?.addEventListener('click', loadSubmissions);
  replacementInput?.addEventListener('change', () => {
    const file = replacementInput.files?.[0];
    if (replacementLabel) replacementLabel.textContent = file ? file.name.slice(0, 100) : 'Choose a replacement image';
    if (file && removeImageInput) removeImageInput.checked = false;
  });
  removeImageInput?.addEventListener('change', () => {
    if (removeImageInput.checked && replacementInput) {
      replacementInput.value = '';
      if (replacementLabel) replacementLabel.textContent = 'Choose a replacement image';
    }
  });
  dialog.addEventListener('cancel', (event) => {
    event.preventDefault();
    closeReview();
  });
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) closeReview();
  });
  dialog.addEventListener('close', () => {
    document.documentElement.classList.remove('modal-open');
    reviewingId = null;
    clearImagePreview();
    form.reset();
    setFormStatus();
  });

  document.addEventListener('cozy-admin-tab-change', (event) => {
    active = event.detail?.tabName === 'timeline';
    if (active && !loaded && !activeRequest) loadSubmissions();
  });
  document.addEventListener('cozy-admin-leave', () => {
    activeRequest?.controller?.abort();
    activeRequest = null;
    loaded = false;
    submissions.clear();
    list.replaceChildren();
    closeReview();
    syncSummary();
  });
  window.addEventListener('pagehide', () => {
    activeRequest?.controller?.abort();
    clearImagePreview();
  }, { once: true });

  syncSummary();
})();
