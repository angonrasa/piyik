// modules/song/song.view.js
// Manipulasi DOM untuk field-field khusus note tipe "song" (form & detail).

import { isChordLine } from "../../shared/chord-list.js";

// Baris tanpa chord yang berformat "[Verse]" / "[Chorus]" dst dianggap
// label section dan ditampilkan tebal (bukan bagian dari deteksi chord).
const LABEL_LINE_PATTERN = /^\[.+\]$/;

const songFieldsEl = document.getElementById("song-fields");
const lyricsInputEl = document.getElementById("song-lyrics-input");
const lyricsCounterEl = document.getElementById("song-lyrics-counter");
const editorGutterEl = document.getElementById("song-editor-gutter");
const btnSongExampleEl = document.getElementById("btn-song-example");
const btnSongDetailToggleEl = document.getElementById("btn-song-detail-toggle");
const songDetailFieldsEl = document.getElementById("song-detail-fields");

// Contoh chord+lirik yang dimasukkan lewat tombol "Contoh" di header editor.
const EXAMPLE_LYRICS =
  "Gm                              A\n" +
  "Seluruh raga lenyap ditelan fana\n" +
  "\n" +
  "Dm                    Bb\n" +
  "Segalanya luruh tak bersisa\n" +
  "\n" +
  "Gm                              A\n" +
  "Tunduk sujud...dalam kuasa-Nya";

// Field yang dipakai bersama semua tipe catatan (bukan khusus song), tapi
// tampilannya disesuaikan sedikit untuk tipe "song" mengikuti mockup:
// placeholder judul & mode counter pada field "Catatan (opsional)".
const titleInputEl = document.getElementById("input-title");
const contentInputEl = document.getElementById("input-content");
const contentCounterEl = document.getElementById("input-content-counter");
const TITLE_SONG_PLACEHOLDER = "Masukkan judul lagu...";
const CONTENT_NOTE_SONG_PLACEHOLDER = "Catatan bebas seputar lagu ini...";
const CONTENT_NOTE_MAXLENGTH = 300;

const inputTempo = document.getElementById("input-song-tempo");
const inputKey = document.getElementById("input-song-key");
const inputGenre = document.getElementById("input-song-genre");
const inputStatus = document.getElementById("input-song-status");

const songSectionEl = document.getElementById("song-section");
const detailLinesEl = document.getElementById("song-detail-lines");
const btnChordFontDecEl = document.getElementById("btn-chord-font-dec");
const btnChordFontIncEl = document.getElementById("btn-chord-font-inc");
const btnTransposeDownEl = document.getElementById("btn-transpose-down");
const btnTransposeUpEl = document.getElementById("btn-transpose-up");
const transposeLabelEl = document.getElementById("song-transpose-label");
const btnAutoScrollToggleEl = document.getElementById("btn-autoscroll-toggle");
const autoScrollPlayLabelEl = document.getElementById("song-autoscroll-play-label");
const btnAutoScrollSpeedDecEl = document.getElementById("btn-autoscroll-speed-dec");
const btnAutoScrollSpeedIncEl = document.getElementById("btn-autoscroll-speed-inc");
const autoScrollSpeedLabelEl = document.getElementById("song-autoscroll-speed-label");
const viewDetailEl = document.getElementById("view-detail");
const detailTempoEl = document.getElementById("song-detail-tempo");
const detailKeyEl = document.getElementById("song-detail-key");
const detailGenreEl = document.getElementById("song-detail-genre");
const detailStatusEl = document.getElementById("song-detail-status");

// Area catatan bebas di layar Detail (dipakai semua tipe catatan). Untuk
// tipe "song", elemen ini dipindah (bukan disalin) ke bawah "Detail Lagu"
// di dalam #song-section — lihat setSongDetailVisible. `detailContentHomeEl`
// menyimpan elemen tetangganya di posisi asli (sebelum hr pertama) supaya
// bisa dikembalikan ke tempat semula untuk tipe selain song.
const detailContentEl = document.getElementById("detail-content");
const detailContentHomeAnchorEl = detailContentEl ? detailContentEl.nextElementSibling : null;

// Elemen generik di header Detail (dipakai semua tipe catatan) — hanya
// diisi/disembunyikan di sini untuk tipe "song", lihat setSongDetailHeader.
const detailSubtitleEl = document.getElementById("detail-subtitle");
const detailTypePillEl = document.getElementById("detail-type");

