// Bu kodni Google Sheets ichidagi Apps Script muharririga to'liq nusxalab
// qo'ying (qadamlar README.md faylida). Bir nechta "resurs" bilan ishlaydi:
// ro'yxatdan o'tganlar, sinflar ro'yxati, rasmiy o'quvchilar ro'yxati,
// haydovchilar, maktab joylashuvi, sinf kuratorlari, umumiy hisobot
// qabul qiluvchilar, sozlamalar — va Telegram bot xabarlarini qabul qilish.
//
// MUHIM: "Royxat" varag'i — ro'yxatdan o'tgan bolalarning haqiqiy
// ma'lumotlari shu yerda. Bu kod hech qachon shu varaqni to'liq
// tozalamaydi/qayta yozmaydi — faqat bitta qator qo'shadi (addEntry_),
// bitta qatorni o'chiradi (deleteEntry_, admin bosganda) yoki bitta
// qatorning ba'zi ustunlarini yangilaydi (updateEntry_). Boshqa
// (Sinflar/OquvchilarRoyxati/Haydovchilar/Kuratorlar/UmumiyHisobot)
// varaqlar admin sozlamalari bo'lgani uchun "saqlash" bosilganda mos
// qatorlar yangilanadi — bu ham har doim mavjudlarni saqlab qolgan holda.
//
// TELEGRAM BOT SOZLASH (ixtiyoriy — token kelgach):
// 1) Bu muharrirda: Project Settings (chap tomonda tishli belgi) →
//    Script Properties → "Add script property" → nomi TELEGRAM_BOT_TOKEN,
//    qiymati @BotFather bergan token.
//  2) Pastdagi setupTelegramWebhook() funksiyasidagi WEB_APP_URL qatoriga
//    o'zingizning config.js dagi APPS_SCRIPT_URL qiymatini joylashtiring.
// 3) Yuqoridagi funksiya tanlovidan "setupTelegramWebhook"ni tanlab, ▶ Run
//    tugmasini bir marta bosing (birinchi marta ruxsat so'raydi).
// Token hech qachon ochiq saytga (config.js/GitHub) yozilmaydi — faqat
// shu yerda, Script Properties'da yashiringan holda turadi.

var ROYXAT_HEADER = [
  "ID", "Vaqt", "Ism", "Familiya", "Sinf", "Telefon", "Lat", "Lng",
  "TurarJoy", "Kunlar", "BekatLat", "BekatLng", "AvtobusOverride",
  "KelishKunlari", "KetishKunlari", "Chiqarilgan",
];
var ALL_WEEKDAYS = ["Dush", "Sesh", "Chor", "Pay", "Juma"];

function doGet(e) {
  var type = (e.parameter && e.parameter.type) || "entries";
  var out;
  if (type === "classes") out = getClasses_();
  else if (type === "roster") out = getRoster_();
  else if (type === "drivers") out = getDrivers_();
  else if (type === "school") out = getSchool_();
  else if (type === "kurators") out = getKurators_();
  else if (type === "overall") out = getOverall_();
  else if (type === "settings") out = getSettings_();
  else out = getEntries_();
  return json_(out);
}

