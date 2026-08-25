(function () {
  "use strict";

  var ARRIVAL_TIME = "08:20";
  var routeMap = null;
  var routeLayer = null;
  var lastRouteResult = null;
  var lastDrivers = [];

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
        else if (btn.dataset.tab === "yonalishlar") loadSchoolStatus();
        else if (btn.dataset.tab === "royxat") loadRoyxat();
      });
    });
  }

  // ================= RO'YXAT =================
  function loadRoyxat() {
    document.getElementById("rows").innerHTML = '<tr><td colspan="8" class="empty">Yuklanmoqda…</td></tr>';
    Promise.all([apiGet("entries"), apiGet("classes")]).then(function (res) {
      renderRoyxat(res[0] || [], res[1] || []);
    });
  }
  document.getElementById("btn-refresh").addEventListener("click", loadRoyxat);

  function renderRoyxat(entries, classes) {
    var n = entries.length;
    document.getElementById("stat-count").textContent = n;
    document.getElementById("stat-target").textContent = "taxminan " + TARGET_MIN + "–" + TARGET_MAX + " nafardan";
    document.getElementById("stat-bar").style.width = Math.max(0, Math.min(100, Math.round((n / TARGET_MIN) * 100))) + "%";

    var counts = {};
    entries.forEach(function (e) { counts[e.sinf] = (counts[e.sinf] || 0) + 1; });
    var classKeys = classes.length ? classes.map(function (c) { return c.sinf; }) : Object.keys(counts);
    classKeys.sort(compareClasses);
    var fillRows = classKeys.map(function (sinf) {
      var got = counts[sinf] || 0;
      var target = (classes.filter(function (c) { return c.sinf === sinf; })[0] || {}).reja;
      var pct = target ? Math.min(100, Math.round((got / target) * 100)) : null;
      return (
        "<tr><td>" + esc(sinf) + "</td><td>" + got + "</td><td>" + (target != null ? target : "—") + "</td>" +
        "<td>" + (pct != null
          ? '<span class="mini-progress"><i style="width:' + pct + '%"></i></span>' + pct + "%"
          : "—") +
        "</td></tr>"
      );
    });
    document.getElementById("class-fill-rows").innerHTML =
      fillRows.join("") || '<tr><td colspan="4" class="empty">Sinflar hali kiritilmagan</td></tr>';

    var sorted = entries.slice().sort(function (a, b) {
      var c = compareClasses(a.sinf, b.sinf);
      if (c !== 0) return c;
      return String(a.familiya || "").localeCompare(String(b.familiya || ""));
    });
    if (!sorted.length) {
      document.getElementById("rows").innerHTML = '<tr><td colspan="8" class="empty">Hozircha ro\'yxat bo\'sh</td></tr>';
      return;
    }
    var html = [];
    var lastClass = null;
    var idx = 0;
    sorted.forEach(function (e) {
      if (e.sinf !== lastClass) {
        lastClass = e.sinf;
        html.push('<tr class="group-row"><td colspan="8">' + esc(e.sinf) + " — " + (counts[e.sinf] || 0) + " ta</td></tr>");
      }
      idx++;
      var loc = e.lat != null
        ? '<a class="loc-ok" href="' + mapsLinkFor(e.lat, e.lng) + '" target="_blank" rel="noopener">✓ xaritada</a>'
        : "—";
      var when = e.ts ? new Date(e.ts).toLocaleString("uz-UZ") : "—";
      var rowId = "addr-" + idx;
      html.push(
        "<tr>" +
          '<td class="num">' + idx + "</td>" +
          "<td>" + esc(e.ism) + "</td>" +
          "<td>" + esc(e.familiya) + "</td>" +
          "<td>" + esc(e.telefon || "—") + "</td>" +
          "<td>" + loc + "</td>" +
          '<td id="' + rowId + '">' +
            (e.lat != null
              ? '<button type="button" class="addr-btn" data-lat="' + e.lat + '" data-lng="' + e.lng + '" data-target="' + rowId + '">Manzilni aniqlash</button>'
              : "—") +
          "</td>" +
          '<td class="num">' + esc(when) + "</td>" +
          '<td><button type="button" class="tbl-del" data-id="' + esc(e.id) + '" title="O\'chirish">✕</button></td>' +
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
    document.querySelectorAll("#rows .tbl-del").forEach(function (btn) {
      btn.addEventListener("click", function () {
        if (!window.confirm("Bu yozuvni o'chirishni tasdiqlaysizmi?")) return;
        apiPost({ type: "deleteEntry", id: btn.getAttribute("data-id") })
          .then(function () { setTimeout(loadRoyxat, 300); })
          .catch(function () { alert("O'chirilmadi, qayta urinib ko'ring."); });
      });
    });
  }

  document.getElementById("btn-csv").addEventListener("click", function () {
    apiGet("entries").then(function (entries) {
      var sorted = entries.slice().sort(function (a, b) {
        var c = compareClasses(a.sinf, b.sinf);
        if (c !== 0) return c;
        return String(a.familiya || "").localeCompare(String(b.familiya || ""));
      });
      var rows = [["#", "Ism", "Familiya", "Sinf", "Telefon", "Lat", "Lng", "Xarita havolasi", "Vaqt"]];
      sorted.forEach(function (e, i) {
        rows.push([
          i + 1, e.ism, e.familiya, e.sinf, e.telefon || "",
          e.lat != null ? e.lat : "", e.lng != null ? e.lng : "",
          e.lat != null ? mapsLinkFor(e.lat, e.lng) : "", e.ts || "",
        ]);
      });
      downloadCsv("bekat-royxati.csv", rows);
    });
  });

  // ================= SINFLAR =================
  function classRowHtml(sinf, reja) {
    return (
      '<tr><td><input class="tbl-input cls-sinf" value="' + esc(sinf || "") + '" placeholder="masalan 5-A"></td>' +
      '<td><input class="tbl-input cls-reja" type="text" inputmode="numeric" value="' + esc(reja == null ? "" : reja) + '" placeholder="30"></td>' +
      '<td><button type="button" class="tbl-del">✕</button></td></tr>'
    );
  }
  function loadClasses() {
    apiGet("classes").then(function (list) {
      var tbody = document.getElementById("classes-rows");
      tbody.innerHTML = (list || []).map(function (c) { return classRowHtml(c.sinf, c.reja); }).join("") || classRowHtml("", "");
    });
  }
  document.getElementById("btn-add-class").addEventListener("click", function () {
    document.getElementById("classes-rows").insertAdjacentHTML("beforeend", classRowHtml("", ""));
  });
  document.getElementById("classes-rows").addEventListener("click", function (ev) {
    if (ev.target.classList.contains("tbl-del")) ev.target.closest("tr").remove();
  });
  document.getElementById("btn-save-classes").addEventListener("click", function () {
    var items = Array.prototype.map
      .call(document.querySelectorAll("#classes-rows tr"), function (tr) {
        return { sinf: tr.querySelector(".cls-sinf").value.trim(), reja: tr.querySelector(".cls-reja").value.trim() || null };
      })
      .filter(function (c) { return c.sinf; });
    var msg = document.getElementById("classes-msg");
    apiPost({ type: "classes", items: items })
      .then(function () { msg.textContent = "Saqlandi ✓"; msg.className = "form-ok"; })
      .catch(function () { msg.textContent = "Saqlanmadi — internetni tekshiring."; msg.className = "form-error"; });
  });

  // ================= ROSTER =================
  function rosterRowHtml(sinf, ism, familiya) {
    return (
      '<tr><td><input class="tbl-input ro-sinf" value="' + esc(sinf || "") + '" placeholder="5-A"></td>' +
      '<td><input class="tbl-input ro-ism" value="' + esc(ism || "") + '"></td>' +
      '<td><input class="tbl-input ro-familiya" value="' + esc(familiya || "") + '"></td>' +
      '<td><button type="button" class="tbl-del">✕</button></td></tr>'
    );
  }
  function loadRoster() {
    apiGet("roster").then(function (list) {
      var tbody = document.getElementById("roster-rows");
      tbody.innerHTML = (list || []).map(function (r) { return rosterRowHtml(r.sinf, r.ism, r.familiya); }).join("") || rosterRowHtml("", "", "");
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
      '<td><input class="tbl-input dr-telefon" value="' + esc(telefon || "") + '" placeholder="+998 90 123 45 67"></td>' +
      '<td><input class="tbl-input dr-rang" type="color" value="' + esc(rang || "#1F3A5F") + '"></td>' +
      '<td><input class="tbl-input dr-sigim" type="text" inputmode="numeric" value="' + esc(sigim == null ? "" : sigim) + '" placeholder="50"></td>' +
      '<td><button type="button" class="tbl-del">✕</button></td></tr>'
    );
  }
  function loadDrivers() {
    apiGet("drivers").then(function (list) {
      var tbody = document.getElementById("drivers-rows");
      tbody.innerHTML = (list || []).map(function (d) { return driverRowHtml(d.raqam, d.haydovchi, d.telefon, d.rang, d.sigim); }).join("") || driverRowHtml("", "", "", "", "");
    });
  }
  document.getElementById("btn-add-driver").addEventListener("click", function () {
    document.getElementById("drivers-rows").insertAdjacentHTML("beforeend", driverRowHtml("", "", "", "", ""));
  });
  document.getElementById("drivers-rows").addEventListener("click", function (ev) {
    if (ev.target.classList.contains("tbl-del")) ev.target.closest("tr").remove();
  });
  document.getElementById("btn-save-drivers").addEventListener("click", function () {
    var items = Array.prototype.map
      .call(document.querySelectorAll("#drivers-rows tr"), function (tr) {
        return {
          raqam: tr.querySelector(".dr-raqam").value.trim(),
          haydovchi: tr.querySelector(".dr-haydovchi").value.trim(),
          telefon: tr.querySelector(".dr-telefon").value.trim(),
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
      var el = document.getElementById("school-status");
      el.textContent = currentSchool
        ? "Belgilangan: " + currentSchool.lat.toFixed(6) + ", " + currentSchool.lng.toFixed(6)
        : "Belgilanmagan — yo'nalishlarni hisoblashdan oldin belgilang.";
    });
  }

  document.getElementById("btn-school-gps").addEventListener("click", function () {
    if (!navigator.geolocation) { alert("Brauzer joylashuvni aniqlay olmaydi."); return; }
    navigator.geolocation.getCurrentPosition(
      function (pos) {
        var lat = pos.coords.latitude, lng = pos.coords.longitude;
        apiPost({ type: "school", lat: lat, lng: lng }).then(function () {
          currentSchool = { lat: lat, lng: lng };
          document.getElementById("school-status").textContent = "Belgilangan: " + lat.toFixed(6) + ", " + lng.toFixed(6);
        });
      },
      function () { alert("Joylashuvni aniqlab bo'lmadi."); },
      { enableHighAccuracy: true, timeout: 12000 }
    );
  });

  document.getElementById("btn-compute").addEventListener("click", function () {
    var msg = document.getElementById("route-msg");
    msg.textContent = "";
    if (!currentSchool) {
      msg.textContent = "Avval maktab joylashuvini belgilang.";
      msg.className = "form-error";
      return;
    }
    var busCount = parseInt(document.getElementById("rt-buscount").value, 10) || 0;
    var maxWalkM = parseInt(document.getElementById("rt-maxwalk").value, 10) || DEFAULT_MAX_WALK_M;
    if (busCount < 1) {
      msg.textContent = "Avtobuslar sonini kiriting.";
      msg.className = "form-error";
      return;
    }
    msg.textContent = "Hisoblanmoqda… (bir necha soniya)";
    msg.className = "form-ok";

    Promise.all([apiGet("entries"), apiGet("drivers")]).then(function (res) {
      var entries = res[0] || [];
      var drivers = (res[1] || []).slice().sort(function (a, b) { return String(a.raqam).localeCompare(String(b.raqam), undefined, { numeric: true }); });
      lastDrivers = drivers;
      var capacities = [];
      for (var i = 0; i < busCount; i++) capacities.push(drivers[i] && drivers[i].sigim ? drivers[i].sigim : DEFAULT_BUS_CAPACITY);

      computeRoutes(entries, currentSchool, busCount, maxWalkM, capacities).then(function (result) {
        lastRouteResult = result;
        msg.textContent = "";
        if (result.overflow) {
          msg.textContent = "Diqqat: ba'zi bekatlar sig'imdan oshib ketdi — avtobus sonini yoki sig'imni oshiring.";
          msg.className = "form-error";
        }
        if (result.unassignedCount > 0) {
          msg.textContent += (msg.textContent ? " " : "") + result.unassignedCount + " ta bolaning joylashuvi yo'q, hisobga olinmadi.";
          msg.className = "form-error";
        }
        renderRouteResults(result, drivers);
      });
    });
  });

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

    L.marker([currentSchool.lat, currentSchool.lng]).bindPopup("Maktab").addTo(routeLayer);

    result.buses.forEach(function (bus, i) {
      if (focusIndex != null && focusIndex !== i) return;
      if (!bus.route) return;
      var color = busColor(i, drivers);
      L.polyline(bus.route.latlngs, { color: color, weight: 4, opacity: 0.85 }).addTo(routeLayer);
      bus.order.forEach(function (s, idx) {
        var names = s.students.map(function (st) { return esc(st.ism + " " + st.familiya); }).join("<br>");
        L.circleMarker([s.lat, s.lng], { radius: 8, color: color, fillColor: color, fillOpacity: 1, weight: 2 })
          .bindPopup("<b>Bekat " + (idx + 1) + "</b><br>" + names)
          .addTo(routeLayer);
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
        var dep = suggestDeparture(bus.route.durationMin, bus.order.length, ARRIVAL_TIME);
        var approxNote = bus.route.real ? "" : ' <span title="OSRM xizmatiga ulanib bo\'lmadi, taxminiy hisob">(taxminiy)</span>';
        var chips = bus.order
          .map(function (s, idx) {
            return s.students
              .map(function (st) {
                return '<span class="bus-student-chip" data-id="' + esc(st.id) + '" data-stop="' + (idx + 1) + '">' + (idx + 1) + ". " + esc(st.ism) + " " + esc(st.familiya) + "</span>";
              })
              .join("");
          })
          .join("");
        return (
          '<div class="bus-card">' +
            '<div class="bus-card-head"><span class="bus-swatch" style="background:' + busColor(i, drivers) + '"></span>' +
            "<b>Avtobus " + (i + 1) + "</b>" +
            '<span class="bus-meta">' + km + " km · " + min + " daqiqa" + approxNote + " · " + bus.count + " bola · chiqish ~" + dep + "</span></div>" +
            '<p class="hint" style="margin:8px 0 0;">' + driverInfo + "</p>" +
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
  }

  function openStudentModal(student, stopNumber) {
    var body = document.getElementById("modal-body");
    body.innerHTML =
      "<h3>" + esc(student.ism) + " " + esc(student.familiya) + "</h3>" +
      '<div class="modal-row"><span>Sinf</span><span>' + esc(student.sinf) + "</span></div>" +
      '<div class="modal-row"><span>Telefon</span><span>' + esc(student.telefon || "—") + "</span></div>" +
      '<div class="modal-row"><span>Bekat</span><span>' + (stopNumber || "—") + "-bekat</span></div>" +
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
})();
