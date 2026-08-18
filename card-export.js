/*
 * Cozy Crafters player card -> PNG.
 *
 * The card is redrawn onto a canvas instead of being screenshotted. The site
 * has no build step, so this keeps the page free of a CDN-hosted DOM-to-image
 * dependency, and it lets the Minecraft render stay pixel-crisp at export
 * scale instead of being resampled.
 *
 * Geometry, fonts and colours are measured from a hidden clone of the live
 * card, so the PNG follows the real markup, the selected card theme and the
 * current day/night mode rather than a second hard-coded layout. Gradients
 * cannot be read back out of the DOM, so their stops are read from the same
 * --pc-* custom properties the stylesheet builds them from.
 */
(() => {
  'use strict';

  const SCALE = 3;
  const MARGIN = 24;

  const num = (value) => {
    const parsed = parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
  };

  /* Every colour the card uses lives in a --pc-* custom property (see the
     "Player card: themes" section of styles.css). Reading them off the clone
     means each theme is defined exactly once, in CSS. The fallbacks are the
     Grasslands day palette, in case a variable is ever missing. */
  const THEME_VARS = {
    frame: ['--pc-frame', '#3e8a2e'],
    frameDeep: ['--pc-frame-deep', '#2f6b22'],
    cardTop: ['--pc-card-top', 'rgba(255, 253, 248, 0.92)'],
    cardBot: ['--pc-card-bot', 'rgba(243, 250, 255, 0.86)'],
    cardBase: ['--pc-card-base', '#f2fafe'],
    cardGlow: ['--pc-card-glow', 'rgba(140, 206, 255, 0.4)'],
    ring: ['--pc-ring', 'rgba(255, 255, 255, 0.55)'],
    shadow: ['--pc-shadow', 'rgba(38, 84, 128, 0.28)'],
    backdrop: ['--pc-backdrop', '#a9dcfa'],
    renderTop: ['--pc-render-top', 'rgba(160, 214, 255, 0.42)'],
    renderBot: ['--pc-render-bot', 'rgba(226, 245, 255, 0.28)'],
    renderBase: ['--pc-render-base', '#e8f5ff'],
    renderGlow: ['--pc-render-glow', 'rgba(98, 189, 71, 0.35)'],
    turf: ['--pc-turf', '#5cb544'],
    turfLight: ['--pc-turf-light', '#6cc84f'],
    soil: ['--pc-soil', '#744c29'],
    soilDark: ['--pc-soil-dark', '#5c3a1e'],
    rankTop: ['--pc-rank-top', '#62bd47'],
    rankBot: ['--pc-rank-bot', '#3e8a2e']
  };

  const readTheme = (styles) => {
    const theme = {};
    Object.keys(THEME_VARS).forEach((key) => {
      const [name, fallback] = THEME_VARS[key];
      const value = styles.getPropertyValue(name).trim();
      theme[key] = value || fallback;
    });
    return theme;
  };

  /* Radial glows fade to a fully transparent copy of their own colour, so
     the falloff never dips through grey on engines that interpolate
     gradients without premultiplying. */
  const transparentOf = (color) => {
    const match = /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/.exec(color)
      || /^rgba?\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)/.exec(color);
    if (match) return `rgba(${match[1]}, ${match[2]}, ${match[3]}, 0)`;
    const hex = /^#([0-9a-f]{6})/i.exec(color);
    if (hex) {
      const n = parseInt(hex[1], 16);
      return `rgba(${n >> 16}, ${(n >> 8) & 255}, ${n & 255}, 0)`;
    }
    return 'rgba(0, 0, 0, 0)';
  };

  /* ----- canvas helpers ----- */

  const roundRectPath = (ctx, x, y, w, h, r) => {
    const radius = Math.max(0, Math.min(r, w / 2, h / 2));
    ctx.beginPath();
    if (typeof ctx.roundRect === 'function') {
      ctx.roundRect(x, y, w, h, radius);
      return;
    }
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + w, y, x + w, y + h, radius);
    ctx.arcTo(x + w, y + h, x, y + h, radius);
    ctx.arcTo(x, y + h, x, y, radius);
    ctx.arcTo(x, y, x + w, y, radius);
    ctx.closePath();
  };

  const linearFill = (ctx, x, y, w, h, from, to) => {
    const gradient = ctx.createLinearGradient(x, y, x, y + h);
    gradient.addColorStop(0, from);
    gradient.addColorStop(1, to);
    ctx.fillStyle = gradient;
    ctx.fillRect(x, y, w, h);
  };

  let trackingSupported = null;
  const canTrack = (ctx) => {
    if (trackingSupported === null) {
      try {
        ctx.letterSpacing = '2px';
        trackingSupported = ctx.letterSpacing === '2px';
        ctx.letterSpacing = '0px';
      } catch (error) {
        trackingSupported = false;
      }
    }
    return trackingSupported;
  };

  /* CSS letter-spacing has no canvas equivalent on older engines, so fall
     back to placing glyphs one at a time. */
  const fillTracked = (ctx, text, x, y, tracking) => {
    if (!tracking) {
      ctx.fillText(text, x, y);
      return;
    }
    if (canTrack(ctx)) {
      ctx.letterSpacing = `${tracking}px`;
      ctx.fillText(text, x, y);
      ctx.letterSpacing = '0px';
      return;
    }
    let cursor = x;
    for (const character of text) {
      ctx.fillText(character, cursor, y);
      cursor += ctx.measureText(character).width + tracking;
    }
  };

  /* ----- element painting ----- */

  const visible = (el) => Boolean(el && el.getClientRects().length);

  const readText = (el, styles) => {
    const raw = (el.textContent || '').replace(/\s+/g, ' ').trim();
    return styles.textTransform === 'uppercase' ? raw.toUpperCase() : raw;
  };

  const drawTextElement = (ctx, el, rectOf, options = {}) => {
    if (!visible(el)) return;
    const styles = getComputedStyle(el);
    const text = readText(el, styles);
    if (!text) return;

    const box = rectOf(el);
    ctx.font = `${styles.fontStyle} ${styles.fontWeight} ${styles.fontSize} ${styles.fontFamily}`;
    ctx.fillStyle = options.color || styles.color;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';

    const metrics = ctx.measureText(text);
    const ascent = metrics.actualBoundingBoxAscent || num(styles.fontSize) * 0.72;
    const descent = metrics.actualBoundingBoxDescent || 0;
    const baseline = box.y + box.h / 2 + (ascent - descent) / 2;
    const x = options.x === undefined ? box.x : options.x;

    fillTracked(ctx, text, x, baseline, num(styles.letterSpacing));
  };

  /* Pills carry their own padding, so the label is drawn inside the box
     rather than at the element origin. */
  const drawPill = (ctx, el, rectOf, fill) => {
    if (!visible(el)) return;
    const styles = getComputedStyle(el);
    const box = rectOf(el);
    const radius = num(styles.borderTopLeftRadius);
    const border = num(styles.borderTopWidth);

    roundRectPath(ctx, box.x, box.y, box.w, box.h, radius);
    if (typeof fill === 'function') {
      fill(ctx, box);
    } else {
      ctx.fillStyle = fill || styles.backgroundColor;
      ctx.fill();
    }
    if (border > 0) {
      roundRectPath(ctx, box.x + border / 2, box.y + border / 2, box.w - border, box.h - border, Math.max(0, radius - border / 2));
      ctx.lineWidth = border;
      ctx.strokeStyle = styles.borderTopColor;
      ctx.stroke();
    }

    drawTextElement(ctx, el, rectOf, { x: box.x + num(styles.paddingLeft) });
  };

  const drawBox = (ctx, el, rectOf) => {
    const styles = getComputedStyle(el);
    const box = rectOf(el);
    const radius = num(styles.borderTopLeftRadius);
    const border = num(styles.borderTopWidth);

    roundRectPath(ctx, box.x, box.y, box.w, box.h, radius);
    ctx.fillStyle = styles.backgroundColor;
    ctx.fill();
    if (border > 0) {
      roundRectPath(ctx, box.x + border / 2, box.y + border / 2, box.w - border, box.h - border, Math.max(0, radius - border / 2));
      ctx.lineWidth = border;
      ctx.strokeStyle = styles.borderTopColor;
      ctx.stroke();
    }
    return box;
  };

  /* ----- decorative pixel turf, matching the gradient tiles in styles.css ----- */

  const drawBannerTurf = (ctx, x, y, w, h, color) => {
    const tile = 40;
    const unit = h / 10;
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();
    ctx.fillStyle = color;
    for (let tx = x; tx < x + w; tx += tile) {
      ctx.fillRect(tx, y, tile, unit * 4);
      ctx.fillRect(tx, y + unit * 4, unit * 4, unit * 6);
      ctx.fillRect(tx + unit * 12, y + unit * 4, unit * 8, unit * 3);
      ctx.fillRect(tx + unit * 28, y + unit * 4, unit * 4, unit * 6);
      ctx.fillRect(tx + unit * 36, y + unit * 4, unit * 4, unit * 3);
    }
    ctx.restore();
  };

  const drawGroundTurf = (ctx, x, y, w, h, theme) => {
    const tile = 40;
    const unit = h / 14;
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();
    for (let tx = x; tx < x + w; tx += tile) {
      ctx.fillStyle = theme.turf;
      ctx.fillRect(tx, y, tile, unit * 6);
      ctx.fillStyle = theme.turfLight;
      ctx.fillRect(tx, y, unit * 8, unit * 3);
      ctx.fillRect(tx + unit * 16, y, unit * 12, unit * 3);
      ctx.fillStyle = theme.soil;
      ctx.fillRect(tx, y + unit * 6, tile, unit * 8);
      ctx.fillStyle = theme.soilDark;
      ctx.fillRect(tx + unit * 10, y + unit * 8, unit * 4, unit * 4);
      ctx.fillRect(tx + unit * 30, y + unit * 9, unit * 4, unit * 4);
    }
    ctx.restore();
  };

  const drawPlaceholder = (ctx, box, lineColor) => {
    const step = 8;
    ctx.save();
    roundRectPath(ctx, box.x, box.y, box.w, box.h, 6);
    ctx.clip();
    for (let ty = 0; ty < box.h; ty += step) {
      for (let tx = 0; tx < box.w; tx += step) {
        const even = ((tx / step) + (ty / step)) % 2 === 0;
        ctx.fillStyle = even ? 'rgba(120, 150, 190, 0.22)' : 'rgba(255, 255, 255, 0.12)';
        ctx.fillRect(box.x + tx, box.y + ty, step, step);
      }
    }
    ctx.restore();
    roundRectPath(ctx, box.x + 1, box.y + 1, box.w - 2, box.h - 2, 5);
    ctx.lineWidth = 2;
    ctx.strokeStyle = lineColor;
    ctx.stroke();
  };

  /* The site cross-fades its theme custom properties over 1.6s. Exporting
     inside that window would bake half-transitioned colours into the PNG, so
     let any running root transition finish first. */
  const settleTheme = async () => {
    const root = document.documentElement;
    if (typeof root.getAnimations !== 'function') return;
    const running = root.getAnimations().filter((animation) => animation.playState === 'running');
    if (!running.length) return;
    await Promise.race([
      Promise.all(running.map((animation) => animation.finished.catch(() => {}))),
      new Promise((resolve) => setTimeout(resolve, 2500))
    ]);
  };

  /* ----- the export stage ----- */

  /* The live card reflows on narrow viewports and its type is clamped to vw
     units, so exporting straight from it would produce a different image on a
     phone than on a desktop. Rendering a clone on a fixed-width stage keeps
     one consistent landscape share image everywhere. */
  const withStage = async (card, run) => {
    const stage = document.createElement('div');
    stage.className = 'pc-export-stage';
    stage.setAttribute('aria-hidden', 'true');

    const clone = card.cloneNode(true);
    clone.dataset.state = 'ready';
    clone.setAttribute('aria-busy', 'false');
    stage.appendChild(clone);
    document.body.appendChild(stage);

    try {
      await settleTheme();
      if (document.fonts && typeof document.fonts.ready === 'object') {
        await document.fonts.ready;
      }
      /* The cloned <img> starts its own fetch (normally answered from cache)
         and lays out at 0x0 until it arrives, which would leave the render
         out of the PNG. Wait for it briefly; a slow or failed load falls
         through and the placeholder logic in paint() takes over. */
      const cloneImage = clone.querySelector('.pc-render-image');
      if (cloneImage && !cloneImage.hidden && cloneImage.getAttribute('src') && !cloneImage.complete) {
        await new Promise((resolve) => {
          const done = () => {
            cloneImage.removeEventListener('load', done);
            cloneImage.removeEventListener('error', done);
            resolve();
          };
          cloneImage.addEventListener('load', done);
          cloneImage.addEventListener('error', done);
          setTimeout(done, 1500);
        });
      }
      /* Force a layout pass so every measurement below is settled. */
      void clone.getBoundingClientRect().height;
      return await run(clone);
    } finally {
      stage.remove();
    }
  };

  const paint = (canvas, clone, skinImage) => {
    const origin = clone.getBoundingClientRect();
    const width = origin.width;
    const height = origin.height;

    canvas.width = Math.round((width + MARGIN * 2) * SCALE);
    canvas.height = Math.round((height + MARGIN * 2) * SCALE);

    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('canvas unavailable');
    ctx.scale(SCALE, SCALE);
    ctx.translate(MARGIN, MARGIN);

    const rectOf = (el) => {
      const box = el.getBoundingClientRect();
      return { x: box.left - origin.left, y: box.top - origin.top, w: box.width, h: box.height };
    };
    const pick = (selector) => clone.querySelector(selector);

    const cardStyles = getComputedStyle(clone);
    const theme = readTheme(cardStyles);
    const radius = num(cardStyles.borderTopLeftRadius);
    const border = num(cardStyles.borderTopWidth);
    const frameDeep = theme.frameDeep;
    const frameLight = theme.frame;

    /* Backdrop behind the card, so the rounded corners are not transparent
       notches when the PNG lands on a light or dark background. */
    ctx.fillStyle = theme.backdrop;
    ctx.fillRect(-MARGIN, -MARGIN, width + MARGIN * 2, height + MARGIN * 2);

    ctx.save();
    ctx.shadowColor = theme.shadow;
    ctx.shadowBlur = 26;
    ctx.shadowOffsetY = 10;
    roundRectPath(ctx, 0, 0, width, height, radius);
    ctx.fillStyle = theme.cardBase;
    ctx.fill();
    ctx.restore();

    ctx.save();
    roundRectPath(ctx, 0, 0, width, height, radius);
    ctx.clip();

    /* Card body background: opaque base, translucent card gradient, glow. */
    ctx.fillStyle = theme.cardBase;
    ctx.fillRect(0, 0, width, height);
    linearFill(ctx, 0, 0, width, height, theme.cardTop, theme.cardBot);
    const glow = ctx.createRadialGradient(width * 0.18, 0, 0, width * 0.18, 0, width * 0.7);
    glow.addColorStop(0, theme.cardGlow);
    glow.addColorStop(1, transparentOf(theme.cardGlow));
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, width, height);

    /* Banner */
    const banner = pick('.pc-card-banner');
    if (banner) {
      const box = rectOf(banner);
      linearFill(ctx, box.x, box.y, box.w, box.h, frameLight, frameDeep);
      const turf = num(getComputedStyle(banner, '::after').height) || 10;
      drawBannerTurf(ctx, box.x, box.y + box.h - turf, box.w, turf, frameDeep);
    }
    drawTextElement(ctx, pick('.pc-card-brand'), rectOf);
    drawPill(ctx, pick('.pc-card-badge'), rectOf);

    /* Player render */
    const frame = pick('.pc-render-frame');
    if (frame) {
      const styles = getComputedStyle(frame);
      const box = rectOf(frame);
      const frameRadius = num(styles.borderTopLeftRadius);
      const frameBorder = num(styles.borderTopWidth);

      ctx.save();
      roundRectPath(ctx, box.x, box.y, box.w, box.h, frameRadius);
      ctx.clip();
      ctx.fillStyle = theme.renderBase;
      ctx.fillRect(box.x, box.y, box.w, box.h);
      linearFill(ctx, box.x, box.y, box.w, box.h, theme.renderTop, theme.renderBot);
      const ground = ctx.createRadialGradient(box.x + box.w / 2, box.y + box.h, 0, box.x + box.w / 2, box.y + box.h, box.w * 0.8);
      ground.addColorStop(0, theme.renderGlow);
      ground.addColorStop(1, transparentOf(theme.renderGlow));
      ctx.fillStyle = ground;
      ctx.fillRect(box.x, box.y, box.w, box.h);

      const image = pick('.pc-render-image');
      const fallback = pick('.pc-render-fallback');
      const usable = skinImage && skinImage.complete && skinImage.naturalWidth > 0 && visible(image);

      if (usable) {
        const target = rectOf(image);
        ctx.save();
        /* Minecraft renders are nearest-neighbour art; resampling them would
           soften exactly the detail the export is meant to keep. */
        ctx.imageSmoothingEnabled = false;
        ctx.shadowColor = 'rgba(21, 46, 78, 0.35)';
        ctx.shadowBlur = 12;
        ctx.shadowOffsetY = 10;
        ctx.drawImage(skinImage, target.x, target.y, target.w, target.h);
        ctx.restore();
      } else if (visible(fallback)) {
        drawPlaceholder(ctx, rectOf(fallback), styles.borderTopColor);
      } else if (visible(image)) {
        /* On screen but unusable here (a host that refused CORS). Stand the
           placeholder in its slot so the card still exports. */
        const target = rectOf(image);
        const size = Math.min(96, target.w, target.h);
        drawPlaceholder(ctx, {
          x: target.x + (target.w - size) / 2,
          y: target.y + (target.h - size) / 2,
          w: size,
          h: size
        }, styles.borderTopColor);
      }

      const turf = num(getComputedStyle(frame, '::after').height) || 14;
      drawGroundTurf(ctx, box.x, box.y + box.h - turf, box.w, turf, theme);
      ctx.restore();

      if (frameBorder > 0) {
        roundRectPath(ctx, box.x + frameBorder / 2, box.y + frameBorder / 2, box.w - frameBorder, box.h - frameBorder, Math.max(0, frameRadius - frameBorder / 2));
        ctx.lineWidth = frameBorder;
        ctx.strokeStyle = styles.borderTopColor;
        ctx.stroke();
      }
    }

    /* Identity */
    drawTextElement(ctx, pick('.pc-username'), rectOf);
    drawTextElement(ctx, pick('.pc-nickname'), rectOf);

    const rank = pick('.pc-rank');
    if (rank) {
      const ranked = rank.dataset.ranked !== 'false';
      drawPill(ctx, rank, rectOf, ranked
        ? (context, box) => {
            const gradient = context.createLinearGradient(box.x, box.y, box.x, box.y + box.h);
            gradient.addColorStop(0, theme.rankTop);
            gradient.addColorStop(1, theme.rankBot);
            context.fillStyle = gradient;
            context.fill();
          }
        : undefined);
    }

    /* Stats */
    clone.querySelectorAll('.pc-stat').forEach((stat) => {
      drawBox(ctx, stat, rectOf);
      drawTextElement(ctx, stat.querySelector('dt'), rectOf);
      drawTextElement(ctx, stat.querySelector('dd'), rectOf);
    });

    /* Footer */
    const footer = pick('.pc-card-footer');
    if (footer) {
      const styles = getComputedStyle(footer);
      const box = rectOf(footer);
      ctx.fillStyle = styles.backgroundColor;
      ctx.fillRect(box.x, box.y, box.w, box.h);
      const line = num(styles.borderTopWidth);
      if (line > 0) {
        ctx.fillStyle = styles.borderTopColor;
        ctx.fillRect(box.x, box.y, box.w, line);
      }
    }
    drawTextElement(ctx, pick('.pc-card-ip'), rectOf);
    drawTextElement(ctx, pick('.pc-card-edition'), rectOf);

    ctx.restore();

    /* Frame: outer border plus the inset highlight ring. */
    if (border > 0) {
      roundRectPath(ctx, border / 2, border / 2, width - border, height - border, Math.max(0, radius - border / 2));
      ctx.lineWidth = border;
      ctx.strokeStyle = frameDeep;
      ctx.stroke();
    }
    roundRectPath(ctx, border + 1.5, border + 1.5, width - border * 2 - 3, height - border * 2 - 3, Math.max(0, radius - border - 1.5));
    ctx.lineWidth = 3;
    ctx.strokeStyle = theme.ring;
    ctx.stroke();
  };

  const toBlob = (canvas) =>
    new Promise((resolve, reject) => {
      /* toBlob throws a SecurityError instead of resolving when the canvas has
         been tainted by a render the skin host would not share. */
      try {
        canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('empty blob'))), 'image/png');
      } catch (error) {
        reject(error);
      }
    });

  window.cozyCardExport = {
    /* Resolves with a PNG Blob of the supplied .pc-card element. */
    render(card, options = {}) {
      if (!card) return Promise.reject(new Error('no card'));
      return withStage(card, async (clone) => {
        const canvas = document.createElement('canvas');
        paint(canvas, clone, options.image || null);
        return toBlob(canvas);
      });
    }
  };
})();
