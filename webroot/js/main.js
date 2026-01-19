"use strict";

/* =========================
   KernelSU SAFE EXEC
========================= */
function exec(cmd) {
  return new Promise((resolve, reject) => {
    if (typeof ksu === "undefined") {
      reject("KernelSU not available");
      return;
    }
    const cb = "cb_" + Math.random().toString(36).slice(2);
    window[cb] = (code, out) => {
      delete window[cb];
      code === 0 ? resolve((out || "").trim()) : reject(out);
    };
    ksu.exec(cmd, `window.${cb}`);
  });
}

/* =========================
   DOM READY
========================= */
document.addEventListener("DOMContentLoaded", () => {

  /* =========================
     REFRESH BUTTON
  ========================= */
  const refreshBtn = document.getElementById("refreshBtn");
  if (refreshBtn) {
    refreshBtn.addEventListener("click", () => {
      navigator.vibrate?.(15);
      document.dispatchEvent(new Event("ui-refresh"));
    });
  }

  /* =========================
     UI REFRESH HANDLER
  ========================= */
  document.addEventListener("ui-refresh", () => {
    console.log("🔄 UI refreshed");
    document.dispatchEvent(new Event("stats-refresh"));
    document.dispatchEvent(new Event("system-refresh"));
  });

  console.log("✅ main.js loaded (no banner logic)");
});