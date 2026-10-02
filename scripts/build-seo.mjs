#!/usr/bin/env node
// Generates everything search engines and non-JS crawlers need, from the same data the
// page renders (the arrays inside index.html's component script), so nothing drifts:
//
//   index.html  <!-- head:start --> … <!-- head:end -->        title, meta, Open Graph, Twitter,
//                                                               JSON-LD, icons, fonts, resource hints
//   index.html  <!-- noscript:start --> … <!-- noscript:end --> readable copy of the page for
//                                                               crawlers/visitors without JavaScript
//   robots.txt, sitemap.xml, llms.txt, site.webmanifest
//
// Run after changing projects, services or copy:   node scripts/build-seo.mjs
// Edit the CONFIG below (not the generated blocks) to change the meta text or the domain.

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

// ───────────────────────────── CONFIG ─────────────────────────────
const SITE_URL = 'https://ailovedigital.com'; // ← production origin, no trailing slash
const NAME = 'AILoveDigital';
const TITLE = 'AILoveDigital — AI, Technology & Business Growth';
const DESCRIPTION =
  'AILoveDigital is a technology and creative studio. We build digital products, automate operations with AI and turn both into measurable business growth.';
const TAGLINE = 'And we make businesses love it too.';
const SLOGAN = 'Built with logic. Finished with love.';
const EMAIL = 'info@ailovedigital.com';
const LOCALE = 'en_US';
const LANG = 'en';
const BG = '#F7F5F0';
const OG_IMAGE = '/assets/images/og-image.png';
const OG_ALT = 'AILoveDigital — pixel heart logo and the tagline "AI, Technology & Business Growth"';
// Display names are upper-cased in the UI; structured data should carry the real brand names.
const BRAND = {
  chefmarket: 'ChefMarket', vicdoor: 'Vicdoor', altiscassa: 'AltisCassa', 'e-hesab': 'e-Hesab',
  'e-faktura': 'E-Faktura', insanis: 'İnsanİş', suntech: 'Suntech', 'nitro-garage': 'Nitro Garage',
  jobremotely: 'JobRemotely', moleaks: 'Moleaks', safemole: 'Safemole', rana: 'Rana',
  guraba: 'Guraba', parkhub: 'ParkHub', 'arsa-creative': 'Arsa Creative', 'marka-house': 'Marka House',
};
// ──────────────────────────────────────────────────────────────────

