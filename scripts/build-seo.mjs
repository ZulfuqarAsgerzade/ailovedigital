#!/usr/bin/env node
// Builds the home page in every language and the per-site files search engines and AI crawlers read,
// from the same data the pages render, so nothing drifts. Runs after build-work.mjs.
//
//   dist/<site>/<prefix>index.html   index.html (the template) with i18n/<lang>.json → "home" applied and
//                                    these generated blocks filled in:
//       head       title, meta, Open Graph, hreflang, JSON-LD, icons, self-hosted fonts and React preloads
//       noscript   a readable copy of the page for visitors and crawlers without JavaScript
//       langmenu   the nav's language dropdown
//       h1x        the visually hidden part of the H1 (what the studio is and where)
//       svclinks   links from the home services list to every service page
//       footsvc    footer: service pages      footco   footer: company pages
//   dist/<site>/sitemap.xml          every page of that site, hreflang alternates (across both domains) and lastmod
//   dist/<site>/robots.txt           everything open, AI crawlers named explicitly, the site's sitemap
//   dist/<site>/llms.txt             a plain-text summary for AI assistants, in the site's main language
//   dist/<site>/site.webmanifest
//
// Edit the CONFIG in scripts/lib/site.mjs (English meta), i18n/<lang>.json and data/*.json — not the output.

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  ROOT, SITES, NAME, EMAIL, PHONE, PHONE_TEL, INSTAGRAM, LINKEDIN, MAPS, BG, OG_IMAGE, GSC_VERIFICATION, BING_VERIFICATION, DAILOQ_WIDGET,
  LEGAL_NAME, TAX_ID, read, write, esc, loadProjects,
} from './lib/site.mjs';
import {
  LANGS, LOCALES, DEFAULT_LANG, strings, localizeProjects, langMenu, hreflangLinks, ogLocaleTags, urlIn, absIn, outFile,
  backTo, hrefTo, pathIn, langsOf, workDataLiteral, originOf,
} from './lib/i18n.mjs';
import {
  pageText, servicesIn, orgNode, websiteNode, grabArray, translatedSource, HUB_PATH, ABOUT_PATH, CONTACT_PATH,
  SMM, smmText, money,
} from './lib/pages.mjs';

const source = read('index.html'); // English template, with workAll already refreshed by build-work.mjs
const projects = loadProjects();
const today = new Date().toISOString().slice(0, 10);

// "BUILD" → "Build", "İNKİŞAF" → "İnkişaf" (locale-aware: Azerbaijani I/İ lower-case differently)
const cap = (s, lang) => s.charAt(0) + s.slice(1).toLocaleLowerCase(lang);

function replaceBlock(src, name, block) {
  const re = new RegExp(`<!-- ${name}:start[\\s\\S]*?<!-- ${name}:end -->`);
  if (!re.test(src)) throw new Error(`marker "${name}" missing in index.html`);
  return src.replace(re, () => block);
}

// The vendored React files must stay byte-identical to the CDN files support.js pins with SRI.
const support = read('js/support.js');
for (const [name, file] of [['REACT', 'vendor/react.production.min.js'], ['REACT_DOM', 'vendor/react-dom.production.min.js']]) {
  const sri = support.match(new RegExp(`var ${name}_SRI = "([^"]+)"`))?.[1];
  const got = 'sha384-' + createHash('sha384').update(readFileSync(join(ROOT, file))).digest('base64');
  if (!sri) throw new Error(`could not read ${name}_SRI from js/support.js`);
  if (got !== sri) console.warn(`seo: warning — ${file} does not match ${name}_SRI in js/support.js`);
}

