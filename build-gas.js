import fs from 'fs';
import path from 'path';

console.log('[GAS Builder] Starting build post-processing... 🚀✨');

const OUT_DIR = 'dist-gas';
const ASSETS_DIR = 'dist/assets';
const GAS_SOURCE_DIR = 'src/gas';

if (!fs.existsSync(OUT_DIR)) {
  fs.mkdirSync(OUT_DIR);
}

if (!fs.existsSync(ASSETS_DIR)) {
  console.error('[GAS Builder] dist/assets not found. Run npm run build first.');
  process.exit(1);
}

const assets = fs.readdirSync(ASSETS_DIR);
const jsFile = assets.find(f => f.endsWith('.js'));
const cssFile = assets.find(f => f.endsWith('.css'));

if (!jsFile) {
  console.error('[GAS Builder] Could not find the Vite JavaScript bundle.');
  process.exit(1);
}

const jsContent = fs.readFileSync(path.join(ASSETS_DIR, jsFile), 'utf8');
const cssContent = cssFile
  ? fs.readFileSync(path.join(ASSETS_DIR, cssFile), 'utf8')
  : '';

let htmlContent = fs.readFileSync('dist/index.html', 'utf8');

if (cssContent) {
  htmlContent = htmlContent.replace(
    /<link[^>]*href="[^"]*\.css"[^>]*>/gi,
    `<style>${cssContent}</style>`
  );
}

const b64 = Buffer.from(jsContent).toString('base64');
const inlineScript = `<script>
try {
  var __code = decodeURIComponent(escape(atob("${b64}")));
  (new Function(__code))();
} catch(e) {
  var r = document.getElementById('root');
  if (r) r.innerHTML = '<div style="background:#1a0000;color:#ff6b6b;font-family:monospace;padding:16px;border-radius:8px;margin:16px;"><h2>Runtime Error</h2><p>' + e.message + '<\\/p><p>' + (e.stack ? e.stack.substring(0,500) : 'no stack') + '<\\/p><\\/div>';
}
</script>`;

htmlContent = htmlContent.replace(
  /<script[^>]*src="[^"]*\.js"[^>]*><\/script>/gi,
  ''
);

htmlContent = htmlContent.replace('</body>', () => inlineScript + '\n</body>');
htmlContent = htmlContent.replace(/<link[^>]*rel="modulepreload"[^>]*>/gi, '');
htmlContent = htmlContent.replace(/<link[^>]*rel="manifest"[^>]*>/gi, '');
htmlContent = htmlContent.replace(/ crossorigin/gi, '');

fs.writeFileSync(path.join(OUT_DIR, 'index.html'), htmlContent, 'utf8');

// V4.2: copy EVERY Apps Script .js module.
// The old builder copied only Code.js, which would silently omit NavigationV42.js,
// GeminiProxyV42.js, and regression-test modules from clasp deployments.
if (!fs.existsSync(GAS_SOURCE_DIR)) {
  console.error('[GAS Builder] src/gas not found.');
  process.exit(1);
}

const gasFiles = fs.readdirSync(GAS_SOURCE_DIR)
  .filter(f => f.endsWith('.js'))
  .sort();

for (const fileName of gasFiles) {
  fs.copyFileSync(
    path.join(GAS_SOURCE_DIR, fileName),
    path.join(OUT_DIR, fileName)
  );
  console.log(`[GAS Builder] Copied ${fileName}`);
}

fs.copyFileSync('appsscript.json', path.join(OUT_DIR, 'appsscript.json'));

if (fs.existsSync('public/voice.html')) {
  fs.copyFileSync('public/voice.html', path.join(OUT_DIR, 'voice.html'));
}

console.log(`[GAS Builder] Build successful. ${gasFiles.length} Apps Script module(s) ready for clasp push.`);
