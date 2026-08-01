// modules/settings/settings.controller.js
// Menghubungkan aksi pengguna (klik tombol, pilih file) dengan repository.

import { exportAllData, importAllData } from "./settings.repository.js";
import { setStatus, setTelemetryToggle } from "./settings.view.js";
import { showView } from "../../shared/view-switcher.js";
import { isTelemetryEnabled, setTelemetryEnabled } from "../telemetry/telemetry.js";

/**
 * Membuat file backup .json dan memicu proses download di browser.
 */
async function handleBackup() {
  try {
    const data = await exportAllData();
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: "application/json" });

    const tanggal = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const filename = `piyik-brain-backup-${tanggal}.json`;

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);

    setStatus(`Backup berhasil dibuat: ${filename}`);
  } catch (error) {
    console.error("Gagal membuat backup:", error);
    setStatus("Gagal membuat backup. Lihat console untuk detail.");
  }
}

/**
 * Membaca file backup yang dipilih pengguna, lalu menimpa seluruh database.
 * @param {Event} event - event 'change' dari input[type=file]
 */
async function handleRestore(event) {
  const file = event.target.files[0];
  event.target.value = ""; // reset input, supaya file yang sama bisa dipilih lagi nanti
  if (!file) return;

  const confirmed = confirm(
    "Restore akan MENGHAPUS semua catatan & relasi yang ada sekarang, " +
      "lalu menggantinya dengan isi file backup ini. Lanjutkan?"
  );
  if (!confirmed) return;

  try {
    const text = await file.text();
    const data = JSON.parse(text);

    if (!Array.isArray(data.notes) || !Array.isArray(data.relations)) {
      setStatus("File backup tidak valid (format tidak dikenali).");
      return;
    }

    await importAllData(data);
    setStatus("Restore berhasil. Memuat ulang halaman...");
    setTimeout(() => location.reload(), 1000);
  } catch (error) {
    console.error("Gagal restore:", error);
    setStatus("Gagal restore. Pastikan file backup valid dan tidak rusak.");
  }
}

/**
 * Menyimpan pilihan user saat toggle "Kirim data pemakaian anonim" ditekan.
 * @param {Event} event - event 'change' dari input[type=checkbox]
 */
function handleTelemetryToggle(event) {
  const enabled = event.target.checked;
  setTelemetryEnabled(enabled);
  setStatus(
    enabled
      ? "Pengiriman data pemakaian anonim diaktifkan."
      : "Pengiriman data pemakaian anonim dimatikan."
  );
}

/**
 * Inisialisasi modul Settings: pasang event listener untuk backup & restore.
 */
export function initSettings() {
  document.getElementById("btn-backup").addEventListener("click", handleBackup);
  document.getElementById("input-restore").addEventListener("change", handleRestore);
  document.getElementById("nav-settings").addEventListener("click", () => showView("settings"));

  setTelemetryToggle(isTelemetryEnabled());
  document.getElementById("toggle-telemetry").addEventListener("change", handleTelemetryToggle);

  // Row "Tentang Piyik Brain": buka halaman About.
  document.getElementById("btn-about").addEventListener("click", () => showView("about"));

  // Tombol kembali di header Pengaturan: pakai jalur navigasi yang sama
  // seperti menekan tab "Beranda" di bottom nav, supaya tidak perlu tahu
  // detail internal modul Home.
  document.getElementById("btn-settings-back").addEventListener("click", () => {
    document.getElementById("nav-home").click();
  });
}
