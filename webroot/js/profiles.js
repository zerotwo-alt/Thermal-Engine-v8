"use strict";

const PROFILE_KEY = "thermal_profile";
const PROFILE_ORDER = ["performance", "balanced", "battery"];

const PROFILES = {
  performance: {
    sconfig: "16",
    boost: "30",
    balance: "0",
    cpu0_gov: "walt", cpu1_gov: "walt", cpu2_gov: "walt", cpu3_gov: "walt",
    cpu4_gov: "walt", cpu5_gov: "walt", cpu6_gov: "walt", cpu7_gov: "walt",
    cpu0_max: "1996800", cpu1_max: "1996800", cpu2_max: "1996800", cpu3_max: "1996800",
    cpu4_max: "2400000", cpu5_max: "2400000", cpu6_max: "2400000", cpu7_max: "2400000",
    gpu_gov: "msm-adreno-tz",
    gpu_max: "940000000"
  },
  balanced: {
    sconfig: "9",
    boost: "2",
    balance: "0",
    cpu0_gov: "schedutil", cpu1_gov: "schedutil", cpu2_gov: "schedutil", cpu3_gov: "schedutil",
    cpu4_gov: "schedutil", cpu5_gov: "schedutil", cpu6_gov: "schedutil", cpu7_gov: "schedutil",
    cpu0_max: "1593600", cpu1_max: "1593600", cpu2_max: "1593600", cpu3_max: "1593600",
    cpu4_max: "1996800", cpu5_max: "1996800", cpu6_max: "1996800", cpu7_max: "1996800",
    gpu_gov: "msm-adreno-tz",
    gpu_max: "710000000"
  },
  battery: {
    sconfig: "0",
    boost: "0",
    balance: "0",
    cpu0_gov: "powersave", cpu1_gov: "powersave", cpu2_gov: "powersave", cpu3_gov: "powersave",
    cpu4_gov: "powersave", cpu5_gov: "powersave", cpu6_gov: "powersave", cpu7_gov: "powersave",
    cpu0_max: "1190400", cpu1_max: "1190400", cpu2_max: "1190400", cpu3_max: "1190400",
    cpu4_max: "1497600", cpu5_max: "1497600", cpu6_max: "1497600", cpu7_max: "1497600",
    gpu_gov: "msm-adreno-tz",
    gpu_max: "430000000"
  }
};

