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
- **Yo'nalishlar** — avval maktab joylashuvini xaritadan tanlang (bosing,
  belgini suring yoki GPS tugmasidan foydalaning), keyin tasodifan
  o'zgarib ketmasligi uchun "Maxkamlash"ni bosing. So'ng avtobuslar
  sonini, bekatgacha maksimal yurish masofasini, kerak bo'lsa maktabgacha
  piyoda radiusini va qaysi hafta kuni uchun hisoblanayotganini kiriting,
  **Yo'nalishlarni hisoblash**ni bosing. Natijada: piyoda boradigan
  bolalar ro'yxati (agar radius kiritilgan bo'lsa), sig'may qolgan
  bolalar uchun qo'lda avtobus tanlash imkoniyati (agar bo'lsa), va har
  bir avtobus uchun xaritada chizilgan yo'l (🚩 — boshlash nuqtasi, har
  bir o'quvchi uyi ham nuqta bilan ko'rinadi va bosilsa ma'lumoti
  chiqadi, bekat belgisini surib chiqish nuqtasini to'g'irlash mumkin),
  km, daqiqa, bola soni, chiqish vaqti va har bir bolaning taxminiy olib
  ketilish vaqti, pastida esa shu avtobusdagi o'quvchilar ro'yxati (ustiga
  bosilsa to'liq ma'lumot) va PDF yuklab olish tugmasi.

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
bilan ishlamasligi yoki sekin javob berishi mumkin (8 soniyadan ko'p
kutmaydi) — shunday holatda tizim avtomatik ravishda to'g'ri chiziq
asosidagi taxminga o'tadi va buni natijada "(taxminiy)" deb belgilaydi.

Har bir bolaning "taxminiy olib ketilish vaqti" ham shu haydash
vaqtlaridan hisoblanadi (avtobus har bekatda ~1 daqiqa to'xtaydi deb
faraz qilinadi) — bu ham aniq jadval emas, bir necha daqiqalik farq
bo'lishi mumkin, shuning uchun ota-onalarga "taxminan shu vaqtda tayyor
bo'ling" deb aytish tavsiya etiladi.

Agar bir bekat hech qaysi avtobusning bo'sh joyiga sig'masa, tizim uni
majburan tiqishtirmaydi — "Sig'may qolgan bolalar" deb ko'rsatadi va
qaysi avtobusga qo'shishni siz hal qilasiz (masalan sig'imi kattaroq
yoki yo'nalishi yaqinroq avtobusni tanlab). Bu tanlov saqlanib qoladi va
keyingi hisoblashlarda ham o'sha avtobusga biriktirilaveradi.

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

### Ro'yxatdan o'tgan bolalar ma'lumoti xavfsizmi?

Ha. Ma'lumotlar (ism, familiya, sinf, telefon, joylashuv) **Google
Sheets**'dagi **Royxat** varag'ida saqlanadi — bu sayt kodidan (GitHub'dagi
`index.html`, `style.css`, `*.js` fayllar) butunlay alohida joy. Saytga
yangi funksiya qo'shish, dizaynni o'zgartirish yoki fayllarni GitHub'da
qayta yuklash — bularning hech biri "Royxat" varag'idagi mavjud qatorlarga
tegmaydi, chunki kod u yerga faqat: (1) yangi bola ro'yxatdan o'tganda bitta
qator **qo'shadi**, (2) admin panelda "o'chirish" bosilganda faqat o'sha
bitta qatorni **o'chiradi**. Boshqa hech qanday amal bu varaqni tozalamaydi
yoki qayta yozmaydi.

Faqat bitta holatda ehtiyot bo'lish kerak: agar kelajakda "Royxat"
varag'ining **ustunlar tuzilishi** o'zgartirilsa (masalan yangi ustun
qo'shilsa — avvalgi versiyadan yangilashda bir marta shunday bo'lgan edi,
"MIGRATSIYA" bo'limiga qarang). Oddiy dizayn/funksiya yangilanishlarida bu
kerak bo'lmaydi. Har ehtimolga qarshi, katta yangilanishdan oldin Google
Sheets faylini **File → Make a copy** (yoki **File → Download → Microsoft
Excel**) orqali zaxira nusxalab qo'yish tavsiya etiladi — bir necha soniya
ketadi, lekin butunlay xotirjam bo'lasiz.

---

## YANGI IMKONIYATLAR (so'nggi yangilanish)

- **Ro'yxat**: jami son endi "Sinflar"da kiritgan aniq sondan hisoblanadi;
  har bir sinf uchun necha foiz bola avtobusdan foydalanishi/foydalanmasligi
  raqamlarda ko'rinadi; har bir yozuvni ✎ orqali tahrirlash (shu jumladan
  yotoqxona jadvali) mumkin; CSV yuklab olishda sinf(lar) bo'yicha filtr bor.
- **Ro'yxatdan o'tish**: yuborilgach "Siz ro'yxatdan o'tdingiz" bildirishnomasi
  chiqadi; bir xil ism-familiya-sinf topilsa, "avval ro'yxatdan o'tgansiz"
  deb ogohlantiradi va xohlasa ma'lumotni yangilash (avvalgisini
  almashtirish) imkonini beradi; mobil telefonda fokusda ekran
  "yaqinlashib qolish" xatosi tuzatildi.
