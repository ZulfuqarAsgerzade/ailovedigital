// Cover composer — draws each project's hero image on a canvas: a dark, brand-tinted background with a
// fine wave-mesh, the project name and tagline, and the project's real screens inside laptop / tablet /
// phone frames. Only devices the project actually has screens for are drawn (see "mockup" in
// data/projects.json). Output: cover.webp (1600×1000), the 800×500 home card and og.jpg (1200×630).
//
// Usage: node scripts/… is not needed — serve the repo, open /tools/covers/ and press "Render".
// "Save to disk" posts the files to tools/covers/save-server.py (python3 tools/covers/save-server.py).

const H = 1000; // virtual height; the virtual width is 1600 for the cover and 1905 for the 1.91:1 share image
const MOCK_FONT = '700 100px Geist';

// ───────────── helpers ─────────────
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const load = (src) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('cannot load ' + src)); i.src = src; });
function rng(seed) { // mulberry32
  let a = [...seed].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 2654435761) >>> 0, 1779033703);
  return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const hsl = (h, s, l, a = 1) => `hsla(${((h % 360) + 360) % 360},${s}%,${l}%,${a})`;
const path = (ctx, x, y, w, h, r) => { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); };

// ───────────── sources: crop the baked-in black frame off a screenshot ─────────────
async function source(slug, n, bare = false) {
  const img = await load(`../../assets/images/work/${slug}/${String(n).padStart(2, '0')}.webp`);
  const W = img.naturalWidth, Hh = img.naturalHeight;
  const c = document.createElement('canvas'); c.width = W; c.height = Hh;
  const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(img, 0, 0);
  const d = x.getImageData(0, 0, W, Hh).data;
  const lum = (px, py) => { const k = (py * W + px) * 4; return (d[k] + d[k + 1] + d[k + 2]) / 3; };
  // the frame is a uniform black margin; its inner edge is the first strong luminance jump from the border
  const edge = (get, from, to, step) => { let prev = get(from); for (let i = from + step; i !== to; i += step) { const v = get(i); if (Math.abs(v - prev) > 22) return i; prev = v; } return from; };
  const med = (a) => a.sort((p, q) => p - q)[a.length >> 1];
  const rows = [.3, .4, .5, .6, .7].map((f) => Math.round(Hh * f));
  const L = med(rows.map((y) => edge((i) => lum(i, y), 0, W >> 1, 1)));
  const R = med(rows.map((y) => W - 1 - edge((i) => lum(i, y), W - 1, W >> 1, -1)));
  const inset = bare ? 0 : Math.min(L, R) + 3;
  return { img, sx: inset, sy: inset, sw: W - 2 * inset, sh: Hh - 2 * inset, slug, n };
}

/** Dominant saturated hue of a source — drives the brand tint of the whole cover. */
function dominantHue(sources) {
  const bins = new Float32Array(36);
  for (const s of sources) {
    const c = document.createElement('canvas'); c.width = 48; c.height = 48;
    const x = c.getContext('2d', { willReadFrequently: true });
    x.drawImage(s.img, s.sx, s.sy, s.sw, s.sh, 0, 0, 48, 48);
    const d = x.getImageData(0, 0, 48, 48).data;
    for (let i = 0; i < d.length; i += 4) {
      const r = d[i] / 255, g = d[i + 1] / 255, b = d[i + 2] / 255;
      const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, dl = mx - mn;
      if (dl < 0.18 || l < 0.12 || l > 0.9) continue; // skip greys, near-black and near-white
      const sat = dl / (1 - Math.abs(2 * l - 1));
      let h = mx === r ? ((g - b) / dl) % 6 : mx === g ? (b - r) / dl + 2 : (r - g) / dl + 4;
      h = (h * 60 + 360) % 360;
      bins[Math.floor(h / 10) % 36] += sat * (1 - Math.abs(l - 0.5));
    }
  }
  let best = 0; for (let i = 1; i < 36; i++) if (bins[i] > bins[best]) best = i;
  return bins[best] > 0 ? best * 10 + 5 : 228;
}

// ───────────── background + wave mesh ─────────────
function background(ctx, W, pal) {
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, hsl(pal.h, 42, 15)); g.addColorStop(1, hsl(pal.h + 14, 46, 8));
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  const v = ctx.createRadialGradient(W * 0.62, H * 0.5, H * 0.2, W * 0.5, H * 0.5, W * 0.75);
  v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,.38)');
  ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
}