/**
 * Memperbarui counter karakter kecil di pojok textarea (mis. "156 karakter"),
 * dipanggil tiap kali isi textarea berubah. Elemen counter opsional — kalau
 * tidak ada di markup, fungsi ini tidak melakukan apa-apa (supaya fitur ini
 * boleh di-skip tanpa merusak apa pun, sesuai catatan di desain).
 */
function updateLyricsCounter() {
  if (!lyricsCounterEl) return;
  lyricsCounterEl.textContent = `${lyricsInputEl.value.length} karakter`;
}

/**
 * Menyamakan jumlah nomor baris di gutter dengan jumlah baris textarea
 * (dihitung dari jumlah "\n" + 1). Elemen gutter cukup ditambah/dikurangi
 * <span> di ujung, bukan render ulang semua — sederhana dan cukup untuk
 * ukuran lirik lagu (puluhan baris).
 */
function updateEditorGutter() {
  if (!editorGutterEl) return;
  const lineCount = lyricsInputEl.value.split("\n").length;
  const current = editorGutterEl.children.length;

  if (current < lineCount) {
    for (let i = current + 1; i <= lineCount; i++) {
      const lineEl = document.createElement("span");
      lineEl.textContent = String(i);
      editorGutterEl.appendChild(lineEl);
    }
  } else if (current > lineCount) {
    for (let i = current; i > lineCount; i--) {
      editorGutterEl.lastElementChild.remove();
    }
  }
}

/**
 * Menyamakan posisi scroll gutter dengan textarea, dipanggil tiap textarea
 * di-scroll supaya nomor baris tetap sejajar dengan barisnya.
 */
function syncEditorGutterScroll() {
  if (!editorGutterEl) return;
  editorGutterEl.scrollTop = lyricsInputEl.scrollTop;
}

/**
 * Menutup accordion "Detail Lagu (opsional)" — dipanggil tiap form dibuka
 * (baru/edit) supaya defaultnya selalu tertutup, sesuai mockup.
 */
function closeSongDetailFields() {
  if (!songDetailFieldsEl || !btnSongDetailToggleEl) return;
  songDetailFieldsEl.hidden = true;
  btnSongDetailToggleEl.setAttribute("aria-expanded", "false");
  btnSongDetailToggleEl.classList.remove("is-open");
}

/**
 * Memperbarui angka counter pada field "Catatan (opsional)" (mis. "12/300"),
 * hanya berarti selama mode song aktif (lihat setSongContentNoteMode).
 */
function updateContentCounter() {
  if (!contentCounterEl) return;
  contentCounterEl.textContent = `${contentInputEl.value.length}/${CONTENT_NOTE_MAXLENGTH}`;
}

/**
 * Inisialisasi editor lirik+chord: textarea polos, satu-satunya input untuk
 * isi lagu (chord ditulis manual di baris sendiri di atas lirik, dipisah
 * spasi). Dipanggil sekali saat aplikasi start, sama seperti sebelumnya.
 */
export function initSongLineEditor() {
  lyricsInputEl.addEventListener("input", () => {
    updateLyricsCounter();
    updateEditorGutter();
  });
  lyricsInputEl.addEventListener("scroll", syncEditorGutterScroll);
  contentInputEl.addEventListener("input", updateContentCounter);

  if (btnSongExampleEl) {
    btnSongExampleEl.addEventListener("click", () => {
      if (lyricsInputEl.value.trim() && !confirm("Isi editor akan ditimpa dengan contoh. Lanjutkan?")) {
        return;
      }
      lyricsInputEl.value = EXAMPLE_LYRICS;
      updateLyricsCounter();
      updateEditorGutter();
      lyricsInputEl.focus();
    });
  }

  if (btnSongDetailToggleEl) {
    btnSongDetailToggleEl.addEventListener("click", () => {
      const isOpen = !songDetailFieldsEl.hidden;
      songDetailFieldsEl.hidden = isOpen;
      btnSongDetailToggleEl.setAttribute("aria-expanded", String(!isOpen));
      btnSongDetailToggleEl.classList.toggle("is-open", !isOpen);
    });
  }
}

/**
 * Menampilkan/menyembunyikan blok field song di form, tergantung tipe
 * yang sedang dipilih. Dipanggil tiap kali dropdown tipe berubah, dan saat
 * form dibuka (baru/edit).
 * @param {boolean} visible
 */
