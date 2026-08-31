(function () {
  "use strict";

  var ARRIVAL_TIME = "08:20";
  var routeMap = null;
  var routeLayer = null;
  var schoolMap = null;
  var schoolMarker = null;
  var lastRouteResult = null;
  var lastDrivers = [];
  var lastEntries = [];
  var lastClasses = [];
  var schoolLocked = false;

  // ================= Kirish (kalit) =================
  function tryEnter() {
    var val = document.getElementById("key-input").value;
    if (val === ADMIN_KEY) {
      try { sessionStorage.setItem("bekatAdminOk", "1"); } catch (e) {}
      document.getElementById("gate").style.display = "none";
      document.getElementById("panel").style.display = "";
      initPanel();
    } else {
      document.getElementById("gate-msg").textContent = "Kalit noto'g'ri.";
    }
  }
  document.getElementById("btn-enter").addEventListener("click", tryEnter);
  document.getElementById("key-input").addEventListener("keydown", function (e) {
    if (e.key === "Enter") tryEnter();
  });
  try {
    if (sessionStorage.getItem("bekatAdminOk") === "1") {
      document.getElementById("gate").style.display = "none";
      document.getElementById("panel").style.display = "";
      initPanel();
    }
  } catch (e) {}

  var panelInited = false;
  function initPanel() {
    if (panelInited) return;
    panelInited = true;
    setupTabs();
    setupDaySelect();
    setupDirectionToggle();
    loadRoyxat();
  }

  // ================= Tabs =================
  function setupTabs() {
    document.querySelectorAll(".tab-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        document.querySelectorAll(".tab-btn").forEach(function (b) { b.classList.remove("active"); });
        document.querySelectorAll(".tab-panel").forEach(function (p) { p.hidden = true; });
        btn.classList.add("active");
        var panel = document.getElementById("tab-" + btn.dataset.tab);
        panel.hidden = false;
        if (btn.dataset.tab === "sinflar") loadClasses();
        else if (btn.dataset.tab === "roster") loadRoster();
        else if (btn.dataset.tab === "haydovchilar") loadDrivers();
        else if (btn.dataset.tab === "kuratorlar") loadKurators();
        else if (btn.dataset.tab === "sozlamalar") loadSozlamalar();
        else if (btn.dataset.tab === "yonalishlar") { loadSchoolStatus(); refreshManualBekatEntries(); setTimeout(function () { initSchoolMapIfNeeded(); initManualBekatMapIfNeeded(); }, 50); }
        else if (btn.dataset.tab === "royxat") loadRoyxat();
      });
    });
  }

  function setupDaySelect() {
    var sel = document.getElementById("rt-day");
    sel.innerHTML = WEEKDAYS_UZ.map(function (d) { return '<option value="' + d.code + '">' + d.label + "</option>"; }).join("");
    sel.value = todayWeekdayCode();
  }

  function setupDirectionToggle() {
    var radios = document.querySelectorAll('input[name="rt-direction"]');
    function sync() {
      var checked = document.querySelector('input[name="rt-direction"]:checked');
      document.getElementById("rt-ketish-vaqti-wrap").hidden = !checked || checked.value !== "ketish";
    }
    radios.forEach(function (r) { r.addEventListener("change", sync); });
    sync();
  }

  // ================= RO'YXAT =================
  function loadRoyxat() {
    document.getElementById("rows").innerHTML = '<tr><td colspan="9" class="empty">Yuklanmoqda…</td></tr>';
    Promise.all([apiGet("entries"), apiGet("classes")]).then(function (res) {
      lastEntries = res[0] || [];
      lastClasses = res[1] || [];
      renderRoyxat(lastEntries, lastClasses);
      fillCsvClassFilter(lastClasses, lastEntries);
    });
  }
  document.getElementById("btn-refresh").addEventListener("click", loadRoyxat);

  function renderRoyxat(entries, classes) {
    var n = entries.length;
    document.getElementById("stat-count").textContent = n;

    var hasPlan = classes.some(function (c) { return c.busFoydalanuvchi != null; });
    var totalPlanned = classes.reduce(function (s, c) { return s + (c.busFoydalanuvchi || 0); }, 0);
    if (hasPlan && totalPlanned > 0) {
      document.getElementById("stat-target").textContent = totalPlanned + " ta bola avtobusdan foydalanishi rejalashtirilgan";
      document.getElementById("stat-bar").style.width = Math.max(0, Math.min(100, Math.round((n / totalPlanned) * 100))) + "%";
    } else {
      document.getElementById("stat-target").textContent = "taxminan " + TARGET_MIN + "–" + TARGET_MAX + " nafardan (Sinflar bo'limida aniq son kiriting)";
      document.getElementById("stat-bar").style.width = Math.max(0, Math.min(100, Math.round((n / TARGET_MIN) * 100))) + "%";
    }

    var counts = {};
    entries.forEach(function (e) { counts[e.sinf] = (counts[e.sinf] || 0) + 1; });
    var classKeys = classes.length ? classes.map(function (c) { return c.sinf; }) : Object.keys(counts);
    classKeys.sort(compareClasses);
    var fillRows = classKeys.map(function (sinf) {
      var got = counts[sinf] || 0;
      var cls = classes.filter(function (c) { return c.sinf === sinf; })[0] || {};
      var jami = cls.jami != null ? cls.jami : null;
      var busU = cls.busFoydalanuvchi != null ? cls.busFoydalanuvchi : null;
      var pct = busU ? Math.min(100, Math.round((got / busU) * 100)) : null;
      var usageNote = "—";
      if (jami != null && busU != null && jami > 0) {
        var usePct = Math.round((busU / jami) * 100);
        usageNote = busU + " ta (" + usePct + "%) foydalanadi · " + (jami - busU) + " ta (" + (100 - usePct) + "%) foydalanmaydi";
      }
      return (
        "<tr><td>" + esc(sinf) + "</td><td>" + (jami != null ? jami : "—") + "</td><td>" + (busU != null ? busU : "—") + "</td><td>" + got + "</td>" +
        "<td>" + (pct != null
          ? '<span class="mini-progress"><i style="width:' + pct + '%"></i></span>' + pct + "%"
          : "—") +
        "</td><td class=\"hint\" style=\"margin:0;\">" + usageNote + "</td></tr>"
      );
    });
    document.getElementById("class-fill-rows").innerHTML =
      fillRows.join("") || '<tr><td colspan="6" class="empty">Sinflar hali kiritilmagan</td></tr>';

    var filterSel = document.getElementById("csv-class-filter");
    var chosenClasses = filterSel ? Array.prototype.map.call(filterSel.selectedOptions || [], function (o) { return o.value; }) : [];
    var tableEntries = chosenClasses.length ? entries.filter(function (e) { return chosenClasses.indexOf(e.sinf) !== -1; }) : entries;

    var sorted = tableEntries.slice().sort(function (a, b) {
      var c = compareClasses(a.sinf, b.sinf);
      if (c !== 0) return c;
      return String(a.familiya || "").localeCompare(String(b.familiya || ""));
    });
    if (!sorted.length) {
      document.getElementById("rows").innerHTML = '<tr><td colspan="9" class="empty">' + (chosenClasses.length ? "Tanlangan sinf(lar)da yozuv yo'q" : "Hozircha ro'yxat bo'sh") + '</td></tr>';
      return;
    }
    var html = [];
    var lastClass = null;
    var idx = 0;
    sorted.forEach(function (e) {
      if (e.sinf !== lastClass) {
        lastClass = e.sinf;
        html.push('<tr class="group-row"><td colspan="9">' + esc(e.sinf) + " — " + (counts[e.sinf] || 0) + " ta</td></tr>");
      }
      idx++;
      var loc = e.lat != null
        ? '<a class="loc-ok" href="' + mapsLinkFor(e.lat, e.lng) + '" target="_blank" rel="noopener">✓ xaritada</a>'
        : "—";
      var when = e.ts ? new Date(e.ts).toLocaleString("uz-UZ") : "—";
      var rowId = "addr-" + idx;
      var kelishAll = (e.kelishKunlari || []).length >= 5;
      var ketishAll = (e.ketishKunlari || []).length >= 5;
      var schedNote = kelishAll && ketishAll ? "Har kuni" : "Maxsus jadval";
      var telefonBroken = /error|#N\/A|NaN/i.test(String(e.telefon || ""));
      var telefonCell = telefonBroken
        ? '<span style="color:var(--danger);" title="Bu raqam Sheets tomonidan buzilgan — ota-onadan qayta so\'rang">⚠ buzilgan</span>'
        : esc(e.telefon || "—");
      html.push(
        "<tr>" +
          '<td class="num">' + idx + "</td>" +
          "<td>" + esc(e.ism) + "</td>" +
          "<td>" + esc(e.familiya) + "</td>" +
          "<td>" + telefonCell + "</td>" +
          "<td>" + esc(schedNote) + "</td>" +
          "<td>" + loc + "</td>" +
          '<td id="' + rowId + '">' +
            (e.lat != null
              ? '<button type="button" class="addr-btn" data-lat="' + e.lat + '" data-lng="' + e.lng + '" data-target="' + rowId + '">Manzilni aniqlash</button>'
              : "—") +
          "</td>" +
          '<td class="num">' + esc(when) + "</td>" +
          '<td style="white-space:nowrap;"><button type="button" class="tbl-del" data-edit="' + esc(e.id) + '" title="Tahrirlash">✎</button>' +
          '<button type="button" class="tbl-del" data-id="' + esc(e.id) + '" title="O\'chirish">✕</button></td>' +
        "</tr>"
      );
    });
    document.getElementById("rows").innerHTML = html.join("");

    document.querySelectorAll(".addr-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var lat = parseFloat(btn.getAttribute("data-lat"));
        var lng = parseFloat(btn.getAttribute("data-lng"));
        var target = document.getElementById(btn.getAttribute("data-target"));
        btn.disabled = true;
        btn.textContent = "Aniqlanmoqda…";
        reverseGeocode(lat, lng)
          .then(function (addr) { target.textContent = addr || "Topilmadi"; })
          .catch(function () { target.innerHTML = '<button type="button" class="addr-btn">Qayta urinish</button>'; });
      });
    });
    document.querySelectorAll("#rows .tbl-del[data-id]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        if (!window.confirm("Bu yozuvni o'chirishni tasdiqlaysizmi?")) return;
        apiPost({ type: "deleteEntry", id: btn.getAttribute("data-id") })
          .then(function () { setTimeout(loadRoyxat, 300); })
          .catch(function () { alert("O'chirilmadi, qayta urinib ko'ring."); });
      });
    });
    document.querySelectorAll("#rows .tbl-del[data-edit]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var id = btn.getAttribute("data-edit");
        var entry = entries.filter(function (e) { return e.id === id; })[0];
        if (entry) openEntryEditModal(entry);
      });
    });
  }

  // ---- Sinf filtri (jadval ko'rinishi + CSV eksport ikkalasi uchun ham) ----
  function fillCsvClassFilter(classes, entries) {
    var sel = document.getElementById("csv-class-filter");
    var prevSelected = Array.prototype.map.call(sel.selectedOptions || [], function (o) { return o.value; });
    var names = classes.length ? classes.map(function (c) { return c.sinf; }) : Array.from(new Set(entries.map(function (e) { return e.sinf; })));
    names.sort(compareClasses);
    sel.innerHTML = names.map(function (n) { return '<option value="' + esc(n) + '">' + esc(n) + "</option>"; }).join("");
    Array.prototype.forEach.call(sel.options, function (o) {
      if (prevSelected.indexOf(o.value) !== -1) o.selected = true;
    });
  }
  document.getElementById("csv-class-filter").addEventListener("change", function () {
    renderRoyxat(lastEntries, lastClasses);
  });

  document.getElementById("btn-csv").addEventListener("click", function () {
    var sel = document.getElementById("csv-class-filter");
    var chosen = Array.prototype.map.call(sel.selectedOptions || [], function (o) { return o.value; });
    apiGet("entries").then(function (entries) {
      var filtered = chosen.length ? entries.filter(function (e) { return chosen.indexOf(e.sinf) !== -1; }) : entries;
      var sorted = filtered.slice().sort(function (a, b) {
        var c = compareClasses(a.sinf, b.sinf);
        if (c !== 0) return c;
        return String(a.familiya || "").localeCompare(String(b.familiya || ""));
      });
      var rows = [["#", "Ism", "Familiya", "Sinf", "Telefon", "Kelish kunlari", "Ketish kunlari", "Lat", "Lng", "Xarita havolasi", "Vaqt"]];
      sorted.forEach(function (e, i) {
        rows.push([
          i + 1, e.ism, e.familiya, e.sinf, e.telefon || "", (e.kelishKunlari || []).join(" "), (e.ketishKunlari || []).join(" "),
          e.lat != null ? e.lat : "", e.lng != null ? e.lng : "",
          e.lat != null ? mapsLinkFor(e.lat, e.lng) : "", e.ts || "",
        ]);
      });
      var fname = chosen.length === 1 ? "bekat-royxati-" + chosen[0] + ".csv" : "bekat-royxati.csv";
      downloadCsv(fname, rows);
    });
  });

  // ---- Yozuvni tahrirlash modali ----
  function openEntryEditModal(entry) {
    var body = document.getElementById("entry-edit-body");
    var classOptions = (lastClasses.length ? lastClasses.map(function (c) { return c.sinf; }) : [entry.sinf]).slice();
    if (classOptions.indexOf(entry.sinf) === -1) classOptions.push(entry.sinf);
    classOptions.sort(compareClasses);
    function dayCheckboxes(cssClass, selectedDays) {
      return WEEKDAYS_UZ.map(function (d) {
        var checked = (selectedDays || []).indexOf(d.code) !== -1 ? " checked" : "";
        return '<label style="display:flex;align-items:center;gap:5px;font-weight:400;margin:0;flex:none;width:auto;"><input type="checkbox" class="' + cssClass + '" value="' + d.code + '"' + checked + ' style="width:auto;"> ' + d.label + "</label>";
      }).join("");
    }
    body.innerHTML =
      "<h3>Ma'lumotni tahrirlash</h3>" +
      '<label>Ism</label><input type="text" id="ee-ism" value="' + esc(entry.ism) + '">' +
      '<label>Familiya</label><input type="text" id="ee-familiya" value="' + esc(entry.familiya) + '">' +
      '<label>Sinf</label><select id="ee-sinf">' + classOptions.map(function (c) { return '<option value="' + esc(c) + '"' + (c === entry.sinf ? " selected" : "") + ">" + esc(c) + "</option>"; }).join("") + "</select>" +
      '<label>Telefon</label><div class="phone-row"><span class="phone-prefix">+998</span><input type="tel" id="ee-phone" value="' + esc(localPhoneDigitsFromFull(entry.telefon)) + '"></div>' +
      '<label>Kelish kunlari (ertalab avtobusdan foydalanadi)</label>' +
      '<div class="row2" style="flex-wrap:wrap;">' + dayCheckboxes("ee-kelish-day", entry.kelishKunlari) + "</div>" +
      '<label style="margin-top:16px;">Ketish kunlari (maktabdan uyga avtobusdan foydalanadi)</label>' +
      '<div class="row2" style="flex-wrap:wrap;">' + dayCheckboxes("ee-ketish-day", entry.ketishKunlari) + "</div>" +
      '<p class="hint" style="margin-top:8px;">Oddiy kundalik o\'quvchi uchun ikkalasida ham barcha kunlarni belgilangan qoldiring. Faqat ma\'lum kunlari (masalan yotoqxonada yashovchi) foydalanadigan o\'quvchilar uchun kerakli kunlarnigina belgilang.</p>' +
      '<button type="button" class="btn-primary" id="ee-save">Saqlash</button>' +
      '<div class="form-error" id="ee-msg"></div>';

    attachPhoneMask(document.getElementById("ee-phone"), function () {});
    wireNameInput(document.getElementById("ee-ism"));
    wireNameInput(document.getElementById("ee-familiya"));

    document.getElementById("ee-save").addEventListener("click", function () {
      var btn = document.getElementById("ee-save");
      var msg = document.getElementById("ee-msg");
      var kelishKunlari = Array.prototype.filter.call(body.querySelectorAll(".ee-kelish-day"), function (c) { return c.checked; }).map(function (c) { return c.value; });
      var ketishKunlari = Array.prototype.filter.call(body.querySelectorAll(".ee-ketish-day"), function (c) { return c.checked; }).map(function (c) { return c.value; });
      var fields = {
        ism: capitalizeName(document.getElementById("ee-ism").value),
        familiya: capitalizeName(document.getElementById("ee-familiya").value),
        sinf: document.getElementById("ee-sinf").value,
        telefon: fullPhone(document.getElementById("ee-phone").value),
        kelishKunlari: kelishKunlari.join(","),
        ketishKunlari: ketishKunlari.join(","),
      };
      withSaving(btn, function () { return apiUpdateEntry(entry.id, fields); }, msg)
        .then(function () {
          setTimeout(function () {
            document.getElementById("entry-edit-backdrop").hidden = true;
            loadRoyxat();
          }, 400);
        })
        .catch(function () {});
    });

    document.getElementById("entry-edit-backdrop").hidden = false;
  }
  document.getElementById("entry-edit-close").addEventListener("click", function () {
    document.getElementById("entry-edit-backdrop").hidden = true;
  });
  document.getElementById("entry-edit-backdrop").addEventListener("click", function (ev) {
    if (ev.target.id === "entry-edit-backdrop") ev.target.hidden = true;
  });

  // ================= SINFLAR =================
  function classRowHtml(sinf, jami, busFoydalanuvchi) {
    return (
      '<tr><td><input class="tbl-input cls-sinf" value="' + esc(sinf || "") + '" placeholder="masalan 5-A"></td>' +
      '<td><input class="tbl-input cls-jami" type="text" inputmode="numeric" value="' + esc(jami == null ? "" : jami) + '" placeholder="32"></td>' +
      '<td><input class="tbl-input cls-busu" type="text" inputmode="numeric" value="' + esc(busFoydalanuvchi == null ? "" : busFoydalanuvchi) + '" placeholder="24"></td>' +
      '<td><button type="button" class="tbl-del">✕</button></td></tr>'
    );
  }
  function loadClasses() {
    apiGet("classes").then(function (list) {
      lastClasses = list || [];
      var tbody = document.getElementById("classes-rows");
      tbody.innerHTML = lastClasses.map(function (c) { return classRowHtml(c.sinf, c.jami, c.busFoydalanuvchi); }).join("") || classRowHtml("", "", "");
    });
  }
  document.getElementById("btn-add-class").addEventListener("click", function () {
    document.getElementById("classes-rows").insertAdjacentHTML("beforeend", classRowHtml("", "", ""));
  });
  document.getElementById("classes-rows").addEventListener("click", function (ev) {
    if (ev.target.classList.contains("tbl-del")) ev.target.closest("tr").remove();
  });
  document.getElementById("btn-save-classes").addEventListener("click", function () {
    var items = Array.prototype.map
      .call(document.querySelectorAll("#classes-rows tr"), function (tr) {
        return {
          sinf: tr.querySelector(".cls-sinf").value.trim(),
          jami: tr.querySelector(".cls-jami").value.trim() || null,
          busFoydalanuvchi: tr.querySelector(".cls-busu").value.trim() || null,
        };
      })
      .filter(function (c) { return c.sinf; });
    var btn = document.getElementById("btn-save-classes");
    var msg = document.getElementById("classes-msg");
    withSaving(btn, function () { return apiPost({ type: "classes", items: items }); }, msg).catch(function () {});
  });

  // ================= ROSTER =================
  function rosterRowHtml(sinf, ism, familiya) {
    var classOptions = (lastClasses.length ? lastClasses.map(function (c) { return c.sinf; }) : []).slice();
    if (sinf && classOptions.indexOf(sinf) === -1) classOptions.push(sinf);
    classOptions.sort(compareClasses);
    var opts = '<option value="">Tanlang</option>' + classOptions.map(function (c) { return '<option value="' + esc(c) + '"' + (c === sinf ? " selected" : "") + ">" + esc(c) + "</option>"; }).join("");
    return (
      '<tr><td><select class="tbl-input ro-sinf">' + opts + "</select></td>" +
      '<td><input class="tbl-input ro-ism" value="' + esc(ism || "") + '"></td>' +
      '<td><input class="tbl-input ro-familiya" value="' + esc(familiya || "") + '"></td>' +
      '<td><button type="button" class="tbl-del">✕</button></td></tr>'
    );
  }
  function wireRosterNameInputs() {
    document.querySelectorAll("#roster-rows .ro-ism, #roster-rows .ro-familiya").forEach(function (inp) {
      if (inp._nameWired) return;
      inp._nameWired = true;
      wireNameInput(inp);
    });
  }
  function loadRoster() {
    Promise.all([apiGet("roster"), apiGet("classes")]).then(function (res) {
      lastClasses = res[1] || [];
      var tbody = document.getElementById("roster-rows");
      tbody.innerHTML = (res[0] || []).map(function (r) { return rosterRowHtml(r.sinf, r.ism, r.familiya); }).join("") || rosterRowHtml("", "", "");
      wireRosterNameInputs();
    });
  }
  document.getElementById("btn-add-roster-row").addEventListener("click", function () {
    document.getElementById("roster-rows").insertAdjacentHTML("beforeend", rosterRowHtml("", "", ""));
    wireRosterNameInputs();
  });
  document.getElementById("roster-rows").addEventListener("click", function (ev) {
    if (ev.target.classList.contains("tbl-del")) ev.target.closest("tr").remove();
  });
  document.getElementById("btn-save-roster").addEventListener("click", function () {
    var items = Array.prototype.map
      .call(document.querySelectorAll("#roster-rows tr"), function (tr) {
        return {
          sinf: tr.querySelector(".ro-sinf").value.trim(),
          ism: capitalizeName(tr.querySelector(".ro-ism").value),
          familiya: capitalizeName(tr.querySelector(".ro-familiya").value),
        };
      })
      .filter(function (r) { return r.ism || r.familiya; });
    var btn = document.getElementById("btn-save-roster");
    var msg = document.getElementById("roster-msg");
    withSaving(btn, function () { return apiPost({ type: "roster", items: items }); }, msg, "Saqlandi ✓ (" + items.length + " ta)").catch(function () {});
  });

  // ================= HAYDOVCHILAR =================
  function driverRowHtml(raqam, haydovchi, telefon, rang, sigim) {
    return (
      '<tr><td><input class="tbl-input dr-raqam" value="' + esc(raqam || "") + '" placeholder="01"></td>' +
      '<td><input class="tbl-input dr-haydovchi" value="' + esc(haydovchi || "") + '"></td>' +
      '<td><div class="phone-row"><span class="phone-prefix">+998</span><input class="tbl-input dr-telefon" value="' + esc(localPhoneDigitsFromFull(telefon)) + '" placeholder="90 123 45 67"></div></td>' +
      '<td><input class="tbl-input dr-rang" type="color" value="' + esc(rang || "#1F3A5F") + '"></td>' +
      '<td><input class="tbl-input dr-sigim" type="text" inputmode="numeric" value="' + esc(sigim == null ? "" : sigim) + '" placeholder="50"></td>' +
      '<td><button type="button" class="tbl-del">✕</button></td></tr>'
    );
  }
  function wireDriverPhoneInputs() {
    document.querySelectorAll("#drivers-rows .dr-telefon").forEach(function (inp) {
      if (inp._masked) return;
      inp._masked = true;
      attachPhoneMask(inp, function () {});
    });
  }
  function loadDrivers() {
    apiGet("drivers").then(function (list) {
      lastDrivers = list || [];
      var tbody = document.getElementById("drivers-rows");
      tbody.innerHTML = lastDrivers.map(function (d) { return driverRowHtml(d.raqam, d.haydovchi, d.telefon, d.rang, d.sigim); }).join("") || driverRowHtml("", "", "", "", "");
      wireDriverPhoneInputs();
    });
  }
  document.getElementById("btn-add-driver").addEventListener("click", function () {
    document.getElementById("drivers-rows").insertAdjacentHTML("beforeend", driverRowHtml("", "", "", "", ""));
    wireDriverPhoneInputs();
  });
  document.getElementById("drivers-rows").addEventListener("click", function (ev) {
    if (ev.target.classList.contains("tbl-del")) ev.target.closest("tr").remove();
  });
  document.getElementById("btn-save-drivers").addEventListener("click", function () {
    var items = Array.prototype.map
      .call(document.querySelectorAll("#drivers-rows tr"), function (tr) {
        var digits = tr.querySelector(".dr-telefon").value.trim();
        return {
          raqam: tr.querySelector(".dr-raqam").value.trim(),
          haydovchi: tr.querySelector(".dr-haydovchi").value.trim(),
          telefon: digits ? fullPhone(digits) : "",
          rang: tr.querySelector(".dr-rang").value,
          sigim: tr.querySelector(".dr-sigim").value.trim() || null,
        };
      })
      .filter(function (d) { return d.raqam || d.haydovchi; });
    var btn = document.getElementById("btn-save-drivers");
    var msg = document.getElementById("drivers-msg");
    withSaving(btn, function () { return apiPost({ type: "drivers", items: items }); }, msg).catch(function () {});
  });

  // ================= KURATORLAR =================
  function kuratorRowHtml(sinf, ism, telefon, kirishKodi, boglangan) {
    var classOptions = (lastClasses.length ? lastClasses.map(function (c) { return c.sinf; }) : []).slice();
    if (sinf && classOptions.indexOf(sinf) === -1) classOptions.push(sinf);
    classOptions.sort(compareClasses);
    var opts = '<option value="">Tanlang</option>' + classOptions.map(function (c) { return '<option value="' + esc(c) + '"' + (c === sinf ? " selected" : "") + ">" + esc(c) + "</option>"; }).join("");
    var status = kirishKodi
      ? (boglangan
          ? '<span style="color:var(--success);font-weight:600;">✓ ulangan</span>'
          : '<button type="button" class="btn-text kur-link-btn" data-code="' + esc(kirishKodi) + '">havolani ko\'rish</button>')
      : '<span class="hint" style="margin:0;">saqlangach kod chiqadi</span>';
    return (
      '<tr><td><select class="tbl-input kur-sinf">' + opts + "</select></td>" +
      '<td><input class="tbl-input kur-ism" value="' + esc(ism || "") + '"></td>' +
      '<td><div class="phone-row"><span class="phone-prefix">+998</span><input class="tbl-input kur-telefon" value="' + esc(localPhoneDigitsFromFull(telefon)) + '" placeholder="90 123 45 67"></div></td>' +
      '<td>' + status + '</td>' +
      '<td><button type="button" class="tbl-del">✕</button></td></tr>'
    );
  }
  function wireKuratorPhoneInputs() {
    document.querySelectorAll("#kurators-rows .kur-telefon").forEach(function (inp) {
      if (inp._masked) return;
      inp._masked = true;
      attachPhoneMask(inp, function () {});
    });
    document.querySelectorAll(".kur-link-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var link = (BOT_LINK_CACHE || "https://t.me/SizningBotingiz") + "?start=" + btn.getAttribute("data-code");
        window.prompt("Kuratorga shu havolani yuboring:", link);
      });
    });
  }
  var BOT_LINK_CACHE = "";
  function loadKurators() {
    Promise.all([apiGet("kurators"), apiGet("classes"), apiGet("settings")]).then(function (res) {
      lastClasses = res[1] || [];
      BOT_LINK_CACHE = (res[2] || {}).BotLink || "";
      var tbody = document.getElementById("kurators-rows");
      tbody.innerHTML = (res[0] || []).map(function (k) { return kuratorRowHtml(k.sinf, k.ism, k.telefon, k.kirishKodi, k["bogʻlangan"]); }).join("") || kuratorRowHtml("", "", "", "", false);
      wireKuratorPhoneInputs();
    });
  }
  document.getElementById("btn-add-kurator").addEventListener("click", function () {
    document.getElementById("kurators-rows").insertAdjacentHTML("beforeend", kuratorRowHtml("", "", "", "", false));
    wireKuratorPhoneInputs();
  });
  document.getElementById("kurators-rows").addEventListener("click", function (ev) {
    if (ev.target.classList.contains("tbl-del")) ev.target.closest("tr").remove();
  });
  document.getElementById("btn-save-kurators").addEventListener("click", function () {
    var items = Array.prototype.map
      .call(document.querySelectorAll("#kurators-rows tr"), function (tr) {
        var digits = tr.querySelector(".kur-telefon").value.trim();
        return {
          sinf: tr.querySelector(".kur-sinf").value.trim(),
          ism: tr.querySelector(".kur-ism").value.trim(),
          telefon: digits ? fullPhone(digits) : "",
        };
      })
      .filter(function (k) { return k.sinf; });
    var btn = document.getElementById("btn-save-kurators");
    var msg = document.getElementById("kurators-msg");
    withSaving(btn, function () { return apiPost({ type: "kurators", items: items }); }, msg)
      .then(function () { setTimeout(loadKurators, 400); })
      .catch(function () {});
  });

  // ================= SOZLAMALAR =================
  function overallRowHtml(ism, lavozimi, kirishKodi, boglangan) {
    var status = kirishKodi
      ? (boglangan
          ? '<span style="color:var(--success);font-weight:600;">✓ ulangan</span>'
          : '<button type="button" class="btn-text ov-link-btn" data-code="' + esc(kirishKodi) + '">havolani ko\'rish</button>')
      : '<span class="hint" style="margin:0;">saqlangach kod chiqadi</span>';
    return (
      '<tr><td><input class="tbl-input ov-ism" value="' + esc(ism || "") + '"></td>' +
      '<td><input class="tbl-input ov-lavozim" value="' + esc(lavozimi || "") + '" placeholder="Direktor"></td>' +
      '<td>' + status + '</td>' +
      '<td><button type="button" class="tbl-del">✕</button></td></tr>'
    );
  }
  function wireOverallLinks() {
    document.querySelectorAll(".ov-link-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var link = (BOT_LINK_CACHE || "https://t.me/SizningBotingiz") + "?start=" + btn.getAttribute("data-code");
        window.prompt("Shu odamga quyidagi havolani yuboring:", link);
      });
    });
  }
  function loadSozlamalar() {
    Promise.all([apiGet("settings"), apiGet("overall")]).then(function (res) {
      var settings = res[0] || {};
      BOT_LINK_CACHE = settings.BotLink || "";
      document.getElementById("set-botlink").value = BOT_LINK_CACHE;
      document.getElementById("rep-shownames").checked = settings.ShowNotYetNames !== "0";
      document.getElementById("rep-perclass").checked = settings.OverallPerClass !== "0";
      var tbody = document.getElementById("overall-rows");
      tbody.innerHTML = (res[1] || []).map(function (o) { return overallRowHtml(o.ism, o.lavozimi, o.kirishKodi, o["bogʻlangan"]); }).join("") || overallRowHtml("", "", "", false);
      wireOverallLinks();
    });
  }
  document.getElementById("btn-save-reportsettings").addEventListener("click", function () {
    var btn = document.getElementById("btn-save-reportsettings");
    var msg = document.getElementById("reportsettings-msg");
    var values = {
      ShowNotYetNames: document.getElementById("rep-shownames").checked ? "1" : "0",
      OverallPerClass: document.getElementById("rep-perclass").checked ? "1" : "0",
    };
    withSaving(btn, function () { return apiPost({ type: "settings", values: values }); }, msg).catch(function () {});
  });
  document.getElementById("btn-save-botlink").addEventListener("click", function () {
    var link = document.getElementById("set-botlink").value.trim();
    var btn = document.getElementById("btn-save-botlink");
    var msg = document.getElementById("botlink-msg");
    withSaving(btn, function () { return apiPost({ type: "settings", values: { BotLink: link } }); }, msg)
      .then(function () { BOT_LINK_CACHE = link; })
      .catch(function () {});
  });
  document.getElementById("btn-add-overall").addEventListener("click", function () {
    document.getElementById("overall-rows").insertAdjacentHTML("beforeend", overallRowHtml("", "", "", false));
  });
  document.getElementById("overall-rows").addEventListener("click", function (ev) {
    if (ev.target.classList.contains("tbl-del")) ev.target.closest("tr").remove();
  });
  document.getElementById("btn-save-overall").addEventListener("click", function () {
    var items = Array.prototype.map
      .call(document.querySelectorAll("#overall-rows tr"), function (tr) {
        return { ism: tr.querySelector(".ov-ism").value.trim(), lavozimi: tr.querySelector(".ov-lavozim").value.trim() };
      })
      .filter(function (o) { return o.ism; });
    var btn = document.getElementById("btn-save-overall");
    var msg = document.getElementById("overall-msg");
    withSaving(btn, function () { return apiPost({ type: "overall", items: items }); }, msg)
      .then(function () { setTimeout(loadSozlamalar, 400); })
      .catch(function () {});
  });

  // Maktab rahbariyati uchun umumiy statistika PDF: sinflar bo'yicha
  // jamlanma jadval + to'liq o'quvchilar ro'yxati (autoTable bilan tartibli
  // jadval, oldingi qo'lda joylashtirilgan matn o'rniga). Telefon/manzil
  // ustunlari ixtiyoriy checkbox orqali qo'shiladi/olib tashlanadi.
  function exportOrgStatsPdf() {
    if (typeof window.jspdf === "undefined") {
      alert("PDF kutubxonasi yuklanmadi — internetni tekshirib qayta urinib ko'ring.");
      return;
    }
    var jsPDF = window.jspdf.jsPDF;
    var doc = new jsPDF();
    var phoneCb = document.getElementById("org-pdf-phone");
    var locCb = document.getElementById("org-pdf-loc");
    var includePhone = !!(phoneCb && phoneCb.checked);
    var includeLoc = !!(locCb && locCb.checked);

    Promise.all([apiGet("entries"), apiGet("classes")]).then(function (res) {
      var entries = res[0] || [];
      var classes = res[1] || [];
      var counts = {};
      entries.forEach(function (e) { counts[e.sinf] = (counts[e.sinf] || 0) + 1; });
      var classKeys = classes.length ? classes.map(function (c) { return c.sinf; }) : Object.keys(counts);
      classKeys.sort(compareClasses);

      var totalJami = 0, totalBusU = 0, totalGot = 0;
      var classRows = classKeys.map(function (sinf) {
        var cls = classes.filter(function (c) { return c.sinf === sinf; })[0] || {};
        var jami = cls.jami != null ? Number(cls.jami) : null;
        var busU = cls.busFoydalanuvchi != null ? Number(cls.busFoydalanuvchi) : null;
        var got = counts[sinf] || 0;
        if (jami) totalJami += jami;
        if (busU) totalBusU += busU;
        totalGot += got;
        var pct = busU ? Math.round((got / busU) * 100) + "%" : "—";
        return [sinf, jami != null ? jami : "—", busU != null ? busU : "—", got, pct];
      });

      doc.setFontSize(18);
      doc.text("Bekat — umumiy statistika hisoboti", 14, 16);
      doc.setFontSize(10);
      doc.text("Sana: " + new Date().toLocaleDateString("uz-UZ"), 14, 23);

      doc.setFontSize(12);
      var overallPct = totalJami ? " (" + Math.round((totalBusU / totalJami) * 100) + "%)" : "";
      doc.text(
        "Jami o'quvchilar: " + (totalJami || "—") + "   Avtobusdan foydalanadigan: " + (totalBusU || "—") + overallPct + "   Ro'yxatdan o'tgan: " + totalGot,
        14, 32
      );

      doc.autoTable({
        startY: 38,
        head: [["Sinf", "Jami", "Avtobusdan foyd.", "Ro'yxatdan o'tgan", "%"]],
        body: classRows,
        styles: { fontSize: 9 },
        headStyles: { fillColor: [31, 58, 95] },
      });

      var y = doc.lastAutoTable.finalY + 10;
      if (y > 260) { doc.addPage(); y = 20; }
      doc.setFontSize(14);
      doc.text("O'quvchilar bo'yicha to'liq ma'lumot", 14, y);

      var head = ["#", "Ism", "Familiya", "Sinf"];
      if (includePhone) head.push("Telefon");
      if (includeLoc) head.push("Manzil");
      var sorted = entries.slice().sort(function (a, b) {
        var c = compareClasses(a.sinf, b.sinf);
        if (c !== 0) return c;
        return String(a.familiya || "").localeCompare(String(b.familiya || ""));
      });
      var body = sorted.map(function (e, i) {
        var row = [i + 1, e.ism, e.familiya, e.sinf];
        if (includePhone) row.push(e.telefon || "—");
        if (includeLoc) row.push(e.lat != null ? mapsLinkFor(e.lat, e.lng) : "—");
        return row;
      });

      doc.autoTable({
        startY: y + 4,
        head: [head],
        body: body,
        styles: { fontSize: 8 },
        headStyles: { fillColor: [31, 58, 95] },
      });

      doc.save("bekat-umumiy-statistika.pdf");
    });
  }

  document.getElementById("btn-org-pdf").addEventListener("click", exportOrgStatsPdf);

  // ================= YO'NALISHLAR =================
  var currentSchool = null;

  function loadSchoolStatus() {
    apiGet("school").then(function (school) {
      currentSchool = school || (SCHOOL_LOCATION ? SCHOOL_LOCATION : null);
      schoolLocked = !!(school && school.locked);
      updateSchoolStatusText();
      placeSchoolMarker();
      updateLockButton();
    });
  }

  function updateSchoolStatusText() {
    var el = document.getElementById("school-status");
    el.textContent = currentSchool
      ? "Belgilangan: " + currentSchool.lat.toFixed(6) + ", " + currentSchool.lng.toFixed(6) + (schoolLocked ? " (maxkamlangan)" : "")
      : "Belgilanmagan — yo'nalishlarni hisoblashdan oldin belgilang.";
  }
  function updateLockButton() {
    var btn = document.getElementById("btn-school-lock");
    btn.textContent = schoolLocked ? "🔒 Ochish" : "🔓 Maxkamlash";
  }

  function initSchoolMapIfNeeded() {
    if (schoolMap || typeof L === "undefined") return;
    var center = currentSchool || MAP_DEFAULT_CENTER;
    schoolMap = L.map("map-school").setView([center.lat, center.lng], 13);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "&copy; OpenStreetMap" }).addTo(schoolMap);
    schoolMap.on("click", function (e) {
      if (schoolLocked) { showToast("Avval qulfni oching (🔒 Ochish)"); return; }
      setSchoolLocation(e.latlng.lat, e.latlng.lng);
    });
    placeSchoolMarker();
  }

  function placeSchoolMarker() {
    if (!schoolMap || !currentSchool) return;
    if (!schoolMarker) {
      schoolMarker = L.marker([currentSchool.lat, currentSchool.lng], { draggable: !schoolLocked }).addTo(schoolMap);
      schoolMarker.on("dragend", function () {
        if (schoolLocked) return;
        var ll = schoolMarker.getLatLng();
        setSchoolLocation(ll.lat, ll.lng);
      });
      schoolMap.setView([currentSchool.lat, currentSchool.lng], 15);
    } else {
      schoolMarker.setLatLng([currentSchool.lat, currentSchool.lng]);
      schoolMarker.dragging[schoolLocked ? "disable" : "enable"]();
    }
  }

  function setSchoolLocation(lat, lng) {
    currentSchool = { lat: lat, lng: lng };
    apiPost({ type: "school", lat: lat, lng: lng }).then(function () {
      updateSchoolStatusText();
      placeSchoolMarker();
    });
  }

  document.getElementById("btn-school-lock").addEventListener("click", function () {
    schoolLocked = !schoolLocked;
    apiPost({ type: "school", locked: schoolLocked }).then(function () {
      updateLockButton();
      updateSchoolStatusText();
      placeSchoolMarker();
      showToast(schoolLocked ? "Maktab joylashuvi maxkamlandi" : "Maktab joylashuvini endi o'zgartirish mumkin");
    });
  });

  document.getElementById("btn-school-gps").addEventListener("click", function () {
    if (schoolLocked) { showToast("Avval qulfni oching (🔒 Ochish)"); return; }
    if (!navigator.geolocation) { alert("Brauzer joylashuvni aniqlay olmaydi."); return; }
    navigator.geolocation.getCurrentPosition(
      function (pos) { setSchoolLocation(pos.coords.latitude, pos.coords.longitude); },
      function () { alert("Joylashuvni aniqlab bo'lmadi."); },
      { enableHighAccuracy: true, timeout: 12000 }
    );
  });

  // ---- Bekatni qo'lda belgilash ----
  // Avtomatik klasterlashda chalkashlik bo'lganda, admin xaritadan bir
  // nuqta bosib "bekat" yaratadi, so'ng shu bekatdan chiqadigan
  // o'quvchilarni ro'yxatdan tanlaydi — ularning bekatLat/bekatLng maydoni
  // shu nuqtaga o'rnatiladi (Royxat jadvalining boshqa hech qanday maydoni
  // o'zgarmaydi — faqat shu ikki ustun yangilanadi).
  var manualBekatMap = null;
  var manualBekatMarker = null;
  var manualBekatPoint = null;
  var manualBekatEntries = [];

  function refreshManualBekatEntries() {
    apiGet("entries").then(function (entries) {
      manualBekatEntries = entries || [];
      if (!document.getElementById("manual-bekat-picker").hidden) renderManualBekatList();
    });
  }

  function initManualBekatMapIfNeeded() {
    if (manualBekatMap || typeof L === "undefined") return;
    var center = currentSchool || MAP_DEFAULT_CENTER;
    manualBekatMap = L.map("map-manual-bekat").setView([center.lat, center.lng], 13);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "&copy; OpenStreetMap" }).addTo(manualBekatMap);
    manualBekatMap.on("click", function (e) {
      setManualBekatPoint(e.latlng.lat, e.latlng.lng);
    });
  }

  function setManualBekatPoint(lat, lng) {
    manualBekatPoint = { lat: lat, lng: lng };
    if (!manualBekatMarker) {
      manualBekatMarker = L.marker([lat, lng], { draggable: true }).addTo(manualBekatMap);
      manualBekatMarker.on("dragend", function () {
        var ll = manualBekatMarker.getLatLng();
        manualBekatPoint = { lat: ll.lat, lng: ll.lng };
        updateManualBekatCoordText();
      });
    } else {
      manualBekatMarker.setLatLng([lat, lng]);
    }
    document.getElementById("manual-bekat-picker").hidden = false;
    updateManualBekatCoordText();
    renderManualBekatList();
  }

  function updateManualBekatCoordText() {
    document.getElementById("manual-bekat-coord").textContent = manualBekatPoint.lat.toFixed(6) + ", " + manualBekatPoint.lng.toFixed(6);
  }

  function renderManualBekatList() {
    var list = document.getElementById("manual-bekat-list");
    var checkedIds = {};
    Array.prototype.forEach.call(document.querySelectorAll(".mb-student-cb:checked"), function (cb) { checkedIds[cb.value] = true; });
    var q = (document.getElementById("manual-bekat-search").value || "").trim().toLowerCase();
    var sorted = manualBekatEntries.slice().sort(function (a, b) {
      var c = compareClasses(a.sinf, b.sinf);
      if (c !== 0) return c;
      return String(a.familiya || "").localeCompare(String(b.familiya || ""));
    });
    var filtered = sorted.filter(function (e) {
      if (!q) return true;
      return (e.ism + " " + e.familiya + " " + e.sinf).toLowerCase().indexOf(q) !== -1;
    });
    if (!filtered.length) {
      list.innerHTML = '<p class="hint" style="margin:0;">Hech kim topilmadi.</p>';
      return;
    }
    list.innerHTML = filtered
      .map(function (e) {
        var checked = checkedIds[e.id] ? " checked" : "";
        return (
          '<label style="display:flex;align-items:center;gap:8px;font-weight:400;margin:0 0 6px;width:auto;">' +
          '<input type="checkbox" class="mb-student-cb" value="' + esc(e.id) + '"' + checked + ' style="width:auto;"> ' +
          esc(e.ism) + " " + esc(e.familiya) + ' <span class="hint" style="margin:0;">(' + esc(e.sinf) + ")</span></label>"
        );
      })
      .join("");
  }
  document.getElementById("manual-bekat-search").addEventListener("input", renderManualBekatList);

  document.getElementById("btn-manual-bekat-save").addEventListener("click", function () {
    var btn = this;
    var msg = document.getElementById("manual-bekat-msg");
    if (!manualBekatPoint) return;
    var ids = Array.prototype.map.call(document.querySelectorAll(".mb-student-cb:checked"), function (cb) { return cb.value; });
    if (!ids.length) {
      msg.textContent = "Kamida bitta o'quvchi tanlang.";
      msg.className = "form-error";
      return;
    }
    withSaving(
      btn,
      function () {
        return Promise.all(ids.map(function (id) { return apiUpdateEntry(id, { bekatLat: manualBekatPoint.lat, bekatLng: manualBekatPoint.lng }); }));
      },
      msg,
      "Bekat saqlandi ✓ (" + ids.length + " ta o'quvchi) — keyingi hisoblashda hisobga olinadi"
    )
      .then(function () {
        Array.prototype.forEach.call(document.querySelectorAll(".mb-student-cb:checked"), function (cb) { cb.checked = false; });
      })
      .catch(function () {});
  });

  // ---- Hisoblash ----
  document.getElementById("btn-compute").addEventListener("click", function () {
    var msg = document.getElementById("route-msg");
    msg.textContent = "";
    document.getElementById("walkers-card").hidden = true;
    document.getElementById("unassigned-card").hidden = true;
    if (!currentSchool) {
      msg.textContent = "Avval maktab joylashuvini belgilang.";
      msg.className = "form-error";
      return;
    }
    var direction = (document.querySelector('input[name="rt-direction"]:checked') || {}).value || "kelish";
    var busCount = parseInt(document.getElementById("rt-buscount").value, 10) || 0;
    var maxWalkM = parseInt(document.getElementById("rt-maxwalk").value, 10) || DEFAULT_MAX_WALK_M;
    var walkRadiusM = parseInt(document.getElementById("rt-walkradius").value, 10) || 0;
    var selectedDay = document.getElementById("rt-day").value;
    var departureFromSchool = document.getElementById("rt-ketish-vaqti").value.trim() || "14:00";
    var kmCapPerBus = parseFloat(document.getElementById("rt-kmcap").value) || 0;
    if (busCount < 1) {
      msg.textContent = "Avtobuslar sonini kiriting.";
      msg.className = "form-error";
      return;
    }
    msg.textContent = "Hisoblanmoqda… (bir necha soniya)";
    msg.className = "form-ok";

    Promise.all([apiGet("entries"), apiGet("drivers")]).then(function (res) {
      var allEntries = res[0] || [];
      var drivers = (res[1] || []).slice().sort(function (a, b) { return String(a.raqam).localeCompare(String(b.raqam), undefined, { numeric: true }); });
      lastDrivers = drivers;
      var capacities = [];
      for (var i = 0; i < busCount; i++) capacities.push(drivers[i] && drivers[i].sigim ? drivers[i].sigim : DEFAULT_BUS_CAPACITY);

      // Har bir o'quvchi shu kunda, shu yo'nalishda (kelish yoki ketish —
      // Ro'yxat bo'limida ✎ orqali alohida belgilanadi) avtobusdan
      // foydalanadimi. Oddiy kundalik o'quvchida ikkalasi ham "har kuni".
      var dayField = direction === "ketish" ? "ketishKunlari" : "kelishKunlari";
      var entries = allEntries.filter(function (e) {
        return (e[dayField] || []).indexOf(selectedDay) !== -1;
      });

      // Override qiymati doim "1".."N" (joriy hisoblashdagi avtobus tartib
      // raqami) sifatida saqlanadi — haydovchi biriktirilgan yoki
      // biriktirilmaganidan qat'i nazar ishlashi uchun (haydovchi raqami
      // emas, chunki har bir avtobusda haydovchi bo'lmasligi mumkin).
      function resolveOverrideIndex(val) {
        var n = parseInt(val, 10);
        return isNaN(n) ? null : n - 1;
      }

      computeRoutes(entries, currentSchool, busCount, maxWalkM, capacities, {
        arrivalHHMM: ARRIVAL_TIME,
        schoolWalkRadiusM: walkRadiusM,
        resolveOverrideIndex: resolveOverrideIndex,
        direction: direction,
        departureFromSchool: departureFromSchool,
        kmCapPerBus: kmCapPerBus,
      }).then(function (result) {
        lastRouteResult = result;
        msg.textContent = "";
        if (result.unassignedCount > 0) {
          msg.textContent = result.unassignedCount + " ta bolaning joylashuvi yo'q, hisobga olinmadi.";
          msg.className = "form-error";
        }
        renderWalkers(result.walkers || []);
        renderUnassigned(result.unassigned || [], busCount, drivers);
        renderRouteResults(result, drivers);
      });
    });
  });

  function renderWalkers(walkers) {
    var card = document.getElementById("walkers-card");
    if (!walkers.length) { card.hidden = true; return; }
    card.hidden = false;
    document.getElementById("walkers-list").innerHTML =
      '<div class="chips">' +
      walkers
        .map(function (w) { return '<span class="chip">' + esc(w.ism) + " " + esc(w.familiya) + " <b>" + esc(w.sinf) + "</b></span>"; })
        .join("") +
      "</div>";
  }

  function renderUnassigned(unassigned, busCount, drivers) {
    var card = document.getElementById("unassigned-card");
    if (!unassigned.length) { card.hidden = true; return; }
    card.hidden = false;
    var busOptions = [];
    for (var i = 0; i < busCount; i++) {
      var label = "Avtobus " + (i + 1) + (drivers[i] && drivers[i].raqam ? " (№" + drivers[i].raqam + ")" : "");
      busOptions.push({ value: String(i + 1), label: label });
    }
    document.getElementById("unassigned-list").innerHTML = unassigned
      .map(function (s, idx) {
        var names = s.students.map(function (st) { return esc(st.ism) + " " + esc(st.familiya); }).join(", ");
        return (
          '<div class="bus-card"><p style="margin:0 0 10px;font-size:13.5px;"><b>' + s.students.length + " ta bola:</b> " + names + "</p>" +
          '<div class="row2"><select id="ua-sel-' + idx + '" style="flex:1;">' +
          busOptions.map(function (o) { return '<option value="' + esc(o.value) + '">' + esc(o.label) + "</option>"; }).join("") +
          '</select><button type="button" class="btn-primary" style="margin-top:0;flex:none;" data-idx="' + idx + '" id="ua-assign-' + idx + '">Belgilash</button></div></div>'
        );
      })
      .join("");
    unassigned.forEach(function (s, idx) {
      document.getElementById("ua-assign-" + idx).addEventListener("click", function () {
        var raqam = document.getElementById("ua-sel-" + idx).value;
        var btn = this;
        btn.disabled = true;
        btn.textContent = "Saqlanmoqda…";
        Promise.all(s.students.map(function (st) { return apiUpdateEntry(st.id, { avtobusOverride: raqam }); }))
          .then(function () {
            showToast("Belgilandi — qayta hisoblanmoqda…");
            document.getElementById("btn-compute").click();
          })
          .catch(function () {
            btn.disabled = false;
            btn.textContent = "Belgilash";
            alert("Saqlanmadi, qayta urinib ko'ring.");
          });
      });
    });
  }

  function renderRouteResults(result, drivers) {
    document.getElementById("route-results").hidden = false;
    var sel = document.getElementById("route-view-select");
    sel.innerHTML =
      '<option value="all">Barcha avtobuslar</option>' +
      result.buses.map(function (b, i) { return '<option value="' + i + '">Avtobus ' + (i + 1) + " (" + b.count + " bola)</option>"; }).join("");
    sel.onchange = function () { drawRouteMap(result, drivers, sel.value === "all" ? null : parseInt(sel.value, 10)); };
    drawRouteMap(result, drivers, null);
    renderBusSummaries(result, drivers);
  }

  // "Qulflash" — hozir tayinlangan har bir bolaning avtobusOverride'ini
  // joriy avtobus tartib raqamiga o'rnatadi. Shu bekatlar keyingi
  // hisoblashlarda ham "forcedBusIndex" orqali o'sha avtobusga mahkam
  // qoladi (routing.js'dagi mavjud mexanizm) — shuning uchun 1-2 ta yangi
  // o'quvchi qo'shilsa ham, avvalgi qo'lda to'g'irlangan taqsimot buzilmaydi.
  document.getElementById("btn-lock-assignment").addEventListener("click", function () {
    if (!lastRouteResult) return;
    var btn = this;
    var updates = [];
    lastRouteResult.buses.forEach(function (bus, i) {
      (bus.order || []).forEach(function (s) {
        s.students.forEach(function (st) { updates.push({ id: st.id, busIndex: i + 1 }); });
      });
    });
    if (!updates.length) { showToast("Qulflash uchun taqsimot topilmadi — avval hisoblang."); return; }
    if (!window.confirm(updates.length + " ta o'quvchi hozirgi avtobusiga mahkamlansinmi? Keyingi hisoblashlarda ular shu avtobusda qoladi, faqat yangi o'quvchilar bo'sh joyga taqsimlanadi.")) return;
    withSaving(
      btn,
      function () { return Promise.all(updates.map(function (u) { return apiUpdateEntry(u.id, { avtobusOverride: String(u.busIndex) }); })); },
      null,
      "Taqsimot qulflandi ✓ (" + updates.length + " ta o'quvchi)"
    ).catch(function () { alert("Qulflashda xatolik, qayta urinib ko'ring."); });
  });

  // Kuratorlarga hozirgi hisoblangan taqsimot bo'yicha xabar yuborish —
  // har bir o'quvchining bekat vaqti, biriktirilgan avtobus/haydovchi va
  // telefon raqamlari kuratorning shaxsiy Telegram chatiga yuboriladi.
  document.getElementById("btn-notify-kurators").addEventListener("click", function () {
    if (!lastRouteResult) { showToast("Avval taqsimotni hisoblang."); return; }
    var btn = this;
    var assignments = [];
    lastRouteResult.buses.forEach(function (bus, i) {
      if (!bus.route) return;
      var d = lastDrivers[i] || {};
      (bus.order || []).forEach(function (s, idx) {
        var t = bus.stopTimes && bus.stopTimes[idx] ? bus.stopTimes[idx] : "";
        s.students.forEach(function (st) {
          assignments.push({
            sinf: st.sinf,
            ism: st.ism,
            familiya: st.familiya,
            telefon: st.telefon || "",
            direction: bus.direction || "kelish",
            vaqt: t,
            haydovchi: d.haydovchi || "",
            avtobusRaqam: d.raqam || String(i + 1),
          });
        });
      });
    });
    if (!assignments.length) { showToast("Yuborish uchun taqsimot topilmadi — avval hisoblang."); return; }
    if (!window.confirm(assignments.length + " ta o'quvchi bo'yicha kuratorlarga Telegram orqali xabar yuborilsinmi?")) return;
    withSaving(
      btn,
      function () { return apiPost({ type: "notifyKurators", assignments: assignments }); },
      null,
      "Xabarlar yuborildi ✓"
    ).catch(function () { alert("Yuborishda xatolik, qayta urinib ko'ring."); });
  });

  function startIcon(color, number) {
    return L.divIcon({
      className: "",
      html:
        '<div style="position:relative;">' +
        '<div style="font-size:24px;line-height:1;filter:drop-shadow(0 2px 2px rgba(0,0,0,.35));">🚩</div>' +
        '<div style="position:absolute;top:-5px;left:17px;background:' + color + ';color:#fff;font-size:10px;font-weight:700;border-radius:50%;width:16px;height:16px;display:flex;align-items:center;justify-content:center;border:1.5px solid #fff;">' + number + "</div>" +
        "</div>",
      iconSize: [30, 30],
      iconAnchor: [8, 26],
    });
  }

  function persistStopMove(stop, lat, lng) {
    stop.lat = lat;
    stop.lng = lng;
    Promise.all(stop.students.map(function (st) { return apiUpdateEntry(st.id, { bekatLat: lat, bekatLng: lng }); }))
      .then(function () { showToast("Bekat joylashuvi yangilandi (keyingi hisoblashda hisobga olinadi)"); })
      .catch(function () {});
  }

  // GOOGLE_MAPS_API_KEY bo'sh bo'lsa (standart holat), hech narsa
  // o'zgarmaydi — pastdagi eski, sinovdan o'tgan Leaflet/OpenStreetMap yo'li
  // ishlatiladi. Kalit kiritilgan bo'lsagina Google xaritasiga o'tiladi.
  function drawRouteMap(result, drivers, focusIndex) {
    if (useGoogleMaps()) drawRouteMapGoogle(result, drivers, focusIndex);
    else drawRouteMapLeaflet(result, drivers, focusIndex);
    renderStreetNames(result, drivers, focusIndex);
  }

  function drawRouteMapLeaflet(result, drivers, focusIndex) {
    if (typeof L === "undefined") {
      document.getElementById("map-routes").textContent = "Xarita yuklanmadi (internet aloqasini tekshiring).";
      return;
    }
    if (!routeMap) {
      routeMap = L.map("map-routes");
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap',
      }).addTo(routeMap);
    }
    if (routeLayer) routeMap.removeLayer(routeLayer);
    routeLayer = L.layerGroup().addTo(routeMap);

    L.marker([currentSchool.lat, currentSchool.lng]).bindPopup("🏫 Maktab").addTo(routeLayer);

    result.buses.forEach(function (bus, i) {
      if (focusIndex != null && focusIndex !== i) return;
      if (!bus.route) return;
      var color = busColor(i, drivers);
      L.polyline(bus.route.latlngs, { color: color, weight: 4, opacity: 0.85 }).addTo(routeLayer);

      // Har bir o'quvchining uy joylashuvi — kichik, bosilganda ma'lumot.
      bus.order.forEach(function (s) {
        s.students.forEach(function (st) {
          if (st.lat == null) return;
          L.circleMarker([st.lat, st.lng], { radius: 4, color: color, fillColor: "#fff", fillOpacity: 0.9, weight: 2 })
            .bindPopup("<b>" + esc(st.ism) + " " + esc(st.familiya) + "</b><br>" + esc(st.sinf) + (st.telefon ? "<br>" + esc(st.telefon) : ""))
            .addTo(routeLayer);
        });
      });

      // Bekat (yig'ilish nuqtasi) belgilari — birinchisi (eng uzoq, boshlash
      // nuqtasi) alohida bayroqcha bilan, qolganlari rangli, SURISH mumkin.
      bus.order.forEach(function (s, idx) {
        var names = s.students.map(function (st) { return esc(st.ism + " " + st.familiya); }).join("<br>");
        var label = (idx === 0 ? "🚩 Boshlash nuqtasi — " : "") + "<b>Bekat " + (idx + 1) + "</b><br>" + names;
        var marker;
        if (idx === 0) {
          marker = L.marker([s.lat, s.lng], { icon: startIcon(color, idx + 1), draggable: true }).bindPopup(label);
        } else {
          marker = L.marker([s.lat, s.lng], {
            draggable: true,
            icon: L.divIcon({
              className: "",
              html:
                '<div style="width:22px;height:22px;border-radius:50%;background:' + color + ';border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,.4);display:flex;align-items:center;justify-content:center;color:#fff;font-size:11px;font-weight:700;">' +
                (idx + 1) +
                "</div>",
              iconSize: [22, 22],
              iconAnchor: [11, 11],
            }),
          }).bindPopup(label);
        }
        marker.on("dragend", function () {
          var ll = marker.getLatLng();
          persistStopMove(s, ll.lat, ll.lng);
        });
        marker.addTo(routeLayer);
      });
    });

    var bounds = routeLayer.getBounds ? routeLayer.getBounds() : null;
    try {
      if (bounds && bounds.isValid()) routeMap.fitBounds(bounds.pad(0.15));
      else routeMap.setView([currentSchool.lat, currentSchool.lng], 12);
    } catch (e) {
      routeMap.setView([currentSchool.lat, currentSchool.lng], 12);
    }
  }

  // ---- Google Maps versiyasi (faqat GOOGLE_MAPS_API_KEY kiritilganda) ----
  // Diqqat: PDF eksport xaritani rasmga olish uchun html2canvas ishlatadi —
  // Google xaritasining ba'zi holatlarida (ayniqsa vektor render rejimida)
  // bu screenshot bo'sh chiqishi mumkin (ma'lum texnik cheklov, bu yerda
  // internet yo'qligi sabab sinab ko'rib bo'lmadi). Xavotir olmang: agar
  // shunday bo'lsa, PDF baribir jadval qismi bilan (xaritasiz) chiqadi —
  // exportBusPdf/btn-pdf-all'dagi mavjud "catch" zaxira yo'li shuni
  // ta'minlaydi, hech qanday ma'lumot yo'qolmaydi.
  var gMap = null;
  var gMapOverlays = [];
  var gMapInfoWindow = null;
  var gMapLayers = null; // { traffic, transit, bicycling }

  function gIcon(svgInner, w, h, anchorX, anchorY) {
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + w + '" height="' + h + '">' + svgInner + "</svg>";
    return {
      url: "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(svg),
      anchor: new google.maps.Point(anchorX, anchorY),
    };
  }

  // MUHIM: `map.controls[pos].push(el)` elementni Google'ning ICHKI boshqaruv
  // qatlamiga ko'chiradi — bu ko'chirish har doim ham darhol (sinxron)
  // bo'lavermaydi, shuning uchun push()dan keyin document.getElementById
  // orqali bolalarini qidirish ba'zan topolmay, xatolikka olib kelishi
  // mumkin edi (bu butun xaritani "ishlamayapti" qilib ko'rsatib yuborardi,
  // garchi asl sabab kalit yoki internet emas, aynan shu edi). Endi
  // checkbox elementlarini createElement bilan xotirada yasab, ularga
  // listenerni HALI DOMga qo'shilmasdan turib ulaymiz — shunda hech qanday
  // keyingi qidiruv (getElementById) kerak bo'lmaydi.
  function addGMapLayerToggle(gmaps) {
    if (document.getElementById("gmap-layer-toggle")) return;
    var box = document.createElement("div");
    box.id = "gmap-layer-toggle";
    box.style.cssText = "background:#fff;padding:8px 12px;margin:10px;border-radius:8px;box-shadow:0 1px 4px rgba(0,0,0,.3);font:13px sans-serif;";

    function makeToggle(labelText, onChange) {
      var label = document.createElement("label");
      label.style.cssText = "display:block;font-weight:400;margin:0 0 4px;";
      var cb = document.createElement("input");
      cb.type = "checkbox";
      cb.style.width = "auto";
      cb.addEventListener("change", function (e) { onChange(e.target.checked); });
      label.appendChild(cb);
      label.appendChild(document.createTextNode(" " + labelText));
      box.appendChild(label);
      return cb;
    }

    gMapLayers = { traffic: new gmaps.TrafficLayer(), transit: new gmaps.TransitLayer(), bicycling: new gmaps.BicyclingLayer() };
    makeToggle("Traffic (tirbandlik)", function (checked) { gMapLayers.traffic.setMap(checked ? gMap : null); });
    makeToggle("Transit", function (checked) { gMapLayers.transit.setMap(checked ? gMap : null); });
    makeToggle("Bicycling", function (checked) { gMapLayers.bicycling.setMap(checked ? gMap : null); });

    gMap.controls[gmaps.ControlPosition.TOP_LEFT].push(box);
  }

  function drawRouteMapGoogle(result, drivers, focusIndex) {
    loadGoogleMaps()
      .then(function (gmaps) {
        if (!gMap) {
          gMap = new gmaps.Map(document.getElementById("map-routes"), {
            center: { lat: currentSchool.lat, lng: currentSchool.lng },
            zoom: 12,
            mapTypeControl: true,
            mapTypeControlOptions: { mapTypeIds: ["roadmap", "satellite", "hybrid", "terrain"] },
            streetViewControl: true,
            fullscreenControl: true,
          });
          gMapInfoWindow = new gmaps.InfoWindow();
          // Bu — asosiy xarita emas, faqat qo'shimcha (Traffic/Transit/
          // Bicycling) qatlam tugmachalari. Shu yerda xatolik chiqsa ham,
          // asosiy xarita (marshrutlar, bekatlar) ko'rsatilishda davom etsin.
          try { addGMapLayerToggle(gmaps); } catch (e) { console.error("Google Maps: qatlam tugmachalarini qo'shishda xatolik (xarita o'zi ishlayveradi):", e); }
        }
        gMapOverlays.forEach(function (o) { o.setMap(null); });
        gMapOverlays = [];

        var bounds = new gmaps.LatLngBounds();

        var schoolMarker = new gmaps.Marker({
          position: { lat: currentSchool.lat, lng: currentSchool.lng },
          map: gMap,
          title: "Maktab",
          icon: gIcon('<text x="15" y="23" font-size="24" text-anchor="middle">🏫</text>', 30, 30, 15, 24),
        });
        gMapOverlays.push(schoolMarker);
        bounds.extend(schoolMarker.getPosition());

        result.buses.forEach(function (bus, i) {
          if (focusIndex != null && focusIndex !== i) return;
          if (!bus.route) return;
          var color = busColor(i, drivers);

          var path = (bus.route.latlngs || []).map(function (ll) { return { lat: ll[0], lng: ll[1] }; });
          if (path.length) {
            var polyline = new gmaps.Polyline({ path: path, strokeColor: color, strokeWeight: 4, strokeOpacity: 0.85, map: gMap });
            gMapOverlays.push(polyline);
            path.forEach(function (p) { bounds.extend(p); });
          }

          bus.order.forEach(function (s) {
            s.students.forEach(function (st) {
              if (st.lat == null) return;
              var m = new gmaps.Marker({
                position: { lat: st.lat, lng: st.lng },
                map: gMap,
                icon: { path: gmaps.SymbolPath.CIRCLE, scale: 5, fillColor: "#fff", fillOpacity: 0.9, strokeColor: color, strokeWeight: 2 },
              });
              m.addListener("click", function () {
                gMapInfoWindow.setContent("<b>" + esc(st.ism) + " " + esc(st.familiya) + "</b><br>" + esc(st.sinf) + (st.telefon ? "<br>" + esc(st.telefon) : ""));
                gMapInfoWindow.open(gMap, m);
              });
              gMapOverlays.push(m);
            });
          });

          bus.order.forEach(function (s, idx) {
            var names = s.students.map(function (st) { return esc(st.ism + " " + st.familiya); }).join("<br>");
            var label = (idx === 0 ? "🚩 Boshlash nuqtasi — " : "") + "<b>Bekat " + (idx + 1) + "</b><br>" + names;
            var icon =
              idx === 0
                ? gIcon(
                    '<text x="4" y="24" font-size="24">🚩</text><circle cx="25" cy="9" r="9" fill="' + color + '" stroke="#fff" stroke-width="1.5"/><text x="25" y="13" font-size="11" font-weight="700" fill="#fff" text-anchor="middle">' + (idx + 1) + "</text>",
                    34, 34, 6, 26
                  )
                : gIcon(
                    '<circle cx="11" cy="11" r="10" fill="' + color + '" stroke="#fff" stroke-width="2"/><text x="11" y="15" font-size="11" font-weight="700" fill="#fff" text-anchor="middle">' + (idx + 1) + "</text>",
                    22, 22, 11, 11
                  );
            var marker = new gmaps.Marker({ position: { lat: s.lat, lng: s.lng }, map: gMap, draggable: true, icon: icon });
            marker.addListener("click", function () {
              gMapInfoWindow.setContent(label);
              gMapInfoWindow.open(gMap, marker);
            });
            marker.addListener("dragend", function () {
              var pos = marker.getPosition();
              persistStopMove(s, pos.lat(), pos.lng());
            });
            gMapOverlays.push(marker);
            bounds.extend(marker.getPosition());
          });
        });

        try {
          if (!bounds.isEmpty()) gMap.fitBounds(bounds, 50);
          else gMap.setCenter({ lat: currentSchool.lat, lng: currentSchool.lng });
        } catch (e) {}
      })
      .catch(function (err) {
        // Haqiqiy xatolikni konsolga yozamiz — shunda F12 orqali aniq
        // sababini ko'rish mumkin (kalit/internet muammosimi yoki boshqa
        // kod xatosimi), shundan keyingina foydalanuvchiga umumiy xabar
        // ko'rsatiladi.
        console.error("Google Maps xaritasini chizishda xatolik:", err);
        document.getElementById("map-routes").textContent =
          "Google xaritasi yuklanmadi. Sabablari: kalit noto'g'ri/cheklangan, internet yo'q, yoki kutilmagan kod xatosi (batafsili uchun F12 → Console'ni tekshiring). Vaqtincha bepul xaritaga qaytarish uchun config.js dagi GOOGLE_MAPS_API_KEY ni bo'sh qoldiring.";
      });
  }

  // Har bir avtobus qaysi ko'chalardan o'tishini (OSRM'dan olingan) matn
  // shaklida ko'rsatadi — tanlangan avtobus bo'yicha yoki hammasi bo'yicha.
  function renderStreetNames(result, drivers, focusIndex) {
    var el = document.getElementById("street-names");
    if (!el) return;
    var idxList = focusIndex != null ? [focusIndex] : result.buses.map(function (_, i) { return i; });
    var html = idxList
      .map(function (i) {
        var bus = result.buses[i];
        if (!bus || !bus.route) return "";
        var names = bus.route.streetNames || [];
        var namesText = names.length ? names.join(" → ") : "Ko'cha nomlari mavjud emas (OSRM'ga ulanib bo'lmadi, taxminiy hisob ishlatildi).";
        var capWarn = bus.overKmCap ? ' <span style="color:var(--danger);font-weight:600;">⚠ km chegarasidan oshdi</span>' : "";
        return (
          '<p class="hint" style="margin:4px 0;"><b>Avtobus ' + (i + 1) + " o'tadigan ko'chalar:</b>" + capWarn + "<br>" + esc(namesText) + "</p>"
        );
      })
      .filter(Boolean)
      .join("");
    el.innerHTML = html;
  }

  function renderBusSummaries(result, drivers) {
    var html = result.buses
      .map(function (bus, i) {
        if (!bus.route) {
          return '<div class="bus-card"><div class="bus-card-head"><span class="bus-swatch" style="background:' + busColor(i, drivers) + '"></span><b>Avtobus ' + (i + 1) + "</b><span class=\"bus-meta\">0 bola</span></div></div>";
        }
        var d = drivers[i];
        var driverInfo = d && d.haydovchi ? esc(d.haydovchi) + (d.telefon ? " · " + esc(d.telefon) : "") : "Haydovchi kiritilmagan";
        var km = bus.route.distanceKm.toFixed(1);
        var min = Math.round(bus.route.durationMin);
        var approxNote = bus.route.real ? "" : ' <span title="OSRM xizmatiga ulanib bo\'lmadi, taxminiy hisob">(taxminiy)</span>';
        var capNote = bus.overKmCap ? ' <span style="color:var(--danger);font-weight:600;">⚠ km chegarasidan oshdi</span>' : "";
        var chips = bus.order
          .map(function (s, idx) {
            var t = bus.stopTimes && bus.stopTimes[idx] ? bus.stopTimes[idx] : null;
            return s.students
              .map(function (st) {
                return '<span class="bus-student-chip" data-id="' + esc(st.id) + '" data-stop="' + (idx + 1) + '">' + (idx + 1) + ". " + esc(st.ism) + " " + esc(st.familiya) + (t ? ' <b class="chip-time">~' + t + "</b>" : "") + "</span>";
              })
              .join("");
          })
          .join("");
        return (
          '<div class="bus-card" id="bus-card-' + i + '">' +
            '<div class="bus-card-head"><span class="bus-swatch" style="background:' + busColor(i, drivers) + '"></span>' +
            "<b>Avtobus " + (i + 1) + "</b>" +
            '<span class="bus-meta">' + km + " km · " + min + " daqiqa" + approxNote + " · " + bus.count + " bola · chiqish ~" + bus.departure + "</span>" + capNote + "</div>" +
            '<p class="hint" style="margin:8px 0 0;">' + driverInfo + '<button type="button" class="btn-text bus-pdf-btn" data-idx="' + i + '" style="margin-left:10px;">📄 PDF</button></p>' +
            '<div class="bus-students">' + chips + "</div>" +
          "</div>"
        );
      })
      .join("");
    document.getElementById("bus-summaries").innerHTML = html;

    document.querySelectorAll(".bus-student-chip").forEach(function (chip) {
      chip.addEventListener("click", function () {
        var id = chip.getAttribute("data-id");
        var student = null;
        lastRouteResult.buses.forEach(function (bus) {
          bus.order.forEach(function (s) {
            s.students.forEach(function (st) { if (st.id === id) student = st; });
          });
        });
        if (student) openStudentModal(student, chip.getAttribute("data-stop"));
      });
    });
    document.querySelectorAll(".bus-pdf-btn").forEach(function (btn) {
      btn.addEventListener("click", function (ev) {
        ev.stopPropagation();
        exportBusPdf(parseInt(btn.getAttribute("data-idx"), 10), drivers, false);
      });
    });
  }

  function openStudentModal(student, stopNumber) {
    var body = document.getElementById("modal-body");
    body.innerHTML =
      "<h3>" + esc(student.ism) + " " + esc(student.familiya) + "</h3>" +
      '<div class="modal-row"><span>Sinf</span><span>' + esc(student.sinf) + "</span></div>" +
      '<div class="modal-row"><span>Telefon</span><span>' + esc(student.telefon || "—") + "</span></div>" +
      '<div class="modal-row"><span>Bekat</span><span>' + (stopNumber || "—") + "-bekat</span></div>" +
      '<div class="modal-row"><span>Turar joy</span><span>' + (student.turarJoy === "yotoqxona" ? "Yotoqxona" : "Kundalik") + "</span></div>" +
      '<div class="modal-row"><span>Joylashuv</span><span>' +
        (student.lat != null ? '<a href="' + mapsLinkFor(student.lat, student.lng) + '" target="_blank" rel="noopener">xaritada ko\'rish</a>' : "—") +
      "</span></div>";
    document.getElementById("student-modal-backdrop").hidden = false;
  }
  document.getElementById("modal-close").addEventListener("click", function () {
    document.getElementById("student-modal-backdrop").hidden = true;
  });
  document.getElementById("student-modal-backdrop").addEventListener("click", function (ev) {
    if (ev.target.id === "student-modal-backdrop") ev.target.hidden = true;
  });

  // ================= PDF eksport =================
  function busPdfSection(doc, y, busIndex, drivers) {
    var bus = lastRouteResult.buses[busIndex];
    var d = drivers[busIndex] || {};
    doc.setFontSize(15);
    doc.text("Avtobus " + (busIndex + 1) + (d.raqam ? " (No " + d.raqam + ")" : ""), 14, y);
    y += 8;
    doc.setFontSize(10);
    doc.text("Haydovchi: " + (d.haydovchi || "-") + "   Tel: " + (d.telefon || "-") + "   Sig'im: " + (d.sigim || "-"), 14, y);
    y += 6;
    if (bus && bus.route) {
      doc.text(
        bus.route.distanceKm.toFixed(1) + " km, " + Math.round(bus.route.durationMin) + " daqiqa, " + bus.count + " bola, chiqish ~" + bus.departure +
          (bus.direction === "ketish" ? "" : ", maktabga yetib borish ~" + ARRIVAL_TIME) +
          (bus.overKmCap ? "   ⚠ km chegarasidan oshdi" : ""),
        14, y
      );
      y += 6;
      if (bus.route.streetNames && bus.route.streetNames.length) {
        var wrapped = doc.splitTextToSize("Ko'chalar: " + bus.route.streetNames.join(" -> "), 182);
        doc.setFontSize(9);
        doc.text(wrapped, 14, y);
        y += wrapped.length * 4.5 + 3;
        doc.setFontSize(10);
      }
    }
    var body = [];
    if (bus) {
      bus.order.forEach(function (s, idx) {
        var t = bus.stopTimes && bus.stopTimes[idx] ? bus.stopTimes[idx] : "-";
        s.students.forEach(function (st) {
          body.push([idx + 1, st.ism + " " + st.familiya, st.sinf || "-", st.telefon || "-", "~" + t]);
        });
      });
    }
    doc.autoTable({
      startY: y + 2,
      head: [["Bekat", "Ism Familiya", "Sinf", "Telefon", "Vaqt"]],
      body: body,
      styles: { fontSize: 9 },
      headStyles: { fillColor: [31, 58, 95] },
      margin: { left: 14, right: 14 },
    });
    return doc.lastAutoTable.finalY + 8;
  }

  function exportBusPdf(busIndex, drivers, isAll) {
    if (typeof window.jspdf === "undefined" || typeof html2canvas === "undefined") {
      alert("PDF kutubxonasi yuklanmadi — internetni tekshirib qayta urinib ko'ring.");
      return;
    }
    var jsPDF = window.jspdf.jsPDF;
    var doc = new jsPDF();
    doc.setFontSize(18);
    doc.text("Bekat — avtobus yo'nalishi hisoboti", 14, 16);

    var sel = document.getElementById("route-view-select");
    var prevVal = sel.value;
    sel.value = String(busIndex);
    drawRouteMap(lastRouteResult, drivers, busIndex);

    setTimeout(function () {
      html2canvas(document.getElementById("map-routes"), { useCORS: true, allowTaint: true })
        .then(function (canvas) {
          var img = canvas.toDataURL("image/png");
          doc.addImage(img, "PNG", 14, 24, 182, 90);
          var y = busPdfSection(doc, 122, busIndex, drivers);
          finishPdf(doc, "avtobus-" + (busIndex + 1) + ".pdf");
          sel.value = prevVal;
          drawRouteMap(lastRouteResult, drivers, prevVal === "all" ? null : parseInt(prevVal, 10));
        })
        .catch(function () {
          // Xarita rasmi olinmasa ham, ro'yxat bilan PDF beramiz.
          var y = busPdfSection(doc, 24, busIndex, drivers);
          finishPdf(doc, "avtobus-" + (busIndex + 1) + ".pdf");
          sel.value = prevVal;
          drawRouteMap(lastRouteResult, drivers, prevVal === "all" ? null : parseInt(prevVal, 10));
        });
    }, 700);
  }

  function finishPdf(doc, filename) {
    doc.save(filename);
  }

  document.getElementById("btn-pdf-all").addEventListener("click", function () {
    if (!lastRouteResult) return;
    if (typeof window.jspdf === "undefined" || typeof html2canvas === "undefined") {
      alert("PDF kutubxonasi yuklanmadi — internetni tekshirib qayta urinib ko'ring.");
      return;
    }
    var jsPDF = window.jspdf.jsPDF;
    var doc = new jsPDF();
    var sel = document.getElementById("route-view-select");
    var prevVal = sel.value;
    var drivers = lastDrivers;

    function processBus(i) {
      if (i >= lastRouteResult.buses.length) {
        finishPdf(doc, "bekat-barcha-avtobuslar.pdf");
        sel.value = prevVal;
        drawRouteMap(lastRouteResult, drivers, prevVal === "all" ? null : parseInt(prevVal, 10));
        return;
      }
      if (i > 0) doc.addPage();
      doc.setFontSize(18);
      doc.text("Bekat — avtobus yo'nalishi hisoboti", 14, 16);
      sel.value = String(i);
      drawRouteMap(lastRouteResult, drivers, i);
      setTimeout(function () {
        html2canvas(document.getElementById("map-routes"), { useCORS: true, allowTaint: true })
          .then(function (canvas) {
            doc.addImage(canvas.toDataURL("image/png"), "PNG", 14, 24, 182, 90);
            busPdfSection(doc, 122, i, drivers);
            processBus(i + 1);
          })
          .catch(function () {
            busPdfSection(doc, 24, i, drivers);
            processBus(i + 1);
          });
      }, 700);
    }
    processBus(0);
  });
})();
