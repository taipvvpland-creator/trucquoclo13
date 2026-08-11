(function () {
  "use strict";

  const state = {
    data: null,
    map: null,
    markers: {}, // id -> L.Marker
    pending: {}, // id -> { lat, lng }
    selectedId: null
  };

  function showStatus(msg, kind) {
    const el = document.getElementById("statusMsg");
    el.textContent = msg;
    el.hidden = false;
    el.className = "admin-status" + (kind ? " " + kind : "");
    if (kind === "ok") {
      setTimeout(() => { el.hidden = true; }, 3500);
    }
  }

  function updatePendingUI() {
    const ids = Object.keys(state.pending);
    const badge = document.getElementById("pendingCount");
    const saveBtn = document.getElementById("saveBtn");
    if (ids.length > 0) {
      badge.hidden = false;
      badge.textContent = `${ids.length} thay đổi chưa lưu`;
    } else {
      badge.hidden = true;
    }
    saveBtn.disabled = ids.length === 0;
  }

  function currentCoords(p) {
    return state.pending[p.id] || { lat: p.lat, lng: p.lng };
  }

  function renderSidebar() {
    const list = document.getElementById("adminList");
    list.innerHTML = "";
    let lastZone = null;
    state.data.projects.forEach((p) => {
      if (p.zone !== lastZone) {
        const zoneInfo = state.data.zones.find((z) => z.id === p.zone);
        const h = document.createElement("div");
        h.className = "admin-zone-heading";
        h.textContent = zoneInfo ? zoneInfo.name : p.zone;
        list.appendChild(h);
        lastZone = p.zone;
      }
      list.appendChild(renderRow(p));
    });
  }

  function renderRow(p) {
    const row = document.createElement("div");
    row.className = "admin-row";
    row.id = `row-${p.id}`;
    row.dataset.id = p.id;
    if (state.pending[p.id]) row.classList.add("is-dirty");
    if (state.selectedId === p.id) row.classList.add("is-selected");

    const c = currentCoords(p);
    row.innerHTML = `
      <div class="admin-row-top">
        <div class="admin-row-title">${p.name}</div>
      </div>
      <div class="admin-row-coords">${c.lat.toFixed(5)}, ${c.lng.toFixed(5)} ${state.pending[p.id] ? "· chưa lưu" : `· ${p.coordConfidence}`}</div>
      ${state.pending[p.id] ? `<button class="admin-row-reset" data-id="${p.id}">Đặt lại vị trí cũ</button>` : ""}
    `;

    row.addEventListener("click", (e) => {
      if (e.target.classList.contains("admin-row-reset")) return;
      selectProject(p.id, true);
    });

    const resetBtn = row.querySelector(".admin-row-reset");
    if (resetBtn) {
      resetBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        resetProject(p.id);
      });
    }

    return row;
  }

  function selectProject(id, flyTo) {
    document.querySelectorAll(".admin-row.is-selected").forEach((r) => r.classList.remove("is-selected"));
    document.getElementById(`row-${id}`)?.classList.add("is-selected");
    Object.entries(state.markers).forEach(([pid, marker]) => {
      marker.getElement()?.classList.toggle("is-selected", pid === id);
    });
    state.selectedId = id;

    if (flyTo && state.map) {
      const p = state.data.projects.find((x) => x.id === id);
      const c = currentCoords(p);
      state.map.flyTo([c.lat, c.lng], 16, { duration: 0.7 });
      state.markers[id]?.openPopup();
    }
  }

  function resetProject(id) {
    delete state.pending[id];
    const p = state.data.projects.find((x) => x.id === id);
    const marker = state.markers[id];
    if (marker) {
      marker.setLatLng([p.lat, p.lng]);
      marker.getElement()?.classList.remove("is-dirty");
    }
    refreshRow(id);
    updatePendingUI();
  }

  function refreshRow(id) {
    const p = state.data.projects.find((x) => x.id === id);
    const old = document.getElementById(`row-${id}`);
    if (old) old.replaceWith(renderRow(p));
    if (state.selectedId === id) selectProject(id, false);
  }

  function initMap() {
    state.map = L.map("map", { center: [10.89, 106.708], zoom: 11.3, zoomControl: true });
    L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
      attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
      subdomains: "abcd",
      maxZoom: 20
    }).addTo(state.map);
    requestAnimationFrame(() => state.map.invalidateSize());
    new ResizeObserver(() => state.map.invalidateSize()).observe(document.getElementById("map"));
  }

  function addMarkers() {
    const bounds = [];
    state.data.projects.forEach((p) => {
      if (typeof p.lat !== "number" || typeof p.lng !== "number") return;
      bounds.push([p.lat, p.lng]);

      const icon = L.divIcon({ className: "admin-marker", iconSize: [26, 26], iconAnchor: [13, 26] });
      const marker = L.marker([p.lat, p.lng], { icon, draggable: true })
        .addTo(state.map)
        .bindPopup(`<strong>${p.name}</strong><br/><span style="font-size:12px">${p.address}</span>`);

      marker.on("click", () => selectProject(p.id, false));
      marker.on("dragend", () => {
        const ll = marker.getLatLng();
        state.pending[p.id] = { lat: ll.lat, lng: ll.lng };
        marker.getElement()?.classList.add("is-dirty");
        refreshRow(p.id);
        updatePendingUI();
      });

      state.markers[p.id] = marker;
    });
    if (bounds.length) state.map.fitBounds(L.latLngBounds(bounds), { padding: [60, 60], maxZoom: 14 });
  }

  async function saveAll() {
    const password = document.getElementById("adminPassword").value;
    if (!password) {
      showStatus("Nhập mật khẩu admin trước đã.", "error");
      return;
    }
    const updates = Object.entries(state.pending).map(([id, c]) => ({ id, lat: c.lat, lng: c.lng }));
    if (updates.length === 0) return;

    const saveBtn = document.getElementById("saveBtn");
    saveBtn.disabled = true;
    saveBtn.textContent = "Đang lưu...";

    try {
      const res = await fetch("/api/admin/save-coords", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password, updates })
      });
      const body = await res.json();
      if (!res.ok) {
        showStatus(body.error || "Lưu thất bại.", "error");
        return;
      }
      updates.forEach((u) => {
        const p = state.data.projects.find((x) => x.id === u.id);
        p.lat = u.lat;
        p.lng = u.lng;
        p.coordConfidence = "verified";
        state.markers[u.id]?.getElement()?.classList.remove("is-dirty");
      });
      state.pending = {};
      renderSidebar();
      updatePendingUI();
      showStatus(`Đã lưu ${body.changed} vị trí.`, "ok");
    } catch (err) {
      showStatus("Không kết nối được tới server.", "error");
    } finally {
      saveBtn.textContent = "Lưu tất cả";
      saveBtn.disabled = Object.keys(state.pending).length === 0;
    }
  }

  async function init() {
    try {
      const res = await fetch("/api/projects");
      state.data = await res.json();
      initMap();
      addMarkers();
      renderSidebar();
      document.getElementById("saveBtn").addEventListener("click", saveAll);
    } catch (err) {
      showStatus("Không tải được dữ liệu dự án.", "error");
    }
  }

  document.addEventListener("DOMContentLoaded", init);
})();