export function setSongFieldsVisible(visible) {
  songFieldsEl.hidden = !visible;
}

/**
 * Menyesuaikan placeholder Judul dan mode field "Catatan (opsional)" —
 * kedua field ini dipakai bersama semua tipe catatan, jadi hanya diberi
 * teks/batas khusus lagu selama tipe "song" yang aktif. Dipanggil dari
 * tempat yang sama dengan setSongFieldsVisible (lihat toggleSongFormFields
 * di song.controller.js).
 * @param {boolean} active
 */
export function setSongContentNoteMode(active) {
  titleInputEl.placeholder = active ? TITLE_SONG_PLACEHOLDER : "";

  if (active) {
    contentInputEl.maxLength = CONTENT_NOTE_MAXLENGTH;
    contentInputEl.placeholder = CONTENT_NOTE_SONG_PLACEHOLDER;
  } else {
    contentInputEl.removeAttribute("maxlength");
    // Placeholder untuk tipe non-song adalah tanggung jawab
    // updateContentMode() di notes.view.js (per tipe: catatan/ide/belanja/
    // orang/pengingat/tugas). Jangan ditimpa jadi "" di sini — dulu baris
    // ini yang bikin placeholder tipe lain selalu hilang, karena
    // toggleSongFormFields() dipanggil setelah updateContentMode() di
    // notes.controller.js.
  }
  contentCounterEl.hidden = !active;
  updateContentCounter();
}

/**
 * Mengosongkan field-field song, dipanggil saat form direset (note baru).
 */
export function resetSongFields() {
  lyricsInputEl.value = "";
  inputTempo.value = "";
  inputKey.value = "";
  inputGenre.value = "";
  inputStatus.value = "draft";
  updateLyricsCounter();
  updateEditorGutter();
  closeSongDetailFields();
}

/**
 * Mengisi field-field song dengan data yang sudah tersimpan (mode edit).
 * @param {Object} [details] - record songDetails, kosongkan untuk note song
 *   yang belum pernah punya detail tersimpan.
 */
export function fillSongFields(details) {
  lyricsInputEl.value = details?.lyrics ?? "";
  inputTempo.value = details?.tempo ?? "";
  inputKey.value = details?.key ?? "";
  inputGenre.value = details?.genre ?? "";
  inputStatus.value = details?.status ?? "draft";
  updateLyricsCounter();
  updateEditorGutter();
  closeSongDetailFields();
}

/**
 * Membaca nilai field-field song saat ini menjadi objek data. `lyrics`
 * disimpan apa adanya (tidak di-trim) — spasi di awal/akhir baris sengaja
 * dipertahankan karena bisa dipakai user untuk menggeser posisi chord.
 * @returns {{lyrics: string, tempo: number|null, key: string, genre: string, status: string}}
 */
export function readSongFields() {
  return {
    lyrics: lyricsInputEl.value,
    tempo: inputTempo.value ? Number(inputTempo.value) : null,
    key: inputKey.value.trim(),
    genre: inputGenre.value.trim(),
    status: inputStatus.value,
  };
}

/**
 * Inisialisasi tombol-tombol kontrol di layar Detail (ukuran font chord,
 * transpose, auto scroll). Dipanggil sekali saat aplikasi start. Klik
 * memberi tahu controller lewat callback, karena state-nya (ukuran font
 * berapa, sudah geser berapa semitone, sedang auto-scroll atau tidak,
 * level kecepatan) itu punya arti di level fitur (reset tiap buka lagu),
 * bukan urusan DOM semata — jadi disimpan di song.controller.js, bukan
 * di sini.
 * @param {{onFontDec: () => void, onFontInc: () => void, onTransposeDown: () => void, onTransposeUp: () => void, onAutoScrollToggle: () => void, onAutoScrollSpeedDec: () => void, onAutoScrollSpeedInc: () => void}} callbacks
 */
