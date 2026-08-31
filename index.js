(function () {
  "use strict";

  var picked = null; // { lat, lng, accuracy }
  var busy = false;
  var rosterByClass = {}; // { "5-A": [{ism,familiya,label}] }
  var rosterMatch = {}; // label -> {ism,familiya}

  var prefersReduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // =========================================================
  // Hero parallax (scroll-lidagi "3D" effekt)
  // =========================================================
  (function heroParallax() {
    var hero = document.getElementById("hero");
    var road = document.getElementById("hero-road");
    var bus = document.getElementById("hero-bus");
    var scene = document.getElementById("hero-scene");
    if (!hero || prefersReduced) return;
    var ticking = false;
    function update() {
      ticking = false;
      var heroH = hero.offsetHeight || 1;
      var p = Math.max(0, Math.min(1, (window.scrollY || window.pageYOffset) / heroH));
      road.style.transform = "translateX(" + (-p * 140) + "px)";
      bus.style.transform =
        "translateX(" + p * 36 + "px) translateY(" + -p * 8 + "px) rotateX(" + p * 6 + "deg) rotateZ(" + -p * 2 + "deg)";
      scene.style.opacity = String(1 - p * 0.7);
    }
    window.addEventListener(
      "scroll",
      function () {
        if (!ticking) {
          window.requestAnimationFrame(update);
          ticking = true;
        }
      },
      { passive: true }
    );
    update();
  })();

  // =========================================================
  // Progressiv qadamlar (har biri to'ldirilgach keyingisi ochiladi)
  // =========================================================
  var stepEls = {
    sinf: document.getElementById("step-sinf"),
    name: document.getElementById("step-name"),
    phone: document.getElementById("step-phone"),
    loc: document.getElementById("step-loc"),
    submit: document.getElementById("step-submit"),
  };
  var revealed = {};

  function reveal(key) {
    if (revealed[key]) return;
    revealed[key] = true;
    var el = stepEls[key];
    el.hidden = false;
    el.classList.add("enter");
    el.scrollIntoView({ behavior: prefersReduced ? "auto" : "smooth", block: "nearest" });
  }

  // =========================================================
  // Sinf select — backendan dinamik yuklanadi
  // =========================================================
  var sinfSelect = document.getElementById("f-sinf");

  function fallbackClassList() {
    var letters = ["A", "B", "V", "G", "D"];
    var out = [];
    for (var g = 1; g <= 11; g++) for (var i = 0; i < letters.length; i++) out.push(g + "-" + letters[i]);
    return out;
  }

  function fillClassSelect(classNames) {
    sinfSelect.innerHTML = '<option value="">Tanlang</option>';
    classNames.slice().sort(compareClasses).forEach(function (c) {
      var opt = document.createElement("option");
      opt.value = c;
      opt.textContent = c;
      sinfSelect.appendChild(opt);
    });
  }

  apiGet("classes").then(function (list) {
    var names = (list || []).map(function (c) { return c.sinf; }).filter(Boolean);
    fillClassSelect(names.length ? names : fallbackClassList());
  });

  // =========================================================
  // Rasmiy o'quvchilar ro'yxati — Ism maydonida taklif (autocomplete)
  // =========================================================
  apiGet("roster").then(function (list) {
    (list || []).forEach(function (r) {
      if (!r.sinf) return;
      var label = (r.ism || "") + " — " + (r.familiya || "");
      rosterByClass[r.sinf] = rosterByClass[r.sinf] || [];
      rosterByClass[r.sinf].push(label);
      rosterMatch[label] = { ism: r.ism, familiya: r.familiya };
    });
  });

  var rosterList = document.getElementById("roster-list");
  var ismInput = document.getElementById("f-ism");
  var familiyaInput = document.getElementById("f-familiya");

  sinfSelect.addEventListener("change", function () {
    if (!sinfSelect.value) return;
    reveal("name");
    var labels = rosterByClass[sinfSelect.value] || [];
    rosterList.innerHTML = labels.map(function (l) { return '<option value="' + esc(l) + '"></option>'; }).join("");
  });

  // MUHIM: datalist orqali "Ism — Familiya" tanlanganda rosterMatch shu
  // TO'LIQ (— belgili) matnga qarab qidiradi — shuning uchun wireNameInput
  // (lotin-tozalash/bosh harf) shu listenerlardan KEYIN ulanadi, aks holda
  // "—" belgisi tozalanib, taklifni aniqlab bo'lmay qoladi.
  ismInput.addEventListener("input", function () {
    var match = rosterMatch[ismInput.value];
    if (match) {
      ismInput.value = match.ism;
      familiyaInput.value = capitalizeName(match.familiya);
    }
    checkNameDone();
  });
  familiyaInput.addEventListener("input", checkNameDone);
  wireNameInput(ismInput);
  wireNameInput(familiyaInput);

  function checkNameDone() {
    if (ismInput.value.trim() && familiyaInput.value.trim()) reveal("phone");
  }

  // =========================================================
  // Telefon: +998 prefiks, avtomatik "XX XXX XX XX" formatlash
  // =========================================================
  var phoneInput = document.getElementById("f-phone");
  attachPhoneMask(phoneInput, function (count) {
    if (count === 9) reveal("loc");
  });

  // =========================================================
  // Xarita (Leaflet CDN'dan yuklanmasa ham forma ishlashda davom etadi)
  // =========================================================
  var startCenter = SCHOOL_LOCATION || MAP_DEFAULT_CENTER;
  var map = null, marker = null, accCircle = null;

  if (typeof L === "undefined") {
    var mapEl = document.getElementById("map");
    mapEl.style.display = "flex";
    mapEl.style.alignItems = "center";
    mapEl.style.justifyContent = "center";
    mapEl.style.color = "var(--ink-faint)";
    mapEl.style.fontSize = "13px";
    mapEl.style.textAlign = "center";
    mapEl.style.padding = "12px";
    mapEl.textContent = "Xarita yuklanmadi — pastdagi GPS tugmasidan foydalaning.";
  }

  function initMapIfNeeded() {
    if (map || typeof L === "undefined") return;
    map = L.map("map").setView([startCenter.lat, startCenter.lng], 13);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);
    marker = L.marker([startCenter.lat, startCenter.lng], { draggable: true }).addTo(map);
    marker.on("dragend", function () {
      var ll = marker.getLatLng();
      setPicked(ll.lat, ll.lng, null, "Qo'lda joylashtirildi");
    });
    map.on("click", function (e) {
      setPicked(e.latlng.lat, e.latlng.lng, null, "Qo'lda joylashtirildi");
    });
  }

  function setPicked(lat, lng, accuracy, sourceLabel) {
    picked = { lat: lat, lng: lng, accuracy: accuracy || null };
    if (map) {
      map.setView([lat, lng], map.getZoom() < 15 ? 17 : map.getZoom());
      if (marker) marker.setLatLng([lat, lng]);
      if (accCircle) { map.removeLayer(accCircle); accCircle = null; }
      if (accuracy) {
        accCircle = L.circle([lat, lng], { radius: accuracy, color: "#E2A33B", fillColor: "#E2A33B", fillOpacity: 0.15, weight: 1 }).addTo(map);
      }
    }
    var readout = document.getElementById("loc-readout");
    var accNote = "";
    if (accuracy) {
      accNote = accuracy > 100
        ? ' <span style="color:var(--warning);">— aniqlik past (~' + Math.round(accuracy) + " m) — belgini suring</span>"
        : " (aniqlik ±" + Math.round(accuracy) + " m)";
    }
    readout.className = "loc-readout ok";
    readout.innerHTML =
      "✓ " + esc(sourceLabel) + ": " + lat.toFixed(6) + ", " + lng.toFixed(6) + accNote +
      ' — <a href="' + mapsLinkFor(lat, lng) + '" target="_blank" rel="noopener">xaritada ko\'rish</a>';
    reveal("submit");
  }

  function locateMe() {
    initMapIfNeeded();
    var readout = document.getElementById("loc-readout");
    if (!navigator.geolocation) {
      readout.className = "loc-readout err";
      readout.textContent = "Brauzeringiz joylashuvni aniqlay olmaydi — xaritani qo'lda bosing.";
      return;
    }
    readout.className = "loc-readout";
    readout.textContent = "Aniqlanmoqda…";
    navigator.geolocation.getCurrentPosition(
      function (pos) {
        setPicked(pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy, "GPS orqali aniqlandi");
      },
      function (err) {
        var msg = "Joylashuvni aniqlab bo'lmadi — xaritani qo'lda bosib belgilang.";
        if (err.code === 1) msg = "Ruxsat berilmadi — brauzer sozlamalaridan ruxsat bering yoki xaritani qo'lda bosing.";
        readout.className = "loc-readout err";
        readout.textContent = msg;
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
    );
  }

  document.getElementById("btn-locate").addEventListener("click", locateMe);

  // "loc" qadami ochilganda xaritani ishga tushiramiz va bir marta GPS so'raymiz
  var locStepObserver = new MutationObserver(function () {
    if (!stepEls.loc.hidden) {
      initMapIfNeeded();
      setTimeout(locateMe, 200);
      locStepObserver.disconnect();
    }
  });
  locStepObserver.observe(stepEls.loc, { attributes: true, attributeFilter: ["hidden"] });

  // =========================================================
  // Yuborish
  // =========================================================
  function showMsg(msg, isErr) {
    var box = document.getElementById("form-msg");
    box.textContent = msg;
    box.className = isErr ? "form-error" : "form-ok";
  }

  function setSubmitting(state) {
    busy = state;
    var btn = document.getElementById("btn-submit");
    btn.disabled = state;
    btn.textContent = state ? "Yuborilmoqda…" : "Ro'yxatga qo'shish";
  }

  // Duplikat (avval ro'yxatdan o'tgan) topilganda so'raladigan tasdiq —
  // brauzerning tabiiy confirm() o'rniga o'z modalimiz (dizaynga mos va
  // brauzer bloklab qo'ymaydi).
  function askReplaceConfirm(existingWhen) {
    return new Promise(function (resolve) {
      var backdrop = document.getElementById("dup-backdrop");
      var text = document.getElementById("dup-text");
      text.textContent =
        "Bu ism-familiya va sinf bo'yicha oldin ariza topildi" +
        (existingWhen ? " (" + existingWhen + ")" : "") +
        ". Agar xato ketgan bo'lsa, ma'lumotlaringizni yangilashingiz mumkin — bu avvalgi arizangizni yangisi bilan almashtiradi.";
      backdrop.hidden = false;
      function cleanup(result) {
        backdrop.hidden = true;
        cancelBtn.removeEventListener("click", onCancel);
        replaceBtn.removeEventListener("click", onReplace);
        resolve(result);
      }
      var cancelBtn = document.getElementById("dup-cancel");
      var replaceBtn = document.getElementById("dup-replace");
      function onCancel() { cleanup(false); }
      function onReplace() { cleanup(true); }
      cancelBtn.addEventListener("click", onCancel);
      replaceBtn.addEventListener("click", onReplace);
    });
  }

  document.getElementById("reg-form").addEventListener("submit", function (ev) {
    ev.preventDefault();
    if (busy) return;
    showMsg("", false);

    var ism = capitalizeName(ismInput.value);
    var familiya = capitalizeName(familiyaInput.value);
    var sinf = sinfSelect.value;
    var phoneDigits = phoneInput.value;

    if (!ism || !familiya || !sinf) {
      showMsg("Ism, familiya va sinfni to'ldiring.", true);
      return;
    }
    if (!isValidLatinName(ism) || !isValidLatinName(familiya)) {
      showMsg("Ism va familiyani faqat lotin harflarida yozing (kirilcha qabul qilinmaydi).", true);
      return;
    }
    if (phoneDigitsCount(phoneDigits) !== 9) {
      showMsg("Telefon raqamni to'liq kiriting (9 ta raqam).", true);
      return;
    }
    if (!picked) {
      showMsg("Xaritada joylashuvingizni belgilang.", true);
      return;
    }

    setSubmitting(true);
    apiGet("entries").then(function (list) {
      var dup = (list || []).filter(function (e) {
        return (
          String(e.ism || "").toLowerCase() === ism.toLowerCase() &&
          String(e.familiya || "").toLowerCase() === familiya.toLowerCase() &&
          e.sinf === sinf
        );
      })[0];

      function finish(promise) {
        promise
          .then(function () {
            setSubmitting(false);
            document.getElementById("reg-form").reset();
            showMsg("", false);
            showToast("✓ Siz ro'yxatdan o'tdingiz!");
          })
          .catch(function () {
            setSubmitting(false);
            showMsg("Yuborishda xatolik — internetni tekshirib qayta urinib ko'ring.", true);
          });
      }

      var telefon = fullPhone(phoneDigits);

      if (dup) {
        askReplaceConfirm(dup.ts ? new Date(dup.ts).toLocaleDateString("uz-UZ") : null).then(function (wantsReplace) {
          if (!wantsReplace) {
            setSubmitting(false);
            return;
          }
          finish(apiUpdateEntry(dup.id, { ism: ism, familiya: familiya, sinf: sinf, telefon: telefon, lat: picked.lat, lng: picked.lng }));
        });
        return;
      }

      finish(apiPost({ type: "entry", ism: ism, familiya: familiya, sinf: sinf, telefon: telefon, lat: picked.lat, lng: picked.lng }));
    });
  });
})();
