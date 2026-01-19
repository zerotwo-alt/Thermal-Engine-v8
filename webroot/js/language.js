"use strict";

/* =========================
CONFIG
========================= */
const LANG_PATH = "lang/";
const DEFAULT_LANG = "en";

/* =========================
STATE
========================= */
let translations = {};
let currentLang = localStorage.getItem("lang") || DEFAULT_LANG;

/* =========================
APPLY LANGUAGE
========================= */
async function applyLanguage(lang) {
  try {
    const res = await fetch(`${LANG_PATH}${lang}.json`, { cache: "no-store" });
    if (!res.ok) throw new Error("Language file not found");

    translations = await res.json();

    localStorage.setItem("lang", lang);
    currentLang = lang;

    document.querySelectorAll("[data-i18n]").forEach(el => {
      const key = el.dataset.i18n;
      if (translations[key]) {
        el.textContent = translations[key];
      }
    });

    // RTL support
    document.documentElement.lang = lang;
    document.documentElement.dir = (lang === "ar") ? "rtl" : "ltr";

    updateButtons(lang);
    updateActiveItem(lang);

  } catch (e) {
    console.error("Language load failed:", lang, e);
  }
}

/* =========================
BUTTON LABELS
========================= */
function updateButtons(lang) {
  const map = {
    "en": "🇬🇧",
    "hi": "🇮🇳",
    "zh-han": "🇨🇳",
    "jp": "🇯🇵",
    "kr": "🇰🇷",
    "ar": "🇸🇦",
    "id": "🇮🇩",
    "vn": "🇻🇳",
    "ru": "🇷🇺",
    "es": "🇪🇸",
    "pt-br": "🇧🇷",
    "tr": "🇹🇷",
    "pl": "🇵🇱"
  };

  const label = map[lang] || "🌐 Language";

  const bannerBtn = document.getElementById("langBtn");
  const settingsBtn = document.getElementById("settingsLangBtn");

  if (bannerBtn) bannerBtn.textContent = label;
  if (settingsBtn) settingsBtn.textContent = label;
}

/* =========================
ACTIVE ITEM HIGHLIGHT
========================= */
function updateActiveItem(lang) {
  document.querySelectorAll("[data-lang]").forEach(li => {
    li.classList.toggle("active", li.dataset.lang === lang);
  });
}

/* =========================
INIT
========================= */
document.addEventListener("DOMContentLoaded", () => {

  // Load saved language
  applyLanguage(currentLang);

  const settingsBtn = document.getElementById("settingsLangBtn");
  const settingsList = document.getElementById("settingsLangOptions");

  if (settingsBtn && settingsList) {

    settingsBtn.addEventListener("click", e => {
      e.stopPropagation();
      settingsList.classList.toggle("show");
    });

    settingsList.addEventListener("click", e => {
      const li = e.target.closest("li");
      if (!li || !li.dataset.lang) return;

      applyLanguage(li.dataset.lang);
      settingsList.classList.remove("show");
    });

    document.addEventListener("click", () => {
      settingsList.classList.remove("show");
    });
  }

});