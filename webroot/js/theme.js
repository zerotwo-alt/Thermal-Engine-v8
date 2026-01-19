const KEY = "dark_mode";
const toggle = document.getElementById("darkToggle");

function applyDark(on) {
  document.body.classList.toggle("dark", on);
  localStorage.setItem(KEY, on ? "1" : "0");
  toggle.checked = on;
}

applyDark(localStorage.getItem(KEY) === "1");

toggle.addEventListener("change", e => {
  applyDark(e.target.checked);
});