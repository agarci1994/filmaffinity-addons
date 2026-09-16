'use strict';

const cheerio = require('cheerio');
const { fetchHtml, BASE_URL } = require('./http');
const { diceCoefficient } = require('./similarity');

// FA no tiene API ni acepta IMDb IDs: hay que buscar por título y
// desambiguar por año. Este es el único punto de todo el pipeline que
// no he podido verificar contra el HTML real en vivo (mi entorno no
// tiene salida de red hacia filmaffinity.com), así que el selector de
// resultados de búsqueda es la parte a confirmar primero — ver
// scripts/probe-search.js más abajo para hacerlo en 2 minutos.
const SEARCH_RESULT_SELECTOR = 'a[href*="/es/film"][href$=".html"]';

function extractFilmId(href) {
  const match = href.match(/film(\d+)\.html/);
  return match ? match[1] : null;
}

/**
 * Busca una película en FilmAffinity y devuelve el mejor candidato.
 * @returns {Promise<{id: string, title: string, year: number|null, url: string, score: number}|null>}
 */
async function resolveFilmAffinityId(title, year) {
  const searchUrl = `/es/search.php?stext=${encodeURIComponent(title)}&stype=title`;
  const html = await fetchHtml(searchUrl);
  const $ = cheerio.load(html);

  const seen = new Set();
  const candidates = [];

  $(SEARCH_RESULT_SELECTOR).each((_, el) => {
    const $el = $(el);
    const href = $el.attr('href') || '';
    const id = extractFilmId(href);
    if (!id || seen.has(id)) return;
    seen.add(id);

    // El año suele aparecer como texto suelto cerca del enlace dentro
    // de la misma tarjeta de resultado; buscamos en el contenedor más
    // cercano razonable en vez de asumir una clase concreta.
    const container = $el.closest('div, li, tr');
    const containerText = container.text();
    const yearMatch = containerText.match(/\b(19|20)\d{2}\b/);

    const candidateTitle = $el.text().trim() || $el.attr('title') || '';
    if (!candidateTitle) return;

    candidates.push({
      id,
      title: candidateTitle,
      year: yearMatch ? Number(yearMatch[0]) : null,
      url: href.startsWith('http') ? href : `${BASE_URL}${href}`,
    });
  });

  if (candidates.length === 0) return null;

  const scored = candidates.map((c) => {
    const titleScore = diceCoefficient(c.title, title);
    const yearMismatch = year && c.year && Math.abs(c.year - year) > 1;
    const score = yearMismatch ? titleScore * 0.5 : titleScore;
    return { ...c, score };
  });

  scored.sort((a, b) => b.score - a.score);
  const best = scored[0];

  // Umbral conservador: preferimos no enriquecer a enriquecer con la
  // película equivocada (remakes, secuelas con el mismo nombre, etc.)
  return best.score >= 0.55 ? best : null;
}

module.exports = { resolveFilmAffinityId };
