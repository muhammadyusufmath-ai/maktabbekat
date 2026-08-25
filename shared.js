// Umumiy yordamchi funksiyalar — index.html va admin.html ikkalasi ham ishlatadi.

function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
  });
}

function haversineKm(lat1, lng1, lat2, lng2) {
  var R = 6371;
  var dLat = ((lat2 - lat1) * Math.PI) / 180;
  var dLng = ((lng2 - lng1) * Math.PI) / 180;
  var a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function mapsLinkFor(lat, lng) {
  return "https://www.google.com/maps?q=" + lat + "," + lng;
}

// "5-A" -> [5, "A"], sinflarni tabiiy tartibda (1-A, 1-B, ..., 11-D) saralash uchun.
function classSortKey(c) {
  var m = String(c == null ? "" : c).match(/^(\d+)\s*-?\s*(.*)$/);
  if (m) return [parseInt(m[1], 10), m[2]];
  return [999, String(c || "")];
}

function compareClasses(a, b) {
  var ka = classSortKey(a),
    kb = classSortKey(b);
  if (ka[0] !== kb[0]) return ka[0] - kb[0];
  return ka[1].localeCompare(kb[1]);
}

function downloadCsv(filename, rows) {
  var csv = rows
    .map(function (r) {
      return r
        .map(function (v) {
          var s = String(v == null ? "" : v);
          return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
        })
        .join(",");
    })
    .join("\n");
  var blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  var url = URL.createObjectURL(blob);
  var a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(function () {
    URL.revokeObjectURL(url);
  }, 2000);
}

// ---- telefon raqam formatlash: "901234567" -> "90 123 45 67" ----
function formatPhoneDigits(digits) {
  digits = String(digits || "").replace(/\D/g, "").slice(0, 9);
  var parts = [digits.slice(0, 2), digits.slice(2, 5), digits.slice(5, 7), digits.slice(7, 9)].filter(Boolean);
  return parts.join(" ");
}

function phoneDigitsCount(formatted) {
  return String(formatted || "").replace(/\D/g, "").length;
}

function fullPhone(formattedDigits) {
  return "+998 " + formattedDigits;
}

// ---- backend bilan ishlash (Apps Script Web App) ----
function apiGet(type) {
  if (!APPS_SCRIPT_URL || APPS_SCRIPT_URL.indexOf("BU_YERGA") === 0) return Promise.resolve([]);
  return fetch(APPS_SCRIPT_URL + "?type=" + encodeURIComponent(type))
    .then(function (r) { return r.ok ? r.json() : []; })
    .catch(function () { return []; });
}

function apiPost(payload) {
  if (!APPS_SCRIPT_URL || APPS_SCRIPT_URL.indexOf("BU_YERGA") === 0) {
    return Promise.reject(new Error("not_configured"));
  }
  return fetch(APPS_SCRIPT_URL, { method: "POST", mode: "no-cors", body: JSON.stringify(payload) });
}

// Bittalab, foydalanuvchi bosganda chaqiriladigan teskari geokodlash
// (OpenStreetMap Nominatim, bepul). Admin panelda "Manzilni aniqlash"
// tugmasi shu funksiyani chaqiradi — avtomatik ko'p so'rov yubormaslik kerak.
function reverseGeocode(lat, lng) {
  var url =
    "https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=" +
    encodeURIComponent(lat) +
    "&lon=" +
    encodeURIComponent(lng) +
    "&accept-language=uz,ru";
  return fetch(url, { headers: { Accept: "application/json" } })
    .then(function (r) {
      if (!r.ok) throw new Error("geocode failed");
      return r.json();
    })
    .then(function (data) {
      return data && data.display_name ? data.display_name : null;
    });
}
