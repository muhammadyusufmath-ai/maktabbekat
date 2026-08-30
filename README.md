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

## 4-QADAM: Telegram bot ulash (ixtiyoriy, lekin tavsiya etiladi)

Bot orqali har bir sinfning kuratori/ustozi o'z sinfi bo'yicha hisobotni,
maktab rahbariyati esa umumiy hisobotni to'g'ridan-to'g'ri Telegram'da
oladi — saytga kirishning hojati yo'q.

1. Telegram'da **@BotFather** ni toping, `/newbot` buyrug'ini yuboring.
2. Botga ism bering (masalan "Bekat maktab avtobusi"), so'ng foydalanuvchi
   nomini so'raydi — oxiri `bot` bilan tugashi shart (masalan
   `Bekat123Bot`). BotFather sizga bir qatorli **token** beradi
   (masalan `123456789:AAExampleTokenDoNotShare`) — buni hech kimga,
   hech qayerga (GitHub'ga ham) qo'ymang, parol kabi saqlang.
3. Google Sheets'dagi **Apps Script** muharririga qayting (1-QADAM'dagi
   joy). Chap tomondagi charxpalak (⚙️ Project Settings) belgisini bosing,
   pastda **Script Properties** bo'limini toping, **Add script property**
   ni bosing: nomi `TELEGRAM_BOT_TOKEN`, qiymati — token'ingiz. **Save**.
   *(Token shu yerda, faqat siz ko'radigan joyda qoladi — saytning ochiq
   kodiga hech qachon chiqmaydi.)*
4. Qaytadan **Editor** ga o'ting, kod ichidan `setupTelegramWebhook`
   funksiyasini toping. Uning ichidagi `WEB_APP_URL` qatoriga 1-QADAM'da
   olgan `.../exec` havolangizni qo'ying, **Save**.
5. Yuqoridagi funksiyalar ro'yxatidan `setupTelegramWebhook` ni tanlab,
   ▶️ **Run** tugmasini bosing (birinchi marta ruxsat so'raydi — o'z
   hisobingiz bilan tasdiqlang). Bu — bir martalik amal, botni saytingizga
   "ulaydi". Muvaffaqiyatli bo'lsa, jurnalda (Execution log) xatolik
   chiqmaydi.
6. Admin panelning **Sozlamalar** bo'limida, "Bot havolasi" maydoniga
   `https://t.me/Bot123Bot` (o'z bot nomingiz bilan) kabi ommaviy havolani
   yozib saqlang — bu havola kuratorlarga/rahbariyatga ko'rsatiladi (token
   emas, shunchaki botning ochiq manzili).

Shundan keyin:

- **Kuratorlar** bo'limida har bir sinfga ustoz qo'shib saqlaganingizda,
  jadvalda o'sha ustoz uchun "havolani ko'rish" tugmasi chiqadi — shu
  havolani (kod bilan, masalan `https://t.me/Bot123Bot?start=ABC123`)
  ustozga yuborasiz, u botda "Start" bosishi bilan ulanadi va shundan
  keyin botga `/hisobot` yozib, faqat **o'ziga biriktirilgan sinf**
  bo'yicha (kim ro'yxatdan o'tgan, kim o'tmagan) hisobot oladi.
- **Sozlamalar → Umumiy hisobot qabul qiluvchilar**ga xuddi shunday
  qo'shilgan odam (masalan direktor) bot orqali barcha sinflar bo'yicha
  umumiy statistikani oladi.
- Agar kimningdir kirishini to'xtatmoqchi bo'lsangiz — uni shu ro'yxatdan
  o'chirib qayta saqlang; u botdan hisobot ololmay qoladi (kirishKodi va
  ulanish ma'lumoti o'sha odam bilan birga o'chadi).
