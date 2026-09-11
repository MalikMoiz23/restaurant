import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';

// Bundled rather than loaded from a font CDN: the restaurant's core
// loop has to survive the internet going down.
import '@fontsource-variable/inter';
import '@fontsource-variable/fraunces';
import './index.css';

import { App } from './App';
import { I18nProvider } from './i18n';
import { ToastProvider } from './ui';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <I18nProvider>
        <ToastProvider>
          <App />
        </ToastProvider>
      </I18nProvider>
    </BrowserRouter>
  </StrictMode>,
);
