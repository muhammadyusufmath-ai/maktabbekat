// Avtobus yo'nalishlarini hisoblash: bolalarni yaqin bekatlarga birlashtirish,
// bekatlarni avtobuslarga (sig'imga qarab) taqsimlash, har bir avtobus uchun
// tartibni aniqlash va OSRM (bepul, ochiq) orqali haqiqiy yo'l masofasi/vaqtini
// olish. OSRM ishlamasa (internet yoki xizmat vaqtincha yo'q), to'g'ri chiziq
// asosidagi taxminga o'tadi — buni natijada "real: false" bilan bildiradi.

var BUS_PALETTE = ["#1F3A5F", "#E2A33B", "#2F7D53", "#B3261E", "#6E4FA6", "#1B8A9C", "#C2554B", "#4C6B2C", "#A6763C", "#4361A8"];

function busColor(i, drivers) {
  return (drivers && drivers[i] && drivers[i].rang) || BUS_PALETTE[i % BUS_PALETTE.length];
}

function estimateWalkMeters(km) {
  return km * 1000 * WALK_CIRCUITY_FACTOR;
}

function addMinutesToClock(hhmm, minsToAdd) {
  var parts = String(hhmm || "08:20").split(":");
  var d = new Date(2000, 0, 1, parseInt(parts[0], 10) || 8, parseInt(parts[1], 10) || 20);
  d = new Date(d.getTime() + Math.round(minsToAdd) * 60000);
  function pad(n) { return (n < 10 ? "0" : "") + n; }
  return pad(d.getHours()) + ":" + pad(d.getMinutes());
}

// Har bir o'quvchi uchun samarali "bekat" koordinatasi — agar admin xaritada
// bu bekatni qo'lda ko'chirgan bo'lsa (BekatLat/BekatLng), o'shani, aks holda
// uyning haqiqiy joylashuvini ishlatadi.
function effectiveStopPoint(entry) {
  return {
    lat: entry.bekatLat != null ? entry.bekatLat : entry.lat,
    lng: entry.bekatLng != null ? entry.bekatLng : entry.lng,
  };
}

// Yaqin turadigan bolalarni bitta bekatga (maksimal yurish masofasi ichida) yig'ish.
function buildStops(entries, maxWalkM) {
  var stops = [];
  entries.forEach(function (e) {
    var p = effectiveStopPoint(e);
    var best = null,
      bestDist = Infinity;
    stops.forEach(function (s) {
      var d = estimateWalkMeters(haversineKm(s.lat, s.lng, p.lat, p.lng));
      if (d <= maxWalkM && d < bestDist) {
        best = s;
        bestDist = d;
      }
    });
    if (best) {
      var n = best.students.length;
      best.lat = (best.lat * n + p.lat) / (n + 1);
      best.lng = (best.lng * n + p.lng) / (n + 1);
      best.students.push(e);
    } else {
      stops.push({ lat: p.lat, lng: p.lng, students: [e] });
    }
  });
  // Admin tomonidan "shu avtobusga" deb qo'lda belgilangan (override)
  // o'quvchisi bor bekatlarni aniqlaymiz — shu bekat o'sha avtobusga
  // "mahkamlanadi" (pinned), boshqa hisoblash bosqichlari uni siljitmaydi.
  stops.forEach(function (s) {
    var forced = null;
    s.students.forEach(function (st) {
      if (forced == null && st._forcedBusIndex != null) forced = st._forcedBusIndex;
    });
    s.forcedBusIndex = forced;
  });
  return stops;
}

// Bekatlarni maktabdan eng uzoqdan boshlab "farthest-point" usulida urug'lab,
// so'ng sig'imga qarab avtobuslarga taqsimlash.
function farthestPointSeeds(stops, school, k) {
  if (!stops.length) return [];
  var chosen = [
    stops.reduce(function (a, b) {
      return haversineKm(school.lat, school.lng, b.lat, b.lng) > haversineKm(school.lat, school.lng, a.lat, a.lng) ? b : a;
    }),
  ];
  while (chosen.length < k && chosen.length < stops.length) {
    var best = null,
      bestMinDist = -1;
    stops.forEach(function (s) {
      if (chosen.indexOf(s) !== -1) return;
      var minD = Math.min.apply(
        null,
        chosen.map(function (c) {
          return haversineKm(c.lat, c.lng, s.lat, s.lng);
        })
      );
      if (minD > bestMinDist) {
        bestMinDist = minD;
        best = s;
      }
    });
    if (best) chosen.push(best);
    else break;
  }
  return chosen;
}

