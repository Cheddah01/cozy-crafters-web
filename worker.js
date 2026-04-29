// ============================================
// Simple JWT helpers (no external deps)
// ============================================
function base64url(str) {
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64urlObj(obj) {
  return base64url(JSON.stringify(obj));
}

async function signJWT(payload, secret) {
  const header = base64urlObj({ alg: 'HS256', typ: 'JWT' });
  const body = base64urlObj(payload);
  const data = `${header}.${body}`;
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data));
  const sigStr = base64url(String.fromCharCode(...new Uint8Array(sig)));
  return `${data}.${sigStr}`;
}

async function verifyJWT(token, secret) {
  try {
    const [header, body, sig] = token.split('.');
    const data = `${header}.${body}`;
    const key = await crypto.subtle.importKey(
      'raw', new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']
    );
    const sigBytes = Uint8Array.from(atob(sig.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
    const valid = await crypto.subtle.verify('HMAC', key, sigBytes, new TextEncoder().encode(data));
    if (!valid) return null;
    const payload = JSON.parse(atob(body.replace(/-/g, '+').replace(/_/g, '/')));
    if (payload.exp && Date.now() / 1000 > payload.exp) return null;
    return payload;
  } catch (e) { return null; }
}

function truncateDiscord(str, max) {
  const s = String(str ?? '');
  if (s.length <= max) return s;
  return s.slice(0, Math.max(0, max - 1)) + '…';
}

function normalizeDiscordWebhookCfg(raw) {
  if (!raw) return { url: '', autoPost: false };
  if (typeof raw === 'string') return { url: raw.trim(), autoPost: false };
  return { url: String(raw.url || '').trim(), autoPost: !!raw.autoPost };
}

function discordBucketForTag(tagId, changelogTags) {
  const tags = Array.isArray(changelogTags) ? changelogTags : [];
  const meta = tags.find((t) => t && t.id === tagId);
  if (meta && meta.discordBucket && ['added', 'changed', 'fixed', 'removed', 'other'].includes(meta.discordBucket)) {
    return meta.discordBucket;
  }
  const fallback = {
    'new-feature': 'added',
    'bug-fix': 'fixed',
    'removal': 'removed',
    'balance': 'changed',
    'qol': 'changed',
    'event': 'changed',
  };
  if (tagId && fallback[tagId]) return fallback[tagId];
  return 'other';
}

function formatChangeLine(c) {
  let line = `• **${truncateDiscord(c.title || 'Change', 200)}**`;
  if (c.description) line += `\n${c.description}`;
  return line;
}

function buildPatchNoteDiscordEmbed(entry, changelogTags, siteUrl) {
  const entryId = entry.id || '';
  const pageUrl = `${siteUrl}/changelog.html#${encodeURIComponent(entryId)}`;
  const dateStr = entry.date || '';
  const rawTitle = `📋 Patch Notes — ${dateStr}`;
  let title = truncateDiscord(rawTitle, 256);

  const ver = entry.version ? `\n*${entry.version}*` : '';
  let description = truncateDiscord(`**${entry.title || 'Patch notes'}**${ver}\n\n[View full notes on the site](${pageUrl})`, 4096);

  const buckets = { added: [], changed: [], fixed: [], removed: [], other: [] };
  for (const ch of entry.changes || []) {
    const b = discordBucketForTag(ch && ch.tag ? ch.tag : null, changelogTags);
    const key = buckets[b] !== undefined ? b : 'other';
    buckets[key].push(formatChangeLine(ch));
  }

  const fieldLabels = {
    added: 'Added',
    changed: 'Changed',
    fixed: 'Fixed',
    removed: 'Removed',
    other: 'Other',
  };

  let fields = [];
  for (const k of ['added', 'changed', 'fixed', 'removed', 'other']) {
    if (buckets[k].length === 0) continue;
    let val = buckets[k].join('\n\n');
    val = truncateDiscord(val, 1024);
    fields.push({ name: fieldLabels[k], value: val, inline: false });
  }

  let embed = {
    title,
    url: pageUrl,
    color: 16041821,
    description,
    fields,
    footer: { text: truncateDiscord('Cozy Crafters SMP — Season 2', 2048) },
  };

  function embedCharCount(em) {
    let n = (em.title || '').length + (em.description || '').length + (em.footer?.text || '').length;
    for (const f of em.fields || []) {
      n += (f.name || '').length + (f.value || '').length;
    }
    return n;
  }

  let budget = 5800;
  while (embedCharCount(embed) > budget && embed.fields.length > 0) {
    const f = embed.fields[embed.fields.length - 1];
    f.value = truncateDiscord(f.value, Math.max(100, Math.floor(f.value.length * 0.85)));
    if (f.value.length <= 120) embed.fields.pop();
  }
  if (embedCharCount(embed) > budget) {
    embed.description = truncateDiscord(embed.description, Math.max(200, Math.floor(embed.description.length * 0.8)));
  }
  if (embedCharCount(embed) > budget) {
    embed.description = truncateDiscord('Patch note was too long for Discord; [read the full changelog](' + pageUrl + ').', 4096);
    embed.fields = [];
  }

  return embed;
}

// ============================================
// Main Worker
// ============================================
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    const DISCORD_CLIENT_ID = env.DISCORD_CLIENT_ID || '1495223646283890719';
    const DISCORD_CLIENT_SECRET = env.DISCORD_CLIENT_SECRET;
    const JWT_SECRET = env.JWT_SECRET;
    const R2_PUBLIC = 'https://pub-36f7c4945e55454d8abcd89643e95937.r2.dev';
    const REDIRECT_URI = `${url.origin}/auth/discord/callback`;
    const SITE_URL = 'https://cozycrafters.net';

    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // Admin auth check
    function requireAdmin(req) {
      const auth = req.headers.get('Authorization');
      return auth === `Bearer ${env.AUTH_TOKEN}`;
    }

    function getCookie(req, name) {
      const cookie = req.headers.get('Cookie') || '';
      return cookie
        .split(';')
        .map(part => part.trim())
        .find(part => part.startsWith(`${name}=`))
        ?.slice(name.length + 1) || '';
    }

    function redirectWithHeaders(location, headers = {}) {
      return new Response(null, { status: 302, headers: { Location: location, ...headers } });
    }

    function isHttpUrl(value) {
      try {
        const parsed = new URL(String(value || ''));
        return parsed.protocol === 'http:' || parsed.protocol === 'https:';
      } catch (e) {
        return false;
      }
    }

    function uploadExt(type, fallback = 'bin') {
      return ({
        'image/png': 'png',
        'image/jpeg': 'jpg',
        'image/gif': 'gif',
        'image/webp': 'webp',
        'video/mp4': 'mp4',
        'video/webm': 'webm',
      })[type] || fallback;
    }

    // User auth check (JWT)
    async function getUser(req) {
      const auth = req.headers.get('Authorization');
      if (!auth || !auth.startsWith('Bearer ')) return null;
      const token = auth.substring(7);
      // Check if it's the admin token
      if (token === env.AUTH_TOKEN) return { role: 'admin' };
      return await verifyJWT(token, JWT_SECRET);
    }

    try {

      // ============================================
      // DISCORD OAUTH — Step 1: Redirect to Discord
      // ============================================
      if (request.method === 'GET' && path === '/auth/discord') {
        const state = crypto.randomUUID();
        const params = new URLSearchParams({
          client_id: DISCORD_CLIENT_ID,
          redirect_uri: REDIRECT_URI,
          response_type: 'code',
          scope: 'identify',
          state: state,
        });
        return redirectWithHeaders(`https://discord.com/api/oauth2/authorize?${params}`, {
          'Set-Cookie': `cc_oauth_state=${state}; HttpOnly; Secure; SameSite=Lax; Path=/auth/discord/callback; Max-Age=300`,
        });
      }

      // ============================================
      // DISCORD OAUTH — Step 2: Callback
      // ============================================
      if (request.method === 'GET' && path === '/auth/discord/callback') {
        const code = url.searchParams.get('code');
        const state = url.searchParams.get('state');
        const storedState = getCookie(request, 'cc_oauth_state');
        const clearStateCookie = 'cc_oauth_state=; HttpOnly; Secure; SameSite=Lax; Path=/auth/discord/callback; Max-Age=0';

        if (!state || !storedState || state !== storedState) {
          return redirectWithHeaders(`${SITE_URL}/auth-callback.html#error=invalid_state`, {
            'Set-Cookie': clearStateCookie,
          });
        }

        if (!code) {
          return redirectWithHeaders(`${SITE_URL}/auth-callback.html#error=no_code`, {
            'Set-Cookie': clearStateCookie,
          });
        }

        // Exchange code for token
        const tokenRes = await fetch('https://discord.com/api/oauth2/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            client_id: DISCORD_CLIENT_ID,
            client_secret: DISCORD_CLIENT_SECRET,
            grant_type: 'authorization_code',
            code: code,
            redirect_uri: REDIRECT_URI,
          }),
        });

        if (!tokenRes.ok) {
          return redirectWithHeaders(`${SITE_URL}/auth-callback.html#error=token_failed`, {
            'Set-Cookie': clearStateCookie,
          });
        }

        const tokenData = await tokenRes.json();

        // Get user info from Discord
        const userRes = await fetch('https://discord.com/api/users/@me', {
          headers: { 'Authorization': `Bearer ${tokenData.access_token}` },
        });

        if (!userRes.ok) {
          return redirectWithHeaders(`${SITE_URL}/auth-callback.html#error=user_failed`, {
            'Set-Cookie': clearStateCookie,
          });
        }

        const discordUser = await userRes.json();

        const avatarUrl = discordUser.avatar
          ? `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png`
          : `https://cdn.discordapp.com/embed/avatars/${parseInt(discordUser.discriminator || '0') % 5}.png`;

        // Upsert user in D1
        const existing = await env.DB.prepare(
          'SELECT * FROM users WHERE discord_id = ?'
        ).bind(discordUser.id).first();

        let userId;
        let userRole;

        if (existing) {
          userId = existing.id;
          userRole = existing.role;
          await env.DB.prepare(
            `UPDATE users SET username = ?, avatar = ?, last_login = datetime('now') WHERE id = ?`
          ).bind(discordUser.username, avatarUrl, userId).run();
        } else {
          userId = `u-${Date.now()}`;
          userRole = 'member';
          await env.DB.prepare(
            `INSERT INTO users (id, discord_id, username, avatar, role) VALUES (?, ?, ?, ?, ?)`
          ).bind(userId, discordUser.id, discordUser.username, avatarUrl, userRole).run();
        }

        // Create JWT (7 day expiry)
        const jwt = await signJWT({
          sub: userId,
          discord_id: discordUser.id,
          username: discordUser.username,
          avatar: avatarUrl,
          role: userRole,
          exp: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60),
        }, JWT_SECRET);

        // Redirect back to site with token in fragment (not query string — avoids browser warnings)
        return redirectWithHeaders(`${SITE_URL}/auth-callback.html#token=${jwt}`, {
          'Set-Cookie': clearStateCookie,
        });
      }

      // ============================================
      // GET /api/me — get current user from JWT
      // ============================================
      if (request.method === 'GET' && path === '/api/me') {
        const user = await getUser(request);
        if (!user) {
          return new Response(JSON.stringify({ error: 'not authenticated' }), {
            status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders },
          });
        }
        return new Response(JSON.stringify(user), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      // ============================================
      // GET /api/users — admin only, list all users
      // ============================================
      if (request.method === 'GET' && path === '/api/users') {
        if (!requireAdmin(request)) {
          return new Response(JSON.stringify({ error: 'unauthorized' }), {
            status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders },
          });
        }
        const { results } = await env.DB.prepare('SELECT * FROM users ORDER BY created_at DESC').all();
        return new Response(JSON.stringify(results), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      // ============================================
      // PUT /api/users/:id/role — admin only, change role
      // ============================================
      if (request.method === 'PUT' && path.startsWith('/api/users/') && path.endsWith('/role')) {
        if (!requireAdmin(request)) {
          return new Response(JSON.stringify({ error: 'unauthorized' }), {
            status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders },
          });
        }
        const userId = path.split('/')[3];
        const body = await request.json();
        const allowedRoles = ['admin', 'moderator', 'member'];
        if (!allowedRoles.includes(body.role)) {
          return new Response(JSON.stringify({ error: 'invalid role' }), {
            status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders },
          });
        }
        await env.DB.prepare('UPDATE users SET role = ? WHERE id = ?').bind(body.role, userId).run();
        return new Response(JSON.stringify({ success: true }), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      // ============================================
      // REACTIONS
      // ============================================

      // GET /api/reactions/:entryId — get reaction counts + user's own reactions
      if (request.method === 'GET' && path.startsWith('/api/reactions/')) {
        const entryId = path.replace('/api/reactions/', '');
        const user = await getUser(request);

        // Get counts per emoji
        const { results: counts } = await env.DB.prepare(
          'SELECT emoji, COUNT(*) as count FROM reactions WHERE entry_id = ? GROUP BY emoji'
        ).bind(entryId).all();

        // Get user's own reactions if logged in
        let userReactions = [];
        if (user && user.sub) {
          const { results: mine } = await env.DB.prepare(
            'SELECT emoji FROM reactions WHERE entry_id = ? AND user_id = ?'
          ).bind(entryId, user.sub).all();
          userReactions = mine.map(r => r.emoji);
        }

        return new Response(JSON.stringify({
          counts: counts.reduce((acc, r) => { acc[r.emoji] = r.count; return acc; }, {}),
          userReactions,
        }), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      // GET /api/reactions-bulk?ids=id1,id2,id3 — get reactions for multiple entries at once
      if (request.method === 'GET' && path === '/api/reactions-bulk') {
        const ids = url.searchParams.get('ids');
        if (!ids) {
          return new Response(JSON.stringify({}), {
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          });
        }

        const idList = ids.split(',').slice(0, 50); // cap at 50
        const user = await getUser(request);
        const placeholders = idList.map(() => '?').join(',');

        const { results: allCounts } = await env.DB.prepare(
          `SELECT entry_id, emoji, COUNT(*) as count FROM reactions WHERE entry_id IN (${placeholders}) GROUP BY entry_id, emoji`
        ).bind(...idList).all();

        let userReactions = {};
        if (user && user.sub) {
          const { results: mine } = await env.DB.prepare(
            `SELECT entry_id, emoji FROM reactions WHERE entry_id IN (${placeholders}) AND user_id = ?`
          ).bind(...idList, user.sub).all();
          for (const r of mine) {
            if (!userReactions[r.entry_id]) userReactions[r.entry_id] = [];
            userReactions[r.entry_id].push(r.emoji);
          }
        }

        const result = {};
        for (const id of idList) {
          result[id] = {
            counts: {},
            userReactions: userReactions[id] || [],
          };
        }
        for (const r of allCounts) {
          if (!result[r.entry_id]) result[r.entry_id] = { counts: {}, userReactions: [] };
          result[r.entry_id].counts[r.emoji] = r.count;
        }

        return new Response(JSON.stringify(result), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      // POST /api/reactions/:entryId — toggle a reaction (requires login)
      if (request.method === 'POST' && path.startsWith('/api/reactions/')) {
        const user = await getUser(request);
        if (!user || !user.sub) {
          return new Response(JSON.stringify({ error: 'login required' }), {
            status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders },
          });
        }

        const entryId = path.replace('/api/reactions/', '');
        const body = await request.json();
        const emoji = body.emoji;
        const allowed = ['👍', '🎉', '❤️', '🔥', '😂'];

        if (!emoji || !allowed.includes(emoji)) {
          return new Response(JSON.stringify({ error: 'invalid emoji' }), {
            status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders },
          });
        }

        // Check if already exists
        const existing = await env.DB.prepare(
          'SELECT * FROM reactions WHERE entry_id = ? AND user_id = ? AND emoji = ?'
        ).bind(entryId, user.sub, emoji).first();

        if (existing) {
          // Remove it (toggle off)
          await env.DB.prepare(
            'DELETE FROM reactions WHERE entry_id = ? AND user_id = ? AND emoji = ?'
          ).bind(entryId, user.sub, emoji).run();
        } else {
          // Add it (toggle on)
          await env.DB.prepare(
            'INSERT INTO reactions (entry_id, user_id, emoji) VALUES (?, ?, ?)'
          ).bind(entryId, user.sub, emoji).run();
        }

        return new Response(JSON.stringify({ success: true, action: existing ? 'removed' : 'added' }), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      // ============================================
      // GALLERY — multi-image posts
      // ============================================

      // GET /api/gallery — public, list posts with images and user info
      if (request.method === 'GET' && path === '/api/gallery') {
        const limit = Math.min(50, Math.max(1, parseInt(url.searchParams.get('limit') || '30') || 30));
        const offset = Math.max(0, parseInt(url.searchParams.get('offset') || '0') || 0);
        const tag = url.searchParams.get('tag') || '';

        let query = `SELECT g.*, u.username, u.avatar FROM gallery g
           LEFT JOIN users u ON g.user_id = u.id`;
        let countQuery = 'SELECT COUNT(*) as total FROM gallery';
        const binds = [];
        const countBinds = [];

        if (tag) {
          query += ` WHERE g.tags LIKE ?`;
          countQuery += ` WHERE tags LIKE ?`;
          binds.push(`%"${tag}"%`);
          countBinds.push(`%"${tag}"%`);
        }

        query += ` ORDER BY g.created_at DESC LIMIT ? OFFSET ?`;
        binds.push(limit, offset);

        const { results: posts } = await env.DB.prepare(query).bind(...binds).all();
        const { results: countResult } = await env.DB.prepare(countQuery).bind(...countBinds).all();
        const total = countResult[0]?.total || 0;

        // Fetch images for all posts
        if (posts.length > 0) {
          const postIds = posts.map(p => p.id);
          const placeholders = postIds.map(() => '?').join(',');
          const { results: allImages } = await env.DB.prepare(
            `SELECT * FROM gallery_images WHERE post_id IN (${placeholders}) ORDER BY sort_order`
          ).bind(...postIds).all();

          // Fetch comment counts
          const { results: commentCounts } = await env.DB.prepare(
            `SELECT post_id, COUNT(*) as count FROM gallery_comments WHERE post_id IN (${placeholders}) GROUP BY post_id`
          ).bind(...postIds).all();

          for (const post of posts) {
            post.images = allImages.filter(img => img.post_id === post.id);
            const cc = commentCounts.find(c => c.post_id === post.id);
            post.comment_count = cc ? cc.count : 0;
          }
        }

        return new Response(JSON.stringify({ posts, total }), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      // POST /api/gallery — create a post (upload images separately first)
      if (request.method === 'POST' && path === '/api/gallery') {
        const user = await getUser(request);
        if (!user || !user.sub) {
          return new Response(JSON.stringify({ error: 'login required' }), {
            status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders },
          });
        }

        const body = await request.json();
        const hasImages = body.images && body.images.length > 0;
        const hasExternal = body.external_url && body.external_url.trim();

        if (!hasImages && !hasExternal) {
          return new Response(JSON.stringify({ error: 'add an image or external link' }), {
            status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders },
          });
        }
        if (hasExternal && !isHttpUrl(body.external_url.trim())) {
          return new Response(JSON.stringify({ error: 'external link must be http or https' }), {
            status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders },
          });
        }

        const postId = `gal-${Date.now()}`;
        const tags = JSON.stringify(body.tags || []);

        await env.DB.prepare(
          'INSERT INTO gallery (id, user_id, title, caption, tags, external_url) VALUES (?, ?, ?, ?, ?, ?)'
        ).bind(postId, user.sub, body.title || null, body.caption || null, tags, hasExternal ? body.external_url.trim() : null).run();

        // Insert images
        if (hasImages) {
          for (let i = 0; i < body.images.length; i++) {
            const imgId = `gimg-${Date.now()}-${i}`;
            await env.DB.prepare(
              'INSERT INTO gallery_images (id, post_id, image_url, sort_order) VALUES (?, ?, ?, ?)'
            ).bind(imgId, postId, body.images[i], i).run();
          }
        }

        return new Response(JSON.stringify({ success: true, id: postId }), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      // POST /api/gallery/upload — upload a single image file to R2 (returns URL)
      if (request.method === 'POST' && path === '/api/gallery/upload') {
        const user = await getUser(request);
        if (!user || !user.sub) {
          return new Response(JSON.stringify({ error: 'login required' }), {
            status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders },
          });
        }

        const formData = await request.formData();
        const file = formData.get('file');
        if (!file) {
          return new Response(JSON.stringify({ error: 'no file provided' }), {
            status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders },
          });
        }

        const allowed = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];
        if (!allowed.includes(file.type)) {
          return new Response(JSON.stringify({ error: 'only images allowed' }), {
            status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders },
          });
        }

        if (file.size > 20 * 1024 * 1024) {
          return new Response(JSON.stringify({ error: 'image too large (20MB max)' }), {
            status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders },
          });
        }

        const ext = uploadExt(file.type, 'png');
        const key = `gallery-${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${ext}`;
        const R2_PUBLIC = 'https://pub-36f7c4945e55454d8abcd89643e95937.r2.dev';

        await env.MEDIA.put(key, file.stream(), { httpMetadata: { contentType: file.type } });

        return new Response(JSON.stringify({ success: true, url: `${R2_PUBLIC}/${key}` }), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      // DELETE /api/gallery/:id — owner or admin
      if (request.method === 'DELETE' && path.startsWith('/api/gallery/')) {
        const user = await getUser(request);
        if (!user || !user.sub) {
          return new Response(JSON.stringify({ error: 'login required' }), {
            status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders },
          });
        }

        const postId = path.replace('/api/gallery/', '');
        const post = await env.DB.prepare('SELECT * FROM gallery WHERE id = ?').bind(postId).first();
        if (!post) {
          return new Response(JSON.stringify({ error: 'not found' }), {
            status: 404, headers: { 'Content-Type': 'application/json', ...corsHeaders },
          });
        }

        const isOwner = post.user_id === user.sub;
        const isAdmin = user.role === 'admin' || requireAdmin(request);
        if (!isOwner && !isAdmin) {
          return new Response(JSON.stringify({ error: 'not allowed' }), {
            status: 403, headers: { 'Content-Type': 'application/json', ...corsHeaders },
          });
        }

        // Delete images from R2
        const { results: images } = await env.DB.prepare(
          'SELECT * FROM gallery_images WHERE post_id = ?'
        ).bind(postId).all();
        for (const img of images) {
          const r2Key = img.image_url.split('/').pop();
          try { await env.MEDIA.delete(r2Key); } catch (e) {}
        }

        await env.DB.prepare('DELETE FROM gallery_images WHERE post_id = ?').bind(postId).run();
        await env.DB.prepare('DELETE FROM gallery_comments WHERE post_id = ?').bind(postId).run();
        await env.DB.prepare('DELETE FROM gallery WHERE id = ?').bind(postId).run();

        return new Response(JSON.stringify({ success: true }), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      // ============================================
      // GALLERY COMMENTS
      // ============================================

      // GET /api/gallery/:id/comments
      if (request.method === 'GET' && path.match(/^\/api\/gallery\/[^/]+\/comments$/)) {
        const postId = path.split('/')[3];
        const { results } = await env.DB.prepare(
          `SELECT c.*, u.username, u.avatar FROM gallery_comments c
           LEFT JOIN users u ON c.user_id = u.id
           WHERE c.post_id = ? ORDER BY c.created_at ASC`
        ).bind(postId).all();

        return new Response(JSON.stringify({ comments: results }), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      // POST /api/gallery/:id/comments — add comment (login required)
      if (request.method === 'POST' && path.match(/^\/api\/gallery\/[^/]+\/comments$/)) {
        const user = await getUser(request);
        if (!user || !user.sub) {
          return new Response(JSON.stringify({ error: 'login required' }), {
            status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders },
          });
        }

        const postId = path.split('/')[3];
        const body = await request.json();
        const text = (body.body || '').trim();

        if (!text || text.length > 500) {
          return new Response(JSON.stringify({ error: 'comment must be 1-500 characters' }), {
            status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders },
          });
        }

        const id = `gc-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
        await env.DB.prepare(
          'INSERT INTO gallery_comments (id, post_id, user_id, body) VALUES (?, ?, ?, ?)'
        ).bind(id, postId, user.sub, text).run();

        return new Response(JSON.stringify({ success: true, id }), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      // DELETE /api/gallery/comments/:id — owner or admin
      if (request.method === 'DELETE' && path.startsWith('/api/gallery/comments/')) {
        const user = await getUser(request);
        if (!user || !user.sub) {
          return new Response(JSON.stringify({ error: 'login required' }), {
            status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders },
          });
        }

        const commentId = path.replace('/api/gallery/comments/', '');
        const comment = await env.DB.prepare('SELECT * FROM gallery_comments WHERE id = ?').bind(commentId).first();
        if (!comment) {
          return new Response(JSON.stringify({ error: 'not found' }), {
            status: 404, headers: { 'Content-Type': 'application/json', ...corsHeaders },
          });
        }

        const isOwner = comment.user_id === user.sub;
        const isAdmin = user.role === 'admin' || requireAdmin(request);
        if (!isOwner && !isAdmin) {
          return new Response(JSON.stringify({ error: 'not allowed' }), {
            status: 403, headers: { 'Content-Type': 'application/json', ...corsHeaders },
          });
        }

        await env.DB.prepare('DELETE FROM gallery_comments WHERE id = ?').bind(commentId).run();
        return new Response(JSON.stringify({ success: true }), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      // ============================================
      // WIKI
      // ============================================

      // GET /api/wiki — list all pages (staff only)
      if (request.method === 'GET' && path === '/api/wiki') {
        const user = await getUser(request);
        if (!user || (user.role !== 'admin' && user.role !== 'moderator')) {
          return new Response(JSON.stringify({ error: 'staff only' }), {
            status: 403, headers: { 'Content-Type': 'application/json', ...corsHeaders },
          });
        }

        const { results } = await env.DB.prepare(
          'SELECT id, slug, title, category, updated_by, updated_at, sort_order FROM wiki_pages ORDER BY category, sort_order, title'
        ).all();

        return new Response(JSON.stringify({ pages: results }), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      // GET /api/wiki/:slug — get single page (staff only)
      if (request.method === 'GET' && path.match(/^\/api\/wiki\/[^/]+$/)) {
        const user = await getUser(request);
        if (!user || (user.role !== 'admin' && user.role !== 'moderator')) {
          return new Response(JSON.stringify({ error: 'staff only' }), {
            status: 403, headers: { 'Content-Type': 'application/json', ...corsHeaders },
          });
        }

        const slug = path.replace('/api/wiki/', '');
        const page = await env.DB.prepare('SELECT * FROM wiki_pages WHERE slug = ?').bind(slug).first();
        if (!page) {
          return new Response(JSON.stringify({ error: 'not found' }), {
            status: 404, headers: { 'Content-Type': 'application/json', ...corsHeaders },
          });
        }

        return new Response(JSON.stringify({ page }), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      // POST /api/wiki — create page (admin only)
      if (request.method === 'POST' && path === '/api/wiki') {
        const user = await getUser(request);
        if (!user || user.role !== 'admin') {
          return new Response(JSON.stringify({ error: 'admin only' }), {
            status: 403, headers: { 'Content-Type': 'application/json', ...corsHeaders },
          });
        }

        const body = await request.json();
        if (!body.title || !body.category || !body.content) {
          return new Response(JSON.stringify({ error: 'title, category, and content required' }), {
            status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders },
          });
        }

        const slug = (body.slug || body.title).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
        const id = `wiki-${Date.now()}`;

        await env.DB.prepare(
          'INSERT INTO wiki_pages (id, slug, title, category, content, updated_by, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)'
        ).bind(id, slug, body.title, body.category, body.content, user.username || 'admin', body.sort_order || 0).run();

        return new Response(JSON.stringify({ success: true, slug }), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      // PUT /api/wiki/:slug — update page (admin only)
      if (request.method === 'PUT' && path.match(/^\/api\/wiki\/[^/]+$/)) {
        const user = await getUser(request);
        if (!user || user.role !== 'admin') {
          return new Response(JSON.stringify({ error: 'admin only' }), {
            status: 403, headers: { 'Content-Type': 'application/json', ...corsHeaders },
          });
        }

        const slug = path.replace('/api/wiki/', '');
        const body = await request.json();

        const fields = [];
        const values = [];
        if (body.title) { fields.push('title = ?'); values.push(body.title); }
        if (body.category) { fields.push('category = ?'); values.push(body.category); }
        if (body.content !== undefined) { fields.push('content = ?'); values.push(body.content); }
        if (body.sort_order !== undefined) { fields.push('sort_order = ?'); values.push(body.sort_order); }
        fields.push("updated_by = ?"); values.push(user.username || 'admin');
        fields.push("updated_at = datetime('now')");
        values.push(slug);

        await env.DB.prepare(`UPDATE wiki_pages SET ${fields.join(', ')} WHERE slug = ?`).bind(...values).run();

        return new Response(JSON.stringify({ success: true }), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      // DELETE /api/wiki/:slug — delete page (admin only)
      if (request.method === 'DELETE' && path.match(/^\/api\/wiki\/[^/]+$/)) {
        const user = await getUser(request);
        if (!user || user.role !== 'admin') {
          return new Response(JSON.stringify({ error: 'admin only' }), {
            status: 403, headers: { 'Content-Type': 'application/json', ...corsHeaders },
          });
        }

        const slug = path.replace('/api/wiki/', '');
        await env.DB.prepare('DELETE FROM wiki_pages WHERE slug = ?').bind(slug).run();

        return new Response(JSON.stringify({ success: true }), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      // ============================================
      // MEDIA UPLOAD — POST /api/upload
      // ============================================
      if (request.method === 'POST' && path === '/api/upload') {
        if (!requireAdmin(request)) {
          return new Response(JSON.stringify({ error: 'unauthorized' }), {
            status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders },
          });
        }

        const formData = await request.formData();
        const file = formData.get('file');
        if (!file) {
          return new Response(JSON.stringify({ error: 'no file provided' }), {
            status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders },
          });
        }

        const allowed = ['video/mp4', 'video/webm', 'image/gif', 'image/png', 'image/jpeg', 'image/webp'];
        if (!allowed.includes(file.type)) {
          return new Response(JSON.stringify({ error: 'file type not allowed' }), {
            status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders },
          });
        }

        if (file.size > 200 * 1024 * 1024) {
          return new Response(JSON.stringify({ error: 'file too large (200MB max)' }), {
            status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders },
          });
        }

        const ext = uploadExt(file.type, 'mp4');
        const key = `bg-${Date.now()}.${ext}`;
        await env.MEDIA.put(key, file.stream(), { httpMetadata: { contentType: file.type } });

        return new Response(JSON.stringify({ success: true, url: `${R2_PUBLIC}/${key}`, key }), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      // GET /api/uploads
      if (request.method === 'GET' && path === '/api/uploads') {
        if (!requireAdmin(request)) {
          return new Response(JSON.stringify({ error: 'unauthorized' }), {
            status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders },
          });
        }
        const list = await env.MEDIA.list({ prefix: 'bg-' });
        const files = list.objects.map(obj => ({
          key: obj.key, url: `${R2_PUBLIC}/${obj.key}`, size: obj.size, uploaded: obj.uploaded,
        }));
        return new Response(JSON.stringify(files), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      // DELETE /api/upload/:key
      if (request.method === 'DELETE' && path.startsWith('/api/upload/')) {
        if (!requireAdmin(request)) {
          return new Response(JSON.stringify({ error: 'unauthorized' }), {
            status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders },
          });
        }
        const key = path.replace('/api/upload/', '');
        await env.MEDIA.delete(key);
        return new Response(JSON.stringify({ success: true, deleted: key }), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      // POST /api/discord/post-patchnote — admin only
      if (request.method === 'POST' && path === '/api/discord/post-patchnote') {
        if (!requireAdmin(request)) {
          return new Response(JSON.stringify({ error: 'unauthorized' }), {
            status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders },
          });
        }
        let body;
        try {
          body = await request.json();
        } catch (e) {
          return new Response(JSON.stringify({ error: 'invalid JSON' }), {
            status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders },
          });
        }
        const entryId = body && body.entryId ? String(body.entryId) : '';
        if (!entryId) {
          return new Response(JSON.stringify({ error: 'entryId required' }), {
            status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders },
          });
        }

        const whRow = await env.DB.prepare('SELECT value FROM settings WHERE key = ?').bind('discordWebhookPatchNotes').first();
        const whCfg = normalizeDiscordWebhookCfg(whRow ? JSON.parse(whRow.value) : null);
        if (!whCfg.url || !isHttpUrl(whCfg.url)) {
          return new Response(JSON.stringify({ error: 'Webhook not configured' }), {
            status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders },
          });
        }

        const clRow = await env.DB.prepare('SELECT value FROM settings WHERE key = ?').bind('changelog').first();
        const changelogTagsRow = await env.DB.prepare('SELECT value FROM settings WHERE key = ?').bind('changelogTags').first();
        let entries = [];
        let changelogTags = [];
        try {
          entries = clRow ? JSON.parse(clRow.value) : [];
          changelogTags = changelogTagsRow ? JSON.parse(changelogTagsRow.value) : [];
        } catch (e) {
          return new Response(JSON.stringify({ error: 'invalid changelog data' }), {
            status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders },
          });
        }
        if (!Array.isArray(entries)) entries = [];
        const entry = entries.find((e) => e && String(e.id) === entryId);
        if (!entry) {
          return new Response(JSON.stringify({ error: 'entry not found' }), {
            status: 404, headers: { 'Content-Type': 'application/json', ...corsHeaders },
          });
        }
        if (entry.status === 'draft') {
          return new Response(JSON.stringify({ error: 'draft entries cannot be posted' }), {
            status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders },
          });
        }

        const embed = buildPatchNoteDiscordEmbed(entry, changelogTags, SITE_URL);
        const whRes = await fetch(whCfg.url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ embeds: [embed] }),
        });
        if (!whRes.ok) {
          let detail = '';
          try {
            detail = await whRes.text();
          } catch (e) {}
          return new Response(JSON.stringify({
            error: 'discord webhook failed',
            status: whRes.status,
            detail: truncateDiscord(detail, 500),
          }), {
            status: 502, headers: { 'Content-Type': 'application/json', ...corsHeaders },
          });
        }
        return new Response(JSON.stringify({ success: true }), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      // ============================================
      // GET /api/discord/widget — public proxy for Discord widget JSON (presence_count)
      // ============================================
      if (request.method === 'GET' && path === '/api/discord/widget') {
        let guildId = (url.searchParams.get('guild') || '').trim();
        if (!guildId && env.DISCORD_GUILD_ID) guildId = String(env.DISCORD_GUILD_ID).trim();
        if (!guildId) {
          const row = await env.DB.prepare('SELECT value FROM settings WHERE key = ?').bind('discordGuildId').first();
          if (row) {
            try {
              const v = JSON.parse(row.value);
              guildId = typeof v === 'string' ? v.trim() : String(v ?? '').trim();
            } catch (e) {
              guildId = String(row.value || '').replace(/^"|"$/g, '').trim();
            }
          }
        }
        if (!guildId) {
          return new Response(JSON.stringify({ error: 'guild not configured' }), {
            status: 404, headers: { 'Content-Type': 'application/json', ...corsHeaders },
          });
        }
        const wRes = await fetch(`https://discord.com/api/guilds/${guildId}/widget.json`);
        const bodyText = await wRes.text();
        const ct = wRes.headers.get('Content-Type') || 'application/json';
        return new Response(bodyText, {
          status: wRes.status,
          headers: { 'Content-Type': ct, ...corsHeaders },
        });
      }

      // ============================================
      // SETTINGS — GET /api/settings/:key (public)
      // ============================================
      if (request.method === 'GET' && path.startsWith('/api/settings/')) {
        const key = path.replace('/api/settings/', '');
        const result = await env.DB.prepare('SELECT value FROM settings WHERE key = ?').bind(key).first();
        if (!result) {
          return new Response(JSON.stringify({ error: 'not found' }), {
            status: 404, headers: { 'Content-Type': 'application/json', ...corsHeaders },
          });
        }
        return new Response(JSON.stringify({ key, value: JSON.parse(result.value) }), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      // GET /api/settings
      if (request.method === 'GET' && path === '/api/settings') {
        const { results } = await env.DB.prepare('SELECT key, value, updated_at FROM settings').all();
        const parsed = results.map(r => ({ key: r.key, value: JSON.parse(r.value), updated_at: r.updated_at }));
        return new Response(JSON.stringify(parsed), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      // PUT /api/settings/:key — admin only
      if (request.method === 'PUT' && path.startsWith('/api/settings/')) {
        if (!requireAdmin(request)) {
          return new Response(JSON.stringify({ error: 'unauthorized' }), {
            status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders },
          });
        }
        const key = path.replace('/api/settings/', '');
        const body = await request.json();
        await env.DB.prepare(
          `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now'))
           ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
        ).bind(key, JSON.stringify(body.value)).run();
        return new Response(JSON.stringify({ success: true, key }), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      return new Response(JSON.stringify({ error: 'not found' }), {
        status: 404, headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });

    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }
  },
};
