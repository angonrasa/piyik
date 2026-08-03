// index.js
// Titik masuk aplikasi Piyik Brain

import { checkDatabase } from "./core/db.js";
import { initNotes, goToNewNote } from "./modules/notes/notes.controller.js";
import { initSettings } from "./modules/settings/settings.controller.js";
import { initAbout } from "./modules/about/about.controller.js";
import { initHome } from "./modules/home/home.controller.js";
import { initChat } from "./modules/chat/chat.controller.js";
import { initTelemetry } from "./modules/telemetry/telemetry.js";

initTelemetry();

const statusEl = document.getElementById("status");

async function init() {
  try {
    const isReady = await checkDatabase();

    if (!isReady) {
      statusEl.textContent =
        "Gagal memuat database. Kemungkinan penyebab: tidak ada koneksi " +
        "internet saat halaman ini pertama kali dibuka (Dexie.js dimuat dari " +
        "CDN). Coba sambungkan internet lalu refresh halaman.";
      return;
    }

    initNotes();
    initSettings();
    initAbout();
    initChat();
    initHome();
    // Editor (form catatan baru) adalah tampilan awal aplikasi, bukan Home
    // -- sesuai keputusan di piyik-mind-redesign-mockup.html ("Sekarang
    // app dibuka langsung ke Editor, bukan Beranda"). Dipanggil paling
    // akhir supaya jadi view yang benar-benar tampil (lihat catatan race
    // condition di initHome() & initNotes()).
    goToNewNote();
  } catch (error) {
    // Menangkap error tak terduga apa pun, supaya tidak gagal diam-diam.
    statusEl.textContent = `Terjadi kesalahan: ${error.message}`;
    console.error(error);
  }
}

if ("serviceWorker" in navigator) {
  window.addEventListener("load", async () => {
    try {
      await navigator.serviceWorker.register("./service-worker.js");
      console.log("Service Worker berhasil didaftarkan");
    } catch (err) {
      console.error(err);
    }
  });
}

init();
