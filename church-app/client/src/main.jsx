import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import { AuthProvider } from './auth.jsx';
import { initTheme } from './theme.js';
import './styles.css';
import './dark.css'; // must come after styles.css

initTheme();

createRoot(document.getElementById('root')).render(
  <BrowserRouter>
    <AuthProvider>
      <ErrorBoundary><App /></ErrorBoundary>
    </AuthProvider>
  </BrowserRouter>
);
