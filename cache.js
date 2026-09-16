'use strict';

const fs = require('fs');
const path = require('path');

/**
 * Cache mínima basada en un JSON en disco. Suficiente para arrancar y
 * para el paso de indexado por lotes; si el addon crece o se despliega
 * con varias instancias, sustitúyela por Redis (misma interfaz get/set).
 */
function createFileCache(filePath = path.join(__dirname, '.fa-cache.json')) {
  function readAll() {
    try {
      return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch {
      return {};
    }
  }

  function writeAll(data) {
    fs.writeFileSync(filePath, JSON.stringify(data), 'utf8');
  }

  return {
    async get(key) {
      const store = readAll();
      const entry = store[key];
      if (!entry) return null;
      if (entry.expiresAt && Date.now() > entry.expiresAt) return null;
      return entry.value;
    },
    async set(key, value, { ttlDays = 21 } = {}) {
      const store = readAll();
      store[key] = {
        value,
        expiresAt: Date.now() + ttlDays * 24 * 60 * 60 * 1000,
      };
      writeAll(store);
    },
  };
}

module.exports = { createFileCache };