function doPost(e) {
  var body = JSON.parse(e.postData.contents);

  // Telegram serverlaridan kelgan yangilanish (webhook) — bizning
  // saytimiz yubormaydigan "update_id" maydoni bilan ajratiladi.
  if (body.update_id !== undefined) {
    return handleTelegramUpdate_(body);
  }

  var type = body.type;
  if (type === "entry") {
    addEntry_(body);
  } else if (type === "updateEntry") {
    updateEntry_(body.id, body.fields || {});
  } else if (type === "deleteEntry") {
    deleteEntry_(body.id);
  } else if (type === "classes") {
    replaceSheet_(
      "Sinflar",
      ["Sinf", "JamiOquvchi", "AftobusFoydalanuvchi"],
      (body.items || []).map(function (c) {
        return [c.sinf, c.jami != null ? c.jami : "", c.busFoydalanuvchi != null ? c.busFoydalanuvchi : ""];
      }),
      []
    );
  } else if (type === "roster") {
    replaceSheet_(
      "OquvchilarRoyxati",
      ["Sinf", "Ism", "Familiya"],
      (body.items || []).map(function (r) {
        return [r.sinf, r.ism, r.familiya];
      }),
      []
    );
  } else if (type === "drivers") {
    replaceSheet_(
      "Haydovchilar",
      ["Raqam", "Haydovchi", "Telefon", "Rang", "Sigim"],
      (body.items || []).map(function (d) {
        return [d.raqam, d.haydovchi, d.telefon, d.rang, d.sigim != null ? d.sigim : ""];
      }),
      [3]
    );
  } else if (type === "school") {
    setSchool_(body);
  } else if (type === "kurators") {
    saveKurators_(body.items || []);
  } else if (type === "overall") {
    saveOverall_(body.items || []);
  } else if (type === "settings") {
    setSettings_(body.values || {});
  } else if (type === "notifyKurators") {
    var sent = notifyKurators_(body.assignments || []);
    return json_({ ok: true, sent: sent });
  }
  return json_({ ok: true });
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function sheet_(name, header) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.appendRow(header);
  }
  return sheet;
}

// Sinflar/OquvchilarRoyxati/Haydovchilar kabi ADMIN SOZLAMALARI uchun —
// "Saqlash" bosilganda hammasi almashtiriladi. Royxat (ro'yxatdan
// o'tganlar) uchun HECH QACHON ishlatilmaydi.
function replaceSheet_(name, header, rows, textColumns) {
  var sheet = sheet_(name, header);
  sheet.getRange(1, 1, 1, header.length).setValues([header]);
  (textColumns || []).forEach(function (col) {
    sheet.getRange(2, col, Math.max(sheet.getMaxRows() - 1, 1), 1).setNumberFormat("@");
  });
  var lastRow = sheet.getLastRow();
  if (lastRow > 1) sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).clearContent();
  if (rows.length) sheet.getRange(2, 1, rows.length, header.length).setValues(rows);
}

// Eski (qisqaroq) Royxat varag'ini yangi ustunlar bilan kengaytiradi —
// FAQAT sarlavha qatoriga tegadi, mavjud qatorlar/ma'lumotlarga
// hech qanday ta'sir qilmaydi.
function ensureRoyxatColumns_(sheet) {
  var curCols = sheet.getLastColumn();
  if (curCols < ROYXAT_HEADER.length) {
    sheet.getRange(1, curCols + 1, 1, ROYXAT_HEADER.length - curCols).setValues([ROYXAT_HEADER.slice(curCols)]);
  }
}

// ---------------- Royxat (ro'yxatdan o'tganlar) ----------------

function royxatSheet_() {
  var sheet = sheet_("Royxat", ROYXAT_HEADER);
  ensureRoyxatColumns_(sheet);
  sheet.getRange(2, 6, Math.max(sheet.getMaxRows() - 1, 1), 1).setNumberFormat("@");
  return sheet;
}

function addEntry_(data) {
  var sheet = royxatSheet_();
  var id = Utilities.getUuid();
  sheet.appendRow([
    id, new Date(), data.ism || "", data.familiya || "", data.sinf || "",
    String(data.telefon || ""), data.lat != null ? data.lat : "", data.lng != null ? data.lng : "",
    "kundalik", "", "", "", "", "", "",
  ]);
  notifyKuratorOfNewEntry_(data);
  return id;
}

