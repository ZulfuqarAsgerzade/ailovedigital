# AILoveDigital

One-page marketing site plus a static case-study page for every project.

```
index.html              home page (dc-runtime component; the project cards are generated, see below)
work/                   GENERATED — /work/ hub and /work/<slug>/ case studies (plain HTML, no JS needed to read)
ru/  az/                GENERATED — the same site in Russian and Azerbaijani (see Languages)
data/projects.json      the single source of truth for every project
css/style.css           design tokens + home page      css/case.css   case studies and the /work/ hub
js/site.js              home glue (scroll/ScrollTrigger fixes, Back-button restore)   js/case.js   case-study behaviour
js/support.js           vendor runtime — do not edit
scripts/                build-work.mjs (pages + home data) → build-seo.mjs (head, JSON-LD, sitemap, llms.txt)
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

English is served from the root; Russian and Azerbaijani from `/ru/` and `/az/` with the same paths
(`/ru/work/<slug>/` …). Every page carries `hreflang` alternates (plus `x-default` → English), its own canonical,
`og:locale` and JSON-LD `inLanguage`; `sitemap.xml` lists every URL with its alternates. The nav's language menu
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

- Served from the domain root (`SITE_URL` in `scripts/lib/site.mjs`); pages use directory URLs
  (`/work/<slug>/`), which every static host serves from `index.html`.
- After going live: submit `sitemap.xml` in Search Console, then check a case-study URL in the Rich Results Test.
