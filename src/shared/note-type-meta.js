// shared/note-type-meta.js
// Satu sumber kebenaran untuk tampilan (label, warna, icon) per tipe
// catatan. Sebelumnya ada 2 definisi terpisah yang tidak sinkron:
// modules/notes/note-type.js (dipakai daftar Catatan) dan
// shared/type-select.js (dipakai dropdown tipe di form Editor) — 4 dari
// 7 tipe punya warna berbeda antara keduanya. Sesuai Structure.md ("kode
// yang dipakai lebih dari satu modul, pindahkan ke shared/"), definisinya
// disatukan di sini. modules/notes/note-type.js sekarang cuma re-export
// dari file ini (supaya import lama tidak perlu berubah), dan
// shared/type-select.js langsung pakai getNoteTypeMeta() dari sini.
//
// Warna mengikuti palet di 07-UI-Guidelines.md. Tiap tipe punya satu
// warna "identitas" yang dipakai konsisten di semua halaman (Catatan,
// Editor, Home): latar avatar/icon, warna icon, warna teks label.

const ICONS = {
  // Semua icon outline, viewBox 24x24, stroke="currentColor" — warna
  // diatur lewat CSS (color) di elemen pembungkus, bukan lewat atribut
  // di sini, supaya satu definisi bisa dipakai ulang di tempat lain.
  music: `<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>`,
  clipboard: `<rect x="6" y="4" width="12" height="17" rx="2"/><path d="M9 4V3a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v1"/><path d="M9 11h6M9 15h6"/>`,
  bulb: `<path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-4 10.5c.6.6 1 1.4 1 2.5h6c0-1.1.4-1.9 1-2.5A6 6 0 0 0 12 3z"/>`,
  cart: `<circle cx="9" cy="20" r="1"/><circle cx="18" cy="20" r="1"/><path d="M3 4h2l2.4 11.4a2 2 0 0 0 2 1.6h7.2a2 2 0 0 0 2-1.6L21 8H6"/>`,
  file: `<path d="M7 3h7l4 4v14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"/><path d="M14 3v4h4"/>`,
  users: `<circle cx="9" cy="8" r="3"/><path d="M2 20c0-3 3-5 7-5s7 2 7 5"/><circle cx="17" cy="9" r="2.5"/><path d="M22 20c0-2.3-1.7-4-4-4.6"/>`,
  bell: `<path d="M6 10a6 6 0 0 1 12 0c0 4 1.5 5.5 1.5 5.5H4.5S6 14 6 10z"/><path d="M10 19a2 2 0 0 0 4 0"/>`,
};

// key: tipe catatan (huruf kecil, sesuai note.type)
// Catatan: tokens.css tidak punya token "--color-sky-soft" dkk secara
// terpisah — versi "soft" tiap warna aksen sudah ada tapi namanya
// semantik (primary/secondary/warning), bukan per-nama-warna:
//   --color-primary-soft   = mint soft   (--color-primary = mint)
//   --color-secondary-soft = sky soft    (--color-secondary = sky)
//   --color-warning-soft   = coral soft  (--color-warning = coral)
// jadi dipakai apa adanya di bawah, bukan nama baru.
export const NOTE_TYPE_META = {
  catatan: { label: "Catatan", color: "var(--color-secondary, #4fc3f7)", bg: "var(--color-secondary-soft, rgba(79,195,247,0.16))", icon: ICONS.file },
  song: { label: "Song", color: "#8a6d1b" /* versi gelap dari Lemon, supaya kontras cukup untuk teks & icon */, bg: "var(--color-lemon-soft, rgba(255,213,79,0.35))", icon: ICONS.music },
  tugas: { label: "Tugas", color: "var(--color-secondary, #4fc3f7)", bg: "var(--color-secondary-soft, rgba(79,195,247,0.16))", icon: ICONS.clipboard },
  ide: { label: "Ide", color: "var(--color-warning, #ffa65e)", bg: "var(--color-warning-soft, rgba(255,166,94,0.2))", icon: ICONS.bulb },
  belanja: { label: "Belanja", color: "var(--color-primary, #62b43d)", bg: "var(--color-primary-soft, rgba(98,180,61,0.18))", icon: ICONS.cart },
  orang: { label: "Orang", color: "var(--color-secondary, #4fc3f7)", bg: "var(--color-secondary-soft, rgba(79,195,247,0.16))", icon: ICONS.users },
  pengingat: { label: "Pengingat", color: "var(--color-warning, #ffa65e)", bg: "var(--color-warning-soft, rgba(255,166,94,0.2))", icon: ICONS.bell },
};

const DEFAULT_META = {
  label: "Catatan",
  color: "var(--color-text-muted, #6b7780)",
  bg: "var(--color-grey, #eceff1)",
  icon: ICONS.file,
};

/**
 * Mengambil metadata tampilan (label, warna, icon) untuk sebuah tipe.
 * Tipe yang tidak dikenal (mis. "catatan" polos atau tipe baru di masa
 * depan) jatuh ke DEFAULT_META, jadi tidak akan error.
 * Dipakai oleh modules/notes/note-type.js (daftar Catatan) dan
 * shared/type-select.js (dropdown tipe di form Editor) — keduanya harus
 * tetap tampil sama, jadi jangan buat map warna terpisah lagi di tempat
 * lain; tambah di sini kalau ada tipe baru.
 * @param {string} type
 */
export function getNoteTypeMeta(type) {
  return NOTE_TYPE_META[type] || DEFAULT_META;
}
