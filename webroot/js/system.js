"use strict";

/* =========================
   SYSTEM INFO (Android / Kernel)
========================= */
async function loadSystem() {
  // Safety: exec must exist (KernelSU WebUI)
  if (typeof exec !== "function") {
    console.warn("exec() not available");
    return;
  }

  const androidEl = document.getElementById("androidVersion");
  const kernelEl  = document.getElementById("kernelVersion");

  if (!androidEl || !kernelEl) {
    console.warn("System elements missing in DOM");
    return;
  }

  try {
    const android = await exec("getprop ro.build.version.release");
    const sdk     = await exec("getprop ro.build.version.sdk");
    const kernel  = await exec("uname -r");

    androidEl.textContent = `${android} (SDK ${sdk})`;
    kernelEl.textContent  = kernel;

  } catch (e) {
    console.error("System info error:", e);

    // Fallback UI (never blank)
    androidEl.textContent = "Unknown";
    kernelEl.textContent  = "Unknown";
  }
}

/* =========================
   INIT (DOM SAFE)
========================= */
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", loadSystem);
} else {
  loadSystem();
}