(function () {
  "use strict";

  const LANDMARK_EMOJI = {
    shopping: "🛒",
    hospital: "🏥",
    market: "🏪",
    golf: "⛳"
  };

  const state = {
    data: null,
    map: null,
    view: "projects", // "projects" | "landmarks"
    markers: {}, // id -> L.Marker (projects)
    landmarkMarkers: {}, // id -> L.Marker (landmarks)
    pending: {}, // id -> { lat, lng } (projects)
    pendingLandmarks: {}, // id -> { lat, lng }
    selectedId: null
  };

  function savePendingToStorage() {
    try {
      localStorage.setItem("taiem_admin_pending", JSON.stringify(state.pending));
      localStorage.setItem("taiem_admin_pending_landmarks", JSON.stringify(state.pendingLandmarks));
    } catch (e) {}
  }

  function loadPendingFromStorage() {
    var result = { projects: null, landmarks: null };
    try {
      var saved = localStorage.getItem("taiem_admin_pending");
      if (saved) result.projects = JSON.parse(saved);
      var savedLm = localStorage.getItem("taiem_admin_pending_landmarks");
      if (savedLm) result.landmarks = JSON.parse(savedLm);
    } catch (e) {}
    return result;
  }

  function clearPendingStorage() {
    try {
      localStorage.removeItem("taiem_admin_pending");
      localStorage.removeItem("taiem_admin_pending_landmarks");
    } catch (e) {}
  }

  function saveVerifiedBackup() {
    try {
      var backup = { projects: {}, landmarks: {} };
      state.data.projects.forEach(function(p) {
        backup.projects[p.id] = { lat: p.lat, lng: p.lng, conf: p.coordConfidence };
      });
      (state.data.landmarks || []).forEach(function(l) {
        backup.landmarks[l.id] = { lat: l.lat, lng: l.lng };
      });
      localStorage.setItem("taiem_verified_backup", JSON.stringify(backup));
    } catch(e) {}
  }

  function restoreFromBackup() {
    try {
      var raw = localStorage.getItem("taiem_verified_backup");
      if (!raw) return 0;
      var backup = JSON.parse(raw);
      var restored = 0;

      if (backup.projects) {
        state.data.projects.forEach(function(p) {
          if (state.pending[p.id]) return;
          var saved = backup.projects[p.id];
          if (!saved) return;
          if (saved.conf === "verified" && p.coordConfidence === "estimated") {
            state.pending[p.id] = { lat: saved.lat, lng: saved.lng };
            var marker = state.markers[p.id];
            if (marker) {
              marker.setLatLng([saved.lat, saved.lng]);
              if (marker.getElement()) marker.getElement().classList.add("is-dirty");
            }
            restored++;
          }
        });
      }

      if (backup.landmarks) {
        (state.data.landmarks || []).forEach(function(l) {
          if (state.pendingLandmarks[l.id]) return;
          var saved = backup.landmarks[l.id];
          if (!saved) return;
          if (Math.abs(l.lat - saved.lat) > 0.00001 || Math.abs(l.lng - saved.lng) > 0.00001) {
            state.pendingLandmarks[l.id] = { lat: saved.lat, lng: saved.lng };
            var marker = state.landmarkMarkers[l.id];
            if (marker) {
              marker.setLatLng([saved.lat, saved.lng]);
              if (marker.getElement()) marker.getElement().classList.add("is-dirty");
            }
            restored++;
          }
        });
      }

      return restored;
    } catch(e) { return 0; }
  }

  function showStatus(msg, kind) {
    const el = document.getElementById("statusMsg");
    el.textContent = msg;
    el.hidden = false;
    el.className = "admin-status" + (kind ? " " + kind : "");
    if (kind === "ok") {
      setTimeout(() => { el.hidden = true; }, 3500);
    }
  }

  function totalPendingCount() {
    return Object.keys(state.pending).length + Object.keys(state.pendingLandmarks).length;
  }

  function updatePendingUI() {
    const count = totalPendingCount();
    const badge = document.getElementById("pendingCount");
    const saveBtn = document.getElementById("saveBtn");
    if (count > 0) {
      badge.hidden = false;
      badge.textContent = `${count} thay đổi chưa lưu`;
    } else {
      badge.hidden = true;
    }
    saveBtn.disabled = count === 0;
  }

  function currentCoords(p) {
    return state.pending[p.id] || { lat: p.lat, lng: p.lng };
  }

  function currentLandmarkCoords(l) {
    return state.pendingLandmarks[l.id] || { lat: l.lat, lng: l.lng };
  }

  // ---------- View switching ----------
  function setView(view) {
    state.view = view;
    document.getElementById("tabProjects").classList.toggle("is-active", view === "projects");
    document.getElementById("tabLandmarks").classList.toggle("is-active", view === "landmarks");
    Object.values(state.markers).forEach((m) => { m.getElement() && (m.getElement().style.display = view === "projects" ? "" : "none"); });
    Object.values(state.landmarkMarkers).forEach((m) => { m.getElement() && (m.getElement().style.display = view === "landmarks" ? "" : "none"); });
    renderSidebar();
  }

  // ---------- Projects sidebar ----------
  function renderSidebar() {
    const list = document.getElementById("adminList");
    list.innerHTML = "";

    if (state.view === "projects") {
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
    } else {
      (state.data.landmarks || []).forEach((l) => {
        list.appendChild(renderLandmarkRow(l));
      });
    }
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

  function renderLandmarkRow(l) {
    const row = document.createElement("div");
    row.className = "admin-row";
    row.id = `lm-row-${l.id}`;
    row.dataset.id = l.id;
    if (state.pendingLandmarks[l.id]) row.classList.add("is-dirty");
    if (state.selectedId === l.id) row.classList.add("is-selected");

    const c = currentLandmarkCoords(l);
    const emoji = LANDMARK_EMOJI[l.type] || "📍";
    row.innerHTML = `
      <div class="admin-row-top">
        <div class="admin-row-title">${emoji} ${l.name}</div>
      </div>
      <div class="admin-row-coords">${c.lat.toFixed(5)}, ${c.lng.toFixed(5)} ${state.pendingLandmarks[l.id] ? "· chưa lưu" : ""}</div>
      ${state.pendingLandmarks[l.id] ? `<button class="admin-row-reset" data-id="${l.id}">Đặt lại vị trí cũ</button>` : ""}
    `;

    row.addEventListener("click", (e) => {
      if (e.target.classList.contains("admin-row-reset")) return;
      selectLandmark(l.id, true);
    });

    const resetBtn = row.querySelector(".admin-row-reset");
    if (resetBtn) {
      resetBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        resetLandmark(l.id);
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

  function selectLandmark(id, flyTo) {
    document.querySelectorAll(".admin-row.is-selected").forEach((r) => r.classList.remove("is-selected"));
    document.getElementById(`lm-row-${id}`)?.classList.add("is-selected");
    Object.entries(state.landmarkMarkers).forEach(([lid, marker]) => {
      marker.getElement()?.classList.toggle("is-selected", lid === id);
    });
    state.selectedId = id;

    if (flyTo && state.map) {
      const l = state.data.landmarks.find((x) => x.id === id);
      const c = currentLandmarkCoords(l);
      state.map.flyTo([c.lat, c.lng], 16, { duration: 0.7 });
      state.landmarkMarkers[id]?.openPopup();
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
    savePendingToStorage();
  }

  function resetLandmark(id) {
    delete state.pendingLandmarks[id];
    const l = state.data.landmarks.find((x) => x.id === id);
    const marker = state.landmarkMarkers[id];
    if (marker) {
      marker.setLatLng([l.lat, l.lng]);
      marker.getElement()?.classList.remove("is-dirty");
    }
    refreshLandmarkRow(id);
    updatePendingUI();
    savePendingToStorage();
  }

  function refreshRow(id) {
    const p = state.data.projects.find((x) => x.id === id);
    const old = document.getElementById(`row-${id}`);
    if (old) old.replaceWith(renderRow(p));
    if (state.selectedId === id) selectProject(id, false);
  }

  function refreshLandmarkRow(id) {
    const l = state.data.landmarks.find((x) => x.id === id);
    const old = document.getElementById(`lm-row-${id}`);
    if (old) old.replaceWith(renderLandmarkRow(l));
    if (state.selectedId === id) selectLandmark(id, false);
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
        savePendingToStorage();
      });

      state.markers[p.id] = marker;
    });
    if (bounds.length) state.map.fitBounds(L.latLngBounds(bounds), { padding: [60, 60], maxZoom: 14 });
  }

  function addLandmarkMarkers() {
    (state.data.landmarks || []).forEach((l) => {
      const emoji = LANDMARK_EMOJI[l.type] || "📍";
      const icon = L.divIcon({
        className: "admin-landmark-marker",
        html: `<span>${emoji}</span>`,
        iconSize: [30, 30],
        iconAnchor: [15, 15]
      });
      const marker = L.marker([l.lat, l.lng], { icon, draggable: true })
        .addTo(state.map)
        .bindPopup(`<strong>${l.name}</strong>`);

      marker.getElement() && (marker.getElement().style.display = "none");

      marker.on("click", () => selectLandmark(l.id, false));
      marker.on("dragend", () => {
        const ll = marker.getLatLng();
        state.pendingLandmarks[l.id] = { lat: ll.lat, lng: ll.lng };
        marker.getElement()?.classList.add("is-dirty");
        refreshLandmarkRow(l.id);
        updatePendingUI();
        savePendingToStorage();
      });

      state.landmarkMarkers[l.id] = marker;
    });
  }

  async function saveAll() {
    const password = document.getElementById("adminPassword").value;
    if (!password) {
      showStatus("Nhập mật khẩu admin trước đã.", "error");
      return;
    }
    const updates = Object.entries(state.pending).map(([id, c]) => ({ id, lat: c.lat, lng: c.lng }));
    const landmarkUpdates = Object.entries(state.pendingLandmarks).map(([id, c]) => ({ id, lat: c.lat, lng: c.lng }));
    if (updates.length === 0 && landmarkUpdates.length === 0) return;

    const saveBtn = document.getElementById("saveBtn");
    saveBtn.disabled = true;
    saveBtn.textContent = "Đang lưu...";

    try {
      const res = await fetch("/api/admin/save-coords", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password, updates, landmarkUpdates })
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
      landmarkUpdates.forEach((u) => {
        const l = state.data.landmarks.find((x) => x.id === u.id);
        if (l) {
          l.lat = u.lat;
          l.lng = u.lng;
        }
        state.landmarkMarkers[u.id]?.getElement()?.classList.remove("is-dirty");
      });
      state.pending = {};
      state.pendingLandmarks = {};
      clearPendingStorage();
      saveVerifiedBackup();
      renderSidebar();
      updatePendingUI();
      showStatus(`Đã lưu ${body.changed || 0} dự án, ${body.landmarksChanged || 0} tiện ích.`, "ok");
    } catch (err) {
      showStatus("Không kết nối được tới server.", "error");
    } finally {
      saveBtn.textContent = "Lưu tất cả";
      saveBtn.disabled = totalPendingCount() === 0;
    }
  }

  async function init() {
    try {
      const res = await fetch("/api/projects");
      state.data = await res.json();
      initMap();
      addMarkers();
      addLandmarkMarkers();

      var savedPending = loadPendingFromStorage();
      var restoredCount = 0;

      if (savedPending.projects && Object.keys(savedPending.projects).length > 0) {
        Object.entries(savedPending.projects).forEach(([id, coords]) => {
          const marker = state.markers[id];
          if (marker) {
            marker.setLatLng([coords.lat, coords.lng]);
            marker.getElement()?.classList.add("is-dirty");
            state.pending[id] = coords;
            restoredCount++;
          }
        });
      }

      if (savedPending.landmarks && Object.keys(savedPending.landmarks).length > 0) {
        Object.entries(savedPending.landmarks).forEach(([id, coords]) => {
          const marker = state.landmarkMarkers[id];
          if (marker) {
            marker.setLatLng([coords.lat, coords.lng]);
            marker.getElement()?.classList.add("is-dirty");
            state.pendingLandmarks[id] = coords;
            restoredCount++;
          }
        });
      }

      var backupRestored = restoreFromBackup();
      restoredCount += backupRestored;

      renderSidebar();
      updatePendingUI();
      if (backupRestored > 0) {
        showStatus("Server đã bị reset — đã khôi phục " + backupRestored + " tọa độ đã lưu trước đó. Bấm 'Lưu tất cả' để lưu lại.", "error");
      } else if (restoredCount > 0) {
        showStatus("Đã khôi phục " + restoredCount + " thay đổi chưa lưu từ phiên trước.", "ok");
      }

      document.getElementById("saveBtn").addEventListener("click", saveAll);
      document.getElementById("tabProjects").addEventListener("click", () => setView("projects"));
      document.getElementById("tabLandmarks").addEventListener("click", () => setView("landmarks"));
    } catch (err) {
      showStatus("Không tải được dữ liệu dự án.", "error");
    }
  }

  document.addEventListener("DOMContentLoaded", init);
})();
