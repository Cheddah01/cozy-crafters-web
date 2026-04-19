// ============================================
// Cozy Crafters — Inline Admin Editor
// Include on pages that support inline editing
// Requires auth.js to be loaded first
// ============================================

const INLINE_API = 'https://cozy-crafters-api.colbysthickey.workers.dev';

(function initInlineAdmin() {
  // Wait for DOM
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setup);
  } else {
    setup();
  }

  function setup() {
    const user = ccGetUser();
    if (!user || user.role !== 'admin') return;

    const adminToken = sessionStorage.getItem('ccAdminToken') || '';

    // Inject styles
    const style = document.createElement('style');
    style.textContent = `
      /* Floating admin toolbar */
      .inline-toolbar {
        position: fixed;
        bottom: 1.5rem;
        right: 1.5rem;
        z-index: 500;
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
        align-items: flex-end;
      }

      .inline-toolbar-btn {
        font-family: 'Fredoka', sans-serif;
        font-size: 0.85rem;
        font-weight: 600;
        padding: 0.65rem 1.2rem;
        border: none;
        border-radius: 12px;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        gap: 0.5rem;
        transition: all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
        box-shadow: 0 4px 20px rgba(0,0,0,0.3);
      }

      .inline-toolbar-btn:hover {
        transform: translateY(-2px);
        box-shadow: 0 6px 24px rgba(0,0,0,0.4);
      }

      .inline-toolbar-btn.primary {
        background: #F4C95D;
        color: #2B1F15;
      }

      .inline-toolbar-btn.secondary {
        background: rgba(255, 244, 220, 0.12);
        color: #FFF4DC;
        backdrop-filter: blur(12px);
        border: 1px solid rgba(255, 244, 220, 0.15);
      }

      /* Entry hover edit button */
      .inline-edit-btn {
        position: absolute;
        top: 0.6rem;
        right: 0.6rem;
        font-family: 'Fredoka', sans-serif;
        font-size: 0.7rem;
        font-weight: 600;
        padding: 0.3rem 0.6rem;
        border: none;
        border-radius: 8px;
        cursor: pointer;
        background: rgba(244, 201, 93, 0.15);
        color: #F4C95D;
        border: 1px solid rgba(244, 201, 93, 0.3);
        opacity: 0;
        transition: all 0.2s;
        z-index: 10;
      }

      .inline-edit-btn:hover {
        background: rgba(244, 201, 93, 0.3);
      }

      *:hover > .inline-edit-btn {
        opacity: 1;
      }

      /* Modal overlay */
      .inline-modal-overlay {
        position: fixed;
        inset: 0;
        z-index: 600;
        background: rgba(43, 31, 21, 0.9);
        backdrop-filter: blur(8px);
        display: flex;
        align-items: flex-start;
        justify-content: center;
        padding: 4rem 1.5rem;
        overflow-y: auto;
        opacity: 0;
        transition: opacity 0.25s ease;
      }

      .inline-modal-overlay.visible {
        opacity: 1;
      }

      .inline-modal {
        background: #3D2B1F;
        border: 1px solid rgba(244, 201, 93, 0.15);
        border-radius: 18px;
        padding: 2rem;
        width: 100%;
        max-width: 600px;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
        transform: translateY(20px);
        transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
      }

      .inline-modal-overlay.visible .inline-modal {
        transform: translateY(0);
      }

      .inline-modal h3 {
        font-family: 'Fredoka', sans-serif;
        font-weight: 700;
        font-size: 1.3rem;
        color: #FFF4DC;
        margin-bottom: 1.2rem;
      }

      .inline-modal .im-field {
        margin-bottom: 1rem;
      }

      .inline-modal .im-label {
        display: block;
        font-family: 'Fredoka', sans-serif;
        font-size: 0.8rem;
        font-weight: 600;
        color: #F4C95D;
        margin-bottom: 0.35rem;
        letter-spacing: 0.04em;
      }

      .inline-modal input[type="text"],
      .inline-modal textarea {
        width: 100%;
        font-family: 'Nunito', sans-serif;
        font-size: 0.92rem;
        color: #FFF4DC;
        background: rgba(43, 31, 21, 0.8);
        border: 2px solid rgba(244, 201, 93, 0.2);
        border-radius: 10px;
        padding: 0.7rem 0.9rem;
        outline: none;
        transition: all 0.2s;
      }

      .inline-modal input[type="text"]:focus,
      .inline-modal textarea:focus {
        border-color: #F4C95D;
        box-shadow: 0 0 0 3px rgba(244, 201, 93, 0.12);
      }

      .inline-modal textarea {
        resize: vertical;
        min-height: 100px;
        line-height: 1.6;
      }

      .inline-modal input::placeholder,
      .inline-modal textarea::placeholder {
        color: #FFF4DC;
        opacity: 0.3;
      }

      .inline-modal .im-row {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 0.8rem;
      }

      .inline-modal .im-tags {
        display: flex;
        gap: 0.35rem;
        flex-wrap: wrap;
      }

      .inline-modal .im-tag-btn {
        font-family: 'Fredoka', sans-serif;
        font-size: 0.75rem;
        font-weight: 600;
        padding: 0.3rem 0.7rem;
        border-radius: 999px;
        border: 1px solid rgba(244, 201, 93, 0.2);
        background: rgba(255, 244, 220, 0.05);
        color: #FFF4DC;
        opacity: 0.6;
        cursor: pointer;
        transition: all 0.15s;
      }

      .inline-modal .im-tag-btn.active {
        background: #F4C95D;
        color: #2B1F15;
        border-color: #F4C95D;
        opacity: 1;
      }

      .inline-modal .im-actions {
        display: flex;
        gap: 0.6rem;
        margin-top: 1.5rem;
      }

      .inline-modal .im-btn {
        font-family: 'Fredoka', sans-serif;
        font-size: 0.9rem;
        font-weight: 600;
        padding: 0.75rem 1.4rem;
        border: none;
        border-radius: 12px;
        cursor: pointer;
        transition: all 0.2s;
      }

      .inline-modal .im-btn-save {
        background: #F4C95D;
        color: #2B1F15;
        box-shadow: 0 3px 0 #D9A441;
      }

      .inline-modal .im-btn-save:hover {
        transform: translateY(-1px);
      }

      .inline-modal .im-btn-cancel {
        background: rgba(255, 244, 220, 0.08);
        color: #FFF4DC;
        border: 1px solid rgba(255, 244, 220, 0.15);
      }

      .inline-modal .im-btn-delete {
        background: rgba(232, 154, 110, 0.1);
        color: #E89A6E;
        border: 1px solid rgba(232, 154, 110, 0.3);
        margin-left: auto;
      }

      .inline-modal .im-hint {
        font-family: 'Nunito', sans-serif;
        font-size: 0.75rem;
        color: #FFF4DC;
        opacity: 0.4;
        margin-top: 0.25rem;
      }

      /* Toast for inline saves */
      .inline-toast {
        position: fixed;
        bottom: 5.5rem;
        right: 1.5rem;
        z-index: 510;
        font-family: 'Fredoka', sans-serif;
        font-size: 0.88rem;
        font-weight: 600;
        background: #F4C95D;
        color: #2B1F15;
        padding: 0.7rem 1.2rem;
        border-radius: 10px;
        box-shadow: 0 4px 16px rgba(0,0,0,0.3);
        transform: translateY(20px);
        opacity: 0;
        transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
        pointer-events: none;
      }

      .inline-toast.show {
        transform: translateY(0);
        opacity: 1;
      }
    `;
    document.head.appendChild(style);

    // Create toast
    const toast = document.createElement('div');
    toast.className = 'inline-toast';
    toast.id = 'inlineToast';
    document.body.appendChild(toast);

    function showInlineToast(msg) {
      toast.textContent = msg;
      toast.classList.add('show');
      setTimeout(() => toast.classList.remove('show'), 2200);
    }

    // Create toolbar
    const toolbar = document.createElement('div');
    toolbar.className = 'inline-toolbar';
    toolbar.id = 'inlineToolbar';
    document.body.appendChild(toolbar);

    // Detect page type
    const pageType = detectPageType();
    if (!pageType) return;

    // Add toolbar buttons
    toolbar.innerHTML = `
      <button class="inline-toolbar-btn primary" id="inlineAddBtn">+ New ${pageType === 'changelog' ? 'Entry' : 'Article'}</button>
      <button class="inline-toolbar-btn secondary" onclick="window.location.href='admin.html'">⚙ Admin Panel</button>
    `;

    // Token prompt if needed
    if (!adminToken) {
      promptForToken(() => {
        initPageEditor(pageType);
      });
    } else {
      initPageEditor(pageType);
    }

    function detectPageType() {
      const path = window.location.pathname;
      if (path.includes('changelog')) return 'changelog';
      if (path.includes('chronicles')) return 'chronicles';
      return null;
    }

    function promptForToken(callback) {
      const overlay = createModal('Admin Access', `
        <div class="im-field">
          <label class="im-label">API Token</label>
          <input type="password" id="imTokenInput" placeholder="Enter your admin API token" />
          <div class="im-hint">Required for saving changes. Only asked once per session.</div>
        </div>
      `, [
        { label: 'Unlock', class: 'im-btn-save', action: 'save' },
        { label: 'Cancel', class: 'im-btn-cancel', action: 'cancel' },
      ], async (action) => {
        if (action === 'save') {
          const token = document.getElementById('imTokenInput').value.trim();
          if (!token) return;
          // Test it
          try {
            const res = await fetch(`${INLINE_API}/api/settings/__auth_test`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
              body: JSON.stringify({ value: 'ok' }),
            });
            if (res.ok) {
              sessionStorage.setItem('ccAdminToken', token);
              closeModal(overlay);
              callback();
              return;
            }
          } catch (e) {}
          showInlineToast('Invalid token.');
          return 'keep';
        }
      });
    }

    // ============================================
    // Changelog inline editing
    // ============================================
    function initPageEditor(type) {
      const token = sessionStorage.getItem('ccAdminToken');

      if (type === 'changelog') {
        initChangelogEditor(token);
      } else if (type === 'chronicles') {
        initChroniclesEditor(token);
      }
    }

    async function initChangelogEditor(token) {
      // Load tags
      let tags = [];
      try {
        const res = await fetch(`${INLINE_API}/api/settings/changelogTags`);
        if (res.ok) { const d = await res.json(); tags = d.value || []; }
      } catch (e) {}

      // Add edit buttons to entries
      addEditButtons('.changelog-entry', (el) => {
        const entryId = el.dataset.entryId;
        openChangelogModal(entryId, tags, token);
      });

      // Add button handler
      document.getElementById('inlineAddBtn').addEventListener('click', () => {
        openChangelogModal(null, tags, token);
      });
    }

    async function openChangelogModal(entryId, tags, token) {
      // Load current entries
      let entries = [];
      try {
        const res = await fetch(`${INLINE_API}/api/settings/changelog`);
        if (res.ok) { const d = await res.json(); entries = d.value || []; }
      } catch (e) {}

      const entry = entryId ? entries.find(e => e.id === entryId) : null;
      const isEdit = !!entry;
      const selectedTags = new Set(entry?.tags || []);

      const tagsHtml = tags.map(t => {
        const active = selectedTags.has(t.id) ? 'active' : '';
        const style = active
          ? `background:${t.color}; color:#1a1209; border-color:${t.color};`
          : `border-color:${t.color}55; color:${t.color};`;
        return `<button type="button" class="im-tag-btn ${active}" data-tag="${t.id}" style="${style}">${t.name}</button>`;
      }).join('');

      const overlay = createModal(isEdit ? 'Edit Entry' : 'New Changelog Entry', `
        <div class="im-field">
          <label class="im-label">Title</label>
          <input type="text" id="imClTitle" value="${escape(entry?.title || '')}" placeholder="Economy Rebalance & Bug Fixes" />
        </div>
        <div class="im-row">
          <div class="im-field">
            <label class="im-label">Version</label>
            <input type="text" id="imClVersion" value="${escape(entry?.version || '')}" placeholder="v2.4.1" />
          </div>
          <div class="im-field">
            <label class="im-label">Date</label>
            <input type="text" id="imClDate" value="${entry?.date || new Date().toISOString().split('T')[0]}" placeholder="2026-04-18" />
          </div>
        </div>
        <div class="im-field">
          <label class="im-label">Tags</label>
          <div class="im-tags" id="imClTags">${tagsHtml}</div>
        </div>
        <div class="im-field">
          <label class="im-label">Body</label>
          <textarea id="imClBody" rows="8" placeholder="## Changes&#10;&#10;- Added this&#10;- Fixed that">${entry?.body || ''}</textarea>
          <div class="im-hint">## for headers, - for bullets, **bold**, *italic*</div>
        </div>
        <div class="im-field">
          <label class="im-label">Image URL (optional)</label>
          <input type="text" id="imClImage" value="${escape(entry?.image || '')}" placeholder="https://..." />
        </div>
      `, [
        { label: isEdit ? 'Save Changes' : 'Publish', class: 'im-btn-save', action: 'save' },
        { label: 'Cancel', class: 'im-btn-cancel', action: 'cancel' },
        ...(isEdit ? [{ label: 'Delete', class: 'im-btn-delete', action: 'delete' }] : []),
      ], async (action) => {
        if (action === 'save') {
          const title = document.getElementById('imClTitle').value.trim();
          const date = document.getElementById('imClDate').value.trim();
          if (!title || !date) { showInlineToast('Title and date required.'); return 'keep'; }

          const activeTags = new Set();
          document.querySelectorAll('#imClTags .im-tag-btn.active').forEach(b => activeTags.add(b.dataset.tag));

          const newEntry = {
            title,
            version: document.getElementById('imClVersion').value.trim() || null,
            date,
            tags: [...activeTags],
            body: document.getElementById('imClBody').value,
            image: document.getElementById('imClImage').value.trim() || null,
            status: 'published',
            pinned: entry?.pinned || false,
            id: entry?.id || `cl-${Date.now()}`,
          };

          if (isEdit) {
            const idx = entries.findIndex(e => e.id === entryId);
            if (idx >= 0) entries[idx] = newEntry;
          } else {
            entries.push(newEntry);
          }

          return await saveAndReload('changelog', entries, token);
        } else if (action === 'delete') {
          if (!confirm('Delete this entry?')) return 'keep';
          entries = entries.filter(e => e.id !== entryId);
          return await saveAndReload('changelog', entries, token);
        }
      });

      // Wire up tag toggles
      overlay.querySelectorAll('#imClTags .im-tag-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          btn.classList.toggle('active');
          const t = tags.find(x => x.id === btn.dataset.tag);
          if (t) {
            btn.style = btn.classList.contains('active')
              ? `background:${t.color}; color:#1a1209; border-color:${t.color};`
              : `border-color:${t.color}55; color:${t.color};`;
          }
        });
      });
    }

    // ============================================
    // Chronicles inline editing
    // ============================================
    async function initChroniclesEditor(token) {
      let sections = [];
      try {
        const res = await fetch(`${INLINE_API}/api/settings/chroniclesSections`);
        if (res.ok) { const d = await res.json(); sections = d.value || []; }
      } catch (e) {}

      // Add edit buttons to article cards and featured
      addEditButtons('.article-card, .featured-article', (el) => {
        const articleId = el.dataset.id;
        openChroniclesModal(articleId, sections, token);
      });

      document.getElementById('inlineAddBtn').addEventListener('click', () => {
        openChroniclesModal(null, sections, token);
      });
    }

    async function openChroniclesModal(articleId, sections, token) {
      let articles = [];
      try {
        const res = await fetch(`${INLINE_API}/api/settings/chronicles`);
        if (res.ok) { const d = await res.json(); articles = d.value || []; }
      } catch (e) {}

      const article = articleId ? articles.find(a => a.id === articleId) : null;
      const isEdit = !!article;

      const secHtml = sections.map(s => {
        const active = article?.section === s ? 'active' : '';
        return `<button type="button" class="im-tag-btn im-sec-btn ${active}" data-section="${s}">${s}</button>`;
      }).join('');

      const overlay = createModal(isEdit ? 'Edit Article' : 'New Article', `
        <div class="im-field">
          <label class="im-label">Headline</label>
          <input type="text" id="imChrTitle" value="${escape(article?.title || '')}" placeholder="Local Man Loses Diamonds; Blames Admin" />
        </div>
        <div class="im-field">
          <label class="im-label">Subtitle</label>
          <input type="text" id="imChrSubtitle" value="${escape(article?.subtitle || '')}" placeholder="Optional subtitle" />
        </div>
        <div class="im-row">
          <div class="im-field">
            <label class="im-label">Author</label>
            <input type="text" id="imChrAuthor" value="${escape(article?.author || 'The Cozy Chronicles Staff')}" />
          </div>
          <div class="im-field">
            <label class="im-label">Date</label>
            <input type="text" id="imChrDate" value="${article?.date || new Date().toISOString().split('T')[0]}" />
          </div>
        </div>
        <div class="im-field">
          <label class="im-label">Section</label>
          <div class="im-tags" id="imChrSections">${secHtml}</div>
        </div>
        <div class="im-field">
          <label class="im-label">Featured Image URL</label>
          <input type="text" id="imChrImage" value="${escape(article?.image || '')}" placeholder="https://..." />
        </div>
        <div class="im-field">
          <label class="im-label">Body</label>
          <textarea id="imChrBody" rows="10" placeholder="## The Incident&#10;&#10;It was a Tuesday...">${article?.body || ''}</textarea>
          <div class="im-hint">## for headers, - for bullets, **bold**, *italic*</div>
        </div>
        <div class="im-row">
          <div class="im-field">
            <label class="im-label">Status</label>
            <div class="im-tags">
              <button type="button" class="im-tag-btn im-status-btn ${(article?.status || 'published') === 'published' ? 'active' : ''}" data-status="published">Published</button>
              <button type="button" class="im-tag-btn im-status-btn ${article?.status === 'draft' ? 'active' : ''}" data-status="draft">Draft</button>
            </div>
          </div>
          <div class="im-field">
            <label class="im-label">Featured</label>
            <div class="im-tags">
              <button type="button" class="im-tag-btn im-feat-btn ${article?.featured ? 'active' : ''}" id="imChrFeatured">⭐ Feature</button>
            </div>
          </div>
        </div>
      `, [
        { label: isEdit ? 'Save Changes' : 'Publish', class: 'im-btn-save', action: 'save' },
        { label: 'Cancel', class: 'im-btn-cancel', action: 'cancel' },
        ...(isEdit ? [{ label: 'Delete', class: 'im-btn-delete', action: 'delete' }] : []),
      ], async (action) => {
        if (action === 'save') {
          const title = document.getElementById('imChrTitle').value.trim();
          const date = document.getElementById('imChrDate').value.trim();
          if (!title || !date) { showInlineToast('Headline and date required.'); return 'keep'; }

          const activeSection = overlay.querySelector('#imChrSections .im-sec-btn.active');
          const activeStatus = overlay.querySelector('.im-status-btn.active');

          const newArticle = {
            title,
            subtitle: document.getElementById('imChrSubtitle').value.trim() || null,
            author: document.getElementById('imChrAuthor').value.trim() || 'The Cozy Chronicles Staff',
            date,
            section: activeSection?.dataset.section || null,
            image: document.getElementById('imChrImage').value.trim() || null,
            body: document.getElementById('imChrBody').value,
            status: activeStatus?.dataset.status || 'published',
            featured: !!overlay.querySelector('.im-feat-btn.active'),
            id: article?.id || `chr-${Date.now()}`,
          };

          if (isEdit) {
            const idx = articles.findIndex(a => a.id === articleId);
            if (idx >= 0) articles[idx] = newArticle;
          } else {
            articles.push(newArticle);
          }

          return await saveAndReload('chronicles', articles, token);
        } else if (action === 'delete') {
          if (!confirm('Delete this article?')) return 'keep';
          articles = articles.filter(a => a.id !== articleId);
          return await saveAndReload('chronicles', articles, token);
        }
      });

      // Section picker (single select)
      overlay.querySelectorAll('.im-sec-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          overlay.querySelectorAll('.im-sec-btn').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
        });
      });

      // Status toggle (single select)
      overlay.querySelectorAll('.im-status-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          overlay.querySelectorAll('.im-status-btn').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
        });
      });

      // Featured toggle
      overlay.querySelector('.im-feat-btn')?.addEventListener('click', function() {
        this.classList.toggle('active');
      });
    }

    // ============================================
    // Shared helpers
    // ============================================
    function escape(str) {
      return (str || '').replace(/"/g, '&quot;').replace(/</g, '&lt;');
    }

    function addEditButtons(selector, onClick) {
      // Use MutationObserver to catch dynamically rendered elements
      function attachButtons() {
        document.querySelectorAll(selector).forEach(el => {
          if (el.querySelector('.inline-edit-btn')) return;
          el.style.position = 'relative';
          const btn = document.createElement('button');
          btn.className = 'inline-edit-btn';
          btn.textContent = '✎ Edit';
          btn.addEventListener('click', (e) => {
            e.stopPropagation();
            onClick(el);
          });
          el.appendChild(btn);
        });
      }

      attachButtons();
      const observer = new MutationObserver(attachButtons);
      observer.observe(document.body, { childList: true, subtree: true });
    }

    async function saveAndReload(settingKey, data, token) {
      try {
        const res = await fetch(`${INLINE_API}/api/settings/${settingKey}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ value: data }),
        });
        if (!res.ok) {
          showInlineToast('Save failed.');
          return 'keep';
        }
        showInlineToast('Saved!');
        setTimeout(() => window.location.reload(), 800);
      } catch (e) {
        showInlineToast('Save failed — check connection.');
        return 'keep';
      }
    }

    function createModal(title, bodyHtml, buttons, onAction) {
      const overlay = document.createElement('div');
      overlay.className = 'inline-modal-overlay';

      const btnsHtml = buttons.map(b =>
        `<button class="im-btn ${b.class}" data-action="${b.action}">${b.label}</button>`
      ).join('');

      overlay.innerHTML = `
        <div class="inline-modal">
          <h3>${title}</h3>
          ${bodyHtml}
          <div class="im-actions">${btnsHtml}</div>
        </div>
      `;

      document.body.appendChild(overlay);
      requestAnimationFrame(() => overlay.classList.add('visible'));

      // Button handlers
      overlay.querySelectorAll('.im-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
          const result = await onAction(btn.dataset.action);
          if (result !== 'keep') {
            closeModal(overlay);
          }
        });
      });

      // Close on overlay click
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) closeModal(overlay);
      });

      // Close on escape
      const escHandler = (e) => {
        if (e.key === 'Escape') { closeModal(overlay); document.removeEventListener('keydown', escHandler); }
      };
      document.addEventListener('keydown', escHandler);

      return overlay;
    }

    function closeModal(overlay) {
      overlay.classList.remove('visible');
      setTimeout(() => overlay.remove(), 300);
    }
  }
})();
