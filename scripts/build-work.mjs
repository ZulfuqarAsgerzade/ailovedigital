#!/usr/bin/env node
// Builds everything that comes from data/projects.json:
//
//   work/index.html            the "all projects" hub
//   work/<slug>/index.html     one static case-study page per project (plain HTML — no JavaScript
//                              needed to read it, which is what search engines and AI crawlers want)
//   privacy/index.html         the privacy policy (text in i18n/<lang>.json → "privacy")
//   ru/work/…, az/work/…       the same pages in every other language (see scripts/lib/i18n.mjs)
//   index.html                 the `workAll` array between // workAll:start … // workAll:end
//                              (the /ru/ and /az/ home pages are built from index.html by build-seo.mjs)
//
// Run it (it chains into build-seo.mjs, which then refreshes the head, sitemap and llms.txt):
//
//   npm run build        or        node scripts/build-work.mjs && node scripts/build-seo.mjs
//
// Add a project: append it to data/projects.json and drop its images in
// assets/images/work/<slug>/ (cover.webp, 01.webp …, og.jpg) plus assets/images/work/<slug>.webp.

import {
  SITE_URL, NAME, EMAIL, BG, OG_IMAGE,
  read, write, abs, esc, pad2, clip, loadProjects,
} from './lib/site.mjs';
import {
  LANGS, LOCALES, strings, fill, localizeProjects, langMenu, hreflangLinks, ogLocaleTags, urlIn, workDataLiteral,
} from './lib/i18n.mjs';

const projects = loadProjects();
const today = new Date().toISOString().slice(0, 10);

// ───────────────────────────── shared page pieces ─────────────────────────────
const HEART = (w, h) => `<svg width="${w}" height="${h}" viewBox="0 0 21 18" aria-hidden="true"><g fill="#FF304D"><rect x="3" y="0" width="3" height="3"/><rect x="6" y="0" width="3" height="3"/><rect x="12" y="0" width="3" height="3"/><rect x="15" y="0" width="3" height="3"/><rect x="0" y="3" width="21" height="3"/><rect x="0" y="6" width="21" height="3"/><rect x="3" y="9" width="15" height="3"/><rect x="6" y="12" width="9" height="3"/><rect x="9" y="15" width="3" height="3"/></g></svg>`;

const jsonLdTag = (graph) =>
  `<script type="application/ld+json">\n${JSON.stringify({ '@context': 'https://schema.org', '@graph': graph }, null, 2).replace(/<\//g, '<\\/')}\n</script>`;

const orgNode = {
  '@type': ['Organization', 'ProfessionalService'],
  '@id': `${SITE_URL}/#org`,
  name: NAME,
  url: `${SITE_URL}/`,
  logo: { '@type': 'ImageObject', url: abs('assets/icons/icon-512.png'), width: 512, height: 512 },
  email: EMAIL,
};
const siteNode = { '@type': 'WebSite', '@id': `${SITE_URL}/#website`, url: `${SITE_URL}/`, name: NAME, inLanguage: LANGS, publisher: { '@id': `${SITE_URL}/#org` } };

/**
 * `b` is the relative path back to the site root ("../../" from /work/<slug>/, "../../../" from
 * /ru/work/<slug>/); `path` is the page's language-neutral path ("work/", "work/<slug>/") for the
 * hreflang alternates, or null for pages that have none (404).
 */
function head({ b, lang, path, title, description, canonical, image, imageType, imageAlt, graph, robots = 'index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1' }) {
  return `<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
${canonical ? `<link rel="canonical" href="${canonical}">\n` : ''}${path !== null ? hreflangLinks(path) + '\n' : ''}<meta name="robots" content="${robots}">
<meta name="author" content="${NAME}">
<meta name="theme-color" content="${BG}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="${NAME}">
${ogLocaleTags(lang)}
${canonical ? `<meta property="og:url" content="${canonical}">\n` : ''}
<meta property="og:title" content="${esc(title)}">
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
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&family=Geist+Mono:wght@400;500&display=swap">
<script>document.documentElement.classList.add('has-js')</script>
<link rel="stylesheet" href="${b}css/style.css">
<link rel="stylesheet" href="${b}css/case.css">
${graph ? jsonLdTag(graph) + '\n' : ''}<script src="${b}js/case.js" defer></script>
</head>`;
}

