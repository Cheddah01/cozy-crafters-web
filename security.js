// ============================================
// Cozy Crafters - shared client-side safety helpers
// ============================================

function ccEscapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function ccSafeUrl(value, fallback = '#') {
  const raw = String(value ?? '').trim();
  if (!raw) return fallback;

  try {
    const url = new URL(raw, window.location.origin);
    if (url.protocol === 'http:' || url.protocol === 'https:') return url.href;
    if (url.origin === window.location.origin && (url.protocol === 'http:' || url.protocol === 'https:')) return url.pathname + url.search + url.hash;
  } catch (e) {}

  if (/^(\/|#|[a-z0-9_-]+\.html(?:[?#].*)?$)/i.test(raw)) return raw;
  return fallback;
}

function ccSafeImageUrl(value) {
  return ccSafeUrl(value, '');
}

function ccSetSafeHref(id, value, fallback = '#') {
  const el = document.getElementById(id);
  if (el) el.href = ccSafeUrl(value, fallback);
}

function ccFormatInline(text) {
  return ccEscapeHtml(text)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>');
}
