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

// Yaqin turadigan bolalarni bitta bekatga (maksimal yurish masofasi ichida) yig'ish.
function buildStops(entries, maxWalkM) {
  var stops = [];
  entries.forEach(function (e) {
    var best = null,
      bestDist = Infinity;
    stops.forEach(function (s) {
      var d = estimateWalkMeters(haversineKm(s.lat, s.lng, e.lat, e.lng));
      if (d <= maxWalkM && d < bestDist) {
        best = s;
        bestDist = d;
      }
    });
    if (best) {
      var n = best.students.length;
      best.lat = (best.lat * n + e.lat) / (n + 1);
      best.lng = (best.lng * n + e.lng) / (n + 1);
      best.students.push(e);
    } else {
      stops.push({ lat: e.lat, lng: e.lng, students: [e] });
    }
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

function assignStopsToBuses(stops, busCount, capacities, school) {
  if (!stops.length || busCount <= 0) return { buses: [], overflow: false };
  var seeds = farthestPointSeeds(stops, school, busCount);
  var buses = seeds.map(function (s, i) {
    return { lat: s.lat, lng: s.lng, cap: capacities[i] || DEFAULT_BUS_CAPACITY, stops: [], count: 0 };
  });
  while (buses.length < busCount) {
    buses.push({ lat: school.lat, lng: school.lng, cap: capacities[buses.length] || DEFAULT_BUS_CAPACITY, stops: [], count: 0 });
  }

  var remaining = stops.slice().sort(function (a, b) {
    return haversineKm(school.lat, school.lng, b.lat, b.lng) - haversineKm(school.lat, school.lng, a.lat, a.lng);
  });

  var overflow = false;
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
        var m = b.stops.length;
        b.lat = b.stops.reduce(function (sum, st) { return sum + st.lat; }, 0) / m;
        b.lng = b.stops.reduce(function (sum, st) { return sum + st.lng; }, 0) / m;
        placed = true;
        break;
      }
    }
    if (!placed) {
      var freest = buses.reduce(function (a, b2) { return b2.cap - b2.count > a.cap - a.count ? b2 : a; });
      freest.stops.push(s);
      freest.count += n;
      overflow = true;
    }
  });
  return { buses: buses, overflow: overflow };
}

// Bitta avtobus ichida bekatlarni maktabdan boshlab "eng yaqinini tanlash" (nearest
// neighbor) usulida tartiblash — aniq optimal emas, lekin amalda yaxshi natija beradi.
function orderStops(stops, school) {
  var remaining = stops.slice();
  var order = [];
  var cur = school;
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

// OSRM'ning bepul ommaviy serveridan haqiqiy haydash masofasi/vaqti va yo'l
// chizig'ini so'raymiz. Bu ochiq demo server bo'lgani uchun kafolatlangan SLA
// yo'q — muvaffaqiyatsiz bo'lsa, to'g'ri chiziq asosidagi taxminga tushamiz.
function fetchOsrmRoute(points) {
  var coordStr = points
    .map(function (p) { return p.lng.toFixed(6) + "," + p.lat.toFixed(6); })
    .join(";");
  var url = "https://router.project-osrm.org/route/v1/driving/" + coordStr + "?overview=full&geometries=geojson";

  // Bepul ochiq server sekin javob bersa ham "Hisoblash" tugmasi cheksiz
  // kutib turmasin uchun 8 soniyalik xavfsizlik chegarasi qo'yilgan — shu
  // vaqt ichida javob kelmasa, darhol to'g'ri chiziq asosidagi taxminga
  // o'tiladi (pastdagi .catch).
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
      return { distanceKm: route.distance / 1000, durationMin: route.duration / 60, latlngs: latlngs, real: true };
    })
    .catch(function () {
      if (timeoutId) clearTimeout(timeoutId);
      var distKm = 0;
      for (var i = 1; i < points.length; i++) distKm += haversineKm(points[i - 1].lat, points[i - 1].lng, points[i].lat, points[i].lng);
      distKm *= WALK_CIRCUITY_FACTOR;
      var durationMin = (distKm / 25) * 60; // taxminan 25 km/soat shahar tezligi
      var latlngs = points.map(function (p) { return [p.lat, p.lng]; });
      return { distanceKm: distKm, durationMin: durationMin, latlngs: latlngs, real: false };
    });
}

function computeRoutes(entries, school, busCount, maxWalkM, capacities) {
  var withLoc = entries.filter(function (e) { return e.lat != null && e.lng != null; });
  withLoc.sort(function (a, b) { return a.lat - b.lat || a.lng - b.lng; });
  var stops = buildStops(withLoc, maxWalkM);
  var assign = assignStopsToBuses(stops, busCount, capacities, school);
  var busPromises = assign.buses.map(function (bus) {
    if (!bus.stops.length) return Promise.resolve({ stops: [], count: 0, order: [], route: null });
    var ordered = orderStops(bus.stops, school);
    var points = [school].concat(ordered.map(function (s) { return { lat: s.lat, lng: s.lng }; })).concat([school]);
    return fetchOsrmRoute(points).then(function (route) {
      return { stops: bus.stops, count: bus.count, order: ordered, route: route };
    });
  });
  return Promise.all(busPromises).then(function (buses) {
    return { buses: buses, overflow: assign.overflow, unassignedCount: entries.length - withLoc.length };
  });
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
