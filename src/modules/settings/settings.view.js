// modules/settings/settings.view.js
// Semua sentuhan langsung ke DOM untuk modul Settings.

const statusEl = document.getElementById("settings-status");
const telemetryToggleEl = document.getElementById("toggle-telemetry");

/**
 * Menampilkan pesan status singkat di bagian Pengaturan.
 * @param {string} message
 */
export function setStatus(message) {
  statusEl.textContent = message;
}

/**
 * Mengatur posisi awal toggle "Kirim data pemakaian anonim" saat
 * halaman Pengaturan dibuka, sesuai status tersimpan.
 * @param {boolean} enabled
 */
export function setTelemetryToggle(enabled) {
  telemetryToggleEl.checked = enabled;
}
