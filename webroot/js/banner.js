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
  const container = document.getElementById("bannerContainer");
  if (!container) return;
  
  container.innerHTML = "";
  
  let mediaElement;
  if (bannerConfig.type === "video") {
    mediaElement = document.createElement("video");
    mediaElement.id = "bannerVideo";
    mediaElement.className = "banner-media";
    mediaElement.autoplay = true;
    mediaElement.loop = true;
    mediaElement.muted = true;
    mediaElement.playsInline = true;
    mediaElement.src = `assets/banner.mp4?t=${Date.now()}`;
  } else {
    mediaElement = document.createElement("img");
    mediaElement.id = "bannerImage";
    mediaElement.className = "banner-media";
    mediaElement.src = `assets/banner.webp?t=${Date.now()}`;
    mediaElement.style.filter = `blur(${bannerConfig.blur}px)`;
  }
  
  mediaElement.style.width = "100%";
  mediaElement.style.height = "100%";
  mediaElement.style.objectFit = "cover";
  container.appendChild(mediaElement);
  
  const overlay = document.createElement("div");
  overlay.id = "bannerOverlay";
  overlay.className = "banner-overlay";
  overlay.style.background = `rgba(0,0,0,${bannerConfig.darkness / 100})`;
  container.appendChild(overlay);
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
  
  rD.value = bannerConfig.darkness;
  rB.value = bannerConfig.blur;
  updatePreview();

  /* ---------- TYPE TOGGLE ---------- */
  function updateTypeDisplay() {
    if (!typeToggle || !typeLabel) return;
    
    const isVideo = typeToggle.checked;
    
    typeLabel.textContent = isVideo ? "Video" : "Image";
    typeLabel.style.color = isVideo ? "#2196F3" : "#4CAF50";
    
    const blurControl = document.querySelector('.control-group[data-control="blur"]');
    if (blurControl) {
      blurControl.style.display = isVideo ? 'none' : 'block';
    }
    
    if (pImg && pVideo) {
      if (isVideo) {
        pImg.style.display = "none";
        pVideo.style.display = "block";
      } else {
        pImg.style.display = "block";
        pVideo.style.display = "none";
      }
    }
  }

  if (typeToggle && typeLabel) {
    typeToggle.checked = bannerConfig.type === "video";
    updateTypeDisplay();
    
    typeToggle.onchange = function() {
      updateTypeDisplay();
      updatePreview();
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
    vD.textContent = `${rD.value}%`;
    vB.textContent = `${rB.value}px`;
    
    if (pOv) {
      pOv.style.background = `rgba(0,0,0,${rD.value / 100})`;
    }
    
    if (pImg) {
      pImg.style.filter = `blur(${rB.value}px)`;
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
      
      // AUTO-SWITCH TYPE TOGGLE BASED ON SELECTED FILE
      if (typeToggle && typeToggle.checked !== selectedIsVideo) {
        typeToggle.checked = selectedIsVideo;
        updateTypeDisplay();
        
        // Show notification about auto-switch
        if (selectedIsVideo) {
          showToast("Auto-switched to Video mode");
        } else {
          showToast("Auto-switched to Image mode");
        }
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
      // Get current toggle state
      const saveAsVideo = typeToggle ? typeToggle.checked : false;
      console.log("SAVE ACTION:");
      console.log("- Type toggle:", saveAsVideo ? "VIDEO" : "IMAGE");
      console.log("- Selected file:", selectedBannerPath);
      console.log("- Selected is video file:", selectedIsVideo);
      
      // Define file paths
      const imageFile = `${ASSETS_DIR}/banner.webp`;
      const videoFile = `${ASSETS_DIR}/banner.mp4`;
      
      // Determine final save type
      let finalSaveType = saveAsVideo;
      if (selectedIsVideo && !saveAsVideo) {
        console.log("WARNING: Video file selected but type toggle is set to Image!");
        console.log("FORCING video save mode...");
        finalSaveType = true;
        if (typeToggle) {
          typeToggle.checked = true;
          updateTypeDisplay();
        }
        showToast("Auto-corrected: Saving as video (selected file is video)");
      }
      
      console.log("Final save type:", finalSaveType ? "VIDEO" : "IMAGE");
      
      // Handle the file operations
      if (finalSaveType) {
        // === SAVE AS VIDEO (MP4) ===
        console.log("PROCESSING VIDEO SAVE...");
        
        if (selectedBannerPath === "current") {
          console.log("Keeping current video file");
        } else {
          console.log(`Copying video: ${selectedBannerPath} -> ${videoFile}`);
          
          const isVideoFile = /\.(mp4|webm|mkv|avi|mov)$/i.test(selectedBannerPath);
          if (!isVideoFile) {
            throw new Error("Selected file is not a video. Choose a video file.");
          }
          
          await exec(`cp -f "${selectedBannerPath}" "${videoFile}" 2>/dev/null`);
          
          try {
            const check = await exec(`ls -la "${videoFile}" 2>/dev/null`);
            console.log("Video file created:", check);
          } catch {
            throw new Error("Failed to create video file");
          }
        }
        
        try {
          await exec(`rm -f "${imageFile}" 2>/dev/null`);
          console.log("Removed old image file");
        } catch (e) {
          console.log("No image file to remove");
        }
        
      } else {
        // === SAVE AS IMAGE (WEBP) ===
        console.log("PROCESSING IMAGE SAVE...");
        
        if (selectedBannerPath === "current") {
          console.log("Keeping current image file");
        } else {
          console.log(`Copying image: ${selectedBannerPath} -> ${imageFile}`);
          
          await exec(`cp -f "${selectedBannerPath}" "${imageFile}" 2>/dev/null`);
          
          try {
            const check = await exec(`ls -la "${imageFile}" 2>/dev/null`);
            console.log("Image file created:", check);
          } catch {
            throw new Error("Failed to create image file");
          }
        }
        
        try {
          await exec(`rm -f "${videoFile}" 2>/dev/null`);
          console.log("Removed old video file");
        } catch (e) {
          console.log("No video file to remove");
        }
      }
      
      // Update config
      bannerConfig.darkness = parseInt(rD.value);
      bannerConfig.blur = parseInt(rB.value);
      bannerConfig.type = finalSaveType ? "video" : "image";
      
      console.log("Updated config:", bannerConfig);
      
      // Save config
      const configStr = JSON.stringify(bannerConfig, null, 2);
      const escapedConfig = configStr.replace(/'/g, "'\"'\"'");
      await exec(`echo '${escapedConfig}' > "${CONFIG}" 2>/dev/null`);
      
      // Update main banner
      applyToMainBanner();
      
      // Show success
      if (finalSaveType) {
        showToast("✅ Video saved as banner.mp4!");
      } else {
        showToast("✅ Image saved as banner.webp!");
      }
      
      setTimeout(() => {
        closeModal();
      }, 1500);
      
    } catch (error) {
      console.error("SAVE FAILED:", error);
      
      let errorMsg = "Save failed";
      if (error.message.includes("Permission")) {
        errorMsg = "Permission error. Check module permissions.";
      } else if (error.message.includes("not a video")) {
        errorMsg = "Selected file is not a video.";
      } else if (error.message.includes("Failed to create")) {
        errorMsg = "File creation failed.";
      } else {
        errorMsg = error.message || error.toString();
      }
      
      showError(errorMsg);
      
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