// Yangi o'quvchi ro'yxatdan o'tganda, agar shu sinfga Telegram orqali
// ulangan kurator bo'lsa, unga darhol qisqa xabar yuboradi. Avtobus/vaqt
// ma'lumoti bu bosqichda hali mavjud emas (yo'nalish hali hisoblanmagan) —
// u ma'lumot "Kuratorlarga xabar yuborish" tugmasi orqali (yo'nalish
// hisoblanganidan keyin) alohida yuboriladi.
function notifyKuratorOfNewEntry_(data) {
  if (!data.sinf) return;
  var kSheet = sheet_("Kuratorlar", ["Sinf", "Ism", "Telefon", "KirishKodi", "ChatId"]);
  var kRows = kSheet.getDataRange().getValues();
  for (var i = 1; i < kRows.length; i++) {
    if (kRows[i][0] === data.sinf && kRows[i][4]) {
      sendTelegramMessage_(
        kRows[i][4],
        "🆕 Yangi o'quvchi ro'yxatdan o'tdi\n" +
          "Sinf: " + data.sinf + "\n" +
          "Ism familiya: " + (data.ism || "") + " " + (data.familiya || "") + "\n" +
          "Telefon: " + (data.telefon || "—") + "\n\n" +
          "Avtobus va vaqt ma'lumoti yo'nalish hisoblangach yuboriladi."
      );
      return;
    }
  }
}

var ENTRY_FIELD_COL = {
  ism: 3, familiya: 4, sinf: 5, telefon: 6, lat: 7, lng: 8,
  turarJoy: 9, kunlar: 10, bekatLat: 11, bekatLng: 12, avtobusOverride: 13,
  kelishKunlari: 14, ketishKunlari: 15, chiqarilgan: 16,
};

function updateEntry_(id, fields) {
  var sheet = royxatSheet_();
  var values = sheet.getDataRange().getValues();
  for (var i = 1; i < values.length; i++) {
    if (values[i][0] === id) {
      var row = i + 1;
      Object.keys(fields).forEach(function (key) {
        var col = ENTRY_FIELD_COL[key];
        if (!col) return;
        var v = fields[key];
        if (key === "telefon") sheet.getRange(row, col).setNumberFormat("@");
        sheet.getRange(row, col).setValue(v == null ? "" : v);
      });
      return true;
    }
  }
  return false;
}

function deleteEntry_(id) {
  var sheet = royxatSheet_();
  var values = sheet.getDataRange().getValues();
  for (var i = 1; i < values.length; i++) {
    if (values[i][0] === id) {
      sheet.deleteRow(i + 1);
      return;
    }
  }
}

function splitDays_(raw) {
  return String(raw || "").split(",").map(function (s) { return s.trim(); }).filter(Boolean);
}

function getEntries_() {
  var sheet = royxatSheet_();
  var rows = sheet.getDataRange().getValues();
  var out = [];
  for (var i = 1; i < rows.length; i++) {
    var r = rows[i];
    if (!r[2] && !r[3]) continue;
    var turarJoy = r[8] || "kundalik";
    var legacyKunlar = splitDays_(r[9]);
    var kelishRaw = splitDays_(r[13]);
    var ketishRaw = splitDays_(r[14]);
    var defaultDays = turarJoy === "yotoqxona" ? legacyKunlar : ALL_WEEKDAYS;
    out.push({
      id: r[0],
      ts: r[1] instanceof Date ? r[1].toISOString() : String(r[1]),
      ism: r[2], familiya: r[3], sinf: r[4],
      telefon: r[5] === "" ? "" : String(r[5]),
      lat: r[6] === "" ? null : Number(r[6]),
      lng: r[7] === "" ? null : Number(r[7]),
      turarJoy: turarJoy,
      kunlar: legacyKunlar,
      bekatLat: r[10] === "" || r[10] == null ? null : Number(r[10]),
      bekatLng: r[11] === "" || r[11] == null ? null : Number(r[11]),
      avtobusOverride: r[12] === "" || r[12] == null ? null : r[12],
      kelishKunlari: kelishRaw.length ? kelishRaw : defaultDays,
      ketishKunlari: ketishRaw.length ? ketishRaw : defaultDays,
      chiqarilgan: r[15] === true || r[15] === "TRUE" || r[15] === "1" || r[15] === 1,
    });
  }
  return out;
}

