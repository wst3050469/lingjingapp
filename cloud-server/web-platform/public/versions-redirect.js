// SPA versions tab redirect - intercepts React Router navigation to /admin/versions
// and redirects to the standalone version management page
(function() {
  function checkAndRedirect() {
    var path = window.location.pathname;
    // Match /admin/versions but NOT /admin/versions-v2.html or /admin/versions/..
    if (path === '/admin/versions' || path === '/admin/versions/') {
      window.location.href = '/admin/versions-v2.html';
    }
  }
  
  // Check on page load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', checkAndRedirect);
  } else {
    checkAndRedirect();
  }
  
  // Check on popstate (browser back/forward)
  window.addEventListener('popstate', checkAndRedirect);
  
  // Poll for SPA navigation (React Router changes URL without page reload)
  var lastUrl = location.href;
  setInterval(function() {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      checkAndRedirect();
    }
  }, 200);
})();
