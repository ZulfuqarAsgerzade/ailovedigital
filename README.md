# AILoveDigital

One-page marketing site plus a static case-study page for every project.

```
index.html              home page (dc-runtime component; the project cards are generated, see below)
work/                   GENERATED — /work/ hub and /work/<slug>/ case studies (plain HTML, no JS needed to read)
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
   (1600×1000), `01.webp`, `02.webp` … (screens, any size) and `og.jpg` (1200×630).
3. `npm run build`.

Screens become a thumbnail grid (3–4 per row on desktop) laid out from their dimensions; the full image opens in the viewer. Optional per-project `shotAlts` array overrides the default screenshot alt text.

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