- Agar odam ismi/telefonini o'zgartirib qayta saqlasangiz, oldin berilgan
  kod/ulanish **yo'qolmaydi** — faqat "qayta bog'lash" kerak bo'lganda
  (masalan kod kimgadir noto'g'ri yuborilgan bo'lsa), shu odam qatoriga
  qo'lda `regenerate` so'rovi yuborish kerak bo'ladi (hozircha buning uchun
  admin panelida alohida tugma yo'q — kerak bo'lsa ayting, qo'shib beraman).

---

## YANGI IMKONIYATLAR (2-bosqich yangilanish)

- **Kelish/Ketish alohida jadval**: har bir o'quvchi uchun ertalab
  (maktabga) va kunduzi (uydan) avtobusdan foydalanish kunlari endi
  **alohida-alohida** belgilanadi (Ro'yxat bo'limida ✎ orqali, ikkita
  mustaqil hafta kunlari ro'yxati). Oddiy kundalik o'quvchi uchun
  standart holat — ikkalasida ham "har kuni".
- **Saqlash tugmalari**: barcha "Saqlash" tugmalari endi bosilganda
  o'chib, "Saqlanmoqda…" ko'rsatadi, muvaffaqiyatli bo'lsa yashil
  bildirishnoma (toast) va "Saqlandi ✓" chiqadi — internet uzilib qolsa,
  aniq xato xabari beriladi.
- **Telefon xatosi belgisi**: agar Google Sheets biror qatorda "+998..."
  raqamini eski xato (FORMULA/#N/A) holida saqlab qolgan bo'lsa, Ro'yxat
  jadvalida o'sha qator "⚠ buzilgan" deb alohida ko'rsatiladi — shu
  ota-onadan raqamni qayta so'rab, ✎ orqali to'g'irlash kerak bo'ladi.
- **Tez qo'shish olib tashlandi**: O'quvchilar ro'yxati bo'limidagi
  ko'p qatorli "tez qo'shish" matn maydoni olib tashlandi — endi faqat
  pastdagi bitta-bitta qo'shish qoladi (chalkashlikning oldini olish
  uchun).
- **Bekatni qo'lda belgilash**: Yo'nalishlar bo'limida yangi karta —
  xaritadan istalgan nuqtani bosib yangi "bekat" yaratasiz, so'ng qaysi
  o'quvchilar (ism bo'yicha qidirish bilan) shu bekatdan chiqishini
  belgilaysiz — ularning joylashuvi shu nuqtaga o'rnatiladi.
- **Taqsimotni qulflash**: Hisoblangan natijada "🔒 Ushbu taqsimotni
  qulflash" tugmasi — bosilsa, hozir tayinlangan har bir bola o'z
  avtobusiga "mahkamlanadi". Keyinroq 1-2 ta yangi bola ro'yxatdan o'tsa,
  avvalgi (ehtimol qo'lda to'g'rilangan) taqsimot **buzilmaydi** — yangi
  bolalar bo'sh joyga qo'shiladi, xolos.
- **Ketish yo'nalishi**: Hisoblashda endi "Kelish (ertalab)" yoki "Ketish
  (maktabdan uyga)" tanlanadi. Ketishda avtobus maktabdan chiqib, eng
  yaqin bekatdan boshlab, eng uzog'ida tugatadi (qaytish hisoblanmaydi) —
  chiqish vaqtini o'zingiz kiritasiz.
- **Km chegarasi**: Bitta avtobus uchun (ixtiyoriy) maksimal km
  kiritish mumkin — oshib ketsa, natijada va PDF'da ⚠ ogohlantirish
  bilan ko'rsatiladi (bepul yo'l xizmati "shu km dan oshmasin" deb
  qat'iy cheklay olmaydi, shuning uchun bu qat'iy emas, balki
  ogohlantiruvchi belgi).
- **Ko'cha nomlari**: Har bir avtobus qaysi ko'chalardan o'tishi endi
  natija sahifasida va PDF'da matn shaklida ko'rsatiladi (OSRM xizmati
  ishlagan holatda; taxminiy hisobda ko'cha nomi mavjud emasligi ochiq
  aytiladi).
- **Xaritadagi bekat raqamlari**: Har bir bekat endi xaritada doim
  ko'rinadigan raqam bilan belgilanadi (avval faqat bosilganda ko'rinardi).
- **PDF v2**: Barcha PDF hisobotlar endi tartibli jadval (avtomatik sahifa
  o'tkazish bilan) ko'rinishida, oldingi qo'lda joylashtirilgan matn
  o'rniga. Yangi **"Umumiy statistika PDF"** (Sozlamalar bo'limida) —
  maktab rahbariyati uchun: jami o'quvchilar, avtobusdan foydalanadiganlar
  foizi, har bir sinf bo'yicha alohida, xohlasangiz telefon/manzil
  ustunlari bilan to'liq ro'yxat.
- **Kuratorlar va Sozlamalar bo'limlari** — yuqoridagi "Telegram bot"
  qismiga qarang.
