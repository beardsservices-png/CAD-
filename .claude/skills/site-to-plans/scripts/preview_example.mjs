// Screenshot a Draft Studio example in 2D and 3D so the drawing is checked before it ships.
//
//   (cd /home/user/CAD- && PORT=8099 node server.js &)      # start the app locally first
//   node preview_example.mjs <example-id> <out-prefix>
//
// Writes <out-prefix>-2d.png and <out-prefix>-3d.png. Prints page errors, if any.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';

const [id, out] = process.argv.slice(2);
if (!id || !out) { console.error('usage: node preview_example.mjs <example-id> <out-prefix>'); process.exit(2); }

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }).catch(() => chromium.launch());
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
const errors = [];
page.on('pageerror', e => errors.push(e.message));
await page.goto(`http://localhost:${process.env.PORT || 8099}/`);
await page.click('#btn-examples');
const EXAMPLES = await page.evaluate(() => import('/src/examples.js').then(m => m.EXAMPLES));
const idx = EXAMPLES.findIndex(e => e.id === id);
if (idx < 0) { console.error(`no example "${id}" in src/examples.js`); process.exit(1); }
await page.locator('.example-card').nth(idx).locator('button').click();
await page.waitForTimeout(800);
await page.screenshot({ path: `${out}-2d.png` });
await page.click('#btn-3d');
await page.waitForTimeout(800);
await page.screenshot({ path: `${out}-3d.png` });
console.log(errors.length ? errors.join('\n') : 'ok');
await browser.close();
