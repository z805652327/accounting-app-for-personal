const { execSync } = require('fs');
const fs = require('fs');

let iteration = 0;
while (iteration < 30) {
  iteration++;
  try {
    const result = require('child_process').execSync(
      '"D:/node.js/npx.cmd" vite build',
      { cwd: 'd:/accounting app', timeout: 120000, encoding: 'utf8', stdio: 'pipe' }
    );
    console.log('BUILD SUCCESS! Iteration', iteration);
    console.log(result.split('\n').filter(l => l.includes('dist')).join('\n'));
    process.exit(0);
  } catch (e) {
    const output = e.stdout + (e.stderr || '');

    // Extract file path
    const fileMatch = output.match(/D:\\.+?\.vue/);
    if (!fileMatch) {
      console.log('Unknown error at iteration', iteration);
      console.log(output.slice(-500));
      process.exit(1);
    }

    const fp = fileMatch[0].replace(/\\\\/g, '\\');
    console.log(`Iter ${iteration}: ${fp.split('\\\\').pop()}`);

    if (!fs.existsSync(fp)) { console.log('File not found:', fp); process.exit(1); }

    let c = fs.readFileSync(fp, 'utf8');
    const orig = c;

    // Common fixes:
    // 1) Remove duplicate closing tags
    c = c.replace(/<\/u-button>\s*\n\s*<\/u-button>/g, '</u-button>');
    c = c.replace(/<\/view>\s*\n\s*<\/view>/g, '</view>');
    c = c.replace(/<\/text>\s*\n\s*<\/text>/g, '</text>');

    // 2) Fix missing closing tags for common elements
    // Count <u-button vs </u-button> and add missing
    const openBtn = (c.match(/<u-button[^>]*>/g) || []).length;
    const closeBtn = (c.match(/<\/u-button>/g) || []).length;
    if (openBtn > closeBtn && c.includes('</template>')) {
      c = c.replace('</template>', '</u-button>\n</template>');
    }

    // 3) Fix duplicate onMounted / onShow lines
    c = c.replace(/\n\s*\n\s*\nimport \{ onMounted \} from "vue"\nonMounted.*\n/g, '\n');

    // 4) Remove extra closing braces
    c = c.replace(/\}\s*\n\s*\}\s*\n\s*\n\s*on(Mounted|Show)/g, '}\n\non$1');

    if (c !== orig) {
      fs.writeFileSync(fp, c);
      console.log('  Fixed');
    }
  }
}
console.log('Max iterations reached');