- **Google Maps — 1-bosqich (Yo'nalishlar xaritasi)**: `config.js`da
  `GOOGLE_MAPS_API_KEY` kiritilgan bo'lsa, admin panelning **Yo'nalishlar**
  bo'limidagi natija xaritasi endi Google Maps orqali chiziladi (avtobus
  chiziqlari, bekatlar, o'quvchi nuqtalari, surish, bosilganda ma'lumot —
  bari xuddi avvalgidek ishlaydi, faqat xarita provayderi almashgan).
  Yuqori chap burchakda **Traffic / Transit / Bicycling** qatlamlarini
  yoqib-o'chirish uchun checkboxlar bor; xarita turi (yo'l/sputnik/relyef)
  va Street View (odamcha belgisi) — bular Google xaritasining o'zida
  standart tugmalar sifatida chiqadi. Boshqa ikkita xarita (Ro'yxatdan
  o'tish formasidagi va admin paneldagi "Maktab joylashuvi") hozircha
  **hali ham bepul OpenStreetMap'da** ishlayapti — bu ikkovi keyingi
  bosqichlarda, siz tasdiqlagach, xuddi shu tarzda o'tkaziladi.

  **Ochiq aytishim kerak bo'lgan uchta narsa:**
  1. Ekranga siz yuborgan skrinshotdagi "Wildfires" va "Air Quality"
     tugmalari — bular Google'ning o'z tayyor ilovasidagi maxsus
     qatlamlar, oddiy saytga o'rnatiladigan xarita kodida ("Maps
     JavaScript API") mavjud emas — shuning uchun ularni qo'sha olmadim.
     Xuddi shunday, "Measure" (masofa o'lchash) tugmasi ham standart
     tayyor tugma sifatida yo'q edi.
  2. Men ishlayotgan muhitda umuman internetga chiqish cheklangan (hatto
     Google'ning o'z serveriga ham ulana olmadim) — shuning uchun bu
     xaritani haqiqiy brauzerda, haqiqiy kalitingiz bilan hali **ko'zim
     bilan ko'rib sinamadim**. Kodni juda ehtiyotkorlik bilan yozdim va
     kalit bo'lmaganda hech narsa o'zgarmasligini (hozirgi Leaflet yo'lini)
     to'liq testdan o'tkazdim, lekin GitHub'ga yuklab, saytni ochganingizda
     "Yo'nalishlar" bo'limini albatta birinchi bo'lib tekshiring — agar
     xarita chiqmasa yoki nototo'g'ri ishlasa, skrinshot tashlang, darrov
     tuzataman (kalitni bo'sh qoldirsangiz, bir zumda avvalgi bepul
     xaritaga qaytadi — hech narsa buzilmaydi).
  3. Har bir avtobus uchun PDF yuklab olishda xarita rasmi endi Google
     xaritasidan olinadi — bu ba'zan (texnik sabablarga ko'ra) bo'sh/oq
     rasm sifatida chiqishi mumkin. Agar shunday bo'lsa, xavotir olmang —
     PDF'ning jadval qismi (o'quvchilar, vaqtlar, ko'chalar) baribir
     to'liq chiqadi, faqat xarita rasmi bo'lmaydi; shuni ham sinab ko'rib
     xabar bering.

  Sinab ko'rib, hammasi joyida bo'lsa — Ro'yxatdan o'tish formasi va
  "Maktab joylashuvi" xaritalarini ham xuddi shu tarzda Google Maps'ga
  o'tkazamiz.

**Muhim: bu safar ham hech qanday eski ma'lumot o'chirilmadi yoki qayta
yozilmadi.** Yangi maydonlar (`KelishKunlari`, `KetishKunlari`) va yangi
varaqlar (`Kuratorlar`, `UmumiyHisobot`, `Sozlamalar`) barchasi **qo'shimcha**
— "Royxat" varag'idagi mavjud qatorlaringizga (ism, familiya, telefon,
joylashuv va h.k.) hech kim tegmaydi. Apps Script kodini yangilash uchun
"MIGRATSIYA" bo'limidagi 1-4 qadamlarni takrorlang (eski kodni o'chirib,
yangi `google-apps-script.gs` matnini joylashtirish, **Manage deployments**
orqali yangi versiya deploy qilish).

---

## Keyingi qadam

Endi hammasi bir joyda: ro'yxat, sinflar, haydovchilar, kuratorlar,
Telegram bot va yo'nalishlar (kelish ham, ketish ham). Google Maps
kalitingizni olib bo'lgach yoki botni ulashda biror joyda qiynalsangiz,
ayting — birga ko'rib chiqamiz.
