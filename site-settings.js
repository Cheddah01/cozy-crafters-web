(() => {
  'use strict';

  const settingsEndpoint = 'https://cozy-store-api.colbysthickey.workers.dev/public/settings';
  const fundingEndpoint = 'https://cozy-archive.colbysthickey.workers.dev/api/funding-goal';
  const supportedCurrencies = new Set(['USD', 'CAD', 'EUR', 'GBP', 'AUD', 'NZD']);
  const previewFundingGoal = Object.freeze({
    enabled: true,
    title: 'Community server fund',
    description: 'Help cover hosting, backups, and the tools that keep Cozy Crafters running.',
    currentAmount: 0,
    targetAmount: 100,
    currency: 'USD',
    contributionUrl: '/store.html'
  });

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

  const normalizeFundingGoal = (payload) => {
    const value = payload && payload.goal;
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;

    const currentAmount = Number(value.currentAmount);
    const targetAmount = Number(value.targetAmount);
    const currency = String(value.currency || '').trim().toUpperCase();
    const title = typeof value.title === 'string' ? value.title.trim() : '';
    const description = typeof value.description === 'string' ? value.description.trim() : '';
    const contributionUrl = typeof value.contributionUrl === 'string'
      ? value.contributionUrl.trim()
      : '';

    if (typeof value.enabled !== 'boolean') return null;
    if (!title || title.length > 80 || !description || description.length > 240) return null;
    if (!Number.isFinite(currentAmount) || currentAmount < 0) return null;
    if (!Number.isFinite(targetAmount) || targetAmount <= 0) return null;
    if (!supportedCurrencies.has(currency)) return null;
    if (!contributionUrl || contributionUrl.length > 500) return null;

    return Object.freeze({
      enabled: value.enabled,
      title,
      description,
      currentAmount,
      targetAmount,
      currency,
      contributionUrl
    });
  };

  const fetchJson = async (endpoint, normalize) => {
    const controller = typeof AbortController === 'function' ? new AbortController() : null;
    const timeout = controller ? window.setTimeout(() => controller.abort(), 6000) : null;

    try {
      const response = await fetch(endpoint, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        credentials: 'omit',
        cache: 'no-store',
        signal: controller ? controller.signal : undefined
      });

      if (!response.ok) return null;
      return normalize(await response.json());
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

  const safeContributionUrl = (value) => {
    try {
      const url = new URL(value, window.location.href);
      const isLocalPreview = url.origin === window.location.origin && url.protocol === 'http:';
      if (url.protocol !== 'https:' && !isLocalPreview) return '';
      if (url.username || url.password) return '';
      return url.href;
    } catch (error) {
      return '';
    }
  };

  const formatMoney = (amount, currency) => {
    try {
      return new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency,
        minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
        maximumFractionDigits: 2
      }).format(amount);
    } catch (error) {
      return `${currency} ${amount.toFixed(2)}`;
    }
  };

  const fundingView = (goal) => {
    const rawPercent = (goal.currentAmount / goal.targetAmount) * 100;
    const percentage = Math.max(0, Math.min(100, rawPercent));
    return {
      current: formatMoney(goal.currentAmount, goal.currency),
      target: formatMoney(goal.targetAmount, goal.currency),
      percentage,
      percentageLabel: `${Math.round(percentage)}% funded`,
      contributionUrl: safeContributionUrl(goal.contributionUrl)
    };
  };

  const setProgress = (element, goal, view) => {
    if (!element) return;
    element.setAttribute('role', 'progressbar');
    element.setAttribute('aria-label', `${goal.title} funding progress`);
    element.setAttribute('aria-valuemin', '0');
    element.setAttribute('aria-valuemax', String(goal.targetAmount));
    element.setAttribute('aria-valuenow', String(Math.min(goal.currentAmount, goal.targetAmount)));
    const fill = element.querySelector('[data-funding-progress-fill]');
    if (fill) fill.style.width = `${view.percentage}%`;
  };

  const renderHomepageFunding = (goal, view) => {
    const section = document.querySelector('[data-funding-home]');
    if (!section) return;
    if (!goal.enabled) {
      section.hidden = true;
      return;
    }

    const title = section.querySelector('[data-funding-title]');
    const description = section.querySelector('[data-funding-description]');
    const current = section.querySelector('[data-funding-current]');
    const target = section.querySelector('[data-funding-target]');
    const percentage = section.querySelector('[data-funding-percentage]');
    const link = section.querySelector('[data-funding-link]');

    if (title) title.textContent = goal.title;
    if (description) description.textContent = goal.description;
    if (current) current.textContent = view.current;
    if (target) target.textContent = `of ${view.target}`;
    if (percentage) percentage.textContent = view.percentageLabel;
    if (link) {
      if (view.contributionUrl) link.href = view.contributionUrl;
      else link.hidden = true;
    }
    setProgress(section.querySelector('[data-funding-progress]'), goal, view);
    section.hidden = false;
  };

  const addStandaloneFundingStyles = () => {
    if (document.querySelector('[data-funding-standalone-styles]')) return;
    const style = document.createElement('style');
    style.dataset.fundingStandaloneStyles = '';
    style.textContent = `
      .site-funding-standalone{position:fixed;right:16px;bottom:16px;z-index:9999;width:min(360px,calc(100vw - 32px));padding:14px 16px;border:1px solid rgba(255,255,255,.18);border-radius:14px;background:#203a55;color:#fff;font:600 14px/1.35 system-ui,sans-serif;box-shadow:0 14px 36px rgba(0,0,0,.28)}
      .site-funding-standalone a{display:grid;gap:7px;color:inherit;text-decoration:none}.site-funding-standalone strong{font-size:15px}.site-funding-standalone .site-funding-meta{display:flex;justify-content:space-between;gap:12px;font-size:12px}.site-funding-standalone .site-funding-track{height:8px;overflow:hidden;border-radius:99px;background:rgba(255,255,255,.18)}.site-funding-standalone .site-funding-fill{height:100%;border-radius:inherit;background:#75d65b}
    `;
    document.head.append(style);
  };

  const renderCompactFunding = (goal, view) => {
    if (!goal.enabled || document.querySelector('[data-site-funding]')) return;

    const wrapper = document.createElement('aside');
    const link = document.createElement(view.contributionUrl ? 'a' : 'div');
    const heading = document.createElement('div');
    const eyebrow = document.createElement('span');
    const title = document.createElement('strong');
    const meta = document.createElement('div');
    const amount = document.createElement('span');
    const percentage = document.createElement('span');
    const track = document.createElement('div');
    const fill = document.createElement('div');

    wrapper.className = 'site-funding-compact';
    wrapper.dataset.siteFunding = '';
    wrapper.setAttribute('aria-label', 'Community funding goal');
    link.className = 'site-funding-link';
    if (view.contributionUrl) link.href = view.contributionUrl;
    heading.className = 'site-funding-heading';
    eyebrow.className = 'site-funding-label';
    eyebrow.textContent = 'Community goal';
    title.textContent = goal.title;
    meta.className = 'site-funding-meta';
    amount.textContent = `${view.current} of ${view.target}`;
    percentage.textContent = view.percentageLabel;
    track.className = 'site-funding-track';
    track.setAttribute('role', 'progressbar');
    track.setAttribute('aria-label', `${goal.title} funding progress`);
    track.setAttribute('aria-valuemin', '0');
    track.setAttribute('aria-valuemax', String(goal.targetAmount));
    track.setAttribute('aria-valuenow', String(Math.min(goal.currentAmount, goal.targetAmount)));
    fill.className = 'site-funding-fill';
    fill.style.width = `${view.percentage}%`;

    heading.append(eyebrow, title);
    meta.append(amount, percentage);
    track.append(fill);
    link.append(heading, track, meta);
    wrapper.append(link);

    const header = document.querySelector('.site-header');
    if (header) {
      const announcement = document.querySelector('[data-site-announcement]');
      (announcement || header).insertAdjacentElement('afterend', wrapper);
      return;
    }

    addStandaloneFundingStyles();
    wrapper.classList.add('site-funding-standalone');
    document.body.prepend(wrapper);
  };

  const renderFunding = (goal) => {
    if (!goal) return;
    const existingCompact = document.querySelector('[data-site-funding]');
    if (existingCompact) existingCompact.remove();
    const view = fundingView(goal);
    renderCompactFunding(goal, view);
    renderHomepageFunding(goal, view);
  };

  window.cozyPublicSettingsReady = fetchJson(settingsEndpoint, normalizeSettings);
  window.cozyFundingGoalReady = fetchJson(fundingEndpoint, normalizeFundingGoal).then((goal) => {
    if (goal) return goal;
    return ['localhost', '127.0.0.1'].includes(window.location.hostname)
      ? previewFundingGoal
      : null;
  });
  Promise.all([domReady, window.cozyPublicSettingsReady]).then(([, settings]) => {
    renderAnnouncement(settings);
  }).catch(() => {});

  Promise.all([domReady, window.cozyFundingGoalReady]).then(([, goal]) => {
    renderFunding(goal);
  }).catch(() => {});

  document.addEventListener('cozy-funding-goal-updated', (event) => {
    const goal = normalizeFundingGoal(event.detail);
    if (goal) renderFunding(goal);
  });
})();
