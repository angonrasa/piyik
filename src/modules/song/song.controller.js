// modules/song/song.controller.js
// Menghubungkan data songDetails (repository) dengan tampilannya (view).
// Dipanggil dari modules/notes/notes.controller.js pada titik-titik yang sama
// seperti todos (buka detail, buka form edit, simpan form, hapus note).

import { getSongDetails, saveSongDetails, deleteSongDetailsForNote } from "./song.repository.js";
import {
  initSongLineEditor,
  initSongDetailControls,
  setChordFontSize,
  setTransposeLabel,
  updateSongLyrics,
  setSongFieldsVisible,
  setSongContentNoteMode,
  resetSongFields,
  fillSongFields,
  readSongFields,
  setSongDetailVisible,
  setSongDetailHeader,
  clearSongDetailHeader,
  fillSongDetail,
  setAutoScrollPlaying,
  setAutoScrollSpeedLabel,
  scrollPageBy,
  isSongLyricsScrollEnd,
  isSongDetailViewVisible,
} from "./song.view.js";
import { transposeChordLine, isChordLine } from "../../shared/chord-list.js";

// Ukuran font chord dan pergeseran transpose di layar Detail. Sengaja
// disimpan di memori (bukan DB/repository) dan di-reset tiap kali sebuah
// lagu dibuka (lihat showSongFor) — sesuai keputusan: kedua kontrol ini
// sementara saja, bukan preferensi permanen per lagu.
const DEFAULT_CHORD_FONT_SIZE = 14;
const MIN_CHORD_FONT_SIZE = 10;
const MAX_CHORD_FONT_SIZE = 24;
const CHORD_FONT_STEP = 2;
let chordFontSize = DEFAULT_CHORD_FONT_SIZE;

// originalLyrics menyimpan lirik+chord ASLI (belum ditranspose, plain
// text apa adanya dari data tersimpan) dari lagu yang sedang dibuka.
// Transpose selalu dihitung ulang dari sini (bukan menumpuk dari hasil
// transpose sebelumnya), supaya tidak ada error yang menumpuk kalau user
// klik +/- bolak-balik banyak kali.
let originalLyrics = "";
let transposeSteps = 0;

// State Auto Scroll (Tahap B1): sedang jalan atau tidak, level kecepatan
// (0-5, 0 = paling lambat), dan id requestAnimationFrame yang sedang
// berjalan (untuk bisa dibatalkan). Sama seperti kontrol lain, sengaja
// sementara & di-reset tiap buka lagu (lihat showSongFor), bukan
// preferensi permanen.
// Catatan (revisi): level 0 sempat menghasilkan 0px/detik (autoScrollSpeed * px
// = 0), jadi terlihat seperti "tidak bisa di-play" padahal cuma diam di
// tempat. MIN_AUTOSCROLL_SPEED dikembalikan ke 1 supaya level terendah tetap
// bergerak. Kecepatan per level juga diturunkan (5px/detik/level,
// sebelumnya 9) karena lompatan dari 0 ke level berikutnya terasa terlalu
// cepat.
const DEFAULT_AUTOSCROLL_SPEED = 1;
const MIN_AUTOSCROLL_SPEED = 1;
const MAX_AUTOSCROLL_SPEED = 5;
const AUTOSCROLL_PX_PER_SEC_PER_LEVEL = 5; // level 1 = 5px/detik (pelan)

let autoScrollSpeed = DEFAULT_AUTOSCROLL_SPEED;
let autoScrollPlaying = false;
let autoScrollRafId = null;
let autoScrollLastTimestamp = null;
// Menyimpan sisa jarak scroll pecahan (px) antar frame. Perlu karena
// `scrollTop` di browser membulatkan nilai yang di-assign ke integer —
// kalau jarak per frame dikirim langsung (mis. 0.08px di level pelan),
// tiap frame akan selalu dibulatkan jadi 0 dan scroll terlihat diam.
// Dengan akumulasi di sini, pecahan ditahan dulu dan baru dikirim ke
// scrollPageBy() begitu totalnya sudah mencapai minimal 1px utuh.
let autoScrollPxRemainder = 0;

/**
 * Inisialisasi modul Song: pasang event listener editor baris chord+lirik.
 * Dipanggil sekali saat aplikasi start, sama seperti initRelations/initTodos.
 */
export function initSong() {
  initSongLineEditor();
  initSongDetailControls({
    onFontDec: handleFontDec,
    onFontInc: handleFontInc,
    onTransposeDown: () => handleTranspose(-1),
    onTransposeUp: () => handleTranspose(1),
    onAutoScrollToggle: handleAutoScrollToggle,
    onAutoScrollSpeedDec: () => handleAutoScrollSpeedChange(-1),
    onAutoScrollSpeedInc: () => handleAutoScrollSpeedChange(1),
  });
}

function handleFontDec() {
  chordFontSize = Math.max(MIN_CHORD_FONT_SIZE, chordFontSize - CHORD_FONT_STEP);
  setChordFontSize(chordFontSize);
}

function handleFontInc() {
  chordFontSize = Math.min(MAX_CHORD_FONT_SIZE, chordFontSize + CHORD_FONT_STEP);
  setChordFontSize(chordFontSize);
}

/**
 * Menggeser semua baris chord dalam sebuah teks lirik+chord sejumlah
 * semitone. Baris ditentukan chord atau bukan lewat isChordLine (sama
 * seperti saat render read mode) — baris lirik biasa dibiarkan apa
 * adanya, tidak ikut ditranspose.
 * @param {string} lyrics
 * @param {number} steps
 * @returns {string}
 */
