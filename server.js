require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

const PROJECTS_PATH = path.join(__dirname, 'data', 'projects.json');

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

app.listen(PORT, () => {
  console.log(`TAIEMCHIA SEBDS - QL13 map server dang chay tai http://localhost:${PORT}`);
});
