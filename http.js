'use strict';

const fetch = require('node-fetch');

const BASE_URL = 'https://www.filmaffinity.com';

// Identifícate: un User-Agent genérico de navegador es lo habitual en
// scrapers, pero incluir el nombre del proyecto + un contacto es la
// práctica "educada" — si algún día FA quiere bloquear o contactar,
// puede hacerlo sin tener que banear IPs a ciegas.
const USER_AGENT =
  'Mozilla/5.0 (compatible; StremioFA-Enricher/1.0; +https://github.com/tu-usuario/tu-addon)';

async function fetchHtml(path) {
  const url = path.startsWith('http') ? path : `${BASE_URL}${path}`;
  const res = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      'Accept-Language': 'es-ES,es;q=0.9',
    },
  });

  if (!res.ok) {
    throw new Error(`FilmAffinity respondió ${res.status} para ${url}`);
  }

  return res.text();
}

module.exports = { fetchHtml, BASE_URL };
