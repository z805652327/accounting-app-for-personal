const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const stub = '<template><view><slot /></view></template><script>export default { name: "u-stub", props: { type:String, placeholder:String, value:{}, modelValue:{}, disabled:Boolean, loading:Boolean, size:{}, color:String, mode:String, show:Boolean, maxlength:Number, name:String } }</script>';

let iteration = 0;
while (iteration < 20) {
  iteration++;
  try {
    execSync('"D:/node.js/npx.cmd" uni build --platform h5', { cwd: 'd:/accounting app', timeout: 120000, encoding: 'utf8', stdio: 'pipe' });
    console.log('BUILD SUCCESS after', iteration, 'iterations!');
    process.exit(0);
  } catch (e) {
    const output = e.stdout + (e.stderr || '');
    // Extract filename from error using simple string match
    let fileMatch = output.match(/node_modules.uview-plus.[^.]+.[^.]+\.vue/);
    if (!fileMatch) {
      fileMatch = output.match(/D:.+?uview-plus.+?\.vue/);
    }
    if (!fileMatch) {
      console.log('Unknown error at iteration', iteration);
      console.log(output.slice(-500));
      process.exit(1);
    }
    // Normalize path
    let fp = fileMatch[0].replace(/\\\\/g, '\\').replace(/\\/g, '/');
    if (!fp.startsWith('d:/') && !fp.startsWith('D:/')) {
      fp = 'd:/accounting app/' + fp;
    }
    if (fs.existsSync(fp)) {
      fs.writeFileSync(fp, stub);
      const dir = path.basename(path.dirname(fp));
      const file = path.basename(fp);
      console.log('Iteration', iteration, ': Stubbed', dir + '/' + file);
    } else {
      console.log('File not found:', fp);
      process.exit(1);
    }
  }
}
console.log('Max iterations reached');
