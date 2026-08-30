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

// Istalgan telefon input'iga +998 formatlash va raqamli klaviaturani ulaydi.
// onComplete(digitsCount) — har bir o'zgarishda chaqiriladi (9 ta raqam
// to'lgan-to'lmaganini tekshirish uchun).
function attachPhoneMask(inputEl, onComplete) {
  if (!inputEl) return;
  inputEl.setAttribute("inputmode", "numeric");
  inputEl.setAttribute("type", "tel");
  inputEl.setAttribute("autocomplete", "off");
  inputEl.addEventListener("input", function () {
    var caretWasAtEnd = inputEl.selectionStart === inputEl.value.length;
    inputEl.value = formatPhoneDigits(inputEl.value);
    if (caretWasAtEnd) {
      var len = inputEl.value.length;
      inputEl.setSelectionRange(len, len);
    }
    if (onComplete) onComplete(phoneDigitsCount(inputEl.value));
  });
}

// "+998 90 123 45 67" yoki "90 123 45 67" kabi to'liq/formatlangan
// qiymatdan faqat 9 ta mahalliy raqamni ("XX XXX XX XX") ajratib oladi —
// haydovchi telefonini tahrirlashda mavjud qiymatni inputga qo'yish uchun.
function localPhoneDigitsFromFull(full) {
  var digits = String(full || "").replace(/\D/g, "");
  if (digits.indexOf("998") === 0) digits = digits.slice(3);
  return formatPhoneDigits(digits);
}

// ---- Yotoqxona jadvali uchun hafta kunlari ----
var WEEKDAYS_UZ = [
  { code: "Dush", label: "Dushanba" },
  { code: "Sesh", label: "Seshanba" },
  { code: "Chor", label: "Chorshanba" },
  { code: "Pay", label: "Payshanba" },
  { code: "Juma", label: "Juma" },
  { code: "Shan", label: "Shanba" },
  { code: "Yak", label: "Yakshanba" },
];

// Sahifaning pastida bir necha soniyaga chiqib, o'zi yo'qoladigan
// bildirishnoma ("toast"). Ishlashi uchun sahifada <div id="toast-wrap">
// bo'lishi kerak.
function showToast(message, ms) {
  var wrap = document.getElementById("toast-wrap");
  if (!wrap) { return; }
  var el = document.createElement("div");
  el.className = "toast";
  el.textContent = message;
  wrap.appendChild(el);
  requestAnimationFrame(function () { el.classList.add("show"); });
  setTimeout(function () {
    el.classList.remove("show");
    setTimeout(function () { el.remove(); }, 300);
  }, ms || 4000);
}

// Har qanday "Saqlash" tugmasi uchun bir xil naycha: bosilganda o'chib
// zagruzka ko'rsatadi, natijaga qarab yashil "Saqlandi ✓" yoki qizil xato
// matnini msgEl ichiga yozadi, oxirida tugmani asl holatiga qaytaradi.
function withSaving(btn, promiseFn, msgEl, successText) {
  var origText = btn.textContent;
  btn.disabled = true;
  btn.textContent = "Saqlanmoqda…";
  if (msgEl) { msgEl.textContent = ""; msgEl.className = ""; }
  return promiseFn()
    .then(function (r) {
      if (msgEl) { msgEl.textContent = successText || "Saqlandi ✓"; msgEl.className = "form-ok"; }
      showToast(successText || "Saqlandi ✓");
      return r;
    })
    .catch(function (err) {
      if (msgEl) { msgEl.textContent = "Saqlanmadi — internetni tekshiring."; msgEl.className = "form-error"; }
      throw err;
    })
    .finally(function () {
      btn.disabled = false;
      btn.textContent = origText;
    });
}

function todayWeekdayCode() {
  // JS: 0=Yakshanba..6=Shanba
  var map = ["Yak", "Dush", "Sesh", "Chor", "Pay", "Juma", "Shan"];
  return map[new Date().getDay()];
}

// ---- Google Maps (ixtiyoriy) ----
// GOOGLE_MAPS_API_KEY bo'sh bo'lsa, bu funksiyalar chaqirilmaydi va sayt
// xavfsiz tarzda bepul OpenStreetMap/Leaflet'da davom etadi.
function useGoogleMaps() {
  return typeof GOOGLE_MAPS_API_KEY !== "undefined" && !!GOOGLE_MAPS_API_KEY;
}

var _googleMapsLoadPromise = null;
function loadGoogleMaps() {
  if (typeof google !== "undefined" && google.maps) return Promise.resolve(google.maps);
  if (_googleMapsLoadPromise) return _googleMapsLoadPromise;
  _googleMapsLoadPromise = new Promise(function (resolve, reject) {
    var cbName = "__bekatGMapsReady_" + Date.now();
    window[cbName] = function () {
      delete window[cbName];
      resolve(window.google.maps);
    };
    var script = document.createElement("script");
    script.src = "https://maps.googleapis.com/maps/api/js?key=" + encodeURIComponent(GOOGLE_MAPS_API_KEY) + "&callback=" + cbName;
    script.async = true;
    script.onerror = function () {
      _googleMapsLoadPromise = null;
      reject(new Error("google_maps_load_failed"));
    };
    document.head.appendChild(script);
  });
  return _googleMapsLoadPromise;
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

function apiUpdateEntry(id, fields) {
  return apiPost({ type: "updateEntry", id: id, fields: fields });
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