const meshes = {
  // twisted ribbon of fine lines — the Moleaks look
  ribbon(ctx, W, pal, rand) {
    const N = 64, S = 220, cx0 = W * (0.5 + rand() * 0.1), tilt = (rand() - 0.5) * 0.4;
    for (let i = 0; i < N; i++) {
      const u = i / (N - 1) * 2 - 1;
      ctx.beginPath();
      for (let k = 0; k <= S; k++) {
        const t = k / S;
        const px = cx0 + (W * 0.36) * Math.sin(t * 2.1 + tilt) * (0.4 + t) + t * W * 0.12;
        const py = -40 + t * H * 0.62 + Math.sin(t * 5 + 0.6) * 40;
        const nx = Math.cos(t * 2.1 + tilt), ny = 1; // rough normal
        const width = 190 * Math.pow(Math.sin(Math.PI * t), 0.75) * Math.cos(t * 7.5 + 1.1);
        const x = px + u * width * nx * 0.9, y = py + u * width * ny * 0.35;
        k ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
      ctx.strokeStyle = hsl(pal.h + 40 * (i / N), 70, 66, 0.15 + 0.14 * (1 - Math.abs(u)));
      ctx.lineWidth = 1; ctx.stroke();
    }
  },
  // concentric partial rings
  rings(ctx, W, pal, rand) {
    const cx = W * (0.78 + rand() * 0.15), cy = H * (0.0 + rand() * 0.2);
    for (let r = 90; r < 1300; r += 16) {
      let a = rand() * Math.PI * 2;
      for (let seg = 0; seg < 3; seg++) {
        const len = 0.5 + rand() * 1.8;
        ctx.beginPath(); ctx.arc(cx, cy, r, a, a + len);
        ctx.strokeStyle = hsl(pal.h + 30 * rand(), 70, 68, 0.10 + rand() * 0.16); ctx.lineWidth = 1; ctx.stroke();
        a += len + 0.3 + rand();
      }
    }
  },
  // parallel sine currents on a diagonal
  waves(ctx, W, pal, rand) {
    ctx.save(); ctx.translate(W * 0.5, H * 0.5); ctx.rotate((-0.22 + rand() * 0.1));
    const f = 0.004 + rand() * 0.003, A = 70 + rand() * 60;
    for (let i = -34; i <= 34; i++) {
      ctx.beginPath();
      for (let x = -W; x <= W; x += 12) {
        const y = i * 17 + Math.sin(x * f + i * 0.17) * A * Math.exp(-Math.pow(i / 26, 2));
        x === -W ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.strokeStyle = hsl(pal.h + 36 * ((i + 34) / 68), 72, 66, 0.10 + 0.12 * Math.exp(-Math.pow(i / 18, 2))); ctx.lineWidth = 1; ctx.stroke();
    }
    ctx.restore();
  },
  // fan of long rays from a bottom corner
  burst(ctx, W, pal, rand) {
    const ox = W * (rand() < 0.5 ? 0.04 : 0.96), oy = H * 1.04, dir = ox < W / 2 ? 1 : -1;
    for (let i = 0; i < 110; i++) {
      const a = -Math.PI / 2 + dir * (0.05 + (i / 110) * 1.15);
      const len = 700 + rand() * 900;
      ctx.beginPath(); ctx.moveTo(ox, oy);
      ctx.quadraticCurveTo(ox + Math.cos(a) * len * 0.5 + dir * 40, oy + Math.sin(a) * len * 0.5, ox + Math.cos(a) * len, oy + Math.sin(a) * len);
      ctx.strokeStyle = hsl(pal.h + 40 * (i / 110), 70, 66, 0.08 + rand() * 0.14); ctx.lineWidth = 1; ctx.stroke();
    }
  },
};
const MESH_ORDER = ['ribbon', 'rings', 'waves', 'burst'];

// ───────────── device frames ─────────────
const BODY = (ctx, x, y, w, h) => { const g = ctx.createLinearGradient(x, y, x + w, y + h); g.addColorStop(0, '#2b2e38'); g.addColorStop(0.5, '#101218'); g.addColorStop(1, '#1d2028'); return g; };
function cropTo(s, aspect) { // cover-crop a source to `aspect`, anchored to the top
  let { sx, sy, sw, sh } = s;
  if (sw / sh > aspect) { const nw = sh * aspect; sx += (sw - nw) / 2; sw = nw; } else { sh = sw / aspect; }
  return { sx, sy, sw, sh };
}
function screen(ctx, s, aspect, x, y, w, h, r) {
  const c = cropTo(s, aspect);
  ctx.save(); path(ctx, x, y, w, h, r); ctx.clip(); ctx.drawImage(s.img, c.sx, c.sy, c.sw, c.sh, x, y, w, h); ctx.restore();
}
function shell(ctx, x, y, w, h, r) {
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,.55)'; ctx.shadowBlur = 70; ctx.shadowOffsetY = 34;
  path(ctx, x, y, w, h, r); ctx.fillStyle = BODY(ctx, x, y, w, h); ctx.fill();
  ctx.restore();
  path(ctx, x + 0.5, y + 0.5, w - 1, h - 1, r); ctx.strokeStyle = 'rgba(255,255,255,.2)'; ctx.lineWidth = 1.5; ctx.stroke();
}

function phone(ctx, s, x, y, w) {
  const aspect = clamp(s.sw / s.sh, 0.42, 0.6), b = w * 0.03, sw = w - 2 * b, sh = sw / aspect, h = sh + 2 * b, r = w * 0.155;
  shell(ctx, x, y, w, h, r);
  screen(ctx, s, aspect, x + b, y + b, sw, sh, r - b);
  path(ctx, x + w / 2 - w * 0.14, y + b + w * 0.028, w * 0.28, w * 0.05, w * 0.025); ctx.fillStyle = '#05060a'; ctx.fill(); // island
  ctx.fillStyle = '#0c0d11'; ctx.fillRect(x - 3, y + h * 0.2, 3, h * 0.07); ctx.fillRect(x + w, y + h * 0.26, 3, h * 0.12); // side keys
  return { w, h };
}
function tablet(ctx, s, x, y, w) {
  const portrait = s.sw < s.sh, aspect = portrait ? clamp(s.sw / s.sh, 0.66, 0.8) : clamp(s.sw / s.sh, 1.3, 1.62);
  const b = w * (portrait ? 0.045 : 0.03), sw = w - 2 * b, sh = sw / aspect, h = sh + 2 * b, r = w * (portrait ? 0.075 : 0.045);
  shell(ctx, x, y, w, h, r);
  screen(ctx, s, aspect, x + b, y + b, sw, sh, r * 0.55);
  ctx.beginPath(); (portrait ? ctx.arc(x + w / 2, y + b / 2, b * 0.16, 0, 7) : ctx.arc(x + b / 2, y + h / 2, b * 0.16, 0, 7)); ctx.fillStyle = '#05060a'; ctx.fill();
  return { w, h };
}
function laptop(ctx, s, x, y, w) {
  const aspect = clamp(s.sw / s.sh, 1.55, 2.15), b = w * 0.012, bb = w * 0.022, sw = w - 2 * b, sh = sw / aspect, h = sh + b + bb, r = w * 0.018;
  shell(ctx, x, y, w, h, r);
  screen(ctx, s, aspect, x + b, y + b, sw, sh, r * 0.5);
  ctx.beginPath(); ctx.arc(x + w / 2, y + b / 2, b * 0.18, 0, 7); ctx.fillStyle = '#05060a'; ctx.fill();
  // aluminium base
  const bx = x - w * 0.055, bw = w * 1.11, bh = w * 0.026, by = y + h - 1;
  const g = ctx.createLinearGradient(0, by, 0, by + bh); g.addColorStop(0, '#e1e4ea'); g.addColorStop(1, '#8e939e');
  ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.5)'; ctx.shadowBlur = 40; ctx.shadowOffsetY = 22;
  ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx + bw, by); ctx.lineTo(bx + bw - w * 0.012, by + bh); ctx.quadraticCurveTo(bx + bw / 2, by + bh + w * 0.004, bx + w * 0.012, by + bh); ctx.closePath();
  ctx.fillStyle = g; ctx.fill(); ctx.restore();
  path(ctx, bx + bw / 2 - w * 0.075, by, w * 0.15, w * 0.0075, [0, 0, w * 0.006, w * 0.006]); ctx.fillStyle = 'rgba(0,0,0,.28)'; ctx.fill(); // thumb notch
  return { w, h: h + bh };
}

