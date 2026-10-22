#!/usr/bin/env node
// Generates everything search engines and non-JS crawlers need, from the same data the
// page renders (the arrays inside index.html's component script), so nothing drifts:
//
//   index.html  <!-- head:start --> … <!-- head:end -->          title, meta, Open Graph, Twitter, hreflang,
//                                                                 JSON-LD, icons, fonts, resource hints
//   index.html  <!-- noscript:start --> … <!-- noscript:end -->   readable copy of the page for
//                                                                 crawlers/visitors without JavaScript
//   index.html  <!-- langmenu:start --> … <!-- langmenu:end -->   the nav's language dropdown
//   ru/index.html, az/index.html                                  the home page in every other language:
//                                                                 index.html with i18n/<lang>.json → "home"
//                                                                 applied, then the blocks above regenerated
//   robots.txt, sitemap.xml (with hreflang alternates), llms.txt, site.webmanifest
//
// Run after changing projects, services or copy:   npm run build   (build-work.mjs first, then this)
// Edit the CONFIG in scripts/lib/site.mjs (not the generated blocks) to change the English meta text or
// the domain; i18n/<lang>.json for the other languages.

import {
  SITE_URL, NAME, EMAIL, PHONE_TEL, INSTAGRAM, LINKEDIN, MAPS, LANG, BG, OG_IMAGE,
  read, write, abs, esc, loadProjects,
} from './lib/site.mjs';
import {
  LANGS, LOCALES, DEFAULT_LANG, strings, localizeProjects, langMenu, hreflangLinks, ogLocaleTags, urlIn, workDataLiteral,
} from './lib/i18n.mjs';

const source = read('index.html'); // English, with workAll already refreshed by build-work.mjs
const support = read('js/support.js');
const projects = loadProjects();

// "BUILD" → "Build", "İNKİŞAF" → "İnkişaf" (locale-aware: Azerbaijani I/İ lower-case differently)
const cap = (s, lang) => s.charAt(0) + s.slice(1).toLocaleLowerCase(lang);

