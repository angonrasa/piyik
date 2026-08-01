// Mengganti ikon bulat di field "Tipe" pada form catatan, mengikuti tipe
// yang sedang dipilih. Murni visual — tidak menyentuh logika filter/toggle
// tipe yang sudah ada di controller lain. Berdiri sendiri (self-init saat
// modul ini di-load), sesuai aturan "shared/ dipakai banyak modul, tidak
// bergantung ke modul lain" — import di bawah aman karena tujuannya juga
// di shared/, bukan ke modules/.
//
// Sebelumnya file ini punya TYPE_ICONS sendiri (warna & path beda dari
// modules/notes/note-type.js), jadi ikon di form Editor beda warna dari
// avatar di daftar Catatan untuk 4 dari 7 tipe. Sekarang pakai
// getNoteTypeMeta() yang sama, satu sumber kebenaran (lihat
// shared/note-type-meta.js).
import { getNoteTypeMeta } from "./note-type-meta.js";

const selectEl = document.getElementById("input-type");
const iconWrapEl = document.getElementById("type-select-icon");

function renderTypeIcon(type) {
  const meta = getNoteTypeMeta(type);
  iconWrapEl.style.background = meta.bg;
  // meta.color berisi var(--...) — ini hanya di-resolve browser kalau masuk
  // lewat CSSOM (style.color), bukan lewat atribut HTML mentah. SVG tetap
  // pakai stroke="currentColor" supaya ikut warna dari style.color di wrapper.
  iconWrapEl.style.color = meta.color;
  iconWrapEl.innerHTML = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${meta.icon}</svg>`;
}

if (selectEl && iconWrapEl) {
  // Sengaja ditunda lewat requestAnimationFrame: mengubah innerHTML persis
  // di event "change" (yang terjadi saat dropdown native masih menutup)
  // bisa bentrok dengan animasi penutupan itu di beberapa WebView Android,
  // sehingga terasa lag/kadang tidak merespon. Menunda satu frame membuat
  // update ikon terjadi setelah dropdown selesai menutup.
  selectEl.addEventListener("change", () => {
    requestAnimationFrame(() => renderTypeIcon(selectEl.value));
  });
  renderTypeIcon(selectEl.value);
}
