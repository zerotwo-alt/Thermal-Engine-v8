"use strict";

/* ================= VIDEO BANNER ================= */

document.addEventListener("DOMContentLoaded", () => {
  const toggle = document.getElementById("videoToggle");
  const video  = document.getElementById("bannerVideo");
  const image  = document.getElementById("bannerImage");

  if (!toggle || !video || !image) return;

  const VIDEO_SRC = "assets/banner.mp4";

  /* ---------- LOAD STATE ---------- */
  const saved = localStorage.getItem("videoBanner") === "on";
  toggle.checked = saved;

  if (saved) enableVideo();
  else disableVideo();

  /* ---------- TOGGLE ---------- */
  toggle.addEventListener("change", () => {
    toggle.checked ? enableVideo() : disableVideo();
  });

  /* ---------- FUNCTIONS ---------- */
  function enableVideo() {
    localStorage.setItem("videoBanner", "on");

    if (!video.src) video.src = VIDEO_SRC;

    image.style.display = "none";
    video.style.display = "block";

    video.muted = true;
    video.loop = true;
    video.playsInline = true;

    const play = video.play();
    if (play) play.catch(() => {}); // silent autoplay fix
  }

  function disableVideo() {
    localStorage.setItem("videoBanner", "off");

    video.pause();
    video.removeAttribute("src");
    video.load();

    video.style.display = "none";
    image.style.display = "block";
  }
});