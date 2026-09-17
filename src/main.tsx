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
  const shell = document.getElementById("boot-shell");
  if (shell) shell.setAttribute("aria-hidden", "true");
}

// Single SW registration (index.html also registers; keep one path for clarity)
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

// Wait two frames so Tailwind/CSS from this module is applied before we reveal #root.
requestAnimationFrame(() => {
  requestAnimationFrame(markAppReady);
});

// Safety: never leave users on the boot shell if paint is delayed
window.setTimeout(markAppReady, 1200);
