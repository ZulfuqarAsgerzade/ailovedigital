#!/usr/bin/env node
// Builds every static page into dist/<site>/ (see SITES in scripts/lib/site.mjs and LOCALES in scripts/lib/i18n.mjs):
//
//   work/                       the "all projects" hub
//   work/<slug>/                one static case-study page per project (data/projects*.json)
//   services hub + 7 services   /xidmetler/…  /services/…  /ru/uslugi/…   (data/services*.json)
//   about, contact              /haqqimizda/ /elaqe/ · /about/ /contact/ · /ru/o-nas/ /ru/kontakty/
//   privacy/                    the privacy policy (i18n/<lang>.json → "privacy")
//   404.html                    one per site, in that site's main language
//   static files                assets/, css/, js/, vendor/, favicon.ico copied into each site
//
// and refreshes the `workAll` array between // workAll:start … // workAll:end in index.html (the home page
// itself is built by build-seo.mjs, which runs next). Plain HTML, no JavaScript needed to read any of it —
// which is what search engines and AI crawlers want.
//
//   npm run build        or        node scripts/build-work.mjs && node scripts/build-seo.mjs

import { rmSync, cpSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import {
  ROOT, SITES, ORG_ID, NAME, EMAIL, PHONE, PHONE_TEL, INSTAGRAM, LINKEDIN, WHATSAPP, MAPS, BG, OG_IMAGE, GSC_VERIFICATION, BING_VERIFICATION, DAILOQ_WIDGET,
  LEGAL_NAME, TAX_ID, LEGAL_ADDRESS, read, write, esc, pad2, clip, loadProjects,
} from './lib/site.mjs';
import {
  LANGS, LOCALES, strings, fill, localizeProjects, langMenu, hreflangLinks, ogLocaleTags, urlIn, absIn, outFile, backTo,
  hrefTo, pathIn, workDataLiteral, originOf,
} from './lib/i18n.mjs';
import {
  pageText, servicesIn, servicesForCase, orgNode, websiteNode, serviceNode, faqNode, crumbsNode, grabArray, translatedSource,
  HUB_PATH, ABOUT_PATH, CONTACT_PATH, SMM, smmText, smmServiceNode, money,
} from './lib/pages.mjs';

const projects = loadProjects();
const today = new Date().toISOString().slice(0, 10);

// ───────────────────────────── dist/ + static files ─────────────────────────────
const STATIC = ['assets', 'css', 'js', 'vendor', 'favicon.ico', 'BingSiteAuth.xml', 'a9a8e413c53835d9785a320600695f9d.txt']; // at each site's root: Bing Webmaster verification; IndexNow key (scripts/lib/site.mjs INDEXNOW_KEY)
for (const site of Object.values(SITES)) {
  rmSync(join(ROOT, site.dir), { recursive: true, force: true });
  for (const f of STATIC) if (existsSync(join(ROOT, f))) cpSync(join(ROOT, f), join(ROOT, site.dir, f), { recursive: true });
}

// ───────────────────────────── shared page pieces ─────────────────────────────
const HEART = (w, h) => `<svg width="${w}" height="${h}" viewBox="0 0 21 18" aria-hidden="true"><g fill="#FF304D"><rect x="3" y="0" width="3" height="3"/><rect x="6" y="0" width="3" height="3"/><rect x="12" y="0" width="3" height="3"/><rect x="15" y="0" width="3" height="3"/><rect x="0" y="3" width="21" height="3"/><rect x="0" y="6" width="21" height="3"/><rect x="3" y="9" width="15" height="3"/><rect x="6" y="12" width="9" height="3"/><rect x="9" y="15" width="3" height="3"/></g></svg>`;

const jsonLdTag = (graph) =>
  `<script type="application/ld+json">\n${JSON.stringify({ '@context': 'https://schema.org', '@graph': graph }, null, 2).replace(/<\//g, '<\\/')}\n</script>`;

/** Link from a page of `lang` (root `b`) to `path` on the same site. */
const L = (lang, b, path = '') => `${b}${LOCALES[lang].prefix}${pathIn(path, lang)}` || './';
/** Every language's version of this page; a language without the page gets its home page. */
const langLinks = (lang, b, path) =>
  Object.fromEntries(LANGS.map((l) => [l, hrefTo(lang, l, pathIn(path, l) === undefined ? '' : path, b)]));
const webPageRef = (lang) => ({ '@id': `${originOf(lang)}/#website` });

function head({ b, lang, path, title, description, canonical, image, imageType, imageAlt, graph, robots = 'index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1' }) {
  return `<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
${canonical ? `<link rel="canonical" href="${canonical}">\n` : ''}${path !== null ? hreflangLinks(path) + '\n' : ''}<meta name="robots" content="${robots}">
<meta name="author" content="${NAME}">
<meta name="google-site-verification" content="${GSC_VERIFICATION}">
<meta name="msvalidate.01" content="${BING_VERIFICATION}">
<meta name="theme-color" content="${BG}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="${NAME}">
${ogLocaleTags(lang)}
${canonical ? `<meta property="og:url" content="${canonical}">\n` : ''}<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:image" content="${image}">
<meta property="og:image:type" content="${imageType}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="${esc(imageAlt)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(description)}">
<meta name="twitter:image" content="${image}">
<meta name="twitter:image:alt" content="${esc(imageAlt)}">
<link rel="icon" href="${b}assets/icons/favicon.svg" type="image/svg+xml">
<link rel="icon" href="${b}assets/icons/favicon-32.png" sizes="32x32" type="image/png">
<link rel="icon" href="${b}assets/icons/favicon-48.png" sizes="48x48" type="image/png">
<link rel="shortcut icon" href="${b}favicon.ico">
<link rel="apple-touch-icon" href="${b}assets/icons/apple-touch-icon.png">
<link rel="manifest" href="${b}site.webmanifest">
<link rel="preload" as="font" type="font/woff2" href="${b}assets/fonts/geist-latin.woff2" crossorigin>
<link rel="stylesheet" href="${b}css/fonts.css">
<script>document.documentElement.classList.add('has-js')</script>
<link rel="stylesheet" href="${b}css/style.css">
<link rel="stylesheet" href="${b}css/case.css">
${graph ? jsonLdTag(graph) + '\n' : ''}<script src="${b}js/case.js" defer></script>
</head>`;
}

/** `current`: 'services' | 'work' | 'about' | 'contact' | null — the nav item to mark as the current section. */
function nav({ lang, b, current, langHrefs }) {
  const t = strings(lang).ui;
  const h = L(lang, b);
  const items = [
    ['services', L(lang, b, HUB_PATH), t.services],
    ['work', L(lang, b, 'work/'), t.work],
    ['process', `${h}#process`, t.process],
    ['about', L(lang, b, ABOUT_PATH), t.about],
    ['contact', L(lang, b, CONTACT_PATH), t.contact],
  ];
  const desk = items.map(([k, href, label]) => `<a href="${href}" class="ald-navlink${k === current ? ' is-active" aria-current="page' : ''}">${label}</a>`).join('\n    ');
  return `<a class="ald-skip" href="#main">${t.skip}</a>
<nav class="ald-nav is-solid" aria-label="${esc(t.navPrimary)}">
  <a href="${h}" class="ald-brand" aria-label="${NAME} — ${esc(t.homeLabel)}">${HEART(21, 18)}<span>${NAME}</span></a>
  <div class="ald-nav-desk">
    ${desk}
  </div>
  <div class="ald-nav-actions">
    ${langMenu(lang, langHrefs)}
    <a href="${L(lang, b, CONTACT_PATH)}" class="ald-btn ald-btn--sm ald-nav-cta">${t.startSomething} <span class="ald-dot">♥</span></a>
    <button type="button" class="ald-burger" aria-label="${esc(t.openMenu)}" data-label-open="${esc(t.openMenu)}" data-label-close="${esc(t.closeMenu)}" aria-expanded="false" aria-controls="menu"><span></span><span></span></button>
  </div>
  <div class="ald-prog" aria-hidden="true"></div>
</nav>
<div class="ald-menu" id="menu" role="dialog" aria-modal="true" aria-label="${esc(t.menu)}" hidden>
  <div class="ald-menu-links">
    ${items.map(([, href, label]) => `<a href="${href}">${label}</a>`).join('\n    ')}
  </div>
  <div class="ald-menu-foot">
    <a href="${L(lang, b, CONTACT_PATH)}" class="ald-btn ald-btn--fit">${t.startSomething} <span class="ald-dot">♥</span></a>
    <a href="mailto:${EMAIL}">${EMAIL}</a>
  </div>
</div>`;
}

function footer({ lang, b }) {
  const { ui: t, meta } = strings(lang);
  const h = L(lang, b);
  return `<footer class="ald-footer">
  <div class="ald-wrap">
    <div class="ald-foot-grid">
      <div>
        <a href="${h}" class="ald-brand ald-brand--foot" aria-label="${NAME} — ${esc(t.homeLabel)}">${HEART(17, 15)}<span>${NAME}</span></a>
        <p class="ald-foot-list ald-foot-list--narrow">${t.footerBlurb}</p>
      </div>
      <div>
        <div class="ald-foot-h">${t.footServices}</div>
        <div class="ald-foot-list">${servicesIn(lang).map((s) => `<a href="${L(lang, b, s.path)}">${esc(s.name)}</a>`).join('')}</div>
      </div>
      <div>
        <div class="ald-foot-h">${t.footCompany}</div>
        <div class="ald-foot-list"><a href="${L(lang, b, 'work/')}">${t.work}</a><a href="${L(lang, b, ABOUT_PATH)}">${t.about}</a><a href="${L(lang, b, CONTACT_PATH)}">${t.contact}</a><a href="${L(lang, b, 'privacy/')}">${t.privacyPolicy}</a></div>
      </div>
      <div>
        <div class="ald-foot-h">${t.footContact}</div>
        <div class="ald-foot-list"><a href="mailto:${EMAIL}">${EMAIL}</a><a href="tel:${PHONE_TEL}">${PHONE}</a><a href="${MAPS}" target="_blank" rel="noopener">${t.address}</a><a href="${INSTAGRAM}" target="_blank" rel="noopener">Instagram</a><a href="${LINKEDIN}" target="_blank" rel="noopener">LinkedIn</a><a href="${WHATSAPP}" target="_blank" rel="noopener">WhatsApp</a></div>
      </div>
    </div>
    <div class="ald-foot-mark" aria-hidden="true">AILOVEDIGITAL<span class="ald-dot">.</span></div>
    <div class="ald-foot-bottom">
      <span>© 2026 ${NAME} · ${esc(LEGAL_NAME)}</span>
      <span>${meta.slogan}</span>
      <a href="#main" class="ald-totop">${t.backToTop}</a>
    </div>
  </div>
</footer>`;
}

const page = ({ lang, headHtml, main, b, current = null, langHrefs }) => `<!doctype html>
<!-- Generated by scripts/build-work.mjs from data/*.json and i18n/*.json — edit those or the script, not this file. -->
<html lang="${lang}">
${headHtml}
<body class="case">
${nav({ lang, b, current, langHrefs })}
<main id="main">
${main}
</main>
${footer({ lang, b })}
${DAILOQ_WIDGET}
</body>
</html>
`;

// Brand and technology names are Latin words: upper-cased by CSS on a page in Azerbaijani they would gain a
// dotted İ ("VİCDOOR", "FİREBASE"). Plain-ASCII names are marked lang="en"; text with Azerbaijani letters keeps
// the page language.
const name = (s) => (/^[\x00-\x7F]*$/.test(s) ? `<span lang="en">${esc(s)}</span>` : esc(s));
const nameAttr = (s) => (/^[\x00-\x7F]*$/.test(s) ? ' lang="en"' : '');

const ctaBlock = (lang, b, { h2, sub, extra = '' }) => {
  const t = strings(lang).ui;
  return `<section class="ald-sec ald-sec--dark case-cta">
  <div class="ald-wrap">
    <h2 class="ald-contact-h">${h2}</h2>
    <p class="ald-contact-s">${sub} <span class="ald-dot">♥</span></p>
    <div class="case-cta-actions">
      <a href="${L(lang, b, CONTACT_PATH)}" class="ald-btn">${t.startSomething} <span class="ald-dot">♥</span></a>
      <a href="mailto:${EMAIL}" class="ald-contact-mail">${EMAIL}</a>
      <a href="tel:${PHONE_TEL}" class="ald-contact-mail">${PHONE}</a>${extra}
    </div>
  </div>
</section>`;
};

const crumbsNav = (lang, items) => `<nav class="case-crumbs" aria-label="${esc(strings(lang).ui.crumbs)}">
      <ol>${items.map(([label, href]) => (href ? `<li><a href="${href}">${label}</a></li>` : `<li aria-current="page">${label}</li>`)).join('')}</ol>
    </nav>`;

// ───────────── shared project card (hub + "related projects") ─────────────
const hubCard = (p, b, lang, eager, level = 3) => `    <li class="hub-card case-rv">
      <div class="hub-media"><img src="${b}${p.homeImg}" width="800" height="500" alt="${esc(p.coverAlt)}" loading="${eager ? 'eager' : 'lazy'}" decoding="async"></div>
      <div class="hub-body">
        <span class="ald-work-num">${pad2(p.n)}</span>
        <h${level} class="hub-name"><a href="${L(lang, b, p.path)}" class="hub-link"${nameAttr(p.brand)}>${esc(p.brand)}</a></h${level}>
        <p class="hub-line">${esc(p.line)}</p>
        <p class="hub-meta">${esc(p.scope)} · ${esc(p.year)}</p>
      </div>
    </li>`;

/** Same-scope projects first, then the following ones in order — three, never the project itself.
 *  Grouped on the English data so every language shows the same three; returned from `list`. */
function relatedFor(p, list) {
  const base = projects[p.n - 1]; // compare English scopes: `p` may be a translated project
  const others = projects.filter((x) => x.slug !== p.slug);
  const same = others.filter((x) => x.scope === base.scope);
  const rest = others.filter((x) => x.scope !== p.scope).sort((a, b) => ((a.n - p.n + projects.length) % projects.length) - ((b.n - p.n + projects.length) % projects.length));
  return [...same, ...rest].slice(0, 3).map((x) => list[x.n - 1]);
}

// ───────────────────────────── case-study page ─────────────────────────────
/** "ChefMarket — Restaurant–supplier B2B marketplace ecosystem | AILoveDigital", kept near the ~60
 *  characters search results show: the leading article goes, and the site name goes if still too long. */
function pageTitle(p) {
  const core = `${p.brand} — ${p.headline.replace(/^(A|An)\s+/, '').replace(/^./, (c) => c.toLocaleUpperCase(p.lang || 'en'))}`;
  return core.length + NAME.length + 3 <= 66 ? `${core} | ${NAME}` : core;
}

function casePage(p, i, list, lang) {
  const t = strings(lang).ui;
  const st = pageText(lang).ui;
  const b = backTo(lang, p.path);
  const h = L(lang, b);
  const prev = list[(i - 1 + list.length) % list.length];
  const next = list[(i + 1) % list.length];
  const title = pageTitle(p);
  const description = clip(p.overview, 156);
  const image = absIn(lang, p.og);
  const keywords = [...new Set(p.stack.flatMap((g) => g.v))];
  const svcs = servicesForCase(p.slug, lang);

  const graph = [
    orgNode(lang),
    websiteNode(lang),
    crumbsNode(p.url, [[t.home, urlIn(lang)], [t.work, urlIn(lang, 'work/')], [p.brand, p.url]]),
    {
      '@type': 'WebPage', '@id': `${p.url}#webpage`, url: p.url, name: title, description, inLanguage: lang,
      isPartOf: webPageRef(lang), breadcrumb: { '@id': `${p.url}#breadcrumb` },
      primaryImageOfPage: { '@type': 'ImageObject', url: absIn(lang, p.cover.src), width: p.cover.w, height: p.cover.h },
      mainEntity: { '@id': `${p.url}#project` }, dateModified: today,
    },
    {
      '@type': 'CreativeWork', '@id': `${p.url}#project`, url: p.url, mainEntityOfPage: { '@id': `${p.url}#webpage` },
      name: p.brand, headline: p.headline, abstract: p.subtitle, description: p.overview,
      genre: p.scope, dateCreated: p.year, inLanguage: lang, keywords: keywords.join(', '),
      creator: { '@id': ORG_ID }, publisher: { '@id': ORG_ID },
      image: absIn(lang, p.cover.src),
      ...(svcs.length ? { about: svcs.map((s) => ({ '@id': `${s.url}#service` })) } : {}),
    },
  ];

  const meta = [[t.year, p.year], [t.scope, p.scope], ...(p.time ? [[t.timeline, p.time]] : []),
    ...(svcs.length ? [[st.servicesUsed, svcs.map((s) => `<a href="${L(lang, b, s.path)}" class="case-svc-link">${esc(s.name)}</a>`).join(', '), true]] : [])]
    .map(([k, v, raw]) => `<div><dt>${k}</dt><dd>${raw ? v : esc(v)}</dd></div>`).join('');

  const main = `
<header class="case-hero">
  <div class="ald-wrap">
    ${crumbsNav(lang, [[t.home, h], [t.work, '../'], [name(p.brand)]])}
    <p class="ald-eyebrow has-idx"><span class="ald-idx">${pad2(p.n)}</span> / ${esc(p.scope)}</p>
    <h1 class="case-h1"><span class="case-title"${nameAttr(p.brand)}>${esc(p.brand)}</span><span class="sr-only"> — </span><span class="case-headline">${esc(p.headline)}</span></h1>
    <p class="ald-lead case-sub">${esc(p.subtitle)}</p>
    <dl class="ald-work-meta case-meta">${meta}</dl>
  </div>
</header>

<div class="case-cover">
  <img src="${b}${p.cover.src}" width="${p.cover.w}" height="${p.cover.h}" alt="${esc(p.coverAlt)}" fetchpriority="high" decoding="async">
</div>

<section class="ald-stats-band" aria-label="${esc(fill(t.inNumbers, { brand: p.brand }))}">
  <ul class="ald-wrap ald-stats case-metrics">
${p.metrics.map((m) => `    <li class="ald-stat"><div class="ald-stat-n">${esc(m.v)}</div><div class="ald-stat-l">${esc(m.l)}</div></li>`).join('\n')}
  </ul>
</section>

<section class="ald-sec">
  <div class="ald-wrap">
    <div class="case-block case-rv">
      <h2 class="ald-eyebrow has-idx case-label"><span class="ald-idx">01</span> / ${t.overview}</h2>
      <p class="case-text case-text--lead">${esc(p.overview)}</p>
    </div>
    <div class="case-block case-rv">
      <h2 class="ald-eyebrow has-idx case-label"><span class="ald-idx">02</span> / ${t.problem}</h2>
      <p class="case-text">${esc(p.problem)}</p>
    </div>
    <div class="case-block case-rv">
      <h2 class="ald-eyebrow has-idx case-label"><span class="ald-idx">03</span> / ${t.approach}</h2>
      <p class="case-text">${esc(p.approach)}</p>
    </div>
  </div>
</section>

<section class="ald-sec ald-sec--dark">
  <div class="ald-wrap">
    <div class="case-block case-rv">
      <h2 class="ald-eyebrow has-idx case-label"><span class="ald-idx">04</span> / ${t.result}</h2>
      <p class="case-text case-text--result">${esc(p.result)}</p>
    </div>
  </div>
</section>

<section class="ald-sec" aria-labelledby="features">
  <div class="ald-wrap">
    <header class="ald-head case-rv">
      <div>
        <p class="ald-eyebrow has-idx"><span class="ald-idx">05</span> / ${t.keyFeatures}</p>
        <h2 class="ald-h2" id="features">${t.whatItDoes}<span class="ald-dot">.</span></h2>
      </div>
    </header>
    <ul class="case-features">
${p.features.map((f, k) => `      <li class="ald-value case-rv"><div class="case-feature-n">${pad2(k + 1)}</div><h3 class="ald-value-t">${esc(f.t)}</h3><p class="ald-value-d">${esc(f.d)}</p></li>`).join('\n')}
    </ul>
  </div>
</section>

<section class="ald-sec ald-sec--alt" aria-labelledby="architecture">
  <div class="ald-wrap">
    <header class="ald-head case-rv">
      <div>
        <p class="ald-eyebrow has-idx"><span class="ald-idx">06</span> / ${t.architecture}</p>
        <h2 class="ald-h2" id="architecture">${t.howBuilt}<span class="ald-dot">.</span></h2>
      </div>
    </header>
    <ol class="case-arch">
${p.architecture.map((a) => `      <li class="case-rv"><h3>${esc(a.t)}</h3><p>${esc(a.d)}</p></li>`).join('\n')}
    </ol>
    <header class="ald-head case-head-2 case-rv">
      <div>
        <p class="ald-eyebrow has-idx"><span class="ald-idx">07</span> / ${t.technology}</p>
        <h2 class="ald-h2" id="stack">${t.techStack}<span class="ald-dot">.</span></h2>
      </div>
    </header>
    <dl class="case-stack" aria-labelledby="stack">
${p.stack.map((g) => `      <div class="case-rv"><dt>${esc(g.k)}</dt><dd><ul class="ald-chips">${g.v.map((x) => `<li class="ald-chip"${nameAttr(x)}>${esc(x)}</li>`).join('')}</ul></dd></div>`).join('\n')}
    </dl>
  </div>
</section>

<section class="ald-sec" aria-labelledby="related">
  <div class="ald-wrap">
    <header class="ald-head case-rv">
      <div>
        <p class="ald-eyebrow has-idx"><span class="ald-idx">08</span> / ${t.moreWork}</p>
        <h2 class="ald-h2" id="related">${t.related}<span class="ald-dot">.</span></h2>
      </div>
      <p class="ald-lead">${esc(fill(t.relatedLead, { scope: p.scope, scopeLower: p.scope.toLocaleLowerCase(lang) }))}</p>
    </header>
    <ol class="hub-grid case-related">
${relatedFor(p, list).map((r) => hubCard(r, b, lang, false)).join('\n')}
    </ol>
  </div>
</section>

<nav class="case-pager" aria-label="${esc(t.morePager)}">
  <a href="${L(lang, b, prev.path)}" rel="prev"><span class="case-pager-k">${t.prev}</span><span class="case-pager-n"${nameAttr(prev.brand)}>${esc(prev.brand)}</span></a>
  <a href="${L(lang, b, next.path)}" rel="next"><span class="case-pager-k">${t.next}</span><span class="case-pager-n"${nameAttr(next.brand)}>${esc(next.brand)}</span></a>
</nav>

${ctaBlock(lang, b, { h2: t.ctaSimilar, sub: t.ctaReal, extra: `\n      <a href="../" class="ald-link">${t.allProjects}</a>` })}`;

  return page({
    lang, b, current: 'work', langHrefs: langLinks(lang, b, p.path),
    headHtml: head({ b, lang, path: p.path, title, description, canonical: p.url, image, imageType: 'image/jpeg', imageAlt: p.coverAlt, graph }),
    main,
  });
}

// ───────────────────────────── /work/ hub ─────────────────────────────
function hubPage(list, lang) {
  const t = strings(lang).ui;
  const b = backTo(lang, 'work/');
  const url = urlIn(lang, 'work/');
  const scopes = [...new Set(list.map((p) => p.scope))];
  const n = list.length;
  const title = fill(t.hubTitle, { n, name: NAME });
  const description = clip(fill(t.hubDescription, { n, name: NAME, scopes: lang === 'en' ? scopes.join(', ').toLowerCase() : scopes.join(', ') }), 158);
  const graph = [
    orgNode(lang), websiteNode(lang),
    crumbsNode(url, [[t.home, urlIn(lang)], [t.work, url]]),
    {
      '@type': 'CollectionPage', '@id': `${url}#webpage`, url, name: title, description, inLanguage: lang,
      isPartOf: webPageRef(lang), breadcrumb: { '@id': `${url}#breadcrumb` },
      primaryImageOfPage: { '@type': 'ImageObject', url: absIn(lang, OG_IMAGE), width: 1200, height: 630 },
      mainEntity: { '@id': `${url}#projects` }, dateModified: today,
    },
    {
      '@type': 'ItemList', '@id': `${url}#projects`, name: t.selectedWork, numberOfItems: n,
      itemListElement: list.map((p) => ({ '@type': 'ListItem', position: p.n, url: p.url, name: p.brand })),
    },
  ];
  const cards = list.map((p) => hubCard(p, b, lang, p.n <= 3, 2)).join('\n');

  const main = `
<header class="case-hero">
  <div class="ald-wrap">
    ${crumbsNav(lang, [[t.home, L(lang, b)], [t.work]])}
    <p class="ald-eyebrow has-idx"><span class="ald-idx">03</span> / ${t.selectedWork}</p>
    <h1 class="case-h1"><span class="case-title case-title--hub">${t.hubH1}</span></h1>
    <p class="ald-lead case-sub">${fill(t.hubLead, { n, m: scopes.length })}</p>
  </div>
</header>
<section class="ald-sec hub-sec" aria-label="${esc(t.allProjectsLabel)}">
  <div class="ald-wrap">
    <ol class="hub-grid">
${cards}
    </ol>
  </div>
</section>
${ctaBlock(lang, b, { h2: t.hubCtaH, sub: t.hubCtaS })}`;

  return page({
    lang, b, current: 'work', langHrefs: langLinks(lang, b, 'work/'),
    headHtml: head({ b, lang, path: 'work/', title, description, canonical: url, image: absIn(lang, OG_IMAGE), imageType: 'image/png', imageAlt: t.hubOgAlt, graph }),
    main,
  });
}

// ───────────────────────────── services ─────────────────────────────
const svcCard = (s, lang, b, level = 3) => `    <li class="svc-card case-rv">
      <h${level} class="svc-card-t"><a href="${L(lang, b, s.path)}" class="hub-link">${esc(s.name)}</a></h${level}>
      <p class="svc-card-d">${esc(s.short)}</p>
      <span class="svc-card-more" aria-hidden="true">${esc(pageText(lang).ui.more)}</span>
    </li>`;

function servicesHubPage(lang) {
  const t = strings(lang).ui;
  const P = pageText(lang).hub;
  const b = backTo(lang, HUB_PATH);
  const url = urlIn(lang, HUB_PATH);
  const svcs = servicesIn(lang);
  const graph = [
    orgNode(lang), websiteNode(lang),
    crumbsNode(url, [[t.home, urlIn(lang)], [P.h1, url]]),
    {
      '@type': 'CollectionPage', '@id': `${url}#webpage`, url, name: P.title, description: P.description, inLanguage: lang,
      isPartOf: webPageRef(lang), about: { '@id': ORG_ID }, breadcrumb: { '@id': `${url}#breadcrumb` },
      mainEntity: { '@type': 'ItemList', numberOfItems: svcs.length, itemListElement: svcs.map((s, i) => ({ '@type': 'ListItem', position: i + 1, url: s.url, name: s.name })) },
    },
  ];
  const main = `
<header class="case-hero">
  <div class="ald-wrap">
    ${crumbsNav(lang, [[t.home, L(lang, b)], [P.h1]])}
    <p class="ald-eyebrow">${esc(P.eyebrow)}</p>
    <h1 class="case-h1"><span class="case-title case-title--hub">${esc(P.h1)}<span class="ald-dot">.</span></span></h1>
    <p class="ald-lead case-sub">${esc(P.lead)}</p>
  </div>
</header>
<section class="ald-sec hub-sec">
  <div class="ald-wrap">
    <ul class="svc-grid">
${svcs.map((s) => svcCard(s, lang, b, 2)).join('\n')}
    </ul>
  </div>
</section>
${ctaBlock(lang, b, { h2: pageText(lang).ui.ctaH, sub: pageText(lang).ui.ctaS })}`;
  return page({
    lang, b, current: 'services', langHrefs: langLinks(lang, b, HUB_PATH),
    headHtml: head({ b, lang, path: HUB_PATH, title: P.title, description: P.description, canonical: url, image: absIn(lang, OG_IMAGE), imageType: 'image/png', imageAlt: strings(lang).meta.ogAlt, graph }),
    main,
  });
}

const sectionHead = (idx, eyebrow, h2, id, lead = '') => `<header class="ald-head case-rv">
      <div>
        <p class="ald-eyebrow has-idx"><span class="ald-idx">${idx}</span> / ${esc(eyebrow)}</p>
        <h2 class="ald-h2" id="${id}">${esc(h2)}<span class="ald-dot">.</span></h2>
      </div>${lead ? `\n      <p class="ald-lead">${esc(lead)}</p>` : ''}
    </header>`;

function servicePage(s, lang, list) {
  if (s.key === 'smm') return smmPage(s, lang, list);
  const t = strings(lang).ui;
  const U = pageText(lang).ui;
  const b = backTo(lang, s.path);
  const url = s.url;
  const steps = grabArray(translatedSource(lang), 'steps');
  const cases = s.cases.map((slug) => list.find((p) => p.slug === slug)).filter(Boolean);
  const others = servicesIn(lang).filter((x) => x.key !== s.key);
  const hubName = pageText(lang).hub.h1;
  let n = 0;
  const idx = () => pad2(++n);

  const graph = [
    orgNode(lang), websiteNode(lang),
    crumbsNode(url, [[t.home, urlIn(lang)], [hubName, urlIn(lang, HUB_PATH)], [s.name, url]]),
    {
      '@type': 'WebPage', '@id': `${url}#webpage`, url, name: s.title, description: s.description, inLanguage: lang,
      isPartOf: webPageRef(lang), breadcrumb: { '@id': `${url}#breadcrumb` }, mainEntity: { '@id': `${url}#service` },
      primaryImageOfPage: { '@type': 'ImageObject', url: absIn(lang, OG_IMAGE), width: 1200, height: 630 }, dateModified: today,
    },
    serviceNode(s, lang),
    faqNode(url, s.faq),
  ];

  const main = `
<header class="case-hero">
  <div class="ald-wrap">
    ${crumbsNav(lang, [[t.home, L(lang, b)], [esc(hubName), L(lang, b, HUB_PATH)], [esc(s.name)]])}
    <p class="ald-eyebrow">${esc(U.servicesNav)}</p>
    <h1 class="case-h1"><span class="case-title case-title--hub svc-h1">${esc(s.h1)}<span class="ald-dot">.</span></span></h1>
    <p class="ald-lead case-sub">${esc(s.lead)}</p>
    <div class="case-cta-actions"><a href="${L(lang, b, CONTACT_PATH)}" class="ald-btn">${t.startSomething} <span class="ald-dot">♥</span></a><a href="${WHATSAPP}" class="ald-link" target="_blank" rel="noopener">WhatsApp: ${PHONE}</a></div>
  </div>
</header>

<section class="ald-sec svc-intro">
  <div class="ald-wrap">
${s.intro.map((p, k) => `    <p class="case-text${k === 0 ? ' case-text--lead' : ''} case-rv">${esc(p)}</p>`).join('\n')}
  </div>
</section>

<section class="ald-sec ald-sec--alt" aria-labelledby="includes">
  <div class="ald-wrap">
    ${sectionHead(idx(), U.includesEyebrow, U.includesH, 'includes')}
    <ul class="case-features">
${s.includes.map((f, k) => `      <li class="ald-value case-rv"><div class="case-feature-n">${pad2(k + 1)}</div><h3 class="ald-value-t">${esc(f.t)}</h3><p class="ald-value-d">${esc(f.d)}</p></li>`).join('\n')}
    </ul>
  </div>
</section>

<section class="ald-sec" aria-labelledby="process">
  <div class="ald-wrap">
    ${sectionHead(idx(), U.processEyebrow, U.processH, 'process')}
    <ol class="case-arch">
${steps.map((x, k) => `      <li class="case-rv"><h3>${pad2(k + 1)} — ${esc(x.t)}</h3><p>${esc(x.d)}</p></li>`).join('\n')}
    </ol>
  </div>
</section>
${cases.length ? `
<section class="ald-sec ald-sec--alt" aria-labelledby="cases">
  <div class="ald-wrap">
    ${sectionHead(idx(), U.casesEyebrow, U.casesH, 'cases')}
    <ol class="hub-grid case-related">
${cases.slice(0, 6).map((p) => hubCard(p, b, lang, false)).join('\n')}
    </ol>
  </div>
</section>
` : ''}
<section class="ald-sec" aria-labelledby="pricing">
  <div class="ald-wrap">
    ${sectionHead(idx(), U.pricingEyebrow, U.pricingH, 'pricing', s.pricing.p)}
    <ul class="svc-list">
${s.pricing.items.map((x) => `      <li class="case-rv">${esc(x)}</li>`).join('\n')}
    </ul>
  </div>
</section>

<section class="ald-sec ald-sec--alt" aria-labelledby="why">
  <div class="ald-wrap">
    ${sectionHead(idx(), U.whyEyebrow, U.whyH, 'why')}
    <ul class="case-features">
${U.why.map((f) => `      <li class="ald-value case-rv"><h3 class="ald-value-t">${esc(f.t)}</h3><p class="ald-value-d">${esc(f.d)}</p></li>`).join('\n')}
    </ul>
  </div>
</section>

<section class="ald-sec" aria-labelledby="faq">
  <div class="ald-wrap">
    ${sectionHead(idx(), U.faqEyebrow, U.faqH, 'faq')}
    <div class="svc-faq">
${s.faq.map((f, k) => `      <details class="case-rv"${k === 0 ? ' open' : ''}><summary><h3>${esc(f.q)}</h3></summary><p>${esc(f.a)}</p></details>`).join('\n')}
    </div>
  </div>
</section>

<section class="ald-sec ald-sec--alt" aria-labelledby="other">
  <div class="ald-wrap">
    ${sectionHead(idx(), U.otherEyebrow, U.otherH, 'other')}
    <ul class="svc-grid">
${others.map((x) => svcCard(x, lang, b)).join('\n')}
    </ul>
  </div>
</section>

${ctaBlock(lang, b, { h2: U.ctaH, sub: U.ctaS })}`;

  return page({
    lang, b, current: 'services', langHrefs: langLinks(lang, b, s.path),
    headHtml: head({ b, lang, path: s.path, title: s.title, description: s.description, canonical: url, image: absIn(lang, OG_IMAGE), imageType: 'image/png', imageAlt: strings(lang).meta.ogAlt, graph }),
    main,
  });
}

// ───────────────────────────── SMM: packages page ─────────────────────────────
// The SMM service gets its own long-form page: the package offer from data/smm*.json (source: the SMM
// packages PDF), the portfolio of Instagram accounts we run, terms, add-ons and FAQ. Every "choose" button
// opens WhatsApp with the package name already typed.
const wa = (text) => `${WHATSAPP}?text=${encodeURIComponent(text)}`;
const igUrl = (handle) => `https://www.instagram.com/${handle}/`;

/** First existing assets/images/smm/<base>.(webp|png|jpg|jpeg), or null. */
const smmImage = (base) => ['webp', 'png', 'jpg', 'jpeg'].map((x) => `assets/images/smm/${base}.${x}`).find((f) => existsSync(join(ROOT, f))) || null;

// Media area of a portfolio card, best available first: a profile screenshot, the brand logo large on the
// brand colour, or (until either is added) an abstract grid in the brand colours.
function igCard(a, M, b) {
  const [bg, fg, c1, c2, c3] = a.colors;
  const shot = smmImage(a.handle);
  const logo = smmImage(`${a.handle}-logo`);
  const tiles = [c1, fg, c2, c3, c1, bg, c2, fg, c3];
  const media = shot
    ? `<img src="${b}${shot}" width="720" height="900" alt="${esc(`${a.name} — Instagram`)}" loading="lazy" decoding="async">`
    : logo
      ? `<span class="smm-ig-logo" style="background:${bg}"><img src="${b}${logo}" width="320" height="320" alt="${esc(`${a.name} logo`)}" loading="lazy" decoding="async"></span>`
      : `<div class="smm-ig-grid" aria-hidden="true">${tiles.map((c, k) => `<span style="background:${c}">${k === 1 ? `<b style="color:${bg}">${esc(a.mono)}</b>` : k === 4 ? `<i style="border-left-color:${bg}"></i>` : ''}</span>`).join('')}</div>`;
  const avatar = logo
    ? `<span class="smm-ig-av" style="background:${bg}" aria-hidden="true"><img src="${b}${logo}" width="76" height="76" alt="" loading="lazy" decoding="async"></span>`
    : `<span class="smm-ig-av" style="background:${bg};color:${fg}" aria-hidden="true">${esc(a.mono)}</span>`;
  const grid = media;
  return `      <li class="smm-ig case-rv">
        <a href="${igUrl(a.handle)}" target="_blank" rel="noopener" class="smm-ig-link">
          <span class="smm-ig-top">${avatar}<span class="smm-ig-id"><span class="smm-ig-name"${nameAttr(a.name)}>${esc(a.name)}</span><span class="smm-ig-handle" lang="en">@${esc(a.handle)}</span></span></span>
          <span class="smm-ig-media">${grid}</span>
          <span class="smm-ig-foot"><span class="smm-ig-sector">${esc(M.sectors[a.handle])}</span><span class="smm-ig-view">${esc(M.view)} ↗</span></span>
        </a>
      </li>`;
}

function smmPage(s, lang, list) {
  const t = strings(lang).ui;
  const U = pageText(lang).ui;
  const X = smmText(lang);
  const b = backTo(lang, s.path);
  const url = s.url;
  const hubName = pageText(lang).hub.h1;
  const svcPath = (key) => servicesIn(lang).find((x) => x.key === key)?.path;
  const others = servicesIn(lang).filter((x) => x.key !== s.key);
  const P = X.packages;
  const fmt = (n) => money(n, lang);
  let n = 0;
  const idx = () => pad2(++n);

  const graph = [
    orgNode(lang), websiteNode(lang),
    crumbsNode(url, [[t.home, urlIn(lang)], [hubName, urlIn(lang, HUB_PATH)], [s.name, url]]),
    {
      '@type': 'WebPage', '@id': `${url}#webpage`, url, name: s.title, description: s.description, inLanguage: lang,
      isPartOf: webPageRef(lang), breadcrumb: { '@id': `${url}#breadcrumb` }, mainEntity: { '@id': `${url}#service` },
      primaryImageOfPage: { '@type': 'ImageObject', url: absIn(lang, OG_IMAGE), width: 1200, height: 630 }, dateModified: today,
    },
    smmServiceNode(s, lang),
    faqNode(url, s.faq),
  ];

  const pkgCard = (p) => {
    const T = P.items[p.key];
    return `      <li class="smm-pkg${p.featured ? ' is-featured' : ''} case-rv">
        <div class="smm-pkg-head"><h3 class="smm-pkg-name" lang="en">${p.name}</h3>${p.featured ? `<span class="smm-pkg-badge">${esc(P.recommended)}</span>` : ''}</div>
        <p class="smm-pkg-tag">${esc(T.tag)}</p>
        <ul class="smm-pkg-list">
${T.features.map((f) => `          <li>${esc(f)}</li>`).join('\n')}
        </ul>
        <div class="smm-pkg-price">
          <p class="smm-price"><span class="smm-price-n">${fmt(p.price)}</span> <span class="smm-price-u">${esc(P.perMonth)}${p.priceDailoq ? ` · ${esc(P.withoutD)}` : ''}</span></p>
${p.priceDailoq
    ? `          <p class="smm-price is-d"><span class="smm-price-n">${fmt(p.priceDailoq)}</span> <span class="smm-price-u"><strong>${esc(P.perMonth)} · ${esc(P.withD)}</strong></span></p>
          <p class="smm-price-note">(${esc(P.dNote)})</p>`
    : `          <p class="smm-price-note">${esc(P.noD)}</p>`}
        </div>
        <a href="${wa(fill(X.waPackage, { pkg: p.name }))}" class="ald-btn${p.featured ? '' : ' ald-btn--ghost'} smm-pkg-cta" target="_blank" rel="noopener">${esc(P.choose)} <span class="ald-dot">♥</span></a>
      </li>`;
  };

  const C = X.compare;
  const cell = (v) => `<td>${v}</td>`;
  const rows = [
    [C.rows.platforms, SMM.packages.map((p) => esc(p.platforms))],
    [C.rows.posts, SMM.packages.map((p) => p.posts)],
    [C.rows.reels, SMM.packages.map((p) => p.reels), 'is-sub'],
    [C.rows.stories, SMM.packages.map((p) => esc(fill(C.story, { n: p.stories })))],
    [C.rows.shoots, SMM.packages.map((p) => p.shoots)],
    [C.rows.ads, SMM.packages.map((p) => (p.ads ? '<span class="smm-yes" aria-label="✓">✓</span>' : '—'))],
    [C.rows.report, SMM.packages.map((p) => esc(C.reports[p.report]))],
    [C.rows.price, SMM.packages.map((p) => `${fmt(p.price)} ${SMM.currency}`), 'is-price'],
    [C.rows.priceD, SMM.packages.map((p) => (p.priceDailoq ? `${fmt(p.priceDailoq)} ${SMM.currency}` : '<span class="smm-no">—</span>')), 'is-price'],
  ];

  const main = `
<header class="smm-hero">
  <div class="ald-wrap">
    ${crumbsNav(lang, [[t.home, L(lang, b)], [esc(hubName), L(lang, b, HUB_PATH)], [esc(s.name)]])}
    <p class="smm-eyebrow">${esc(X.eyebrow)}</p>
    <h1 class="smm-h1"><span class="smm-h1-top">${esc(X.h1Top)}</span><span class="smm-h1-big">${esc(X.h1Big)}<span class="ald-dot">.</span></span></h1>
    <p class="smm-lead">${esc(X.lead)}</p>
    <div class="smm-hero-cta">
      <a href="${wa(X.waAudit)}" class="ald-btn" target="_blank" rel="noopener">${esc(X.ctaAudit)} <span class="ald-dot">♥</span></a>
      <a href="#packages" class="smm-ghost">${esc(X.ctaPackages)} ↓</a>
    </div>
    <ul class="smm-stats">
${X.stats.map((x) => `      <li><span class="smm-stat-v">${esc(x.v)}${x.u ? ` <small>${esc(x.u)}</small>` : ''}</span><span class="smm-stat-l">${esc(x.l)}</span></li>`).join('\n')}
    </ul>
  </div>
</header>

<section class="ald-sec" aria-labelledby="pillars">
  <div class="ald-wrap">
    ${sectionHead(idx(), X.pillars.eyebrow, X.pillars.h, 'pillars', X.pillars.lead)}
    <ul class="smm-pillars">
${X.pillars.items.map((x) => `      <li class="smm-card case-rv"><p class="smm-k" lang="en">${esc(x.k)}</p><h3 class="smm-card-t">${esc(x.t)}</h3><p class="smm-card-d">${esc(x.d)}</p>${x.link ? `<a href="${L(lang, b, x.link)}" class="ald-link smm-card-more">Dailoq →</a>` : ''}</li>`).join('\n')}
    </ul>
  </div>
</section>

<section class="ald-sec ald-sec--alt" aria-labelledby="chain">
  <div class="ald-wrap">
    ${sectionHead(idx(), X.chain.eyebrow, X.chain.h, 'chain')}
    <ol class="smm-chain">
${X.chain.items.map((x, k) => `      <li class="smm-chain-i${k >= 2 ? ' is-ours' : ''} case-rv"><span class="smm-chain-n">${pad2(k + 1)}</span><h3>${esc(x.t)}</h3><p>${esc(x.d)}</p></li>`).join('\n')}
    </ol>
    <div class="smm-chain-bar"><span class="is-stop">${esc(X.chain.stop)}</span><span class="is-go">${esc(X.chain.go)}</span></div>
  </div>
</section>

<section class="ald-sec smm-pkgs" id="packages" aria-labelledby="packages-h">
  <div class="ald-wrap">
    ${sectionHead(idx(), P.eyebrow, P.h, 'packages-h', P.lead)}
    <ul class="smm-pkg-grid">
${SMM.packages.map(pkgCard).join('\n')}
    </ul>
    <p class="smm-adnote">${esc(P.adNote)}</p>
  </div>
</section>

<section class="ald-sec ald-sec--alt" aria-labelledby="included">
  <div class="ald-wrap">
    ${sectionHead(idx(), X.included.eyebrow, X.included.h, 'included')}
    <ul class="smm-inc">
${X.included.items.map((x, k) => `      <li class="smm-card case-rv"><span class="smm-num">${pad2(k + 1)}</span><h3 class="smm-card-t">${esc(x.t)}</h3><p class="smm-card-d">${esc(x.d)}</p></li>`).join('\n')}
    </ul>
  </div>
</section>

<section class="ald-sec" aria-labelledby="compare">
  <div class="ald-wrap">
    ${sectionHead(idx(), C.eyebrow, C.h, 'compare')}
    <div class="smm-table-wrap case-rv" role="region" aria-labelledby="compare" tabindex="0">
      <table class="smm-table">
        <thead><tr><td></td>${SMM.packages.map((p) => `<th scope="col"${p.featured ? ' class="is-featured"' : ''} lang="en">${p.name}</th>`).join('')}</tr></thead>
        <tbody>
${rows.map(([label, vals, cls]) => `          <tr${cls ? ` class="${cls}"` : ''}><th scope="row">${esc(label)}</th>${vals.map(cell).join('')}</tr>`).join('\n')}
        </tbody>
      </table>
    </div>
  </div>
</section>

<section class="ald-sec ald-sec--dark smm-port" aria-labelledby="portfolio">
  <div class="ald-wrap">
    ${sectionHead(idx(), X.portfolio.eyebrow, X.portfolio.h, 'portfolio', X.portfolio.lead)}
    <ul class="smm-ig-grid-list">
${SMM.portfolio.map((a) => igCard(a, X.portfolio, b)).join('\n')}
      <li class="smm-ig smm-ig--more case-rv">
        <a href="${INSTAGRAM}" target="_blank" rel="noopener" class="smm-ig-link">
          <span class="smm-more-plus" aria-hidden="true">+</span>
          <span class="smm-more-t">${esc(X.portfolio.moreT)}</span>
          <span class="smm-more-d">${esc(X.portfolio.moreD)}</span>
          <span class="smm-ig-view" lang="en">${esc(X.portfolio.moreLink)} ↗</span>
        </a>
      </li>
    </ul>
  </div>
</section>

<section class="ald-sec" aria-labelledby="who">
  <div class="ald-wrap">
    ${sectionHead(idx(), X.who.eyebrow, X.who.h, 'who')}
    <ul class="smm-pillars">
${X.who.items.map((x, k) => `      <li class="smm-card case-rv"><span class="smm-big-n">${pad2(k + 1)}</span><h3 class="smm-card-t">${esc(x.t)}</h3><p class="smm-card-d">${esc(x.d)}</p></li>`).join('\n')}
    </ul>
  </div>
</section>

<section class="ald-sec ald-sec--alt" aria-labelledby="process">
  <div class="ald-wrap">
    ${sectionHead(idx(), X.process.eyebrow, X.process.h, 'process')}
    <ol class="smm-steps">
${X.process.items.map((x, k) => `      <li class="case-rv"><span class="smm-step-n${k === 0 ? ' is-first' : ''}">${k + 1}</span><h3>${esc(x.t)}</h3><p>${esc(x.d)}</p></li>`).join('\n')}
    </ol>
  </div>
</section>

<section class="ald-sec" aria-labelledby="measure">
  <div class="ald-wrap">
    ${sectionHead(idx(), X.measure.eyebrow, X.measure.h, 'measure')}
    <ul class="smm-measure">
${X.measure.items.map((x) => `      <li class="smm-card case-rv"><h3 class="smm-card-t">${esc(x.t)}</h3><p class="smm-card-d">${esc(x.d)}</p></li>`).join('\n')}
    </ul>
    <p class="smm-honest case-rv"><strong>${esc(X.measure.honestT)}</strong> ${esc(X.measure.honestD)}</p>
  </div>
</section>

<section class="ald-sec ald-sec--alt" aria-labelledby="terms">
  <div class="ald-wrap">
    ${sectionHead(idx(), X.terms.eyebrow, X.terms.h, 'terms')}
    <dl class="smm-terms">
${X.terms.items.map((x) => `      <div class="case-rv"><dt>${esc(x.t)}</dt><dd>${esc(x.d)}</dd></div>`).join('\n')}
    </dl>
  </div>
</section>

<section class="ald-sec" aria-labelledby="addons">
  <div class="ald-wrap">
    ${sectionHead(idx(), X.addons.eyebrow, X.addons.h, 'addons')}
    <ul class="smm-addons">
${X.addons.items.map((x) => {
    const href = x.link && svcPath(x.link) ? L(lang, b, svcPath(x.link)) : '';
    return `      <li class="case-rv"><h3>${href ? `<a href="${href}">${esc(x.t)}</a>` : esc(x.t)}</h3><p>${esc(x.d)}</p><span class="smm-addon-p">${esc(x.p)}</span></li>`;
  }).join('\n')}
    </ul>
  </div>
</section>

<section class="ald-sec ald-sec--alt" aria-labelledby="faq">
  <div class="ald-wrap">
    ${sectionHead(idx(), U.faqEyebrow, U.faqH, 'faq')}
    <div class="svc-faq">
${s.faq.map((f, k) => `      <details class="case-rv"${k === 0 ? ' open' : ''}><summary><h3>${esc(f.q)}</h3></summary><p>${esc(f.a)}</p></details>`).join('\n')}
    </div>
  </div>
</section>

<section class="ald-sec" aria-labelledby="other">
  <div class="ald-wrap">
    ${sectionHead(idx(), U.otherEyebrow, U.otherH, 'other')}
    <ul class="svc-grid">
${others.map((x) => svcCard(x, lang, b)).join('\n')}
    </ul>
  </div>
</section>

<section class="ald-sec ald-sec--dark case-cta smm-final">
  <div class="ald-wrap">
    <p class="smm-eyebrow">${esc(X.final.eyebrow)}</p>
    <h2 class="ald-contact-h">${esc(X.final.h)}<span class="ald-dot">.</span></h2>
    <p class="ald-contact-s">${esc(X.final.s)}</p>
    <div class="case-cta-actions">
      <a href="${wa(X.waAudit)}" class="ald-btn" target="_blank" rel="noopener">${esc(X.ctaAudit)} <span class="ald-dot">♥</span></a>
      <a href="tel:${PHONE_TEL}" class="ald-contact-mail">${PHONE}</a>
      <a href="mailto:${EMAIL}" class="ald-contact-mail">${EMAIL}</a>
      <a href="${L(lang, b, CONTACT_PATH)}" class="ald-link">${t.contact}</a>
    </div>
  </div>
</section>`;

  return page({
    lang, b, current: 'services', langHrefs: langLinks(lang, b, s.path),
    headHtml: head({ b, lang, path: s.path, title: s.title, description: s.description, canonical: url, image: absIn(lang, OG_IMAGE), imageType: 'image/png', imageAlt: strings(lang).meta.ogAlt, graph }),
    main,
  });
}

// ───────────────────────────── about ─────────────────────────────
function aboutPage(lang) {
  const t = strings(lang).ui;
  const A = pageText(lang).about;
  const b = backTo(lang, ABOUT_PATH);
  const url = urlIn(lang, ABOUT_PATH);
  const src = translatedSource(lang);
  const steps = grabArray(src, 'steps');
  const values = grabArray(src, 'values');
  const graph = [
    orgNode(lang), websiteNode(lang),
    crumbsNode(url, [[t.home, urlIn(lang)], [t.about, url]]),
    { '@type': 'AboutPage', '@id': `${url}#webpage`, url, name: A.title, description: A.description, inLanguage: lang, isPartOf: webPageRef(lang), about: { '@id': ORG_ID }, mainEntity: { '@id': ORG_ID }, breadcrumb: { '@id': `${url}#breadcrumb` } },
  ];
  const company = [
    [A.legalName, esc(LEGAL_NAME)], [A.taxId, TAX_ID], [A.office, `<a href="${MAPS}" target="_blank" rel="noopener">${esc(A.officeValue)}</a>`],
    [A.legalAddress, esc(LEGAL_ADDRESS)], [A.email, `<a href="mailto:${EMAIL}">${EMAIL}</a>`], [A.phone, `<a href="tel:${PHONE_TEL}">${PHONE}</a>`],
  ];
  const main = `
<header class="case-hero">
  <div class="ald-wrap">
    ${crumbsNav(lang, [[t.home, L(lang, b)], [t.about]])}
    <p class="ald-eyebrow">${esc(A.eyebrow)}</p>
    <h1 class="case-h1"><span class="case-title case-title--hub svc-h1">${esc(A.h1)}<span class="ald-dot">.</span></span></h1>
    <p class="ald-lead case-sub">${esc(A.lead)}</p>
  </div>
</header>
<section class="ald-sec svc-intro">
  <div class="ald-wrap">
${A.intro.map((p, k) => `    <p class="case-text${k === 0 ? ' case-text--lead' : ''} case-rv">${esc(p)}</p>`).join('\n')}
  </div>
</section>
<section class="ald-sec ald-sec--alt" aria-labelledby="what">
  <div class="ald-wrap">
    ${sectionHead('01', A.whatH, A.whatH, 'what')}
    <ul class="svc-grid">
${servicesIn(lang).map((s) => svcCard(s, lang, b)).join('\n')}
    </ul>
  </div>
</section>
<section class="ald-sec" aria-labelledby="process">
  <div class="ald-wrap">
    ${sectionHead('02', A.processH, A.processH, 'process')}
    <ol class="case-arch">
${steps.map((x, k) => `      <li class="case-rv"><h3>${pad2(k + 1)} — ${esc(x.t)}</h3><p>${esc(x.d)}</p></li>`).join('\n')}
    </ol>
  </div>
</section>
<section class="ald-sec ald-sec--alt" aria-labelledby="values">
  <div class="ald-wrap">
    ${sectionHead('03', A.valuesH, A.valuesH, 'values')}
    <ul class="case-features">
${values.map((v) => `      <li class="ald-value case-rv"><h3 class="ald-value-t">${esc(v.t)}</h3><p class="ald-value-d">${esc(v.d)}</p></li>`).join('\n')}
    </ul>
    <p class="svc-more"><a href="${L(lang, b, 'work/')}" class="ald-link">${esc(A.workLink)}</a></p>
  </div>
</section>
<section class="ald-sec" aria-labelledby="company">
  <div class="ald-wrap">
    ${sectionHead('04', A.companyH, A.companyH, 'company')}
    <dl class="case-stack co-dl">
${company.map(([k, v]) => `      <div><dt>${esc(k)}</dt><dd>${v}</dd></div>`).join('\n')}
    </dl>
  </div>
</section>
${ctaBlock(lang, b, { h2: pageText(lang).ui.ctaH, sub: pageText(lang).ui.ctaS })}`;
  return page({
    lang, b, current: 'about', langHrefs: langLinks(lang, b, ABOUT_PATH),
    headHtml: head({ b, lang, path: ABOUT_PATH, title: A.title, description: A.description, canonical: url, image: absIn(lang, OG_IMAGE), imageType: 'image/png', imageAlt: strings(lang).meta.ogAlt, graph }),
    main,
  });
}

// ───────────────────────────── contact ─────────────────────────────
// The form posts straight to FormSubmit (the same relay the home page uses), so it works without JavaScript.
function contactPage(lang) {
  const t = strings(lang).ui;
  const C = pageText(lang).contact;
  const b = backTo(lang, CONTACT_PATH);
  const url = urlIn(lang, CONTACT_PATH);
  const graph = [
    orgNode(lang), websiteNode(lang),
    crumbsNode(url, [[t.home, urlIn(lang)], [t.contact, url]]),
    { '@type': 'ContactPage', '@id': `${url}#webpage`, url, name: C.title, description: C.description, inLanguage: lang, isPartOf: webPageRef(lang), about: { '@id': ORG_ID }, mainEntity: { '@id': ORG_ID }, breadcrumb: { '@id': `${url}#breadcrumb` } },
  ];
  const details = [
    [C.phone, `<a href="tel:${PHONE_TEL}">${PHONE}</a>`],
    [C.whatsapp, `<a href="${WHATSAPP}" target="_blank" rel="noopener">${PHONE}</a>`],
    [C.email, `<a href="mailto:${EMAIL}">${EMAIL}</a>`],
    [C.address, `${esc(C.addressValue)}<br><a href="${MAPS}" target="_blank" rel="noopener" class="ald-link">${esc(C.mapLink)}</a>`],
    ['Instagram · LinkedIn', `<a href="${INSTAGRAM}" target="_blank" rel="noopener">Instagram</a> · <a href="${LINKEDIN}" target="_blank" rel="noopener">LinkedIn</a>`],
    [C.company, `${esc(LEGAL_NAME)} · ${esc(pageText(lang).about.taxId)} ${TAX_ID}`],
  ];
  const privacyRe = /(Məxfilik siyasətində|Privacy Policy|Политике конфиденциальности)/;
  const main = `
<header class="case-hero">
  <div class="ald-wrap">
    ${crumbsNav(lang, [[t.home, L(lang, b)], [t.contact]])}
    <p class="ald-eyebrow">${esc(C.eyebrow)}</p>
    <h1 class="case-h1"><span class="case-title case-title--hub svc-h1">${esc(C.h1)}<span class="ald-dot">.</span></span></h1>
    <p class="ald-lead case-sub">${esc(C.lead)}</p>
  </div>
</header>
<section class="ald-sec hub-sec">
  <div class="ald-wrap co-grid">
    <div>
      <h2 class="ald-eyebrow">${esc(C.detailsH)}</h2>
      <dl class="case-stack co-dl">
${details.map(([k, v]) => `        <div><dt>${esc(k)}</dt><dd>${v}</dd></div>`).join('\n')}
      </dl>
      <h2 class="ald-eyebrow co-next-h">${esc(C.nextH)}</h2>
      <ol class="co-next">
${C.next.map((x, k) => `        <li><span class="case-feature-n">${pad2(k + 1)}</span> ${esc(x)}</li>`).join('\n')}
      </ol>
    </div>
    <form class="co-form" action="https://formsubmit.co/${EMAIL}" method="POST">
      <h2 class="ald-eyebrow">${esc(C.formH)}</h2>
      <input type="hidden" name="_subject" value="${esc(C.subject)}">
      <input type="hidden" name="_template" value="table">
      <input type="text" name="_honey" class="sr-only" tabindex="-1" autocomplete="off" aria-hidden="true">
      <label>${esc(C.name)} *<input type="text" name="name" required autocomplete="name"></label>
      <label>${esc(C.emailField)} *<input type="email" name="email" required autocomplete="email"></label>
      <label>${esc(C.companyField)}<input type="text" name="company" autocomplete="organization"></label>
      <label>${esc(C.message)}<textarea name="message" rows="5"></textarea></label>
      <button type="submit" class="ald-btn">${esc(C.send)} <span class="ald-dot">♥</span></button>
      <p class="co-note">${esc(C.formNote).replace(privacyRe, `<a href="${L(lang, b, 'privacy/')}">$1</a>`)}</p>
    </form>
  </div>
</section>`;
  return page({
    lang, b, current: 'contact', langHrefs: langLinks(lang, b, CONTACT_PATH),
    headHtml: head({ b, lang, path: CONTACT_PATH, title: C.title, description: C.description, canonical: url, image: absIn(lang, OG_IMAGE), imageType: 'image/png', imageAlt: strings(lang).meta.ogAlt, graph }),
    main,
  });
}

// ───────────────────────────── privacy policy ─────────────────────────────
function privacyPage(lang) {
  const { ui: t, privacy: P } = strings(lang);
  if (!P) throw new Error(`i18n/${lang}.json: "privacy" is missing`);
  const b = backTo(lang, 'privacy/');
  const url = urlIn(lang, 'privacy/');
  const graph = [
    orgNode(lang), websiteNode(lang),
    crumbsNode(url, [[t.home, urlIn(lang)], [P.h1, url]]),
    {
      '@type': 'WebPage', '@id': `${url}#webpage`, url, name: P.title, description: P.description, inLanguage: lang,
      isPartOf: webPageRef(lang), about: { '@id': ORG_ID }, breadcrumb: { '@id': `${url}#breadcrumb` },
    },
  ];
  const main = `
<header class="case-hero legal-hero">
  <div class="ald-wrap">
    ${crumbsNav(lang, [[t.home, L(lang, b)], [esc(P.h1)]])}
    <p class="ald-eyebrow">${esc(P.eyebrow)}</p>
    <h1 class="case-h1"><span class="case-title legal-title">${esc(P.h1)}</span></h1>
    <p class="ald-lead case-sub">${esc(P.lead)}<br><span class="legal-updated">${esc(P.updated)}</span></p>
  </div>
</header>
<section class="ald-sec legal-sec">
  <div class="ald-wrap">
    <div class="legal">
${P.sections.map(([heading, body]) => `      <h2>${esc(heading)}</h2>\n      ${body}`).join('\n')}
    </div>
  </div>
</section>`;
  return page({
    lang, b, langHrefs: langLinks(lang, b, 'privacy/'),
    headHtml: head({ b, lang, path: 'privacy/', title: P.title, description: P.description, canonical: url, image: absIn(lang, OG_IMAGE), imageType: 'image/png', imageAlt: strings(lang).meta.ogAlt, graph, robots: 'index,follow' }),
    main,
  });
}

// ───────────────────────────── 404 ─────────────────────────────
// Served by static hosts for any unknown URL, at any depth — hence root-absolute links.
function notFoundPage(lang) {
  const b = '/';
  const N = pageText(lang).ui.notFound;
  const main = `
<header class="case-hero">
  <div class="ald-wrap">
    <p class="ald-eyebrow">404</p>
    <h1 class="case-h1"><span class="case-title">${esc(N.h1)}</span><span class="sr-only"> — </span><span class="case-headline">${esc(N.headline)}</span></h1>
    <p class="ald-lead case-sub">${esc(N.lead)}</p>
    <div class="case-cta-actions">
      <a href="${L(lang, b)}" class="ald-btn">${esc(N.home)} <span class="ald-dot">♥</span></a>
      <a href="${L(lang, b, HUB_PATH)}" class="ald-link">${esc(pageText(lang).ui.allServices)}</a>
      <a href="${L(lang, b, 'work/')}" class="ald-link">${strings(lang).ui.allProjects}</a>
    </div>
  </div>
</header>`;
  return page({
    lang, b, langHrefs: langLinks(lang, b, ''),
    headHtml: head({ b, lang, path: null, title: `${N.title} | ${NAME}`, description: N.headline, canonical: '', image: absIn(lang, OG_IMAGE), imageType: 'image/png', imageAlt: NAME, robots: 'noindex,follow' }),
    main,
  });
}

// ───────────────────────────── home-page data block ─────────────────────────────
const home = read('index.html');
const re = /(\/\/ workAll:start[^\n]*\n\s*)const workData = \[[\s\S]*?\n\s*\];(\s*\n\s*\/\/ workAll:end)/;
if (!re.test(home)) throw new Error('index.html: "// workAll:start … // workAll:end" markers not found around const workData');
write('index.html', home.replace(re, (_, a, c) => a + workDataLiteral(projects, './') + c));

// ───────────────────────────── write pages ─────────────────────────────
for (const lang of LANGS) {
  const list = localizeProjects(projects, lang);
  if (LOCALES[lang].prefix === '') write(outFile(lang, '', '404.html'), notFoundPage(lang));
  write(outFile(lang, 'work/'), hubPage(list, lang));
  write(outFile(lang, 'privacy/'), privacyPage(lang));
  write(outFile(lang, HUB_PATH), servicesHubPage(lang));
  write(outFile(lang, ABOUT_PATH), aboutPage(lang));
  write(outFile(lang, CONTACT_PATH), contactPage(lang));
  const svcs = servicesIn(lang);
  for (const s of svcs) write(outFile(lang, s.path), servicePage(s, lang, list));
  list.forEach((p, i) => write(outFile(lang, p.path), casePage(p, i, list, lang)));
  const longTitles = list.filter((p) => pageTitle(p).length > 72).map((p) => p.slug);
  console.log(`work [${lang} → ${originOf(lang)}/${LOCALES[lang].prefix}]: work hub + ${list.length} cases, services hub + ${svcs.length} services, about, contact, privacy${longTitles.length ? ` (long <title>: ${longTitles.join(', ')})` : ''}`);
}
console.log('work: static files copied into dist/, home workAll refreshed');