function transposeLyrics(lyrics, steps) {
  if (!lyrics || steps === 0) return lyrics;
  return lyrics
    .split("\n")
    .map((line) => (isChordLine(line) ? transposeChordLine(line, steps) : line))
    .join("\n");
}

function handleTranspose(delta) {
  transposeSteps += delta;
  setTransposeLabel(transposeSteps);
  updateSongLyrics(transposeLyrics(originalLyrics, transposeSteps));
}

function handleAutoScrollToggle() {
  if (autoScrollPlaying) {
    stopAutoScroll();
  } else {
    startAutoScroll();
  }
}

function handleAutoScrollSpeedChange(delta) {
  autoScrollSpeed = Math.min(MAX_AUTOSCROLL_SPEED, Math.max(MIN_AUTOSCROLL_SPEED, autoScrollSpeed + delta));
  setAutoScrollSpeedLabel(autoScrollSpeed);
}

function startAutoScroll() {
  if (autoScrollPlaying) return;
  autoScrollPlaying = true;
  setAutoScrollPlaying(true);
  autoScrollLastTimestamp = null;
  autoScrollPxRemainder = 0;
  autoScrollRafId = requestAnimationFrame(autoScrollTick);
}

function stopAutoScroll() {
  autoScrollPlaying = false;
  setAutoScrollPlaying(false);
  if (autoScrollRafId !== null) {
    cancelAnimationFrame(autoScrollRafId);
    autoScrollRafId = null;
  }
  autoScrollLastTimestamp = null;
  autoScrollPxRemainder = 0;
}

/**
 * Loop requestAnimationFrame untuk Auto Scroll: menghitung jarak scroll
 * per frame dari selisih waktu (bukan jumlah tetap per frame), supaya
 * kecepatannya konsisten walau frame rate perangkat berbeda-beda.
 * Berhenti otomatis kalau: layar Detail sudah tidak terlihat lagi (user
 * pindah layar), atau bagian bawah kartu lirik sudah sampai di layar
 * (baris terakhir sudah terlihat).
 * @param {number} timestamp
 */
function autoScrollTick(timestamp) {
  if (!isSongDetailViewVisible()) {
    stopAutoScroll();
    return;
  }
  if (isSongLyricsScrollEnd()) {
    stopAutoScroll();
    return;
  }

  if (autoScrollLastTimestamp !== null) {
    const deltaSeconds = (timestamp - autoScrollLastTimestamp) / 1000;
    const pxPerSecond = autoScrollSpeed * AUTOSCROLL_PX_PER_SEC_PER_LEVEL;
    autoScrollPxRemainder += pxPerSecond * deltaSeconds;

    // Hanya kirim bagian bulatnya; sisa pecahan disimpan untuk frame
    // berikutnya. Ini yang membuat level pelan tetap terlihat bergerak
    // (walau cuma 1px tiap beberapa frame) alih-alih dibulatkan jadi 0.
    const wholePx = Math.trunc(autoScrollPxRemainder);
    if (wholePx !== 0) {
      scrollPageBy(wholePx);
      autoScrollPxRemainder -= wholePx;
    }
  }
  autoScrollLastTimestamp = timestamp;
  autoScrollRafId = requestAnimationFrame(autoScrollTick);
}

/**
 * Dipanggil oleh modules/notes saat detail sebuah catatan dibuka.
 * Blok detail song hanya ditampilkan kalau tipe note-nya "song".
 * @param {{id: number, type: string}} note
 */
export async function showSongFor(note) {
  const isSong = note.type === "song";
  stopAutoScroll();
  autoScrollSpeed = DEFAULT_AUTOSCROLL_SPEED;
  setAutoScrollSpeedLabel(autoScrollSpeed);
  setSongDetailVisible(isSong);
  if (isSong) {
    const details = await getSongDetails(note.id);
    fillSongDetail(details);
    setSongDetailHeader(details);
    originalLyrics = details?.lyrics ?? "";
    chordFontSize = DEFAULT_CHORD_FONT_SIZE;
    setChordFontSize(chordFontSize);
    transposeSteps = 0;
    setTransposeLabel(0);
  } else {
    clearSongDetailHeader();
  }
}

/**
 * Menampilkan/menyembunyikan blok field song di form, dipanggil saat
 * dropdown tipe berubah, dan saat form dibuka (baru/edit).
 * @param {string} type
 */
export function toggleSongFormFields(type) {
  setSongFieldsVisible(type === "song");
  setSongContentNoteMode(type === "song");
}

/**
 * Mengosongkan field-field song di form (dipanggil saat form note baru dibuka).
 */
export function resetSongForm() {
  resetSongFields();
}

/**
 * Mengisi field-field song di form dengan data tersimpan (dipanggil saat
 * form edit dibuka untuk note bertipe "song").
 * @param {number} noteId
 */
export async function loadSongFormForEdit(noteId) {
  const details = await getSongDetails(noteId);
  fillSongFields(details);
}

/**
 * Menyimpan (atau membersihkan) data song untuk sebuah note, dipanggil
 * setelah note-nya sendiri disimpan.
 * - Kalau tipe note "song": baca field form, simpan ke songDetails.
 * - Kalau bukan "song" (misal tipe diubah saat edit): hapus data song lama,
 *   supaya tidak ada data "yatim" — sama seperti todoItems.
 * @param {number} noteId
 * @param {string} type
 */
export async function saveSongForNote(noteId, type) {
  if (type === "song") {
    const data = readSongFields();
    await saveSongDetails(noteId, data);
  } else {
    await deleteSongDetailsForNote(noteId);
  }
}

/**
 * Menghapus data song milik sebuah note.
 * Dipakai modul notes saat sebuah catatan dihapus.
 */
export { deleteSongDetailsForNote };
