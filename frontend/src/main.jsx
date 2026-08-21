// main.jsx — App entry point
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '@/lib/auth/AuthContext';
import App from './App';
import '@/tokens/index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // The API is on Render's free tier, which cold-starts. Retrying
      // once with a real gap gives a sleeping instance time to wake
      // rather than surfacing a spurious error to the user.
      retry: 1,
      retryDelay: 2000,
      staleTime: 30_000,
      // Refetch when the tab regains focus. Turning this off meant a
      // ticket scanned at the gate kept showing as valid on the holder's
      // phone until the 30s staleTime lapsed -- and switching back to
      // the app, the exact moment they want the truth, refreshed
      // nothing.
      refetchOnWindowFocus: true,
    },
  },
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <App />
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>
);