/** `h` is the relative link to this language's home page (`b` + "ru/" …); `langHrefs` maps each language to this page in it. */
function nav({ h, hubHref, hubCurrent, workActive = true, lang, langHrefs }) {
  const t = strings(lang).ui;
  const link = (href, label, extra = '') => `<a href="${href}" class="ald-navlink${extra}">${label}</a>`;
  return `<a class="ald-skip" href="#main">${t.skip}</a>
<nav class="ald-nav is-solid" aria-label="${esc(t.navPrimary)}">
  <a href="${h}" class="ald-brand" aria-label="${NAME} — ${esc(t.homeLabel)}">${HEART(21, 18)}<span>${NAME}</span></a>
  <div class="ald-nav-desk">
    ${link(`${h}#services`, t.services)}
    <a href="${hubHref}" class="ald-navlink${workActive ? ' is-active' : ''}"${hubCurrent ? ' aria-current="page"' : ''}>${t.work}</a>
    ${link(`${h}#process`, t.process)}
    ${link(`${h}#about`, t.about)}
    ${link(`${h}#contact`, t.contact)}
  </div>
  <div class="ald-nav-actions">
    ${langMenu(lang, langHrefs)}
    <a href="${h}#contact" class="ald-btn ald-btn--sm ald-nav-cta">${t.startSomething} <span class="ald-dot">♥</span></a>
    <button type="button" class="ald-burger" aria-label="${esc(t.openMenu)}" data-label-open="${esc(t.openMenu)}" data-label-close="${esc(t.closeMenu)}" aria-expanded="false" aria-controls="menu"><span></span><span></span></button>
  </div>
  <div class="ald-prog" aria-hidden="true"></div>
</nav>
<div class="ald-menu" id="menu" role="dialog" aria-modal="true" aria-label="${esc(t.menu)}" hidden>
  <div class="ald-menu-links">
    <a href="${h}#services">${t.services}</a>
    <a href="${hubHref}">${t.work}</a>
    <a href="${h}#process">${t.process}</a>
    <a href="${h}#about">${t.about}</a>
    <a href="${h}#contact">${t.contact}</a>
  </div>
  <div class="ald-menu-foot">
    <a href="${h}#contact" class="ald-btn ald-btn--fit">${t.startSomething} <span class="ald-dot">♥</span></a>
    <a href="mailto:${EMAIL}">${EMAIL}</a>
  </div>
</div>`;
}

function footer({ h, hubHref, lang }) {
  const { ui: t, meta } = strings(lang);
  return `<footer class="ald-footer">
  <div class="ald-wrap">
    <div class="ald-foot-grid">
      <div>
        <a href="${h}" class="ald-brand ald-brand--foot" aria-label="${NAME} — ${esc(t.homeLabel)}">${HEART(17, 15)}<span>${NAME}</span></a>
        <p class="ald-foot-list ald-foot-list--narrow">${t.footerBlurb}</p>
      </div>
      <div>
        <div class="ald-foot-h">${t.footServices}</div>
        <div class="ald-foot-list">${['svcBuild', 'svcAutomate', 'svcGrow', 'svcTeach', 'svcThink'].map((k) => `<a href="${h}#services">${t[k]}</a>`).join('')}</div>
      </div>
      <div>
        <div class="ald-foot-h">${t.footCompany}</div>
        <div class="ald-foot-list"><a href="${hubHref}">${t.work}</a><a href="${h}#process">${t.process}</a><a href="${h}#about">${t.about}</a><a href="${h}#contact">${t.contact}</a><a href="${h}privacy/">${t.privacyPolicy}</a></div>
      </div>
      <div>
        <div class="ald-foot-h">${t.footContact}</div>
        <div class="ald-foot-list"><a href="mailto:${EMAIL}">${EMAIL}</a></div>
      </div>
    </div>
    <div class="ald-foot-mark" aria-hidden="true">AILOVEDIGITAL<span class="ald-dot">.</span></div>
    <div class="ald-foot-bottom">
      <span>© 2026 ${NAME}</span>
      <span>${meta.slogan}</span>
      <a href="#main" class="ald-totop">${t.backToTop}</a>
    </div>
  </div>
</footer>`;
}

const page = ({ lang, headHtml, main, ...links }) => `<!doctype html>
<!-- Generated by scripts/build-work.mjs from data/projects*.json and i18n/*.json — edit those or the script, not this file. -->
<html lang="${lang}">
${headHtml}
<body class="case">
${nav({ lang, ...links })}
<main id="main">
${main}
</main>
${footer({ lang, ...links })}
</body>
</html>
`;

/** Relative links from a page to the same page in every language (`b` = back to the site root). */
const langLinks = (b, path) => Object.fromEntries(LANGS.map((l) => [l, `${b}${LOCALES[l].prefix}${path}`]));

// ───────────── shared project card (hub + "related projects") ─────────────
const hubCard = (p, b, h, eager, level = 3) => `    <li class="hub-card case-rv">
      <div class="hub-media"><img src="${b}${p.homeImg}" width="800" height="500" alt="${esc(p.coverAlt)}" loading="${eager ? 'eager' : 'lazy'}" decoding="async"></div>
      <div class="hub-body">
        <span class="ald-work-num">${pad2(p.n)}</span>
        <h${level} class="hub-name"><a href="${h}${p.path}" class="hub-link">${esc(p.brand)}</a></h${level}>
        <p class="hub-line">${esc(p.line)}</p>
        <p class="hub-meta">${esc(p.scope)} · ${esc(p.year)}</p>
      </div>
    </li>`;

/** Same-scope projects first, then the following ones in order — three, never the project itself.
 *  Grouped on the English data so every language shows the same three; returned from `list`. */
function relatedFor(p, list) {
  const others = projects.filter((x) => x.slug !== p.slug);
  const same = others.filter((x) => x.scope === p.scope);
  const rest = others.filter((x) => x.scope !== p.scope).sort((a, b) => ((a.n - p.n + 16) % 16) - ((b.n - p.n + 16) % 16));
  return [...same, ...rest].slice(0, 3).map((x) => list[x.n - 1]);
}

// ───────────────────────────── case-study page ─────────────────────────────
/** "ChefMarket — Restaurant–supplier B2B marketplace ecosystem | AILoveDigital", kept near the ~60
 *  characters search results show: the leading article goes, and the site name goes if still too long. */
function pageTitle(p) {
  const core = `${p.brand} — ${p.headline.replace(/^(A|An)\s+/, '').replace(/^./, (c) => c.toLocaleUpperCase(p.lang || 'en'))}`;
  return core.length + NAME.length + 3 <= 72 ? `${core} | ${NAME}` : core;
}

function casePage(p, i, list, lang) {
  const t = strings(lang).ui;
  const pre = LOCALES[lang].prefix;
  const b = pre ? '../../../' : '../../';
  const h = b + pre;
  const prev = list[(i - 1 + list.length) % list.length];
  const next = list[(i + 1) % list.length];
  const title = pageTitle(p);
  const description = clip(p.overview, 156);
  const image = abs(p.og);
  const keywords = [...new Set(p.stack.flatMap((g) => g.v))];

  const graph = [
    orgNode,
    siteNode,
    {
      '@type': 'BreadcrumbList', '@id': `${p.url}#breadcrumb`,
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: t.home, item: urlIn(lang) },
        { '@type': 'ListItem', position: 2, name: t.work, item: urlIn(lang, 'work/') },
        { '@type': 'ListItem', position: 3, name: p.brand, item: p.url },
      ],
    },
    {
      '@type': 'WebPage', '@id': `${p.url}#webpage`, url: p.url, name: title, description, inLanguage: lang,
      isPartOf: { '@id': `${SITE_URL}/#website` }, breadcrumb: { '@id': `${p.url}#breadcrumb` },
      primaryImageOfPage: { '@type': 'ImageObject', url: abs(p.cover.src), width: p.cover.w, height: p.cover.h },
      mainEntity: { '@id': `${p.url}#project` }, dateModified: today,
    },
    {
      '@type': 'CreativeWork', '@id': `${p.url}#project`, url: p.url, mainEntityOfPage: { '@id': `${p.url}#webpage` },
      name: p.brand, headline: p.headline, abstract: p.subtitle, description: p.overview,
      genre: p.scope, dateCreated: p.year, inLanguage: lang, keywords: keywords.join(', '),
      creator: { '@id': `${SITE_URL}/#org` }, publisher: { '@id': `${SITE_URL}/#org` },
      image: abs(p.cover.src),
    },
  ];

  const meta = [[t.year, p.year], [t.scope, p.scope], ...(p.time ? [[t.timeline, p.time]] : [])]
    .map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join('');

  const main = `
<header class="case-hero">
  <div class="ald-wrap">
    <nav class="case-crumbs" aria-label="${esc(t.crumbs)}">
      <ol><li><a href="${h}">${t.home}</a></li><li><a href="../">${t.work}</a></li><li aria-current="page">${esc(p.brand)}</li></ol>
    </nav>
    <p class="ald-eyebrow has-idx"><span class="ald-idx">${pad2(p.n)}</span> / ${esc(p.scope)}</p>
    <h1 class="case-h1"><span class="case-title">${esc(p.brand)}</span><span class="sr-only"> — </span><span class="case-headline">${esc(p.headline)}</span></h1>
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
${p.stack.map((g) => `      <div class="case-rv"><dt>${esc(g.k)}</dt><dd><ul class="ald-chips">${g.v.map((t) => `<li class="ald-chip">${esc(t)}</li>`).join('')}</ul></dd></div>`).join('\n')}
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
${relatedFor(p, list).map((r) => hubCard(r, b, h, false)).join('\n')}
    </ol>
  </div>
</section>

<nav class="case-pager" aria-label="${esc(t.morePager)}">
  <a href="${h}${prev.path}" rel="prev"><span class="case-pager-k">${t.prev}</span><span class="case-pager-n">${esc(prev.brand)}</span></a>
  <a href="${h}${next.path}" rel="next"><span class="case-pager-k">${t.next}</span><span class="case-pager-n">${esc(next.brand)}</span></a>
</nav>

<section class="ald-sec ald-sec--dark case-cta">
  <div class="ald-wrap">
    <h2 class="ald-contact-h">${t.ctaSimilar}</h2>
    <p class="ald-contact-s">${t.ctaReal} <span class="ald-dot">♥</span></p>
    <div class="case-cta-actions">
      <a href="${h}#contact" class="ald-btn">${t.startSomething} <span class="ald-dot">♥</span></a>
      <a href="mailto:${EMAIL}" class="ald-contact-mail">${EMAIL}</a>
      <a href="../" class="ald-link">${t.allProjects}</a>
    </div>
  </div>
</section>`;

  return page({
    lang, h, hubHref: '../', hubCurrent: false, langHrefs: langLinks(b, p.path),
    headHtml: head({ b, lang, path: p.path, title, description, canonical: p.url, image, imageType: 'image/jpeg', imageAlt: p.coverAlt, graph }),
    main,
  });
}

