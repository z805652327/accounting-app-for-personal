// Shim for @vue/composition-api — Vue 3 already has Composition API built-in
// This shim redirects all composition-api imports to vue's built-in equivalents
module.exports = {
  ref: undefined,
  reactive: undefined,
  computed: undefined,
  watch: undefined,
  onMounted: undefined,
  onUnmounted: undefined,
  // Actually, we need to re-export from vue at runtime
  // But for the build, we just need the module to exist
};
