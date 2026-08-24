(() => {
  'use strict';

  const sessionKey = 'cozyArchiveSession';
  const meEndpoint = 'https://cozy-archive.colbysthickey.workers.dev/api/me';
  const uploadEndpoint = 'https://cozy-archive.colbysthickey.workers.dev/api/upload';
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

  let activeAuthRequest = null;
  let activeUploadRequest = null;
  let selectedFile = null;
  let previewUrl = null;
  let restoreUploadFocus = true;
  let uploaderReady = false;
  let closeUploaderForAuthChange = () => {};

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
    if (state !== 'logged-in' && adminPanelLink) adminPanelLink.hidden = true;
    if (state !== 'logged-in') closeUploaderForAuthChange();
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

  verifyStoredSession();
})();
