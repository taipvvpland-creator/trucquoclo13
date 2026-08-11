(function () {
  "use strict";

  const STATUS_CLASS = {
    "new": "status-new",
    "selling": "status-selling",
    "handed-over": "status-handed-over",
    "upcoming": "status-upcoming"
  };

  const LANDMARK_EMOJI = {
    shopping: "🛒",
    hospital: "🏥",
    market: "🏪",
    golf: "⛳"
  };

  const state = {
    data: null,
    activeZone: "all",
    activeStatus: "all",
    map: null,
    markers: {},
    activeId: null,
    landmarkMarkers: [],
    labelsVisible: false
  };

  function money(p) {
    if (p.priceUnannounced) return "Chưa công bố";
    if (p.priceFrom) return "từ " + p.priceMin + " " + p.priceUnit;
    if (p.priceApprox || p.priceMin === p.priceMax) return "~" + p.priceMin + " " + p.priceUnit;
    return p.priceMin + " – " + p.priceMax;
  }
  function moneyUnit(p) {
    if (p.priceUnannounced || p.priceFrom || p.priceApprox || p.priceMin === p.priceMax) return "";
    return p.priceUnit;
  }

  function pinIcon() {
    return '<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M12 22s7-7.4 7-13a7 7 0 1 0-14 0c0 5.6 7 13 7 13Z" stroke="currentColor" stroke-width="1.6"/><circle cx="12" cy="9" r="2.4" stroke="currentColor" stroke-width="1.6"/></svg>';
  }

  function contactHref(kind) {
    var c = window.CONTACT || {};
    if (kind === "tel") return "tel:" + (c.phone || "");
    return c.facebookUrl || "#";
  }

  function wireGlobalContacts() {
    document.querySelectorAll("#navContact, #heroContact, #footerContact").forEach(function (el) {
      el.href = contactHref("facebook");
    });
  }

  function buildFilters(data) {
    var zoneWrap = document.getElementById("zoneFilters");
    var statusWrap = document.getElementById("statusFilters");

    var allZoneChip = chip("Tất cả khu vực", "all", true);
    zoneWrap.appendChild(allZoneChip);
    data.zones.forEach(function (z) { zoneWrap.appendChild(chip(z.name, z.id, false)); });

    var allStatusChip = chip("Tất cả trạng thái", "all", true, true);
    statusWrap.appendChild(allStatusChip);
    data.statusOptions.forEach(function (s) { statusWrap.appendChild(chip(s.label, s.id, false, true)); });

    zoneWrap.addEventListener("click", function (e) {
      var btn = e.target.closest(".chip");
      if (!btn) return;
      state.activeZone = btn.dataset.value;
      setPressed(zoneWrap, btn);
      render();
    });
    statusWrap.addEventListener("click", function (e) {
      var btn = e.target.closest(".chip");
      if (!btn) return;
      state.activeStatus = btn.dataset.value;
      setPressed(statusWrap, btn);
      render();
    });
  }

  function chip(label, value, pressed) {
    var b = document.createElement("button");
    b.className = "chip";
    b.type = "button";
    b.dataset.value = value;
    b.setAttribute("aria-pressed", pressed ? "true" : "false");
    b.textContent = label;
    return b;
  }

  function setPressed(wrap, activeBtn) {
    wrap.querySelectorAll(".chip").forEach(function (c) { c.setAttribute("aria-pressed", c === activeBtn ? "true" : "false"); });
  }

  function filteredProjects() {
    return state.data.projects.filter(function (p) {
      if (state.activeZone !== "all" && p.zone !== state.activeZone) return false;
      if (state.activeStatus !== "all" && p.status !== state.activeStatus) return false;
      return true;
    });
  }

  function render() {
    var list = document.getElementById("projectList");
    list.innerHTML = "";
    var projects = filteredProjects();
    document.getElementById("filterCount").textContent = projects.length + " dự án";

    var lastZone = null;
    projects.forEach(function (p) {
      if (p.zone !== lastZone) {
        var zoneInfo = state.data.zones.find(function (z) { return z.id === p.zone; });
        var h = document.createElement("div");
        h.className = "zone-heading";
        h.textContent = zoneInfo ? zoneInfo.name : p.zone;
        list.appendChild(h);
        lastZone = p.zone;
      }
      list.appendChild(renderCard(p));
    });

    updateMapMarkers(projects);
  }

  function renderCard(p) {
    var statusInfo = state.data.statusOptions.find(function (s) { return s.id === p.status; });
    var card = document.createElement("article");
    card.className = "card glass";
    card.id = "card-" + p.id;
    card.dataset.id = p.id;
    card.tabIndex = 0;
    card.setAttribute("role", "button");
    card.setAttribute("aria-label", p.name + ", xem trên bản đồ");

    var unit = moneyUnit(p);
    var handoverHtml = "";
    if (p.handoverDate) {
      handoverHtml = '<div class="card-handover">Bàn giao: ' + p.handoverDate + '</div>';
    } else if (p.handoverExpected) {
      handoverHtml = '<div class="card-handover">Dự kiến bàn giao: ' + p.handoverExpected + '</div>';
    }

    card.innerHTML =
      '<div class="card-top">' +
        '<div>' +
          '<div class="card-title">' + p.name + '</div>' +
          '<div class="card-developer">CĐT: ' + p.developer + '</div>' +
        '</div>' +
        '<span class="badge ' + (STATUS_CLASS[p.status] || "") + '">' + (statusInfo ? statusInfo.label : p.status) + '</span>' +
      '</div>' +
      '<div class="card-address">' + pinIcon() + '<span>' + p.address + '</span></div>' +
      (p.coordConfidence === "estimated" ? '<div class="confidence-note">' + pinIcon() + ' Vị trí đang xác minh</div>' : "") +
      handoverHtml +
      '<div class="card-bottom">' +
        '<div class="card-price">' + money(p) + (unit ? '<span>' + unit + '</span>' : '') + '</div>' +
        '<a class="card-contact" href="' + contactHref("facebook") + '" target="_blank" rel="noopener" onclick="event.stopPropagation()">Liên hệ tư vấn</a>' +
      '</div>';

    var activate = function () { focusProject(p.id, true); };
    card.addEventListener("click", activate);
    card.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); activate(); }
    });

    return card;
  }

  function setActiveCard(id) {
    document.querySelectorAll(".card.is-active").forEach(function (c) { c.classList.remove("is-active"); });
    var el = document.getElementById("card-" + id);
    if (el) el.classList.add("is-active");
    Object.entries(state.markers).forEach(function (entry) {
      var pid = entry[0], marker = entry[1];
      var mel = marker.getElement();
      if (mel) mel.classList.toggle("is-active", pid === id);
    });
    state.activeId = id;
  }

  function focusProject(id, flyAndScroll) {
    setActiveCard(id);
    var p = state.data.projects.find(function (x) { return x.id === id; });
    if (state.map && p) {
      state.map.flyTo([p.lat, p.lng], 15.5, { duration: 0.9 });
    }
    if (flyAndScroll) {
      var el = document.getElementById("card-" + id);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }

  var scrollTicking = false;
  function onListScroll() {
    if (scrollTicking) return;
    scrollTicking = true;
    requestAnimationFrame(function () {
      scrollTicking = false;
      var list = document.getElementById("projectList");
      var listRect = list.getBoundingClientRect();
      var targetY = listRect.top + 140;
      var closest = null, closestDist = Infinity;
      list.querySelectorAll(".card").forEach(function (card) {
        var r = card.getBoundingClientRect();
        var dist = Math.abs(r.top - targetY);
        if (dist < closestDist) { closestDist = dist; closest = card; }
      });
      if (closest && closest.dataset.id !== state.activeId) {
        focusProject(closest.dataset.id, false);
      }
    });
  }

  function buildPopupHtml(p) {
    var statusInfo = state.data.statusOptions.find(function (s) { return s.id === p.status; });
    var html = '<div class="popup-inner">';
    html += '<strong class="popup-name">' + p.name + '</strong>';
    html += '<div class="popup-developer">CĐT: ' + p.developer + '</div>';
    html += '<div class="popup-price">' + money(p) + ' ' + moneyUnit(p) + '</div>';
    html += '<div class="popup-address">' + p.address + '</div>';
    if (statusInfo) {
      html += '<div class="popup-status">' + statusInfo.label + '</div>';
    }
    if (p.handoverDate) {
      html += '<div class="popup-handover">Bàn giao: ' + p.handoverDate + '</div>';
    }
    if (p.handoverExpected) {
      html += '<div class="popup-handover">Dự kiến bàn giao: ' + p.handoverExpected + '</div>';
    }
    html += '<a class="popup-contact-btn" href="' + contactHref("facebook") + '" target="_blank" rel="noopener" onclick="event.stopPropagation()">Liên hệ tư vấn</a>';
    html += '</div>';
    return html;
  }

  function initMap() {
    state.map = L.map("map", {
      center: [10.89, 106.708],
      zoom: 11.3,
      zoomControl: false
    });
    L.control.zoom({ position: "topright" }).addTo(state.map);
    L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: "abcd",
      maxZoom: 20
    }).addTo(state.map);

    requestAnimationFrame(function () { state.map.invalidateSize(); });
    var mapEl = document.getElementById("map");
    if (mapEl && window.ResizeObserver) {
      new ResizeObserver(function () { state.map.invalidateSize(); }).observe(mapEl);
    }

    state.map.on("zoomend", function () {
      updateLabelVisibility();
      updateLandmarkVisibility();
    });
  }

  function updateMapMarkers(projects) {
    if (!state.map) return;
    Object.keys(state.markers).forEach(function (id) {
      if (!projects.find(function (p) { return p.id === id; })) {
        state.map.removeLayer(state.markers[id]);
        delete state.markers[id];
      }
    });

    var latLngs = [];
    projects.forEach(function (p) {
      if (typeof p.lat !== "number" || typeof p.lng !== "number") return;
      latLngs.push([p.lat, p.lng]);
      if (state.markers[p.id]) return;

      var icon = L.divIcon({
        className: "map-marker" + (p.coordConfidence === "estimated" ? " confidence-estimated" : ""),
        iconSize: [30, 30],
        iconAnchor: [15, 30]
      });

      var popupHtml = buildPopupHtml(p);

      var marker = L.marker([p.lat, p.lng], { icon: icon })
        .addTo(state.map)
        .bindPopup(popupHtml, { closeButton: true, offset: [0, -20], maxWidth: 280 })
        .bindTooltip(p.name, {
          permanent: true,
          direction: "top",
          className: "marker-label",
          offset: [0, -32]
        });

      marker.on("click", function () { focusProject(p.id, true); });
      state.markers[p.id] = marker;
    });

    updateLabelVisibility();

    state.map.invalidateSize();
    if (latLngs.length > 1) {
      state.map.fitBounds(L.latLngBounds(latLngs), { padding: [80, 80], maxZoom: 14 });
    } else if (latLngs.length === 1) {
      state.map.setView(latLngs[0], 15);
    }
  }

  function updateLabelVisibility() {
    if (!state.map) return;
    var zoom = state.map.getZoom();
    var show = zoom >= 13;
    if (show === state.labelsVisible) return;
    state.labelsVisible = show;
    Object.values(state.markers).forEach(function (marker) {
      var tip = marker.getTooltip();
      if (tip) {
        var tipEl = tip.getElement();
        if (tipEl) tipEl.style.display = show ? "" : "none";
      }
    });
  }

  function addLandmarks(landmarks) {
    if (!landmarks || !landmarks.length || !state.map) return;

    landmarks.forEach(function (lm) {
      var emoji = LANDMARK_EMOJI[lm.type] || "📍";
      var icon = L.divIcon({
        className: "landmark-marker landmark-" + lm.type,
        html: '<span>' + emoji + '</span>',
        iconSize: [32, 32],
        iconAnchor: [16, 16]
      });

      var marker = L.marker([lm.lat, lm.lng], { icon: icon, interactive: true })
        .bindTooltip(lm.name, {
          permanent: true,
          direction: "right",
          className: "landmark-label",
          offset: [16, 0]
        });

      marker._lmMinZoom = lm.minZoom || 14;
      marker._lmOnMap = false;
      state.landmarkMarkers.push(marker);
    });

    updateLandmarkVisibility();
  }

  function updateLandmarkVisibility() {
    if (!state.map) return;
    var zoom = state.map.getZoom();
    state.landmarkMarkers.forEach(function (marker) {
      var show = zoom >= marker._lmMinZoom;
      if (show && !marker._lmOnMap) {
        marker.addTo(state.map);
        marker._lmOnMap = true;
      } else if (!show && marker._lmOnMap) {
        state.map.removeLayer(marker);
        marker._lmOnMap = false;
      }
    });
  }

  async function init() {
    wireGlobalContacts();
    try {
      var projectsRes = await fetch("/api/projects");
      state.data = await projectsRes.json();

      buildFilters(state.data);
      initMap();
      render();
      addLandmarks(state.data.landmarks);

      document.getElementById("projectList").addEventListener("scroll", onListScroll);
    } catch (err) {
      console.error("Khong tai duoc du lieu du an:", err);
      document.getElementById("projectList").innerHTML =
        '<div class="card glass"><p>Không tải được dữ liệu dự án. Vui lòng thử lại sau.</p></div>';
    }
  }

  document.addEventListener("DOMContentLoaded", init);
})();
