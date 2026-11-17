// Tell IndexNow (Bing, Yandex, Seznam…) that every URL in the built sitemaps changed.
// Run AFTER uploading dist/: the engines fetch https://<host>/<key>.txt to check the key.
//   npm run indexnow
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, SITES, INDEXNOW_KEY } from './lib/site.mjs';

for (const { origin, dir } of Object.values(SITES)) {
  const host = new URL(origin).host;
  const urlList = [...readFileSync(join(ROOT, dir, 'sitemap.xml'), 'utf8').matchAll(/<loc>([^<]+)<\/loc>/g)]
    .map((m) => m[1])
    .filter((u) => new URL(u).host === host);
  const res = await fetch('https://api.indexnow.org/indexnow', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ host, key: INDEXNOW_KEY, keyLocation: `${origin}/${INDEXNOW_KEY}.txt`, urlList }),
  });
  // 200/202 = accepted; 403 = key file not found on the live site yet (upload dist/ first)
  console.log(`${host}: ${urlList.length} URLs → HTTP ${res.status}`);
}