// ───────────────────────────── /work/ hub ─────────────────────────────
function hubPage(list, lang) {
  const t = strings(lang).ui;
  const pre = LOCALES[lang].prefix;
  const b = pre ? '../../' : '../';
  const h = b + pre;
  const url = urlIn(lang, 'work/');
  const scopes = [...new Set(list.map((p) => p.scope))];
  const n = list.length;
  const title = fill(t.hubTitle, { n, name: NAME });
  const description = clip(fill(t.hubDescription, { n, name: NAME, scopes: lang === 'en' ? scopes.join(', ').toLowerCase() : scopes.join(', ') }), 158);
  const graph = [
    orgNode, siteNode,
    {
      '@type': 'BreadcrumbList', '@id': `${url}#breadcrumb`,
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: t.home, item: urlIn(lang) },
        { '@type': 'ListItem', position: 2, name: t.work, item: url },
      ],
    },
    {
      '@type': 'CollectionPage', '@id': `${url}#webpage`, url, name: title, description, inLanguage: lang,
      isPartOf: { '@id': `${SITE_URL}/#website` }, breadcrumb: { '@id': `${url}#breadcrumb` },
      primaryImageOfPage: { '@type': 'ImageObject', url: abs(OG_IMAGE), width: 1200, height: 630 },
      mainEntity: { '@id': `${url}#projects` }, dateModified: today,
    },
    {
      '@type': 'ItemList', '@id': `${url}#projects`, name: t.selectedWork, numberOfItems: n,
      itemListElement: list.map((p) => ({ '@type': 'ListItem', position: p.n, url: p.url, name: p.brand })),
    },
  ];
  const cards = list.map((p) => hubCard(p, b, h, p.n <= 3, 2)).join('\n');

  const main = `
<header class="case-hero">
  <div class="ald-wrap">
    <nav class="case-crumbs" aria-label="${esc(t.crumbs)}">
      <ol><li><a href="${h}">${t.home}</a></li><li aria-current="page">${t.work}</li></ol>
    </nav>
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
<section class="ald-sec ald-sec--dark case-cta">
  <div class="ald-wrap">
    <h2 class="ald-contact-h">${t.hubCtaH}</h2>
    <p class="ald-contact-s">${t.hubCtaS} <span class="ald-dot">♥</span></p>
    <div class="case-cta-actions">
      <a href="${h}#contact" class="ald-btn">${t.startSomething} <span class="ald-dot">♥</span></a>
      <a href="mailto:${EMAIL}" class="ald-contact-mail">${EMAIL}</a>
    </div>
  </div>
</section>`;

  return page({
    lang, h, hubHref: './', hubCurrent: true, langHrefs: langLinks(b, 'work/'),
    headHtml: head({ b, lang, path: 'work/', title, description, canonical: url, image: abs(OG_IMAGE), imageType: 'image/png', imageAlt: t.hubOgAlt, graph }),
    main,
  });
}

