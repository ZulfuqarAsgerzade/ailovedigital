// Languages: English lives at the site root, every other language under /<code>/ with the same paths
// (/ru/, /ru/work/, /ru/work/<slug>/ …). Text comes from:
//
//   i18n/<code>.json            page chrome (nav, footer, section labels), meta tags and — for the home
//                               page — [English, translation] pairs applied to index.html
//   data/projects.<code>.json   the translated text fields of every project (same order as projects.json)
//
// English needs neither: its chrome is i18n/en.json and its projects are data/projects.json itself.

import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, SITES, TITLE, DESCRIPTION, TAGLINE, SLOGAN, OG_ALT, read, esc } from './site.mjs';

export const LANGS = ['en', 'ru', 'az'];
export const DEFAULT_LANG = 'en';
// site: which entry of SITES (scripts/lib/site.mjs) the language is published on; prefix: its folder there.
export const LOCALES = {
  en: { code: 'en', site: 'com', prefix: '', ogLocale: 'en_US', label: 'English', short: 'EN' },
  ru: { code: 'ru', site: 'com', prefix: 'ru/', ogLocale: 'ru_RU', label: 'Русский', short: 'RU' },
  az: { code: 'az', site: 'az', prefix: '', ogLocale: 'az_AZ', label: 'Azərbaycanca', short: 'AZ' },
};

/** A page path is one string for every language ("work/rana/") or a per-language map for pages with
 *  translated slugs ({ az: 'xidmetler/smm/', en: 'services/smm/' }); a language missing from the map has no such page. */
export const pathIn = (path, lang) => (typeof path === 'string' ? path : path?.[lang]);
export const langsOf = (path) => LANGS.filter((l) => pathIn(path, l) !== undefined);

export const originOf = (lang) => SITES[LOCALES[lang].site].origin;
/** Absolute URL of a site path ("" = home, "work/", "work/<slug>/" or a per-language map) in a language. */
export const urlIn = (lang, path = '') => `${originOf(lang)}/${LOCALES[lang].prefix}${pathIn(path, lang)}`;
/** Absolute URL of a file (image, icon) on the site a language is published on. */
export const absIn = (lang, p) => (p.startsWith('http') ? p : `${originOf(lang)}/${p.replace(/^\.?\//, '')}`);
/** Where a page of `lang` is written: dist/<site>/<prefix><path>index.html */
export const outFile = (lang, path = '', file = 'index.html') => `${SITES[LOCALES[lang].site].dir}/${LOCALES[lang].prefix}${pathIn(path, lang)}${file}`;
/** Relative path from a page back to the root of its own site ("" on the root page, "../../" on /work/rana/). */
export const backTo = (lang, path = '') => '../'.repeat((LOCALES[lang].prefix + pathIn(path, lang)).split('/').filter(Boolean).length);
/** Link from a page in `from` (whose root is `b`) to `path` in `to`: relative on the same site, absolute across sites. */
export const hrefTo = (from, to, path, b) =>
  LOCALES[from].site === LOCALES[to].site ? (`${b}${LOCALES[to].prefix}${pathIn(path, to)}` || './') : urlIn(to, path);

/** `<link rel="alternate" hreflang>` for every language the page exists in, plus x-default (English, else the first). */
export const hreflangLinks = (path = '') => {
  const ls = langsOf(path);
  const def = ls.includes(DEFAULT_LANG) ? DEFAULT_LANG : ls[0];
  return [...ls.map((l) => `<link rel="alternate" hreflang="${l}" href="${urlIn(l, path)}">`),
    `<link rel="alternate" hreflang="x-default" href="${urlIn(def, path)}">`].join('\n');
};

/** og:locale for this language and og:locale:alternate for the others. */
export const ogLocaleTags = (lang) =>
  [`<meta property="og:locale" content="${LOCALES[lang].ogLocale}">`,
    ...LANGS.filter((l) => l !== lang).map((l) => `<meta property="og:locale:alternate" content="${LOCALES[l].ogLocale}">`)].join('\n');

const cache = {};
/** Chrome strings for a language; English meta comes from the CONFIG in site.mjs. */
export function strings(lang) {
  if (cache[lang]) return cache[lang];
  const en = JSON.parse(read('i18n/en.json'));
  en.meta = { title: TITLE, description: DESCRIPTION, tagline: TAGLINE, slogan: SLOGAN, ogAlt: OG_ALT };
  if (lang === 'en') return (cache[lang] = en);
  const tr = JSON.parse(read(`i18n/${lang}.json`));
  for (const k of Object.keys(en.ui)) if (!(k in tr.ui)) throw new Error(`i18n/${lang}.json: ui.${k} is missing`);
  for (const k of Object.keys(en.meta)) if (!tr.meta?.[k]) throw new Error(`i18n/${lang}.json: meta.${k} is missing`);
  return (cache[lang] = tr);
}

