#!/usr/bin/env node

/**
 * extract-tailwind.js by VolkanSah@github
 *
 * 1. Scans all .html files in /docs
 * 2. Extracts tailwind.config = {...} via bracket-matching (handles nested objects)
 * 3. Builds purged CSS via Tailwind CLI with the real config
 * 4. Writes result to /assets/tailwind.css
 */

const fs           = require('fs');
const path         = require('path');
const os           = require('os');
const { execSync } = require('child_process');

const DOCS_DIR   = path.resolve(process.cwd(), 'docs');
const ASSETS_DIR = path.resolve(process.cwd(), 'assets');
const OUT_FILE   = path.join(ASSETS_DIR, 'tailwind.css');

// ── Helpers ───────────────────────────────────────────────────────────────────

function collectHtml(dir) {
  const results = [];
  if (!fs.existsSync(dir)) { console.error(`[ERROR] docs dir not found: ${dir}`); process.exit(1); }
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory())               results.push(...collectHtml(full));
    else if (entry.name.endsWith('.html')) results.push(full);
  }
  return results;
}

function detectTailwindVersion(htmlFiles) {
  for (const f of htmlFiles) {
    const c = fs.readFileSync(f, 'utf8');
    if (/cdn\.tailwindcss\.com\/4|tailwindcss@4|@import\s+['"]tailwindcss['"]/i.test(c)) return 4;
    if (/cdn\.tailwindcss\.com|tailwindcss@3/i.test(c)) return 3;
  }
  console.log('[INFO] No Tailwind CDN tag detected — defaulting to v3');
  return 3;
}

/**
 * Extract the full tailwind.config = { ... } block using bracket counting.
 * Handles deeply nested objects like keyframes without regex depth issues.
 */
function extractConfigBlock(htmlFiles) {
  for (const f of htmlFiles) {
    const content = fs.readFileSync(f, 'utf8');

    // Find start position of the config object
    const startMarker = 'tailwind.config';
    const markerIdx = content.indexOf(startMarker);
    if (markerIdx === -1) continue;

    // Find the opening { after tailwind.config =
    const openIdx = content.indexOf('{', markerIdx);
    if (openIdx === -1) continue;

    // Walk forward counting brackets until balanced
    let depth = 0;
    let closeIdx = -1;
    let inString = false;
    let strChar = '';

    for (let i = openIdx; i < content.length; i++) {
      const ch = content[i];

      // Track strings to ignore brackets inside them
      if (!inString && (ch === '"' || ch === "'" || ch === '`')) {
        inString = true;
        strChar = ch;
        continue;
      }
      if (inString) {
        if (ch === '\\') { i++; continue; } // escaped char
        if (ch === strChar) inString = false;
        continue;
      }

      if (ch === '{') depth++;
      else if (ch === '}') {
        depth--;
        if (depth === 0) { closeIdx = i; break; }
      }
    }

    if (closeIdx === -1) {
      console.log('[WARN] Could not find end of tailwind.config block');
      continue;
    }

    const rawBlock = content.slice(openIdx, closeIdx + 1);
    console.log(`[INFO] Extracted tailwind.config block (${rawBlock.length} chars) from: ${path.relative(process.cwd(), f)}`);

    // Eval the block safely
    try {
      const config = new Function(`return ${rawBlock}`)();
      if (config && config.theme) {
        return JSON.stringify(config.theme, null, 6);
      }
    } catch (e) {
      console.log(`[WARN] Could not eval tailwind.config: ${e.message}`);
    }
  }

  console.log('[WARN] No tailwind.config theme found — using default');
  return null;
}

function run(cmd, opts = {}) {
  console.log(`[RUN]  ${cmd}`);
  execSync(cmd, { stdio: 'inherit', ...opts });
}

// ── Main ──────────────────────────────────────────────────────────────────────

(async () => {
  const htmlFiles = collectHtml(DOCS_DIR);
  if (htmlFiles.length === 0) { console.error('[ERROR] No HTML files found in /docs'); process.exit(1); }
  console.log(`[INFO] Found ${htmlFiles.length} HTML file(s):`);
  htmlFiles.forEach((f) => console.log('       •', path.relative(process.cwd(), f)));

  const version = detectTailwindVersion(htmlFiles);
  console.log(`[INFO] Tailwind version detected: v${version}`);

  const themeJson = extractConfigBlock(htmlFiles);

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tw-extract-'));
  console.log(`[INFO] Working in: ${tmp}`);

  const contentPaths = htmlFiles.map((f) => JSON.stringify(f)).join(',\n    ');

  if (version === 4) {
    run(`npm install --save-dev @tailwindcss/cli@^4`, { cwd: process.cwd() });
    const contentGlob = path.join(DOCS_DIR, '**', '*.html');
    run(`npx @tailwindcss/cli -i /dev/null -o "${OUT_FILE}" --content "${contentGlob}" --minify`, { cwd: process.cwd() });

  } else {
    const themeBlock = themeJson
      ? `theme: ${themeJson},`
      : `theme: { extend: {} },`;

    const configContent =
`/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    ${contentPaths}
  ],
  ${themeBlock}
  plugins: [],
};
`;

    console.log('[INFO] Generated tailwind.config.js:');
    console.log(configContent);

    fs.writeFileSync(path.join(tmp, 'tailwind.config.js'), configContent);
    fs.writeFileSync(path.join(tmp, 'input.css'), `@tailwind base;\n@tailwind components;\n@tailwind utilities;\n`);

    const twBin = path.resolve(process.cwd(), 'node_modules', '.bin', 'tailwindcss');
    if (!fs.existsSync(twBin)) {
      run(`npm install --save-dev tailwindcss@^3 postcss autoprefixer`, { cwd: process.cwd() });
    }

    fs.mkdirSync(ASSETS_DIR, { recursive: true });
    run(`"${twBin}" -c "${path.join(tmp, 'tailwind.config.js')}" -i "${path.join(tmp, 'input.css')}" -o "${OUT_FILE}" --minify`);
  }

  const size = (fs.statSync(OUT_FILE).size / 1024).toFixed(1);
  console.log(`[OK]   Written ${size} KB → ${path.relative(process.cwd(), OUT_FILE)}`);
  console.log(`[OK]   Replace CDN script with: <link rel="stylesheet" href="/assets/tailwind.css">`);
})();
