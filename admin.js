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
        else if (btn.dataset.tab === "yonalishlar") { loadSchoolStatus(); setTimeout(initSchoolMapIfNeeded, 50); }
        else if (btn.dataset.tab === "royxat") loadRoyxat();
      });
    });
  }

  function setupDaySelect() {
    var sel = document.getElementById("rt-day");
    sel.innerHTML = WEEKDAYS_UZ.map(function (d) { return '<option value="' + d.code + '">' + d.label + "</option>"; }).join("");
    sel.value = todayWeekdayCode();
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

    var sorted = entries.slice().sort(function (a, b) {
      var c = compareClasses(a.sinf, b.sinf);
      if (c !== 0) return c;
      return String(a.familiya || "").localeCompare(String(b.familiya || ""));
    });
    if (!sorted.length) {
      document.getElementById("rows").innerHTML = '<tr><td colspan="9" class="empty">Hozircha ro\'yxat bo\'sh</td></tr>';
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
      var turarJoy = e.turarJoy === "yotoqxona"
        ? "Yotoqxona" + ((e.kunlar || []).length ? " (" + e.kunlar.join(", ") + ")" : " (kun belgilanmagan)")
        : "Kundalik";
      html.push(
        "<tr>" +
          '<td class="num">' + idx + "</td>" +
          "<td>" + esc(e.ism) + "</td>" +
          "<td>" + esc(e.familiya) + "</td>" +
          "<td>" + esc(e.telefon || "—") + "</td>" +
          "<td>" + esc(turarJoy) + "</td>" +
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

  // ---- CSV filtri + eksport ----
  function fillCsvClassFilter(classes, entries) {
    var sel = document.getElementById("csv-class-filter");
    var names = classes.length ? classes.map(function (c) { return c.sinf; }) : Array.from(new Set(entries.map(function (e) { return e.sinf; })));
    names.sort(compareClasses);
    sel.innerHTML = names.map(function (n) { return '<option value="' + esc(n) + '">' + esc(n) + "</option>"; }).join("");
  }

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
      var rows = [["#", "Ism", "Familiya", "Sinf", "Telefon", "Turar joy", "Kunlar", "Lat", "Lng", "Xarita havolasi", "Vaqt"]];
      sorted.forEach(function (e, i) {
        rows.push([
          i + 1, e.ism, e.familiya, e.sinf, e.telefon || "", e.turarJoy || "kundalik", (e.kunlar || []).join(" "),
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
    var isDorm = entry.turarJoy === "yotoqxona";
    body.innerHTML =
      "<h3>Ma'lumotni tahrirlash</h3>" +
      '<label>Ism</label><input type="text" id="ee-ism" value="' + esc(entry.ism) + '">' +
      '<label>Familiya</label><input type="text" id="ee-familiya" value="' + esc(entry.familiya) + '">' +
      '<label>Sinf</label><select id="ee-sinf">' + classOptions.map(function (c) { return '<option value="' + esc(c) + '"' + (c === entry.sinf ? " selected" : "") + ">" + esc(c) + "</option>"; }).join("") + "</select>" +
      '<label>Telefon</label><div class="phone-row"><span class="phone-prefix">+998</span><input type="tel" id="ee-phone" value="' + esc(localPhoneDigitsFromFull(entry.telefon)) + '"></div>' +
      '<label>Turar joy</label>' +
      '<div class="row2"><label style="display:flex;align-items:center;gap:6px;font-weight:400;margin:0;"><input type="radio" name="ee-turarjoy" value="kundalik"' + (!isDorm ? " checked" : "") + ' style="width:auto;"> Kundalik</label>' +
      '<label style="display:flex;align-items:center;gap:6px;font-weight:400;margin:0;"><input type="radio" name="ee-turarjoy" value="yotoqxona"' + (isDorm ? " checked" : "") + ' style="width:auto;"> Yotoqxona</label></div>' +
      '<div id="ee-days" style="margin-top:12px;' + (isDorm ? "" : "display:none;") + '">' +
        '<label>Avtobusdan foydalanadigan kunlar</label>' +
        '<div class="row2" style="flex-wrap:wrap;">' +
        WEEKDAYS_UZ.map(function (d) {
          var checked = (entry.kunlar || []).indexOf(d.code) !== -1 ? " checked" : "";
          return '<label style="display:flex;align-items:center;gap:5px;font-weight:400;margin:0;flex:none;width:auto;"><input type="checkbox" class="ee-day" value="' + d.code + '"' + checked + ' style="width:auto;"> ' + d.label + "</label>";
        }).join("") +
        "</div></div>" +
      '<button type="button" class="btn-primary" id="ee-save">Saqlash</button>' +
      '<div class="form-error" id="ee-msg"></div>';

    Array.prototype.forEach.call(body.querySelectorAll('input[name="ee-turarjoy"]'), function (r) {
      r.addEventListener("change", function () {
        var checked = body.querySelector('input[name="ee-turarjoy"]:checked');
        document.getElementById("ee-days").style.display = checked && checked.value === "yotoqxona" ? "" : "none";
      });
    });
    attachPhoneMask(document.getElementById("ee-phone"), function () {});

    document.getElementById("ee-save").addEventListener("click", function () {
      var msg = document.getElementById("ee-msg");
      var turarJoy = document.querySelector('input[name="ee-turarjoy"]:checked').value;
      var kunlar = turarJoy === "yotoqxona"
        ? Array.prototype.filter.call(body.querySelectorAll(".ee-day"), function (c) { return c.checked; }).map(function (c) { return c.value; })
        : [];
      var fields = {
        ism: document.getElementById("ee-ism").value.trim(),
        familiya: document.getElementById("ee-familiya").value.trim(),
        sinf: document.getElementById("ee-sinf").value,
        telefon: fullPhone(document.getElementById("ee-phone").value),
        turarJoy: turarJoy,
        kunlar: kunlar.join(","),
      };
      apiUpdateEntry(entry.id, fields)
        .then(function () {
          msg.textContent = "Saqlandi ✓";
          msg.className = "form-ok";
          setTimeout(function () {
            document.getElementById("entry-edit-backdrop").hidden = true;
            loadRoyxat();
          }, 500);
        })
        .catch(function () { msg.textContent = "Saqlanmadi — internetni tekshiring."; msg.className = "form-error"; });
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
    var msg = document.getElementById("classes-msg");
    apiPost({ type: "classes", items: items })
      .then(function () { msg.textContent = "Saqlandi ✓"; msg.className = "form-ok"; })
      .catch(function () { msg.textContent = "Saqlanmadi — internetni tekshiring."; msg.className = "form-error"; });
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
  function loadRoster() {
    Promise.all([apiGet("roster"), apiGet("classes")]).then(function (res) {
      lastClasses = res[1] || [];
      var tbody = document.getElementById("roster-rows");
      tbody.innerHTML = (res[0] || []).map(function (r) { return rosterRowHtml(r.sinf, r.ism, r.familiya); }).join("") || rosterRowHtml("", "", "");
    });
  }
  document.getElementById("btn-add-roster-row").addEventListener("click", function () {
    document.getElementById("roster-rows").insertAdjacentHTML("beforeend", rosterRowHtml("", "", ""));
  });
  document.getElementById("roster-rows").addEventListener("click", function (ev) {
    if (ev.target.classList.contains("tbl-del")) ev.target.closest("tr").remove();
  });
  document.getElementById("btn-bulk-add").addEventListener("click", function () {
    var raw = document.getElementById("roster-bulk").value;
    var lines = raw.split("\n").map(function (l) { return l.trim(); }).filter(Boolean);
    var html = lines
      .map(function (line) {
        var parts = line.split(/[,\t]/).map(function (p) { return p.trim(); });
        return rosterRowHtml(parts[0] || "", parts[1] || "", parts[2] || "");
      })
      .join("");
    document.getElementById("roster-rows").insertAdjacentHTML("beforeend", html);
    document.getElementById("roster-bulk").value = "";
  });
  document.getElementById("btn-save-roster").addEventListener("click", function () {
    var items = Array.prototype.map
      .call(document.querySelectorAll("#roster-rows tr"), function (tr) {
        return {
          sinf: tr.querySelector(".ro-sinf").value.trim(),
          ism: tr.querySelector(".ro-ism").value.trim(),
          familiya: tr.querySelector(".ro-familiya").value.trim(),
        };
      })
      .filter(function (r) { return r.ism || r.familiya; });
    var msg = document.getElementById("roster-msg");
    apiPost({ type: "roster", items: items })
      .then(function () { msg.textContent = "Saqlandi ✓ (" + items.length + " ta)"; msg.className = "form-ok"; })
      .catch(function () { msg.textContent = "Saqlanmadi — internetni tekshiring."; msg.className = "form-error"; });
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
    var msg = document.getElementById("drivers-msg");
    apiPost({ type: "drivers", items: items })
      .then(function () { msg.textContent = "Saqlandi ✓"; msg.className = "form-ok"; })
      .catch(function () { msg.textContent = "Saqlanmadi — internetni tekshiring."; msg.className = "form-error"; });
  });

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
    var busCount = parseInt(document.getElementById("rt-buscount").value, 10) || 0;
    var maxWalkM = parseInt(document.getElementById("rt-maxwalk").value, 10) || DEFAULT_MAX_WALK_M;
    var walkRadiusM = parseInt(document.getElementById("rt-walkradius").value, 10) || 0;
    var selectedDay = document.getElementById("rt-day").value;
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

      // Yotoqxona jadvali: kundalik o'quvchilar doim hisobga olinadi,
      // yotoqxonadagilar faqat o'ziga belgilangan kunlarda.
      var entries = allEntries.filter(function (e) {
        if (e.turarJoy !== "yotoqxona") return true;
        return (e.kunlar || []).indexOf(selectedDay) !== -1;
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

  function startIcon(color) {
    return L.divIcon({
      className: "",
      html: '<div style="font-size:22px;line-height:1;filter:drop-shadow(0 2px 2px rgba(0,0,0,.35));transform:translate(-4px,-6px);">🚩</div>',
      iconSize: [24, 24],
      iconAnchor: [4, 24],
    });
  }

  function persistStopMove(stop, lat, lng) {
    stop.lat = lat;
    stop.lng = lng;
    Promise.all(stop.students.map(function (st) { return apiUpdateEntry(st.id, { bekatLat: lat, bekatLng: lng }); }))
      .then(function () { showToast("Bekat joylashuvi yangilandi (keyingi hisoblashda hisobga olinadi)"); })
      .catch(function () {});
  }

  function drawRouteMap(result, drivers, focusIndex) {
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
          marker = L.marker([s.lat, s.lng], { icon: startIcon(color), draggable: true }).bindPopup(label);
        } else {
          marker = L.marker([s.lat, s.lng], {
            draggable: true,
            icon: L.divIcon({
              className: "",
              html: '<div style="width:16px;height:16px;border-radius:50%;background:' + color + ';border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,.4);"></div>',
              iconSize: [16, 16],
              iconAnchor: [8, 8],
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
            '<span class="bus-meta">' + km + " km · " + min + " daqiqa" + approxNote + " · " + bus.count + " bola · chiqish ~" + bus.departure + "</span></div>" +
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
    doc.text("Haydovchi: " + (d.haydovchi || "-") + "   Tel: " + (d.telefon || "-") + "   Rang: " + (d.rang || "-") + "   Sig'im: " + (d.sigim || "-"), 14, y);
    y += 6;
    if (bus && bus.route) {
      doc.text(
        bus.route.distanceKm.toFixed(1) + " km, " + Math.round(bus.route.durationMin) + " daqiqa, " + bus.count + " bola, chiqish ~" + bus.departure + ", maktabga yetib borish ~" + ARRIVAL_TIME,
        14, y
      );
      y += 8;
    }
    doc.setFontSize(10);
    doc.text("#  Ism Familiya            Sinf     Telefon           Vaqt", 14, y);
    y += 5;
    doc.setDrawColor(200);
    doc.line(14, y, 196, y);
    y += 5;
    if (bus) {
      bus.order.forEach(function (s, idx) {
        var t = bus.stopTimes && bus.stopTimes[idx] ? bus.stopTimes[idx] : "-";
        s.students.forEach(function (st) {
          if (y > 280) { doc.addPage(); y = 20; }
          doc.text(
            String(idx + 1).padEnd(3) + (st.ism + " " + st.familiya).slice(0, 22).padEnd(24) + String(st.sinf || "-").padEnd(9) + String(st.telefon || "-").padEnd(18) + "~" + t,
            14, y
          );
          y += 5.5;
        });
      });
    }
    return y + 6;
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