// ---------------- Sinflar ----------------

function getClasses_() {
  var sheet = sheet_("Sinflar", ["Sinf", "JamiOquvchi", "AftobusFoydalanuvchi"]);
  var rows = sheet.getDataRange().getValues();
  var out = [];
  for (var i = 1; i < rows.length; i++) {
    if (!rows[i][0]) continue;
    var jami = rows[i][1] === "" || rows[i][1] == null ? null : Number(rows[i][1]);
    var busU = rows[i][2] === "" || rows[i][2] == null ? jami : Number(rows[i][2]);
    out.push({ sinf: rows[i][0], jami: jami, busFoydalanuvchi: busU, reja: busU });
  }
  return out;
}

// ---------------- OquvchilarRoyxati ----------------

function getRoster_() {
  var sheet = sheet_("OquvchilarRoyxati", ["Sinf", "Ism", "Familiya"]);
  var rows = sheet.getDataRange().getValues();
  var out = [];
  for (var i = 1; i < rows.length; i++) {
    if (!rows[i][1] && !rows[i][2]) continue;
    out.push({ sinf: rows[i][0], ism: rows[i][1], familiya: rows[i][2] });
  }
  return out;
}

// ---------------- Haydovchilar ----------------

function getDrivers_() {
  var sheet = sheet_("Haydovchilar", ["Raqam", "Haydovchi", "Telefon", "Rang", "Sigim"]);
  var rows = sheet.getDataRange().getValues();
  var out = [];
  for (var i = 1; i < rows.length; i++) {
    if (!rows[i][0]) continue;
    out.push({
      raqam: rows[i][0], haydovchi: rows[i][1],
      telefon: rows[i][2] === "" ? "" : String(rows[i][2]),
      rang: rows[i][3], sigim: rows[i][4] === "" ? null : Number(rows[i][4]),
    });
  }
  return out;
}

// ---------------- Maktab joylashuvi ----------------

function getSchool_() {
  var sheet = sheet_("Maktab", ["Lat", "Lng", "Locked"]);
  var row = sheet.getRange(2, 1, 1, 3).getValues()[0];
  if (row[0] === "" || row[0] == null) return null;
  return { lat: Number(row[0]), lng: Number(row[1]), locked: row[2] === true || row[2] === "TRUE" || row[2] === "true" };
}

function setSchool_(body) {
  var sheet = sheet_("Maktab", ["Lat", "Lng", "Locked"]);
  var existing = sheet.getRange(2, 1, 1, 3).getValues()[0];
  var lat = body.lat != null ? body.lat : existing[0];
  var lng = body.lng != null ? body.lng : existing[1];
  var locked = body.locked != null ? body.locked : existing[2];
  sheet.getRange(2, 1, 1, 3).setValues([[lat, lng, locked === true || locked === "TRUE" ? true : locked === false || locked === "FALSE" ? false : (locked || false)]]);
}

// ---------------- Kuratorlar (har bir sinf uchun ustoz) ----------------
// Kod/ChatId'ni saqlab qolish uchun umumiy replaceSheet_ ISHLATILMAYDI —
// admin faqat ism/telefon yuborsa ham, mavjud kirish kodi va bog'langan
// Telegram chat'i yo'qolib qolmasin deb, avval eskisi bilan solishtiriladi.

function generateCode_() {
  return Utilities.getUuid().split("-")[0].toUpperCase();
}