// Bekatlarni avtobuslarga taqsimlaydi. Agar bekat sig'imga sig'masa, endi
// "eng bo'sh avtobusga" majburan tiqilmaydi — buning o'rniga "unassigned"
// ro'yxatiga tushadi va admin panelda ogohlantirish bilan ko'rsatilib,
// admin o'zi qo'lda qaysi avtobusga qo'shishni tanlaydi.
function assignStopsToBuses(stops, busCount, capacities, school) {
  if (!stops.length || busCount <= 0) return { buses: [], unassigned: [] };

  var forcedStops = stops.filter(function (s) { return s.forcedBusIndex != null; });
  var freeStops = stops.filter(function (s) { return s.forcedBusIndex == null; });

  var seedPool = freeStops.length ? freeStops : stops;
  var seeds = farthestPointSeeds(seedPool, school, busCount);
  var buses = seeds.map(function (s, i) {
    return { lat: s.lat, lng: s.lng, cap: capacities[i] || DEFAULT_BUS_CAPACITY, stops: [], count: 0 };
  });
  while (buses.length < busCount) {
    buses.push({ lat: school.lat, lng: school.lng, cap: capacities[buses.length] || DEFAULT_BUS_CAPACITY, stops: [], count: 0 });
  }

  function recenter(b) {
    var m = b.stops.length;
    if (!m) return;
    b.lat = b.stops.reduce(function (sum, st) { return sum + st.lat; }, 0) / m;
    b.lng = b.stops.reduce(function (sum, st) { return sum + st.lng; }, 0) / m;
  }

  // 1) Admin tomonidan "shu avtobusga" deb qat'iy belgilangan bekatlar —
  // sig'imdan qat'i nazar shu avtobusga qo'yiladi (admin ongli ravishda
  // shuni tanlagan, masalan avvalgi ortiqcha yukni yechish uchun).
  forcedStops.forEach(function (s) {
    var i = Math.max(0, Math.min(s.forcedBusIndex, buses.length - 1));
    buses[i].stops.push(s);
    buses[i].count += s.students.length;
    recenter(buses[i]);
  });

  var remaining = freeStops.slice().sort(function (a, b) {
    return haversineKm(school.lat, school.lng, b.lat, b.lng) - haversineKm(school.lat, school.lng, a.lat, a.lng);
  });

  var unassigned = [];
  remaining.forEach(function (s) {
    var n = s.students.length;
    var order = buses
      .map(function (b, i) { return i; })
      .sort(function (i, j) {
        return haversineKm(buses[i].lat, buses[i].lng, s.lat, s.lng) - haversineKm(buses[j].lat, buses[j].lng, s.lat, s.lng);
      });
    var placed = false;
    for (var k = 0; k < order.length; k++) {
      var b = buses[order[k]];
      if (b.count + n <= b.cap) {
        b.stops.push(s);
        b.count += n;
        recenter(b);
        placed = true;
        break;
      }
    }
    if (!placed) unassigned.push(s);
  });
  return { buses: buses, unassigned: unassigned };
}

// Bitta avtobus ichida bekatlarni tartiblash: ertalabki yig'ish yo'nalishi
// odatda eng UZOQ bekatdan boshlanadi va maktabga yaqinlashib boradi (bo'sh
// avtobus dastavval eng uzoqqa boradi, keyin bolalarni yig'ib maktabga
// qaytadi) — shuning uchun "boshlash nuqtasi" doim eng uzoq bekat bo'ladi,
// bu xaritada ham alohida belgi bilan ko'rsatiladi.
function orderStops(stops, school) {
  if (!stops.length) return [];
  var remaining = stops.slice();
  var startIdx = 0,
    startD = -1;
  remaining.forEach(function (s, i) {
    var d = haversineKm(school.lat, school.lng, s.lat, s.lng);
    if (d > startD) {
      startD = d;
      startIdx = i;
    }
  });
  var order = [remaining.splice(startIdx, 1)[0]];
  var cur = order[0];
  while (remaining.length) {
    var bestIdx = 0,
      bestD = Infinity;
    remaining.forEach(function (s, i) {
      var d = haversineKm(cur.lat, cur.lng, s.lat, s.lng);
      if (d < bestD) {
        bestD = d;
        bestIdx = i;
      }
    });
    var next = remaining.splice(bestIdx, 1)[0];
    order.push(next);
    cur = next;
  }
  return order;
}

// OSRM'ning bepul ommaviy serveridan haqiqiy haydash masofasi/vaqti, har bir
// bo'lak (leg) uchun alohida vaqt (har bir bekatga taxminiy yetib kelish
// vaqtini hisoblash uchun kerak) va yo'l chizig'ini so'raymiz. Bu ochiq demo
// server bo'lgani uchun kafolatlangan SLA yo'q — muvaffaqiyatsiz yoki 8
// soniyadan sekin javob bersa, to'g'ri chiziq asosidagi taxminga tushamiz.
function fetchOsrmRoute(points) {
  var coordStr = points
    .map(function (p) { return p.lng.toFixed(6) + "," + p.lat.toFixed(6); })
    .join(";");
  var url = "https://router.project-osrm.org/route/v1/driving/" + coordStr + "?overview=full&geometries=geojson";

  var controller = typeof AbortController !== "undefined" ? new AbortController() : null;
  var timeoutId = controller ? setTimeout(function () { controller.abort(); }, 8000) : null;

  return fetch(url, controller ? { signal: controller.signal } : {})
    .then(function (r) {
      if (timeoutId) clearTimeout(timeoutId);
      if (!r.ok) throw new Error("osrm_bad_response");
      return r.json();
    })
    .then(function (data) {
      if (!data.routes || !data.routes[0]) throw new Error("no_route");
      var route = data.routes[0];
      var latlngs = route.geometry.coordinates.map(function (c) { return [c[1], c[0]]; });
      var legs = (route.legs || []).map(function (l) { return { distanceKm: l.distance / 1000, durationMin: l.duration / 60 }; });
      return { distanceKm: route.distance / 1000, durationMin: route.duration / 60, latlngs: latlngs, legs: legs, real: true };
    })
    .catch(function () {
      if (timeoutId) clearTimeout(timeoutId);
      var legs = [];
      var distKm = 0;
      for (var i = 1; i < points.length; i++) {
        var d = haversineKm(points[i - 1].lat, points[i - 1].lng, points[i].lat, points[i].lng) * WALK_CIRCUITY_FACTOR;
        var durMin = (d / 25) * 60; // taxminan 25 km/soat shahar tezligi
        legs.push({ distanceKm: d, durationMin: durMin });
        distKm += d;
      }
      var durationMin = legs.reduce(function (s, l) { return s + l.durationMin; }, 0);
      var latlngs = points.map(function (p) { return [p.lat, p.lng]; });
      return { distanceKm: distKm, durationMin: durationMin, latlngs: latlngs, legs: legs, real: false };
    });
}

