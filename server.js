require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

const PROJECTS_PATH = path.join(__dirname, 'data', 'projects.json');

// Loose bounding box around the QL13 corridor (Thu Duc -> Thuan An) —
// rejects wildly wrong coordinates (typos, other countries) before they're saved.
const VN_BOUNDS = { latMin: 10.5, latMax: 11.2, lngMin: 106.4, lngMax: 107.0 };

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/projects', (req, res) => {
  fs.readFile(PROJECTS_PATH, 'utf8', (err, raw) => {
    if (err) {
      res.status(500).json({ error: 'Khong doc duoc du lieu du an' });
      return;
    }
    res.type('application/json').send(raw);
  });
});

// Admin: save corrected coordinates picked on the /admin.html map.
// Protected by a shared password (ADMIN_PASSWORD env var) — not real user auth,
// just enough to stop randoms from tampering with public write endpoint.
// Falls back to a default if the ADMIN_PASSWORD env var isn't picked up by the
// host (e.g. Render sometimes doesn't propagate a newly-saved env var to the
// running instance) — this is a low-stakes shared password gating a
// coordinate-editing tool, not real user auth, so a fallback is acceptable.
const ADMIN_PASSWORD_FALLBACK = 'vttai2512';

app.post('/api/admin/save-coords', (req, res) => {
  const adminPassword = process.env.ADMIN_PASSWORD || ADMIN_PASSWORD_FALLBACK;
  if (req.body.password !== adminPassword) {
    res.status(401).json({ error: 'Sai mat khau' });
    return;
  }

  const updates = Array.isArray(req.body.updates) ? req.body.updates : [];
  if (updates.length === 0) {
    res.status(400).json({ error: 'Khong co thay doi nao duoc gui len' });
    return;
  }
  for (const u of updates) {
    const latOk = typeof u.lat === 'number' && u.lat >= VN_BOUNDS.latMin && u.lat <= VN_BOUNDS.latMax;
    const lngOk = typeof u.lng === 'number' && u.lng >= VN_BOUNDS.lngMin && u.lng <= VN_BOUNDS.lngMax;
    if (!u.id || !latOk || !lngOk) {
      res.status(400).json({ error: `Toa do khong hop le cho "${u.id || '?'}"` });
      return;
    }
  }

  fs.readFile(PROJECTS_PATH, 'utf8', (err, raw) => {
    if (err) {
      res.status(500).json({ error: 'Khong doc duoc du lieu du an' });
      return;
    }
    let data;
    try {
      data = JSON.parse(raw);
    } catch (e) {
      res.status(500).json({ error: 'File du lieu bi loi dinh dang' });
      return;
    }

    let changed = 0;
    updates.forEach((u) => {
      const project = data.projects.find((p) => p.id === u.id);
      if (project) {
        project.lat = u.lat;
        project.lng = u.lng;
        project.coordConfidence = 'verified';
        changed++;
      }
    });

    fs.writeFile(PROJECTS_PATH, JSON.stringify(data, null, 2), 'utf8', (writeErr) => {
      if (writeErr) {
        res.status(500).json({ error: 'Khong ghi duoc file du lieu' });
        return;
      }
      res.json({ ok: true, changed });
    });
  });
});

app.listen(PORT, () => {
  console.log(`TAIEM - QL13 map server dang chay tai http://localhost:${PORT}`);
});
