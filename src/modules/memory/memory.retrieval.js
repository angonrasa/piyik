// modules/memory/memory.retrieval.js
//
// Tahap 1 — Memory Retrieval Engine (lihat 05-Roadmap-Reakurasi.md).
// Milestone 1.1: retrieval dasar dari pesan bebas — dua jalur:
// 1. Notes (kata mirip/keyword/judul/isi) via searchNotes().
// 2. Relations (catatan yang terhubung ke hasil #1) via getRelatedNotes().
//
// Reuse fungsi yang sudah ada di modules/notes dan modules/relations —
// TIDAK bikin mesin cari/query baru, sesuai KISS/YAGNI.
//
// Return berupa DATA TERSTRUKTUR (array notes), bukan kalimat jadi. Ini
// sengaja: supaya nanti kalau lapisan "penyusun jawaban" diganti (misal
// disambungkan ke AI), fungsi ini tidak perlu diubah — tugasnya cuma
// mengambil memori yang relevan, bukan menyusun narasi.
//
// Ranking & pembatasan jumlah hasil BELUM di sini — itu Tahap 2
// (Context Ranking), dikerjakan terpisah setelah Tahap 1 selesai.

import { extractMeaningfulWords, hasEnoughSignal } from "./memory.keyword.js";
import { searchNotes } from "../notes/notes.repository.js";
import { getRelatedNotes } from "../relations/relations.repository.js";

/**
 * Mencoba menemukan catatan lama yang relevan dari kalimat bebas (bukan
 * perintah pencarian eksplisit). Dipanggil sebagai retrieval PASIF —
 * hanya jalan kalau tidak ada intent lain yang cocok (lihat
 * chat.controller.js -> handleFallback).
 * @param {string} pesan pesan asli user, apa adanya (belum dinormalisasi)
 * @returns {Promise<Array>} catatan yang cocok (match langsung + terkait
 *   via relasi), array kosong jika tidak ada/tidak layak dicari
 */
export async function retrieveMemory(pesan) {
  const words = extractMeaningfulWords(pesan);

  if (!hasEnoughSignal(words)) return [];

  const query = words.join(" ");
  const directMatches = await searchNotes(query);

  if (directMatches.length === 0) return [];

  const relatedNotes = await collectRelatedNotes(directMatches);

  return mergeUnique(directMatches, relatedNotes);
}

/**
 * Mengambil semua catatan yang terhubung (1 langkah relasi) dari
 * sekumpulan catatan hasil match langsung.
 * @param {Array} directMatches
 * @returns {Promise<Array>} gabungan catatan terkait (belum di-dedupe)
 */
async function collectRelatedNotes(directMatches) {
  const relatedLists = await Promise.all(
    directMatches.map((note) => getRelatedNotes(note.id))
  );
  return relatedLists.flat();
}

/**
 * Menggabungkan dua daftar catatan tanpa duplikat, primary tetap di depan.
 * @param {Array} primary
 * @param {Array} secondary
 * @returns {Array}
 */
function mergeUnique(primary, secondary) {
  const seenIds = new Set(primary.map((note) => note.id));

  const uniqueSecondary = secondary.filter((note) => {
    if (seenIds.has(note.id)) return false;
    seenIds.add(note.id);
    return true;
  });

  return [...primary, ...uniqueSecondary];
}