export function initSongDetailControls(callbacks) {
  btnChordFontDecEl.addEventListener("click", callbacks.onFontDec);
  btnChordFontIncEl.addEventListener("click", callbacks.onFontInc);
  btnTransposeDownEl.addEventListener("click", callbacks.onTransposeDown);
  btnTransposeUpEl.addEventListener("click", callbacks.onTransposeUp);
  btnAutoScrollToggleEl.addEventListener("click", callbacks.onAutoScrollToggle);
  btnAutoScrollSpeedDecEl.addEventListener("click", callbacks.onAutoScrollSpeedDec);
  btnAutoScrollSpeedIncEl.addEventListener("click", callbacks.onAutoScrollSpeedInc);
}

/**
 * Mengubah ukuran font lirik+chord di read mode lewat CSS variable di
 * container (dibaca oleh .song-detail-chord & .song-detail-lyric-text di
 * song.css), tanpa render ulang. Chord & lirik digeser bersamaan (lirik
 * selalu +2px dari chord) supaya keduanya benar-benar kelihatan berubah
 * saat tombol font ditekan — sebelumnya hanya baris chord yang berubah,
 * sehingga terasa seperti tombolnya tidak berfungsi.
 * @param {number} px - ukuran font chord; ukuran font lirik dihitung dari ini.
 */
export function setChordFontSize(px) {
  detailLinesEl.style.setProperty("--song-chord-font-size", `${px}px`);
  detailLinesEl.style.setProperty("--song-lyric-font-size", `${px + 2}px`);
}

/**
 * Menampilkan angka pergeseran transpose saat ini (misal "0", "+2", "-1").
 * @param {number} steps
 */
export function setTransposeLabel(steps) {
  transposeLabelEl.textContent = steps > 0 ? `+${steps}` : `${steps}`;
}

/**
 * Menampilkan subjudul "Draft • Lagu" / "Selesai • Lagu" di header Detail
 * untuk tipe "song", dan menyembunyikan pill tipe generik (#detail-type)
 * supaya tidak dobel dengan subjudul ini.
 * @param {Object} [details]
 */
export function setSongDetailHeader(details) {
  const statusLabel = details?.status === "selesai" ? "Selesai" : "Draft";
  detailSubtitleEl.textContent = `${statusLabel} • Lagu`;
  detailSubtitleEl.hidden = false;
  if (detailTypePillEl) detailTypePillEl.hidden = true;
}

/**
 * Mengembalikan header Detail ke kondisi normal (dipakai tipe selain
 * "song"): subjudul kosong lagi, pill tipe generik tampil seperti biasa.
 */
export function clearSongDetailHeader() {
  detailSubtitleEl.textContent = "";
  detailSubtitleEl.hidden = true;
  if (detailTypePillEl) detailTypePillEl.hidden = false;
}

/**
 * Menampilkan/menyembunyikan blok detail song di layar Detail. Untuk tipe
 * "song", area catatan bebas (#detail-content) dipindah ke bawah "Detail
 * Lagu" di dalam blok ini. Untuk tipe lain, elemen yang sama dikembalikan
 * ke posisi asalnya (sebelum blok Checklist), tanpa duplikasi elemen.
 * @param {boolean} visible
 */
export function setSongDetailVisible(visible) {
  songSectionEl.hidden = !visible;

  if (!detailContentEl) return;

  if (visible) {
    songSectionEl.appendChild(detailContentEl);
  } else if (detailContentHomeAnchorEl && detailContentHomeAnchorEl.parentNode) {
    detailContentHomeAnchorEl.parentNode.insertBefore(detailContentEl, detailContentHomeAnchorEl);
  }
}

/**
 * Merender string `lyrics` polos ke read mode, satu baris sumber = satu
 * baris tampilan. Setiap baris diklasifikasi saat render (bukan saat
 * simpan), sesuai 08-Design-Song-NoteType.md §3:
 * - Baris chord (lewat isChordLine) -> class "song-detail-chord" (Sky,
 *   bold, monospace lewat CSS yang sudah ada).
 * - Baris label "[Verse]"/"[Chorus]" -> class "song-detail-label" (tebal).
 * - Baris kosong -> spacer, supaya jarak antar bait tetap terlihat.
 * - Selain itu -> baris lirik biasa (class "song-detail-lyric-text").
 * @param {HTMLElement} container
 * @param {string} lyricsText
 */