/** index.html → the home page in `lang`: translated copy, asset paths relative to where the page lives. */
function homeSource(lang, work) {
  const b = backTo(lang, '');
  let html = translatedSource(lang, source);
  if (lang !== DEFAULT_LANG) html = html.replace('<html lang="en">', `<html lang="${lang}">`);
  if (b) html = html.replace(/(src|href)="\.\/(js|css|assets|vendor)\//g, `$1="${b}$2/`);
  return html.replace(/const workData = \[[\s\S]*?\n\s*\];/, () => workDataLiteral(work, b || './'));
}

function buildHome(lang) {
  const { ui: t, meta } = strings(lang);
  const U = pageText(lang).ui;
  const b = backTo(lang, '');
  const L = (path = '') => `${b}${LOCALES[lang].prefix}${pathIn(path, lang)}` || './';
  const url = urlIn(lang);
  const work = localizeProjects(projects, lang);
  const svcs = servicesIn(lang);
  let html = homeSource(lang, work);

  const services = grabArray(html, 'svcData');
  const steps = grabArray(html, 'steps');
  const values = grabArray(html, 'values');
  const nextSteps = grabArray(html, 'next');

  // ───────────── <head> block ─────────────
  const graph = [
    orgNode(lang),
    websiteNode(lang),
    {
      '@type': 'WebPage', '@id': `${url}#webpage`, url, name: meta.title, description: meta.description, inLanguage: lang,
      isPartOf: { '@id': `${originOf(lang)}/#website` }, about: { '@id': orgNode(lang)['@id'] },
      primaryImageOfPage: { '@type': 'ImageObject', url: absIn(lang, OG_IMAGE), width: 1200, height: 630 },
    },
    {
      '@type': 'ItemList', '@id': `${url}#work`, name: t.selectedWork, numberOfItems: work.length,
      itemListElement: work.map((w) => ({ '@type': 'ListItem', position: w.n, url: w.url, name: w.brand })),
    },
  ];
  const jsonLd = JSON.stringify({ '@context': 'https://schema.org', '@graph': graph }, null, 2).replace(/<\//g, '<\\/');

  const headBlock = `<!-- head:start — generated by scripts/build-seo.mjs, edit the script instead -->
<title>${esc(meta.title)}</title>
<meta name="description" content="${esc(meta.description)}">
<link rel="canonical" href="${url}">
${hreflangLinks('')}
<meta name="robots" content="index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1">
<meta name="author" content="${NAME}">
<meta name="google-site-verification" content="${GSC_VERIFICATION}">
<meta name="msvalidate.01" content="${BING_VERIFICATION}">
<meta name="theme-color" content="${BG}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="${NAME}">
${ogLocaleTags(lang)}
<meta property="og:url" content="${url}">
<meta property="og:title" content="${esc(meta.title)}">
<meta property="og:description" content="${esc(meta.description)}">
<meta property="og:image" content="${absIn(lang, OG_IMAGE)}">
<meta property="og:image:type" content="image/png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="${esc(meta.ogAlt)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(meta.title)}">
<meta name="twitter:description" content="${esc(meta.description)}">
<meta name="twitter:image" content="${absIn(lang, OG_IMAGE)}">
<meta name="twitter:image:alt" content="${esc(meta.ogAlt)}">
<link rel="icon" href="${b || './'}assets/icons/favicon.svg" type="image/svg+xml">
<link rel="icon" href="${b || './'}assets/icons/favicon-32.png" sizes="32x32" type="image/png">
<link rel="icon" href="${b || './'}assets/icons/favicon-48.png" sizes="48x48" type="image/png">
<link rel="shortcut icon" href="${b || './'}favicon.ico">
<link rel="apple-touch-icon" href="${b || './'}assets/icons/apple-touch-icon.png">
<link rel="manifest" href="${b || './'}site.webmanifest">
<link rel="preload" as="script" href="${b || './'}vendor/react.production.min.js">
<link rel="preload" as="script" href="${b || './'}vendor/react-dom.production.min.js">
<link rel="preload" as="font" type="font/woff2" href="${b || './'}assets/fonts/geist-latin.woff2" crossorigin>
<link rel="stylesheet" href="${b || './'}css/fonts.css">
<script type="application/ld+json">
${jsonLd}
</script>
<noscript><style>x-dc{display:none!important}body{background:${BG}}.nojs{max-width:760px;margin:0 auto;padding:48px 20px;font:16px/1.6 -apple-system,'Helvetica Neue',Arial,sans-serif;color:#0B0B0B}.nojs a{color:#CC1230}.nojs h1{font-size:44px;line-height:1.05;margin:0 0 8px}.nojs h2{margin:40px 0 12px}.nojs li{margin:0 0 14px}</style></noscript>
<!-- head:end -->`;

  // ───────────── <noscript> block ─────────────
  // What crawlers that don't run JavaScript (most AI crawlers) read: the full home copy as plain HTML,
  // with real links to every service page, case study and contact detail.
  const others = LANGS.filter((l) => l !== lang).map((l) => `<a href="${hrefTo(lang, l, '', b)}" lang="${l}" hreflang="${l}">${LOCALES[l].label}</a>`).join(' · ');
  const noscriptBlock = `<!-- noscript:start — generated by scripts/build-seo.mjs, edit the script instead -->
<noscript>
<article class="nojs">
<h1>${NAME} — ${esc(U.homeH1)}</h1>
<p><strong>${esc(meta.tagline)}</strong></p>
<p>${esc(meta.description)}</p>
<h2>${esc(t.nsServices)}</h2>
<ul>
${svcs.map((s) => `<li><a href="${L(s.path)}"><strong>${esc(s.name)}</strong></a> — ${esc(s.short)}</li>`).join('\n')}
</ul>
<ul>
${services.map((s) => `<li><strong>${esc(cap(s.word, lang))}</strong> — ${esc(s.desc)} <em>${esc(s.tags)}</em></li>`).join('\n')}
</ul>
<p><a href="${L(HUB_PATH)}">${esc(U.allServices)}</a></p>
<h2>${esc(t.nsWork)}</h2>
<ol>
${work.map((w) => `<li><h3><a href="${L(w.path)}">${esc(w.brand)}</a></h3><p>${esc(w.line)}</p><p>${esc(w.scope)} · ${esc(w.year)}</p><ul>${w.chips.map((m) => `<li>${esc(m)}</li>`).join('')}</ul></li>`).join('\n')}
</ol>
<p><a href="${L('work/')}">${esc(t.nsAll)}</a></p>
<h2>${esc(t.nsProcess)}</h2>
<ol>
${steps.map((s) => `<li><strong>${esc(s.t)}</strong> — ${esc(s.d)}</li>`).join('\n')}
</ol>
<h2>${esc(t.nsWho)}</h2>
<ul>
${values.map((v) => `<li><strong>${esc(v.t)}</strong> — ${esc(v.d)}</li>`).join('\n')}
</ul>
<p><a href="${L(ABOUT_PATH)}">${esc(t.about)}</a></p>
<h2>${esc(t.nsContact)}</h2>
<p>${esc(t.nsEmail)} <a href="mailto:${EMAIL}">${EMAIL}</a> · <a href="tel:${PHONE_TEL}">${PHONE}</a> · <a href="${MAPS}">${esc(t.address)}</a> · <a href="${L(CONTACT_PATH)}">${esc(t.contact)}</a>. ${esc(t.nsNext)}</p>
<ol>
${nextSteps.map((s) => `<li>${esc(s.t)}</li>`).join('\n')}
</ol>
<p>${esc(LEGAL_NAME)} · ${esc(pageText(lang).about.taxId)} ${TAX_ID}</p>
<p>${esc(meta.slogan)}</p>
<p>${others}</p>
</article>
</noscript>
<!-- noscript:end -->`;

  // ───────────── language menu ─────────────
  const hrefs = Object.fromEntries(LANGS.map((l) => [l, hrefTo(lang, l, '', b)]));
  const menuBlock = `<!-- langmenu:start — generated by scripts/build-seo.mjs, edit scripts/lib/i18n.mjs instead -->
    ${langMenu(lang, hrefs, { indent: '    ', hreflangAttr: false })}
    <!-- langmenu:end -->`;

  // ───────────── links into the service, about and contact pages ─────────────
  const h1x = `<!-- h1x:start — generated by scripts/build-seo.mjs --><span class="sr-only"> — ${esc(U.homeH1)}</span><!-- h1x:end -->`;
  const svcLinks = `<!-- svclinks:start — generated by scripts/build-seo.mjs -->
    <ul class="ald-svc-links ald-rv">
${svcs.map((s) => `      <li><a href="${L(s.path)}">${esc(s.name)}</a></li>`).join('\n')}
      <li><a href="${L(HUB_PATH)}" class="is-all">${esc(U.allServices)}</a></li>
    </ul>
    <!-- svclinks:end -->`;
  const footSvc = `<!-- footsvc:start — generated by scripts/build-seo.mjs -->
          ${svcs.map((s) => `<a href="${L(s.path)}">${esc(s.name)}</a>`).join('')}
          <!-- footsvc:end -->`;
  const footCo = `<!-- footco:start — generated by scripts/build-seo.mjs -->
          <a href="${L('work/')}">${t.work}</a><a href="${L(HUB_PATH)}">${t.services}</a><a href="${L(ABOUT_PATH)}">${t.about}</a><a href="${L(CONTACT_PATH)}">${t.contact}</a><a href="${L('privacy/')}">${t.privacyPolicy}</a>
          <!-- footco:end -->`;

  html = replaceBlock(html, 'head', headBlock);
  html = replaceBlock(html, 'noscript', noscriptBlock);
  html = replaceBlock(html, 'langmenu', menuBlock);
  html = replaceBlock(html, 'h1x', h1x);
  html = replaceBlock(html, 'svclinks', svcLinks);
  html = replaceBlock(html, 'footsvc', footSvc);
  html = replaceBlock(html, 'footco', footCo);
  // Dailoq chat widget before the last </body> (the page's inline scripts contain no other one, but be safe).
  const end = html.lastIndexOf('</body>');
  if (DAILOQ_WIDGET && end > -1 && !html.includes(DAILOQ_WIDGET)) html = `${html.slice(0, end)}${DAILOQ_WIDGET}\n${html.slice(end)}`;
  write(outFile(lang, ''), html);
  return { lang, services, work, svcs };
}

