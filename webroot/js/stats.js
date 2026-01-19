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
  const cpuGrid      = document.getElementById("cpuGrid");
  const cpuTempEl    = document.getElementById("cpuTemp");
  const gpuTempEl    = document.getElementById("gpuTemp");
  const cpuLoadEl    = document.getElementById("cpuLoad");
  const gpuFreqEl    = document.getElementById("gpuFreq");

  const battLevelEl  = document.getElementById("batteryLevel");
  const battStatusEl = document.getElementById("batteryStatus");
  const battVoltEl   = document.getElementById("batteryVoltage");
  const battPowerEl  = document.getElementById("batteryPower");
  const battTimeEl   = document.getElementById("batteryTime");
  const battTempEl   = document.getElementById("batteryTemp");
  const chargeTypeEl = document.getElementById("chargeType");

  const banner = document.querySelector(".banner");

  const canvas = document.getElementById("cpuGraph");
  const ctx = canvas.getContext("2d");

  /* =========================
     CONFIG
  ========================= */
  const CORES = 8;
  const MAX_FREQ = 2500;
  const HISTORY_SIZE = 30;
  const BATTERY_MAH = 5000;

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
    cpuLoadEl.textContent =
      `CPU load: ${Math.min(100, (avg / MAX_FREQ) * 100).toFixed(0)}%`;

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
     BATTERY (SAFE + HONEST)
  ========================= */
  async function loadBattery() {
    const base = "/sys/class/power_supply/battery";

    const cap  = await read(`${base}/capacity`);
    const stat = await read(`${base}/status`);
    const volt = await read(`${base}/voltage_now`);
    const curr = await read(`${base}/current_now`);
    const temp = await read(`${base}/temp`);

    if (cap)  battLevelEl.textContent = `${cap}%`;
    if (stat) battStatusEl.textContent = stat;
    if (volt) battVoltEl.textContent = `${(volt / 1e6).toFixed(2)} V`;
    if (temp) battTempEl.textContent = `${(temp / 10).toFixed(1)} °C`;

    /* reset */
    battPowerEl.textContent = "-- W";
    battTimeEl.textContent = "--";
    chargeTypeEl.textContent = "--";
    battPowerEl.className = "";
    banner?.classList.remove("turbo-glow");

    if (!volt || !cap || !stat) return;

    const voltage = volt / 1e6;
    let current = curr ? Math.abs(curr / 1e6) : 0;

    /* prevent zero / fake spikes */
    if (current < 0.05) current = 0;

    const watts = voltage * current;
    const level = parseInt(cap);

    /* =========================
       CHARGING
    ========================= */
    if (stat === "Charging" && current > 0) {
      battPowerEl.textContent = `+${watts.toFixed(1)} W`;

      let type = "Charging";
      let cls = "charge";

      if (watts >= 60) {
        type = "67W Turbo charging";
        cls = "turbo";
        banner?.classList.add("turbo-glow");
      } else if (watts >= 30) {
        type = "Turbo charging";
        cls = "turbo";
      } else if (watts >= 18) type = "Fast charging";

      battPowerEl.classList.add(cls);
      chargeTypeEl.textContent = type;

      const remain = BATTERY_MAH * (1 - level / 100);
      battTimeEl.textContent =
        formatTime(Math.round((remain / (current * 1000)) * 60));
    }

    /* =========================
       DISCHARGING
    ========================= */
    else if (stat === "Discharging" && current > 0) {
      battPowerEl.textContent = `−${watts.toFixed(1)} W`;
      battPowerEl.classList.add("discharge");

      const remain = BATTERY_MAH * (level / 100);
      battTimeEl.textContent =
        formatTime(Math.round((remain / (current * 1000)) * 60));
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

    /* grid */
    ctx.strokeStyle = "rgba(48,209,88,0.12)";
    ctx.lineWidth = 1;
    for (let i = 1; i <= 4; i++) {
      const y = (i / 5) * h;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

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

  console.log("✅ stats.js FINAL — safe, honest, stable");
});