(() => {
  'use strict';

  const ARCHIVE_API = 'https://cozy-archive.colbysthickey.workers.dev';
  const sessionKey = 'cozyArchiveSession';
  const maximumImageSize = 8 * 1024 * 1024;
  const allowedImageTypes = new Set(['image/png', 'image/jpeg', 'image/webp']);
  const rootEl = document.documentElement;
  const panel = document.querySelector('[data-admin-panel="timeline"]');
  const count = document.querySelector('[data-timeline-admin-count]');
  const total = document.querySelector('[data-timeline-admin-total]');
  const status = document.querySelector('[data-timeline-admin-status]');
  const layout = document.querySelector('.timeline-admin-layout');
  const loading = document.querySelector('[data-timeline-admin-loading]');
  const list = document.querySelector('[data-timeline-admin-events]');
  const empty = document.querySelector('[data-timeline-admin-empty]');
  const addButtons = document.querySelectorAll('[data-timeline-admin-add], [data-timeline-admin-empty-add]');
  const refreshButton = document.querySelector('[data-admin-refresh]');
  const refreshLabel = document.querySelector('[data-admin-refresh-label]');
  const editor = document.querySelector('[data-timeline-admin-editor]');
  const editorTitle = document.querySelector('[data-timeline-editor-title]');
  const editorClose = document.querySelector('[data-timeline-editor-close]');
  const editorCancel = document.querySelector('[data-timeline-editor-cancel]');
  const form = document.querySelector('[data-timeline-admin-form]');
  const titleInput = document.querySelector('[data-timeline-event-title]');
  const dateInput = document.querySelector('[data-timeline-event-date]');
  const descriptionInput = document.querySelector('[data-timeline-event-description]');
  const imageInput = document.querySelector('[data-timeline-event-image]');
  const selectedImage = document.querySelector('[data-timeline-selected-image]');
  const imagePreview = document.querySelector('[data-timeline-image-preview]');
  const imageName = document.querySelector('[data-timeline-image-name]');
  const imageSize = document.querySelector('[data-timeline-image-size]');
  const imageClear = document.querySelector('[data-timeline-image-clear]');
  const imagePicker = document.querySelector('[data-timeline-image-picker]');
  const imagePickerLabel = document.querySelector('[data-timeline-image-picker-label]');
  const removeImageRow = document.querySelector('[data-timeline-remove-image-row]');
  const removeImageInput = document.querySelector('[data-timeline-remove-image]');
  const titleCount = document.querySelector('[data-timeline-title-count]');
  const descriptionCount = document.querySelector('[data-timeline-description-count]');
  const previewYear = document.querySelector('[data-timeline-preview-year]');
  const previewTitle = document.querySelector('[data-timeline-preview-title]');
  const previewDate = document.querySelector('[data-timeline-preview-date]');
  const previewDescription = document.querySelector('[data-timeline-preview-description]');
  const formStatus = document.querySelector('[data-timeline-form-status]');
  const saveButton = document.querySelector('[data-timeline-event-save]');
  const deleteDialog = document.querySelector('#timeline-delete-dialog');
  const deleteContext = document.querySelector('[data-timeline-delete-context]');
  const deleteCancel = document.querySelector('[data-timeline-delete-cancel]');
  const deleteConfirm = document.querySelector('[data-timeline-delete-confirm]');

  if (!panel || !list || !empty || !form || !editor || !titleInput || !dateInput || !descriptionInput) return;

  const timelineEvents = new Map();
  let active = false;
  let loaded = false;
  let activeLoadRequest = null;
  let activeMutation = null;
  let editingId = null;
  let deletingId = null;
  let selectedFile = null;
  let selectedImageUrl = null;

  const readSession = () => {
    try {
      return sessionStorage.getItem(sessionKey);
    } catch (error) {
      return null;
    }
  };

  const reasonableText = (value, maximumLength) => {
    if (typeof value !== 'string') return '';
    const text = value.trim();
    return text && text.length <= maximumLength ? text : '';
  };

  const safeJson = async (response) => {
    try {
      return await response.json();
    } catch (error) {
      return null;
    }
  };

  const backendError = (payload) => reasonableText(payload && payload.error, 300);

  const validDate = (value) => {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const [year, month, day] = value.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    return date.getUTCFullYear() === year
      && date.getUTCMonth() === month - 1
      && date.getUTCDate() === day;
  };

  const normalizeEvent = (value) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const id = Number(value.id);
    const title = reasonableText(value.title, 80);
    const eventDate = value.eventDate;
    if (!Number.isSafeInteger(id) || id <= 0 || !title || !validDate(eventDate)) return null;
    const description = typeof value.description === 'string'
      ? value.description.trim().slice(0, 280)
      : '';
    return Object.freeze({
      id,
      title,
      eventDate,
      description,
      hasImage: value.hasImage === true || (typeof value.imageUrl === 'string' && value.imageUrl.length > 0)
    });
  };

  const dateParts = (value) => {
    if (!validDate(value)) return { year: 'Year', monthDay: 'Choose a date', long: 'Choose an event date' };
    const [year, month, day] = value.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    return {
      year: String(year),
      monthDay: new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(date),
      long: new Intl.DateTimeFormat('en', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        timeZone: 'UTC'
      }).format(date)
    };
  };

  const formatFileSize = (bytes) => {
    if (!Number.isFinite(bytes) || bytes < 0) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
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

  const syncBusy = () => {
    const busy = Boolean(activeLoadRequest || activeMutation);
    list.setAttribute('aria-busy', String(Boolean(activeLoadRequest)));
    if (refreshButton && active) refreshButton.disabled = busy;
    if (refreshLabel && active) refreshLabel.textContent = activeLoadRequest ? 'Refreshing…' : 'Refresh';
    addButtons.forEach((button) => { button.disabled = busy; });
    if (saveButton) saveButton.disabled = busy;
    list.querySelectorAll('button').forEach((button) => { button.disabled = busy; });
  };

  const updateSummary = () => {
    const size = timelineEvents.size;
    if (count) count.textContent = String(size);
    if (total) total.textContent = `${size} ${size === 1 ? 'event' : 'events'}`;
    empty.hidden = size !== 0 || Boolean(activeLoadRequest);
  };

  const createTextElement = (tagName, className, text) => {
    const element = document.createElement(tagName);
    if (className) element.className = className;
    element.textContent = text;
    return element;
  };

  const sortedEvents = () => Array.from(timelineEvents.values())
    .sort((a, b) => a.eventDate.localeCompare(b.eventDate) || a.id - b.id);

  const openDeleteDialog = (event) => {
    if (!deleteDialog || !deleteContext || activeMutation) return;
    deletingId = event.id;
    const sourceButton = list.querySelector(`[data-timeline-event-id="${event.id}"] [data-timeline-event-delete]`);
    deleteDialog.dataset.restoreTimelineId = String(event.id);
    deleteContext.textContent = `${dateParts(event.eventDate).long} · ${event.title}`;
    rootEl.classList.add('modal-open');
    deleteDialog.showModal();
    if (sourceButton) sourceButton.blur();
    window.requestAnimationFrame(() => deleteCancel && deleteCancel.focus());
  };

  const createEventRow = (event) => {
    const row = document.createElement('article');
    const date = dateParts(event.eventDate);
    const dateBox = document.createElement('div');
    const year = createTextElement('strong', '', date.year);
    const monthDay = createTextElement('span', '', date.monthDay);
    const copy = document.createElement('div');
    const title = createTextElement('h3', '', event.title);
    const description = createTextElement(
      'p',
      event.description ? '' : 'is-empty',
      event.description || 'No description added.'
    );
    const metadata = document.createElement('div');
    const actions = document.createElement('div');
    const editButton = createTextElement('button', 'timeline-admin-edit-button', 'Edit');
    const deleteButton = createTextElement('button', 'timeline-admin-delete-button', 'Delete');

    row.className = 'timeline-admin-event-row';
    row.dataset.timelineEventId = String(event.id);
    dateBox.className = 'timeline-admin-event-date';
    copy.className = 'timeline-admin-event-copy';
    metadata.className = 'timeline-admin-event-meta';
    metadata.textContent = event.hasImage ? '▧ Image attached' : 'Text only';
    actions.className = 'timeline-admin-event-actions';
    editButton.type = 'button';
    editButton.dataset.timelineEventEdit = '';
    editButton.addEventListener('click', () => openEditor(event));
    deleteButton.type = 'button';
    deleteButton.dataset.timelineEventDelete = '';
    deleteButton.addEventListener('click', () => openDeleteDialog(event));
    dateBox.append(year, monthDay);
    copy.append(title, description, metadata);
    actions.append(editButton, deleteButton);
    row.append(dateBox, copy, actions);
    return row;
  };

  const renderEvents = () => {
    list.replaceChildren(...sortedEvents().map(createEventRow));
    updateSummary();
    syncBusy();
  };

  const revokeSelectedImageUrl = () => {
    if (!selectedImageUrl) return;
    URL.revokeObjectURL(selectedImageUrl);
    selectedImageUrl = null;
  };

  const clearSelectedImage = ({ clearInput = true } = {}) => {
    revokeSelectedImageUrl();
    selectedFile = null;
    if (clearInput && imageInput) imageInput.value = '';
    if (imagePreview) imagePreview.removeAttribute('src');
    if (imageName) imageName.textContent = '';
    if (imageSize) imageSize.textContent = '';
    if (selectedImage) selectedImage.hidden = true;
    if (imagePicker) imagePicker.hidden = false;
    if (imagePickerLabel) imagePickerLabel.textContent = editingId === null ? 'Choose an image' : 'Choose a replacement image';
  };

  const syncPreview = () => {
    const formatted = dateParts(dateInput.value);
    const title = titleInput.value.trim();
    const description = descriptionInput.value.trim();
    if (titleCount) titleCount.textContent = String(titleInput.value.length);
    if (descriptionCount) descriptionCount.textContent = String(descriptionInput.value.length);
    if (previewYear) previewYear.textContent = formatted.year;
    if (previewTitle) previewTitle.textContent = title || 'Untitled event';
    if (previewDate) {
      previewDate.textContent = formatted.long;
      if (validDate(dateInput.value)) previewDate.dateTime = dateInput.value;
      else previewDate.removeAttribute('datetime');
    }
    if (previewDescription) previewDescription.textContent = description || 'A moment from the Cozy Crafters story.';
    setFormStatus();
  };

  const resetForm = () => {
    form.reset();
    editingId = null;
    clearSelectedImage();
    if (removeImageRow) removeImageRow.hidden = true;
    if (removeImageInput) removeImageInput.checked = false;
    syncPreview();
    setFormStatus();
  };

  const closeEditor = ({ restoreFocus = true } = {}) => {
    const previousId = editingId;
    resetForm();
    editor.hidden = true;
    if (layout) layout.classList.remove('is-editing');
    if (!restoreFocus) return;
    const target = previousId === null
      ? document.querySelector('[data-timeline-admin-add]')
      : list.querySelector(`[data-timeline-event-id="${previousId}"] [data-timeline-event-edit]`);
    if (target && active) target.focus();
  };

  const openEditor = (event = null) => {
    if (activeMutation) return;
    resetForm();
    editingId = event ? event.id : null;
    if (event) {
      titleInput.value = event.title;
      dateInput.value = event.eventDate;
      descriptionInput.value = event.description;
    }
    if (editorTitle) editorTitle.textContent = event ? 'Edit event' : 'Add event';
    if (saveButton) saveButton.textContent = event ? 'Save Changes' : 'Publish Event';
    if (removeImageRow) removeImageRow.hidden = !event || !event.hasImage;
    if (removeImageInput) removeImageInput.checked = false;
    if (imagePickerLabel) imagePickerLabel.textContent = event ? 'Choose a replacement image' : 'Choose an image';
    editor.hidden = false;
    if (layout) layout.classList.add('is-editing');
    syncPreview();
    titleInput.focus({ preventScroll: true });
    editor.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  };

  const acceptSelectedFile = (file) => {
    if (!file) {
      clearSelectedImage();
      return;
    }
    if (!allowedImageTypes.has(file.type)) {
      clearSelectedImage();
      setFormStatus('Choose a PNG, JPEG, or WebP image.', 'error');
      return;
    }
    if (!file.size || file.size > maximumImageSize) {
      clearSelectedImage();
      setFormStatus('The image must be no larger than 8 MB.', 'error');
      return;
    }

    revokeSelectedImageUrl();
    selectedFile = file;
    selectedImageUrl = URL.createObjectURL(file);
    if (imagePreview) imagePreview.src = selectedImageUrl;
    if (imageName) imageName.textContent = file.name;
    if (imageSize) imageSize.textContent = formatFileSize(file.size);
    if (selectedImage) selectedImage.hidden = false;
    if (imagePicker) imagePicker.hidden = true;
    if (removeImageInput) removeImageInput.checked = false;
    setFormStatus();
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

  const loadTimelineEvents = async () => {
    if (activeLoadRequest || activeMutation) return;
    const token = readSession();
    if (!token) {
      document.dispatchEvent(new CustomEvent('cozy-admin-session-expired'));
      return;
    }

    const controller = new AbortController();
    const request = { controller, timeout: window.setTimeout(() => controller.abort(), 10000) };
    activeLoadRequest = request;
    if (loading) loading.hidden = false;
    empty.hidden = true;
    setStatus('Loading timeline events…');
    syncBusy();

    try {
      const response = await fetch(`${ARCHIVE_API}/api/admin/timeline`, {
        method: 'GET',
        headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
        credentials: 'omit',
        cache: 'no-store',
        signal: controller.signal
      });
      const payload = await safeJson(response);
      if (activeLoadRequest !== request) return;
      if (dispatchSessionProblem(response.status)) return;
      if (!response.ok || !payload || payload.ok !== true || !Array.isArray(payload.events)) {
        const fallback = response.status === 404
          ? 'Timeline management is ready here, but its backend connection has not been added yet.'
          : 'Timeline events could not be loaded. Please try again.';
        setStatus(backendError(payload) || fallback, 'error');
        return;
      }

      const nextEvents = payload.events.map(normalizeEvent).filter(Boolean);
      timelineEvents.clear();
      nextEvents.forEach((event) => timelineEvents.set(event.id, event));
      loaded = true;
      renderEvents();
      setStatus(nextEvents.length
        ? `${nextEvents.length} timeline ${nextEvents.length === 1 ? 'event' : 'events'} loaded.`
        : 'No timeline events have been added yet.');
    } catch (error) {
      if (activeLoadRequest !== request) return;
      if (error.name !== 'AbortError') setStatus('Timeline events could not be loaded. Please try again.', 'error');
    } finally {
      window.clearTimeout(request.timeout);
      if (activeLoadRequest === request) activeLoadRequest = null;
      if (loading) loading.hidden = true;
      updateSummary();
      syncBusy();
    }
  };

  const saveTimelineEvent = async () => {
    if (activeMutation || activeLoadRequest) return;
    const title = titleInput.value.trim();
    const eventDate = dateInput.value;
    const description = descriptionInput.value.trim();
    if (!title || title.length > 80) {
      titleInput.setCustomValidity('Enter an event title of 80 characters or fewer.');
      titleInput.reportValidity();
      titleInput.setCustomValidity('');
      return;
    }
    if (!validDate(eventDate)) {
      dateInput.setCustomValidity('Choose a valid event date.');
      dateInput.reportValidity();
      dateInput.setCustomValidity('');
      return;
    }
    if (description.length > 280) return;

    const token = readSession();
    if (!token) {
      document.dispatchEvent(new CustomEvent('cozy-admin-session-expired'));
      return;
    }

    const creating = editingId === null;
    const eventId = editingId;
    const body = new FormData();
    body.append('title', title);
    body.append('eventDate', eventDate);
    body.append('description', description);
    body.append('removeImage', String(Boolean(removeImageInput && removeImageInput.checked && !selectedFile)));
    if (selectedFile) body.append('image', selectedFile, selectedFile.name);

    const controller = new AbortController();
    const request = { controller, timeout: window.setTimeout(() => controller.abort(), 20000), type: 'save' };
    let reloadAfterSave = false;
    activeMutation = request;
    if (saveButton) saveButton.textContent = creating ? 'Publishing…' : 'Saving…';
    setFormStatus(creating ? 'Publishing timeline event…' : 'Saving timeline changes…');
    syncBusy();

    try {
      const response = await fetch(
        creating ? `${ARCHIVE_API}/api/admin/timeline` : `${ARCHIVE_API}/api/admin/timeline/${eventId}`,
        {
          method: creating ? 'POST' : 'PUT',
          headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
          credentials: 'omit',
          body,
          signal: controller.signal
        }
      );
      const payload = await safeJson(response);
      if (activeMutation !== request) return;
      if (dispatchSessionProblem(response.status)) return;
      if (!response.ok || !payload || payload.ok !== true) {
        let message = backendError(payload);
        if (!message && response.status === 413) message = 'The selected image is too large.';
        if (!message && response.status === 404) message = 'Timeline management is not connected to the backend yet.';
        setFormStatus(message || 'The timeline event could not be saved. Please try again.', 'error');
        return;
      }

      const saved = normalizeEvent(payload.event);
      if (saved) timelineEvents.set(saved.id, saved);
      else {
        loaded = false;
        reloadAfterSave = true;
      }
      renderEvents();
      closeEditor({ restoreFocus: false });
      setStatus(creating ? 'Timeline event published.' : 'Timeline event updated.', 'success');
    } catch (error) {
      if (activeMutation !== request) return;
      if (error.name !== 'AbortError') setFormStatus('The timeline event could not be saved. Please try again.', 'error');
    } finally {
      window.clearTimeout(request.timeout);
      if (activeMutation === request) activeMutation = null;
      if (saveButton && !editor.hidden) saveButton.textContent = creating ? 'Publish Event' : 'Save Changes';
      syncBusy();
      if (reloadAfterSave) loadTimelineEvents();
    }
  };

  const closeDeleteDialog = () => {
    deletingId = null;
    if (deleteContext) deleteContext.textContent = '';
    if (deleteDialog && deleteDialog.open) deleteDialog.close();
  };

  const deleteTimelineEvent = async (id) => {
    if (activeMutation || activeLoadRequest || !timelineEvents.has(id)) return;
    const token = readSession();
    if (!token) {
      document.dispatchEvent(new CustomEvent('cozy-admin-session-expired'));
      return;
    }

    const controller = new AbortController();
    const request = { controller, timeout: window.setTimeout(() => controller.abort(), 15000), type: 'delete', id };
    activeMutation = request;
    setStatus('Deleting timeline event…');
    syncBusy();

    try {
      const response = await fetch(`${ARCHIVE_API}/api/admin/timeline/${id}`, {
        method: 'DELETE',
        headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
        credentials: 'omit',
        signal: controller.signal
      });
      const payload = await safeJson(response);
      if (activeMutation !== request) return;
      if (dispatchSessionProblem(response.status)) return;
      if (response.status === 404 || (response.ok && payload && payload.ok === true)) {
        timelineEvents.delete(id);
        if (editingId === id) closeEditor({ restoreFocus: false });
        renderEvents();
        setStatus(response.status === 404
          ? 'That event was already removed. The timeline list was updated.'
          : 'Timeline event deleted.', response.status === 404 ? 'notice' : 'success');
        return;
      }

      setStatus(backendError(payload) || 'The timeline event could not be deleted. Please try again.', 'error');
    } catch (error) {
      if (activeMutation !== request) return;
      if (error.name !== 'AbortError') setStatus('The timeline event could not be deleted. Please try again.', 'error');
    } finally {
      window.clearTimeout(request.timeout);
      if (activeMutation === request) activeMutation = null;
      syncBusy();
    }
  };

  const clearTimelineState = () => {
    if (activeLoadRequest) {
      window.clearTimeout(activeLoadRequest.timeout);
      activeLoadRequest.controller.abort();
      activeLoadRequest = null;
    }
    if (activeMutation) {
      window.clearTimeout(activeMutation.timeout);
      activeMutation.controller.abort();
      activeMutation = null;
    }
    closeDeleteDialog();
    closeEditor({ restoreFocus: false });
    timelineEvents.clear();
    list.replaceChildren();
    loaded = false;
    active = false;
    if (loading) loading.hidden = true;
    setStatus();
    updateSummary();
    syncBusy();
  };

  addButtons.forEach((button) => button.addEventListener('click', () => openEditor()));
  if (editorClose) editorClose.addEventListener('click', () => closeEditor());
  if (editorCancel) editorCancel.addEventListener('click', () => closeEditor());
  titleInput.addEventListener('input', syncPreview);
  dateInput.addEventListener('input', syncPreview);
  descriptionInput.addEventListener('input', syncPreview);
  if (imageInput) imageInput.addEventListener('change', () => acceptSelectedFile(imageInput.files && imageInput.files[0]));
  if (imageClear) imageClear.addEventListener('click', () => clearSelectedImage());
  if (removeImageInput) removeImageInput.addEventListener('change', () => {
    if (removeImageInput.checked) clearSelectedImage();
  });
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    saveTimelineEvent();
  });

  if (deleteDialog && deleteCancel && deleteConfirm) {
    deleteCancel.addEventListener('click', closeDeleteDialog);
    deleteConfirm.addEventListener('click', () => {
      const id = deletingId;
      closeDeleteDialog();
      if (id !== null) deleteTimelineEvent(id);
    });
    deleteDialog.addEventListener('cancel', (event) => {
      event.preventDefault();
      closeDeleteDialog();
    });
    deleteDialog.addEventListener('click', (event) => {
      if (event.target === deleteDialog) closeDeleteDialog();
    });
    deleteDialog.addEventListener('close', () => {
      rootEl.classList.remove('modal-open');
      const id = Number(deleteDialog.dataset.restoreTimelineId);
      delete deleteDialog.dataset.restoreTimelineId;
      const button = list.querySelector(`[data-timeline-event-id="${id}"] [data-timeline-event-delete]`);
      if (button && active && !button.disabled) button.focus();
    });
  }

  document.addEventListener('cozy-admin-tab-change', (event) => {
    active = event.detail && event.detail.tabName === 'timeline';
    if (!active) return;
    syncBusy();
    if (!loaded && !activeLoadRequest) loadTimelineEvents();
  });
  document.addEventListener('cozy-admin-timeline-refresh', () => {
    if (active) loadTimelineEvents();
  });
  document.addEventListener('cozy-admin-leave', clearTimelineState);
  window.addEventListener('pagehide', clearTimelineState, { once: true });

  resetForm();
  updateSummary();
})();
