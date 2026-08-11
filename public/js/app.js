(function () {
  "use strict";

  const STATUS_CLASS = {
    "new": "status-new",
    "selling": "status-selling",
    "handed-over": "status-handed-over",
    "upcoming": "status-upcoming"
  };

  const state = {
    data: null,
    activeZone: "all",
    activeStatus: "all",
    map: null,
    markers: {}, // id -> L.Marker
    activeId: null
  };

  function money(p) {
    if (p.priceUnannounced) return "Chưa công bố";
    if (p.priceFrom) return `từ ${p.priceMin} ${p.priceUnit}`;
    if (p.priceApprox || p.priceMin === p.priceMax) return `~${p.priceMin} ${p.priceUnit}`;
    return `${p.priceMin} – ${p.priceMax}`;
  }
  function moneyUnit(p) {
    if (p.priceUnannounced || p.priceFrom || p.priceApprox || p.priceMin === p.priceMax) return "";
    return p.priceUnit;
  }

  function pinIcon() {
    return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M12 22s7-7.4 7-13a7 7 0 1 0-14 0c0 5.6 7 13 7 13Z" stroke="currentColor" stroke-width="1.6"/><circle cx="12" cy="9" r="2.4" stroke="currentColor" stroke-width="1.6"/></svg>`;
  }

  function contactHref(kind) {
    const c = window.CONTACT || {};
    if (kind === "tel") return `tel:${c.phone || ""}`;
    return c.zaloUrl || "#";
  }

  function wireGlobalContacts() {
    document.querySelectorAll("#navContact, #heroContact, #footerContact").forEach((el) => {
      el.href = contactHref("zalo");
    });
  }

  function buildFilters(data) {
    const zoneWrap = document.getElementById("zoneFilters");
    const statusWrap = document.getElementById("statusFilters");

    const allZoneChip = chip("Tất cả khu vực", "all", true);
    zoneWrap.appendChild(allZoneChip);
    data.zones.forEach((z) => zoneWrap.appendChild(chip(z.name, z.id, false)));

    const allStatusChip = chip("Tất cả trạng thái", "all", true, true);
    statusWrap.appendChild(allStatusChip);
    data.statusOptions.forEach((s) => statusWrap.appendChild(chip(s.label, s.id, false, true)));

    zoneWrap.addEventListener("click", (e) => {
      const btn = e.target.closest(".chip");
      if (!btn) return;
      state.activeZone = btn.dataset.value;
      setPressed(zoneWrap, btn);
      render();
    });
    statusWrap.addEventListener("click", (e) => {
      const btn = e.target.closest(".chip");
      if (!btn) return;
      state.activeStatus = btn.dataset.value;
      setPressed(statusWrap, btn);
      render();
    });
  }

  function chip(label, value, pressed, isStatus) {
    const b = document.createElement("button");
    b.className = "chip";
    b.type = "button";
    b.dataset.value = value;
    b.setAttribute("aria-pressed", pressed ? "true" : "false");
    b.textContent = label;
    return b;
  }

  function setPressed(wrap, activeBtn) {
    wrap.querySelectorAll(".chip").forEach((c) => c.setAttribute("aria-pressed", c === activeBtn ? "true" : "false"));
  }

  function filteredProjects() {
    return state.data.projects.filter((p) => {
      if (state.activeZone !== "all" && p.zone !== state.activeZone) return false;
      if (state.activeStatus !== "all" && p.status !== state.activeStatus) return false;
      return true;
    });
  }

  function render() {
    const list = document.getElementById("projectList");
    list.innerHTML = "";
    const projects = filteredProjects();
    document.getElementById("filterCount").textContent = `${projects.length} dự án`;

    let lastZone = null;
    projects.forEach((p) => {
      if (p.zone !== lastZone) {
        const zoneInfo = state.data.zones.find((z) => z.id === p.zone);
        const h = document.createElement("div");
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
    const statusInfo = state.data.statusOptions.find((s) => s.id === p.status);
    const card = document.createElement("article");
    card.className = "card glass";
    card.id = `card-${p.id}`;
    card.dataset.id = p.id;
    card.tabIndex = 0;
    card.setAttribute("role", "button");
    card.setAttribute("aria-label", `${p.name}, xem trên bản đồ`);

    const unit = moneyUnit(p);
    card.innerHTML = `
      <div class="card-top">
        <div>
          <div class="card-title">${p.name}</div>
          <div class="card-developer">CĐT: ${p.developer}</div>
        </div>
        <span class="badge ${STATUS_CLASS[p.status] || ""}">${statusInfo ? statusInfo.label : p.status}</span>
      </div>
      <div class="card-address">${pinIcon()}<span>${p.address}</span></div>
      ${p.coordConfidence === "estimated" ? `<div class="confidence-note">${pinIcon()} Vị trí đang xác minh</div>` : ""}
      <div class="card-bottom">
        <div class="card-price">${money(p)}${unit ? `<span>${unit}</span>` : ""}</div>
        <a class="card-contact" href="${contactHref("zalo")}" target="_blank" rel="noopener" onclick="event.stopPropagation()">Liên hệ tư vấn</a>
      </div>
    `;

    const activate = () => focusProject(p.id, true);
    card.addEventListener("click", activate);
    card.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); activate(); }
    });

    return card;
  }

  function setActiveCard(id) {
    document.querySelectorAll(".card.is-active").forEach((c) => c.classList.remove("is-active"));
    const el = document.getElementById(`card-${id}`);
    if (el) el.classList.add("is-active");
    Object.entries(state.markers).forEach(([pid, marker]) => {
      const el = marker.getElement();
      el.classList.toggle("is-active", pid === id);
    });
    state.activeId = id;
  }

  function focusProject(id, flyAndScroll) {
    setActiveCard(id);
    const p = state.data.projects.find((x) => x.id === id);
    if (state.map && p) {
      state.map.flyTo([p.lat, p.lng], 15.5, { duration: 0.9 });
    }
    if (flyAndScroll) {
      const el = document.getElementById(`card-${id}`);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }

  // --- Scroll sync: highlight the card nearest the top of the list viewport ---
  let scrollTicking = false;
  function onListScroll() {
    if (scrollTicking) return;
    scrollTicking = true;
    requestAnimationFrame(() => {
      scrollTicking = false;
      const list = document.getElementById("projectList");
      const listRect = list.getBoundingClientRect();
      const targetY = listRect.top + 140;
      let closest = null, closestDist = Infinity;
      list.querySelectorAll(".card").forEach((card) => {
        const r = card.getBoundingClientRect();
        const dist = Math.abs(r.top - targetY);
        if (dist < closestDist) { closestDist = dist; closest = card; }
      });
      if (closest && closest.dataset.id !== state.activeId) {
        focusProject(closest.dataset.id, false);
      }
    });
  }

  function initMap() {
    state.map = L.map("map", {
      center: [10.89, 106.708],
      zoom: 11.3,
      zoomControl: false
    });
    L.control.zoom({ position: "topright" }).addTo(state.map);
    // CARTO Voyager basemap built on OpenStreetMap data — free, no signup/token required.
    // Chosen over the minimal dark style so street names/roads stay readable for khách.
    L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: "abcd",
      maxZoom: 20
    }).addTo(state.map);

    // The map panel sits inside a sticky/grid layout, so its final pixel size
    // isn't settled the instant Leaflet initializes (webfonts still loading,
    // sticky offsets not yet resolved) — without this, Leaflet caches a wrong
    // size and renders zoomed out to the whole world. Re-measure whenever the
    // container actually changes size.
    requestAnimationFrame(() => state.map.invalidateSize());
    const mapEl = document.getElementById("map");
    if (mapEl && window.ResizeObserver) {
      new ResizeObserver(() => state.map.invalidateSize()).observe(mapEl);
    }
  }

  function updateMapMarkers(projects) {
    if (!state.map) return;
    // remove markers not in current filtered set
    Object.keys(state.markers).forEach((id) => {
      if (!projects.find((p) => p.id === id)) {
        state.map.removeLayer(state.markers[id]);
        delete state.markers[id];
      }
    });

    const latLngs = [];
    projects.forEach((p) => {
      if (typeof p.lat !== "number" || typeof p.lng !== "number") return;
      latLngs.push([p.lat, p.lng]);
      if (state.markers[p.id]) return;

      const icon = L.divIcon({
        className: "map-marker" + (p.coordConfidence === "estimated" ? " confidence-estimated" : ""),
        iconSize: [30, 30],
        iconAnchor: [15, 30]
      });

      const popupHtml = `
        <strong>${p.name}</strong><br/>
        <span style="color:var(--text-secondary);font-size:13px">${p.developer}</span><br/>
        <span style="color:var(--accent);font-family:var(--font-display);font-size:14px">${money(p)} ${moneyUnit(p)}</span>`;

      const marker = L.marker([p.lat, p.lng], { icon })
        .addTo(state.map)
        .bindPopup(popupHtml, { closeButton: true, offset: [0, -20] });

      marker.on("click", () => focusProject(p.id, true));
      state.markers[p.id] = marker;
    });

    state.map.invalidateSize();
    if (latLngs.length > 1) {
      state.map.fitBounds(L.latLngBounds(latLngs), { padding: [80, 80], maxZoom: 14 });
    } else if (latLngs.length === 1) {
      state.map.setView(latLngs[0], 15);
    }
  }

  async function init() {
    wireGlobalContacts();
    try {
      const projectsRes = await fetch("/api/projects");
      state.data = await projectsRes.json();

      buildFilters(state.data);
      initMap();
      render();

      document.getElementById("projectList").addEventListener("scroll", onListScroll);
    } catch (err) {
      console.error("Khong tai duoc du lieu du an:", err);
      document.getElementById("projectList").innerHTML =
        `<div class="card glass"><p>Không tải được dữ liệu dự án. Vui lòng thử lại sau.</p></div>`;
    }
  }

  document.addEventListener("DOMContentLoaded", init);
})();
