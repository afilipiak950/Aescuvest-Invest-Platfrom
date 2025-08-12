import { createRoot } from "react-dom/client";
import App from "./App";
import ErrorBoundary from "./components/ErrorBoundary";
import "./index.css";

// Add global error handlers
window.addEventListener('error', (event) => {
  console.error('Global error:', event.error);
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection:', event.reason);
  // Don't prevent default to allow error tracking
});

const root = createRoot(document.getElementById("root")!);
root.render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);
