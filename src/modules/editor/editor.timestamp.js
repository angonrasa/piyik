// modules/editor/editor.timestamp.js
// Label "Diedit 2 menit lalu" (Phase 1 - C3).
// Waktu berasal dari updatedAt yang sudah ada (tanpa field baru).
// Pemformat waktu di-inject, jadi modul ini tidak bergantung pada modul lain.

// Label diperbarui tiap menit, karena satuan terkecil format waktu adalah menit.
const TICK_MS = 60 * 1000;

/**
 * @param {Object} options
 * @param {HTMLElement} options.outputEl - tampil/sembunyi lewat data-visible
 * @param {(date: Date|number|string) => string} options.format - mis. formatRelativeTime
 * @returns {{ set: (updatedAt: Date|number|string) => void, clear: () => void }}
 */
export function createTimestamp({ outputEl, format }) {
  let current = null; // updatedAt catatan yang sedang dibuka

  // "Baru saja" -> "Diedit baru saja"; "2 menit lalu" -> "Diedit 2 menit lalu".
  function render() {
    const text = current ? format(current) : "";
    if (text) {
      outputEl.textContent = `Diedit ${text.charAt(0).toLowerCase()}${text.slice(1)}`;
    }
    // Saat disembunyikan, teks lama dibiarkan supaya fade-out tidak kosong.
    outputEl.dataset.visible = String(Boolean(text));
  }

  // Tab/app yang sedang di-background tidak perlu menghitung ulang.
  setInterval(() => {
    if (!document.hidden) render();
  }, TICK_MS);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) render();
  });

  render();
  return {
    set(updatedAt) {
      current = updatedAt || null;
      render();
    },
    clear() {
      current = null;
      render();
    },
  };
}