// ───────────────────────────── privacy policy ─────────────────────────────
function privacyPage(lang) {
  const { ui: t, privacy: P } = strings(lang);
  if (!P) throw new Error(`i18n/${lang}.json: "privacy" is missing`);
  const pre = LOCALES[lang].prefix;
  const b = pre ? '../../' : '../';
  const h = b + pre;
  const url = urlIn(lang, 'privacy/');
  const graph = [
    orgNode, siteNode,
    {
      '@type': 'BreadcrumbList', '@id': `${url}#breadcrumb`,
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: t.home, item: urlIn(lang) },
        { '@type': 'ListItem', position: 2, name: P.h1, item: url },
      ],
    },
    {
      '@type': 'WebPage', '@id': `${url}#webpage`, url, name: P.title, description: P.description, inLanguage: lang,
      isPartOf: { '@id': `${SITE_URL}/#website` }, about: { '@id': `${SITE_URL}/#org` }, breadcrumb: { '@id': `${url}#breadcrumb` },
    },
  ];
  const main = `
<header class="case-hero">
  <div class="ald-wrap">
    <nav class="case-crumbs" aria-label="${esc(t.crumbs)}">
      <ol><li><a href="${h}">${t.home}</a></li><li aria-current="page">${esc(P.h1)}</li></ol>
    </nav>
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
    lang, h, hubHref: `${h}work/`, hubCurrent: false, workActive: false, langHrefs: langLinks(b, 'privacy/'),
    headHtml: head({ b, lang, path: 'privacy/', title: P.title, description: P.description, canonical: url, image: abs(OG_IMAGE), imageType: 'image/png', imageAlt: strings(lang).meta.ogAlt, graph }),
    main,
  });
}

// ───────────────────────────── 404 ─────────────────────────────
// Served by static hosts for any unknown URL, at any depth — hence root-absolute asset paths.
function notFoundPage() {
  const b = '/';
  const main = `