// Telefon2 — QO'SHIMCHA (ixtiyoriy) aloqa raqami. E'TIBOR: bu ustun sheet_()
// header ro'yxatining OXIRIGA qo'shilgan (Sinf/Ism/Telefon/KirishKodi/ChatId
// tartibi butunlay eski holicha qoldirilgan) — shunday qilib mavjud
// kirishKodi/chatId ustunlari (bot ulanishlari) hech qanday siljishga
// uchramaydi, faqat yangi 6-ustun qo'shiladi (additiv, hech narsa yo'qolmaydi).
function getKurators_() {
  var sheet = sheet_("Kuratorlar", ["Sinf", "Ism", "Telefon", "KirishKodi", "ChatId", "Telefon2"]);
  var rows = sheet.getDataRange().getValues();
  var out = [];
  for (var i = 1; i < rows.length; i++) {
    if (!rows[i][0]) continue;
    out.push({
      sinf: rows[i][0], ism: rows[i][1],
      telefon: rows[i][2] === "" ? "" : String(rows[i][2]),
      kirishKodi: rows[i][3], bogʻlangan: !!rows[i][4],
      telefon2: rows[i][5] == null || rows[i][5] === "" ? "" : String(rows[i][5]),
    });
  }
  return out;
}

function saveKurators_(items) {
  var sheet = sheet_("Kuratorlar", ["Sinf", "Ism", "Telefon", "KirishKodi", "ChatId", "Telefon2"]);
  var existingRows = sheet.getDataRange().getValues();
  var bySinf = {};
  for (var i = 1; i < existingRows.length; i++) {
    if (existingRows[i][0]) bySinf[existingRows[i][0]] = { kirishKodi: existingRows[i][3], chatId: existingRows[i][4] };
  }
  var rows = items.map(function (it) {
    var prev = bySinf[it.sinf];
    var kirishKodi = it.regenerate || !prev || !prev.kirishKodi ? generateCode_() : prev.kirishKodi;
    var chatId = it.regenerate || !prev ? "" : prev.chatId;
    return [it.sinf, it.ism || "", it.telefon || "", kirishKodi, chatId, it.telefon2 || ""];
  });
  sheet.getRange(1, 1, 1, 6).setValues([["Sinf", "Ism", "Telefon", "KirishKodi", "ChatId", "Telefon2"]]);
  var lastRow = sheet.getLastRow();
  if (lastRow > 1) sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).clearContent();
  if (rows.length) sheet.getRange(2, 1, rows.length, 6).setValues(rows);
}

// ---------------- Umumiy hisobot qabul qiluvchilar (rahbariyat) ----------------

function getOverall_() {
  var sheet = sheet_("UmumiyHisobot", ["Ism", "Lavozimi", "KirishKodi", "ChatId"]);
  var rows = sheet.getDataRange().getValues();
  var out = [];
  for (var i = 1; i < rows.length; i++) {
    if (!rows[i][0]) continue;
    out.push({ ism: rows[i][0], lavozimi: rows[i][1], kirishKodi: rows[i][2], bogʻlangan: !!rows[i][3] });
  }
  return out;
}

function saveOverall_(items) {
  var sheet = sheet_("UmumiyHisobot", ["Ism", "Lavozimi", "KirishKodi", "ChatId"]);
  var existingRows = sheet.getDataRange().getValues();
  var byIsm = {};
  for (var i = 1; i < existingRows.length; i++) {
    if (existingRows[i][0]) byIsm[existingRows[i][0]] = { kirishKodi: existingRows[i][2], chatId: existingRows[i][3] };
  }
  var rows = items.map(function (it) {
    var prev = byIsm[it.ism];
    var kirishKodi = it.regenerate || !prev || !prev.kirishKodi ? generateCode_() : prev.kirishKodi;
    var chatId = it.regenerate || !prev ? "" : prev.chatId;
    return [it.ism || "", it.lavozimi || "", kirishKodi, chatId];
  });
  sheet.getRange(1, 1, 1, 4).setValues([["Ism", "Lavozimi", "KirishKodi", "ChatId"]]);
  var lastRow = sheet.getLastRow();
  if (lastRow > 1) sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).clearContent();
  if (rows.length) sheet.getRange(2, 1, rows.length, 4).setValues(rows);
}

