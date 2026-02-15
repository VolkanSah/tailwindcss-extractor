#!/usr/bin/env node

/**
 * extract-tailwind.js by VolkanSah@github
 *
 * 1. Scans all .html files in /docs
 * 2. Auto-detects Tailwind version from script tags in the HTML
 * 3. Builds a purged CSS via Tailwind CLI (no CDN download needed)
 * 4. Writes result to /assets/tailwind.css
 */

const fs            = require('fs');
const path          = require('path');
const os            = require('os');
const { execSync }  = require('child_process');

// ── Config ────────────────────────────────────────────────────────────────────
const DOCS_DIR   = path.resolve(process.cwd(), 'docs');
const ASSETS_DIR = path.resolve(process.cwd(), 'assets');
const OUT_FILE   = path.join(ASSETS_DIR, 'tailwind.css');

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Recursively collect all .html files under a directory */
function collectHtml(dir) {
  const results = [];
  if (!fs.existsSync(dir)) {
    console.error(`[ERROR] docs dir not found: ${dir}`);
    process.exit(1);
  }
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory())            results.push(...collectHtml(full));
    else if (entry.name.endsWith('.html')) results.push(full);
  }
  return results;
}

/**
 * Detect Tailwind major version by checking script tags in all HTML files.
 * Falls back to v3 if nothing found.
 */
function detectTailwindVersion(htmlFiles) {
  for (const f of htmlFiles) {
    const content = fs.readFileSync(f, 'utf8');
    // v4: @import "tailwindcss" or cdn.tailwindcss.com/4
    if (/cdn\.tailwindcss\.com\/4|tailwindcss@4|@import\s+['"]tailwindcss['"]/i.test(content)) {
      return 4;
    }
    // v3: cdn.tailwindcss.com (no version) or tailwindcss@3
    if (/cdn\.tailwindcss\.com|tailwindcss@3/i.test(content)) {
      return 3;
    }
  }
  console.log('[INFO] No Tailwind CDN tag detected — defaulting to v3');
  return 3;
}

/** Run a shell command, pipe output, throw on error */
function run(cmd, opts = {}) {
  console.log(`[RUN]  ${cmd}`);
  execSync(cmd, { stdio: 'inherit', ...opts });
}

// ── Main ──────────────────────────────────────────────────────────────────────

(async () => {
  // 1. Collect HTML files
  const htmlFiles = collectHtml(DOCS_DIR);
  if (htmlFiles.length === 0) {
    console.error('[ERROR] No HTML files found in /docs');
    process.exit(1);
  }
  console.log(`[INFO] Found ${htmlFiles.length} HTML file(s):`);
  htmlFiles.forEach((f) => console.log('       •', path.relative(process.cwd(), f)));

  // 2. Detect version
  const version = detectTailwindVersion(htmlFiles);
  console.log(`[INFO] Tailwind version detected: v${version}`);

  // 3. Work in a temp dir so we don't pollute the repo
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tw-extract-'));
  console.log(`[INFO] Working in: ${tmp}`);

  if (version === 4) {
    // ── Tailwind v4 ──────────────────────────────────────────────────────────
    // v4 uses a standalone CLI binary (@tailwindcss/cli) — no config needed
    run(`npm install --save-dev @tailwindcss/cli@^4`, { cwd: process.cwd() });

    // Build with glob pointing at docs/**/*.html
    const contentGlob = path.join(DOCS_DIR, '**', '*.html');
    run(
      `npx @tailwindcss/cli -i /dev/null -o "${OUT_FILE}" --content "${contentGlob}" --minify`,
      { cwd: process.cwd() }
    );

  } else {
    // ── Tailwind v3 ──────────────────────────────────────────────────────────
    // v3 needs a config file that tells it where the content is

    // Write minimal tailwind.config.js into tmp
    const contentPaths = htmlFiles.map((f) => JSON.stringify(f)).join(',\n    ');
    fs.writeFileSync(
      path.join(tmp, 'tailwind.config.js'),
      `/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    ${contentPaths}
  ],
  theme: { extend: {} },
  plugins: [],
};\n`
    );

    // Write minimal input CSS into tmp
    fs.writeFileSync(
      path.join(tmp, 'input.css'),
      `@tailwind base;\n@tailwind components;\n@tailwind utilities;\n`
    );

    // Install tailwindcss v3 locally if not already present
    const twBin = path.resolve(process.cwd(), 'node_modules', '.bin', 'tailwindcss');
    if (!fs.existsSync(twBin)) {
      run(`npm install --save-dev tailwindcss@^3 postcss autoprefixer`, { cwd: process.cwd() });
    }

    // Build
    fs.mkdirSync(ASSETS_DIR, { recursive: true });
    run(
      `"${twBin}" -c "${path.join(tmp, 'tailwind.config.js')}" -i "${path.join(tmp, 'input.css')}" -o "${OUT_FILE}" --minify`
    );
  }

  // 4. Report
  const size = (fs.statSync(OUT_FILE).size / 1024).toFixed(1);
  console.log(`[OK]   Written ${size} KB → ${path.relative(process.cwd(), OUT_FILE)}`);
  console.log(`[OK]   Replace your CDN <script> with:`);
  console.log(`       <link rel="stylesheet" href="/assets/tailwind.css">`);
})();
