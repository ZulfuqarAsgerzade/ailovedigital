// Shared by the build scripts: site-wide config, small helpers and the project loader.
// Single place to change the domain, the brand text or how project data is read.

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

// ───────────────────────────── CONFIG ─────────────────────────────
export const SITE_URL = 'https://ailovedigital.com'; // ← production origin, no trailing slash
export const NAME = 'AILoveDigital';
export const TITLE = 'AILoveDigital — AI, Technology & Business Growth';
export const DESCRIPTION =
  'AILoveDigital is a Baku-based technology and creative studio. We build digital products with AI at the core, grow their audience and train the teams that run them.';
export const TAGLINE = 'And we make businesses love it too.';
export const SLOGAN = 'Built with logic. Finished with love.';
export const EMAIL = 'info@ailovedigital.com';
export const PHONE = '(+994 70) 280 18 18';
export const PHONE_TEL = '+994702801818'; // E.164, for tel: links and structured data
export const INSTAGRAM = 'https://www.instagram.com/ailovedigital.az/';
export const LINKEDIN = 'https://www.linkedin.com/company/ailovedigital/';
export const WHATSAPP = `https://wa.me/${PHONE_TEL.slice(1)}`; // opens a WhatsApp chat with PHONE
export const LOCALE = 'en_US';
export const LANG = 'en';
export const BG = '#F7F5F0';
export const OG_IMAGE = '/assets/images/og-image.png';
export const OG_ALT = 'AILoveDigital — pixel heart logo and the tagline "AI, Technology & Business Growth"';
// ──────────────────────────────────────────────────────────────────

export const read = (f) => readFileSync(join(ROOT, f), 'utf8');
export const write = (f, s) => {
  mkdirSync(dirname(join(ROOT, f)), { recursive: true });
  writeFileSync(join(ROOT, f), s);
};
export const abs = (p) => (p.startsWith('http') ? p : SITE_URL + '/' + p.replace(/^\.?\//, ''));
export const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
export const cap = (s) => s.charAt(0) + s.slice(1).toLowerCase();
export const pad2 = (n) => String(n).padStart(2, '0');

/** Meta description: as many whole sentences as fit in `max`; if that is too short (< ~110) cut at a word instead. */
export function clip(text, max) {
  if (text.length <= max) return text;
  let out = '';
  for (const sentence of text.match(/[^.!?]+[.!?]+(\s|$)/g) || []) {
    if ((out + sentence).trim().length > max) break;
    out += sentence;
  }
  out = out.trim();
  if (out.length >= Math.min(110, max * 0.7)) return out;
  const head = text.slice(0, max - 1);
  return head.slice(0, head.lastIndexOf(' ')).replace(/[,;:—–-]\s*$/, '') + '…';
}

/** Pixel size of a .webp file, read from its header (no image tooling needed). */
export function webpSize(file) {
  const b = readFileSync(file);
  if (b.toString('ascii', 0, 4) !== 'RIFF' || b.toString('ascii', 8, 12) !== 'WEBP') throw new Error(`${file}: not a WebP file`);
  const kind = b.toString('ascii', 12, 16);
  if (kind === 'VP8 ') return { w: b.readUInt16LE(26) & 0x3fff, h: b.readUInt16LE(28) & 0x3fff };
  if (kind === 'VP8L') { const bits = b.readUInt32LE(21); return { w: (bits & 0x3fff) + 1, h: ((bits >> 14) & 0x3fff) + 1 }; }
  if (kind === 'VP8X') return { w: 1 + b.readUIntLE(24, 3), h: 1 + b.readUIntLE(27, 3) };
  throw new Error(`${file}: unknown WebP chunk "${kind}"`);
}

/**
 * Projects come from data/projects.json (the single source of truth for the home page cards,
 * the /work/ hub, every case-study page, the sitemap and the structured data).
 * Images: assets/images/work/<slug>/{cover.webp, og.jpg} and the 800×500 home-page card
 * assets/images/work/<slug>.webp. The numbered screens (01.webp …) next to them only feed the cover
 * composer (tools/covers/); the pages do not show them.
 */
export function loadProjects() {
  const list = JSON.parse(read('data/projects.json'));
  const seen = new Set();
  return list.map((p, i) => {
    for (const k of ['slug', 'name', 'brand', 'line', 'headline', 'subtitle', 'year', 'scope', 'overview', 'problem', 'approach', 'result', 'coverAlt']) {
      if (!p[k]) throw new Error(`data/projects.json: "${p.slug || i}" is missing "${k}"`);
    }
    for (const k of ['chips', 'metrics', 'features', 'architecture', 'stack']) {
      if (!Array.isArray(p[k]) || !p[k].length) throw new Error(`data/projects.json: "${p.slug}" needs a non-empty "${k}"`);
    }
    if (p.chips.length !== 3) throw new Error(`data/projects.json: "${p.slug}" needs exactly 3 chips`);
    if (seen.has(p.slug)) throw new Error(`duplicate slug "${p.slug}"`);
    seen.add(p.slug);

    const dir = `assets/images/work/${p.slug}`;
    const need = (f) => { if (!existsSync(join(ROOT, f))) throw new Error(`missing image ${f}`); return f; };
    const cover = { src: need(`${dir}/cover.webp`), ...webpSize(join(ROOT, `${dir}/cover.webp`)) };
    return {
      ...p,
      n: i + 1,
      path: `work/${p.slug}/`,
      url: `${SITE_URL}/work/${p.slug}/`,
      homeImg: need(`assets/images/work/${p.slug}.webp`),
      og: need(`${dir}/og.jpg`),
      cover,
    };
  });
}
