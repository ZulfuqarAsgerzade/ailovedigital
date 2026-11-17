// Shared by both build scripts: the company entity for JSON-LD, the service/about/contact page registry
// (data/services.json + data/services.<lang>.json) and the translated home-page source.

import { runInNewContext } from 'node:vm';
import {
  NAME, EMAIL, PHONE_TEL, INSTAGRAM, LINKEDIN, MAPS, OG_IMAGE, SITES, ORG_ID, WEBSITE_ID,
  OFFICE, LEGAL_NAME, TAX_ID, read,
} from './site.mjs';
import { LANGS, DEFAULT_LANG, strings, urlIn, originOf, pathIn } from './i18n.mjs';

// ───────────────────────────── service pages ─────────────────────────────
const STRUCT = JSON.parse(read('data/services.json'));
const textCache = {};
/** Text for the service/about/contact pages in `lang` (data/services.<lang>.json), checked against the structure. */
export function pageText(lang) {
  if (textCache[lang]) return textCache[lang];
  const t = JSON.parse(read(`data/services.${lang}.json`));
  for (const s of STRUCT.services) {
    const x = t.services[s.key];
    if (!x) throw new Error(`data/services.${lang}.json: service "${s.key}" is missing`);
    for (const k of ['name', 'short', 'serviceType', 'title', 'description', 'h1', 'lead', 'intro', 'includes', 'pricing', 'faq']) {
      if (!x[k]) throw new Error(`data/services.${lang}.json: "${s.key}".${k} is missing`);
    }
  }
  return (textCache[lang] = t);
}

export const HUB_PATH = STRUCT.hub.path;
export const ABOUT_PATH = STRUCT.about.path;
export const CONTACT_PATH = STRUCT.contact.path;

/** Services in `lang` with their text, URL and per-language path map. */
export function servicesIn(lang) {
  const t = pageText(lang);
  return STRUCT.services.map((s) => ({ ...s, ...t.services[s.key], url: urlIn(lang, s.path), rel: pathIn(s.path, lang) }));
}
/** The services a case study is linked from (data/services.json → cases). */
export const servicesForCase = (slug, lang) => servicesIn(lang).filter((s) => s.cases.includes(slug));

// ───────────────────────────── JSON-LD ─────────────────────────────
// One company entity, the same @id on every page of both domains. The details mirror what the pages show
// (address, phone, e-mail); nothing here is claimed that a visitor cannot see on the site.
export function orgNode(lang) {
  return {
    '@type': ['Organization', 'ProfessionalService'],
    '@id': ORG_ID,
    name: NAME,
    alternateName: 'AI Love Digital',
    legalName: LEGAL_NAME.replace(/"/g, ''),
    taxID: TAX_ID,
    url: `${SITES.az.origin}/`,
    logo: { '@type': 'ImageObject', url: `${SITES.az.origin}/assets/icons/icon-512.png`, width: 512, height: 512 },
    image: `${SITES.az.origin}${OG_IMAGE}`,
    description: strings(lang).meta.description,
    slogan: strings(lang).meta.slogan,
    email: EMAIL,
    telephone: PHONE_TEL,
    address: { '@type': 'PostalAddress', streetAddress: OFFICE.street, addressRegion: OFFICE.district, addressLocality: OFFICE.city, addressCountry: OFFICE.country },
    hasMap: MAPS,
    areaServed: [{ '@type': 'City', name: 'Baku' }, { '@type': 'Country', name: 'Azerbaijan' }],
    contactPoint: [{ '@type': 'ContactPoint', contactType: 'customer service', telephone: PHONE_TEL, email: EMAIL, areaServed: 'AZ', availableLanguage: ['az', 'ru', 'en'] }],
    knowsLanguage: ['az', 'ru', 'en'],
    sameAs: [`${SITES.com.origin}/`, INSTAGRAM, LINKEDIN],
    knowsAbout: [
      'Website development', 'Mobile app development', 'E-commerce development', 'UI/UX design',
      'Artificial intelligence', 'AI chatbots', 'AI agents', 'Business process automation',
      'Social media marketing', 'Digital marketing', 'Search engine optimization', 'Google Ads', 'Meta Ads',
      'AI training', 'IT consulting', 'Digital transformation',
    ],
    hasOfferCatalog: {
      '@type': 'OfferCatalog',
      name: pageText(lang).ui.servicesNav,
      url: urlIn(lang, HUB_PATH),
      itemListElement: servicesIn(lang).map((s) => ({ '@type': 'Offer', itemOffered: { '@type': 'Service', '@id': `${s.url}#service`, name: s.name, url: s.url } })),
    },
  };
}

export const websiteNode = (lang) => ({
  '@type': 'WebSite', '@id': WEBSITE_ID(originOf(lang)), url: `${originOf(lang)}/`, name: NAME,
  inLanguage: LANGS.filter((l) => originOf(l) === originOf(lang)), publisher: { '@id': ORG_ID },
});

export const serviceNode = (s, lang) => ({
  '@type': 'Service', '@id': `${s.url}#service`, url: s.url, name: s.name, serviceType: s.serviceType,
  description: s.description, inLanguage: lang, provider: { '@id': ORG_ID },
  areaServed: [{ '@type': 'City', name: 'Baku' }, { '@type': 'Country', name: 'Azerbaijan' }],
  hasOfferCatalog: {
    '@type': 'OfferCatalog', name: s.name,
    itemListElement: s.includes.map((i) => ({ '@type': 'Offer', itemOffered: { '@type': 'Service', name: i.t, description: i.d } })),
  },
});

// ───────────────────────────── SMM packages ─────────────────────────────
// data/smm.json holds the numbers (packages, prices, portfolio) once; data/smm.<lang>.json the page text.
export const SMM = JSON.parse(read('data/smm.json'));
const smmCache = {};
export function smmText(lang) {
  if (smmCache[lang]) return smmCache[lang];
  const t = JSON.parse(read(`data/smm.${lang}.json`));
  for (const p of SMM.packages) if (!t.packages.items[p.key]) throw new Error(`data/smm.${lang}.json: package "${p.key}" is missing`);
  for (const a of SMM.portfolio) if (!t.portfolio.sectors[a.handle]) throw new Error(`data/smm.${lang}.json: portfolio sector for "${a.handle}" is missing`);
  return (smmCache[lang] = t);
}
/** 1300 → "1 300" (az/ru) or "1,300" (en). */
export const money = (n, lang) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, lang === 'en' ? ',' : ' ');

