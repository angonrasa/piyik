// modules/memory/memory.contradiction.js
//
// Tahap 8 — Contradiction Detector (05-Roadmap-Reakurasi.md).
// ⚠️ Titik rawan kompleksitas menurut roadmap: "kalau rule mulai butuh
// pemahaman makna kalimat (bukan sekadar keyword), pindahkan ke
// Backlog." Implementasi di file ini SENGAJA berhenti di hitung kata
// literal (whole word match dari daftar tetap) — TIDAK ada pemahaman
// konteks/makna kalimat sama sekali. Kalau daftar kata dirasa sering
// salah tebak, itu sinyal untuk pindahkan fitur ini ke Backlog, BUKAN
// alasan untuk memperhalus jadi sentiment analysis beneran.
//
// Milestone 8.1 reuse calculateSimilarity() dari memory.similarity.js
// (Tahap 3) apa adanya — fungsi itu generik, menerima dua teks apapun,
// jadi dipakai ulang untuk bandingkan CATATAN vs CATATAN (bukan cuma
// pesan vs catatan). Tidak perlu logic topic-matching baru. Import
// langsung, konsisten dengan pola cross-import modul memory/ lain
// (mis. memory.retrieval.js -> memory.ranking.js/memory.keyword.js).

import { calculateSimilarity } from "./memory.similarity.js";

const MIN_GAP_DAYS = 182; // ~6 bulan

// Starter list — kata penanda sikap positif/negatif, kosakata sehari-hari
// (termasuk ejaan gaul, karena catatan pribadi biasanya ditulis santai).
// TAMBAH MANUAL sesuai kebutuhan, sama pola seperti PLACE_KEYWORDS/
// ACTIVITY_KEYWORDS di memory.similarity.js.
const POSITIVE_WORDS = [
  "suka", "senang", "seneng", "bagus", "mantap", "enak", "seru",
  "asik", "nyaman", "puas", "bersyukur", "lancar", "semangat",
];
const NEGATIVE_WORDS = [
  "benci", "kecewa", "jelek", "buruk", "males", "malas", "susah",
  "sulit", "capek", "cape", "bosan", "kesel", "kesal", "stress",
  "stres", "gagal",
];

/**
 * Hitung berapa kata dari sebuah daftar yang muncul di teks (whole word,
 * case-insensitive). Sengaja duplikat kecil dari pola findMatches() di
 * memory.similarity.js — daripada export fungsi privat lintas modul demi
 * fungsi 5 baris.
 * @param {string} text @param {string[]} wordList @returns {number}
 */
function countMatches(text, wordList) {
  const lower = text.toLowerCase();
  return wordList.filter((word) => new RegExp(`\\b${word}\\b`).test(lower)).length;
}

/**
 * Milestone 8.2 (bagian klasifikasi). Klasifikasi sikap sebuah teks
 * MURNI dari hitungan kata literal — bukan sentiment analysis.
 * @param {string} text
 * @returns {"positive"|"negative"|"neutral"}
 */
export function classifySentiment(text) {
  const positive = countMatches(text, POSITIVE_WORDS);
  const negative = countMatches(text, NEGATIVE_WORDS);

  if (positive > negative) return "positive";
  if (negative > positive) return "negative";
  return "neutral";
}

/**
 * Milestone 8.2 (bagian bandingkan). True kalau dua teks sama-sama
 * punya sikap yang jelas (non-neutral) TAPI berbeda arah.
 * @param {string} textA @param {string} textB
 * @returns {boolean}
 */
export function hasAttitudeChanged(textA, textB) {
  const sentimentA = classifySentiment(textA);
  const sentimentB = classifySentiment(textB);

  if (sentimentA === "neutral" || sentimentB === "neutral") return false;
  return sentimentA !== sentimentB;
}

/**
 * Milestone 8.1. Cari SATU catatan lain yang topiknya mirip dengan
 * topNote (pakai calculateSimilarity() Tahap 3, ambang sama), DAN
 * jaraknya waktu cukup jauh (>= 182 hari / ~6 bulan). Berhenti di
 * kandidat pertama yang cocok (bukan cari yang "terbaik").
 * @param {Array<object>} notes seluruh catatan (dari getAllNotes())
 * @param {object} topNote catatan acuan (biasanya #1 hasil retrieval)
 * @param {{orang: string[], proyek: string[]}} vocab dari buildSimilarityVocab()
 * @returns {{partner: object, keyword: string}|null}
 */
export function findContradictionPair(notes, topNote, vocab) {
  const topText = `${topNote.title} ${topNote.content}`;
  const topTime = topNote.createdAt instanceof Date ? topNote.createdAt.getTime() : 0;

  for (const note of notes) {
    if (note.id === topNote.id) continue;

    const noteTime = note.createdAt instanceof Date ? note.createdAt.getTime() : 0;
    const gapDays = Math.abs(topTime - noteTime) / (24 * 60 * 60 * 1000);
    if (gapDays < MIN_GAP_DAYS) continue;

    const noteText = `${note.title} ${note.content}`;
    const similarity = calculateSimilarity(topText, noteText, vocab);
    if (!similarity.topCategory) continue;

    return { partner: note, keyword: similarity.keyword };
  }

  return null;
}
