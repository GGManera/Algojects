import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./globals.css";

createRoot(document.getElementById("root")!).render(<App />);

// Register service worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js')
      .then(registration => {
        console.log('Service Worker registered with scope:', registration.scope);
        
        // Optional: Listen for updates to prompt user to reload if needed
        registration.onupdatefound = () => {
          const installingWorker = registration.installing;
          if (installingWorker) {
            installingWorker.onstatechange = () => {
              if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
                // New content available and ready to use.
                console.log('New content available, waiting for activation.');
                // In the new SW logic, activation is forced, so a simple refresh should suffice.
                // Forcing a refresh here might be too aggressive, so we just log it.
              }
            };
          }
        };
      })
      .catch(error => {
        console.error('Service Worker registration failed:', error);
      });
  });
}