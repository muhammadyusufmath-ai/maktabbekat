// Bu kodni Google Sheets ichidagi Apps Script muharririga to'liq nusxalab
// qo'ying (qadamlar README.md faylida). Bir nechta "resurs" bilan ishlaydi:
// ro'yxatdan o'tganlar, sinflar ro'yxati, rasmiy o'quvchilar ro'yxati
// (taklif/autocomplete uchun), haydovchilar ro'yxati va maktab joylashuvi.
// Har biri o'z varag'ida (sheet) saqlanadi — birinchi chaqiriqda avtomatik
// yaratiladi.
//
// MUHIM: "Royxat" varag'i — ro'yxatdan o'tgan bolalarning haqiqiy
// ma'lumotlari shu yerda. Bu kod hech qachon shu varaqni to'liq
// tozalamaydi/qayta yozmaydi — faqat bitta qator qo'shadi (addEntry_),
// bitta qatorni o'chiradi (deleteEntry_, admin bosganda) yoki bitta
// qatorning ba'zi ustunlarini yangilaydi (updateEntry_). Sinflar/
// OquvchilarRoyxati/Haydovchilar esa admin sozlamalari bo'lgani uchun
// "saqlash" bosilganda to'liq almashtiriladi (replaceSheet_) — bu odatiy
// va xavfsiz, chunki ular ro'yxatdan o'tish ma'lumoti emas.

var ROYXAT_HEADER = ["ID", "Vaqt", "Ism", "Familiya", "Sinf", "Telefon", "Lat", "Lng", "TurarJoy", "Kunlar", "BekatLat", "BekatLng", "AvtobusOverride"];

function doGet(e) {
  var type = (e.parameter && e.parameter.type) || "entries";
  var out;
  if (type === "classes") out = getClasses_();
  else if (type === "roster") out = getRoster_();
  else if (type === "drivers") out = getDrivers_();
  else if (type === "school") out = getSchool_();
  else out = getEntries_();
  return json_(out);
}

function doPost(e) {
  var body = JSON.parse(e.postData.contents);
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
      [3] // Telefon ustuni — matn sifatida saqlanadi, "+998..." FORMULA xatosi bermasin
    );
  } else if (type === "school") {
    setSchool_(body);
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
// textColumns — 1-based ustun raqamlari ro'yxati, shu ustunlar har doim
// oddiy matn (Plain text) formatida saqlanadi (masalan telefon raqami
// "+998..." Sheets tomonidan formula deb noto'g'ri talqin qilinmasligi
// uchun).
function replaceSheet_(name, header, rows, textColumns) {
  var sheet = sheet_(name, header);
  // Header har doim yangi tuzilmaga moslashtiriladi (faqat sarlavha
  // qatori — ma'lumotlarga tegilmaydi).
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
  // Telefon ustuni (F) doim oddiy matn bo'lsin — "+998..." qiymat Sheets
  // tomonidan formula/raqam deb noto'g'ri o'qib, xato ko'rsatmasligi uchun.
  sheet.getRange(2, 6, Math.max(sheet.getMaxRows() - 1, 1), 1).setNumberFormat("@");
  return sheet;
}

function addEntry_(data) {
  var sheet = royxatSheet_();
  var id = Utilities.getUuid();
  sheet.appendRow([
    id,
    new Date(),
    data.ism || "",
    data.familiya || "",
    data.sinf || "",
    String(data.telefon || ""),
    data.lat != null ? data.lat : "",
    data.lng != null ? data.lng : "",
    "kundalik",
    "",
    "",
    "",
    "",
  ]);
  return id;
}

// Bitta yozuvning faqat berilgan maydonlarini yangilaydi (boshqalariga
// tegmaydi). Ikki holatda ishlatiladi: (1) ota-ona "xato ketgan edi"
// deb o'z arizasini to'g'rilaganda — ism/familiya/sinf/telefon/lat/lng
// yangilanadi; (2) admin TurarJoy/Kunlar/Bekat/Avtobus override
// maydonlarini tahrirlaganda.
var ENTRY_FIELD_COL = {
  ism: 3, familiya: 4, sinf: 5, telefon: 6, lat: 7, lng: 8,
  turarJoy: 9, kunlar: 10, bekatLat: 11, bekatLng: 12, avtobusOverride: 13,
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

function getEntries_() {
  var sheet = royxatSheet_();
  var rows = sheet.getDataRange().getValues();
  var out = [];
  for (var i = 1; i < rows.length; i++) {
    var r = rows[i];
    if (!r[2] && !r[3]) continue;
    out.push({
      id: r[0],
      ts: r[1] instanceof Date ? r[1].toISOString() : String(r[1]),
      ism: r[2],
      familiya: r[3],
      sinf: r[4],
      telefon: r[5] === "" ? "" : String(r[5]),
      lat: r[6] === "" ? null : Number(r[6]),
      lng: r[7] === "" ? null : Number(r[7]),
      turarJoy: r[8] || "kundalik",
      kunlar: r[9] ? String(r[9]).split(",").map(function (s) { return s.trim(); }).filter(Boolean) : [],
      bekatLat: r[10] === "" || r[10] == null ? null : Number(r[10]),
      bekatLng: r[11] === "" || r[11] == null ? null : Number(r[11]),
      avtobusOverride: r[12] === "" || r[12] == null ? null : r[12],
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
    // Eski formatda (faqat Sinf+Reja bo'lgan) 3-ustun bo'lmasligi mumkin —
    // shu holatda "Reja" qiymatini AftobusFoydalanuvchi sifatida ham olamiz.
    var busU = rows[i][2] === "" || rows[i][2] == null ? jami : Number(rows[i][2]);
    out.push({ sinf: rows[i][0], jami: jami, busFoydalanuvchi: busU, reja: busU });
  }
  return out;
}

// ---------------- OquvchilarRoyxati (rasmiy ro'yxat, autocomplete uchun) ----------------

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
      raqam: rows[i][0],
      haydovchi: rows[i][1],
      telefon: rows[i][2] === "" ? "" : String(rows[i][2]),
      rang: rows[i][3],
      sigim: rows[i][4] === "" ? null : Number(rows[i][4]),
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
