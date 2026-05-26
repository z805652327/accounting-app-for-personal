const fs = require('fs');
const path = require('path');
let patched = 0;

function process(fp) {
  let c = fs.readFileSync(fp, 'utf8');
  const orig = c;

  // ── TEMPLATE ──
  // DELETE: #ifdef blocks where marker does NOT contain only H5 or VUE3
  // This handles VUE2, APP-*, MP-*, APP-PLUS||H5, MP-TOUTIAO || MP-WEIXIN, etc.
  // EXCEPT: if the marker contains H5 or VUE3, keep the content
  // Strategy: process KEEP patterns first, then DELETE all remaining #ifdef blocks

  // KEEP: #ifdef with H5 or VUE3 (including combos like APP-PLUS||H5)
  c = c.replace(/<!--\s*#ifdef\s+([^>]*\bH5\b[^>]*)\s*-->([\s\S]*?)<!--\s*#endif\s*-->/g, '$2');
  c = c.replace(/<!--\s*#ifdef\s+([^>]*\bVUE3\b[^>]*)\s*-->([\s\S]*?)<!--\s*#endif\s*-->/g, '$2');

  // DELETE: all remaining #ifdef blocks (VUE2, APP-*, MP-*, etc.)
  c = c.replace(/<!--\s*#ifdef\s+[^-][\s\S]*?-->[\s\S]*?<!--\s*#endif\s*-->/g, '');

  // DELETE: #ifndef H5
  c = c.replace(/<!--\s*#ifndef\s+H5\s*-->[\s\S]*?<!--\s*#endif\s*-->/g, '');

  // EXPAND: all remaining #ifndef blocks (keep content)
  c = c.replace(/<!--\s*#ifndef\s+[^-][\s\S]*?-->([\s\S]*?)<!--\s*#endif\s*-->/g, '$1');

  // Clean any leftover markers
  c = c.replace(/<!--\s*#(?:ifdef|ifndef|endif)\s*\S[\s\S]*?-->/g, '');

  // ── SCRIPT ──
  // KEEP first
  c = c.replace(/\/\/\s*#ifdef\s+([^\n]*\bH5\b[^\n]*)\n([\s\S]*?)\/\/\s*#endif/g, '$2');
  c = c.replace(/\/\/\s*#ifdef\s+([^\n]*\bVUE3\b[^\n]*)\n([\s\S]*?)\/\/\s*#endif/g, '$2');

  // DELETE remaining #ifdef
  c = c.replace(/\/\/\s*#ifdef\s+[^\n]+\n[\s\S]*?\/\/\s*#endif/g, '');

  // DELETE #ifndef H5
  c = c.replace(/\/\/\s*#ifndef\s+H5\s*\n[\s\S]*?\/\/\s*#endif/g, '');

  // EXPAND remaining #ifndef
  c = c.replace(/\/\/\s*#ifndef\s+[^\n]+\n([\s\S]*?)\/\/\s*#endif/g, '$1');

  // Clean stray single-line markers
  c = c.replace(/^\s*\/\/\s*#(?:ifdef|ifndef|endif)\s*[^\n]*\n?/gm, '');

  if (c !== orig) { fs.writeFileSync(fp, c); patched++; }
}

function walk(dir) {
  if (!fs.existsSync(dir)) return;
  fs.readdirSync(dir).forEach(f => {
    const fp = path.join(dir, f);
    if (fs.statSync(fp).isDirectory()) walk(fp);
    else if (f.endsWith('.vue')) process(fp);
  });
}

walk('node_modules/uview-plus');
console.log('Patched', patched, 'files');
