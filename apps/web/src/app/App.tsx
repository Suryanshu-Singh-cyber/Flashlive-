/**
 * FILE: apps/web/src/app/App.tsx
 *
 * PURPOSE:
 * Root application component.
 *
 * USED BY:
 * main.tsx.
 */

import { BrowserRouter } from 'react-router-dom';
import { Providers } from './providers';
import { AppRouter } from './router';

export function App() {
  return (
    <Providers>
      <BrowserRouter>
        <AppRouter />
      </BrowserRouter>
    </Providers>
  );
}
