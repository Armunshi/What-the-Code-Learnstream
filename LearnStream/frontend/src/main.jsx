import React from 'react';
import ReactDOM from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import './index.css';
import { AppProviders } from './app/providers.jsx';
import { router } from './app/router.jsx';

// Vite content-hashes every chunk filename, so a deploy renames files like
// FilePlayer-<hash>.js. A tab left open across a deploy still holds the OLD
// index.html, which points at chunks the new deployment no longer serves —
// any dynamic import (react-player lazy-loads its player backends this way)
// then 404s with "Failed to fetch dynamically imported module" and the app
// crashes to React Router's raw error screen. This reproduced in production
// right after a real deploy.
//
// Vite dispatches `vite:preloadError` on window for exactly this failure.
// One silent reload picks up the current build and fixes it — the same
// class of fix as the auth cookie issue, but for static assets instead of
// cookies. Guarded with a sessionStorage flag so a genuinely broken deploy
// reloads once and then shows the real error, instead of loop-reloading.
window.addEventListener('vite:preloadError', () => {
  const key = 'reloaded-after-preload-error';
  if (sessionStorage.getItem(key)) return; // already tried once this session
  sessionStorage.setItem(key, '1');
  window.location.reload();
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>
  </React.StrictMode>
);
