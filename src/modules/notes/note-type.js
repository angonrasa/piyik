// modules/notes/note-type.js
// Re-export tipis. Definisi asli (label, warna, icon per tipe) sudah
// dipindah ke shared/note-type-meta.js supaya bisa dipakai bareng
// shared/type-select.js (dropdown tipe di form Editor) tanpa duplikasi
// warna yang gampang tidak sinkron (lihat catatan di file shared-nya).
// File ini tetap ada supaya import yang sudah ada (mis. di
// notes.view.js: `import { getNoteTypeMeta } from "./note-type.js"`)
// tidak perlu diubah satu per satu.
export { getNoteTypeMeta } from "../../shared/note-type-meta.js";
