import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { setupPwa } from './app/pwa';
import './theme/theme.css';

setupPwa();

// Ask the browser to keep our data even when storage runs low.
if (typeof navigator !== 'undefined' && navigator.storage?.persist) {
  navigator.storage.persisted().then((persisted) => {
    if (!persisted) return navigator.storage.persist();
    return persisted;
  }).catch(() => {});
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
