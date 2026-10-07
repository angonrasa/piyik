// modules/chat/ai-adapters/local-server.adapter.js
//
// TAMBAHAN DI LUAR roadmap v2 tertulis (09-roadmap-ai-integration-v2-1.md
// cuma merencanakan WebLLM + Cloud API, lihat AI-4.2 resmi). Provider ini
// menyambung ke llama-server (bagian dari llama.cpp) yang sudah jalan
// duluan lewat Termux, expose endpoint HTTP compatible gaya OpenAI di
// 127.0.0.1. Disepakati sebagai tambahan sadar (bukan langkah roadmap
// resmi), karena provider lokalnya sudah jalan lebih dulu daripada
// WebLLM.
//
// PENTING — beda dari CloudAPIAdapter (AI-4.2 resmi, belum dikerjakan):
// LocalServerAdapter TETAP 100% lokal (data cuma lewat 127.0.0.1, tidak
// pernah keluar device), jadi TIDAK perlu consent/API key seperti Cloud
// API — sifatnya lebih dekat ke WebLLM (privacy-first), cuma beda cara
// modelnya jalan (proses native di Termux via HTTP, bukan WebGPU di
// dalam tab browser).
//
// CATATAN TEKNIS:
// - Port & path di bawah asumsi default llama-server (`--port 8080`,
//   endpoint /v1/chat/completions & /health gaya OpenAI/llama.cpp). Kalau
//   setup Termux-nya beda, sesuaikan BASE_URL.
// - Kalau Piyik Mind diakses lewat HTTPS (PWA production), sebagian
//   browser bisa blokir fetch ke http://127.0.0.1 sebagai "mixed
//   content" — biasanya localhost dikecualikan, tapi PERLU DITES
//   langsung di device, bukan diasumsikan aman.
// - Belum dites di lingkungan ini (sandbox penyusunan kode tidak punya
//   akses ke Termux/llama-server device kamu) — tes manual dulu sebelum
//   dianggap kelar.

import { AIProvider } from "../chat.ai-provider.interface.js";

const BASE_URL = "http://127.0.0.1:8080";

// Timeout cek isAvailable() dibuat pendek — ini cuma ping, bukan
// generate, jadi kalau server belum di-start di Termux harusnya gagal
// cepat, bukan nge-hang lama sebelum jatuh ke provider berikutnya
// (NullAIProvider).
const AVAILABILITY_TIMEOUT_MS = 1500;

export class LocalServerAdapter extends AIProvider {
  /**
   * Ping cepat ke llama-server. Kalau tidak jalan (Termux belum
   * dibuka/server belum di-start), fetch gagal/timeout -> false,
   * chat.ai-adapter.js otomatis coba provider berikutnya, tanpa error
   * yang bocor ke user.
   * @returns {Promise<boolean>}
   */
  async isAvailable() {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), AVAILABILITY_TIMEOUT_MS);

      const res = await fetch(`${BASE_URL}/health`, { signal: controller.signal });
      clearTimeout(timer);

      return res.ok;
    } catch {
      return false;
    }
  }

  /**
   * @param {string} prompt
   * @returns {Promise<string>}
   */
  async generate(prompt) {
    const res = await fetch(`${BASE_URL}/v1/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7,
      }),
    });

    if (!res.ok) {
      throw new Error(`LocalServerAdapter: llama-server balas status ${res.status}`);
    }

    const data = await res.json();
    return data.choices?.[0]?.message?.content ?? "";
  }
}
