(() => {
  'use strict';

  const settingsEndpoint = 'https://cozy-store-api.colbysthickey.workers.dev/public/settings';

  const normalizeSettings = (value) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;

    const booleanKeys = [
      'announcementEnabled',
      'storeEnabled',
      'supporterEnabled',
      'patronEnabled'
    ];

    if (booleanKeys.some((key) => typeof value[key] !== 'boolean')) return null;
    if (typeof value.announcementText !== 'string' || typeof value.storeNotice !== 'string') return null;

    return Object.freeze({
      announcementEnabled: value.announcementEnabled,
      announcementText: value.announcementText.trim(),
      storeEnabled: value.storeEnabled,
      supporterEnabled: value.supporterEnabled,
      patronEnabled: value.patronEnabled,
      storeNotice: value.storeNotice.trim()
    });
  };

  const fetchSettings = async () => {
    const controller = typeof AbortController === 'function' ? new AbortController() : null;
    const timeout = controller ? window.setTimeout(() => controller.abort(), 6000) : null;

    try {
      const response = await fetch(settingsEndpoint, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        credentials: 'omit',
        cache: 'no-store',
        signal: controller ? controller.signal : undefined
      });

      if (!response.ok) return null;
      return normalizeSettings(await response.json());
    } catch (error) {
      return null;
    } finally {
      if (timeout !== null) window.clearTimeout(timeout);
    }
  };

  const domReady = document.readyState === 'loading'
    ? new Promise((resolve) => document.addEventListener('DOMContentLoaded', resolve, { once: true }))
    : Promise.resolve();

  const renderAnnouncement = (settings) => {
    if (!settings || !settings.announcementEnabled || !settings.announcementText) return;

    const header = document.querySelector('.site-header');
    if (!header || document.querySelector('[data-site-announcement]')) return;

    const announcement = document.createElement('aside');
    const label = document.createElement('span');
    const message = document.createElement('p');

    announcement.className = 'site-announcement';
    announcement.dataset.siteAnnouncement = '';
    announcement.setAttribute('role', 'status');
    announcement.setAttribute('aria-live', 'polite');
    label.className = 'site-announcement-label';
    label.textContent = 'Announcement';
    message.textContent = settings.announcementText;

    announcement.append(label, message);
    header.insertAdjacentElement('afterend', announcement);
  };

  window.cozyPublicSettingsReady = fetchSettings();
  Promise.all([domReady, window.cozyPublicSettingsReady]).then(([, settings]) => {
    renderAnnouncement(settings);
  }).catch(() => {});
})();
