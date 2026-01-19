"use strict";

/* =========================
   MODULE INFO + STATUS
========================= */

async function loadModuleInfo() {
  const versionEl = document.getElementById("propVersion");
  const authorEl  = document.getElementById("propAuthor");
  const descEl    = document.getElementById("propDescFull");
  const statusEl  = document.getElementById("moduleStatus");

  // Defaults (never leave UI blank)
  if (versionEl) versionEl.textContent = "—";
  if (authorEl)  authorEl.textContent  = "—";
  if (descEl)    descEl.textContent    = "Module not detected";

  let text = "";
  let online = false;

  /* =========================
     POSSIBLE MODULE PATHS
  ========================= */
  const paths = [
    "/data/adb/modules/thermal/module.prop",         // enabled
    "/data/adb/modules_update/thermal/module.prop"  // disabled / pending
  ];

  for (const p of paths) {
    try {
      text = await exec(`cat ${p}`);
      if (text && text.includes("=")) {
        online = true;
        break;
      }
    } catch {}
  }

  /* =========================
     ONLINE / OFFLINE BADGE
  ========================= */
  if (statusEl) {
    if (online) {
      statusEl.classList.remove("offline");
      statusEl.classList.add("online");
      statusEl.textContent = "● Online";
    } else {
      statusEl.classList.remove("online");
      statusEl.classList.add("offline");
      statusEl.textContent = "● Offline";
    }
  }

  if (!text) {
    console.warn("❌ module.prop not found");
    return;
  }

  /* =========================
     PARSE module.prop
  ========================= */
  const info = {};

  text.split("\n").forEach(line => {
    line = line.trim();
    if (!line || line.startsWith("#")) return;

    const idx = line.indexOf("=");
    if (idx === -1) return;

    const key = line.slice(0, idx);
    const val = line.slice(idx + 1);

    info[key] = val;
  });

  /* =========================
     BIND TO UI
  ========================= */
  if (versionEl) versionEl.textContent = info.version || "—";
  if (authorEl)  authorEl.textContent  = info.author || "—";
  if (descEl)    descEl.textContent    = info.description || "—";

  console.log("✅ module.prop loaded:", info);
}

/* =========================
   SAFE INIT (KernelSU READY)
========================= */
(function waitForExec() {
  if (typeof exec === "function") {
    loadModuleInfo();
  } else {
    setTimeout(waitForExec, 100);
  }
})();