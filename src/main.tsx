import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import App from "./App";
import "./index.css";
import { installGlobalErrorHandlers } from "./lib/errors";

installGlobalErrorHandlers();

function markAppReady() {
  document.documentElement.classList.add("app-ready");
}

// Register service worker for offline + push
if (typeof window !== "undefined" && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch((err) => {
      console.warn("[SW] register failed", err);
    });
  });
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <HelmetProvider>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </HelmetProvider>
  </React.StrictMode>
);

// Reveal after the first paint so prerendered unstyled HTML never flashes.
requestAnimationFrame(() => {
  requestAnimationFrame(markAppReady);
});
