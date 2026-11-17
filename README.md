# AILoveDigital

Marketing site of AILoveDigital, published as two sites:

- **ailovedigital.az** — Azerbaijani, at the root (the primary market)
- **ailovedigital.com** — English at the root, Russian under `/ru/`

Both are built into `dist/` and deployed as-is: `dist/ailovedigital.az/` → ailovedigital.az,
`dist/ailovedigital.com/` → ailovedigital.com.

```
index.html              home page (dc-runtime component; the project cards are generated, see below)
dist/                   GENERATED — the two sites, ready to upload (never edit by hand)
data/projects.json      the single source of truth for every project
data/services*.json     service pages, about and contact: URLs per language + the text in each language
css/style.css           design tokens + home page      css/case.css   case studies and the /work/ hub
js/site.js              home glue (scroll/ScrollTrigger fixes, Back-button restore)   js/case.js   case-study behaviour
js/support.js           vendor runtime — do not edit
scripts/                build-work.mjs (every page except home) → build-seo.mjs (home pages, sitemap, robots, llms.txt)
vendor/  assets/fonts/  React and the Geist fonts, self-hosted (no third-party requests)
tools/covers/           cover composer — draws each project's hero image from its real screens (see below)
assets/images/work/     <slug>.webp (home card, 800×500) and <slug>/{cover.webp, 01.webp…, og.jpg}
```

## Build

```bash
npm run build      # no dependencies, Node 18+
```

Run it after every change to `data/projects.json`, the services/steps/values arrays in `index.html`,
or the config in `scripts/lib/site.mjs`. It is idempotent. Never edit `work/**` or the blocks marked
`generated` in `index.html` by hand — the next build overwrites them.

## Add a project

1. Append an entry to `data/projects.json` (copy an existing one — every field is required).
2. Add the images: `assets/images/work/<slug>.webp` (home card), `assets/images/work/<slug>/cover.webp`
   (1600×1000), `og.jpg` (1200×630) and the screens `01.webp`, `02.webp` … (any size — they are not shown
   on the pages, the cover composer draws them into the device frames).
3. `npm run build`.

## Languages

Azerbaijani is served from the root of ailovedigital.az; English from the root of ailovedigital.com and Russian
from its `/ru/`. Service, about and contact pages have translated URLs (`/xidmetler/smm/`, `/services/smm/`,
`/ru/uslugi/smm/` — see `data/services.json`); case studies keep `/work/<slug>/` everywhere. Every page carries
`hreflang` alternates across both domains (plus `x-default` → English), its own canonical, `og:locale` and JSON-LD
`inLanguage`; each site's `sitemap.xml` lists its URLs with alternates and `lastmod` (from git). The nav's language menu
links to the same page in the other languages. Config lives in `scripts/lib/i18n.mjs`.

- `i18n/<lang>.json` — page chrome (`ui`), meta tags (`meta`) and the home page as `[English fragment, translation]`
  pairs (`home`). `ru/index.html` and `az/index.html` are built from `index.html` with those pairs, so after
  editing home-page copy in `index.html`, update the matching pair — the build stops and names any English
  fragment it can no longer find.
- `data/projects.<lang>.json` — the translated text of every project, same order and shape as `projects.json`
  (the build checks it). A new project needs an entry here too.

## Covers (hero images)

`cover.webp`, the home card and `og.jpg` are drawn, not hand-made: a dark brand-tinted background with a fine
wave-mesh, the project name and tagline, and the project's own screens in laptop / tablet / phone frames
(only the devices the project has screens for). The screens to use are listed in `data/projects.json` →
`"mockup"` (`web`, `tablet`, `tablets`, `phones`: screenshot numbers; optional `hue` overrides the colour
taken from the screens). Moleaks keeps its original hand-made cover (no `mockup` entry).

```bash
python3 tools/covers/save-server.py &   # tiny write-only endpoint on :4177
npm run serve                           # then open http://localhost:4173/tools/covers/ → Render → Save to disk
npm run build
```

## Deploy notes

- Upload the **contents** of `dist/ailovedigital.az/` to the ailovedigital.az web root and of
  `dist/ailovedigital.com/` to the ailovedigital.com web root (domains: `SITES` in `scripts/lib/site.mjs`).
  Pages use directory URLs, which every static host serves from `index.html`; each site has its own
  `404.html`, `robots.txt`, `sitemap.xml`, `llms.txt` and `site.webmanifest`.
- The root-level `work/`, `ru/`, `az/`, `privacy/`, `404.html`, `sitemap.xml`, `robots.txt`, `llms.txt` are
  output of the old single-site build and are no longer updated.
- After going live: submit both sitemaps in Search Console (one property per domain), then check a service
  URL in the Rich Results Test (FAQ, Breadcrumb, Service).
