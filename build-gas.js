import fs from 'fs';
import path from 'path';

console.log('[GAS Builder] Starting build post-processing... 🚀✨');

if (!fs.existsSync('dist-gas')) {
  fs.mkdirSync('dist-gas');
  console.log('[GAS Builder] Created dist-gas directory. 📂');
}

const assetsDir = 'dist/assets';
if (!fs.existsSync(assetsDir)) {
  console.error('[GAS Builder] Error: dist/assets directory not found! Run npm run build first. 🚨');
  process.exit(1);
}

const files = fs.readdirSync(assetsDir);
const jsFile = files.find(f => f.endsWith('.js'));
const cssFile = files.find(f => f.endsWith('.css'));

if (!jsFile) {
  console.error('[GAS Builder] Error: Could not find JS bundle in dist/assets! 🚨');
  process.exit(1);
}

console.log(`[GAS Builder] Found JS bundle: ${jsFile}${cssFile ? `, CSS: ${cssFile}` : ' (no separate CSS)'} 🔍`);

const jsContent = fs.readFileSync(path.join(assetsDir, jsFile), 'utf8');
const cssContent = cssFile
  ? fs.readFileSync(path.join(assetsDir, cssFile), 'utf8')
  : '';

let htmlContent = fs.readFileSync('dist/index.html', 'utf8');

if (cssContent) {
  const cssRegex = /<link[^>]*href="[^"]*\.css"[^>]*>/gi;
  htmlContent = htmlContent.replace(cssRegex, `<style>${cssContent}</style>`);
  console.log('[GAS Builder] Inlined CSS stylesheet into HTML. 🎨');
} else {
  console.log('[GAS Builder] No separate CSS file — CSS may be inlined by Vite already. 🎨');
}

const b64 = Buffer.from(jsContent).toString('base64');
console.log(`[GAS Builder] Base64-encoded JS bundle: ${b64.length} chars (original: ${jsContent.length} chars)`);

const inlineScript = `<script>
try {
  var __code = decodeURIComponent(escape(atob("${b64}")));
  (new Function(__code))();
} catch(e) {
  var r = document.getElementById('root');
  if (r) r.innerHTML = '<div style="background:#1a0000;color:#ff6b6b;font-family:monospace;padding:16px;border-radius:8px;margin:16px;"><h2>Runtime Error</h2><p>' + e.message + '<\\/p><p>' + (e.stack ? e.stack.substring(0,500) : 'no stack') + '<\\/p><\\/div>';
}
</script>`;

const jsRegex = /<script[^>]*src="[^"]*\.js"[^>]*><\/script>/gi;
htmlContent = htmlContent.replace(jsRegex, '');

htmlContent = htmlContent.replace('</body>', () => inlineScript + '\n</body>');
console.log('[GAS Builder] Inlined base64-encoded JS bundle before </body>. 📦');

htmlContent = htmlContent.replace(/<link[^>]*rel="modulepreload"[^>]*>/gi, '');
htmlContent = htmlContent.replace(/<link[^>]*rel="manifest"[^>]*>/gi, '');
htmlContent = htmlContent.replace(/ crossorigin/gi, '');

console.log('[GAS Builder] Cleaned up GAS-incompatible HTML elements. 🧹');

fs.writeFileSync('dist-gas/index.html', htmlContent, 'utf8');
console.log('[GAS Builder] Saved final index.html to dist-gas/index.html 💾');

const finalHtml = fs.readFileSync('dist-gas/index.html', 'utf8');
let finalCount = 0;
let fi = 0;
while ((fi = finalHtml.indexOf('</script>', fi)) !== -1) {
  finalCount++;
  fi += 9;
}
console.log(`[GAS Builder] Final HTML has ${finalCount} </script> tags (should be exactly 1)`);
console.log(`[GAS Builder] Final HTML size: ${finalHtml.length} bytes`);

fs.copyFileSync('src/gas/Code.js', 'dist-gas/Code.js');
console.log('[GAS Builder] Copied Code.js -> dist-gas/Code.js 🔌');

fs.copyFileSync('appsscript.json', 'dist-gas/appsscript.json');
console.log('[GAS Builder] Copied appsscript.json -> dist-gas/appsscript.json ⚙️');

fs.copyFileSync('public/voice.html', 'dist-gas/voice.html');
console.log('[GAS Builder] Copied voice.html -> dist-gas/voice.html 🎙️');

console.log('[GAS Builder] Build successful! Ready for clasp push. 🏆🎉');