// ───────────── text ─────────────
function wrap(ctx, text, maxW) {
  const words = text.split(' '), lines = []; let cur = '';
  for (const w of words) { const t = cur ? cur + ' ' + w : w; if (ctx.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t; }
  if (cur) lines.push(cur); return lines;
}
function title(ctx, p, W, pal, flip) {
  const maxW = 580, align = flip ? 'right' : 'left', x = flip ? W - 100 : 100;
  ctx.textAlign = align; ctx.textBaseline = 'alphabetic'; ctx.letterSpacing = '-4px';
  let size = 150, lines = [p.brand];
  ctx.font = `700 ${size}px Geist`;
  if (ctx.measureText(p.brand).width > maxW) {
    if (p.brand.includes(' ')) { lines = p.brand.split(' '); }
    let widest = Math.max(...lines.map((l) => ctx.measureText(l).width));
    size = Math.max(70, Math.floor(size * Math.min(1, maxW / widest)));
    ctx.font = `700 ${size}px Geist`;
  }
  ctx.letterSpacing = `${-Math.round(size * 0.028)}px`;
  let y = 280 + (lines.length > 1 ? 0 : 20);
  ctx.fillStyle = '#fff';
  lines.forEach((l, i) => ctx.fillText(l, x, y + i * size * 0.92));
  y += (lines.length - 1) * size * 0.92 + 68;
  ctx.letterSpacing = '0px'; ctx.font = '450 34px Geist'; ctx.fillStyle = hsl(pal.h + 6, 90, 68);
  wrap(ctx, p.line, maxW).forEach((l, i) => ctx.fillText(l, x, y + i * 46));
}

// ───────────── layouts ─────────────
// every position is a fraction of the virtual canvas so the same layout serves 1600×1000 and 1905×1000
function layout(set, W) {
  const px = (f) => f * W;
  if (set === 'laptop+phones') return [['laptop', 'web', px(0.42), 330, px(0.45)], ['phone', 'phone0', px(0.855), 470, px(0.125)], ['phone', 'phone1', px(0.305), 540, px(0.105)]];
  if (set === 'laptop+tablet') return [['laptop', 'web', px(0.44), 300, px(0.48)], ['tablet', 'tablet', px(0.075), 610, px(0.27)]];
  if (set === 'laptop') return [['laptop', 'web', px(0.43), 340, px(0.53)]];
  if (set === 'phones3') return [['phone', 'phone0', px(0.40), 360, px(0.15)], ['phone', 'phone1', px(0.575), 250, px(0.15)], ['phone', 'phone2', px(0.75), 380, px(0.15)]];
  if (set === 'phones2') return [['phone', 'phone0', px(0.47), 300, px(0.17)], ['phone', 'phone1', px(0.665), 380, px(0.17)]];
  if (set === 'tablets3') return [['tablet', 'tablet0', px(0.39), 400, px(0.19)], ['tablet', 'tablet1', px(0.58), 250, px(0.19)], ['tablet', 'tablet2', px(0.77), 380, px(0.19)]];
  throw new Error('unknown device set ' + set);
}
const DRAW = { phone, tablet, laptop };

export function deviceSet(m) {
  if (m.web && m.phones) return 'laptop+phones';
  if (m.web && m.tablet) return 'laptop+tablet';
  if (m.web) return 'laptop';
  if (m.tablets) return 'tablets3';
  if (m.phones) return m.phones.length >= 3 ? 'phones3' : 'phones2';
  throw new Error('project has no mockup screens');
}

// ───────────── public API ─────────────
export async function prepare(p) {
  const m = p.mockup, pick = async (n) => source(p.slug, n, !!m.bare);
  const src = {};
  if (m.web) src.web = await pick(m.web[0]);
  if (m.tablet) src.tablet = await pick(m.tablet[0]);
  if (m.tablets) m.tablets.forEach((n, i) => { src['tablet' + i] = null; });
  if (m.tablets) for (let i = 0; i < m.tablets.length; i++) src['tablet' + i] = await pick(m.tablets[i]);
  if (m.phones) for (let i = 0; i < m.phones.length; i++) src['phone' + i] = await pick(m.phones[i]);
  const all = Object.values(src).filter(Boolean);
  return { src, hue: m.hue ?? dominantHue(all), set: deviceSet(m) };
}

/**
 * `content` < 1 shrinks the title and devices toward the centre while the background stays full-bleed —
 * used for the home card, whose frame crops a few percent off every edge for the scroll parallax.
 */
export function render(canvas, p, prep, index, { width, scale, content = 1 }) {
  const W = width, ctx = canvas.getContext('2d');
  canvas.width = Math.round(W * scale); canvas.height = Math.round(H * scale);
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  const pal = { h: prep.hue }, rand = rng(p.slug), flip = index % 2 === 1;
  background(ctx, W, pal);
  ctx.save(); if (flip) { ctx.translate(W, 0); ctx.scale(-1, 1); }
  meshes[MESH_ORDER[index % MESH_ORDER.length]](ctx, W, pal, rand);
  ctx.restore();
  // soft brand glow behind the devices
  const glow = ctx.createRadialGradient(W * (flip ? 0.38 : 0.64), H * 0.6, 0, W * (flip ? 0.38 : 0.64), H * 0.6, W * 0.42);
  glow.addColorStop(0, hsl(pal.h, 80, 55, 0.22)); glow.addColorStop(1, hsl(pal.h, 80, 55, 0));
  ctx.fillStyle = glow; ctx.fillRect(0, 0, W, H);
  ctx.save(); ctx.translate(W / 2, H / 2); ctx.scale(content, content); ctx.translate(-W / 2, -H / 2);
  title(ctx, p, W, pal, flip);
  const items = layout(prep.set, W);
  // far-to-near order as listed; for flipped covers mirror the positions, not the screenshots
  for (const [kind, key, x, y, w] of items) {
    const s = prep.src[key];
    const dw = w; const ox = flip ? W - x - dw : x;
    DRAW[kind](ctx, s, ox, y, dw);
  }
  ctx.restore();
}

/**
 * Home card for a project with a hand-made cover (no "mockup"): trim the black frame baked into the
 * cover, shrink it toward the centre by `content` and feather its edges into the cover's own background
 * colour, so the card's parallax crop only ever eats background.
 */
export async function cardFromCover(canvas, p, { width, height, content }) {
  const img = await load(`../../assets/images/work/${p.slug}/cover.webp`);
  const W = img.naturalWidth, Hh = img.naturalHeight;
  const c = document.createElement('canvas'); c.width = W; c.height = Hh;
  const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(img, 0, 0);
  const d = x.getImageData(0, 0, W, Hh).data;
  const lum = (px, py) => { const k = (py * W + px) * 4; return (d[k] + d[k + 1] + d[k + 2]) / 3; };
  const line = (n, get) => { let t = 0; for (let i = 0; i < n; i++) t += get(i); return t / n; };
  const dark = 12; // the frame is near-black; the cover's own background is well above this
  let t = 0, b = Hh - 1, l = 0, r = W - 1;
  while (t < Hh / 4 && line(W, (i) => lum(i, t)) < dark) t++;
  while (b > Hh * 0.75 && line(W, (i) => lum(i, b)) < dark) b--;
  while (l < W / 4 && line(Hh, (i) => lum(l, i)) < dark) l++;
  while (r > W * 0.75 && line(Hh, (i) => lum(r, i)) < dark) r--;
  const pad = 4; t += pad; b -= pad; l += pad; r -= pad;
  // background: the median colour of the trimmed cover's border
  const ring = [];
  for (let i = l; i <= r; i += 8) ring.push([i, t], [i, b]);
  for (let i = t; i <= b; i += 8) ring.push([l, i], [r, i]);
  const ch = (o) => ring.map(([px, py]) => d[(py * W + px) * 4 + o]).sort((p, q) => p - q)[ring.length >> 1];
  const bg = `rgb(${ch(0)},${ch(1)},${ch(2)})`;

  canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, width, height);
  // cover-fit the trimmed cover into the card, then scale it about the centre
  const sw = r - l, sh = b - t, fit = Math.max(width / sw, height / sh) * content;
  const dw = sw * fit, dh = sh * fit, dx = (width - dw) / 2, dy = (height - dh) / 2;
  const layer = document.createElement('canvas'); layer.width = width; layer.height = height;
  const lx = layer.getContext('2d');
  lx.drawImage(img, l, t, sw, sh, dx, dy, dw, dh);
  // feather: fade the layer's outer band to transparent so it melts into the background
  const f = Math.min(dw, dh) * 0.08;
  lx.globalCompositeOperation = 'destination-in';
  const fade = (x0, y0, x1, y1) => { const g = lx.createLinearGradient(x0, y0, x1, y1); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,1)'); return g; };
  for (const [g, rx, ry, rw, rh] of [
    [fade(dx, 0, dx + f, 0), 0, 0, width, height],
    [fade(dx + dw, 0, dx + dw - f, 0), 0, 0, width, height],
    [fade(0, dy, 0, dy + f), 0, 0, width, height],
    [fade(0, dy + dh, 0, dy + dh - f), 0, 0, width, height],
  ]) { lx.fillStyle = g; lx.fillRect(rx, ry, rw, rh); }
  ctx.drawImage(layer, 0, 0);
}

