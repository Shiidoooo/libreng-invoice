// Applies the saved light/dark choice before the page draws, so it never flashes the
// wrong colours. Loaded as a file (not inline) so the Content-Security-Policy can stay strict.
// Keep the storage key in sync with src/theme/theme.ts.
(function () {
  try {
    var saved = window.localStorage.getItem('libreng-invoice.theme');
    if (saved === 'light' || saved === 'dark') document.documentElement.setAttribute('data-theme', saved);
  } catch {
    // Storage blocked (private mode): fall back to the system setting.
  }
})();
