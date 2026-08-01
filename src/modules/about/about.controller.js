// modules/about/about.controller.js
// Modul About: halaman statis (tidak ada data dinamis), jadi tidak perlu
// about.repository.js maupun about.view.js — cukup controller untuk navigasi.

import { showView } from "../../shared/view-switcher.js";

/**
 * Inisialisasi modul About: pasang tombol kembali ke Settings.
 */
export function initAbout() {
  // Kembali ke Settings, dengan jalur yang sama seperti menekan tab
  // "Pengaturan" di bottom nav (konsisten dengan pola btn-settings-back
  // di settings.controller.js).
  document.getElementById("btn-about-back").addEventListener("click", () => {
    showView("settings");
  });
}
