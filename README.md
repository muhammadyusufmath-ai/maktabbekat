# Bekat — maktab avtobusi uchun ro'yxatdan o'tish va yo'nalish tizimi

Bu papkada tayyor mini sayt bor: ota-onalar/o'quvchilar `index.html` orqali
sinf, ism-familiya (taklif bilan), telefon va joylashuvni (xaritadan)
yuboradi; siz esa `admin.html` orqali sinflarni, rasmiy o'quvchilar
ro'yxatini, haydovchilarni boshqarasiz va avtobus yo'nalishlarini avtomatik
hisoblab, xaritada ko'rasiz.

Ma'lumotlar bepul Google Sheets jadvalida saqlanadi (GitHub Pages statik
sayt bo'lgani uchun o'z bazasi yo'q — Google Sheets shu vazifani bajaradi).
Yo'nalishlar OpenStreetMap'ning bepul OSRM xizmati orqali haqiqiy yo'l
masofasi va vaqtini hisoblaydi.

> **Avvalgi versiyadan yangilayapsizmi?** "MIGRATSIYA" bo'limiga o'ting —
> jadval tuzilishi o'zgargan.

---

## 1-QADAM: Google Sheets + Apps Script (ma'lumot ombori)

1. [sheets.google.com](https://sheets.google.com) da yangi bo'sh jadval oching.
2. Yuqoridagi menyudan **Extensions → Apps Script** ni bosing.
3. Ochilgan muharrirdagi barcha namunaviy kodni o'chirib, shu papkadagi
   **`google-apps-script.gs`** faylining butun matnini joylashtiring.
4. Yuqorida **Save** (disket belgisi) ni bosing.
5. **Deploy → New deployment** ni bosing.
   - Charxpalak belgisi yonida **Select type → Web app** ni tanlang.
   - **Execute as:** `Me` (o'zingiz).
   - **Who has access:** `Anyone` (albatta shuni tanlang, aks holda forma ishlamaydi).
   - **Deploy** ni bosing, Google ruxsat so'raydi — o'z hisobingiz bilan tasdiqlang.
6. Chiqqan **Web app URL** ni nusxalab oling — u `.../exec` bilan tugaydi.

Bu havolani `config.js` ga qo'yasiz. Jadvalda quyidagi varaqlar (sheet)
avtomatik yaratiladi: **Royxat** (ro'yxatdan o'tganlar), **Sinflar**,
**OquvchilarRoyxati**, **Haydovchilar**, **Maktab**.

---

## 2-QADAM: Saytni sozlash

`config.js` faylini oching va:

- `APPS_SCRIPT_URL` ni 1-qadamda olgan `.../exec` havolasiga almashtiring.
- `ADMIN_KEY` ni o'zingiz xohlagan parolga almashtiring (oddiy to'siq —
  `admin.html` havolasini faqat ishonchli odamlarga bering).
- Kerak bo'lsa `DEFAULT_MAX_WALK_M` (bekatgacha maksimal yurish, metr) va
  `DEFAULT_BUS_CAPACITY` (avtobusga standart sig'im) qiymatlarini
  moslang — bularni keyin admin panelidan ham o'zgartirish mumkin.
- Sinflar va rasmiy o'quvchilar ro'yxati endi bu faylda emas — ular admin
  panelining **Sinflar** va **O'quvchilar ro'yxati** bo'limlarida
  to'ldiriladi.

---

## 3-QADAM: GitHub'ga yuklash va Pages yoqish

1. [github.com](https://github.com) da yangi bo'sh repozitoriy yarating.
2. Shu papkadagi fayllarni (`index.html`, `admin.html`, `style.css`,
   `config.js`, `shared.js`, `routing.js`, `index.js`, `admin.js`)
   **Add file → Upload files** orqali yuklang.
3. **Settings → Pages** ga o'ting, **Branch** da `main` ni tanlab **Save**.
4. Bir necha daqiqadan so'ng sayt havolasi tayyor bo'ladi.

Admin panel manzili — asosiy havola oxiriga `admin.html` qo'shilgan holda.

---

## Admin panelidan foydalanish

- **Ro'yxat** — umumiy son, har bir sinf uchun "reja"ga nisbatan to'lish
  foizi, to'liq ro'yxat (telefon, joylashuv, manzil), noto'g'ri yozuvni
  o'chirish, CSV eksport.
- **Sinflar** — dropdown'da chiqadigan sinflar va har biriga "reja"
  (kutilayotgan o'quvchilar soni) — qo'shish/tahrirlash/o'chirish/saqlash.
- **O'quvchilar ro'yxati** — rasmiy ism-familiyalar (bitta-bitta yoki
  "Sinf, Ism, Familiya" formatida ko'p qatorli tez qo'shish orqali).
  Ro'yxatdan o'tish formasida shu ro'yxat asosida taklif (autocomplete)
  chiqadi.
- **Haydovchilar** — har bir avtobus uchun raqami, haydovchi ismi,
  telefoni, rangi (xarita chizig'i shu rangda chiziladi) va sig'imi.
- **Yo'nalishlar** — avval maktab joylashuvini belgilang (u yerda
  turib GPS tugmasini bosing), so'ng avtobuslar sonini va maksimal
  yurish masofasini kiriting va **Yo'nalishlarni hisoblash**ni bosing.
  Natijada: har bir avtobus uchun xaritada chizilgan yo'l, km, daqiqa,
  bola soni va tavsiya etilgan chiqish vaqti (08:20 ga yetib borish
  hisobidan), pastida esa shu avtobusdagi o'quvchilar ro'yxati — ustiga
  bosilsa to'liq ma'lumot (sinf, telefon, joylashuv) ochiladi.

### Yo'nalish hisoblash qanday ishlaydi (va cheklovlari)

1. Bir-biriga yaqin turadigan bolalar (siz kiritgan maksimal metr
   ichida) bitta "bekat"ga birlashtiriladi — imkon qadar ko'proq bola
   bitta bekatga yig'iladi.
2. Bekatlar avtobuslar soniga va har birining sig'imiga qarab
   taqsimlanadi.
3. Har bir avtobus uchun bekatlar qisqa yo'l bo'yicha tartiblanadi va
   OpenStreetMap'ning bepul OSRM xizmatidan haqiqiy haydash masofasi,
   vaqti va yo'l chizig'i so'raladi.

Bu **amaliy taxmin** — matematik jihatdan "eng optimal" yechim emas,
lekin odatda yaxshi natija beradi. Uy bilan bekat orasidagi "yurish"
masofasi to'g'ri chiziq asosida taxmin qilinadi (haqiqiy piyoda yo'lidan
biroz qisqaroq bo'lishi mumkin). OSRM'ning bepul serveri vaqti-vaqti
bilan ishlamasligi mumkin — shunday holatda tizim avtomatik ravishda
to'g'ri chiziq asosidagi taxminga o'tadi va buni natijada "(taxminiy)"
deb belgilaydi.

---

## Diqqat qiling

- GPS faqat `https://` (GitHub Pages) yoki `http://localhost` orqali
  ochilgan saytda ishlaydi — faylni to'g'ridan-to'g'ri kompyuterda
  ochsangiz ishlamasligi mumkin.
- Kompyuterda joylashuv Wi-Fi orqali taxminan aniqlanadi va aniqlik past
  bo'lishi mumkin (forma bunga alohida ogohlantirish va aniqlik doirasini
  xaritada ko'rsatadi) — telefondan ochilganda GPS ancha aniqroq ishlaydi.
- Admin panel kaliti (`ADMIN_KEY`) va "Administrator" bo'limi jiddiy
  himoya emas — havolalarni faqat ishonchli odamlarga bering.

---

## MIGRATSIYA (avvalgi versiyadan yangilayotganlar uchun)

Bu versiyada "Royxat" jadvalining tuzilishi o'zgardi: yangi **ID** va
**Telefon** ustunlari qo'shildi. Agar avval sinov uchun bir nechta yozuv
kiritgan bo'lsangiz:

1. Google Sheets'da **Royxat** varag'ini (tab) o'ng tugma bilan bosib
   **Delete** qiling (sinov yozuvlarini yo'qotasiz, lekin eng oddiy yo'l).
   Keyingi ro'yxatdan o'tish avtomatik to'g'ri tuzilmada qayta yaratadi.
   *(Haqiqiy ro'yxat yig'ilib bo'lgan bo'lsa, buning o'rniga qo'lda **A**
   va **F** ustunlarini kiritib, sarlavhalarni **ID** va **Telefon** deb
   o'zgartiring.)*
2. Apps Script kodini yangilash uchun: Apps Script muharririda eski kodni
   o'chirib, yangi `google-apps-script.gs` matnini joylashtiring, **Save**.
3. **Deploy → Manage deployments** ga o'ting, mavjud deploymentning
   qalam (edit) belgisini bosing, **Version: New version** ni tanlang,
   **Deploy** ni bosing. *(Muhim: "New deployment" emas, "Manage
   deployments" orqali yangilang — aks holda havola o'zgarib, `config.js`
   dagi eski havola ishlamay qoladi.)*
4. GitHub repozitoriyingizga yangilangan fayllarni qayta yuklang
   (**Add file → Upload files** — bir xil nomdagi fayllar avtomatik
   almashtiriladi).

---

## Keyingi qadam

Endi hammasi bir joyda: ro'yxat, sinflar, haydovchilar va yo'nalishlar.
Yo'nalishlarni hisoblab bo'lgach, natijalarni skrinshot yoki CSV qilib
menga yuborsangiz, birga ko'rib chiqib sozlashimiz mumkin — masalan
avtobus sonini yoki maksimal yurish masofasini o'zgartirib, natijani
solishtirish.
