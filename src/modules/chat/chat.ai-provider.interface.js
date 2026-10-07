// modules/chat/chat.ai-provider.interface.js
//
// AI-4.0 — Kontrak Adapter (09-roadmap-ai-integration-v2-1.md). Bentuk
// yang WAJIB diikuti semua provider AI (WebLLM di AI-4.1, Cloud API di
// AI-4.2, atau provider lain di masa depan). File ini TIDAK memanggil AI
// apapun — cuma kontrak + satu implementasi kosong (NullAIProvider),
// sesuai Prinsip AI Integration (01-Piyik-Blueprint.md): satu pintu
// integrasi lewat interface yang sama, tidak ada modul yang boleh
// mengimpor provider spesifik langsung.

/**
 * Kontrak dasar yang harus diikuti tiap provider AI. JS tidak punya
 * interface asli, jadi ini class biasa yang methodnya sengaja belum
 * diimplementasi (lempar error kalau dipanggil langsung tanpa
 * di-override) — provider nyata WAJIB extends class ini dan override
 * kedua method di bawah.
 */
export class AIProvider {
  /**
   * Cek apakah provider ini siap dipakai sekarang (model sudah
   * dimuat/di-cache, device mendukung, dst — beda-beda tiap provider).
   * @returns {Promise<boolean>}
   */
  async isAvailable() {
    throw new Error("AIProvider.isAvailable() belum diimplementasi");
  }

  /**
   * Hasilkan teks jawaban dari prompt yang sudah disiapkan AI-3
   * (chat.prompt-builder.js). Provider TIDAK boleh query Dexie atau
   * modul lain di luar prompt yang diterima — sesuai Prinsip AI
   * Integration, AI cuma menerima context package yang sudah disiapkan
   * kode JS biasa.
   * @param {string} prompt
   * @param {object} [opts]
   * @returns {Promise<string>}
   */
  async generate(prompt, opts) {
    throw new Error("AIProvider.generate() belum diimplementasi");
  }
}

/**
 * Implementasi paling sederhana — selalu "tidak tersedia". Ini default
 * aman selama belum ada provider nyata terpasang (AI-4.1/AI-4.2 belum
 * dikerjakan), atau kalau provider nyata gagal dimuat/device tidak
 * mendukung (AI-5, error handling). generate() sengaja tidak pernah
 * dipanggil dalam alur normal — pemanggil (chat.ai-adapter.js) harus
 * selalu cek isAvailable() dulu sebelum generate().
 */
export class NullAIProvider extends AIProvider {
  async isAvailable() {
    return false;
  }

  async generate() {
    throw new Error("NullAIProvider tidak bisa generate() — isAvailable() seharusnya false, cek dulu sebelum manggil generate().");
  }
}