// ---------------- Sozlamalar (kalit-qiymat) ----------------

function getSettings_() {
  var sheet = sheet_("Sozlamalar", ["Kalit", "Qiymat"]);
  var rows = sheet.getDataRange().getValues();
  var out = {};
  for (var i = 1; i < rows.length; i++) {
    if (rows[i][0]) out[rows[i][0]] = rows[i][1];
  }
  return out;
}

function setSettings_(values) {
  var sheet = sheet_("Sozlamalar", ["Kalit", "Qiymat"]);
  var current = getSettings_();
  Object.keys(values).forEach(function (k) { current[k] = values[k]; });
  var rows = Object.keys(current).map(function (k) { return [k, current[k]]; });
  var lastRow = sheet.getLastRow();
  if (lastRow > 1) sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).clearContent();
  if (rows.length) sheet.getRange(2, 1, rows.length, 2).setValues(rows);
}

// ==================== TELEGRAM BOT ====================

function telegramToken_() {
  return PropertiesService.getScriptProperties().getProperty("TELEGRAM_BOT_TOKEN");
}

function sendTelegramMessage_(chatId, text) {
  var token = telegramToken_();
  if (!token) return;
  UrlFetchApp.fetch("https://api.telegram.org/bot" + token + "/sendMessage", {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify({ chat_id: chatId, text: text }),
    muteHttpExceptions: true,
  });
}

function handleTelegramUpdate_(update) {
  var msg = update.message;
  if (!msg || !msg.text) return json_({ ok: true });
  var chatId = msg.chat.id;
  var text = msg.text.trim();

  if (text.indexOf("/start") === 0) {
    var parts = text.split(/\s+/);
    var code = parts[1] || "";
    if (!code) {
      // Odam botni ochib, kod/havolasiz shunchaki "Start" bosgan —
      // jim turmasdan, nima qilish kerakligini so'zlab tushuntiramiz.
      sendTelegramMessage_(
        chatId,
        "👋 Assalomu alaykum! Men — maktab avtobusi boti.\n\n" +
          "Agar administrator sizga havola yuborgan bo'lsa — o'sha havolani qayta bosing (Telegram avtomatik ulaydi).\n\n" +
          "Agar sizda faqat KOD bo'lsa — shu kodni shunchaki shu yerga yozib yuboring (masalan: 3F2A9B10)."
      );
      return json_({ ok: true });
    }
    var bound = bindCodeToChat_(code, chatId);
    sendTelegramMessage_(
      chatId,
      bound
        ? "✅ Muvaffaqiyatli ulandingiz! Hisobotni istalgan vaqtda /hisobot deb yozib olishingiz mumkin."
        : "Bu kod topilmadi yoki eskirgan. Administratordan yangi havola/kod so'rang."
    );
    return json_({ ok: true });
  }

  if (text === "/hisobot" || text.toLowerCase() === "hisobot") {
    sendReportForChat_(chatId);
    return json_({ ok: true });
  }

  // Foydalanuvchi havolasiz, to'g'ridan-to'g'ri kodni yuborgan bo'lishi
  // mumkin (kirish kodlari 8 ta katta harf/raqamdan iborat) — shuni
  // ulanishga urinib ko'ramiz, /start yozishni talab qilmasdan.
  if (/^[A-Z0-9]{6,10}$/.test(text)) {
    if (bindCodeToChat_(text, chatId)) {
      sendTelegramMessage_(chatId, "✅ Muvaffaqiyatli ulandingiz! Hisobotni istalgan vaqtda /hisobot deb yozib olishingiz mumkin.");
      return json_({ ok: true });
    }
  }

  sendTelegramMessage_(
    chatId,
    "Buyruqlar:\n/hisobot — joriy hisobotni olish\n\n" +
      "Agar hali ulanmagan bo'lsangiz, administrator bergan kodni shu yerga yozing."
  );
  return json_({ ok: true });
}

