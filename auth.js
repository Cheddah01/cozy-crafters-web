// ============================================
// Cozy Crafters — Shared Auth
// Include this on every page that needs login UI
// ============================================

const CC_API = 'https://cozy-crafters-api.colbysthickey.workers.dev';
const CC_AUTH_KEY = 'ccAuthToken';

// Check URL for auth callback
(function handleAuthCallback() {
  const params = new URLSearchParams(window.location.search);
  if (params.get('auth') === 'success' && params.get('token')) {
    localStorage.setItem(CC_AUTH_KEY, params.get('token'));
    // Clean URL
    window.history.replaceState({}, '', window.location.pathname);
  } else if (params.get('auth') === 'error') {
    console.warn('Auth error:', params.get('reason'));
    window.history.replaceState({}, '', window.location.pathname);
  }
})();

// Get stored token
function ccGetToken() {
  return localStorage.getItem(CC_AUTH_KEY);
}

// Get current user from token (client-side decode, no API call)
function ccGetUser() {
  const token = ccGetToken();
  if (!token) return null;
  try {
    const body = token.split('.')[1];
    const payload = JSON.parse(atob(body.replace(/-/g, '+').replace(/_/g, '/')));
    // Check expiry
    if (payload.exp && Date.now() / 1000 > payload.exp) {
      localStorage.removeItem(CC_AUTH_KEY);
      return null;
    }
    return payload;
  } catch (e) {
    localStorage.removeItem(CC_AUTH_KEY);
    return null;
  }
}

// Logout
function ccLogout() {
  localStorage.removeItem(CC_AUTH_KEY);
  window.location.reload();
}

// Login redirect
function ccLogin() {
  window.location.href = `${CC_API}/auth/discord`;
}

// Render auth UI in the nav
function ccRenderAuthNav() {
  const user = ccGetUser();
  const nav = document.getElementById('mainNav');
  if (!nav) return;

  // Find or create auth container
  let authEl = document.getElementById('navAuth');
  if (!authEl) {
    authEl = document.createElement('div');
    authEl.id = 'navAuth';
    authEl.style.cssText = 'display:flex; align-items:center; gap:0.7rem; margin-left:1rem;';
    // Insert before hamburger if it exists, otherwise append
    const hamburger = nav.querySelector('.nav-hamburger');
    if (hamburger) {
      nav.insertBefore(authEl, hamburger);
    } else {
      nav.appendChild(authEl);
    }
  }

  if (user) {
    const adminBtn = user.role === 'admin'
      ? `<a href="admin.html" style="font-family:'Fredoka',sans-serif; font-size:0.75rem; font-weight:600; background:rgba(244,201,93,0.15); border:1px solid rgba(244,201,93,0.3); color:#F4C95D; padding:0.3rem 0.7rem; border-radius:8px; text-decoration:none; transition:all 0.2s;" onmouseover="this.style.background='rgba(244,201,93,0.25)'" onmouseout="this.style.background='rgba(244,201,93,0.15)'">⚙ Admin</a>`
      : '';
    authEl.innerHTML = `
      <img src="${user.avatar}" alt="" style="width:30px; height:30px; border-radius:50%; border:2px solid rgba(244,201,93,0.3);" />
      <span style="font-family:'Fredoka',sans-serif; font-size:0.88rem; font-weight:600; color:#FFF4DC;">${user.username}</span>
      ${adminBtn}
      <button onclick="ccLogout()" style="font-family:'Fredoka',sans-serif; font-size:0.75rem; font-weight:600; background:none; border:1px solid rgba(255,244,220,0.2); color:#FFF4DC; opacity:0.5; padding:0.3rem 0.6rem; border-radius:8px; cursor:pointer; transition:opacity 0.2s;" onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='0.5'">Log out</button>
    `;
  } else {
    authEl.innerHTML = `
      <button onclick="ccLogin()" style="font-family:'Fredoka',sans-serif; font-size:0.88rem; font-weight:600; background:rgba(88,101,242,0.9); color:#fff; border:none; padding:0.5rem 1.1rem; border-radius:10px; cursor:pointer; display:inline-flex; align-items:center; gap:0.4rem; transition:all 0.2s; box-shadow:0 2px 0 #4752C4;" onmouseover="this.style.transform='translateY(-1px)'" onmouseout="this.style.transform='none'">
        <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128c.12-.094.246-.192.373-.292a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.3 12.3 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.84 19.84 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.06.06 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419s.956-2.419 2.157-2.419c1.21 0 2.176 1.095 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419s.956-2.419 2.157-2.419c1.21 0 2.176 1.095 2.157 2.42 0 1.333-.947 2.418-2.157 2.418z"/></svg>
        Log in
      </button>
    `;
  }

  // Also update mobile menu
  const mobileMenu = document.getElementById('mobileMenu');
  if (mobileMenu) {
    let mobileAuth = document.getElementById('mobileAuth');
    if (!mobileAuth) {
      mobileAuth = document.createElement('div');
      mobileAuth.id = 'mobileAuth';
      mobileAuth.style.cssText = 'text-align:center; margin-top:2rem;';
      mobileMenu.querySelector('ul').after(mobileAuth);
    }
    if (user) {
      const mAdminBtn = user.role === 'admin'
        ? `<a href="admin.html" style="font-family:'Fredoka',sans-serif; font-size:0.9rem; font-weight:600; background:rgba(244,201,93,0.15); border:1px solid rgba(244,201,93,0.3); color:#F4C95D; padding:0.5rem 1.2rem; border-radius:10px; text-decoration:none; display:inline-block;">⚙ Admin Panel</a>`
        : '';
      mobileAuth.innerHTML = `
        <div style="display:flex; flex-direction:column; align-items:center; gap:0.8rem;">
          <img src="${user.avatar}" alt="" style="width:48px; height:48px; border-radius:50%; border:2px solid rgba(244,201,93,0.3);" />
          <span style="font-family:'Fredoka',sans-serif; font-size:1rem; font-weight:600; color:#FFF4DC;">${user.username}</span>
          ${mAdminBtn}
          <button onclick="ccLogout()" style="font-family:'Fredoka',sans-serif; font-size:0.85rem; font-weight:600; background:none; border:1px solid rgba(255,244,220,0.2); color:#FFF4DC; padding:0.4rem 1rem; border-radius:8px; cursor:pointer;">Log out</button>
        </div>`;
    } else {
      mobileAuth.innerHTML = `
        <button onclick="ccLogin()" style="font-family:'Fredoka',sans-serif; font-size:1rem; font-weight:600; background:rgba(88,101,242,0.9); color:#fff; border:none; padding:0.7rem 1.5rem; border-radius:12px; cursor:pointer; display:inline-flex; align-items:center; gap:0.5rem;">
          <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128c.12-.094.246-.192.373-.292a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.3 12.3 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.84 19.84 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.06.06 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419s.956-2.419 2.157-2.419c1.21 0 2.176 1.095 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419s.956-2.419 2.157-2.419c1.21 0 2.176 1.095 2.157 2.42 0 1.333-.947 2.418-2.157 2.418z"/></svg>
          Log in with Discord
        </button>`;
    }
  }
}

// Auto-run on page load
document.addEventListener('DOMContentLoaded', ccRenderAuthNav);
