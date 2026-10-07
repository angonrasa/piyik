// Probe sementara untuk E2: mencatat event apa saja yang dikirim keyboard HP.
// Saat CTRL menyala, beforeinput dicoba dibatalkan (preventDefault) dan hasilnya
// dicatat: apakah event bisa dibatalkan, dan apakah teks tetap berubah.
const t = document.getElementById("t");
const ctrlBtn = document.getElementById("ctrl");
const logEl = document.getElementById("log");
const lines = [];
let armed = false;
let before = "";

function log(msg) {
  lines.push(msg);
  if (lines.length > 60) lines.shift();
  logEl.textContent = lines.join("\n");
}

ctrlBtn.addEventListener("mousedown", (e) => e.preventDefault()); // jangan rebut fokus
ctrlBtn.addEventListener("click", () => {
  armed = !armed;
  ctrlBtn.textContent = "CTRL: " + (armed ? "NYALA" : "mati");
  ctrlBtn.classList.toggle("on", armed);
  log("-- CTRL " + (armed ? "nyala" : "mati"));
});
document.getElementById("clear").addEventListener("click", () => { lines.length = 0; logEl.textContent = ""; });
document.getElementById("copy").addEventListener("click", () => {
  navigator.clipboard.writeText(lines.join("\n")).then(() => log("-- log disalin"), (e) => log("-- salin gagal: " + e));
});

t.addEventListener("keydown", (e) => {
  log("keydown key=" + JSON.stringify(e.key) + " code=" + e.code + " keyCode=" + e.keyCode + " shift=" + e.shiftKey + " ctrl=" + e.ctrlKey + " comp=" + e.isComposing);
});
t.addEventListener("beforeinput", (e) => {
  before = t.value;
  let cancelled = "";
  if (armed && e.cancelable) { e.preventDefault(); cancelled = " [dibatalkan]"; }
  log("beforeinput type=" + e.inputType + " data=" + JSON.stringify(e.data) + " cancelable=" + e.cancelable + " comp=" + e.isComposing + cancelled);
});
t.addEventListener("input", (e) => {
  log("input type=" + e.inputType + " data=" + JSON.stringify(e.data) + " teksBerubah=" + (t.value !== before));
});
["compositionstart", "compositionupdate", "compositionend"].forEach((name) => {
  t.addEventListener(name, (e) => log(name + " data=" + JSON.stringify(e.data)));
});