const homes = Object.fromEntries(LANGS.map((l) => [l, buildHome(l)]));

// ───────────────────────────── lastmod from git ─────────────────────────────
// The date of the last commit touching a page's sources; today if they have uncommitted changes.
const lastmodCache = new Map();
function lastmod(files) {
  const key = files.join('|');
  if (lastmodCache.has(key)) return lastmodCache.get(key);
  let d = today;
  try {
    const dirty = execFileSync('git', ['status', '--porcelain', '--', ...files], { cwd: ROOT }).toString().trim();
    if (!dirty) d = execFileSync('git', ['log', '-1', '--format=%cs', '--', ...files], { cwd: ROOT }).toString().trim() || today;
  } catch { /* not a git checkout: use today */ }
  lastmodCache.set(key, d);
  return d;
}
const i18nFile = (l) => (l === 'en' ? 'scripts/lib/site.mjs' : `i18n/${l}.json`);
const projFile = (l) => (l === 'en' ? 'data/projects.json' : `data/projects.${l}.json`);
const svcFiles = (l) => ['data/services.json', `data/services.${l}.json`, 'data/smm.json', `data/smm.${l}.json`];

// Every page: its (per-language) path, the files it is built from and its images.
const PAGES = [
  { path: '', src: (l) => ['index.html', i18nFile(l), ...svcFiles(l)], images: [OG_IMAGE, ...projects.map((w) => w.homeImg)] },
  { path: HUB_PATH, src: svcFiles },
  ...servicesIn(DEFAULT_LANG).map((s) => ({ path: s.path, src: svcFiles })),
  { path: 'work/', src: (l) => [projFile(l), i18nFile(l)] },
  ...projects.map((w) => ({ path: w.path, src: (l) => ['data/projects.json', projFile(l)], images: [w.cover.src] })),
  { path: ABOUT_PATH, src: svcFiles },
  { path: CONTACT_PATH, src: svcFiles },
  { path: 'privacy/', src: (l) => [i18nFile(l)] },
];