function renderLyrics(container, lyricsText) {
  container.textContent = "";

  const text = lyricsText ?? "";
  if (!text.trim()) {
    const emptyEl = document.createElement("p");
    emptyEl.className = "song-detail-empty";
    emptyEl.textContent = "Belum ada lirik.";
    container.appendChild(emptyEl);
    return;
  }

  text.split("\n").forEach((line) => {
    const trimmed = line.trim();
    const lineEl = document.createElement("div");

    if (!trimmed) {
      lineEl.className = "song-detail-blank";
    } else if (isChordLine(line)) {
      lineEl.className = "song-detail-chord song-mono";
      lineEl.textContent = line;
    } else if (LABEL_LINE_PATTERN.test(trimmed)) {
      lineEl.className = "song-detail-label";
      lineEl.textContent = trimmed;
    } else {
      lineEl.className = "song-detail-lyric-text song-mono";
      lineEl.textContent = line;
    }

    container.appendChild(lineEl);
  });
}

/**
 * Merender ulang lirik+chord di read mode dengan teks terbaru (dipakai
 * saat transpose berubah — controller sudah menghitung ulang string
 * lyrics-nya dari originalLyrics, di sini hanya menampilkan).
 * @param {string} lyricsText
 */
export function updateSongLyrics(lyricsText) {
  renderLyrics(detailLinesEl, lyricsText);
}

/**
 * Mengisi teks sebuah pill Detail Lagu, dan menyembunyikannya kalau
 * nilainya kosong (mis. tempo belum diisi) — lebih bersih daripada
 * menampilkan pill berisi "-".
 * @param {HTMLElement} el
 * @param {string} text
 */
function setPillText(el, text) {
  el.textContent = text;
  el.hidden = !text;
}

/**
 * Mengisi tampilan detail song (read mode).
 * @param {Object} [details] - record songDetails, kosongkan untuk note song
 *   yang belum pernah punya detail tersimpan.
 */
export function fillSongDetail(details) {
  renderLyrics(detailLinesEl, details?.lyrics);

  setPillText(detailTempoEl, details?.tempo ? `${details.tempo} BPM` : "");
  setPillText(detailKeyEl, details?.key || "");
  setPillText(detailGenreEl, details?.genre || "");

  const isDone = details?.status === "selesai";
  detailStatusEl.textContent = isDone ? "Selesai" : "Draft";
  detailStatusEl.classList.toggle("song-pill-mint", isDone);
  detailStatusEl.classList.toggle("song-pill-grey", !isDone);
}

/**
 * Menampilkan status Play/Pause pada tombol Auto Scroll (ikon & label).
 * @param {boolean} playing
 */
export function setAutoScrollPlaying(playing) {
  btnAutoScrollToggleEl.classList.toggle("is-playing", playing);
  btnAutoScrollToggleEl.setAttribute("aria-pressed", String(playing));
  autoScrollPlayLabelEl.textContent = playing ? "Jeda" : "Putar";
}

/**
 * Menampilkan angka level kecepatan Auto Scroll saat ini (1-5).
 * @param {number} level
 */
export function setAutoScrollSpeedLabel(level) {
  autoScrollSpeedLabelEl.textContent = String(level);
}

/**
 * Menggeser scroll turun sejumlah piksel. Dipakai loop auto-scroll di
 * controller tiap frame. Yang di-scroll hanya kotak lirik (#song-detail-lines)
 * itu sendiri — kotak ini sudah diberi overflow-y:auto lewat CSS (song.css),
 * jadi pill/kontrol Transpose/Font/Chord di atasnya tidak ikut bergeser.
 * @param {number} px
 */
export function scrollPageBy(px) {
  detailLinesEl.scrollTop += px;
}

/**
 * Mengecek apakah kotak lirik sudah discroll sampai baris terakhir —
 * dipakai sebagai penanda auto-stop. Dibandingkan lewat scrollTop, bukan
 * posisi di layar, karena sekarang yang scroll adalah kotaknya sendiri.
 * @returns {boolean}
 */
export function isSongLyricsScrollEnd() {
  const el = detailLinesEl;
  return el.scrollTop + el.clientHeight >= el.scrollHeight - 1;
}

/**
 * Mengecek apakah layar Detail sedang ditampilkan — dipakai controller
 * sebagai pengaman: kalau user sudah pindah layar (mis. tombol kembali)
 * sementara auto-scroll masih jalan, loop-nya perlu berhenti supaya tidak
 * ikut menggeser layar lain di belakang layar.
 * @returns {boolean}
 */
export function isSongDetailViewVisible() {
  return !viewDetailEl.hidden;
}
