// ==================== SOZLAMALAR ====================
// Shu faylni saytni GitHub'ga yuklashdan oldin o'zingizga moslang.

// 1) Google Apps Script "Web App" havolasi.
//    README.md dagi "1-QADAM: Google Sheets + Apps Script" bo'limidagi
//    yo'riqnoma bo'yicha oling (.../exec bilan tugaydigan havola).
const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzkp9YZsglUMdL7dWlrQeFWVN-sRFnXQQpDWZK9j7uvC91OrSueEMIabwPkL1tJQynFcQ/exec";

// 2) Administrator paneliga kirish kaliti. O'zingiz xohlagan so'zni yozing
//    va faqat administratorlarga ayting. Bu kuchli himoya emas — shuning
//    uchun admin.html havolasini faqat ishonchli odamlarga bering.
const ADMIN_KEY = "maktab2026";

// 3) Sinflar va rasmiy o'quvchilar ro'yxati endi statik emas — ular admin
//    panelidagi "Sinflar" va "O'quvchilar ro'yxati" bo'limlarida
//    to'ldiriladi va Google Sheets'da saqlanadi.

// 4) Maktab joylashuvi. Bu joylashuv bo'lmasa, ro'yxatdan o'tish forma
//    ishlayveradi, lekin "Yo'nalishlar" bo'limi ishlamaydi (marshrutlar
//    maktabdan boshlanadi/tugaydi). Admin panelning "Yo'nalishlar"
//    bo'limidan GPS orqali yoki qo'lda belgilashingiz mumkin — bu yerga
//    yozib qo'ysangiz ham bo'ladi, masalan: { lat: 41.2995, lng: 69.2401 }
const SCHOOL_LOCATION = null;

// Xarita boshlang'ich markazi (GPS ruxsat berilmasa yoki SCHOOL_LOCATION
// bo'sh bo'lsa ishlatiladi).
const MAP_DEFAULT_CENTER = { lat: 41.311081, lng: 69.240562 };

// Kutilayotgan o'quvchilar soni oralig'i (umumiy progress-bar uchun).
const TARGET_MIN = 270;
const TARGET_MAX = 300;

// Bitta bekatdan maktabgacha "yurish" masofasi taxminini haqiqiy
// ko'cha uzunligiga yaqinlashtirish uchun ko'paytiruvchi (to'g'ri chiziq
// masofa har doim ko'chadagidan qisqaroq bo'ladi). Admin panelidan ham
// sozlash mumkin.
const WALK_CIRCUITY_FACTOR = 1.3;

// Yo'nalishlar bo'limidagi boshlang'ich standart qiymatlar — admin
// panelidan istalgan vaqtda o'zgartirish mumkin.
const DEFAULT_MAX_WALK_M = 500;
const DEFAULT_BUS_CAPACITY = 50;
const GOOGLE_MAPS_API_KEY = "AIzaSyAAjzBqMK98oosYV-TkeB58QDKs9rhR2J0";
