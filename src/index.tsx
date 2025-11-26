import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// SHIM: Setting the API Key explicitly for the demo as requested.
// In a production build, this would be handled by vite/webpack environment variables.
// The user provided this key in the prompt.
(window as any).process = {
  env: {
    API_KEY: import.meta.env.VITE_GOOGLE_AI_KEY
  }
};

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);