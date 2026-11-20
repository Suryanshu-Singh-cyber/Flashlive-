/**
 * FILE: apps/web/src/main.tsx
 *
 * PURPOSE:
 * Boots the FLASHLIVE React application.
 *
 * USED BY:
 * index.html module script.
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './app/App';
import './styles/index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
