"use strict";

const PROFILE_KEY = "thermal_profile";
const PROFILE_ORDER = ["performance", "balanced", "battery"];

const PROFILES = {
  performance: {
    sconfig: "16",
    boost: "30",
    balance: "0",

    // ALL cores use walt governor in performance mode
    cpu0_gov: "walt",       // A55 small core 0
    cpu1_gov: "walt",       // A55 small core 1
    cpu2_gov: "walt",       // A55 small core 2
    cpu3_gov: "walt",       // A55 small core 3
    cpu4_gov: "walt",       // A78 big core 4
    cpu5_gov: "walt",       // A78 big core 5
    cpu6_gov: "walt",       // A78 big core 6
    cpu7_gov: "walt",       // A78 big core 7
    
    // Frequency settings for all cores
    cpu0_max: "1996800",    // A55 core 0 max freq 1.996GHz
    cpu1_max: "1996800",    // A55 core 1 max freq 1.996GHz
    cpu2_max: "1996800",    // A55 core 2 max freq 1.996GHz
    cpu3_max: "1996800",    // A55 core 3 max freq 1.996GHz
    cpu4_max: "2400000",    // A78 core 4 max freq 2.4GHz
    cpu5_max: "2400000",    // A78 core 5 max freq 2.4GHz
    cpu6_max: "2400000",    // A78 core 6 max freq 2.4GHz
    cpu7_max: "2400000",    // A78 core 7 max freq 2.4GHz

    gpu_gov: "msm-adreno-tz",
    gpu_max: "940000000"
  },

  balanced: {
    sconfig: "9",
    boost: "2",
    balance: "0",

    // All cores use schedutil
    cpu0_gov: "schedutil",  // A55 small core 0
    cpu1_gov: "schedutil",  // A55 small core 1
    cpu2_gov: "schedutil",  // A55 small core 2
    cpu3_gov: "schedutil",  // A55 small core 3
    cpu4_gov: "schedutil",  // A78 big core 4
    cpu5_gov: "schedutil",  // A78 big core 5
    cpu6_gov: "schedutil",  // A78 big core 6
    cpu7_gov: "schedutil",  // A78 big core 7

    // Frequency settings for all cores
    cpu0_max: "1593600",    // A55 core 0 limited to 1.593GHz
    cpu1_max: "1593600",    // A55 core 1 limited to 1.593GHz
    cpu2_max: "1593600",    // A55 core 2 limited to 1.593GHz
    cpu3_max: "1593600",    // A55 core 3 limited to 1.593GHz
    cpu4_max: "1996800",    // A78 core 4 limited to 1.996GHz
    cpu5_max: "1996800",    // A78 core 5 limited to 1.996GHz
    cpu6_max: "1996800",    // A78 core 6 limited to 1.996GHz
    cpu7_max: "1996800",    // A78 core 7 limited to 1.996GHz

    gpu_gov: "msm-adreno-tz",
    gpu_max: "710000000"
  },

  battery: {
    sconfig: "0",
    boost: "0",
    balance: "0",

    // All cores use powersave governor
    cpu0_gov: "powersave",  // A55 small core 0
    cpu1_gov: "powersave",  // A55 small core 1
    cpu2_gov: "powersave",  // A55 small core 2
    cpu3_gov: "powersave",  // A55 small core 3
    cpu4_gov: "powersave",  // A78 big core 4
    cpu5_gov: "powersave",  // A78 big core 5
    cpu6_gov: "powersave",  // A78 big core 6
    cpu7_gov: "powersave",  // A78 big core 7
    
    // Frequency settings for all cores
    cpu0_max: "1190400",    // A55 core 0 limited to 1.190GHz
    cpu1_max: "1190400",    // A55 core 1 limited to 1.190GHz
    cpu2_max: "1190400",    // A55 core 2 limited to 1.190GHz
    cpu3_max: "1190400",    // A55 core 3 limited to 1.190GHz
    cpu4_max: "1497600",    // A78 core 4 limited to 1.497GHz
    cpu5_max: "1497600",    // A78 core 5 limited to 1.497GHz
    cpu6_max: "1497600",    // A78 core 6 limited to 1.497GHz
    cpu7_max: "1497600",    // A78 core 7 limited to 1.497GHz

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

  async function write(path, value) {
    try { await exec(`[ -e ${path} ] && echo ${value} > ${path}`); } catch {}
  }

  async function persist(profile) {
    try { await exec(`echo ${profile} > /data/adb/modules/thermal/profile.conf`); } catch {}
  }

  function setActive(profile) {
    const idx = PROFILE_ORDER.indexOf(profile);
    buttons.forEach(b => b.classList.toggle("active", b.dataset.profile === profile));
    indicator.style.transform = `translateX(${idx * 100}%)`;
    localStorage.setItem(PROFILE_KEY, profile);
  }

  let applying = false;

  async function applyProfile(profile) {
    if (applying) return;
    applying = true;

    const p = PROFILES[profile];
    if (!p) return applying = false;

    // Apply thermal settings
    await write("/sys/class/thermal/thermal_message/sconfig", p.sconfig);
    await write("/sys/class/thermal/thermal_message/boost", p.boost);
    await write("/sys/class/thermal/thermal_message/balance_mode", p.balance);

    // Apply CPU governor settings for ALL cores
    await write("/sys/devices/system/cpu/cpu0/cpufreq/scaling_governor", p.cpu0_gov);
    await write("/sys/devices/system/cpu/cpu1/cpufreq/scaling_governor", p.cpu1_gov);
    await write("/sys/devices/system/cpu/cpu2/cpufreq/scaling_governor", p.cpu2_gov);
    await write("/sys/devices/system/cpu/cpu3/cpufreq/scaling_governor", p.cpu3_gov);
    await write("/sys/devices/system/cpu/cpu4/cpufreq/scaling_governor", p.cpu4_gov);
    await write("/sys/devices/system/cpu/cpu5/cpufreq/scaling_governor", p.cpu5_gov);
    await write("/sys/devices/system/cpu/cpu6/cpufreq/scaling_governor", p.cpu6_gov);
    await write("/sys/devices/system/cpu/cpu7/cpufreq/scaling_governor", p.cpu7_gov);

    // Apply CPU frequency settings for ALL cores
    await write("/sys/devices/system/cpu/cpu0/cpufreq/scaling_max_freq", p.cpu0_max);
    await write("/sys/devices/system/cpu/cpu1/cpufreq/scaling_max_freq", p.cpu1_max);
    await write("/sys/devices/system/cpu/cpu2/cpufreq/scaling_max_freq", p.cpu2_max);
    await write("/sys/devices/system/cpu/cpu3/cpufreq/scaling_max_freq", p.cpu3_max);
    await write("/sys/devices/system/cpu/cpu4/cpufreq/scaling_max_freq", p.cpu4_max);
    await write("/sys/devices/system/cpu/cpu5/cpufreq/scaling_max_freq", p.cpu5_max);
    await write("/sys/devices/system/cpu/cpu6/cpufreq/scaling_max_freq", p.cpu6_max);
    await write("/sys/devices/system/cpu/cpu7/cpufreq/scaling_max_freq", p.cpu7_max);

    // Apply GPU settings
    await write("/sys/class/kgsl/kgsl-3d0/devfreq/governor", p.gpu_gov);
    await write("/sys/class/kgsl/kgsl-3d0/max_freq", p.gpu_max);

    // Persist the profile
    await persist(profile);
    setActive(profile);

    applying = false;
  }

  // Add click event listeners to buttons
  buttons.forEach(btn =>
    btn.addEventListener("click", () => applyProfile(btn.dataset.profile))
  );

  // Apply initial profile after delay
  setTimeout(() => applyProfile(localStorage.getItem(PROFILE_KEY) || "balanced"), 120);
});