function bindCodeToChat_(code, chatId) {
  if (!code) return false;
  var kSheet = sheet_("Kuratorlar", ["Sinf", "Ism", "Telefon", "KirishKodi", "ChatId"]);
  var kRows = kSheet.getDataRange().getValues();
  for (var i = 1; i < kRows.length; i++) {
    if (String(kRows[i][3]) === String(code)) {
      kSheet.getRange(i + 1, 5).setValue(chatId);
      return true;
    }
  }
  var oSheet = sheet_("UmumiyHisobot", ["Ism", "Lavozimi", "KirishKodi", "ChatId"]);
  var oRows = oSheet.getDataRange().getValues();
  for (var j = 1; j < oRows.length; j++) {
    if (String(oRows[j][2]) === String(code)) {
      oSheet.getRange(j + 1, 4).setValue(chatId);
      return true;
    }
  }
  return false;
}

function sendReportForChat_(chatId) {
  var kSheet = sheet_("Kuratorlar", ["Sinf", "Ism", "Telefon", "KirishKodi", "ChatId"]);
  var kRows = kSheet.getDataRange().getValues();
  for (var i = 1; i < kRows.length; i++) {
    if (String(kRows[i][4]) === String(chatId)) {
      sendTelegramMessage_(chatId, buildClassReport_(kRows[i][0]));
      return;
    }
  }
  var oSheet = sheet_("UmumiyHisobot", ["Ism", "Lavozimi", "KirishKodi", "ChatId"]);
  var oRows = oSheet.getDataRange().getValues();
  for (var j = 1; j < oRows.length; j++) {
    if (String(oRows[j][3]) === String(chatId)) {
      sendTelegramMessage_(chatId, buildOverallReport_());
      return;
    }
  }
  sendTelegramMessage_(chatId, "Siz hali hech qanday sinf yoki hisobotga ulanmagansiz. Administratordan havola so'rang.");
}

// Yo'nalish hisoblangandan keyin (admin panelning "Kuratorlarga xabar
// yuborish" tugmasi) har bir sinfning kuratoriga o'sha sinf o'quvchilari
// uchun aniq avtobus/vaqt/haydovchi ma'lumotini yuboradi. `assignments`
// brauzerdan keladi (routing.js hisoblagan natija — bu ma'lumot Google
// Sheets'da saqlanmaydi, faqat shu xabar uchun bir martalik ishlatiladi).
function notifyKurators_(assignments) {
  var bySinf = {};
  assignments.forEach(function (a) {
    if (!a.sinf) return;
    bySinf[a.sinf] = bySinf[a.sinf] || [];
    bySinf[a.sinf].push(a);
  });
  var kSheet = sheet_("Kuratorlar", ["Sinf", "Ism", "Telefon", "KirishKodi", "ChatId"]);
  var kRows = kSheet.getDataRange().getValues();
  var sent = 0;
  for (var i = 1; i < kRows.length; i++) {
    var sinf = kRows[i][0];
    var chatId = kRows[i][4];
    if (!chatId || !bySinf[sinf] || !bySinf[sinf].length) continue;
    var dirLabel = bySinf[sinf][0].direction === "ketish" ? "Ketish (maktabdan uyga)" : "Kelish (ertalab)";
    var lines = ["🚌 " + sinf + " sinfi — avtobus yo'nalishi (" + dirLabel + ") — " + new Date().toLocaleDateString("uz-UZ"), ""];
    bySinf[sinf].forEach(function (a) {
      var busInfo = [];
      if (a.avtobusRaqam) busInfo.push("avtobus №" + a.avtobusRaqam);
      if (a.haydovchi) busInfo.push(a.haydovchi);
      lines.push(
        "• " + a.ism + " " + a.familiya +
          (a.vaqt ? " — ~" + a.vaqt : "") +
          (busInfo.length ? " (" + busInfo.join(", ") + ")" : "") +
          (a.telefon ? "\n   Tel: " + a.telefon : "")
      );
    });
    sendTelegramMessage_(chatId, lines.join("\n"));
    sent++;
  }
  return sent;
}

