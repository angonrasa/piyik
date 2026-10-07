// modules/chat/chat.ai-adapter.js
//
// AI-4.0 — Kontrak Adapter (09-roadmap-ai-integration-v2-1.md). Satu-
// satunya titik yang boleh dipanggil modul lain (chat.controller.js,
// dst) untuk urusan AI. Isinya CUMA memilih provider aktif dan
// meneruskan pemanggilan — TIDAK ADA logic AI di file ini, sesuai
// Prinsip AI Integration (01-Piyik-Blueprint.md): "satu pintu integrasi,
// modul lain dilarang keras mengimpor provider spesifik secara
// langsung."
//
// AI-4.1 & tambahan (lihat catatan di local-server.adapter.js) —
// sekarang ada 3 kandidat provider, dicoba berurutan lewat
// isAvailable(), berhenti di yang pertama tersedia:
//   1. LocalServerAdapter — Termux/llama-server (Qwen), TETAP 100% lokal.
//                          Diutamakan PERTAMA karena di device user model
//                          ini sudah ready & jalan duluan (bukan soal
//                          privacy — WebLLM juga 100% lokal — murni soal
//                          mana yang sudah siap pakai tanpa nunggu
//                          download model besar di browser).
//   2. WebLLMAdapter     — jalan di browser (WebGPU). Cadangan kedua:
//                          kalau Termux/llama-server belum di-start,
//                          device masih bisa jalan AI lewat browser
//                          langsung (dengan download model on-demand).
//   3. NullAIProvider     — fallback aman, selalu tersedia, dipakai
//                          kalau dua-duanya di atas tidak jalan.
// CloudAPIAdapter (AI-4.2 resmi, butuh API key & consent eksplisit)
// BELUM dikerjakan — belum ada di daftar `providers` di bawah.

import { NullAIProvider } from "./chat.ai-provider.interface.js";
import { WebLLMAdapter } from "./ai-adapters/webllm.adapter.js";
import { LocalServerAdapter } from "./ai-adapters/local-server.adapter.js";

const nullProvider = new NullAIProvider();
const providers = [new LocalServerAdapter(), new WebLLMAdapter(), nullProvider];

/**
 * Cari provider pertama yang isAvailable() = true, sesuai urutan
 * preferensi di atas. Selalu ada hasil (nullProvider di akhir daftar
 * selalu tersedia), jadi fungsi ini tidak pernah return undefined.
 * @returns {Promise<import('./chat.ai-provider.interface.js').AIProvider>}
 */
async function getActiveProvider() {
  for (const provider of providers) {
    if (await provider.isAvailable()) return provider;
  }
  return nullProvider;
}

/**
 * @returns {Promise<boolean>}
 */
export async function isAIAvailable() {
  const provider = await getActiveProvider();
  return provider.isAvailable();
}

/**
 * WAJIB dicek isAIAvailable() dulu oleh pemanggil sebelum memanggil ini
 * — adapter tidak mengecek ulang di sini supaya tetap tipis (cuma
 * meneruskan), sesuai "tidak ada logic AI di file ini".
 * @param {string} prompt
 * @returns {Promise<string>}
 */
export async function generateAIReply(prompt) {
  const provider = await getActiveProvider();
  return provider.generate(prompt);
}

