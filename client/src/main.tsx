import { createRoot } from "react-dom/client";
import App from "./App";
import ErrorBoundary from "./components/ErrorBoundary";
import "./index.css";

// Enhanced global error handlers with fallback
window.addEventListener('error', (event) => {
  console.error('Global error:', event.error);
  event.preventDefault(); // Prevent default error handling
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection:', event.reason);
  event.preventDefault(); // Prevent default rejection handling
});

// Ensure DOM is ready
function initializeApp() {
  const rootElement = document.getElementById("root");
  if (!rootElement) {
    console.error('Root element not found');
    return;
  }

  try {
    const root = createRoot(rootElement);
    root.render(
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    );
    console.log('App initialized successfully');
  } catch (error) {
    console.error('Failed to initialize app:', error);
    // Fallback rendering
    rootElement.innerHTML = `
      <div style="min-height: 100vh; background: rgb(15, 23, 42); color: white; display: flex; align-items: center; justify-content: center; padding: 2rem;">
        <div style="text-align: center;">
          <h1 style="font-size: 1.5rem; margin-bottom: 1rem;">Loading Error</h1>
          <p style="color: rgb(156, 163, 175); margin-bottom: 1.5rem;">Please refresh the page</p>
          <button onclick="window.location.reload()" style="background: rgb(34, 197, 94); color: black; padding: 0.75rem 1.5rem; border-radius: 0.5rem; border: none; cursor: pointer;">Refresh</button>
        </div>
      </div>
    `;
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeApp);
} else {
  initializeApp();
}
