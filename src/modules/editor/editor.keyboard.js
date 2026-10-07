// modules/editor/editor.keyboard.js
// Mendeteksi keyboard virtual lewat visualViewport (Phase 3 - E1).
// Menulis dua hal di <html>:
//   --keyboard-offset : jarak dasar layar ke atas keyboard (dipakai bar format)
//   data-keyboard     : "open" | "closed"
// Rumus offset benar di dua mode: keyboard menimpa layar (Chrome) dan
// layar ikut mengecil (Capacitor adjustResize, nanti saat migrasi).

// Layar dianggap "tertutup keyboard" kalau tingginya berkurang > 150px.
const KEYBOARD_MIN_HEIGHT = 150;

/**
 * @param {() => void} onChange - dipanggil tiap status keyboard berubah
 * @returns {{ isOpen: () => boolean }}
 */
export function watchKeyboard(onChange) {
  const vv = window.visualViewport;
  const root = document.documentElement;
  const hasTouchScreen = !window.matchMedia("(pointer: fine)").matches;

  // Tanpa visualViewport atau tanpa layar sentuh (desktop): tidak ada
  // keyboard virtual. Dianggap "terbuka" supaya bar tetap bisa diuji.
  if (!vv || !hasTouchScreen) {
    root.dataset.keyboard = "open";
    root.style.setProperty("--keyboard-offset", "0px");
    return { isOpen: () => true };
  }

  let baseHeight = vv.height; // tinggi layar saat keyboard tertutup
  let lastWidth = window.innerWidth;
  let open = false;

  function update() {
    // Layar diputar: tinggi normal berubah, hitung ulang.
    if (window.innerWidth !== lastWidth) {
      lastWidth = window.innerWidth;
      baseHeight = vv.height;
    }
    // Saat pinch-zoom tinggi viewport ikut berubah; abaikan.
    if (vv.scale === 1 && vv.height > baseHeight) baseHeight = vv.height;

    const offset = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
    const nowOpen = vv.scale === 1 && baseHeight - vv.height > KEYBOARD_MIN_HEIGHT;

    root.style.setProperty("--keyboard-offset", Math.round(offset) + "px");
    root.dataset.keyboard = nowOpen ? "open" : "closed";

    if (nowOpen !== open) {
      open = nowOpen;
      onChange();
    }
  }

  vv.addEventListener("resize", update);
  vv.addEventListener("scroll", update);
  window.addEventListener("orientationchange", () => setTimeout(update, 300));

  root.dataset.keyboard = "closed";
  update();

  return { isOpen: () => open };
}
