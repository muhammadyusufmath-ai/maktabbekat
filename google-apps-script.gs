// Bu kodni Google Sheets ichidagi Apps Script muharririga to'liq nusxalab
// qo'ying (qadamlar README.md faylida). Bir nechta "resurs" bilan ishlaydi:
// ro'yxatdan o'tganlar, sinflar ro'yxati, rasmiy o'quvchilar ro'yxati
// (taklif/autocomplete uchun) va haydovchilar ro'yxati. Har biri o'z
// varag'ida (sheet) saqlanadi — birinchi chaqiriqda avtomatik yaratiladi.

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
  } else if (type === "deleteEntry") {
    deleteEntry_(body.id);
  } else if (type === "classes") {
    replaceSheet_("Sinflar", ["Sinf", "Reja"], (body.items || []).map(function (c) {
      return [c.sinf, c.reja != null ? c.reja : ""];
    }));
  } else if (type === "roster") {
    replaceSheet_("OquvchilarRoyxati", ["Sinf", "Ism", "Familiya"], (body.items || []).map(function (r) {
      return [r.sinf, r.ism, r.familiya];
    }));
  } else if (type === "drivers") {
    replaceSheet_("Haydovchilar", ["Raqam", "Haydovchi", "Telefon", "Rang", "Sigim"], (body.items || []).map(function (d) {
      return [d.raqam, d.haydovchi, d.telefon, d.rang, d.sigim != null ? d.sigim : ""];
    }));
  } else if (type === "school") {
    setSchool_(body.lat, body.lng);
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

function replaceSheet_(name, header, rows) {
  var sheet = sheet_(name, header);
  var lastRow = sheet.getLastRow();
  if (lastRow > 1) sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).clearContent();
  if (rows.length) sheet.getRange(2, 1, rows.length, header.length).setValues(rows);
}

// ---------------- Royxat (ro'yxatdan o'tganlar) ----------------

function addEntry_(data) {
  var sheet = sheet_("Royxat", ["ID", "Vaqt", "Ism", "Familiya", "Sinf", "Telefon", "Lat", "Lng"]);
  var id = Utilities.getUuid();
  sheet.appendRow([
    id,
    new Date(),
    data.ism || "",
    data.familiya || "",
    data.sinf || "",
    data.telefon || "",
    data.lat != null ? data.lat : "",
    data.lng != null ? data.lng : "",
  ]);
  return id;
}

function deleteEntry_(id) {
  var sheet = sheet_("Royxat", ["ID", "Vaqt", "Ism", "Familiya", "Sinf", "Telefon", "Lat", "Lng"]);
  var values = sheet.getDataRange().getValues();
  for (var i = 1; i < values.length; i++) {
    if (values[i][0] === id) {
      sheet.deleteRow(i + 1);
      return;
    }
  }
}

function getEntries_() {
  var sheet = sheet_("Royxat", ["ID", "Vaqt", "Ism", "Familiya", "Sinf", "Telefon", "Lat", "Lng"]);
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
      telefon: r[5],
      lat: r[6] === "" ? null : Number(r[6]),
      lng: r[7] === "" ? null : Number(r[7]),
    });
  }
  return out;
}

// ---------------- Sinflar ----------------

function getClasses_() {
  var sheet = sheet_("Sinflar", ["Sinf", "Reja"]);
  var rows = sheet.getDataRange().getValues();
  var out = [];
  for (var i = 1; i < rows.length; i++) {
    if (!rows[i][0]) continue;
    out.push({ sinf: rows[i][0], reja: rows[i][1] === "" ? null : Number(rows[i][1]) });
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

// ---------------- Maktab joylashuvi ----------------

function getSchool_() {
  var sheet = sheet_("Maktab", ["Lat", "Lng"]);
  var row = sheet.getRange(2, 1, 1, 2).getValues()[0];
  if (row[0] === "" || row[0] == null) return null;
  return { lat: Number(row[0]), lng: Number(row[1]) };
}

function setSchool_(lat, lng) {
  var sheet = sheet_("Maktab", ["Lat", "Lng"]);
  sheet.getRange(2, 1, 1, 2).setValues([[lat, lng]]);
}

function getDrivers_() {
  var sheet = sheet_("Haydovchilar", ["Raqam", "Haydovchi", "Telefon", "Rang", "Sigim"]);
  var rows = sheet.getDataRange().getValues();
  var out = [];
  for (var i = 1; i < rows.length; i++) {
    if (!rows[i][0]) continue;
    out.push({
      raqam: rows[i][0],
      haydovchi: rows[i][1],
      telefon: rows[i][2],
      rang: rows[i][3],
      sigim: rows[i][4] === "" ? null : Number(rows[i][4]),
    });
  }
  return out;
}