const read = (f) => readFileSync(join(ROOT, f), 'utf8');
const write = (f, s) => writeFileSync(join(ROOT, f), s);
const abs = (p) => (p.startsWith('http') ? p : SITE_URL + '/' + p.replace(/^\.?\//, ''));
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const cap = (s) => s.charAt(0) + s.slice(1).toLowerCase();

const html = read('index.html');
const support = read('js/support.js');

// Pull `const <name> = [ … ]` out of the component script and evaluate just that literal.
function grabArray(name) {
  const start = html.indexOf(`const ${name} = [`);
  if (start < 0) throw new Error(`array "${name}" not found in index.html`);
  let i = html.indexOf('[', start), depth = 0, quote = null;
  const from = i;
  for (; i < html.length; i++) {
    const c = html[i];
    if (quote) { if (c === '\\') i++; else if (c === quote) quote = null; continue; }
    if (c === "'" || c === '"' || c === '`') { quote = c; continue; }
    if (c === '[') depth++;
    if (c === ']' && --depth === 0) break;
  }
  return new Function(`return ${html.slice(from, i + 1)}`)();
}

const services = grabArray('svcData');
const steps = grabArray('steps');
const values = grabArray('values');
const nextSteps = grabArray('next');
const work = grabArray('workAll').map((w, i) => ({ ...w, brand: BRAND[w.slot.replace(/^case-/, '')] || cap(w.name), n: i + 1 }));
if (work.length === 0 || work.some((w) => !w.line || !w.img)) throw new Error('work data is incomplete');

// React comes from unpkg (see support.js); preload it with the same SRI so the browser starts
// the download in parallel with support.js instead of after it.
const cdn = (name) => ({
  url: support.match(new RegExp(`var ${name}_URL = "([^"]+)"`))?.[1],
  sri: support.match(new RegExp(`var ${name}_SRI = "([^"]+)"`))?.[1],
});
const react = cdn('REACT'), reactDom = cdn('REACT_DOM');
if (!react.url || !react.sri || !reactDom.url || !reactDom.sri) throw new Error('could not read React URLs/SRI from js/support.js');

// ───────────────────────────── <head> block ─────────────────────────────
const graph = [
  {
    '@type': ['Organization', 'ProfessionalService'],
    '@id': `${SITE_URL}/#org`,
    name: NAME,
    url: `${SITE_URL}/`,
    logo: { '@type': 'ImageObject', url: abs('assets/icons/icon-512.png'), width: 512, height: 512 },
    image: abs(OG_IMAGE),
    email: EMAIL,
    description: DESCRIPTION,
    slogan: SLOGAN,
    knowsAbout: ['Web development', 'Mobile apps', 'AI automation', 'Workflow automation', 'Digital marketing', 'AI training', 'Technology consulting', 'Digital transformation'],
    hasOfferCatalog: {
      '@type': 'OfferCatalog',
      name: 'Services',
      itemListElement: services.map((s) => ({
        '@type': 'Offer',
        itemOffered: { '@type': 'Service', name: cap(s.word), description: s.desc, serviceType: s.tags.split(' · ').join(', '), provider: { '@id': `${SITE_URL}/#org` } },
      })),
    },
  },
  { '@type': 'WebSite', '@id': `${SITE_URL}/#website`, url: `${SITE_URL}/`, name: NAME, description: DESCRIPTION, inLanguage: LANG, publisher: { '@id': `${SITE_URL}/#org` } },
  {
    '@type': 'WebPage', '@id': `${SITE_URL}/#webpage`, url: `${SITE_URL}/`, name: TITLE, description: DESCRIPTION, inLanguage: LANG,
    isPartOf: { '@id': `${SITE_URL}/#website` }, about: { '@id': `${SITE_URL}/#org` },
    primaryImageOfPage: { '@type': 'ImageObject', url: abs(OG_IMAGE), width: 1200, height: 630 },
  },
  {
    '@type': 'ItemList', '@id': `${SITE_URL}/#work`, name: 'Selected work', numberOfItems: work.length,
    itemListElement: work.map((w) => ({
      '@type': 'ListItem', position: w.n,
      item: { '@type': 'CreativeWork', name: w.brand, description: w.line, genre: w.scope, dateCreated: w.year, image: abs(w.img), creator: { '@id': `${SITE_URL}/#org` } },
    })),
  },
];
const jsonLd = JSON.stringify({ '@context': 'https://schema.org', '@graph': graph }, null, 2).replace(/<\//g, '<\\/');

const headBlock = `<!-- head:start — generated by scripts/build-seo.mjs, edit the script instead -->
<title>${esc(TITLE)}</title>
<meta name="description" content="${esc(DESCRIPTION)}">
<link rel="canonical" href="${SITE_URL}/">
<meta name="robots" content="index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1">
<meta name="author" content="${NAME}">
<meta name="theme-color" content="${BG}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="${NAME}">
<meta property="og:locale" content="${LOCALE}">
<meta property="og:url" content="${SITE_URL}/">
<meta property="og:title" content="${esc(TITLE)}">
<meta property="og:description" content="${esc(DESCRIPTION)}">
<meta property="og:image" content="${abs(OG_IMAGE)}">
<meta property="og:image:type" content="image/png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="${esc(OG_ALT)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(TITLE)}">
<meta name="twitter:description" content="${esc(DESCRIPTION)}">
<meta name="twitter:image" content="${abs(OG_IMAGE)}">
<meta name="twitter:image:alt" content="${esc(OG_ALT)}">
<link rel="icon" href="./assets/icons/favicon.svg" type="image/svg+xml">
<link rel="icon" href="./assets/icons/favicon-32.png" sizes="32x32" type="image/png">
<link rel="icon" href="./assets/icons/favicon-48.png" sizes="48x48" type="image/png">
<link rel="shortcut icon" href="./favicon.ico">
<link rel="apple-touch-icon" href="./assets/icons/apple-touch-icon.png">
<link rel="manifest" href="./site.webmanifest">
<link rel="preconnect" href="https://unpkg.com" crossorigin>
<link rel="preload" as="script" href="${react.url}" integrity="${react.sri}" crossorigin="anonymous">
<link rel="preload" as="script" href="${reactDom.url}" integrity="${reactDom.sri}" crossorigin="anonymous">
<link rel="preconnect" href="https://cdnjs.cloudflare.com" crossorigin>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&family=Geist+Mono:wght@400;500&display=swap">
<script type="application/ld+json">
${jsonLd}
</script>
<noscript><style>x-dc{display:none!important}body{background:${BG}}.nojs{max-width:760px;margin:0 auto;padding:48px 20px;font:16px/1.6 -apple-system,'Helvetica Neue',Arial,sans-serif;color:#0B0B0B}.nojs a{color:#FF304D}.nojs h1{font-size:44px;line-height:1.05;margin:0 0 8px}.nojs h2{margin:40px 0 12px}.nojs li{margin:0 0 14px}</style></noscript>
<!-- head:end -->`;

// ───────────────────────────── <noscript> block ─────────────────────────────
const noscriptBlock = `<!-- noscript:start — generated by scripts/build-seo.mjs, edit the script instead -->
<noscript>
<article class="nojs">
<h1>${NAME}</h1>
<p><strong>${esc(TAGLINE)}</strong></p>
<p>${esc(DESCRIPTION)}</p>
<h2>Five things we love doing</h2>
<ul>
${services.map((s) => `<li><strong>${esc(cap(s.word))}</strong> — ${esc(s.desc)} <em>${esc(s.tags)}</em></li>`).join('\n')}
</ul>
<h2>Selected work</h2>
<ol>
${work.map((w) => `<li><h3>${esc(w.brand)}</h3><p>${esc(w.line)}</p><p>${esc(w.scope)} · ${esc(w.year)}</p><ul>${[w.m1, w.m2, w.m3].map((m) => `<li>${esc(m)}</li>`).join('')}</ul></li>`).join('\n')}
</ol>
<h2>How we work</h2>
<ol>
${steps.map((s) => `<li><strong>${esc(s.t)}</strong> — ${esc(s.d)}</li>`).join('\n')}
</ol>
<h2>Who we are</h2>
<ul>
${values.map((v) => `<li><strong>${esc(v.t)}</strong> — ${esc(v.d)}</li>`).join('\n')}
</ul>
<h2>Contact</h2>
<p>Email <a href="mailto:${EMAIL}">${EMAIL}</a>. What happens next:</p>
<ol>
${nextSteps.map((s) => `<li>${esc(s.t)}</li>`).join('\n')}
</ol>
<p>${esc(SLOGAN)}</p>
</article>
</noscript>
<!-- noscript:end -->`;

function replaceBlock(src, name, block) {
  const re = new RegExp(`<!-- ${name}:start[\\s\\S]*?<!-- ${name}:end -->`);
  if (!re.test(src)) throw new Error(`marker "${name}" missing in index.html`);
  return src.replace(re, () => block);
}
write('index.html', replaceBlock(replaceBlock(html, 'head', headBlock), 'noscript', noscriptBlock));

// ───────────────────────────── standalone files ─────────────────────────────
const today = new Date().toISOString().slice(0, 10);
write('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
  <url>
    <loc>${SITE_URL}/</loc>
    <lastmod>${today}</lastmod>
    <image:image><image:loc>${abs(OG_IMAGE)}</image:loc></image:image>
${work.map((w) => `    <image:image><image:loc>${abs(w.img)}</image:loc></image:image>`).join('\n')}
  </url>
</urlset>
`);

write('robots.txt', `User-agent: *
Allow: /

Sitemap: ${SITE_URL}/sitemap.xml
`);

write('llms.txt', `# ${NAME}

> ${DESCRIPTION}

${TAGLINE} ${SLOGAN}

## Services
${services.map((s) => `- ${cap(s.word)}: ${s.desc} (${s.tags})`).join('\n')}

## Selected work
${work.map((w) => `- ${w.brand} — ${w.line} [${w.scope}, ${w.year}]`).join('\n')}

## Contact
- Email: ${EMAIL}
- Website: ${SITE_URL}/
`);

write('site.webmanifest', JSON.stringify({
  name: NAME, short_name: NAME, description: DESCRIPTION, lang: LANG, start_url: './', scope: './', display: 'browser',
  theme_color: BG, background_color: BG,
  icons: [
    { src: './assets/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
    { src: './assets/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
  ],
}, null, 2) + '\n');

console.log(`seo: ${work.length} projects, ${services.length} services → index.html (head + noscript), sitemap.xml, robots.txt, llms.txt, site.webmanifest`);
