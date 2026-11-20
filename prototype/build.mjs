// Combines src/body.html + src/styles.css + src/app.js into:
//   truecopy-prototype.html  -> page content only (published as a claude.ai Artifact, which adds its own <html>/<head>)
//   index.html               -> standalone page you can open locally or serve
// Run: node prototype/build.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const read = (p) => readFileSync(join(here, p), 'utf8');

const body = read('src/body.html');
const css = read('src/styles.css');
const js = read('src/app.js');

// Bundled fonts are inlined as data: URIs (the Artifact host only serves fonts from Google Fonts or inline).
// TH SarabunPSK Italic: SIPA/DIP font licence, free to use and redistribute unmodified (not to be sold on its own).
const FONTS = [{ family: 'TH SarabunPSK Italic', file: '../fonts/THSarabunPSK-Italic.ttf' }];
const fontCss = FONTS.map((f) => `@font-face { font-family: '${f.family}'; src: url(data:font/ttf;base64,${readFileSync(join(here, f.file)).toString('base64')}) format('truetype'); font-style: normal; font-weight: 400; font-display: swap; }`).join('\n');

const content = body.replace('/*__FONTS__*/', () => fontCss).replace('/*__STYLES__*/', () => css).replace('//__SCRIPT__', () => js);
writeFileSync(join(here, 'truecopy-prototype.html'), content);

const standalone = `<!DOCTYPE html>
<html lang="th">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, interactive-widget=resizes-content">
<meta name="theme-color" content="#0d33bf">
</head>
<body>
${content}
</body>
</html>
`;
writeFileSync(join(here, 'index.html'), standalone);
console.log(`built: ${(content.length / 1024).toFixed(0)} KB`);