/** The SMM service with a priced offer per package (and per Dailoq option) — what Google and AI answers read as prices. */
export function smmServiceNode(s, lang) {
  const T = smmText(lang).packages;
  const offer = (p, price, suffix) => ({
    '@type': 'Offer', '@id': `${s.url}#offer-${p.key}${suffix ? '-dailoq' : ''}`, url: `${s.url}#packages`,
    name: `${p.name}${suffix ? ` · ${T.withD}` : ''}`, description: T.items[p.key].features.join(', '),
    price, priceCurrency: SMM.currency, availability: 'https://schema.org/InStock', seller: { '@id': ORG_ID },
    priceSpecification: { '@type': 'UnitPriceSpecification', price, priceCurrency: SMM.currency, unitCode: 'MON', referenceQuantity: { '@type': 'QuantitativeValue', value: 1, unitCode: 'MON' } },
  });
  const offers = SMM.packages.flatMap((p) => [offer(p, p.price, false), ...(p.priceDailoq ? [offer(p, p.priceDailoq, true)] : [])]);
  return {
    ...serviceNode(s, lang),
    offers: { '@type': 'AggregateOffer', priceCurrency: SMM.currency, lowPrice: Math.min(...offers.map((o) => o.price)), highPrice: Math.max(...offers.map((o) => o.price)), offerCount: offers.length },
    hasOfferCatalog: { '@type': 'OfferCatalog', name: `${s.name} — ${T.eyebrow || 'packages'}`, itemListElement: offers },
  };
}

export const faqNode = (url, faq) => ({
  '@type': 'FAQPage', '@id': `${url}#faq`,
  mainEntity: faq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
});

export const crumbsNode = (url, items) => ({
  '@type': 'BreadcrumbList', '@id': `${url}#breadcrumb`,
  itemListElement: items.map(([name, item], i) => ({ '@type': 'ListItem', position: i + 1, name, item })),
});

// ───────────────────────────── home-page source ─────────────────────────────
/** Pull `const <name> = [ … ]` out of the home page's component script (the repo's own index.html) and
 *  evaluate just that array literal in an empty sandbox. */
export function grabArray(html, name) {
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
  return runInNewContext(`(${html.slice(from, i + 1)})`, Object.create(null), { timeout: 1000 });
}

/** index.html with i18n/<lang>.json → "home" applied (copy only; paths and generated blocks untouched). */
export function translatedSource(lang, source = read('index.html')) {
  if (lang === DEFAULT_LANG) return source;
  let html = source;
  for (const [en, tr] of strings(lang).home) {
    if (!html.includes(en)) throw new Error(`i18n/${lang}.json: home fragment no longer in index.html — update it:\n  ${en}`);
    html = html.split(en).join(tr);
  }
  return html;
}
