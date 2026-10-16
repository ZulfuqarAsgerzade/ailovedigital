#!/usr/bin/env node
// Builds everything that comes from data/projects.json:
//
//   work/index.html            the "all projects" hub
//   work/<slug>/index.html     one static case-study page per project (plain HTML — no JavaScript
//                              needed to read it, which is what search engines and AI crawlers want)
//   index.html                 the `workAll` array between // workAll:start … // workAll:end
//
// Run it (it chains into build-seo.mjs, which then refreshes the head, sitemap and llms.txt):
//
//   npm run build        or        node scripts/build-work.mjs && node scripts/build-seo.mjs
//
// Add a project: append it to data/projects.json and drop its images in
// assets/images/work/<slug>/ (cover.webp, 01.webp …, og.jpg) plus assets/images/work/<slug>.webp.

import {
  SITE_URL, NAME, EMAIL, SLOGAN, LOCALE, LANG, BG, OG_IMAGE,
  read, write, abs, esc, pad2, clip, loadProjects,
} from './lib/site.mjs';

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
const siteNode = { '@type': 'WebSite', '@id': `${SITE_URL}/#website`, url: `${SITE_URL}/`, name: NAME, inLanguage: LANG, publisher: { '@id': `${SITE_URL}/#org` } };

/** `b` is the relative path back to the site root: "../../" from /work/<slug>/, "../" from /work/. */
function head({ b, title, description, canonical, image, imageType, imageAlt, graph, robots = 'index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1' }) {
  return `<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
${canonical ? `<link rel="canonical" href="${canonical}">\n` : ''}<meta name="robots" content="${robots}">
<meta name="author" content="${NAME}">
<meta name="theme-color" content="${BG}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="${NAME}">
<meta property="og:locale" content="${LOCALE}">
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

function nav(b, hubHref, hubCurrent) {
  const link = (href, label, extra = '') => `<a href="${href}" class="ald-navlink${extra}">${label}</a>`;
  return `<a class="ald-skip" href="#main">Skip to content</a>
<nav class="ald-nav is-solid" aria-label="Primary">
  <a href="${b}" class="ald-brand" aria-label="${NAME} — home">${HEART(21, 18)}<span>${NAME}</span></a>
  <div class="ald-nav-desk">
    ${link(`${b}#services`, 'Services')}
    <a href="${hubHref}" class="ald-navlink is-active"${hubCurrent ? ' aria-current="page"' : ''}>Work</a>
    ${link(`${b}#process`, 'Process')}
    ${link(`${b}#about`, 'About')}
    ${link(`${b}#contact`, 'Contact')}
  </div>
  <div class="ald-nav-actions">
    <a href="${b}#contact" class="ald-btn ald-btn--sm ald-nav-cta">Start something <span class="ald-dot">♥</span></a>
    <button type="button" class="ald-burger" aria-label="Open menu" aria-expanded="false" aria-controls="menu"><span></span><span></span></button>
  </div>
  <div class="ald-prog" aria-hidden="true"></div>
</nav>
<div class="ald-menu" id="menu" role="dialog" aria-modal="true" aria-label="Menu" hidden>
  <div class="ald-menu-links">
    <a href="${b}#services">Services</a>
    <a href="${hubHref}">Work</a>
    <a href="${b}#process">Process</a>
    <a href="${b}#about">About</a>
    <a href="${b}#contact">Contact</a>
  </div>
  <div class="ald-menu-foot">
    <a href="${b}#contact" class="ald-btn ald-btn--fit">Start something <span class="ald-dot">♥</span></a>
    <a href="mailto:${EMAIL}">${EMAIL}</a>
  </div>
</div>`;
}

function footer(b, hubHref) {
  return `<footer class="ald-footer">
  <div class="ald-wrap">
    <div class="ald-foot-grid">
      <div>
        <a href="${b}" class="ald-brand ald-brand--foot" aria-label="${NAME} — home">${HEART(17, 15)}<span>${NAME}</span></a>
        <p class="ald-foot-list ald-foot-list--narrow">Making businesses love digital — with technology, AI and creative that earns its keep.</p>
      </div>
      <div>
        <div class="ald-foot-h">Services</div>
        <div class="ald-foot-list"><a href="${b}#services">Build</a><a href="${b}#services">Automate</a><a href="${b}#services">Grow</a><a href="${b}#services">Teach</a><a href="${b}#services">Think</a></div>
      </div>
      <div>
        <div class="ald-foot-h">Company</div>
        <div class="ald-foot-list"><a href="${hubHref}">Work</a><a href="${b}#process">Process</a><a href="${b}#about">About</a><a href="${b}#contact">Contact</a></div>
      </div>
      <div>
        <div class="ald-foot-h">Get in touch</div>
        <div class="ald-foot-list"><a href="mailto:${EMAIL}">${EMAIL}</a></div>
      </div>
    </div>
    <div class="ald-foot-mark" aria-hidden="true">AILOVEDIGITAL<span class="ald-dot">.</span></div>
    <div class="ald-foot-bottom">
      <span>© 2026 ${NAME}</span>
      <span>${SLOGAN}</span>
      <a href="#main" class="ald-totop">Back to top ↑</a>
    </div>
  </div>
</footer>`;
}

const page = ({ b, hubHref, hubCurrent, headHtml, main, extra = '' }) => `<!doctype html>
<!-- Generated by scripts/build-work.mjs from data/projects.json — edit the data or the script, not this file. -->
<html lang="${LANG}">
${headHtml}
<body class="case">
${nav(b, hubHref, hubCurrent)}
<main id="main">
${main}
</main>
${footer(b, hubHref)}
${extra}
</body>
</html>
`;


// ───────────── shared project card (hub + "related projects") ─────────────
const hubCard = (p, b, eager, level = 3) => `    <li class="hub-card case-rv">
      <div class="hub-media"><img src="${b}${p.homeImg}" width="800" height="500" alt="${esc(p.coverAlt)}" loading="${eager ? 'eager' : 'lazy'}" decoding="async"></div>
      <div class="hub-body">
        <span class="ald-work-num">${pad2(p.n)}</span>
        <h${level} class="hub-name"><a href="${b}${p.path}" class="hub-link">${esc(p.brand)}</a></h${level}>
        <p class="hub-line">${esc(p.line)}</p>
        <p class="hub-meta">${esc(p.scope)} · ${esc(p.year)}</p>
      </div>
    </li>`;

/** Same-scope projects first, then the following ones in order — three, never the project itself. */
function relatedFor(p) {
  const others = projects.filter((x) => x.slug !== p.slug);
  const same = others.filter((x) => x.scope === p.scope);
  const rest = others.filter((x) => x.scope !== p.scope).sort((a, b) => ((a.n - p.n + 16) % 16) - ((b.n - p.n + 16) % 16));
  return [...same, ...rest].slice(0, 3);
}

// ───────────────────────────── gallery layout ─────────────────────────────
// Screens become small thumbnails in a grid (4 per row for phone and tablet screens, 3 for landscape ones on
// desktop; fewer on narrower screens — see css/case.css). Consecutive screens of the same kind share a grid so
// every thumbnail in it has the same shape; the full image opens in the viewer.
const shotKind = (s) => { const r = s.w / s.h; return r >= 0.85 ? 'wide' : r < 0.6 ? 'phone' : 'tablet'; };
function galleryGroups(shots) {
  const groups = [];
  shots.forEach((s, idx) => {
    const kind = shotKind(s), last = groups.at(-1);
    if (last && last.kind === kind) last.items.push({ ...s, idx }); else groups.push({ kind, items: [{ ...s, idx }] });
  });
  return groups;
}

// ───────────────────────────── case-study page ─────────────────────────────
/** "ChefMarket — Restaurant–supplier B2B marketplace ecosystem | AILoveDigital", kept near the ~60
 *  characters search results show: the leading article goes, and the site name goes if still too long. */
function pageTitle(p) {
  const core = `${p.brand} — ${p.headline.replace(/^(A|An)\s+/, '').replace(/^./, (c) => c.toUpperCase())}`;
  return core.length + NAME.length + 3 <= 72 ? `${core} | ${NAME}` : core;
}

function casePage(p, i) {
  const b = '../../';
  const prev = projects[(i - 1 + projects.length) % projects.length];
  const next = projects[(i + 1) % projects.length];
  const title = pageTitle(p);
  const description = clip(p.overview, 156);
  const image = abs(p.og);
  const shotAlt = (s, k) => (p.shotAlts && p.shotAlts[k]) || `${p.brand} interface — screen ${k + 1} of ${p.shots.length}`;
  const keywords = [...new Set(p.stack.flatMap((g) => g.v))];

  const graph = [
    orgNode,
    siteNode,
    {
      '@type': 'BreadcrumbList', '@id': `${p.url}#breadcrumb`,
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE_URL}/` },
        { '@type': 'ListItem', position: 2, name: 'Work', item: `${SITE_URL}/work/` },
        { '@type': 'ListItem', position: 3, name: p.brand, item: p.url },
      ],
    },
    {
      '@type': 'WebPage', '@id': `${p.url}#webpage`, url: p.url, name: title, description, inLanguage: LANG,
      isPartOf: { '@id': `${SITE_URL}/#website` }, breadcrumb: { '@id': `${p.url}#breadcrumb` },
      primaryImageOfPage: { '@type': 'ImageObject', url: abs(p.cover.src), width: p.cover.w, height: p.cover.h },
      mainEntity: { '@id': `${p.url}#project` }, dateModified: today,
    },
    {
      '@type': 'CreativeWork', '@id': `${p.url}#project`, url: p.url, mainEntityOfPage: { '@id': `${p.url}#webpage` },
      name: p.brand, headline: p.headline, abstract: p.subtitle, description: p.overview,
      genre: p.scope, dateCreated: p.year, inLanguage: LANG, keywords: keywords.join(', '),
      creator: { '@id': `${SITE_URL}/#org` }, publisher: { '@id': `${SITE_URL}/#org` },
      image: [p.cover, ...p.shots].map((s) => abs(s.src)),
    },
  ];

  const meta = [['Year', p.year], ['Scope', p.scope], ...(p.time ? [['Timeline', p.time]] : [])]
    .map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join('');

  const rows = galleryGroups(p.shots).map((g) => {
    const items = g.items.map((s) =>
      `<a class="case-shot" href="${b}${s.src}" data-lb="${s.idx}"><img src="${b}${s.src}" width="${s.w}" height="${s.h}" alt="${esc(shotAlt(s, s.idx))}" loading="lazy" decoding="async"></a>`).join('');
    return `<div class="case-grid case-grid--${g.kind}${g.items.length <= 2 ? ' case-grid--few' : ''}">${items}</div>`;
  }).join('\n      ');

  const main = `
<header class="case-hero">
  <div class="ald-wrap">
    <nav class="case-crumbs" aria-label="Breadcrumb">
      <ol><li><a href="${b}">Home</a></li><li><a href="../">Work</a></li><li aria-current="page">${esc(p.brand)}</li></ol>
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

<section class="ald-stats-band" aria-label="${esc(p.brand)} in numbers">
  <ul class="ald-wrap ald-stats case-metrics">
${p.metrics.map((m) => `    <li class="ald-stat"><div class="ald-stat-n">${esc(m.v)}</div><div class="ald-stat-l">${esc(m.l)}</div></li>`).join('\n')}
  </ul>
</section>

<section class="ald-sec">
  <div class="ald-wrap">
    <div class="case-block case-rv">
      <h2 class="ald-eyebrow has-idx case-label"><span class="ald-idx">01</span> / Overview</h2>
      <p class="case-text case-text--lead">${esc(p.overview)}</p>
    </div>
    <div class="case-block case-rv">
      <h2 class="ald-eyebrow has-idx case-label"><span class="ald-idx">02</span> / The problem</h2>
      <p class="case-text">${esc(p.problem)}</p>
    </div>
    <div class="case-block case-rv">
      <h2 class="ald-eyebrow has-idx case-label"><span class="ald-idx">03</span> / Our approach</h2>
      <p class="case-text">${esc(p.approach)}</p>
    </div>
  </div>
</section>

<section class="ald-sec ald-sec--dark">
  <div class="ald-wrap">
    <div class="case-block case-rv">
      <h2 class="ald-eyebrow has-idx case-label"><span class="ald-idx">04</span> / The result</h2>
      <p class="case-text case-text--result">${esc(p.result)}</p>
    </div>
  </div>
</section>

<section class="ald-sec" aria-labelledby="features">
  <div class="ald-wrap">
    <header class="ald-head case-rv">
      <div>
        <p class="ald-eyebrow has-idx"><span class="ald-idx">05</span> / Key features</p>
        <h2 class="ald-h2" id="features">What it does<span class="ald-dot">.</span></h2>
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
        <p class="ald-eyebrow has-idx"><span class="ald-idx">06</span> / Architecture</p>
        <h2 class="ald-h2" id="architecture">How it is built<span class="ald-dot">.</span></h2>
      </div>
    </header>
    <ol class="case-arch">
${p.architecture.map((a) => `      <li class="case-rv"><h3>${esc(a.t)}</h3><p>${esc(a.d)}</p></li>`).join('\n')}
    </ol>
    <header class="ald-head case-head-2 case-rv">
      <div>
        <p class="ald-eyebrow has-idx"><span class="ald-idx">07</span> / Technology</p>
        <h2 class="ald-h2" id="stack">Tech stack<span class="ald-dot">.</span></h2>
      </div>
    </header>
    <dl class="case-stack" aria-labelledby="stack">
${p.stack.map((g) => `      <div class="case-rv"><dt>${esc(g.k)}</dt><dd><ul class="ald-chips">${g.v.map((t) => `<li class="ald-chip">${esc(t)}</li>`).join('')}</ul></dd></div>`).join('\n')}
    </dl>
  </div>
</section>

<section class="ald-sec" aria-labelledby="screens">
  <div class="ald-wrap">
    <header class="ald-head case-rv">
      <div>
        <p class="ald-eyebrow has-idx"><span class="ald-idx">08</span> / Screens</p>
        <h2 class="ald-h2" id="screens">${p.shots.length} ${p.shots.length === 1 ? 'screen' : 'screens'} from the product<span class="ald-dot">.</span></h2>
      </div>
      <p class="ald-lead">Select a screen to see it full size.</p>
    </header>
    <div class="case-shots" data-gallery>
      ${rows}
    </div>
  </div>
</section>

<section class="ald-sec ald-sec--alt" aria-labelledby="related">
  <div class="ald-wrap">
    <header class="ald-head case-rv">
      <div>
        <p class="ald-eyebrow has-idx"><span class="ald-idx">09</span> / More work</p>
        <h2 class="ald-h2" id="related">Related projects<span class="ald-dot">.</span></h2>
      </div>
      <p class="ald-lead">More ${esc(p.scope.toLowerCase())} and neighbouring work from the same studio.</p>
    </header>
    <ol class="hub-grid case-related">
${relatedFor(p).map((r) => hubCard(r, b, false)).join('\n')}
    </ol>
  </div>
</section>

<nav class="case-pager" aria-label="More projects">
  <a href="${b}${prev.path}" rel="prev"><span class="case-pager-k">← Previous project</span><span class="case-pager-n">${esc(prev.brand)}</span></a>
  <a href="${b}${next.path}" rel="next"><span class="case-pager-k">Next project →</span><span class="case-pager-n">${esc(next.brand)}</span></a>
</nav>

<section class="ald-sec ald-sec--dark case-cta">
  <div class="ald-wrap">
    <h2 class="ald-contact-h">Have a similar<br>idea<span class="ald-dot">?</span></h2>
    <p class="ald-contact-s">Let’s make it real. <span class="ald-dot">♥</span></p>
    <div class="case-cta-actions">
      <a href="${b}#contact" class="ald-btn">Start something <span class="ald-dot">♥</span></a>
      <a href="mailto:${EMAIL}" class="ald-contact-mail">${EMAIL}</a>
      <a href="../" class="ald-link">All projects →</a>
    </div>
  </div>
</section>`;

  const lightbox = `<dialog class="case-lb" id="lightbox" aria-label="${esc(p.brand)} screenshot viewer">
  <button type="button" class="case-lb-btn case-lb-close" aria-label="Close viewer">×</button>
  <button type="button" class="case-lb-btn case-lb-prev" aria-label="Previous screen">←</button>
  <figure class="case-lb-fig"><img alt="" decoding="async"><figcaption class="case-lb-cap" aria-live="polite"></figcaption></figure>
  <button type="button" class="case-lb-btn case-lb-next" aria-label="Next screen">→</button>
</dialog>`;

  return page({
    b, hubHref: '../', hubCurrent: false,
    headHtml: head({ b, title, description, canonical: p.url, image, imageType: 'image/jpeg', imageAlt: p.coverAlt, graph }),
    main, extra: lightbox,
  });
}

