// core/splash.view.js
//
// Kontrol tampil/sembunyi splash screen. Murni visual — tidak menunggu
// proses apa pun (Dexie, dst), cuma jeda sesaat lalu fade-out ke Beranda.
// Markup elemen splash-nya sendiri statis di index.html (lihat #splash-screen),
// BUKAN dibuat lewat innerHTML di sini — sesuai aturan "Jangan menulis HTML
// di dalam JavaScript" pada 03-Structure.md.

// Lama splash tampil sebelum mulai fade-out. Nilai ini disamakan dengan
// total durasi animasi "menggambar" di piyik-logo-animated.svg + teks:
//   100ms  titik muncul
// +  700ms bentuk utama digambar
// +  300ms lengkung kedua digambar
// +  150ms outline hilang, isi solid muncul
// +  600ms lingkaran luar digambar (searah jarum jam)
// = 1850ms logo selesai, lalu:
// +  350ms teks "Piyik Mind" fade in (lihat splash-title di splash.css)
// +  600ms diam
// = 2800ms — kalau timing di SVG/CSS diubah, sesuaikan juga angka ini.
const SPLASH_DURATION_MS = 2800;
const FADE_OUT_MS = 300; // durasi transisi fade-out — harus sama dengan styles/splash.css

/**
 * Jalankan splash screen, lalu panggil onDone() setelah selesai.
 * Dipanggil sekali di awal (index.js), sebelum render Beranda.
 * @param {() => void} [onDone]
 */
export function initSplash(onDone) {
  const splash = document.getElementById('splash-screen');

  // Jaga-jaga: kalau elemen splash tidak ada di index.html (mis. lupa
  // ditambahkan), jangan sampai app macet — langsung lanjut saja.
  if (!splash) {
    onDone?.();
    return;
  }

  setTimeout(() => {
    splash.classList.add('splash-hide');

    setTimeout(() => {
      splash.remove();
      onDone?.();
    }, FADE_OUT_MS);
  }, SPLASH_DURATION_MS);
}