- **Sinflar**: endi "Jami o'quvchi" va "Avtobusdan foydalanadi" alohida
  kiritiladi.
- **O'quvchilar ro'yxati**: sinf endi dropdown orqali tanlanadi (xato
  yozilishning oldini oladi).
- **Haydovchilar**: telefon +998 formatida, raqamli klaviatura bilan
  kiritiladi.
- **Yo'nalishlar**: maktab joylashuvini endi xaritadan tanlash (bosish/
  surish) mumkin, tasodifiy o'zgarishning oldini olish uchun "Maxkamlash"
  tugmasi qo'shildi; natijadagi xaritada har bir o'quvchining uy nuqtasi
  ham ko'rinadi (bosilsa ma'lumoti chiqadi); bekat belgisini surib chiqish
  nuqtasini qo'lda to'g'irlash mumkin; yo'nalish boshlanish nuqtasi 🚩
  bilan alohida ko'rsatiladi; har bir bola oldiga taxminan soat nechida
  kelishi ko'rsatiladi; maktabga juda yaqin (siz belgilagan piyoda radiusi
  ichidagi) bolalar avtobusdan chiqarilib, alohida "piyoda tavsiya
  etiladi" deb ko'rsatiladi; avtobus sig'imidan oshib ketgan bolalar endi
  majburan tiqishtirilmaydi — "Sig'may qolgan bolalar" bo'limida
  ko'rsatilib, qaysi avtobusga qo'shishni siz tanlaysiz; yotoqxonada
  yashovchi o'quvchilar uchun har biriga alohida "qaysi kunlari
  avtobusdan foydalanadi" jadvali (Ro'yxat bo'limida ✎ orqali) va
  hisoblashda "qaysi kun uchun" tanlovi qo'shildi; har bir avtobus uchun
  xarita rasmi + haydovchi ma'lumotlari + o'quvchilar ro'yxati (vaqti
  bilan) PDF qilib yuklab olinadi.

Telefon raqamlarning Google Sheets'da "+998..." FORMULA xatosi ko'rsatishi
ham tuzatildi (endi ustun doim oddiy matn formatida saqlanadi). Agar
avvalgi jadvalingizda allaqachon shunday xato ko'rinayotgan eski
qatorlar bo'lsa: **Telefon** ustunini tanlab, **Format → Number → Plain
text** qiling, so'ng xato ko'ringan katakchalarni qo'lda qayta kiriting
(masalan boshiga bitta bo'sh belgi qo'yib, o'chirib qaytadan saqlang) —
bu faqat ko'rinishni tuzatadi, hech qanday boshqa ma'lumotga tegmaydi.

## MIGRATSIYA (avvalgi versiyadan yangilayotganlar uchun)

**Bu safar hech narsani o'chirish shart emas — barcha o'zgarishlar faqat
yangi ustunlar qo'shish orqali amalga oshirildi.** "Royxat" varag'idagi
mavjud yozuvlaringiz (ism, familiya, sinf, telefon, joylashuv) butunlay
saqlanib qoladi; kod ularga yangi ustunlar (TurarJoy, Kunlar va h.k.)
qo'shib qo'yadi, xolos — o'zingiz "Sinflar" bo'limidagi "Avtobusdan
foydalanadi" sonlarini to'ldirmaguningizcha, "Ro'yxat" bo'limidagi umumiy
foiz eski "taxminan 270–300" ko'rinishida qolaveradi, keyin avtomatik
aniq songa o'tadi.

Yangilash uchun:

1. Apps Script kodini yangilash: Apps Script muharririda eski kodni
   o'chirib, yangi `google-apps-script.gs` matnini joylashtiring, **Save**.
2. **Deploy → Manage deployments** ga o'ting, mavjud deploymentning
   qalam (edit) belgisini bosing, **Version: New version** ni tanlang,
   **Deploy** ni bosing. *(Muhim: "New deployment" emas, "Manage
   deployments" orqali yangilang — aks holda havola o'zgarib, `config.js`
   dagi eski havola ishlamay qoladi.)*
3. GitHub repozitoriyingizga yangilangan fayllarni qayta yuklang
   (**Add file → Upload files** — bir xil nomdagi fayllar avtomatik
   almashtiriladi). `config.js` faylingizni ustidan yozib yubormang —
   undagi `APPS_SCRIPT_URL` va `ADMIN_KEY` qiymatlaringizni saqlab qoling
   (agar diqqatsizlik bilan almashtirib qo'ysangiz, "saqlanmadi —
   internetni tekshiring" xatosi qaytadan chiqadi).
4. Ehtiyot chorasi sifatida (majburiy emas): yangilashdan oldin Google
   Sheets faylini **File → Make a copy** qilib zaxira nusxa oling.

---

## Keyingi qadam

Endi hammasi bir joyda: ro'yxat, sinflar, haydovchilar va yo'nalishlar.
Yo'nalishlarni hisoblab bo'lgach, natijalarni skrinshot yoki CSV qilib
menga yuborsangiz, birga ko'rib chiqib sozlashimiz mumkin — masalan
avtobus sonini yoki maksimal yurish masofasini o'zgartirib, natijani
solishtirish.