// Pull `const <name> = [ … ]` out of the component script and evaluate just that literal.
function grabArray(html, name) {
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

function replaceBlock(src, name, block) {
  const re = new RegExp(`<!-- ${name}:start[\\s\\S]*?<!-- ${name}:end -->`);
  if (!re.test(src)) throw new Error(`marker "${name}" missing in index.html`);
  return src.replace(re, () => block);
}

// React comes from unpkg (see support.js); preload it with the same SRI so the browser starts
// the download in parallel with support.js instead of after it.
const cdn = (name) => ({
  url: support.match(new RegExp(`var ${name}_URL = "([^"]+)"`))?.[1],
  sri: support.match(new RegExp(`var ${name}_SRI = "([^"]+)"`))?.[1],
});
const react = cdn('REACT'), reactDom = cdn('REACT_DOM');
if (!react.url || !react.sri || !reactDom.url || !reactDom.sri) throw new Error('could not read React URLs/SRI from js/support.js');

/** index.html → the same page in `lang`: translated copy, paths one level deeper, its own work cards. */
function translateHome(lang, work) {
  if (lang === DEFAULT_LANG) return source;
  let html = source;
  for (const [en, tr] of strings(lang).home) {
    if (!html.includes(en)) throw new Error(`i18n/${lang}.json: home fragment no longer in index.html — update it:\n  ${en}`);
    html = html.split(en).join(tr);
  }
  html = html
    .replace('<html lang="en">', `<html lang="${lang}">`)
    .replace(/(src|href)="\.\/(js|css|assets)\//g, '$1="../$2/')
    .replace(/const workData = \[[\s\S]*?\n\s*\];/, () => workDataLiteral(work, '../'));
  return html;
}

function buildHome(lang) {
  const { ui: t, meta } = strings(lang);
  const pre = LOCALES[lang].prefix;
  const b = pre ? '../' : './';
  const url = urlIn(lang);
  const work = localizeProjects(projects, lang);
  let html = translateHome(lang, work);

  const services = grabArray(html, 'svcData');
  const steps = grabArray(html, 'steps');
  const values = grabArray(html, 'values');
  const nextSteps = grabArray(html, 'next');

  // ───────────── <head> block ─────────────
  const graph = [
    {
      '@type': ['Organization', 'ProfessionalService'],
      '@id': `${SITE_URL}/#org`,
      name: NAME,
      url: `${SITE_URL}/`,
      logo: { '@type': 'ImageObject', url: abs('assets/icons/icon-512.png'), width: 512, height: 512 },
      image: abs(OG_IMAGE),
      email: EMAIL,
      telephone: PHONE_TEL,
      sameAs: [INSTAGRAM, LINKEDIN],
      address: { '@type': 'PostalAddress', streetAddress: 'Altis Plaza', addressRegion: 'Binagadi district', addressLocality: 'Baku', addressCountry: 'AZ' },
      hasMap: MAPS,
      description: meta.description,
      slogan: meta.slogan,
      knowsAbout: ['Web development', 'Mobile apps', 'AI automation', 'Workflow automation', 'Digital marketing', 'AI training', 'Technology consulting', 'Digital transformation'],
      hasOfferCatalog: {
        '@type': 'OfferCatalog',
        name: t.services,
        itemListElement: services.map((s) => ({
          '@type': 'Offer',
          itemOffered: { '@type': 'Service', name: cap(s.word, lang), description: s.desc, serviceType: s.tags.split(' · ').join(', '), provider: { '@id': `${SITE_URL}/#org` } },
        })),
      },
    },
    { '@type': 'WebSite', '@id': `${SITE_URL}/#website`, url: `${SITE_URL}/`, name: NAME, description: strings(DEFAULT_LANG).meta.description, inLanguage: LANGS, publisher: { '@id': `${SITE_URL}/#org` } },
    {
      '@type': 'WebPage', '@id': `${url}#webpage`, url, name: meta.title, description: meta.description, inLanguage: lang,
      isPartOf: { '@id': `${SITE_URL}/#website` }, about: { '@id': `${SITE_URL}/#org` },
      primaryImageOfPage: { '@type': 'ImageObject', url: abs(OG_IMAGE), width: 1200, height: 630 },
    },
    {
      '@type': 'ItemList', '@id': `${url}#work`, name: t.selectedWork, numberOfItems: work.length,
      itemListElement: work.map((w) => ({
        '@type': 'ListItem', position: w.n,
        item: { '@type': 'CreativeWork', '@id': `${w.url}#project`, url: w.url, name: w.brand, description: w.line, genre: w.scope, dateCreated: w.year, inLanguage: lang, image: abs(w.homeImg), creator: { '@id': `${SITE_URL}/#org` } },
      })),
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
<meta name="theme-color" content="${BG}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="${NAME}">
${ogLocaleTags(lang)}
<meta property="og:url" content="${url}">
<meta property="og:title" content="${esc(meta.title)}">
<meta property="og:description" content="${esc(meta.description)}">
<meta property="og:image" content="${abs(OG_IMAGE)}">
<meta property="og:image:type" content="image/png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="${esc(meta.ogAlt)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(meta.title)}">
<meta name="twitter:description" content="${esc(meta.description)}">
<meta name="twitter:image" content="${abs(OG_IMAGE)}">
<meta name="twitter:image:alt" content="${esc(meta.ogAlt)}">
<link rel="icon" href="${b}assets/icons/favicon.svg" type="image/svg+xml">
<link rel="icon" href="${b}assets/icons/favicon-32.png" sizes="32x32" type="image/png">
<link rel="icon" href="${b}assets/icons/favicon-48.png" sizes="48x48" type="image/png">
<link rel="shortcut icon" href="${b}favicon.ico">
<link rel="apple-touch-icon" href="${b}assets/icons/apple-touch-icon.png">
<link rel="manifest" href="${b}site.webmanifest">
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

  // ───────────── <noscript> block ─────────────
  const others = LANGS.filter((l) => l !== lang).map((l) => `<a href="${b}${LOCALES[l].prefix}" lang="${l}" hreflang="${l}">${LOCALES[l].label}</a>`).join(' · ');
  const noscriptBlock = `<!-- noscript:start — generated by scripts/build-seo.mjs, edit the script instead -->
<noscript>
<article class="nojs">
<h1>${NAME}</h1>
<p><strong>${esc(meta.tagline)}</strong></p>
<p>${esc(meta.description)}</p>
<h2>${esc(t.nsServices)}</h2>
<ul>
${services.map((s) => `<li><strong>${esc(cap(s.word, lang))}</strong> — ${esc(s.desc)} <em>${esc(s.tags)}</em></li>`).join('\n')}
</ul>
<h2>${esc(t.nsWork)}</h2>
<ol>
${work.map((w) => `<li><h3><a href="${w.path}">${esc(w.brand)}</a></h3><p>${esc(w.line)}</p><p>${esc(w.scope)} · ${esc(w.year)}</p><ul>${w.chips.map((m) => `<li>${esc(m)}</li>`).join('')}</ul></li>`).join('\n')}
</ol>
<p><a href="work/">${esc(t.nsAll)}</a></p>
<h2>${esc(t.nsProcess)}</h2>
<ol>
${steps.map((s) => `<li><strong>${esc(s.t)}</strong> — ${esc(s.d)}</li>`).join('\n')}
</ol>
<h2>${esc(t.nsWho)}</h2>
<ul>
${values.map((v) => `<li><strong>${esc(v.t)}</strong> — ${esc(v.d)}</li>`).join('\n')}
</ul>
<h2>${esc(t.nsContact)}</h2>
<p>${esc(t.nsEmail)} <a href="mailto:${EMAIL}">${EMAIL}</a>. ${esc(t.nsNext)}</p>
<ol>
${nextSteps.map((s) => `<li>${esc(s.t)}</li>`).join('\n')}
</ol>
<p>${esc(meta.slogan)}</p>
<p>${others}</p>
</article>
</noscript>
<!-- noscript:end -->`;

  // ───────────── language menu ─────────────
  const hrefs = Object.fromEntries(LANGS.map((l) => [l, `${b}${LOCALES[l].prefix}`]));
  const menuBlock = `<!-- langmenu:start — generated by scripts/build-seo.mjs, edit scripts/lib/i18n.mjs instead -->
    ${langMenu(lang, hrefs, { indent: '    ', hreflangAttr: false })}
    <!-- langmenu:end -->`;

  html = replaceBlock(html, 'head', headBlock);
  html = replaceBlock(html, 'noscript', noscriptBlock);
  html = replaceBlock(html, 'langmenu', menuBlock);
  write(`${pre}index.html`, html);
  return { lang, services, work };
}

const homes = LANGS.map(buildHome);
const en = homes[0];

// ───────────────────────────── standalone files ─────────────────────────────
const today = new Date().toISOString().slice(0, 10);
const imgs = (list) => list.map((u) => `    <image:image><image:loc>${abs(u)}</image:loc></image:image>`).join('\n');
const alternates = (path) => [...LANGS.map((l) => `    <xhtml:link rel="alternate" hreflang="${l}" href="${urlIn(l, path)}"/>`),
  `    <xhtml:link rel="alternate" hreflang="x-default" href="${urlIn(DEFAULT_LANG, path)}"/>`].join('\n');
const pages = [
  { path: '', images: [OG_IMAGE, ...projects.map((w) => w.homeImg)] },
  { path: 'work/', images: [] },
  { path: 'privacy/', images: [] },
  ...projects.map((w) => ({ path: w.path, images: [w.cover.src] })),
];
const urls = pages.flatMap(({ path, images }) => LANGS.map((l) => `  <url>
    <loc>${urlIn(l, path)}</loc>
    <lastmod>${today}</lastmod>
${alternates(path)}${images.length ? '\n' + imgs(images) : ''}
  </url>`));
write('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${urls.join('\n')}
</urlset>
`);

write('robots.txt', `User-agent: *
Allow: /
# repo tooling — not part of the site; keep it out of search results if the whole folder is deployed
Disallow: /tools/
Disallow: /scripts/
Disallow: /data/
Disallow: /i18n/

Sitemap: ${SITE_URL}/sitemap.xml
`);

const enMeta = strings(DEFAULT_LANG).meta;
write('llms.txt', `# ${NAME}

> ${enMeta.description}

${enMeta.tagline} ${enMeta.slogan}

## Services
${en.services.map((s) => `- ${cap(s.word, 'en')}: ${s.desc} (${s.tags})`).join('\n')}

## Selected work
${en.work.map((w) => `- [${w.brand}](${w.url}): ${w.headline}. ${w.subtitle} [${w.scope}, ${w.year}]`).join('\n')}
- [All projects](${SITE_URL}/work/)

## Languages
${LANGS.map((l) => `- ${LOCALES[l].label}: [home](${urlIn(l)}), [projects](${urlIn(l, 'work/')})`).join('\n')}

## Contact
- Email: ${EMAIL}
- Website: ${SITE_URL}/
`);

write('site.webmanifest', JSON.stringify({
  name: NAME, short_name: NAME, description: enMeta.description, lang: LANG, start_url: './', scope: './', display: 'browser',
  theme_color: BG, background_color: BG,
  icons: [
    { src: './assets/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
    { src: './assets/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
  ],
}, null, 2) + '\n');

console.log(`seo: home in ${LANGS.join('/')} (head + noscript + language menu), sitemap.xml (${urls.length} URLs with hreflang), robots.txt, llms.txt, site.webmanifest`);
