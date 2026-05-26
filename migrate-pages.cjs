const fs = require('fs');
const path = require('path');

let count = 0;

function walk(dir) {
  fs.readdirSync(dir).forEach(f => {
    const fp = path.join(dir, f);
    if (fs.statSync(fp).isDirectory()) walk(fp);
    else if (f.endsWith('.vue')) {
      let c = fs.readFileSync(fp, 'utf8');
      const orig = c;

      // Replace @dcloudio/uni-app import with @/uni-shim
      c = c.replace(
        /import\s*\{([^}]*)\}\s*from\s*['"]@dcloudio\/uni-app['"]/g,
        "import { $1 } from '@/uni-shim'"
      );

      // Add uni import if file uses uni.xxx but doesn't import it
      if (/uni\.\w+/.test(c) && !c.includes("from '@/uni-shim'")) {
        c = c.replace(
          /(<script[^>]*>)/,
          "$1\nimport { uni } from '@/uni-shim'"
        );
      }

      if (c !== orig) {
        fs.writeFileSync(fp, c);
        count++;
      }
    }
  });
}

walk('src/pages');
console.log('Updated', count, 'files');
