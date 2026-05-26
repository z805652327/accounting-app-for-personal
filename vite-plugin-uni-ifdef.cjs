// Strips uni-app #ifdef/#ifndef conditionals from .vue templates
// before the Vue SFC compiler processes them.
// Only keeps VUE3 + H5 branches.

module.exports = function uniIfdefPlugin() {
  return {
    name: 'uni-ifdef',
    enforce: 'pre',
    transform(code, id) {
      if (!id.endsWith('.vue') || !id.includes('node_modules')) return null;

      // Process template section
      code = code.replace(/<template>([\s\S]*?)<\/template>/g, (_, tpl) => {
        let result = tpl;
        // Remove vue2 branches
        result = result.replace(/<!--\s*#ifdef\s+VUE2\s*-->[\s\S]*?<!--\s*#endif\s*-->/g, '');
        // Remove nvue branches
        result = result.replace(/<!--\s*#ifndef\s+APP-NVUE\s*-->([\s\S]*?)<!--\s*#endif\s*-->/g, '$1');
        result = result.replace(/<!--\s*#ifdef\s+APP-NVUE\s*-->[\s\S]*?<!--\s*#endif\s*-->/g, '');
        // Remove other platform branches (keep only H5/VUE3)
        result = result.replace(/<!--\s*#ifdef\s+(?!VUE3)[^-]*\s*-->[\s\S]*?<!--\s*#endif\s*-->/g, '');
        // Clean up remaining comments
        result = result.replace(/<!--\s*#ifdef\s+\S+\s*-->/g, '');
        result = result.replace(/<!--\s*#ifndef\s+\S+\s*-->/g, '');
        result = result.replace(/<!--\s*#endif\s*-->/g, '');
        return '<template>' + result + '</template>';
      });

      // Process script section similarly
      code = code.replace(/<script([^>]*)>([\s\S]*?)<\/script>/g, (_, attrs, scr) => {
        let result = scr;
        result = result.replace(/\/\/\s*#ifdef\s+VUE2[\s\S]*?\/\/\s*#endif/g, '');
        result = result.replace(/\/\/\s*#ifndef\s+APP-NVUE\s*\n([\s\S]*?)\/\/\s*#endif/g, '$1');
        result = result.replace(/\/\/\s*#ifdef\s+APP-NVUE[\s\S]*?\/\/\s*#endif/g, '');
        result = result.replace(/\/\/\s*#ifdef\s+(?!VUE3)\S+[\s\S]*?\/\/\s*#endif/g, '');
        result = result.replace(/\/\/\s*#ifdef\s+\S+\s*\n?/g, '');
        result = result.replace(/\/\/\s*#ifndef\s+\S+\s*\n?/g, '');
        result = result.replace(/\/\/\s*#endif\s*\n?/g, '');
        return '<script' + attrs + '>' + result + '<\/script>';
      });

      return { code, map: null };
    },
  };
};