function buildClassReport_(sinf) {
  var settings = getSettings_();
  var showNames = settings.ShowNotYetNames !== "0"; // standart: ko'rsatiladi
  var roster = getRoster_().filter(function (r) { return r.sinf === sinf; });
  var entries = getEntries_().filter(function (e) { return e.sinf === sinf; });
  var registeredNames = {};
  entries.forEach(function (e) { registeredNames[(e.ism + " " + e.familiya).toLowerCase()] = true; });
  var notYet = roster.filter(function (r) { return !registeredNames[(r.ism + " " + r.familiya).toLowerCase()]; });
  var lines = [];
  lines.push("📋 " + sinf + " sinfi hisoboti — " + new Date().toLocaleDateString("uz-UZ"));
  lines.push("");
  lines.push("Rasmiy ro'yxatda: " + roster.length + " ta o'quvchi");
  lines.push("Ro'yxatdan o'tgan: " + entries.length + " ta");
  if (notYet.length) {
    lines.push("");
    lines.push("Hali o'tmaganlar (" + notYet.length + " ta):");
    if (showNames) notYet.forEach(function (r) { lines.push("• " + r.ism + " " + r.familiya); });
  } else if (roster.length) {
    lines.push("");
    lines.push("✅ Barcha o'quvchilar ro'yxatdan o'tgan.");
  }
  return lines.join("\n");
}

function buildOverallReport_() {
  var settings = getSettings_();
  var perClass = settings.OverallPerClass !== "0"; // standart: ko'rsatiladi
  var classes = getClasses_();
  var entries = getEntries_();
  var counts = {};
  entries.forEach(function (e) { counts[e.sinf] = (counts[e.sinf] || 0) + 1; });
  var lines = ["📊 Umumiy hisobot — " + new Date().toLocaleDateString("uz-UZ"), ""];
  var totalPlanned = 0, totalGot = 0;
  classes.forEach(function (c) {
    var got = counts[c.sinf] || 0;
    totalGot += got;
    if (c.busFoydalanuvchi) totalPlanned += c.busFoydalanuvchi;
    if (perClass) {
      var pct = c.busFoydalanuvchi ? Math.round((got / c.busFoydalanuvchi) * 100) : null;
      lines.push(c.sinf + ": " + got + (c.busFoydalanuvchi ? "/" + c.busFoydalanuvchi + " (" + pct + "%)" : ""));
    }
  });
  if (perClass) lines.push("");
  lines.push("JAMI: " + totalGot + (totalPlanned ? "/" + totalPlanned + " (" + Math.round((totalGot / totalPlanned) * 100) + "%)" : ""));
  return lines.join("\n");
}

// Bu funksiyani FAQAT BIR MARTA, token va URL'ni to'g'irlagach, Apps
// Script muharriridan qo'lda ▶ Run qiling (yuqoridagi funksiya
// tanlovidan "setupTelegramWebhook"ni tanlang).
function setupTelegramWebhook() {
  var token = telegramToken_();
  if (!token) {
    Logger.log("Avval Script Properties'ga TELEGRAM_BOT_TOKEN qo'shing.");
    return;
  }
  var WEB_APP_URL = "PASTE_YOUR_config.js_APPS_SCRIPT_URL_HERE"; // .../exec bilan tugaydigan havola
  var resp = UrlFetchApp.fetch(
    "https://api.telegram.org/bot" + token + "/setWebhook?url=" + encodeURIComponent(WEB_APP_URL),
    { muteHttpExceptions: true }
  );
  Logger.log(resp.getContentText());
}
