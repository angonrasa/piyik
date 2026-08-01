/**
 * Code.gs — Piyik Brain Telemetry Receiver
 *
 * CARA PAKAI:
 * 1. Buat Google Sheet baru.
 * 2. Buka menu Extensions > Apps Script.
 * 3. Hapus isi default, ganti dengan isi file ini.
 * 4. Di baris pertama sheet, buat header (opsional tapi disarankan):
 *    Timestamp | DeviceId | Version | LastUsed | FeatureUsage | Errors
 * 5. Klik Deploy > New deployment > pilih tipe "Web app".
 *    - Execute as: Me
 *    - Who has access: Anyone
 * 6. Copy URL yang dihasilkan, taruh di src/modules/telemetry/config.js
 */

function doPost(e) {
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    var data = JSON.parse(e.postData.contents);

    sheet.appendRow([
      new Date(),
      data.deviceId || '',
      data.version || '',
      data.lastUsed || '',
      JSON.stringify(data.featureUsage || {}),
      JSON.stringify(data.errors || []),
    ]);

    return ContentService
      .createTextOutput(JSON.stringify({ status: 'ok' }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ status: 'error', message: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