/**
 * Cover for a product that has a logo but no screens yet ("brandArt" in data/projects.json): the same
 * background, mesh and title as the device covers, with the logo mark where the devices would be.
 * brandArt: { hue, logo?: "logo.jpg" (in the project folder), crop?: [x, y, w, h], initial?: "C", style? }.
 * The logos are drawn with the "lighten" blend, so their black backgrounds melt into the dark cover.
 * Without a logo an app-icon monogram stands in.
 */
export async function prepareBrand(p) {
  const a = p.brandArt;
  const logo = a.logo ? await load(`../../assets/images/work/${p.slug}/${a.logo}`) : null;
  return { brand: true, hue: a.hue ?? 228, logo, crop: a.crop || (logo ? [0, 0, logo.naturalWidth, logo.naturalHeight] : null), initial: a.initial || p.brand.charAt(0) };
}

export function renderBrand(canvas, p, prep, index, { width, scale, content = 1 }) {
  const W = width, ctx = canvas.getContext('2d');
  canvas.width = Math.round(W * scale); canvas.height = Math.round(H * scale);
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  const pal = { h: prep.hue }, rand = rng(p.slug), flip = index % 2 === 1;
  background(ctx, W, pal);
  ctx.save(); if (flip) { ctx.translate(W, 0); ctx.scale(-1, 1); }
  meshes[MESH_ORDER[index % MESH_ORDER.length]](ctx, W, pal, rand);
  ctx.restore();
  const cx = W * (flip ? 0.30 : 0.70), cy = H * 0.52;
  const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, W * 0.36);
  glow.addColorStop(0, hsl(pal.h, 85, 58, 0.30)); glow.addColorStop(1, hsl(pal.h, 85, 58, 0));
  ctx.fillStyle = glow; ctx.fillRect(0, 0, W, H);
  ctx.save(); ctx.translate(W / 2, H / 2); ctx.scale(content, content); ctx.translate(-W / 2, -H / 2);
  title(ctx, p, W, pal, flip);
  if (prep.logo) {
    const [sx, sy, sw, sh] = prep.crop, maxH = H * 0.62, maxW = W * 0.34;
    const k = Math.min(maxH / sh, maxW / sw), dw = sw * k, dh = sh * k;
    ctx.save(); ctx.globalCompositeOperation = 'lighten';
    ctx.drawImage(prep.logo, sx, sy, sw, sh, cx - dw / 2, cy - dh / 2, dw, dh);
    ctx.restore();
  } else {
    const s = H * 0.46, x = cx - s / 2, y = cy - s / 2;
    ctx.save(); ctx.shadowColor = hsl(pal.h, 80, 30, 0.6); ctx.shadowBlur = 80; ctx.shadowOffsetY = 30;
    const g = ctx.createLinearGradient(x, y, x + s, y + s);
    g.addColorStop(0, hsl(pal.h - 18, 90, 66)); g.addColorStop(1, hsl(pal.h + 22, 80, 46));
    path(ctx, x, y, s, s, s * 0.24); ctx.fillStyle = g; ctx.fill(); ctx.restore();
    path(ctx, x + 1, y + 1, s - 2, s - 2, s * 0.24); ctx.strokeStyle = 'rgba(255,255,255,.28)'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.letterSpacing = '-6px';
    ctx.font = `700 ${Math.round(s * 0.56)}px Geist`; ctx.fillText(prep.initial, cx, cy + s * 0.02);
    ctx.letterSpacing = '0px';
  }
  ctx.restore();
}