// Har bir bekatga taxminiy yetib kelish (bolani olish) vaqtini hisoblaydi.
// legs[0] = maktab->1-bekat (bo'sh avtobusning yo'lga chiqishi), legs[k] =
// (k-1)-bekat->k-bekat, oxirgi leg = oxirgi bekat->maktab.
function computeStopClockTimes(legs, stopCount, depClock, dwellMin) {
  var times = [];
  var cum = 0;
  for (var k = 0; k < stopCount; k++) {
    cum += (legs[k] ? legs[k].durationMin : 0);
    times.push(addMinutesToClock(depClock, cum + k * dwellMin));
  }
  return times;
}

// Maktabga 08:20 da yetib borish uchun tavsiya etilgan chiqish vaqti.
// Har bir bekatda ~1 daqiqa yig'ilish vaqtini ham hisobga oladi.
function suggestDeparture(durationMin, stopCount, arrivalHHMM) {
  var parts = String(arrivalHHMM || "08:20").split(":");
  var arrival = new Date(2000, 0, 1, parseInt(parts[0], 10) || 8, parseInt(parts[1], 10) || 20);
  var totalMin = Math.ceil(durationMin + stopCount * 1);
  var dep = new Date(arrival.getTime() - totalMin * 60000);
  function pad(n) { return (n < 10 ? "0" : "") + n; }
  return pad(dep.getHours()) + ":" + pad(dep.getMinutes());
}

var DWELL_MIN_PER_STOP = 1;

function computeRoutes(entries, school, busCount, maxWalkM, capacities, opts) {
  opts = opts || {};
  var arrivalHHMM = opts.arrivalHHMM || "08:20";
  var schoolWalkRadiusM = opts.schoolWalkRadiusM || 0;
  var resolveOverrideIndex = opts.resolveOverrideIndex || function () { return null; };

  var withLoc = entries.filter(function (e) { return e.lat != null && e.lng != null; });
  withLoc.forEach(function (e) {
    e._forcedBusIndex = e.avtobusOverride ? resolveOverrideIndex(e.avtobusOverride) : null;
  });

  // Maktabga juda yaqin (piyoda radiusi ichida) bolalarni avtobus
  // hisobidan chiqarib, alohida "piyoda tavsiya etiladi" ro'yxatiga olamiz.
  var walkers = [];
  var riders = [];
  withLoc.forEach(function (e) {
    var p = effectiveStopPoint(e);
    var distM = estimateWalkMeters(haversineKm(school.lat, school.lng, p.lat, p.lng));
    if (schoolWalkRadiusM > 0 && distM <= schoolWalkRadiusM && e._forcedBusIndex == null) {
      walkers.push(e);
    } else {
      riders.push(e);
    }
  });

  riders.sort(function (a, b) { return a.lat - b.lat || a.lng - b.lng; });
  var stops = buildStops(riders, maxWalkM);
  var assign = assignStopsToBuses(stops, busCount, capacities, school);
  var busPromises = assign.buses.map(function (bus) {
    if (!bus.stops.length) return Promise.resolve({ stops: [], count: 0, order: [], route: null, stopTimes: [], departure: null });
    var ordered = orderStops(bus.stops, school);
    var points = [school].concat(ordered.map(function (s) { return { lat: s.lat, lng: s.lng }; })).concat([school]);
    return fetchOsrmRoute(points).then(function (route) {
      var dep = suggestDeparture(route.durationMin, ordered.length, arrivalHHMM);
      var stopTimes = computeStopClockTimes(route.legs || [], ordered.length, dep, DWELL_MIN_PER_STOP);
      return { stops: bus.stops, count: bus.count, order: ordered, route: route, stopTimes: stopTimes, departure: dep };
    });
  });
  return Promise.all(busPromises).then(function (buses) {
    return {
      buses: buses,
      unassigned: assign.unassigned,
      unassignedCount: entries.length - withLoc.length,
      walkers: walkers,
    };
  });
}
