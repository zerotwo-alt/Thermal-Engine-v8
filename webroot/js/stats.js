"use strict";

/* =========================
   SAFE INIT
========================= */
async function waitForExec() {
  for (let i = 0; i < 20; i++) {
    if (typeof window.exec === "function") return true;
    await new Promise(r => setTimeout(r, 150));
  }
  console.error("❌ KernelSU exec() not available");
  return false;
}

/* =========================
   HELPERS
========================= */
async function read(path) {
  try {
    const v = await exec(`cat ${path} 2>/dev/null`);
    return v?.trim() || null;
  } catch {
    return null;
  }
}

function formatTime(mins) {
  if (!mins || mins <= 0 || mins > 20000) return "--";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

/* =========================
   MAIN
========================= */
document.addEventListener("DOMContentLoaded", async () => {
  if (!(await waitForExec())) return;

  /* =========================
     ELEMENTS
  ========================= */
  const cpuGrid = document.getElementById("cpuGrid");
  const cpuTempEl = document.getElementById("cpuTemp");
  const gpuTempEl = document.getElementById("gpuTemp");
  const cpuLoadEl = document.getElementById("cpuLoad");
  const gpuFreqEl = document.getElementById("gpuFreq");

  const battLevelEl = document.getElementById("batteryLevel");
  const chargeTypeEl = document.getElementById("chargeType");      // Line 1: "Charging" or "Discharging"
  const battTimeEl = document.getElementById("batteryTime");       // Line 2: Time remaining
  const chargingSpeedEl = document.getElementById("chargingSpeed"); // Line 3: Charging speed ONLY (not "Discharging")
  const battTempEl = document.getElementById("batteryTemp");
  const battVoltEl = document.getElementById("batteryVoltage");
  const battPowerEl = document.getElementById("batteryPower");
  const batteryCurrentEl = document.getElementById("batteryCurrent");
  const inputVoltageEl = document.getElementById("inputVoltage");

  const banner = document.querySelector(".banner");
  const canvas = document.getElementById("cpuGraph");
  const ctx = canvas.getContext("2d");

  /* =========================
     CONFIG
  ========================= */
  const CORES = 8;
  const MAX_FREQ = 2500;
  const HISTORY_SIZE = 30;
  const BATTERY_MAH = 5100;

  let history = [];

  /* =========================
     CPU
  ========================= */
  async function cpuFreq(i) {
    const v = await read(`/sys/devices/system/cpu/cpu${i}/cpufreq/scaling_cur_freq`);
    return v ? parseInt(v) / 1000 : 0;
  }

  async function loadCPU() {
    let total = 0;
    let freqs = [];

    for (let i = 0; i < CORES; i++) {
      const f = await cpuFreq(i);
      freqs.push(f);
      total += f;
    }

    cpuGrid.innerHTML = "";
    freqs.forEach(f => {
      const d = document.createElement("div");
      d.textContent = f ? `${f.toFixed(0)} MHz` : "--";
      cpuGrid.appendChild(d);
    });

    const avg = total / CORES;
    cpuLoadEl.textContent = `CPU load: ${Math.min(100, (avg / MAX_FREQ) * 100).toFixed(0)}%`;

    history.push(avg);
    if (history.length > HISTORY_SIZE) history.shift();

    drawGraph();
  }

  /* =========================
     TEMPERATURES
  ========================= */
  async function loadTemps() {
    const cpuT = await read("/sys/class/thermal/thermal_zone0/temp");
    if (cpuT) cpuTempEl.textContent = `CPU: ${(cpuT / 1000).toFixed(1)} °C`;

    const gpuT = await read("/sys/class/thermal/thermal_zone1/temp");
    if (gpuT) gpuTempEl.textContent = `GPU: ${(gpuT / 1000).toFixed(1)} °C`;

    const gpuF = await read("/sys/class/kgsl/kgsl-3d0/gpuclk");
    if (gpuF) gpuFreqEl.textContent = `GPU: ${(gpuF / 1e6).toFixed(0)} MHz`;
  }

  /* =========================
     BATTERY - WITH DISCHARGING COLORS
  ========================= */
  async function loadBattery() {
    const base = "/sys/class/power_supply/battery";
    const usbBase = "/sys/class/power_supply/usb";

    const cap = await read(`${base}/capacity`);
    const stat = await read(`${base}/status`);
    const volt = await read(`${base}/voltage_now`);
    const curr = await read(`${base}/current_now`);
    const temp = await read(`${base}/temp`);
    const inputVolt = await read(`${usbBase}/voltage_now`) || 
                      await read("/sys/class/power_supply/main/voltage_now");

    // Update all values
    if (cap) battLevelEl.textContent = `${cap}%`;
    if (volt) battVoltEl.textContent = `${(volt / 1e6).toFixed(2)} V`;
    if (curr) batteryCurrentEl.textContent = `${Math.abs(curr / 1000).toFixed(0)} mA`;
    if (inputVolt) inputVoltageEl.textContent = `${(inputVolt / 1e6).toFixed(2)} V`;

    // Update battery temperature WITH COLOR CLASS
    if (temp && battTempEl) {
      const tempValue = parseInt(temp) / 10;
      battTempEl.textContent = `${tempValue.toFixed(1)} °C`;
      
      // Add temperature color class
      battTempEl.className = ""; // Reset classes
      if (tempValue < 20) {
        battTempEl.classList.add("cold");
      } else if (tempValue < 35) {
        battTempEl.classList.add("normal");
      } else if (tempValue < 40) {
        battTempEl.classList.add("warm");
      } else if (tempValue < 45) {
        battTempEl.classList.add("hot");
      } else {
        battTempEl.classList.add("very-hot");
      }
    } else if (battTempEl) {
      battTempEl.textContent = "-- °C";
      battTempEl.className = "";
    }

    // Reset
    battPowerEl.textContent = "-- W";
    battTimeEl.textContent = "--";
    chargeTypeEl.textContent = "--";
    chargingSpeedEl.textContent = "--";
    battPowerEl.className = "";
    chargeTypeEl.className = "";
    chargingSpeedEl.className = "";
    banner?.classList.remove("turbo-glow");

    if (!volt || !cap || !stat) return;

    const voltage = volt / 1e6;
    let current = curr ? Math.abs(curr / 1e6) : 0;
    if (current < 0.05) current = 0;

    const watts = voltage * current;
    const level = parseInt(cap);

    /* =========================
       CHARGING
    ========================= */
    if (stat === "Charging" && current > 0) {
      battPowerEl.textContent = `+${watts.toFixed(1)} W`;
      
      // Remove discharge class if it exists
      battPowerEl.classList.remove("discharge");

      // Line 1: Show "Charging"
      chargeTypeEl.textContent = "Charging";

      // Line 2: Show time
      const remain = BATTERY_MAH * (1 - level / 100);
      battTimeEl.textContent = formatTime(Math.round((remain / (current * 1000)) * 60));

      // Line 3: Show charging speed - ALL "Charge" not "Charging"
      if (watts >= 67) {
        chargingSpeedEl.textContent = "67W Turbo Charge";
        chargingSpeedEl.classList.add("turbo");
        battTimeEl.classList.add("mi-turbo");
        banner?.classList.add("turbo-glow");
        document.body.classList.add("turbo-charging");
        
      } else if (watts >= 30) {
        chargingSpeedEl.textContent = "MI Turbo Charge";
        chargingSpeedEl.classList.add("turbo");
        battTimeEl.classList.add("mi-turbo");
        banner?.classList.add("turbo-glow");
        document.body.classList.add("turbo-charging");
        
      } else if (watts >= 27) {
        chargingSpeedEl.textContent = "Quick Charge 3.0";
        chargingSpeedEl.classList.add("turbo");
        battTimeEl.classList.add("quick-charge");
        
      } else if (watts >= 18) {
        chargingSpeedEl.textContent = "Quick Charge";
        chargingSpeedEl.classList.add("turbo");
        battTimeEl.classList.add("quick-charge");
        
      } else if (watts >= 15) {
        chargingSpeedEl.textContent = "Fast Charge";
        chargingSpeedEl.classList.add("charge");
        
      } else if (watts >= 10) {
        chargingSpeedEl.textContent = "Normal Charging";
        chargingSpeedEl.classList.add("charge");
        
      } else {
        chargingSpeedEl.textContent = "Slow Charging";
        chargingSpeedEl.classList.add("charge");
      }
      
      // ALL charging power is GREEN
      battPowerEl.classList.add("charge");
    }

    /* =========================
       DISCHARGING - WITH RED COLOR
    ========================= */
    else if (stat === "Discharging" && current > 0) {
      battPowerEl.textContent = `-${watts.toFixed(1)} W`;
      
      // ADD DISCHARGE CLASS FOR RED COLOR
      battPowerEl.classList.add("discharge");
      
      // Line 1: Show "Discharging"
      chargeTypeEl.textContent = "Discharging";
      chargeTypeEl.classList.add("discharging");
      
      // Line 3: Show "--"
      chargingSpeedEl.textContent = "--";
      chargingSpeedEl.classList.add("discharging");

      const remain = BATTERY_MAH * (level / 100);
      battTimeEl.textContent = formatTime(Math.round((remain / (current * 1000)) * 60));
    }

    /* =========================
       OTHER STATES
    ========================= */
    else {
      battPowerEl.textContent = "0.0 W";
      chargeTypeEl.textContent = stat === "Full" ? "Full" : "Not charging";
      chargingSpeedEl.textContent = "--";
      
      // Remove discharge class
      battPowerEl.classList.remove("discharge");
    }
  }

  /* =========================
     CPU GRAPH
  ========================= */
  function drawGraph() {
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;

    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    // Grid
    ctx.strokeStyle = "rgba(48,209,88,0.12)";
    ctx.lineWidth = 1;
    for (let i = 1; i <= 4; i++) {
      const y = (i / 5) * h;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    // Graph line
    ctx.beginPath();
    history.forEach((v, i) => {
      const x = (i / (HISTORY_SIZE - 1)) * w;
      const y = h - (v / MAX_FREQ) * h;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });

    ctx.strokeStyle = "#30D158";
    ctx.lineWidth = 2.4;
    ctx.shadowBlur = 14;
    ctx.shadowColor = "#30D158";
    ctx.stroke();
  }

  /* =========================
     START
  ========================= */
  loadCPU();
  loadTemps();
  loadBattery();

  setInterval(loadCPU, 1000);
  setInterval(loadTemps, 2000);
  setInterval(loadBattery, 3000);

  console.log("✅ Battery monitor: WITH discharging colors");
});