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
      let tags = [];
      try {
        const res = await fetch(`${INLINE_API}/api/settings/changelogTags`);
        if (res.ok) { const d = await res.json(); tags = d.value || []; }
      } catch (e) {}

      let entries = [];
      try {
        const res = await fetch(`${INLINE_API}/api/settings/changelog`);
        if (res.ok) { const d = await res.json(); entries = d.value || []; }
      } catch (e) {}

      // Inject side panel CSS
      const panelStyle = document.createElement('style');
      panelStyle.textContent = `
        .cl-quickbar {
          position: fixed; top: 56px; left: 0; right: 0; z-index: 90;
          background: rgba(43,31,21,0.97); backdrop-filter: blur(14px);
          border-bottom: 1px solid rgba(244,201,93,0.12);
          padding: 0.6rem 2rem; display: flex; align-items: center;
          gap: 0.8rem; justify-content: center;
        }
        .cl-quickbar input {
          font-family: 'Nunito',sans-serif; font-size: 0.88rem; color: #FFF4DC;
          background: rgba(43,31,21,0.8); border: 1.5px solid rgba(244,201,93,0.15);
          border-radius: 10px; padding: 0.55rem 0.85rem; outline: none; transition: all 0.2s;
        }
        .cl-quickbar input:focus { border-color: #F4C95D; box-shadow: 0 0 0 3px rgba(244,201,93,0.1); }
        .cl-quickbar input::placeholder { color: #FFF4DC; opacity: 0.3; }
        .cl-quickbar-btn {
          font-family: 'Fredoka',sans-serif; font-size: 0.88rem; font-weight: 600;
          background: #F4C95D; color: #1a1209; border: none; padding: 0.55rem 1.2rem;
          border-radius: 10px; cursor: pointer; box-shadow: 0 2px 0 #c9a030;
          transition: all 0.15s; white-space: nowrap;
        }
        .cl-quickbar-btn:hover { transform: translateY(-1px); }

        .cl-sidepanel {
          position: fixed; top: 0; right: -480px; width: 460px; max-width: 90vw;
          height: 100vh; z-index: 300; background: #2b1f15;
          border-left: 1px solid rgba(244,201,93,0.12);
          box-shadow: -8px 0 40px rgba(0,0,0,0.4);
          transition: right 0.35s cubic-bezier(0.16, 1, 0.3, 1);
          display: flex; flex-direction: column; overflow: hidden;
        }
        .cl-sidepanel.open { right: 0; }
        .cl-panel-scrim {
          position: fixed; inset: 0; z-index: 299;
          background: rgba(0,0,0,0.4); opacity: 0; pointer-events: none;
          transition: opacity 0.3s;
        }
        .cl-panel-scrim.open { opacity: 1; pointer-events: auto; }

        .cl-panel-header {
          padding: 1.2rem 1.5rem; border-bottom: 1px solid rgba(244,201,93,0.08);
          display: flex; align-items: center; justify-content: space-between;
        }
        .cl-panel-title { font-family: 'Fredoka',sans-serif; font-size: 1.15rem; font-weight: 700; color: #FFF4DC; }
        .cl-panel-close {
          background: none; border: 1px solid rgba(255,244,220,0.15); color: #FFF4DC;
          font-family: 'Fredoka',sans-serif; font-size: 0.85rem; font-weight: 600;
          padding: 0.4rem 0.8rem; border-radius: 8px; cursor: pointer; transition: all 0.15s;
        }
        .cl-panel-close:hover { background: rgba(255,244,220,0.08); }

        .cl-panel-body {
          flex: 1; overflow-y: auto; padding: 1.2rem 1.5rem;
          scrollbar-width: thin; scrollbar-color: rgba(244,201,93,0.15) transparent;
        }
        .cl-panel-body::-webkit-scrollbar { width: 6px; }
        .cl-panel-body::-webkit-scrollbar-thumb { background: rgba(244,201,93,0.15); border-radius: 3px; }

        .cl-panel-footer {
          padding: 1rem 1.5rem; border-top: 1px solid rgba(244,201,93,0.08);
          display: flex; gap: 0.6rem;
        }
        .cl-panel-save {
          font-family: 'Fredoka',sans-serif; font-size: 0.9rem; font-weight: 600;
          background: #F4C95D; color: #1a1209; border: none; padding: 0.65rem 1.4rem;
          border-radius: 10px; cursor: pointer; box-shadow: 0 2px 0 #c9a030; flex: 1; transition: all 0.15s;
        }
        .cl-panel-save:hover { transform: translateY(-1px); }
        .cl-panel-delete {
          font-family: 'Fredoka',sans-serif; font-size: 0.9rem; font-weight: 600;
          background: none; border: 1px solid rgba(232,154,110,0.3); color: #E89A6E;
          padding: 0.65rem 1rem; border-radius: 10px; cursor: pointer; transition: all 0.15s;
        }
        .cl-panel-delete:hover { background: rgba(232,154,110,0.1); }

        .sp-field { margin-bottom: 0.9rem; }
        .sp-label { display: block; font-family: 'Fredoka',sans-serif; font-size: 0.78rem; font-weight: 600; color: #F4C95D; margin-bottom: 0.3rem; letter-spacing: 0.04em; }
        .sp-input {
          width: 100%; font-family: 'Nunito',sans-serif; font-size: 0.88rem; color: #FFF4DC;
          background: rgba(43,31,21,0.8); border: 1.5px solid rgba(244,201,93,0.12);
          border-radius: 8px; padding: 0.55rem 0.75rem; outline: none; transition: border-color 0.2s;
          box-sizing: border-box;
        }
        .sp-input:focus { border-color: #F4C95D; }
        .sp-input::placeholder { color: #FFF4DC; opacity: 0.25; }
        textarea.sp-input { resize: vertical; min-height: 50px; line-height: 1.5; }
        .sp-row { display: grid; grid-template-columns: 1fr 1fr; gap: 0.6rem; }

        .sp-tags { display: flex; gap: 0.35rem; flex-wrap: wrap; }
        .sp-tag {
          font-family: 'Fredoka',sans-serif; font-size: 0.72rem; font-weight: 600;
          padding: 0.3rem 0.65rem; border-radius: 999px; cursor: pointer; transition: all 0.15s;
        }

        .sp-divider { height: 1px; background: rgba(244,201,93,0.08); margin: 1rem 0; }
        .sp-section-label { font-family: 'Fredoka',sans-serif; font-size: 0.9rem; font-weight: 700; color: #FFF4DC; margin-bottom: 0.8rem; }

        /* Change items with drag */
        .sp-change {
          display: flex; align-items: flex-start; gap: 0.5rem;
          padding: 0.6rem 0.5rem; background: rgba(255,244,220,0.03);
          border: 1px solid rgba(244,201,93,0.06); border-radius: 8px;
          margin-bottom: 0.4rem; cursor: default; transition: all 0.15s;
        }
        .sp-change:hover { border-color: rgba(244,201,93,0.15); }
        .sp-change.dragging { opacity: 0.4; }
        .sp-change-drag {
          cursor: grab; color: #FFF4DC; opacity: 0.2; font-size: 0.85rem;
          padding: 0.15rem 0; user-select: none; flex-shrink: 0;
        }
        .sp-change-drag:active { cursor: grabbing; }
        .sp-change-tag {
          font-family: 'Nunito',sans-serif; font-size: 0.6rem; font-weight: 700;
          text-transform: uppercase; letter-spacing: 0.05em;
          padding: 0.15rem 0.4rem; border-radius: 4px; flex-shrink: 0; margin-top: 0.15rem;
        }
        .sp-change-info { flex: 1; min-width: 0; }
        .sp-change-title { font-family: 'Fredoka',sans-serif; font-size: 0.82rem; font-weight: 600; color: #FFF4DC; }
        .sp-change-desc { font-family: 'Nunito',sans-serif; font-size: 0.75rem; color: #FFF4DC; opacity: 0.45; line-height: 1.4; }
        .sp-change-del {
          background: none; border: none; color: #E89A6E; opacity: 0.3; cursor: pointer;
          font-size: 0.8rem; padding: 0; transition: opacity 0.15s; flex-shrink: 0;
        }
        .sp-change-del:hover { opacity: 1; }

        .sp-add-change {
          border: 1px dashed rgba(244,201,93,0.12); border-radius: 8px;
          padding: 0.8rem; margin-top: 0.5rem;
        }
        .sp-add-btn {
          font-family: 'Fredoka',sans-serif; font-size: 0.82rem; font-weight: 600;
          background: none; border: 1px solid rgba(244,201,93,0.15); color: #FFF4DC;
          padding: 0.4rem 0.8rem; border-radius: 8px; cursor: pointer; opacity: 0.6;
          transition: all 0.15s;
        }
        .sp-add-btn:hover { opacity: 1; border-color: rgba(244,201,93,0.3); }

        .sp-img-preview { margin-top: 0.4rem; }
        .sp-img-preview img { max-width: 160px; max-height: 90px; border-radius: 8px; border: 1px solid rgba(244,201,93,0.1); }

        @media (max-width: 600px) {
          .cl-sidepanel { width: 100%; right: -100%; }
          .cl-quickbar { padding: 0.5rem 1rem; flex-wrap: wrap; }
          .cl-quickbar input { flex: 1; min-width: 0; }
        }
      `;
      document.head.appendChild(panelStyle);

      // Inject quick-add bar
      const quickbar = document.createElement('div');
      quickbar.className = 'cl-quickbar';
      quickbar.innerHTML = `
        <input type="text" id="qbTitle" placeholder="Patch title..." style="flex:1;min-width:120px;" />
        <input type="text" id="qbVersion" placeholder="v2.0" style="width:70px;" />
        <button class="cl-quickbar-btn" id="qbCreateBtn">+ New Patch Note</button>
        <button class="cl-quickbar-btn" id="qbAdminBtn" style="background:none;border:1px solid rgba(255,244,220,0.15);color:#FFF4DC;box-shadow:none;">⚙ Admin</button>
      `;
      document.body.appendChild(quickbar);

      // Inject side panel
      const scrim = document.createElement('div');
      scrim.className = 'cl-panel-scrim';
      scrim.id = 'clPanelScrim';
      document.body.appendChild(scrim);

      const panel = document.createElement('div');
      panel.className = 'cl-sidepanel';
      panel.id = 'clSidePanel';
      document.body.appendChild(panel);

      // Adjust page content for quickbar
      document.querySelector('.page-header').style.marginTop = '48px';

      // Hide old toolbar
      const oldToolbar = document.getElementById('inlineToolbar');
      if (oldToolbar) oldToolbar.style.display = 'none';

      // State
      let panelEntry = null;
      let panelChanges = [];
      let panelSelectedTags = new Set();
      let panelChangeTag = '';
      let panelIsNew = false;

      function getTagById(id) { return tags.find(t => t.id === id); }

      // Open panel
      function openPanel(entry, isNew) {
        panelEntry = entry ? { ...entry } : { title: '', version: '', date: new Date().toISOString().split('T')[0], tags: [], changes: [], image: null, status: 'published', pinned: false, id: `cl-${Date.now()}` };
        panelChanges = [...(panelEntry.changes || [])];
        panelSelectedTags = new Set(panelEntry.tags || []);
        panelIsNew = isNew;
        panelChangeTag = '';
        renderPanel();
        panel.classList.add('open');
        scrim.classList.add('open');
        document.body.style.overflow = 'hidden';
      }

      function closePanel() {
        panel.classList.remove('open');
        scrim.classList.remove('open');
        document.body.style.overflow = '';
      }

      scrim.addEventListener('click', closePanel);

      function renderPanel() {
        const isEdit = !panelIsNew;

        const tagsHtml = tags.map(t => {
          const a = panelSelectedTags.has(t.id);
          const s = a ? `background:${t.color};color:#1a1209;border-color:${t.color};` : `border-color:${t.color}55;color:${t.color};border:1px solid ${t.color}55;background:transparent;`;
          return `<button type="button" class="sp-tag sp-entry-tag" data-tag="${t.id}" style="${s}">${t.name}</button>`;
        }).join('');

        panel.innerHTML = `
          <div class="cl-panel-header">
            <span class="cl-panel-title">${isEdit ? 'Edit Patch Note' : 'New Patch Note'}</span>
            <button class="cl-panel-close" id="spClose">✕</button>
          </div>
          <div class="cl-panel-body">
            <div class="sp-field">
              <label class="sp-label">Title</label>
              <input class="sp-input" id="spTitle" value="${escape(panelEntry.title || '')}" placeholder="Economy Rebalance" />
            </div>
            <div class="sp-row">
              <div class="sp-field">
                <label class="sp-label">Version</label>
                <input class="sp-input" id="spVersion" value="${escape(panelEntry.version || '')}" placeholder="v2.4.1" />
              </div>
              <div class="sp-field">
                <label class="sp-label">Date</label>
                <input class="sp-input" id="spDate" value="${panelEntry.date || ''}" placeholder="2026-04-18" />
              </div>
            </div>
            <div class="sp-field">
              <label class="sp-label">Tags</label>
              <div class="sp-tags" id="spTags">${tagsHtml}</div>
            </div>
            <div class="sp-field">
              <label class="sp-label">Image</label>
              <div style="display:flex;gap:0.4rem;align-items:end;">
                <input class="sp-input" id="spImage" value="${escape(panelEntry.image || '')}" placeholder="URL or upload" style="flex:1;" />
                <input type="file" id="spImageFile" accept="image/png,image/jpeg,image/gif,image/webp" style="display:none;" />
                <button class="sp-add-btn" id="spImageUpload" style="padding:0.5rem 0.6rem;">📷</button>
              </div>
              <div class="sp-img-preview" id="spImagePreview"></div>
            </div>

            <div class="sp-divider"></div>
            <div class="sp-section-label">Changes</div>
            <div id="spChangesList"></div>

            <div class="sp-add-change">
              <div class="sp-field" style="margin-bottom:0.5rem;">
                <input class="sp-input" id="spNewChangeTitle" placeholder="Change title" />
              </div>
              <div class="sp-field" style="margin-bottom:0.5rem;">
                <textarea class="sp-input" id="spNewChangeDesc" rows="2" placeholder="Description (optional)"></textarea>
              </div>
              <div class="sp-field" style="margin-bottom:0.5rem;">
                <div class="sp-tags" id="spChangeTagPicker"></div>
              </div>
              <button class="sp-add-btn" id="spAddChangeBtn">+ Add Change</button>
            </div>
          </div>
          <div class="cl-panel-footer">
            <button class="cl-panel-save" id="spSave">${isEdit ? 'Save Changes' : 'Publish'}</button>
            ${isEdit ? '<button class="cl-panel-delete" id="spDelete">Delete</button>' : ''}
          </div>
        `;

        // Wire everything
        panel.querySelector('#spClose').addEventListener('click', closePanel);

        // Entry tag toggles
        panel.querySelectorAll('.sp-entry-tag').forEach(btn => {
          btn.addEventListener('click', () => {
            const t = btn.dataset.tag;
            panelSelectedTags.has(t) ? panelSelectedTags.delete(t) : panelSelectedTags.add(t);
            const tag = getTagById(t);
            const a = panelSelectedTags.has(t);
            btn.style = a ? `background:${tag.color};color:#1a1209;border-color:${tag.color};` : `border-color:${tag.color}55;color:${tag.color};border:1px solid ${tag.color}55;background:transparent;`;
          });
        });

        // Image upload
        const spImgInput = panel.querySelector('#spImage');
        const spImgFile = panel.querySelector('#spImageFile');

        function renderImgPreview(url) {
          const prev = panel.querySelector('#spImagePreview');
          if (!url) { prev.innerHTML = ''; return; }
          prev.innerHTML = `<div style="position:relative;display:inline-block;margin-top:0.4rem;">
            <img src="${url}" style="max-width:160px;max-height:90px;border-radius:8px;border:1px solid rgba(244,201,93,0.1);" />
            <button type="button" id="spImgClear" style="position:absolute;top:3px;right:3px;width:18px;height:18px;background:rgba(0,0,0,0.7);border:none;color:#fff;font-size:0.6rem;border-radius:50%;cursor:pointer;display:flex;align-items:center;justify-content:center;">✕</button>
          </div>`;
          prev.querySelector('#spImgClear')?.addEventListener('click', () => { spImgInput.value = ''; prev.innerHTML = ''; });
        }

        if (panelEntry.image) renderImgPreview(panelEntry.image);
        spImgInput.addEventListener('input', () => renderImgPreview(spImgInput.value.trim()));

        panel.querySelector('#spImageUpload').addEventListener('click', () => spImgFile.click());
        spImgFile.addEventListener('change', async (e) => {
          const file = e.target.files[0];
          if (!file) return;
          try {
            const fd = new FormData(); fd.append('file', file);
            const tk = localStorage.getItem('ccAuthToken');
            const res = await fetch(`${INLINE_API}/api/gallery/upload`, { method: 'POST', headers: tk ? { 'Authorization': `Bearer ${tk}` } : {}, body: fd });
            const data = await res.json();
            if (res.ok && data.url) { spImgInput.value = data.url; renderImgPreview(data.url); }
          } catch (err) {}
          e.target.value = '';
        });

        // Changes list with drag
        renderChanges();
        renderChangeTagPicker();

        // Add change
        panel.querySelector('#spAddChangeBtn').addEventListener('click', () => {
          const t = panel.querySelector('#spNewChangeTitle').value.trim();
          if (!t) return;
          panelChanges.push({ title: t, description: panel.querySelector('#spNewChangeDesc').value.trim() || null, tag: panelChangeTag || null });
          panel.querySelector('#spNewChangeTitle').value = '';
          panel.querySelector('#spNewChangeDesc').value = '';
          panelChangeTag = '';
          renderChanges();
          renderChangeTagPicker();
        });

        // Save
        panel.querySelector('#spSave').addEventListener('click', async () => {
          const title = panel.querySelector('#spTitle').value.trim();
          const date = panel.querySelector('#spDate').value.trim();
          if (!title || !date) { showInlineToast('Title and date required.'); return; }
          if (panelChanges.length === 0) { showInlineToast('Add at least one change.'); return; }

          const updated = {
            title, version: panel.querySelector('#spVersion').value.trim() || null, date,
            tags: [...panelSelectedTags], changes: panelChanges,
            image: panel.querySelector('#spImage').value.trim() || null,
            status: panelEntry.status || 'published', pinned: panelEntry.pinned || false,
            id: panelEntry.id,
          };

          if (panelIsNew) { entries.push(updated); }
          else { const idx = entries.findIndex(e => e.id === panelEntry.id); if (idx >= 0) entries[idx] = updated; }

          await saveAndReload('changelog', entries, token);
          closePanel();
        });

        // Delete
        panel.querySelector('#spDelete')?.addEventListener('click', async () => {
          if (!confirm('Delete this patch note?')) return;
          entries = entries.filter(e => e.id !== panelEntry.id);
          await saveAndReload('changelog', entries, token);
          closePanel();
        });
      }

      let editingChangeIdx = null;

      function renderChanges() {
        const list = panel.querySelector('#spChangesList');
        if (panelChanges.length === 0) {
          list.innerHTML = '<div style="font-family:Nunito;font-size:0.8rem;color:#FFF4DC;opacity:0.25;padding:0.5rem 0;">No changes yet</div>';
          return;
        }
        list.innerHTML = panelChanges.map((c, i) => {
          const t = c.tag ? getTagById(c.tag) : null;
          const tagHtml = t ? `<span class="sp-change-tag" style="background:${t.color}22;color:${t.color};border:1px solid ${t.color}55;">${t.name}</span>` : '';

          if (editingChangeIdx === i) {
            // Inline edit mode
            const editTagsHtml = tags.map(tg => {
              const a = c.tag === tg.id;
              const s = a ? `background:${tg.color};color:#1a1209;border-color:${tg.color};` : `border-color:${tg.color}55;color:${tg.color};border:1px solid ${tg.color}55;background:transparent;`;
              return `<button type="button" class="sp-tag sp-edit-ctag" data-tag="${tg.id}" style="${s};font-size:0.65rem;padding:0.2rem 0.45rem;">${tg.name}</button>`;
            }).join('');

            return `<div class="sp-change" style="border-color:rgba(244,201,93,0.3);background:rgba(244,201,93,0.04);" data-idx="${i}">
              <div style="width:100%;">
                <div class="sp-field" style="margin-bottom:0.5rem;">
                  <input class="sp-input sp-edit-title" value="${escape(c.title)}" style="font-weight:600;font-size:0.88rem;" />
                </div>
                <div class="sp-field" style="margin-bottom:0.5rem;">
                  <textarea class="sp-input sp-edit-desc" rows="2" placeholder="Description (optional)">${c.description || ''}</textarea>
                </div>
                <div style="display:flex;gap:0.3rem;flex-wrap:wrap;margin-bottom:0.5rem;">${editTagsHtml}</div>
                <div style="display:flex;gap:0.4rem;">
                  <button class="sp-add-btn sp-edit-done" style="padding:0.35rem 0.7rem;font-size:0.78rem;">✓ Done</button>
                  <button class="sp-add-btn sp-edit-cancel" style="padding:0.35rem 0.7rem;font-size:0.78rem;">Cancel</button>
                </div>
              </div>
            </div>`;
          }

          return `<div class="sp-change" draggable="true" data-idx="${i}">
            <span class="sp-change-drag">⠿</span>
            ${tagHtml}
            <div class="sp-change-info sp-change-click" data-idx="${i}" style="cursor:pointer;" title="Click to edit">
              <div class="sp-change-title">${c.title}</div>
              ${c.description ? `<div class="sp-change-desc">${c.description}</div>` : ''}
            </div>
            <button class="sp-change-del" data-idx="${i}">✕</button>
          </div>`;
        }).join('');

        // Click to edit
        list.querySelectorAll('.sp-change-click').forEach(el => {
          el.addEventListener('click', (e) => {
            e.stopPropagation();
            editingChangeIdx = parseInt(el.dataset.idx);
            renderChanges();
            // Focus the title input
            const titleInput = list.querySelector('.sp-edit-title');
            if (titleInput) titleInput.focus();
          });
        });

        // Edit mode: done / cancel / tag toggle
        const doneBtn = list.querySelector('.sp-edit-done');
        const cancelBtn = list.querySelector('.sp-edit-cancel');

        if (doneBtn) {
          doneBtn.addEventListener('click', () => {
            const idx = editingChangeIdx;
            const titleVal = list.querySelector('.sp-edit-title').value.trim();
            if (!titleVal) return;
            panelChanges[idx].title = titleVal;
            panelChanges[idx].description = list.querySelector('.sp-edit-desc').value.trim() || null;
            editingChangeIdx = null;
            renderChanges();
          });
        }

        if (cancelBtn) {
          cancelBtn.addEventListener('click', () => {
            editingChangeIdx = null;
            renderChanges();
          });
        }

        list.querySelectorAll('.sp-edit-ctag').forEach(btn => {
          btn.addEventListener('click', () => {
            const idx = editingChangeIdx;
            const tag = btn.dataset.tag;
            panelChanges[idx].tag = panelChanges[idx].tag === tag ? null : tag;
            renderChanges();
          });
        });

        // Delete
        list.querySelectorAll('.sp-change-del').forEach(btn => {
          btn.addEventListener('click', (e) => {
            e.stopPropagation();
            panelChanges.splice(parseInt(btn.dataset.idx), 1);
            if (editingChangeIdx !== null) editingChangeIdx = null;
            renderChanges();
          });
        });

        // Drag reorder (only on non-editing items)
        let dragIdx = null;
        list.querySelectorAll('.sp-change[draggable="true"]').forEach(el => {
          el.addEventListener('dragstart', (e) => {
            dragIdx = parseInt(el.dataset.idx);
            el.classList.add('dragging');
            e.dataTransfer.effectAllowed = 'move';
          });
          el.addEventListener('dragend', () => { el.classList.remove('dragging'); dragIdx = null; });
          el.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            const targetIdx = parseInt(el.dataset.idx);
            if (dragIdx !== null && dragIdx !== targetIdx) {
              const [moved] = panelChanges.splice(dragIdx, 1);
              panelChanges.splice(targetIdx, 0, moved);
              dragIdx = targetIdx;
              renderChanges();
            }
          });
        });
      }

      function renderChangeTagPicker() {
        const container = panel.querySelector('#spChangeTagPicker');
        container.innerHTML = tags.map(t => {
          const a = panelChangeTag === t.id;
          const s = a ? `background:${t.color};color:#1a1209;border-color:${t.color};` : `border-color:${t.color}55;color:${t.color};border:1px solid ${t.color}55;background:transparent;`;
          return `<button type="button" class="sp-tag sp-ctag" data-tag="${t.id}" style="${s}">${t.name}</button>`;
        }).join('');
        container.querySelectorAll('.sp-ctag').forEach(btn => {
          btn.addEventListener('click', () => {
            panelChangeTag = panelChangeTag === btn.dataset.tag ? '' : btn.dataset.tag;
            renderChangeTagPicker();
          });
        });
      }

      // Quick-add bar
      document.getElementById('qbCreateBtn').addEventListener('click', () => {
        const title = document.getElementById('qbTitle').value.trim();
        const version = document.getElementById('qbVersion').value.trim();
        const entry = { title: title || '', version: version || null, date: new Date().toISOString().split('T')[0], tags: [], changes: [], image: null, status: 'published', pinned: false, id: `cl-${Date.now()}` };
        document.getElementById('qbTitle').value = '';
        document.getElementById('qbVersion').value = '';
        openPanel(entry, true);
      });

      document.getElementById('qbAdminBtn').addEventListener('click', () => {
        window.location.href = 'admin.html';
      });

      // Click entries to edit
      document.querySelectorAll('.changelog-entry').forEach(el => {
        el.style.cursor = 'pointer';
        el.addEventListener('click', (e) => {
          if (e.target.closest('.reaction-btn')) return;
          const entryId = el.dataset.entryId;
          const entry = entries.find(x => x.id === entryId);
          if (entry) openPanel(entry, false);
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
          <label class="im-label">Featured Image</label>
          <div style="display:flex;gap:0.5rem;align-items:end;">
            <input type="text" id="imChrImage" value="${escape(article?.image || '')}" placeholder="URL or upload" style="flex:1;" />
            <input type="file" id="imChrImageFile" accept="image/png,image/jpeg,image/gif,image/webp" style="display:none;" />
            <button class="im-btn im-btn-cancel" id="imChrImageUploadBtn" style="font-size:0.8rem;padding:0.5rem 0.8rem;white-space:nowrap;">📷 Upload</button>
          </div>
          <div id="imChrImageStatus" style="margin-top:0.4rem;"></div>
          <div id="imChrImagePreview" style="margin-top:0.4rem;"></div>
        </div>
        <div class="im-field">
          <label class="im-label">Body</label>
          <textarea id="imChrBody" rows="10" placeholder="## The Incident&#10;&#10;It was a Tuesday...&#10;&#10;> This is a pull quote that gets highlighted">${article?.body || ''}</textarea>
          <div class="im-hint">## for headers, - for bullets, **bold**, *italic*, > for pull quotes</div>
        </div>
        <div class="im-field">
          <label class="im-label">Editor's Note (optional)</label>
          <input type="text" id="imChrEditorsNote" value="${escape(article?.editorsNote || '')}" placeholder="The author has been temporarily banned for 'journalistic overreach.'" />
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
            editorsNote: document.getElementById('imChrEditorsNote').value.trim() || null,
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

      // Image upload
      const imChrUploadBtn = overlay.querySelector('#imChrImageUploadBtn');
      const imChrFileInput = overlay.querySelector('#imChrImageFile');
      const imChrImageInput = overlay.querySelector('#imChrImage');

      function renderImChrPreview(url) {
        const preview = overlay.querySelector('#imChrImagePreview');
        if (!url) { preview.innerHTML = ''; return; }
        preview.innerHTML = `<div style="position:relative;display:inline-block;">
          <img src="${url}" style="max-width:180px;max-height:100px;border-radius:8px;border:1px solid rgba(244,201,93,0.15);" />
          <button type="button" style="position:absolute;top:3px;right:3px;width:20px;height:20px;background:rgba(0,0,0,0.7);border:none;color:#fff;font-size:0.65rem;border-radius:50%;cursor:pointer;display:flex;align-items:center;justify-content:center;" id="imChrImgClear">✕</button>
        </div>`;
        overlay.querySelector('#imChrImgClear')?.addEventListener('click', () => {
          imChrImageInput.value = '';
          preview.innerHTML = '';
        });
      }

      // Show preview if editing existing image
      if (article?.image) renderImChrPreview(article.image);

      imChrImageInput.addEventListener('input', () => renderImChrPreview(imChrImageInput.value.trim()));

      imChrUploadBtn.addEventListener('click', () => imChrFileInput.click());
      imChrFileInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const status = overlay.querySelector('#imChrImageStatus');
        status.textContent = 'Uploading...';
        status.style.cssText = 'font-family:Nunito,sans-serif;font-size:0.78rem;color:#F4C95D;';
        try {
          const formData = new FormData();
          formData.append('file', file);
          const token = localStorage.getItem('ccAuthToken');
          const res = await fetch(`${INLINE_API}/api/gallery/upload`, {
            method: 'POST',
            headers: token ? { 'Authorization': `Bearer ${token}` } : {},
            body: formData,
          });
          const data = await res.json();
          if (res.ok && data.url) {
            imChrImageInput.value = data.url;
            renderImChrPreview(data.url);
            status.textContent = 'Uploaded!';
            status.style.color = '#A8C77E';
            setTimeout(() => { status.textContent = ''; }, 2500);
          } else {
            status.textContent = data.error || 'Upload failed';
            status.style.color = '#E89A6E';
          }
        } catch (err) {
          status.textContent = 'Upload failed';
          status.style.color = '#E89A6E';
        }
        e.target.value = '';
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