// ───────────────────────────── /work/ hub ─────────────────────────────
function hubPage() {
  const b = '../';
  const url = `${SITE_URL}/work/`;
  const scopes = [...new Set(projects.map((p) => p.scope))];
  const title = `Selected work — ${projects.length} digital products | ${NAME}`;
  const description = clip(`${projects.length} products built by ${NAME}: ${scopes.join(', ').toLowerCase()} — mobile apps, web platforms and AI tools, each with the problem, approach and result behind it.`, 158);
  const graph = [
    orgNode, siteNode,
    {
      '@type': 'BreadcrumbList', '@id': `${url}#breadcrumb`,
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE_URL}/` },
        { '@type': 'ListItem', position: 2, name: 'Work', item: url },
      ],
    },
    {
      '@type': 'CollectionPage', '@id': `${url}#webpage`, url, name: title, description, inLanguage: LANG,
      isPartOf: { '@id': `${SITE_URL}/#website` }, breadcrumb: { '@id': `${url}#breadcrumb` },
      primaryImageOfPage: { '@type': 'ImageObject', url: abs(OG_IMAGE), width: 1200, height: 630 },
      mainEntity: { '@id': `${url}#projects` }, dateModified: today,
    },
    {
      '@type': 'ItemList', '@id': `${url}#projects`, name: 'Selected work', numberOfItems: projects.length,
      itemListElement: projects.map((p) => ({ '@type': 'ListItem', position: p.n, url: p.url, name: p.brand })),
    },
  ];
  const cards = projects.map((p) => hubCard(p, b, p.n <= 3, 2)).join('\n');

  const main = `
<header class="case-hero">
  <div class="ald-wrap">
    <nav class="case-crumbs" aria-label="Breadcrumb">
      <ol><li><a href="${b}">Home</a></li><li aria-current="page">Work</li></ol>
    </nav>
    <p class="ald-eyebrow has-idx"><span class="ald-idx">03</span> / Selected work</p>
    <h1 class="case-h1"><span class="case-title case-title--hub">Things we <span class="ald-dot">♥</span> made<span class="ald-dot">.</span></span></h1>
    <p class="ald-lead case-sub">Every project, a different problem — one approach: understand the business, ship something real, then make the numbers move. ${projects.length} products across ${scopes.length} areas.</p>
  </div>
</header>
<section class="ald-sec hub-sec" aria-label="All projects">
  <div class="ald-wrap">
    <ol class="hub-grid">
${cards}
    </ol>
  </div>
</section>
<section class="ald-sec ald-sec--dark case-cta">
  <div class="ald-wrap">
    <h2 class="ald-contact-h">Your problem<br>could be next<span class="ald-dot">.</span></h2>
    <p class="ald-contact-s">Tell us what you want to change. <span class="ald-dot">♥</span></p>
    <div class="case-cta-actions">
      <a href="${b}#contact" class="ald-btn">Start something <span class="ald-dot">♥</span></a>
      <a href="mailto:${EMAIL}" class="ald-contact-mail">${EMAIL}</a>
    </div>
  </div>
</section>`;

  return page({
    b, hubHref: './', hubCurrent: true,
    headHtml: head({ b, title, description, canonical: url, image: abs(OG_IMAGE), imageType: 'image/png', imageAlt: 'AILoveDigital — selected work', graph }),
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
    b, hubHref: `${b}work/`, hubCurrent: false,
    headHtml: head({ b, title: `Page not found | ${NAME}`, description: 'This page does not exist.', canonical: '', image: abs(OG_IMAGE), imageType: 'image/png', imageAlt: NAME, robots: 'noindex,follow' }),
    main,
  });
}