document.addEventListener("DOMContentLoaded", () => {
  const buttons = [...document.querySelectorAll(".profile-btn")];
  const row = document.querySelector(".profile-row");
  if (!row || buttons.length !== 3) return;

  let indicator = row.querySelector(".profile-indicator");
  if (!indicator) {
    indicator = document.createElement("div");
    indicator.className = "profile-indicator";
    row.prepend(indicator);
  }

  // ========== OPTIMIZED WRITE FUNCTIONS ==========
  
  // Cache for path existence
  const pathCache = new Map();
  
  // Fast parallel write without checking existence every time
  async function fastWrite(path, value) {
    return new Promise((resolve) => {
      // Fire and forget - don't wait for result
      exec(`echo ${value} > ${path} 2>/dev/null`)
        .then(() => resolve(true))
        .catch(() => resolve(false));
    });
  }
  
  // Batch write multiple paths at once
  async function batchWrite(writeOperations) {
    const promises = writeOperations.map(([path, value]) => fastWrite(path, value));
    return Promise.all(promises);
  }

  // ========== OPTIMIZED PROFILE FUNCTIONS ==========
  
  async function readCurrentProfile() {
    try {
      const result = await exec(`cat /data/adb/modules/thermal/profile.conf 2>/dev/null || echo "balanced"`);
      const profile = result.trim().toLowerCase();
      return PROFILES[profile] ? profile : "balanced";
    } catch (e) {
      return "balanced";
    }
  }

  async function persist(profile) {
    try {
      // Single exec to do everything
      await exec(`echo '${profile}' > /data/adb/modules/thermal/profile.conf && chmod 644 /data/adb/modules/thermal/profile.conf 2>/dev/null && echo ${Date.now()} > /data/adb/modules/thermal/.js_sync`);
      localStorage.setItem(PROFILE_KEY, profile);
      return true;
    } catch (e) {
      console.error("Error persisting profile:", e.message);
      return false;
    }
  }

  function setActive(profile) {
    const idx = PROFILE_ORDER.indexOf(profile);
    buttons.forEach(b => b.classList.toggle("active", b.dataset.profile === profile));
    indicator.style.transform = `translateX(${idx * 100}%)`;
    
    // Visual feedback
    buttons.forEach(btn => {
      if (btn.dataset.profile === profile) {
        btn.style.opacity = "1";
        btn.style.fontWeight = "bold";
      } else {
        btn.style.opacity = "0.7";
        btn.style.fontWeight = "normal";
      }
    });
  }

  let applying = false;
  let lastApplied = "";

  async function applyProfile(profile) {
    // Prevent duplicate rapid clicks
    if (applying || lastApplied === profile) return;
    
    applying = true;
    lastApplied = profile;
    
    // IMMEDIATE UI FEEDBACK (no waiting for writes)
    setActive(profile);
    
    const p = PROFILES[profile];
    if (!p) {
      applying = false;
      return;
    }

    console.log(`Applying profile: ${profile} (fast)`);
    
    try {
      // Create ALL write operations at once
      const writeOperations = [
        // Thermal settings
        ["/sys/class/thermal/thermal_message/sconfig", p.sconfig],
        ["/sys/class/thermal/thermal_message/boost", p.boost],
        ["/sys/class/thermal/thermal_message/balance_mode", p.balance],
        
        // CPU governors
        ["/sys/devices/system/cpu/cpu0/cpufreq/scaling_governor", p.cpu0_gov],
        ["/sys/devices/system/cpu/cpu1/cpufreq/scaling_governor", p.cpu1_gov],
        ["/sys/devices/system/cpu/cpu2/cpufreq/scaling_governor", p.cpu2_gov],
        ["/sys/devices/system/cpu/cpu3/cpufreq/scaling_governor", p.cpu3_gov],
        ["/sys/devices/system/cpu/cpu4/cpufreq/scaling_governor", p.cpu4_gov],
        ["/sys/devices/system/cpu/cpu5/cpufreq/scaling_governor", p.cpu5_gov],
        ["/sys/devices/system/cpu/cpu6/cpufreq/scaling_governor", p.cpu6_gov],
        ["/sys/devices/system/cpu/cpu7/cpufreq/scaling_governor", p.cpu7_gov],
        
        // CPU frequencies
        ["/sys/devices/system/cpu/cpu0/cpufreq/scaling_max_freq", p.cpu0_max],
        ["/sys/devices/system/cpu/cpu1/cpufreq/scaling_max_freq", p.cpu1_max],
        ["/sys/devices/system/cpu/cpu2/cpufreq/scaling_max_freq", p.cpu2_max],
        ["/sys/devices/system/cpu/cpu3/cpufreq/scaling_max_freq", p.cpu3_max],
        ["/sys/devices/system/cpu/cpu4/cpufreq/scaling_max_freq", p.cpu4_max],
        ["/sys/devices/system/cpu/cpu5/cpufreq/scaling_max_freq", p.cpu5_max],
        ["/sys/devices/system/cpu/cpu6/cpufreq/scaling_max_freq", p.cpu6_max],
        ["/sys/devices/system/cpu/cpu7/cpufreq/scaling_max_freq", p.cpu7_max],
        
        // GPU settings
        ["/sys/class/kgsl/kgsl-3d0/devfreq/governor", p.gpu_gov],
        ["/sys/class/kgsl/kgsl-3d0/max_freq", p.gpu_max]
      ];
      
      // Execute ALL writes in parallel
      const results = await batchWrite(writeOperations);
      
      // Count successes
      const successCount = results.filter(r => r).length;
      console.log(`Fast applied: ${successCount}/${writeOperations.length} settings`);
      
      // Persist in background (don't wait)
      persist(profile).catch(e => console.error("Persist failed:", e));
      
    } catch (error) {
      console.error("Error applying profile:", error);
    }
    
    // Small delay before allowing another change
    setTimeout(() => {
      applying = false;
    }, 300);
  }

  // ========== EVENT LISTENERS ==========
  
  // Add click event listeners
  buttons.forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      applyProfile(btn.dataset.profile);
    });
    
    // Add hover effect
    btn.addEventListener("mouseenter", () => {
      if (!btn.classList.contains("active")) {
        btn.style.transform = "scale(1.05)";
      }
    });
    
    btn.addEventListener("mouseleave", () => {
      btn.style.transform = "scale(1)";
    });
  });

  // ========== INITIALIZATION ==========
  
  async function initialize() {
    // Immediate UI setup
    const savedProfile = localStorage.getItem(PROFILE_KEY) || "balanced";
    setActive(savedProfile);
    
    // Apply saved profile after short delay
    setTimeout(async () => {
      try {
        const fileProfile = await readCurrentProfile();
        
        // If file differs from localStorage, use file
        if (fileProfile !== savedProfile) {
          console.log(`File differs: localStorage=${savedProfile}, file=${fileProfile}`);
          localStorage.setItem(PROFILE_KEY, fileProfile);
          setActive(fileProfile);
          
          // Apply the file profile
          setTimeout(() => applyProfile(fileProfile), 100);
        } else {
          // Apply saved profile
          setTimeout(() => applyProfile(savedProfile), 100);
        }
      } catch (e) {
        console.error("Init error:", e);
        setTimeout(() => applyProfile("balanced"), 100);
      }
    }, 200);
    
    // Quick sync check every 5 seconds
    setInterval(async () => {
      try {
        const fileProfile = await readCurrentProfile();
        const uiProfile = localStorage.getItem(PROFILE_KEY) || "balanced";
        
        if (fileProfile !== uiProfile && !applying) {
          console.log(`Auto-sync: UI=${uiProfile} -> File=${fileProfile}`);
          localStorage.setItem(PROFILE_KEY, fileProfile);
          setActive(fileProfile);
        }
      } catch (e) {
        // Silent fail
      }
    }, 5000);
  }

  // Start initialization
  initialize();
});