<header class="case-hero">
  <div class="ald-wrap">
    <p class="ald-eyebrow">404</p>
    <h1 class="case-h1"><span class="case-title">Lost?</span><span class="sr-only"> — </span><span class="case-headline">That page doesn’t exist any more.</span></h1>
    <p class="ald-lead case-sub">Head back to the start, or browse the work we are proud of.</p>
    <div class="case-cta-actions">
      <a href="${b}" class="ald-btn">Home <span class="ald-dot">♥</span></a>
      <a href="${b}work/" class="ald-link">All projects →</a>
    </div>
  </div>
</header>`;
  return page({
    lang: 'en', h: b, hubHref: `${b}work/`, hubCurrent: false, langHrefs: langLinks(b, ''),
    headHtml: head({ b, lang: 'en', path: null, title: `Page not found | ${NAME}`, description: 'This page does not exist.', canonical: '', image: abs(OG_IMAGE), imageType: 'image/png', imageAlt: NAME, robots: 'noindex,follow' }),
    main,
  });
}

// ───────────────────────────── home-page data block ─────────────────────────────
const home = read('index.html');
const re = /(\/\/ workAll:start[^\n]*\n\s*)const workData = \[[\s\S]*?\n\s*\];(\s*\n\s*\/\/ workAll:end)/;
if (!re.test(home)) throw new Error('index.html: "// workAll:start … // workAll:end" markers not found around const workData');
write('index.html', home.replace(re, (_, a, c) => a + workDataLiteral(projects, './') + c));

// ───────────────────────────── write pages ─────────────────────────────
write('404.html', notFoundPage());
for (const lang of LANGS) {
  const list = localizeProjects(projects, lang);
  const pre = LOCALES[lang].prefix;
  write(`${pre}work/index.html`, hubPage(list, lang));
  write(`${pre}privacy/index.html`, privacyPage(lang));
  list.forEach((p, i) => write(`${pre}work/${p.slug}/index.html`, casePage(p, i, list, lang)));
  const longTitles = list.filter((p) => pageTitle(p).length > 72).map((p) => p.slug);
  console.log(`work [${lang}]: hub + privacy + ${list.length} case pages${longTitles.length ? ` (long <title>: ${longTitles.join(', ')})` : ''}`);
}
console.log('work: 404 and home workAll refreshed');
