(() => {
  'use strict';

  const ARCHIVE_API = 'https://cozy-archive.colbysthickey.workers.dev';
  const sessionKey = 'cozyArchiveSession';
  const meEndpoint = `${ARCHIVE_API}/api/me`;
  const uploadEndpoint = `${ARCHIVE_API}/api/upload`;
  const galleryEndpoint = `${ARCHIVE_API}/api/gallery`;
  const myUploadsEndpoint = `${ARCHIVE_API}/api/my/uploads`;
  const allowedImageTypes = new Set(['image/png', 'image/jpeg', 'image/webp']);
  const maximumFileSize = 8 * 1024 * 1024;

  const authPanel = document.querySelector('[data-archive-auth]');
  const authViews = document.querySelectorAll('[data-auth-view]');
  const liveRegion = document.querySelector('[data-archive-auth-live]');
  const authNote = document.querySelector('[data-auth-note]');
  const displayName = document.querySelector('[data-archive-display-name]');
  const logoutButton = document.querySelector('[data-archive-logout]');
  const retryButton = document.querySelector('[data-archive-retry]');
  const uploadOpenButton = document.querySelector('[data-archive-upload-open]');
  const myUploadsOpenButton = document.querySelector('[data-my-uploads-open]');
  const adminPanelLink = document.querySelector('[data-archive-admin-link]');
  const rootEl = document.documentElement;
  const modeToggle = document.querySelector('.mode-toggle');
  const themeMeta = document.querySelector('meta[name="theme-color"]');

  const uploadDialog = document.querySelector('#archive-upload-dialog');
  const uploadViews = document.querySelectorAll('[data-upload-view]');
  const uploadForm = document.querySelector('[data-archive-upload-form]');
  const fileInput = document.querySelector('[data-archive-file]');
  const chooseFileButton = document.querySelector('[data-archive-file-choose]');
  const changeFileButton = document.querySelector('[data-archive-file-change]');
  const dropZone = document.querySelector('[data-archive-drop-zone]');
  const selectedFilePanel = document.querySelector('[data-archive-selected]');
  const previewImage = document.querySelector('[data-archive-preview]');
  const fileName = document.querySelector('[data-archive-file-name]');
  const fileSize = document.querySelector('[data-archive-file-size]');
  const captionInput = document.querySelector('[data-archive-caption]');
  const captionCounter = document.querySelector('[data-archive-caption-count]');
  const uploadStatus = document.querySelector('[data-archive-upload-status]');
  const uploadSubmitButton = document.querySelector('[data-archive-upload-submit]');
  const uploadSubmitLabel = document.querySelector('[data-archive-submit-label]');
  const uploadCancelButton = document.querySelector('[data-archive-upload-cancel]');
  const uploadCloseButton = document.querySelector('[data-archive-upload-close]');
  const uploadDoneButton = document.querySelector('[data-archive-upload-done]');

  const myUploadsDialog = document.querySelector('#archive-my-uploads-dialog');
  const myUploadsCloseButton = document.querySelector('[data-my-uploads-close]');
  const myUploadsRefreshButton = document.querySelector('[data-my-uploads-refresh]');
  const myUploadsRefreshLabel = document.querySelector('[data-my-uploads-refresh-label]');
  const myUploadsRetryButton = document.querySelector('[data-my-uploads-retry]');
  const myUploadsEmptyUploadButton = document.querySelector('[data-my-uploads-empty-upload]');
  const myUploadsStatus = document.querySelector('[data-my-uploads-status]');
  const myUploadsLoading = document.querySelector('[data-my-uploads-loading]');
  const myUploadsError = document.querySelector('[data-my-uploads-error]');
  const myUploadsEmpty = document.querySelector('[data-my-uploads-empty]');
  const myUploadsGrid = document.querySelector('[data-my-uploads-grid]');
  const myUploadsMoreButton = document.querySelector('[data-my-uploads-more]');

  const gallery = document.querySelector('[data-archive-gallery]');
  const galleryEmpty = document.querySelector('[data-gallery-empty]');
  const galleryError = document.querySelector('[data-gallery-error]');
  const galleryRetryButton = document.querySelector('[data-gallery-retry]');
  const galleryMoreButton = document.querySelector('[data-gallery-more]');
  const galleryStatus = document.querySelector('[data-gallery-status]');
  const lightboxDialog = document.querySelector('#archive-lightbox');
  const lightboxCloseButton = document.querySelector('[data-lightbox-close]');
  const lightboxMedia = document.querySelector('[data-lightbox-media]');
  const lightboxLoading = document.querySelector('[data-lightbox-loading]');
  const lightboxImage = document.querySelector('[data-lightbox-image]');
  const lightboxUnavailable = document.querySelector('[data-lightbox-unavailable]');
  const lightboxCaption = document.querySelector('[data-lightbox-caption]');
  const lightboxUploader = document.querySelector('[data-lightbox-uploader]');
  const lightboxDate = document.querySelector('[data-lightbox-date]');

  let activeAuthRequest = null;
  let activeUploadRequest = null;
  let selectedFile = null;
  let previewUrl = null;
  let restoreUploadFocus = true;
  let uploaderReady = false;
  let closeUploaderForAuthChange = () => {};
  let myUploadsReady = false;
  let restoreMyUploadsFocus = true;
  let closeMyUploadsForAuthChange = () => {};
  let activeMyUploadsRequest = null;
  let nextMyUploadsCursor = null;
  let myUploadsStale = true;
  let activeGalleryRequest = null;
  let nextGalleryCursor = null;
  let lightboxTrigger = null;
  const renderedGalleryIds = new Set();
  const renderedMyUploadIds = new Set();
  const activeMyUploadImageRequests = new Map();
  const myUploadObjectUrls = new Map();

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
    if (uploadOpenButton) uploadOpenButton.disabled = state !== 'logged-in' || !uploaderReady;
    if (myUploadsOpenButton) {
      myUploadsOpenButton.hidden = state !== 'logged-in' || !myUploadsReady;
      myUploadsOpenButton.disabled = state !== 'logged-in' || !myUploadsReady;
    }
    if (state !== 'logged-in' && adminPanelLink) adminPanelLink.hidden = true;
    if (state !== 'logged-in') {
      closeUploaderForAuthChange();
      closeMyUploadsForAuthChange();
    }
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

  const expireSession = () => {
    removeSession();
    if (displayName) displayName.textContent = '';
    setAuthState('logged-out', 'Your archive session expired. Please sign in again.');
  };

  const verifyStoredSession = async () => {
    const token = readSession();
    if (!token) {
      setAuthState('logged-out');
      return;
    }

    if (activeAuthRequest) activeAuthRequest.abort();
    const controller = new AbortController();
    activeAuthRequest = controller;
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

      if (activeAuthRequest !== controller) return;

      if (response.status === 401) {
        expireSession();
        return;
      }

      if (!response.ok) {
        setAuthState('unavailable', 'Archive login status is temporarily unavailable.');
        return;
      }

      const payload = await safeResponseJson(response);
      const safeName = getSafeDisplayName(payload);
      if (!safeName) {
        setAuthState('unavailable', 'Archive login status is temporarily unavailable.');
        return;
      }

      displayName.textContent = safeName;
      setAuthState('logged-in', `Signed in as ${safeName}.`);
      if (adminPanelLink) adminPanelLink.hidden = payload.user.isAdmin !== true;
    } catch (error) {
      if (activeAuthRequest !== controller) return;
      setAuthState('unavailable', 'Archive login status is temporarily unavailable.');
    } finally {
      window.clearTimeout(timeout);
      if (activeAuthRequest === controller) activeAuthRequest = null;
    }
  };

  const revokePreview = () => {
    if (!previewUrl) return;
    URL.revokeObjectURL(previewUrl);
    previewUrl = null;
  };

  const setUploadStatus = (message = '', state = '') => {
    if (!uploadStatus) return;
    uploadStatus.textContent = message;
    if (state) uploadStatus.dataset.state = state;
    else delete uploadStatus.dataset.state;
  };

  const updateCaptionCounter = () => {
    if (!captionInput || !captionCounter) return;
    if (captionInput.value.length > 240) captionInput.value = captionInput.value.slice(0, 240);
    captionCounter.textContent = `${captionInput.value.length} / 240`;
  };

  const formatFileSize = (bytes) => {
    if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const clearSelectedFile = () => {
    revokePreview();
    selectedFile = null;
    if (fileInput) fileInput.value = '';
    if (previewImage) previewImage.removeAttribute('src');
    if (fileName) fileName.textContent = '';
    if (fileSize) fileSize.textContent = '';
    if (selectedFilePanel) selectedFilePanel.hidden = true;
    if (dropZone) dropZone.hidden = false;
    if (uploadSubmitButton) uploadSubmitButton.disabled = true;
  };

  const setUploading = (uploading) => {
    if (!uploadForm) return;
    uploadForm.setAttribute('aria-busy', String(uploading));
    if (uploadDialog) uploadDialog.dataset.uploading = String(uploading);
    if (fileInput) fileInput.disabled = uploading;
    if (chooseFileButton) chooseFileButton.disabled = uploading;
    if (changeFileButton) changeFileButton.disabled = uploading;
    if (captionInput) captionInput.disabled = uploading;
    if (uploadCancelButton) uploadCancelButton.disabled = uploading;
    if (uploadCloseButton) uploadCloseButton.disabled = uploading;
    if (dropZone) dropZone.setAttribute('aria-disabled', String(uploading));
    if (uploadSubmitButton) uploadSubmitButton.disabled = uploading || !selectedFile;
    if (uploadSubmitLabel) uploadSubmitLabel.textContent = uploading ? 'Uploading…' : 'Submit for Review';
  };

  const setUploadView = (viewName) => {
    uploadViews.forEach((view) => {
      view.hidden = view.dataset.uploadView !== viewName;
    });
  };

  const resetUploader = ({ abortActive = false } = {}) => {
    if (abortActive && activeUploadRequest) {
      const request = activeUploadRequest;
      activeUploadRequest = null;
      request.abort();
    }
    if (uploadForm) uploadForm.reset();
    clearSelectedFile();
    updateCaptionCounter();
    setUploadStatus();
    setUploading(false);
    setUploadView('form');
    if (dropZone) dropZone.classList.remove('is-dragging');
  };

  const closeUploadDialog = ({ force = false, restoreFocus = true } = {}) => {
    if (!uploadDialog) return false;
    if (activeUploadRequest && !force) return false;
    restoreUploadFocus = restoreFocus;
    resetUploader({ abortActive: force });
    if (uploadDialog.open) uploadDialog.close();
    return true;
  };

  closeUploaderForAuthChange = () => {
    closeUploadDialog({ force: true, restoreFocus: false });
  };

  const validateFile = (file) => {
    if (!file || file.size === 0) return 'Please choose a screenshot that is not empty.';
    if (!allowedImageTypes.has(file.type)) return 'Please choose a PNG, JPEG, or WebP image.';
    if (file.size > maximumFileSize) return 'Screenshots must be 8 MB or smaller.';
    return '';
  };

  const selectFile = (file) => {
    const errorMessage = validateFile(file);
    if (errorMessage) {
      clearSelectedFile();
      setUploadStatus(errorMessage, 'error');
      return false;
    }

    revokePreview();
    selectedFile = file;
    previewUrl = URL.createObjectURL(file);
    previewImage.src = previewUrl;
    fileName.textContent = file.name || 'Selected screenshot';
    fileSize.textContent = formatFileSize(file.size);
    dropZone.hidden = true;
    selectedFilePanel.hidden = false;
    uploadSubmitButton.disabled = false;
    setUploadStatus();
    return true;
  };

  const safeResponseJson = async (response) => {
    try {
      return await response.json();
    } catch (error) {
      return null;
    }
  };

  const reasonableGalleryText = (value, maximumLength, { optional = false } = {}) => {
    if (value === null || value === undefined) return optional ? '' : null;
    if (typeof value !== 'string') return null;
    const text = value.trim();
    if (!text) return optional ? '' : null;
    return text.length <= maximumLength ? text : null;
  };

  const parseGalleryDate = (value) => {
    const source = reasonableGalleryText(value, 80);
    if (!source) return null;
    const sqliteMatch = source.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})(?:\.\d+)?$/);
    const normalized = sqliteMatch
      ? `${sqliteMatch[1]}-${sqliteMatch[2]}-${sqliteMatch[3]}T${sqliteMatch[4]}:${sqliteMatch[5]}:${sqliteMatch[6]}Z`
      : source;
    const date = new Date(normalized);
    if (Number.isNaN(date.getTime())) return null;

    try {
      return {
        iso: date.toISOString(),
        display: new Intl.DateTimeFormat(undefined, {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          timeZone: 'UTC'
        }).format(date)
      };
    } catch (error) {
      return {
        iso: date.toISOString(),
        display: date.toISOString().slice(0, 10)
      };
    }
  };

  const getSafeGalleryImageUrl = (value, id) => {
    if (typeof value !== 'string' || value.length > 1000) return null;
    try {
      const url = new URL(value);
      const expectedPath = `/api/gallery/uploads/${id}/image`;
      if (
        url.protocol !== 'https:'
        || url.origin !== ARCHIVE_API
        || url.pathname !== expectedPath
        || url.username
        || url.password
        || url.search
        || url.hash
      ) return null;
      return url.href;
    } catch (error) {
      return null;
    }
  };

  const normalizeGalleryUpload = (value) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const id = Number(value.id);
    if (!Number.isSafeInteger(id) || id <= 0) return null;
    const uploader = reasonableGalleryText(value.uploader, 80);
    const caption = reasonableGalleryText(value.caption, 240, { optional: true });
    const date = parseGalleryDate(value.uploadedAt);
    const imageUrl = getSafeGalleryImageUrl(value.imageUrl, id);
    if (!uploader || caption === null || !date || !imageUrl) return null;
    return { id, uploader, caption, date, imageUrl };
  };

  const myUploadStatusDetails = {
    pending: {
      label: 'Pending Review',
      message: 'Your screenshot is waiting for approval.'
    },
    approved: {
      label: 'Published',
      message: 'This screenshot is visible in the Community Archive.'
    },
    rejected: {
      label: 'Not Approved',
      message: 'This submission was not added to the Community Archive.'
    },
    removed: {
      label: 'Removed from Archive',
      message: 'This screenshot is no longer published in the Community Archive.'
    },
    unknown: {
      label: 'Unavailable',
      message: 'The current status of this submission is unavailable.'
    }
  };

  const getSafeMyUploadImageUrl = (value, id) => {
    if (typeof value !== 'string' || value.length > 1000) return null;
    try {
      const url = new URL(value);
      const expectedPath = `/api/my/uploads/${id}/image`;
      if (
        url.protocol !== 'https:'
        || url.origin !== ARCHIVE_API
        || url.pathname !== expectedPath
        || url.username
        || url.password
        || url.search
        || url.hash
      ) return null;
      return url.href;
    } catch (error) {
      return null;
    }
  };

  const normalizeMyUpload = (value) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const id = Number(value.id);
    if (!Number.isSafeInteger(id) || id <= 0) return null;
    const caption = reasonableGalleryText(value.caption, 240, { optional: true });
    if (caption === null) return null;
    const rawStatus = reasonableGalleryText(value.status, 30, { optional: true });
    const status = rawStatus && Object.prototype.hasOwnProperty.call(myUploadStatusDetails, rawStatus)
      ? rawStatus
      : 'unknown';
    const fileSizeValue = Number(value.fileSize);
    const fileSize = Number.isFinite(fileSizeValue) && fileSizeValue >= 0 ? fileSizeValue : null;
    const imageUrl = getSafeMyUploadImageUrl(value.imageUrl, id);
    const canLoadImage = value.hasImage === true
      && (status === 'pending' || status === 'approved')
      && Boolean(imageUrl);
    return {
      id,
      caption,
      status,
      mimeType: reasonableGalleryText(value.mimeType, 80, { optional: true }) || '',
      fileSize,
      uploadedAt: parseGalleryDate(value.uploadedAt),
      reviewedAt: parseGalleryDate(value.reviewedAt),
      removedAt: parseGalleryDate(value.removedAt),
      imageUrl,
      canLoadImage
    };
  };

  const friendlyMyUploadType = (mimeType) => {
    if (mimeType === 'image/png') return 'PNG';
    if (mimeType === 'image/jpeg') return 'JPEG';
    if (mimeType === 'image/webp') return 'WebP';
    return 'Image';
  };

  const createMyUploadsTextElement = (tagName, className, text) => {
    const element = document.createElement(tagName);
    if (className) element.className = className;
    element.textContent = text;
    return element;
  };

  const setMyUploadsStatus = (message = '', state = '') => {
    if (!myUploadsStatus) return;
    myUploadsStatus.textContent = message;
    if (state) myUploadsStatus.dataset.state = state;
    else delete myUploadsStatus.dataset.state;
  };

  const revokeMyUploadObjectUrl = (id) => {
    const objectUrl = myUploadObjectUrls.get(id);
    if (!objectUrl) return;
    URL.revokeObjectURL(objectUrl);
    myUploadObjectUrls.delete(id);
  };

  const abortMyUploadImageRequest = (id) => {
    const request = activeMyUploadImageRequests.get(id);
    if (!request) return;
    window.clearTimeout(request.timeout);
    request.controller.abort();
    activeMyUploadImageRequests.delete(id);
  };

  const clearMyUploadImages = () => {
    Array.from(activeMyUploadImageRequests.keys()).forEach(abortMyUploadImageRequest);
    myUploadObjectUrls.forEach((objectUrl) => URL.revokeObjectURL(objectUrl));
    myUploadObjectUrls.clear();
  };

  const abortMyUploadsListRequest = () => {
    if (!activeMyUploadsRequest) return;
    window.clearTimeout(activeMyUploadsRequest.timeout);
    activeMyUploadsRequest.controller.abort();
    activeMyUploadsRequest = null;
  };

  const setMyUploadsRequestState = (loading, { append = false } = {}) => {
    if (myUploadsRefreshButton) myUploadsRefreshButton.disabled = loading;
    if (myUploadsRefreshLabel) myUploadsRefreshLabel.textContent = loading && !append ? 'Refreshing…' : 'Refresh';
    if (myUploadsMoreButton) myUploadsMoreButton.disabled = loading;
    if (myUploadsGrid) myUploadsGrid.setAttribute('aria-busy', String(loading));
  };

  const resetMyUploadsState = ({ abortList = true, markStale = true } = {}) => {
    if (abortList) abortMyUploadsListRequest();
    clearMyUploadImages();
    renderedMyUploadIds.clear();
    nextMyUploadsCursor = null;
    if (myUploadsGrid) myUploadsGrid.replaceChildren();
    if (myUploadsLoading) myUploadsLoading.hidden = true;
    if (myUploadsError) myUploadsError.hidden = true;
    if (myUploadsEmpty) myUploadsEmpty.hidden = true;
    if (myUploadsMoreButton) myUploadsMoreButton.hidden = true;
    setMyUploadsRequestState(false);
    setMyUploadsStatus();
    if (markStale) myUploadsStale = true;
  };

  const showMyUploadImageUnavailable = (card) => {
    const loading = card.querySelector('[data-my-upload-image-loading]');
    const image = card.querySelector('[data-my-upload-image]');
    const unavailable = card.querySelector('[data-my-upload-image-unavailable]');
    if (loading) loading.hidden = true;
    if (image) {
      image.hidden = true;
      image.removeAttribute('src');
    }
    if (unavailable) unavailable.hidden = false;
  };

  const loadMyUploadImage = async (upload, card) => {
    if (!upload.canLoadImage || activeMyUploadImageRequests.has(upload.id)) return;
    const token = readSession();
    if (!token) {
      expireSession();
      return;
    }

    const controller = new AbortController();
    const request = {
      controller,
      timeout: window.setTimeout(() => controller.abort(), 12000)
    };
    activeMyUploadImageRequests.set(upload.id, request);

    try {
      const response = await fetch(upload.imageUrl, {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` },
        credentials: 'omit',
        cache: 'no-store',
        signal: controller.signal
      });
      if (activeMyUploadImageRequests.get(upload.id) !== request || !card.isConnected) return;
      if (response.status === 401) {
        expireSession();
        return;
      }
      if (!response.ok) {
        showMyUploadImageUnavailable(card);
        return;
      }

      const blob = await response.blob();
      if (activeMyUploadImageRequests.get(upload.id) !== request || !card.isConnected) return;
      if (!blob.size) {
        showMyUploadImageUnavailable(card);
        return;
      }

      const objectUrl = URL.createObjectURL(blob);
      myUploadObjectUrls.set(upload.id, objectUrl);
      const image = card.querySelector('[data-my-upload-image]');
      const loading = card.querySelector('[data-my-upload-image-loading]');
      const unavailable = card.querySelector('[data-my-upload-image-unavailable]');
      image.addEventListener('load', () => {
        if (loading) loading.hidden = true;
        if (unavailable) unavailable.hidden = true;
        image.hidden = false;
      }, { once: true });
      image.addEventListener('error', () => {
        revokeMyUploadObjectUrl(upload.id);
        showMyUploadImageUnavailable(card);
      }, { once: true });
      image.src = objectUrl;
    } catch (error) {
      if (activeMyUploadImageRequests.get(upload.id) === request && error.name !== 'AbortError') {
        showMyUploadImageUnavailable(card);
      }
    } finally {
      window.clearTimeout(request.timeout);
      if (activeMyUploadImageRequests.get(upload.id) === request) activeMyUploadImageRequests.delete(upload.id);
    }
  };

  const appendMyUploadDate = (container, label, date) => {
    if (!date) return;
    const row = document.createElement('p');
    const time = document.createElement('time');
    time.dateTime = date.iso;
    time.textContent = `${label} ${date.display}`;
    row.append(time);
    container.append(row);
  };

  const createMyUploadCard = (upload) => {
    const details = myUploadStatusDetails[upload.status];
    const card = document.createElement('article');
    card.className = `archive-my-upload-card status-${upload.status}${upload.caption ? '' : ' has-no-caption'}`;
    card.dataset.myUploadId = String(upload.id);

    const media = document.createElement('div');
    media.className = 'archive-my-upload-media';
    const image = document.createElement('img');
    image.dataset.myUploadImage = '';
    image.alt = upload.caption
      ? `${upload.caption} — your Community Archive screenshot`
      : 'Your Community Archive screenshot';
    image.hidden = true;
    const loading = createMyUploadsTextElement('span', 'archive-my-upload-image-loading', 'Loading screenshot…');
    loading.dataset.myUploadImageLoading = '';
    const unavailable = createMyUploadsTextElement(
      'span',
      'archive-my-upload-image-unavailable',
      upload.status === 'rejected' || upload.status === 'removed'
        ? 'Screenshot image no longer available.'
        : 'Screenshot preview unavailable.'
    );
    unavailable.dataset.myUploadImageUnavailable = '';
    unavailable.setAttribute('role', 'img');
    unavailable.setAttribute('aria-label', unavailable.textContent);
    unavailable.hidden = upload.canLoadImage;
    loading.hidden = !upload.canLoadImage;
    media.append(image, loading, unavailable);

    const content = document.createElement('div');
    content.className = 'archive-my-upload-content';
    if (upload.caption) content.append(createMyUploadsTextElement('h3', '', upload.caption));
    const badge = createMyUploadsTextElement('span', `archive-my-upload-status status-${upload.status}`, details.label);
    const message = createMyUploadsTextElement('p', 'archive-my-upload-message', details.message);
    const metadata = document.createElement('div');
    metadata.className = 'archive-my-upload-meta';
    appendMyUploadDate(metadata, 'Submitted', upload.uploadedAt);
    if (upload.status === 'approved') appendMyUploadDate(metadata, 'Published', upload.reviewedAt);
    if (upload.status === 'removed') appendMyUploadDate(metadata, 'Removed', upload.removedAt);
    if (upload.fileSize !== null || upload.mimeType) {
      const fileDetails = upload.fileSize !== null
        ? `${formatFileSize(upload.fileSize)} · ${friendlyMyUploadType(upload.mimeType)}`
        : friendlyMyUploadType(upload.mimeType);
      metadata.append(createMyUploadsTextElement('p', '', fileDetails));
    }
    content.append(badge, message, metadata);
    card.append(media, content);
    return card;
  };

  const appendMyUploads = (values) => {
    if (!myUploadsGrid) return 0;
    const fragment = document.createDocumentFragment();
    const added = [];
    values.forEach((value) => {
      const upload = normalizeMyUpload(value);
      if (!upload || renderedMyUploadIds.has(upload.id)) return;
      renderedMyUploadIds.add(upload.id);
      const card = createMyUploadCard(upload);
      fragment.append(card);
      added.push({ upload, card });
    });
    myUploadsGrid.append(fragment);
    added.forEach(({ upload, card }) => loadMyUploadImage(upload, card));
    return added.length;
  };

  const getNextMyUploadsCursor = (payload, requestedCursor) => {
    if (!payload || payload.hasMore !== true) return null;
    if (typeof payload.nextCursor !== 'string' && typeof payload.nextCursor !== 'number') return null;
    const cursor = String(payload.nextCursor).trim();
    if (!cursor || cursor.length > 500 || cursor === requestedCursor) return null;
    return cursor;
  };

  const showMyUploadsListError = ({ append = false } = {}) => {
    if (myUploadsLoading) myUploadsLoading.hidden = true;
    if (append) {
      if (myUploadsMoreButton) myUploadsMoreButton.hidden = false;
      setMyUploadsStatus('More uploads could not be loaded. Please try again.', 'error');
      return;
    }
    if (myUploadsError) myUploadsError.hidden = false;
    if (myUploadsEmpty) myUploadsEmpty.hidden = true;
    setMyUploadsStatus("Your uploads couldn't be loaded right now.", 'error');
  };

  const loadMyUploads = async ({ append = false } = {}) => {
    if (!myUploadsReady || activeMyUploadsRequest) return;
    if (append && !nextMyUploadsCursor) return;
    const token = readSession();
    if (!token) {
      expireSession();
      return;
    }

    const requestedCursor = append ? nextMyUploadsCursor : null;
    if (!append) {
      resetMyUploadsState({ abortList: false, markStale: true });
      if (myUploadsLoading) myUploadsLoading.hidden = false;
    }

    const requestUrl = new URL(myUploadsEndpoint);
    requestUrl.searchParams.set('limit', '30');
    if (requestedCursor) requestUrl.searchParams.set('before', requestedCursor);
    const controller = new AbortController();
    const request = {
      controller,
      append,
      timeout: window.setTimeout(() => controller.abort(), 10000)
    };
    activeMyUploadsRequest = request;
    setMyUploadsRequestState(true, { append });
    setMyUploadsStatus(append ? 'Loading more uploads…' : 'Loading your uploads…');

    try {
      const response = await fetch(requestUrl.href, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${token}`
        },
        credentials: 'omit',
        cache: 'no-store',
        signal: controller.signal
      });
      const payload = await safeResponseJson(response);
      if (activeMyUploadsRequest !== request) return;
      if (response.status === 401) {
        expireSession();
        return;
      }
      if (response.status === 403) {
        showMyUploadsListError({ append });
        return;
      }
      if (!response.ok || !payload || payload.ok !== true || !Array.isArray(payload.uploads)) {
        showMyUploadsListError({ append });
        return;
      }

      const appended = appendMyUploads(payload.uploads);
      nextMyUploadsCursor = getNextMyUploadsCursor(payload, requestedCursor);
      myUploadsStale = false;
      if (myUploadsLoading) myUploadsLoading.hidden = true;
      if (myUploadsError) myUploadsError.hidden = true;
      if (myUploadsEmpty) myUploadsEmpty.hidden = renderedMyUploadIds.size !== 0;
      if (myUploadsMoreButton) myUploadsMoreButton.hidden = nextMyUploadsCursor === null;
      if (renderedMyUploadIds.size === 0) {
        setMyUploadsStatus('No uploads yet.');
      } else if (append) {
        setMyUploadsStatus(appended
          ? `${appended} more ${appended === 1 ? 'upload' : 'uploads'} added.`
          : 'Your uploads are up to date.');
      } else {
        setMyUploadsStatus(`${renderedMyUploadIds.size} ${renderedMyUploadIds.size === 1 ? 'upload' : 'uploads'} loaded.`);
      }
    } catch (error) {
      if (activeMyUploadsRequest !== request || error.name === 'AbortError') return;
      showMyUploadsListError({ append });
    } finally {
      window.clearTimeout(request.timeout);
      if (activeMyUploadsRequest === request) {
        activeMyUploadsRequest = null;
        setMyUploadsRequestState(false);
      }
    }
  };

  const refreshMyUploads = () => {
    abortMyUploadsListRequest();
    resetMyUploadsState({ abortList: false, markStale: true });
    loadMyUploads();
  };

  const closeMyUploadsDialog = ({ restoreFocus = true } = {}) => {
    restoreMyUploadsFocus = restoreFocus;
    resetMyUploadsState({ abortList: true, markStale: true });
    if (myUploadsDialog && myUploadsDialog.open) myUploadsDialog.close();
  };

  closeMyUploadsForAuthChange = () => {
    closeMyUploadsDialog({ restoreFocus: false });
  };

  const markMyUploadsStale = () => {
    myUploadsStale = true;
    if (myUploadsDialog && myUploadsDialog.open && !activeMyUploadsRequest) refreshMyUploads();
  };

  const createGallerySkeletons = () => {
    if (!gallery) return;
    const fragment = document.createDocumentFragment();
    for (let index = 0; index < 6; index += 1) {
      const skeleton = document.createElement('div');
      const image = document.createElement('span');
      const lineOne = document.createElement('i');
      const lineTwo = document.createElement('i');
      skeleton.className = 'archive-gallery-skeleton';
      skeleton.setAttribute('aria-hidden', 'true');
      skeleton.append(image, lineOne, lineTwo);
      fragment.append(skeleton);
    }
    gallery.replaceChildren(fragment);
  };

  const setGalleryStatus = (message = '', state = '') => {
    if (!galleryStatus) return;
    galleryStatus.textContent = message;
    if (state) galleryStatus.dataset.state = state;
    else delete galleryStatus.dataset.state;
  };

  const resetLightbox = () => {
    if (lightboxImage) {
      lightboxImage.onload = null;
      lightboxImage.onerror = null;
      lightboxImage.removeAttribute('src');
      lightboxImage.alt = '';
      lightboxImage.hidden = true;
    }
    if (lightboxLoading) lightboxLoading.hidden = false;
    if (lightboxUnavailable) lightboxUnavailable.hidden = true;
    if (lightboxCaption) {
      lightboxCaption.textContent = '';
      lightboxCaption.hidden = true;
    }
    if (lightboxUploader) lightboxUploader.textContent = '';
    if (lightboxDate) {
      lightboxDate.textContent = '';
      lightboxDate.removeAttribute('datetime');
    }
    if (lightboxMedia) lightboxMedia.dataset.state = 'loading';
  };

  const closeLightbox = () => {
    if (lightboxDialog && lightboxDialog.open) lightboxDialog.close();
  };

  const openLightbox = (memory, trigger) => {
    if (!lightboxDialog || typeof lightboxDialog.showModal !== 'function' || lightboxDialog.open) return;
    lightboxTrigger = trigger;
    resetLightbox();

    const altText = memory.caption
      ? `${memory.caption} — screenshot shared by ${memory.uploader}`
      : `Screenshot shared by ${memory.uploader}`;
    if (lightboxCaption) {
      lightboxCaption.textContent = memory.caption;
      lightboxCaption.hidden = !memory.caption;
    }
    lightboxUploader.textContent = memory.uploader;
    lightboxDate.textContent = memory.date.display;
    lightboxDate.dateTime = memory.date.iso;
    lightboxImage.alt = altText;
    lightboxImage.onload = () => {
      lightboxMedia.dataset.state = 'loaded';
      lightboxLoading.hidden = true;
      lightboxUnavailable.hidden = true;
      lightboxImage.hidden = false;
    };
    lightboxImage.onerror = () => {
      lightboxMedia.dataset.state = 'error';
      lightboxLoading.hidden = true;
      lightboxImage.hidden = true;
      lightboxUnavailable.hidden = false;
    };
    lightboxImage.src = memory.imageUrl;
    rootEl.classList.add('modal-open');
    lightboxDialog.showModal();
    window.requestAnimationFrame(() => lightboxCloseButton.focus());
  };

  const createGalleryCard = (memory, position) => {
    const article = document.createElement('article');
    const imageButton = document.createElement('button');
    const media = document.createElement('span');
    const loading = document.createElement('span');
    const image = document.createElement('img');
    const unavailable = document.createElement('span');
    const content = document.createElement('div');
    const sharedBy = document.createElement('p');
    const uploader = document.createElement('strong');
    const date = document.createElement('time');

    article.className = `archive-memory-card section-card${memory.caption ? '' : ' has-no-caption'}`;
    imageButton.className = 'archive-memory-image-button';
    imageButton.type = 'button';
    imageButton.setAttribute('aria-haspopup', 'dialog');
    imageButton.setAttribute('aria-controls', 'archive-lightbox');
    imageButton.setAttribute(
      'aria-label',
      memory.caption
        ? `View ${memory.caption}, a screenshot shared by ${memory.uploader}`
        : `View screenshot shared by ${memory.uploader}`
    );
    media.className = 'archive-memory-media';
    loading.className = 'archive-memory-image-loading';
    loading.textContent = 'Loading screenshot…';
    unavailable.className = 'archive-memory-image-unavailable';
    unavailable.textContent = 'Screenshot unavailable.';
    unavailable.hidden = true;

    image.alt = memory.caption
      ? `${memory.caption} — screenshot shared by ${memory.uploader}`
      : `Screenshot shared by ${memory.uploader}`;
    image.loading = position < 3 ? 'eager' : 'lazy';
    image.decoding = 'async';
    image.referrerPolicy = 'no-referrer';
    image.hidden = true;
    image.onload = () => {
      loading.hidden = true;
      unavailable.hidden = true;
      image.hidden = false;
      media.classList.add('is-loaded');
    };
    image.onerror = () => {
      loading.hidden = true;
      image.hidden = true;
      unavailable.hidden = false;
      media.classList.add('has-error');
    };
    image.src = memory.imageUrl;

    media.append(loading, image, unavailable);
    imageButton.append(media);
    imageButton.addEventListener('click', () => openLightbox(memory, imageButton));

    content.className = 'archive-memory-content';
    if (memory.caption) {
      const caption = document.createElement('h3');
      caption.textContent = memory.caption;
      content.append(caption);
    }
    sharedBy.className = 'archive-memory-uploader';
    sharedBy.append(document.createTextNode('by '));
    uploader.textContent = memory.uploader;
    sharedBy.append(uploader);
    date.className = 'archive-memory-date';
    date.dateTime = memory.date.iso;
    date.textContent = memory.date.display;
    content.append(sharedBy, date);
    article.append(imageButton, content);
    return article;
  };

  const appendGalleryUploads = (values) => {
    if (!gallery) return 0;
    const fragment = document.createDocumentFragment();
    let appended = 0;
    values.forEach((value) => {
      const memory = normalizeGalleryUpload(value);
      if (!memory || renderedGalleryIds.has(memory.id)) return;
      const position = renderedGalleryIds.size;
      renderedGalleryIds.add(memory.id);
      fragment.append(createGalleryCard(memory, position));
      appended += 1;
    });
    gallery.append(fragment);
    return appended;
  };

  const getNextGalleryCursor = (payload, requestedCursor) => {
    if (!payload || payload.hasMore !== true) return null;
    if (typeof payload.nextCursor !== 'string' && typeof payload.nextCursor !== 'number') return null;
    const cursor = String(payload.nextCursor).trim();
    if (!cursor || cursor.length > 500 || cursor === requestedCursor) return null;
    return cursor;
  };

  const setGalleryButtonState = (loadingMore) => {
    if (!galleryMoreButton) return;
    galleryMoreButton.disabled = loadingMore;
    galleryMoreButton.textContent = loadingMore ? 'Loading…' : 'Load More Memories';
  };

  const loadGallery = async ({ append = false } = {}) => {
    if (!gallery || !galleryEmpty || !galleryError || !galleryMoreButton) return;
    if (append && (activeGalleryRequest || !nextGalleryCursor)) return;

    if (!append && activeGalleryRequest) {
      window.clearTimeout(activeGalleryRequest.timeout);
      activeGalleryRequest.controller.abort();
      activeGalleryRequest = null;
    }

    const requestedCursor = append ? nextGalleryCursor : null;
    if (!append) {
      renderedGalleryIds.clear();
      nextGalleryCursor = null;
      galleryEmpty.hidden = true;
      galleryError.hidden = true;
      galleryMoreButton.hidden = true;
      createGallerySkeletons();
      setGalleryStatus('Loading community memories…');
    } else {
      setGalleryStatus('Loading more community memories…');
    }

    const requestUrl = new URL(galleryEndpoint);
    requestUrl.searchParams.set('limit', '24');
    if (requestedCursor) requestUrl.searchParams.set('before', requestedCursor);

    const controller = new AbortController();
    const request = {
      controller,
      append,
      timeout: window.setTimeout(() => controller.abort(), 9000)
    };
    activeGalleryRequest = request;
    gallery.setAttribute('aria-busy', 'true');
    setGalleryButtonState(append);

    try {
      const response = await fetch(requestUrl.href, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        credentials: 'omit',
        cache: 'no-store',
        signal: controller.signal
      });
      const payload = await safeResponseJson(response);
      if (activeGalleryRequest !== request) return;
      if (!response.ok || !payload || payload.ok !== true || !Array.isArray(payload.uploads)) {
        throw new Error('Gallery response unavailable');
      }

      if (!append) gallery.replaceChildren();
      const appended = appendGalleryUploads(payload.uploads);
      nextGalleryCursor = getNextGalleryCursor(payload, requestedCursor);
      galleryError.hidden = true;
      galleryEmpty.hidden = renderedGalleryIds.size !== 0;
      galleryMoreButton.hidden = nextGalleryCursor === null;

      if (renderedGalleryIds.size === 0) {
        setGalleryStatus('No community memories have been added yet.');
      } else if (append) {
        setGalleryStatus(appended
          ? `${appended} more ${appended === 1 ? 'memory' : 'memories'} added.`
          : 'The gallery is up to date.');
      } else {
        setGalleryStatus(`${renderedGalleryIds.size} community ${renderedGalleryIds.size === 1 ? 'memory' : 'memories'} loaded.`);
      }
    } catch (error) {
      if (activeGalleryRequest !== request) return;
      if (append) {
        galleryMoreButton.hidden = false;
        setGalleryStatus('More memories could not be loaded. Please try again.', 'error');
      } else {
        gallery.replaceChildren();
        galleryEmpty.hidden = true;
        galleryError.hidden = false;
        galleryMoreButton.hidden = true;
        setGalleryStatus('The Community Archive could not be loaded.', 'error');
      }
    } finally {
      window.clearTimeout(request.timeout);
      if (activeGalleryRequest === request) {
        activeGalleryRequest = null;
        gallery.setAttribute('aria-busy', 'false');
        setGalleryButtonState(false);
      }
    }
  };

  const getReasonableBackendError = (payload) => {
    if (!payload || typeof payload.error !== 'string') return '';
    const errorText = payload.error.trim();
    if (!errorText || errorText.length > 300) return '';
    return errorText;
  };

  const getUploadErrorMessage = (status, payload) => {
    const backendError = getReasonableBackendError(payload);
    if (backendError) return backendError;

    if (status === 400) return 'The screenshot could not be accepted. Please check the file and try again.';
    if (status === 413) return 'Screenshots must be 8 MB or smaller.';
    if (status === 415) return 'Please choose a PNG, JPEG, or WebP image.';
    if (status === 429) return 'You already have screenshots waiting for review or have uploaded too recently. Please try again later.';
    if (status === 500 || status === 503) return 'The archive is temporarily unavailable. Please try again.';
    return 'The screenshot could not be uploaded right now. Please try again.';
  };

  const showUploadSuccess = () => {
    setUploading(false);
    if (uploadForm) uploadForm.reset();
    clearSelectedFile();
    updateCaptionCounter();
    setUploadStatus();
    setUploadView('success');
    markMyUploadsStale();
    if (uploadDoneButton) uploadDoneButton.focus();
  };

  const submitUpload = async (event) => {
    event.preventDefault();
    if (activeUploadRequest) return;

    const validationMessage = validateFile(selectedFile);
    if (validationMessage) {
      setUploadStatus(validationMessage, 'error');
      return;
    }

    const token = readSession();
    if (!token) {
      expireSession();
      return;
    }

    const formData = new FormData();
    formData.append('screenshot', selectedFile);
    formData.append('caption', captionInput.value);

    const controller = new AbortController();
    activeUploadRequest = controller;
    const timeout = window.setTimeout(() => controller.abort(), 60000);
    setUploading(true);
    setUploadStatus('Uploading your screenshot…', 'uploading');

    try {
      const response = await fetch(uploadEndpoint, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${token}`
        },
        credentials: 'omit',
        body: formData,
        signal: controller.signal
      });

      if (activeUploadRequest !== controller) return;
      const payload = await safeResponseJson(response);
      if (activeUploadRequest !== controller) return;

      if (response.status === 401) {
        activeUploadRequest = null;
        expireSession();
        return;
      }

      if (response.status === 201 && response.ok) {
        activeUploadRequest = null;
        showUploadSuccess();
        return;
      }

      setUploadStatus(getUploadErrorMessage(response.status, payload), 'error');
    } catch (error) {
      if (activeUploadRequest !== controller) return;
      setUploadStatus('The screenshot could not be uploaded right now. Please try again.', 'error');
    } finally {
      window.clearTimeout(timeout);
      if (activeUploadRequest === controller) {
        activeUploadRequest = null;
        setUploading(false);
      }
    }
  };

  const uploaderElements = [
    uploadDialog,
    uploadForm,
    fileInput,
    chooseFileButton,
    changeFileButton,
    dropZone,
    selectedFilePanel,
    previewImage,
    fileName,
    fileSize,
    captionInput,
    captionCounter,
    uploadStatus,
    uploadSubmitButton,
    uploadSubmitLabel,
    uploadCancelButton,
    uploadCloseButton,
    uploadDoneButton
  ];

  if (uploadOpenButton && uploaderElements.every(Boolean) && typeof uploadDialog.showModal === 'function') {
    uploaderReady = true;

    uploadOpenButton.addEventListener('click', () => {
      if (uploadOpenButton.disabled || authPanel.dataset.authState !== 'logged-in') return;
      restoreUploadFocus = true;
      resetUploader();
      rootEl.classList.add('modal-open');
      uploadDialog.showModal();
      window.requestAnimationFrame(() => chooseFileButton.focus());
    });

    chooseFileButton.addEventListener('click', () => fileInput.click());
    changeFileButton.addEventListener('click', () => fileInput.click());

    fileInput.addEventListener('change', () => {
      if (!fileInput.files || fileInput.files.length === 0) return;
      selectFile(fileInput.files[0]);
    });

    captionInput.addEventListener('input', updateCaptionCounter);
    uploadForm.addEventListener('submit', submitUpload);

    uploadCancelButton.addEventListener('click', () => closeUploadDialog());
    uploadCloseButton.addEventListener('click', () => closeUploadDialog());
    uploadDoneButton.addEventListener('click', () => closeUploadDialog());

    uploadDialog.addEventListener('cancel', (event) => {
      if (activeUploadRequest) {
        event.preventDefault();
        return;
      }
      resetUploader();
    });

    uploadDialog.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      if (!activeUploadRequest) closeUploadDialog();
    });

    uploadDialog.addEventListener('click', (event) => {
      if (event.target === uploadDialog && !activeUploadRequest) closeUploadDialog();
    });

    uploadDialog.addEventListener('close', () => {
      rootEl.classList.remove('modal-open');
      resetUploader({ abortActive: true });
      if (restoreUploadFocus && authPanel.dataset.authState === 'logged-in' && !uploadOpenButton.disabled) {
        uploadOpenButton.focus();
      }
    });

    const beginDrag = (event) => {
      if (activeUploadRequest) return;
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
      dropZone.classList.add('is-dragging');
    };

    dropZone.addEventListener('dragenter', beginDrag);
    dropZone.addEventListener('dragover', beginDrag);
    dropZone.addEventListener('dragleave', (event) => {
      if (!dropZone.contains(event.relatedTarget)) dropZone.classList.remove('is-dragging');
    });
    dropZone.addEventListener('drop', (event) => {
      event.preventDefault();
      dropZone.classList.remove('is-dragging');
      if (activeUploadRequest || !event.dataTransfer) return;
      const files = event.dataTransfer.files;
      if (files.length !== 1) {
        clearSelectedFile();
        setUploadStatus('Please choose one screenshot at a time.', 'error');
        return;
      }
      selectFile(files[0]);
    });
  }

  const myUploadsElements = [
    myUploadsDialog,
    myUploadsOpenButton,
    myUploadsCloseButton,
    myUploadsRefreshButton,
    myUploadsRefreshLabel,
    myUploadsRetryButton,
    myUploadsEmptyUploadButton,
    myUploadsStatus,
    myUploadsLoading,
    myUploadsError,
    myUploadsEmpty,
    myUploadsGrid,
    myUploadsMoreButton
  ];

  if (myUploadsElements.every(Boolean) && typeof myUploadsDialog.showModal === 'function') {
    myUploadsReady = true;

    myUploadsOpenButton.addEventListener('click', () => {
      if (myUploadsOpenButton.disabled || authPanel.dataset.authState !== 'logged-in' || myUploadsDialog.open) return;
      restoreMyUploadsFocus = true;
      resetMyUploadsState({ abortList: true, markStale: true });
      rootEl.classList.add('modal-open');
      myUploadsDialog.showModal();
      window.requestAnimationFrame(() => myUploadsCloseButton.focus());
      if (myUploadsStale) loadMyUploads();
    });

    myUploadsRefreshButton.addEventListener('click', refreshMyUploads);
    myUploadsRetryButton.addEventListener('click', refreshMyUploads);
    myUploadsMoreButton.addEventListener('click', () => loadMyUploads({ append: true }));
    myUploadsCloseButton.addEventListener('click', () => closeMyUploadsDialog());
    myUploadsEmptyUploadButton.addEventListener('click', () => {
      closeMyUploadsDialog({ restoreFocus: false });
      window.requestAnimationFrame(() => {
        if (authPanel.dataset.authState === 'logged-in' && uploadOpenButton && !uploadOpenButton.disabled) {
          uploadOpenButton.click();
        }
      });
    });

    myUploadsDialog.addEventListener('cancel', (event) => {
      event.preventDefault();
      closeMyUploadsDialog();
    });
    myUploadsDialog.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      closeMyUploadsDialog();
    });
    myUploadsDialog.addEventListener('click', (event) => {
      if (event.target === myUploadsDialog) closeMyUploadsDialog();
    });
    myUploadsDialog.addEventListener('close', () => {
      rootEl.classList.remove('modal-open');
      resetMyUploadsState({ abortList: true, markStale: true });
      if (
        restoreMyUploadsFocus
        && authPanel.dataset.authState === 'logged-in'
        && !myUploadsOpenButton.hidden
        && !myUploadsOpenButton.disabled
      ) myUploadsOpenButton.focus();
    });
  }

  if (
    lightboxDialog
    && lightboxCloseButton
    && lightboxMedia
    && lightboxLoading
    && lightboxImage
    && lightboxUnavailable
    && lightboxCaption
    && lightboxUploader
    && lightboxDate
    && typeof lightboxDialog.showModal === 'function'
  ) {
    lightboxCloseButton.addEventListener('click', closeLightbox);
    lightboxDialog.addEventListener('cancel', (event) => {
      event.preventDefault();
      closeLightbox();
    });
    lightboxDialog.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      closeLightbox();
    });
    lightboxDialog.addEventListener('click', (event) => {
      if (event.target === lightboxDialog) closeLightbox();
    });
    lightboxDialog.addEventListener('close', () => {
      rootEl.classList.remove('modal-open');
      resetLightbox();
      const trigger = lightboxTrigger;
      lightboxTrigger = null;
      if (trigger && trigger.isConnected) trigger.focus();
    });
  }

  if (galleryRetryButton) galleryRetryButton.addEventListener('click', () => loadGallery());
  if (galleryMoreButton) galleryMoreButton.addEventListener('click', () => loadGallery({ append: true }));

  if (logoutButton) {
    logoutButton.addEventListener('click', () => {
      if (activeAuthRequest) {
        activeAuthRequest.abort();
        activeAuthRequest = null;
      }
      removeSession();
      displayName.textContent = '';
      setAuthState('logged-out', 'You have been logged out.');
    });
  }

  if (retryButton) retryButton.addEventListener('click', verifyStoredSession);

  window.addEventListener('pagehide', () => {
    resetMyUploadsState({ abortList: true, markStale: true });
    if (activeGalleryRequest) {
      window.clearTimeout(activeGalleryRequest.timeout);
      activeGalleryRequest.controller.abort();
      activeGalleryRequest = null;
    }
    if (lightboxImage) {
      lightboxImage.onload = null;
      lightboxImage.onerror = null;
      lightboxImage.removeAttribute('src');
    }
  }, { once: true });

  loadGallery();
  verifyStoredSession();
})();
