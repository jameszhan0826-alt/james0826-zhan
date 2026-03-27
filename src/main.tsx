import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

declare global {
  interface Window {
    appStore: Record<string, string>;
    setStoreItem: (key: string, value: string) => Promise<void>;
    getStoreItem: (key: string) => string | null;
    removeStoreItem: (key: string) => Promise<void>;
    bulkStoreItem: (data: Record<string, string>) => Promise<void>;
  }
}

async function initApp() {
  let serverData: Record<string, string> = {};
  let localData: Record<string, string> = {};

  // Load from localStorage first (fast)
  try {
    const saved = localStorage.getItem('vocab_backup_local');
    if (saved) {
      localData = JSON.parse(saved);
    }
  } catch (e) {
    console.error('Failed to load from localStorage', e);
  }

  // Load from server
  try {
    const res = await fetch('/api/store');
    if (res.ok) {
      serverData = await res.json();
    }
  } catch (e) {
    console.error('Failed to load store from server', e);
  }

  // Merge data: Server data takes precedence, but local data fills gaps
  // This ensures that if the server store is wiped but local has data, we don't lose it.
  window.appStore = { ...localData, ...serverData };
  
  // If server was empty but local had data, sync local to server
  if (Object.keys(serverData).length === 0 && Object.keys(localData).length > 0) {
    console.log('Server store empty, syncing from local backup...');
    fetch('/api/store/bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: localData })
    }).catch(console.error);
  }

  window.getStoreItem = (key: string) => {
    return window.appStore[key] || null;
  };

  const syncToLocal = () => {
    try {
      localStorage.setItem('vocab_backup_local', JSON.stringify(window.appStore));
    } catch (e) {
      console.error('Failed to save to localStorage', e);
    }
  };

  window.setStoreItem = async (key: string, value: string) => {
    window.appStore[key] = value;
    syncToLocal();
    try {
      const res = await fetch('/api/store', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, value })
      });
      if (!res.ok) throw new Error('Failed to save to server store');
    } catch (e: any) {
      console.error('Failed to sync store', e);
      // We don't alert here anymore because we have the local backup
      window.dispatchEvent(new CustomEvent('store-error', { detail: e.message }));
    }
  };

  window.removeStoreItem = async (key: string) => {
    delete window.appStore[key];
    syncToLocal();
    try {
      const res = await fetch('/api/store', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, value: null })
      });
      if (!res.ok) throw new Error('Failed to remove from server store');
    } catch (e: any) {
      console.error('Failed to sync store', e);
      window.dispatchEvent(new CustomEvent('store-error', { detail: e.message }));
    }
  };

  window.bulkStoreItem = async (data: Record<string, string>) => {
    Object.assign(window.appStore, data);
    syncToLocal();
    try {
      const res = await fetch('/api/store/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data })
      });
      if (!res.ok) throw new Error('Failed to save bulk data to server');
    } catch (e: any) {
      console.error('Failed to sync bulk store', e);
      alert('Data saved locally, but failed to sync to server. Please check your connection.');
      throw e;
    }
  };

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

initApp();
