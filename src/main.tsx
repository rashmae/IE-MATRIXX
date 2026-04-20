import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

try {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
} catch (error) {
  console.error('React mount failed:', error);
  document.body.innerHTML = `
    <div style="display:flex;align-items:center;
    justify-content:center;height:100vh;
    font-family:sans-serif;color:#d97706;background:#fafafa;">
      <div style="text-align:center;max-width:400px;padding:20px;">
        <h1 style="font-size:48px;margin-bottom:16px;">IE Matrix</h1>
        <p style="font-size:18px;color:#666;margin-bottom:24px;">Failed to load critical resources. This usually happens when the application is incorrectly configured.</p>
        <button onclick="location.reload()" 
        style="padding:12px 32px;background:#d97706;
        color:white;border:none;border-radius:12px;
        font-weight:bold;cursor:pointer;box-shadow:0 4px 6px rgba(217, 119, 6, 0.2);">Refresh Page</button>
      </div>
    </div>`;
}