/** "{n} products" → fill placeholders. */
export const fill = (s, vars) => s.replace(/\{(\w+)\}/g, (_, k) => (k in vars ? vars[k] : `{${k}}`));

const TEXT_FIELDS = ['line', 'headline', 'subtitle', 'scope', 'overview', 'problem', 'approach', 'result', 'coverAlt'];
const LIST_FIELDS = ['chips', 'metrics', 'features', 'architecture', 'stack'];
/**
 * Projects with their text in `lang`. Structure (slug, images, order, year, mockup) always comes from the
 * English data; the translation file only supplies text and must match it field for field.
 */
export function localizeProjects(projects, lang) {
  if (lang === 'en') return projects;
  const file = `data/projects.${lang}.json`;
  if (!existsSync(join(ROOT, file))) throw new Error(`${file} is missing`);
  const tr = JSON.parse(read(file));
  if (tr.length !== projects.length) throw new Error(`${file}: ${tr.length} projects, projects.json has ${projects.length}`);
  return projects.map((p, i) => {
    const t = tr[i];
    if (t.slug !== p.slug) throw new Error(`${file}[${i}]: slug "${t.slug}", expected "${p.slug}"`);
    for (const k of TEXT_FIELDS) if (!t[k]) throw new Error(`${file}: "${p.slug}" is missing "${k}"`);
    for (const k of LIST_FIELDS) {
      if (!Array.isArray(t[k]) || t[k].length !== p[k].length) throw new Error(`${file}: "${p.slug}".${k} must have ${p[k].length} items`);
    }
    t.stack.forEach((g, j) => { if (g.v.length !== p.stack[j].v.length) throw new Error(`${file}: "${p.slug}".stack[${j}].v length differs`); });
    const out = { ...p, lang };
    for (const k of [...TEXT_FIELDS, ...LIST_FIELDS]) out[k] = t[k];
    if (p.time) out.time = t.time || p.time; // optional: the timeline, e.g. "3 months"
    out.url = urlIn(lang, p.path);
    return out;
  });
}

// ───────────────────────────── language menu ─────────────────────────────
const GLOBE = '<svg class="ald-lang-ico" width="15" height="15" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6.5"></circle><path d="M1.5 8h13M8 1.5c1.9 1.8 2.9 4 2.9 6.5S9.9 12.7 8 14.5M8 1.5C6.1 3.3 5.1 5.5 5.1 8s1 4.7 2.9 6.5"></path></svg>';
const CHEVRON = '<svg class="ald-lang-chev" width="9" height="9" viewBox="0 0 10 10" aria-hidden="true"><path d="M2 3.5 5 6.5 8 3.5"></path></svg>';

/**
 * The nav's language dropdown. `hrefs` maps every language to the link for the same page in that
 * language. `hreflang` attributes are left out where the markup goes through the home page's React
 * runtime (it only knows the camel-cased hrefLang); the <head> alternates carry that signal anyway.
 */
export function langMenu(lang, hrefs, { indent = '    ', hreflangAttr = true } = {}) {
  const cur = LOCALES[lang];
  const opt = (l) => {
    const L = LOCALES[l];
    const flag = `<span class="ald-flag ald-flag--${l}" aria-hidden="true"></span>`;
    return l === lang
      ? `<span class="ald-lang-opt is-active" lang="${l}" aria-current="true">${flag}${L.label}<span class="ald-lang-tag">✓</span></span>`
      : `<a class="ald-lang-opt" href="${hrefs[l]}" lang="${l}"${hreflangAttr ? ` hreflang="${l}"` : ''}>${flag}${L.label}</a>`;
  };
  return [
    `<details class="ald-lang">`,
    `  <summary class="ald-lang-btn" aria-label="${esc(strings(lang).ui.language)}: ${cur.label}">`,
    `    ${GLOBE}`,
    `    <span>${cur.short}</span>`,
    `    ${CHEVRON}`,
    `  </summary>`,
    `  <div class="ald-lang-menu">`,
    ...LANGS.map((l) => `    ${opt(l)}`),
    `  </div>`,
    `</details>`,
  ].map((line, i) => (i ? indent : '') + line).join('\n');
}

/** Home-page work cards: the `const workData = [ … ];` literal inside index.html's component script. */
export function workDataLiteral(projects, assetBase) {
  const q = (s) => `'${String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
  return `const workData = [
${projects.map((p) => `      { name: ${q(p.name)}, line: ${q(p.line)}, year: ${q(p.year)}, scope: ${q(p.scope)}, time: ${q(p.time || '')}, m1: ${q(p.chips[0])}, m2: ${q(p.chips[1])}, m3: ${q(p.chips[2])}, slug: ${q(p.slug)}, img: ${q(assetBase + p.homeImg)}, href: ${q('./' + p.path)} },`).join('\n')}
    ];`;
}