// ───────────────────────────── home-page data block ─────────────────────────────
// Single-quoted JS string literal, matching the style of the surrounding component code.
const q = (s) => `'${String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
const workAllLiteral = `const workData = [
${projects.map((p) => `      { name: ${q(p.name)}, line: ${q(p.line)}, year: ${q(p.year)}, scope: ${q(p.scope)}, time: ${q(p.time || '')}, m1: ${q(p.chips[0])}, m2: ${q(p.chips[1])}, m3: ${q(p.chips[2])}, slug: ${q(p.slug)}, img: ${q('./' + p.homeImg)}, href: ${q('./' + p.path)} },`).join('\n')}
    ];`;

const home = read('index.html');
const re = /(\/\/ workAll:start[^\n]*\n\s*)const workData = \[[\s\S]*?\n\s*\];(\s*\n\s*\/\/ workAll:end)/;
if (!re.test(home)) throw new Error('index.html: "// workAll:start … // workAll:end" markers not found around const workData');
write('index.html', home.replace(re, (_, a, c) => a + workAllLiteral + c));

// ───────────────────────────── write pages ─────────────────────────────
write('work/index.html', hubPage());
write('404.html', notFoundPage());
projects.forEach((p, i) => write(`work/${p.slug}/index.html`, casePage(p, i)));

const longTitles = projects.filter((p) => pageTitle(p).length > 72).map((p) => p.slug);
console.log(`work: hub + ${projects.length} case pages + 404, home workAll refreshed${longTitles.length ? ` (long <title>: ${longTitles.join(', ')})` : ''}`);
