// modules/chat/ai-adapters/webllm.adapter.js
//
// AI-4.1 — WebLLMAdapter (09-roadmap-ai-integration-v2-1.md). Implementasi
// AIProvider yang jalan 100% di browser lewat WebGPU (paket
// @mlc-ai/web-llm), TIDAK ada data yang keluar HP — sejalan dengan
// prinsip privacy-first di Prinsip AI Integration
// (01-Piyik-Blueprint.md).
//
// CATATAN PENTING: kode di file ini ditulis mengikuti API publik
// @mlc-ai/web-llm (CreateMLCEngine, engine.chat.completions.create),
// TAPI belum pernah dijalankan/dites di lingkungan ini (sandbox
// penyusunan kode ini tidak punya browser/WebGPU/akses npm install).
// Sebelum dipakai beneran:
// 1. `npm install @mlc-ai/web-llm` dulu di project.
// 2. Tes manual di device asli (WebGPU cuma jalan di browser modern —
//    cek dukungan device dulu, jangan asumsi otomatis jalan).
// Kalau ada API yang berubah di versi paket yang kepasang, sesuaikan
// method-nya di sini, bukan di chat.controller.js atau chat.ai-adapter.js
// (itu yang bikin adapter pattern ini berguna).

import { AIProvider } from "../chat.ai-provider.interface.js";

// Model kecil (1-3B) sesuai roadmap ("misal Qwen/Llama 1B–3B") — device
// mobile kelas menengah kemungkinan besar tidak kuat model lebih besar.
// Ganti string ini kalau mau model lain yang didukung @mlc-ai/web-llm
// (lihat daftar model resmi paketnya).
const MODEL_ID = "Qwen2.5-1.5B-Instruct-q4f16_1-MLC";

export class WebLLMAdapter extends AIProvider {
  constructor() {
    super();
    // Lazy singleton: model cuma dimuat sekali (pas pertama dibutuhkan),
    // dipakai ulang untuk generate() berikutnya — bukan reload tiap pesan.
    this._engine = null;
    this._loadPromise = null;
  }

  /**
   * Cek dukungan WebGPU device SAJA. Sengaja TIDAK mengecek status
   * download model di sini (proses itu berat & lambat, baru terjadi pas
   * generate() pertama dipanggil) — kalau device tidak mendukung WebGPU,
   * chat.ai-adapter.js otomatis coba provider berikutnya, tanpa error.
   * @returns {Promise<boolean>}
   */
  async isAvailable() {
    if (typeof navigator === "undefined" || !navigator.gpu) return false;

    try {
      const adapter = await navigator.gpu.requestAdapter();
      return adapter !== null;
    } catch {
      return false;
    }
  }

  /**
   * @param {(progress: {text: string, progress: number}) => void} [onProgress]
   * @returns {Promise<object>} engine @mlc-ai/web-llm
   */
  async _getEngine(onProgress) {
    if (this._engine) return this._engine;
    if (this._loadPromise) return this._loadPromise;

    this._loadPromise = (async () => {
      // Import dinamis: paket ini berat (runtime WebGPU + model), jangan
      // ikut ke bundle awal aplikasi kalau AI belum diaktifkan user
      // (lihat AI-6 — toggle "Aktifkan AI", default off).
      const { CreateMLCEngine } = await import("@mlc-ai/web-llm");

      this._engine = await CreateMLCEngine(MODEL_ID, {
        initProgressCallback: (report) => {
          // Milestone AI-4.1: "progress indicator sederhana, sesuai
          // 07-UI-Guidelines.md — minimal, tidak ramai". Callback ini
          // BELUM disambungkan ke UI (chat.view.js di luar scope task
          // ini) — pemanggil generate() bisa lewatkan onProgress sendiri
          // kalau mau nampilkan progress unduh model ke user.
          onProgress?.({ text: report.text, progress: report.progress });
        },
      });

      return this._engine;
    })();

    return this._loadPromise;
  }

  /**
   * @param {string} prompt
   * @param {{onProgress?: (p: {text: string, progress: number}) => void}} [opts]
   * @returns {Promise<string>}
   */
  async generate(prompt, opts = {}) {
    const engine = await this._getEngine(opts.onProgress);

    const response = await engine.chat.completions.create({
      messages: [{ role: "user", content: prompt }],
    });

    return response.choices[0]?.message?.content ?? "";
  }
}
