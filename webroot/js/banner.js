"use strict";

/* ================= KERNELSU EXEC ================= */
function exec(cmd) {
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

/* ================= PATHS ================= */
const MOD_ROOT   = "/data/adb/modules/thermal";
const ASSETS_DIR = `${MOD_ROOT}/webroot/assets`;
const DOWNLOAD   = "/sdcard/Download";
const CONFIG     = `${MOD_ROOT}/banner_config.json`;

/* ================= STATE ================= */
const DEFAULT_CONFIG = { 
  darkness: 30, 
  blur: 0,
  type: "image"
};
let bannerConfig = { ...DEFAULT_CONFIG };

let selectedBannerPath = "current";
let selectedIsVideo = false;
let files = [];
let offset = 0;
let loading = false;
let busy = false;

const BATCH = 12;

/* ================= INIT ================= */
document.addEventListener("DOMContentLoaded", async () => {
  await setupBannerMenu();
  await loadConfigAndApply();
});

/* ================= CONFIG ================= */
async function loadConfigAndApply() {
  try {
    const configStr = await exec(`cat "${CONFIG}" 2>/dev/null || echo '{}'`);
    if (configStr && configStr.trim()) {
      bannerConfig = { ...DEFAULT_CONFIG, ...JSON.parse(configStr) };
    }
  } catch (e) {
    console.warn("Failed to load config, using defaults:", e);
    bannerConfig = { ...DEFAULT_CONFIG };
  }
  applyToMainBanner();
}

/* ================= MAIN BANNER ================= */
function applyToMainBanner() {
  const img = document.getElementById("bannerImage");
  if (!img) return;

  let ov = document.getElementById("bannerOverlay");
  if (!ov) {
    ov = document.createElement("div");
    ov.id = "bannerOverlay";
    ov.className = "banner-overlay";
    ov.style.pointerEvents = "none";
    ov.style.position = "absolute";
    ov.style.top = "0";
    ov.style.left = "0";
    ov.style.width = "100%";
    ov.style.height = "100%";
    ov.style.zIndex = "2";
    img.parentNode.appendChild(ov);
  }

  // Ensure container has proper styling
  const container = img.parentNode;
  if (container && container.style) {
    container.style.position = "relative";
    container.style.overflow = "hidden";
  }

  // Handle video mode
  if (bannerConfig.type === "video") {
    console.log("Video mode: Setting up video banner");
    
    // Hide image
    img.style.display = "none";
    
    // Check if video element exists
    let video = document.getElementById("bannerVideo");
    if (!video) {
      console.log("Creating video element");
      video = document.createElement("video");
      video.id = "bannerVideo";
      video.className = "banner-media";
      video.autoplay = true;
      video.loop = true;
      video.muted = true;
      video.playsInline = true;
      video.preload = "auto";
      video.style.width = "100%";
      video.style.height = "100%";
      video.style.objectFit = "cover";
      video.style.position = "absolute";
      video.style.top = "0";
      video.style.left = "0";
      video.style.zIndex = "1";
      video.style.backgroundColor = "#000";
      
      // Insert before overlay
      if (ov.parentNode) {
        ov.parentNode.insertBefore(video, ov);
      }
      
      // Add error handling
      video.addEventListener('error', (e) => {
        console.error("Video error:", video.error);
        // Fallback to image
        bannerConfig.type = "image";
        saveConfig();
        setTimeout(applyToMainBanner, 1000);
      });
    }
    
    // Show video
    video.style.display = "block";
    video.src = `assets/banner.mp4?t=${Date.now()}`;
    
    // Try to play
    const playVideo = () => {
      video.play()
        .then(() => {
          console.log("Video playing");
        })
        .catch(e => {
          console.log("Play failed:", e.name);
          if (e.name === 'NotAllowedError') {
            // Add play button
            addVideoPlayButton(video);
          }
        });
    };
    
    // Try to play when ready
    video.addEventListener('canplay', playVideo);
    setTimeout(playVideo, 1000);
    
  } else {
    // Image mode
    console.log("Image mode: Setting up image banner");
    
    // Hide video if exists
    const video = document.getElementById("bannerVideo");
    if (video) {
      video.style.display = "none";
      video.pause();
    }
    
    // Show image with blur
    img.style.display = "block";
    img.style.position = "absolute";
    img.style.zIndex = "1";
    img.src = `assets/banner.webp?t=${Date.now()}`;
    img.style.filter = `blur(${bannerConfig.blur}px)`;
    console.log("Main banner blur applied:", bannerConfig.blur + "px");
  }
  
  // Apply darkness to overlay
  ov.style.background = `rgba(0,0,0,${bannerConfig.darkness / 100})`;
}

/* ================= VIDEO PLAY BUTTON ================= */
function addVideoPlayButton(video) {
  const existing = document.getElementById('videoPlayBtn');
  if (existing) existing.remove();
  
  const btn = document.createElement("div");
  btn.id = "videoPlayBtn";
  btn.innerHTML = "▶ PLAY";
  btn.style.cssText = `
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: rgba(0,0,0,0.8);
    color: white;
    padding: 12px 24px;
    border-radius: 8px;
    cursor: pointer;
    z-index: 10;
    font-size: 16px;
    font-weight: bold;
    border: 2px solid white;
  `;
  
  btn.onclick = () => {
    video.play()
      .then(() => {
        btn.style.display = 'none';
      })
      .catch(err => {
        console.log("Manual play failed:", err);
        btn.innerHTML = "ERROR";
        btn.style.background = "rgba(255,0,0,0.8)";
      });
  };
  
  // Add to video container
  const container = video.parentNode;
  if (container) {
    container.appendChild(btn);
  }
}

/* ================= SAVE CONFIG ================= */
async function saveConfig() {
  try {
    const configStr = JSON.stringify(bannerConfig, null, 2);
    const escapedConfig = configStr.replace(/'/g, "'\"'\"'");
    await exec(`echo '${escapedConfig}' > "${CONFIG}" 2>/dev/null`);
    console.log("Config saved");
  } catch (e) {
    console.error("Failed to save config:", e);
  }
}

/* ================= MENU ================= */
async function setupBannerMenu() {
  const openBtn  = document.getElementById("btnOpenBannerModal");
  const closeBtn = document.getElementById("closeBanner");
  const saveBtn  = document.getElementById("btnSaveBanner");
  const modal    = document.getElementById("modalBanner");

  const gallery  = document.getElementById("bannerGalleryArea");
  const pImg     = document.getElementById("previewImage");
  const pVideo   = document.getElementById("previewVideo");
  const pOv      = document.getElementById("previewOverlay");
  
  const typeToggle = document.getElementById("typeToggle");
  const typeLabel = document.getElementById("typeLabel");

  const rD = document.getElementById("rangeDarkness");
  const rB = document.getElementById("rangeBlur");
  const vD = document.getElementById("valDarkness");
  const vB = document.getElementById("valBlur");

  // Check if elements exist
  if (!openBtn || !closeBtn || !saveBtn || !modal || !gallery || !rD || !rB || !vD || !vB) {
    console.error("Required elements not found!");
    return;
  }

  // Initialize
  modal.style.display = "none";
  modal.style.opacity = "0";
  
  if (pVideo) {
    pVideo.autoplay = true;
    pVideo.loop = true;
    pVideo.muted = true;
    pVideo.playsInline = true;
    pVideo.style.display = "none";
  }
  
  if (pImg) {
    pImg.style.display = "block";
  }
  
  // Set initial values
  rD.value = bannerConfig.darkness;
  rB.value = bannerConfig.blur;
  updatePreview();

  /* ---------- TYPE TOGGLE ---------- */
  function updateTypeDisplay() {
    if (!typeToggle || !typeLabel) return;
    
    const isVideo = typeToggle.checked;
    
    typeLabel.textContent = isVideo ? "Video" : "Image";
    typeLabel.style.color = isVideo ? "#2196F3" : "#4CAF50";
    
    // Show/hide blur control
    const blurControl = document.querySelector('.control-group[data-control="blur"]');
    if (blurControl) {
      blurControl.style.display = isVideo ? 'none' : 'block';
    }
    
    // Show/hide preview media
    if (pImg && pVideo) {
      if (isVideo) {
        pImg.style.display = "none";
        pVideo.style.display = "block";
      } else {
        pImg.style.display = "block";
        pVideo.style.display = "none";
      }
    }
    
    // IMPORTANT: Update preview blur when mode changes
    updatePreview();
  }

  if (typeToggle && typeLabel) {
    typeToggle.checked = bannerConfig.type === "video";
    updateTypeDisplay();
    
    typeToggle.onchange = function() {
      updateTypeDisplay();
    };
  }

  /* ---------- OPEN MODAL ---------- */
  openBtn.onclick = async () => {
    if (busy) return;
    
    modal.style.display = "flex";
    setTimeout(() => {
      modal.style.opacity = "1";
    }, 10);
    
    modal.classList.add("active");
    selectedBannerPath = "current";
    selectedIsVideo = bannerConfig.type === "video";

    rD.value = bannerConfig.darkness;
    rB.value = bannerConfig.blur;
    
    if (typeToggle) {
      typeToggle.checked = bannerConfig.type === "video";
      updateTypeDisplay();
    }

    updatePreviewContent();
    await initGallery();
  };

  /* ---------- CLOSE MODAL ---------- */
  function closeModal() {
    modal.style.opacity = "0";
    setTimeout(() => {
      modal.style.display = "none";
      modal.classList.remove("active");
      cleanupTempFiles();
      stopVideoPreview();
    }, 300);
  }

  closeBtn.onclick = closeModal;
  
  modal.onclick = (e) => {
    if (e.target === modal) closeModal();
  };

  /* ---------- PREVIEW ---------- */
  function updatePreviewContent() {
    if (selectedBannerPath === "current") {
      if (bannerConfig.type === "video") {
        if (pVideo) {
          pVideo.src = `assets/banner.mp4?t=${Date.now()}`;
          pVideo.load();
        }
      } else {
        if (pImg) {
          pImg.src = `assets/banner.webp?t=${Date.now()}`;
        }
      }
    }
  }

  function updatePreview() {
    console.log("Updating preview:", {
      darkness: rD.value,
      blur: rB.value,
      isVideo: typeToggle ? typeToggle.checked : false
    });
    
    vD.textContent = `${rD.value}%`;
    vB.textContent = `${rB.value}px`;
    
    // Update preview overlay darkness
    if (pOv) {
      pOv.style.background = `rgba(0,0,0,${rD.value / 100})`;
    }
    
    // Update preview image blur - FIXED
    if (pImg) {
      const isImageMode = typeToggle ? !typeToggle.checked : true;
      
      if (isImageMode) {
        // Apply blur for image mode
        pImg.style.filter = `blur(${rB.value}px)`;
        console.log("Preview blur applied:", rB.value + "px");
      } else {
        // No blur for video mode
        pImg.style.filter = 'none';
      }
    }
    
    // Update preview video (no blur)
    if (pVideo) {
      pVideo.style.filter = 'none';
    }
  }

  rD.oninput = updatePreview;
  rB.oninput = updatePreview;

  /* ---------- GALLERY ---------- */
  async function initGallery() {
    if (!gallery) return;
    
    gallery.innerHTML = "";
    files = [];
    offset = 0;
    loading = false;

    // Add current banner
    addGalleryItem("Current Banner", "current", bannerConfig.type, true);

    try {
      const result = await exec(
        `find "${DOWNLOAD}" -maxdepth 1 -type f \\( -iname "*.jpg" -o -iname "*.jpeg" -o -iname "*.png" -o -iname "*.webp" -o -iname "*.gif" -o -iname "*.mp4" -o -iname "*.webm" -o -iname "*.mkv" -o -iname "*.avi" -o -iname "*.mov" \\) | head -n 50`
      );
      files = result.split("\n").filter(f => f.trim());
    } catch (e) {
      console.log("Error listing files:", e);
      files = [];
    }

    loadNext();

    gallery.onscroll = () => {
      if (!loading && gallery.scrollLeft + gallery.clientWidth >= gallery.scrollWidth - 60) {
        loadNext();
      }
    };
  }

  function loadNext() {
    if (loading || offset >= files.length) return;
    loading = true;

    const slice = files.slice(offset, offset + BATCH);
    offset += BATCH;

    slice.forEach(filePath => {
      const fileName = filePath.split('/').pop();
      const isVideo = /\.(mp4|webm|mkv|avi|mov)$/i.test(fileName);
      addGalleryItem(fileName, filePath, isVideo ? "video" : "image", false);
    });

    loading = false;
  }

  function addGalleryItem(label, filePath, mediaType, isCurrent) {
    if (!gallery) return;
    
    const el = document.createElement("div");
    el.className = "gallery-item";
    el.dataset.type = mediaType;
    el.dataset.path = filePath;
    
    if (isCurrent) {
      el.classList.add("current-banner");
    }
    
    let mediaEl;
    if (mediaType === "video") {
      mediaEl = document.createElement("div");
      mediaEl.className = "video-thumbnail";
      mediaEl.innerHTML = `<div class="video-icon">▶</div><div class="video-badge">VIDEO</div>`;
    } else {
      mediaEl = document.createElement("img");
      mediaEl.loading = "lazy";
    }
    
    el.appendChild(mediaEl);
    
    const labelEl = document.createElement("div");
    labelEl.className = "gallery-label";
    labelEl.textContent = label.length > 12 ? label.substring(0, 10) + "..." : label;
    el.appendChild(labelEl);
    
    el.onclick = async () => {
      if (busy) return;
      
      document.querySelectorAll(".gallery-item").forEach(i => i.classList.remove("selected"));
      el.classList.add("selected");
      
      selectedBannerPath = filePath;
      selectedIsVideo = mediaType === "video";
      
      // Auto-switch type toggle
      if (typeToggle && typeToggle.checked !== selectedIsVideo) {
        typeToggle.checked = selectedIsVideo;
        updateTypeDisplay();
      }
      
      await loadPreview(filePath, mediaType, isCurrent);
      updatePreview();
    };
    
    // Load thumbnail
    if (!isCurrent) {
      setTimeout(() => loadThumbnail(mediaEl, filePath, mediaType), 50);
    } else {
      if (mediaType === "video") {
        if (mediaEl.style) {
          mediaEl.style.background = "#202020";
        }
      } else {
        if (mediaEl.tagName === "IMG") {
          mediaEl.src = `assets/banner.webp?t=${Date.now()}`;
        }
      }
    }
    
    gallery.appendChild(el);
  }

  async function loadPreview(filePath, mediaType, isCurrent) {
    busy = true;
    try {
      if (isCurrent) {
        updatePreviewContent();
      } else {
        const isVideo = mediaType === "video";
        const tempExt = isVideo ? "mp4" : "webp";
        const tempName = `temp_preview.${tempExt}`;
        const tempPath = `${ASSETS_DIR}/${tempName}`;
        
        await exec(`cp -f "${filePath}" "${tempPath}" 2>/dev/null`);
        
        selectedBannerPath = filePath;
        
        if (isVideo && pVideo) {
          pVideo.src = `assets/${tempName}?t=${Date.now()}`;
          pVideo.load();
          pVideo.play().catch(e => console.log("Video autoplay blocked:", e));
        } else if (pImg) {
          pImg.src = `assets/${tempName}?t=${Date.now()}`;
          // Apply current blur to new preview image
          pImg.style.filter = `blur(${rB.value}px)`;
        }
      }
    } catch (e) {
      console.error("Preview error:", e);
      showError("Failed to load preview");
    }
    busy = false;
  }

  async function loadThumbnail(mediaEl, filePath, mediaType) {
    try {
      if (mediaType === "video") {
        if (mediaEl.style) {
          mediaEl.style.background = "#202020";
          mediaEl.style.backgroundImage = `url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="%23202020"/><path d="M40 30v40M60 30v40M45 50h10M40 35l20 15-20 15z" stroke="%23404040" stroke-width="4"/></svg>')`;
          mediaEl.style.backgroundSize = "cover";
        }
      } else {
        if (mediaEl.tagName === "IMG") {
          const thumbName = `thumb_${Date.now()}_${Math.random().toString(36).slice(2)}.webp`;
          const thumbPath = `${ASSETS_DIR}/${thumbName}`;
          
          try {
            await exec(`cp -f "${filePath}" "${thumbPath}" 2>/dev/null`);
            mediaEl.src = `assets/${thumbName}?t=${Date.now()}`;
            mediaEl.dataset.thumb = thumbPath;
          } catch (e) {
            mediaEl.src = "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgdmlld0JveD0iMCAwIDEwMCAxMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjEwMCIgaGVpZ2h0PSIxMDAiIGZpbGw9IiMyMDIwMjAiLz48Y2lyY2xlIGN4PSI1MCIgY3k9IjUwIiByPSIzMCIgc3Ryb2tlPSIjNDA0MDQwIiBzdHJva2Utd2lkdGg9IjQiLz48cGF0aCBkPSJNMzUgMzVWNjVNNjUgMzVWNjVNNTAgMjBWNjBNMzUgNTBINjUiIHN0cm9rZT0iIzQwNDA0MCIgc3Ryb2tlLXdpZHRoPSI0IiBzdHJva2UtbGluZWNhcD0icm91bmQiLz48L3N2Zz4=";
          }
        }
      }
    } catch (e) {
      console.error("Thumbnail error:", e);
    }
  }

  function stopVideoPreview() {
    if (pVideo) {
      pVideo.pause();
      pVideo.currentTime = 0;
    }
  }

  async function cleanupTempFiles() {
    try {
      await exec(`rm -f ${ASSETS_DIR}/temp_preview.* ${ASSETS_DIR}/thumb_*.webp 2>/dev/null`);
    } catch (e) {
      console.log("Cleanup error:", e);
    }
  }

  /* ---------- SAVE FUNCTION ---------- */
  saveBtn.onclick = async () => {
    if (busy) return;
    busy = true;
    
    const originalText = saveBtn.textContent;
    saveBtn.textContent = "Saving...";
    saveBtn.disabled = true;
    
    try {
      const saveAsVideo = typeToggle ? typeToggle.checked : false;
      
      // Define file paths
      const imageFile = `${ASSETS_DIR}/banner.webp`;
      const videoFile = `${ASSETS_DIR}/banner.mp4`;
      
      // Determine final save type
      let finalSaveType = saveAsVideo;
      
      if (selectedBannerPath !== "current") {
        const fileName = selectedBannerPath.toLowerCase();
        const isVideoFile = /\.(mp4|webm|mkv|avi|mov)$/i.test(fileName);
        const isImageFile = /\.(jpg|jpeg|png|webp|gif)$/i.test(fileName);
        
        if (isVideoFile && !saveAsVideo) {
          finalSaveType = true;
          if (typeToggle) {
            typeToggle.checked = true;
            updateTypeDisplay();
          }
          showToast("Auto-switched to Video mode");
        } else if (isImageFile && saveAsVideo) {
          finalSaveType = false;
          if (typeToggle) {
            typeToggle.checked = false;
            updateTypeDisplay();
          }
          showToast("Auto-switched to Image mode");
        }
      }
      
      // Save the file
      if (finalSaveType) {
        // Save video
        if (selectedBannerPath === "current") {
          console.log("Keeping current video");
        } else {
          await exec(`cp -f "${selectedBannerPath}" "${videoFile}"`);
        }
      } else {
        // Save image
        if (selectedBannerPath === "current") {
          console.log("Keeping current image");
        } else {
          await exec(`cp -f "${selectedBannerPath}" "${imageFile}"`);
        }
      }
      
      // Update config
      bannerConfig.darkness = parseInt(rD.value);
      bannerConfig.blur = parseInt(rB.value);
      bannerConfig.type = finalSaveType ? "video" : "image";
      
      // Save config
      await saveConfig();
      
      // Update main banner
      applyToMainBanner();
      
      // Show success
      showToast(`✅ ${finalSaveType ? "Video" : "Image"} saved successfully!`);
      
      setTimeout(() => {
        closeModal();
      }, 1500);
      
    } catch (error) {
      console.error("SAVE FAILED:", error);
      showError("Save failed: " + (error.message || error));
      
    } finally {
      saveBtn.textContent = originalText;
      saveBtn.disabled = false;
      busy = false;
    }
  };

  function showToast(message) {
    const existing = document.querySelector('.toast-message');
    if (existing) existing.remove();
    
    const toast = document.createElement("div");
    toast.className = "toast-message";
    toast.textContent = message;
    toast.style.cssText = `
      position: fixed;
      top: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: #4CAF50;
      color: white;
      padding: 12px 24px;
      border-radius: 4px;
      z-index: 10000;
      animation: toastIn 0.3s ease;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      font-weight: bold;
    `;
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
      toast.style.animation = "toastOut 0.3s ease";
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  function showError(message) {
    const existing = document.querySelector('.error-message');
    if (existing) existing.remove();
    
    const error = document.createElement("div");
    error.className = "error-message";
    error.textContent = message;
    error.style.cssText = `
      position: fixed;
      top: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: #f44336;
      color: white;
      padding: 12px 24px;
      border-radius: 4px;
      z-index: 10000;
      animation: toastIn 0.3s ease;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    `;
    
    document.body.appendChild(error);
    
    setTimeout(() => {
      error.style.animation = "toastOut 0.3s ease";
      setTimeout(() => error.remove(), 300);
    }, 3000);
  }
}