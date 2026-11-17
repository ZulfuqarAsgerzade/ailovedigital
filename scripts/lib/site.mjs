// Shared by the build scripts: site-wide config, small helpers and the project loader.
// Single place to change the domain, the brand text or how project data is read.

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

// ───────────────────────────── CONFIG ─────────────────────────────
// Two production sites, each built into its own folder under dist/ and deployed as-is:
//   ailovedigital.az   Azerbaijani at the root (the primary market)
//   ailovedigital.com  English at the root, Russian under /ru/
// Which language lives where is LOCALES in scripts/lib/i18n.mjs.
export const SITES = {
  az: { origin: 'https://ailovedigital.az', dir: 'dist/ailovedigital.az' },
  com: { origin: 'https://ailovedigital.com', dir: 'dist/ailovedigital.com' },
};
export const SITE_URL = SITES.com.origin; // English origin (x-default), no trailing slash
// One entity for the company on both domains: every page's JSON-LD points at this @id.
export const ORG_ID = `${SITES.az.origin}/#org`;
export const WEBSITE_ID = (origin) => `${origin}/#website`;
export const GSC_VERIFICATION = 'LMYNGduPKSjR0Iq1BrJwVnJaHG2mVrcuhzV6e6R_1kk'; // Google Search Console (same token on both domains)
export const BING_VERIFICATION = 'D41285A846F1041A1FF87DE18E6DAB14'; // Bing Webmaster Tools (msvalidate.01, tied to the account) — keep it after verification
export const INDEXNOW_KEY = 'a9a8e413c53835d9785a320600695f9d'; // IndexNow (Bing, Yandex…): the key file <key>.txt sits at the repo root and is copied to both sites
// Dailoq web chat (our AI assistant), loaded before </body> on every page of both sites.
// Allowed domains are set in the Dailoq panel (app.dailoq.az → Widget); empty string here turns it off.
export const DAILOQ_WIDGET = '<script src="https://api-staging.dailoq.az/widget.js" data-bot-key="e49f428c371c2e16c9cd66aee6263ba2" data-api-base="https://api-staging.dailoq.az"></script>';
export const NAME = 'AILoveDigital';
export const TITLE = 'AILoveDigital — IT & Digital Marketing Agency in Baku';
export const DESCRIPTION =
  'Baku IT and digital marketing studio: website and mobile app development, AI automation, SMM and ads — one team, 20 shipped digital products.';
export const TAGLINE = 'And we make businesses love it too.';
export const SLOGAN = 'Built with logic. Finished with love.';
export const EMAIL = 'info@ailovedigital.com';
export const PHONE = '(+994 70) 280 18 18';
export const PHONE_TEL = '+994702801818'; // E.164, for tel: links and structured data
export const INSTAGRAM = 'https://www.instagram.com/ailovedigital.az/';
export const LINKEDIN = 'https://www.linkedin.com/company/ailovedigital/';
// NAP — one public address everywhere (schema, footer, contact page, llms.txt). The office is the Google
// Maps place below; the registered (legal) address is shown only as company details.
export const OFFICE = { street: 'Altis Plaza', district: 'Binagadi district', city: 'Baku', country: 'AZ' };
export const LEGAL_NAME = '"AI LOVE DIGITAL" LLC';
export const TAX_ID = '1009781681';
export const LEGAL_ADDRESS = 'AZ1107, Hamza Babashov str. 11, apt. 2, Binagadi district, Baku, Azerbaijan';
export const MAPS = 'https://maps.google.com/?cid=1268243044441275730'; // Google Maps place: Altis Plaza, Binagadi district, Baku
export const WHATSAPP = `https://wa.me/${PHONE_TEL.slice(1)}`; // opens a WhatsApp chat with PHONE
export const LOCALE = 'en_US';
export const LANG = 'en';
export const BG = '#F7F5F0';
export const OG_IMAGE = '/assets/images/og-image.png';
export const OG_ALT = 'AILoveDigital — pixel heart logo and the tagline "AI, Technology & Business Growth"';
// ──────────────────────────────────────────────────────────────────

// Normalised to LF: a Windows checkout (core.autocrlf) must not break the multi-line fragments in i18n/*.json.
export const read = (f) => readFileSync(join(ROOT, f), 'utf8').replace(/\r\n/g, '\n');
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
