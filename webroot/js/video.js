"use strict";

/* ================= VIDEO BANNER TOGGLE (INTEGRATED VERSION) ================= */

document.addEventListener("DOMContentLoaded", async () => {
  const toggle = document.getElementById("videoToggle");
  const video  = document.getElementById("bannerVideo");
  const image  = document.getElementById("bannerImage");

  if (!toggle || !video || !image) return;

  const VIDEO_SRC = "assets/banner.mp4";

  // Load banner config to sync with toggle
  let bannerConfig = { type: "image" };
  try {
    const configStr = await exec(`cat "/data/adb/modules/thermal/banner_config.json" 2>/dev/null || echo '{}'`);
    if (configStr && configStr.trim()) {
      bannerConfig = { ...bannerConfig, ...JSON.parse(configStr) };
    }
  } catch (e) {
    console.warn("Failed to load banner config:", e);
  }

  /* ---------- LOAD STATE ---------- */
  // Priority: 1. Banner config, 2. localStorage
  const shouldEnableVideo = bannerConfig.type === "video";
  toggle.checked = shouldEnableVideo;

  if (shouldEnableVideo) {
    enableVideo();
  } else {
    disableVideo();
  }

  /* ---------- TOGGLE ---------- */
  toggle.addEventListener("change", async () => {
    if (toggle.checked) {
      await enableVideoWithConfig();
    } else {
      await disableVideoWithConfig();
    }
  });

  /* ---------- FUNCTIONS ---------- */
  async function enableVideoWithConfig() {
    console.log("Enabling video banner with config save");
    
    // Update banner config
    bannerConfig.type = "video";
    await saveBannerConfig(bannerConfig);
    
    // Enable video display
    enableVideo();
  }

  async function disableVideoWithConfig() {
    console.log("Disabling video banner with config save");
    
    // Update banner config
    bannerConfig.type = "image";
    await saveBannerConfig(bannerConfig);
    
    // Disable video display
    disableVideo();
  }

  function enableVideo() {
    console.log("Enabling video display");
    localStorage.setItem("videoBanner", "on");

    // Always set the source
    video.src = VIDEO_SRC + "?t=" + Date.now();
    
    image.style.display = "none";
    video.style.display = "block";

    video.muted = true;
    video.loop = true;
    video.playsInline = true;
    video.preload = "auto";

    // Load the video
    video.load();

    // Try to play
    const tryPlay = () => {
      console.log("Attempting to play video...");
      video.play()
        .then(() => {
          console.log("Video playing successfully");
        })
        .catch(error => {
          console.log("Play failed:", error.name);
          
          if (error.name === 'NotAllowedError') {
            console.log("Autoplay blocked");
            
            // Add play button
            const playBtn = document.createElement("div");
            playBtn.innerHTML = "▶ TAP TO PLAY";
            playBtn.style.cssText = `
              position: absolute;
              top: 50%;
              left: 50%;
              transform: translate(-50%, -50%);
              background: rgba(0,0,0,0.8);
              color: white;
              padding: 10px 20px;
              border-radius: 8px;
              cursor: pointer;
              z-index: 10;
              font-size: 14px;
              font-weight: bold;
            `;
            
            playBtn.onclick = () => {
              video.play()
                .then(() => {
                  playBtn.style.display = 'none';
                })
                .catch(e => {
                  console.log("Manual play failed:", e);
                  playBtn.innerHTML = "ERROR";
                  playBtn.style.background = "rgba(255,0,0,0.8)";
                });
            };
            
            const container = video.parentNode;
            if (container) {
              container.appendChild(playBtn);
            }
            
            // Auto-remove
            setTimeout(() => {
              if (!video.paused && playBtn.parentNode) {
                playBtn.remove();
              }
            }, 10000);
          }
        });
    };

    video.addEventListener('loadeddata', tryPlay);
    video.addEventListener('canplay', tryPlay);
    setTimeout(tryPlay, 1000);
  }

  function disableVideo() {
    console.log("Disabling video display");
    localStorage.setItem("videoBanner", "off");

    video.pause();
    video.currentTime = 0;
    video.src = "";

    video.style.display = "none";
    image.style.display = "block";
  }

  /* ---------- CHECK VIDEO ON LOAD ---------- */
  if (toggle.checked) {
    setTimeout(() => {
      if (video.paused && video.readyState >= 2) {
        console.log("Retrying video playback...");
        video.play().catch(e => {
          console.log("Retry failed:", e.name);
        });
      }
    }, 2000);
  }

  /* ---------- HELPER FUNCTIONS ---------- */
  async function saveBannerConfig(config) {
    try {
      const configStr = JSON.stringify(config, null, 2);
      const escapedConfig = configStr.replace(/'/g, "'\"'\"'");
      await exec(`echo '${escapedConfig}' > "/data/adb/modules/thermal/banner_config.json" 2>/dev/null`);
      console.log("Banner config saved:", config);
    } catch (e) {
      console.error("Failed to save banner config:", e);
    }
  }

  async function exec(cmd) {
    return new Promise((resolve, reject) => {
      if (typeof ksu === "undefined") return reject("KernelSU not available");
      const cb = "cb_" + Math.random().toString(36).slice(2);
      window[cb] = (code, out) => {
        delete window[cb];
        code === 0 ? resolve((out || "").trim()) : reject(out || `Command failed with code ${code}`);
      };
      ksu.exec(cmd, `window.${cb}`);
    });
  }
});