// ───────────────────────────── per-site files ─────────────────────────────
const AI_BOTS = ['GPTBot', 'OAI-SearchBot', 'ChatGPT-User', 'ClaudeBot', 'Claude-SearchBot', 'Claude-User', 'PerplexityBot', 'Perplexity-User', 'Google-Extended', 'Applebot-Extended', 'Bingbot', 'meta-externalagent', 'cohere-ai'];

for (const [siteKey, site] of Object.entries(SITES)) {
  const langs = LANGS.filter((l) => LOCALES[l].site === siteKey);
  const main = langs.find((l) => LOCALES[l].prefix === '');

  // sitemap.xml — this site's URLs; the alternates may point at the other domain
  const urls = PAGES.flatMap(({ path, src, images = [] }) => langs.filter((l) => pathIn(path, l) !== undefined).map((l) => {
    const ls = langsOf(path);
    const def = ls.includes(DEFAULT_LANG) ? DEFAULT_LANG : ls[0];
    const alt = [...ls.map((x) => `    <xhtml:link rel="alternate" hreflang="${x}" href="${urlIn(x, path)}"/>`),
      `    <xhtml:link rel="alternate" hreflang="x-default" href="${urlIn(def, path)}"/>`].join('\n');
    const img = images.map((u) => `    <image:image><image:loc>${absIn(l, u)}</image:loc></image:image>`).join('\n');
    return `  <url>
    <loc>${urlIn(l, path)}</loc>
    <lastmod>${lastmod(src(l))}</lastmod>
${alt}${img ? '\n' + img : ''}
  </url>`;
  }));
  write(`${site.dir}/sitemap.xml`, `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${urls.join('\n')}
</urlset>
`);

  // robots.txt — everything is public; AI assistants are named so the intent is explicit
  write(`${site.dir}/robots.txt`, `# ${NAME} — search engines and AI assistants are welcome to read and cite this site.
User-agent: *
Allow: /

${AI_BOTS.map((bot) => `User-agent: ${bot}`).join('\n')}
Allow: /

Sitemap: ${site.origin}/sitemap.xml
`);

  // site.webmanifest
  const mm = strings(main).meta;
  write(`${site.dir}/site.webmanifest`, JSON.stringify({
    name: NAME, short_name: NAME, description: mm.description, lang: main, start_url: './', scope: './', display: 'browser',
    theme_color: BG, background_color: BG,
    icons: [
      { src: './assets/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: './assets/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
  }, null, 2) + '\n');

  // llms.txt — in the site's main language, with the other languages linked
  write(`${site.dir}/llms.txt`, llms(main, langs) + '\n');
  console.log(`seo [${site.origin}]: home ${langs.join('+')}, sitemap.xml (${urls.length} URLs), robots.txt, llms.txt, site.webmanifest`);
}

/** SMM packages and portfolio as plain text — prices exactly as on the SMM page. */
function smmBlock(lang) {
  const X = smmText(lang);
  const s = servicesIn(lang).find((x) => x.key === 'smm');
  const P = X.packages;
  const pkgs = SMM.packages.map((p) => `- ${p.name} — ${money(p.price, lang)} ${P.perMonth}${p.priceDailoq ? ` (${P.withD}: ${money(p.priceDailoq, lang)} ${P.perMonth})` : ''}. ${P.items[p.key].tag}: ${P.items[p.key].features.join(', ')}.`);
  const port = SMM.portfolio.map((a) => `- ${a.name} (${X.portfolio.sectors[a.handle]}): https://www.instagram.com/${a.handle}/`);
  return `${s.name}: ${P.eyebrow.toLocaleLowerCase(lang)} — ${s.url}#packages
${pkgs.join('\n')}
- ${P.adNote}
- ${X.terms.items[3].t}: ${X.terms.items[3].d}
- ${X.process.items[0].t}: ${X.process.items[0].d}

## ${X.portfolio.h} (SMM)
${port.join('\n')}`;
}

function llms(lang, siteLangs) {
  const { meta, ui: t } = strings(lang);
  const P = pageText(lang);
  const H = {
    az: { about: 'Şirkət haqqında', services: 'Xidmətlər', work: 'Layihələr', pages: 'Səhifələr', contact: 'Əlaqə', langs: 'Digər dillər', facts: ['Bakıda (Azərbaycan) yerləşən texnologiya, süni intellekt və rəqəmsal marketinq studiyası.', 'Xidmət dilləri: azərbaycan, rus, ingilis.', 'Xidmət bölgəsi: Bakı və bütün Azərbaycan, həmçinin xarici müştərilər.'] },
    en: { about: 'About', services: 'Services', work: 'Selected work', pages: 'Pages', contact: 'Contact', langs: 'Other languages', facts: ['A technology, AI and digital marketing studio based in Baku, Azerbaijan.', 'Working languages: Azerbaijani, Russian, English.', 'Serves Baku and all of Azerbaijan, as well as clients abroad.'] },
    ru: { about: 'О компании', services: 'Услуги', work: 'Проекты', pages: 'Страницы', contact: 'Контакты', langs: 'Другие языки', facts: ['Технологическая, ИИ и digital-маркетинг студия в Баку, Азербайджан.', 'Языки работы: азербайджанский, русский, английский.', 'Работаем по Баку и всему Азербайджану, а также с зарубежными клиентами.'] },
  }[lang];
  const C = P.contact;
  const work = homes[lang].work;
  const extra = siteLangs.filter((l) => l !== lang);
  return `# ${NAME}

> ${meta.description}

## ${H.about}
${H.facts.map((f) => `- ${f}`).join('\n')}
- ${P.about.legalName}: ${LEGAL_NAME} · ${P.about.taxId}: ${TAX_ID}

## ${H.services}
${servicesIn(lang).map((s) => `- [${s.name}](${s.url}): ${s.short}`).join('\n')}

## ${smmBlock(lang)}

## ${H.work}
${work.map((w) => `- [${w.brand}](${w.url}): ${w.headline}. ${w.subtitle} [${w.scope}, ${w.year}]`).join('\n')}

## ${H.pages}
- [${P.hub.h1}](${urlIn(lang, HUB_PATH)})
- [${t.work}](${urlIn(lang, 'work/')})
- [${t.about}](${urlIn(lang, ABOUT_PATH)})
- [${t.contact}](${urlIn(lang, CONTACT_PATH)})
${extra.map((l) => `- ${LOCALES[l].label}: ${urlIn(l)}`).join('\n')}

## ${H.contact}
- ${C.phone}: ${PHONE} (${C.whatsapp})
- ${C.email}: ${EMAIL}
- ${C.address}: ${C.addressValue} — ${MAPS}
- Instagram: ${INSTAGRAM}
- LinkedIn: ${LINKEDIN}

## ${H.langs}
${LANGS.filter((l) => !siteLangs.includes(l)).map((l) => `- ${LOCALES[l].label}: ${urlIn(l)} (${urlIn(l, 'llms.txt')})`).join('\n')}`;
}
