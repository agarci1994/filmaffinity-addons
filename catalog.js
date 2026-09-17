'use strict';

const cheerio = require('cheerio');
const { fetchHtml, BASE_URL } = require('./http');
const { getMovieDetails } = require('./movie');
const { createFileCache } = require('./cache');

const defaultCache = createFileCache();

/**
 * Ejecuta `fn` sobre `items` con un máximo de `concurrency` en vuelo a
 * la vez. Evita tanto lanzar 30 peticiones de golpe (más papeleta de
 * que FA nos bloquee) como hacerlas una a una (30 segundos de espera).
 * Un fallo individual no aborta el resto: se resuelve como `null`.
 */
async function mapWithConcurrency(items, concurrency, fn) {
  const results = new Array(items.length);
  let next = 0;

  async function worker() {
    while (next < items.length) {
      const i = next++;
      try {
        results[i] = await fn(items[i], i);
      } catch (err) {
        results[i] = null;
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
  return results;
}

/**
 * Trocea un HTML en bloques, uno por película, usando como frontera los
 * cambios de id en los enlaces a /es/film{id}.html. Cada entrada de la
 * página repite ese enlace 2-3 veces (título duplicado, imagen, etc.),
 * así que agrupamos por "mientras el id no cambie, sigo en la misma
 * entrada" en vez de depender de nombres de clase que no podemos ver
 * desde aquí. Es la misma técnica que ya usa reviews.js para las
 * críticas de usuario.
 */
function chunkByFilmId(html) {
  const re = /href="https:\/\/www\.filmaffinity\.com\/es\/film(\d+)\.html"/g;
  const boundaries = [];
  let match;
  let lastId = null;

  while ((match = re.exec(html)) !== null) {
    const id = match[1];
    if (id !== lastId) {
      boundaries.push({ id, start: match.index });
      lastId = id;
    }
  }

  const chunks = [];
  for (let i = 0; i < boundaries.length; i++) {
    const start = boundaries[i].start;
    const end = i + 1 < boundaries.length ? boundaries[i + 1].start : html.length;
    chunks.push({ id: boundaries[i].id, html: html.slice(start, end) });
  }
  return chunks;
}

/**
 * Top FilmAffinity — confirmado en vivo: la vista de lista de
 * /es/ranking.php?rn=ranking_fa_movies expone por entrada el título, el
 * año (texto suelto junto al icono de país), la nota media en formato
 * "9,0", el número de votos, el/los director(es) y el reparto (enlaces
 * a /es/name.php?name-id=...). El reparto se muestra siempre como las 3
 * últimas personas enlazadas de la entrada; cualquier enlace de persona
 * anterior a esas 3 es director — así lo separamos sin depender de
 * clases CSS.
 *
 * No trae póster en esta vista (la vista de pósters existe, pero la
 * imagen viene envuelta en el enlace sin texto alternativo utilizable
 * desde aquí). Por eso el póster se recupera aparte, en paralelo y con
 * concurrencia limitada, la primera vez que se construye el catálogo;
 * ver getTopMovies.
 */
function parseRankingEntry(chunk) {
  const $ = cheerio.load(chunk.html);
  const text = $.root().text().replace(/\s+/g, ' ').trim();

  const title = $('a[href*="/es/film"]').first().text().trim() || null;

  const yearMatch = text.match(/\b(1[89]\d{2}|20\d{2})\b/);
  const year = yearMatch ? Number(yearMatch[0]) : null;

  const ratingMatch = text.match(/\b(\d),(\d)\b/);
  const rating = ratingMatch ? Number(`${ratingMatch[1]}.${ratingMatch[2]}`) : null;

  const people = $('a[href*="/name.php?name-id="]')
    .map((_, el) => $(el).text().trim())
    .get()
    .filter(Boolean);
  const director = people.length > 3 ? people.slice(0, people.length - 3) : [];
  const cast = people.length > 3 ? people.slice(-3) : people;

  return { id: chunk.id, title, year, rating, director, cast };
}

async function getTopMovies({ limit = 30, cache = defaultCache } = {}) {
  const cacheKey = `top:${limit}`;
  const cached = await cache.get(cacheKey);
  if (cached) return cached;

  const html = await fetchHtml('/es/ranking.php?rn=ranking_fa_movies');
  const chunks = chunkByFilmId(html).slice(0, limit);
  const entries = chunks.map(parseRankingEntry).filter((m) => m.title);

  // Póster: no viene en esta vista de lista (ver nota más arriba), así
  // que se busca aparte con concurrencia limitada — una sola vez por
  // ventana de cache, no en cada visita al catálogo.
  const posters = await mapWithConcurrency(entries, 5, async (entry) => {
    const details = await getMovieDetails(entry.id);
    return details.poster;
  });

  const movies = entries.map((entry, i) => ({ ...entry, poster: posters[i] || null }));

  // Guarda también una "pista" individual por película (nota, director,
  // reparto, póster) para que defineMetaHandler no tenga que volver a
  // sacarlos cuando el usuario abra la ficha.
  for (const movie of movies) {
    await cache.set(`hint:${movie.id}`, movie, { ttlDays: 7 });
  }

  await cache.set(cacheKey, movies, { ttlDays: 3 });
  return movies;
}

/**
 * Búsqueda por texto libre. A diferencia del Top, esta parte SÍ sigue
 * teniendo el mismo aviso que en la versión anterior del proyecto: no
 * he podido confirmar contra el HTML real en vivo el detalle exacto de
 * la página de resultados (mi entorno no tiene salida de red hacia
 * filmaffinity.com desde el sandbox de ejecución de código). Usa
 * probe.js para calibrar esta parte en 2 minutos si los resultados
 * salen vacíos o incompletos.
 */
async function searchMovies(query, { limit = 20 } = {}) {
  const html = await fetchHtml(`/es/search.php?stext=${encodeURIComponent(query)}&stype=title`);
  const $ = cheerio.load(html);
  const seen = new Set();
  const results = [];

  $('a[href*="/es/film"][href$=".html"]').each((_, el) => {
    if (results.length >= limit) return;
    const $el = $(el);
    const href = $el.attr('href') || '';
    const idMatch = href.match(/film(\d+)\.html/);
    if (!idMatch || seen.has(idMatch[1])) return;

    const title = $el.text().trim() || $el.attr('title') || '';
    if (!title) return;
    seen.add(idMatch[1]);

    const container = $el.closest('div, li, tr');
    const yearMatch = container.text().match(/\b(1[89]\d{2}|20\d{2})\b/);

    results.push({
      id: idMatch[1],
      title,
      year: yearMatch ? Number(yearMatch[0]) : null,
    });
  });

  return results;
}

module.exports = { getTopMovies, searchMovies, BASE_URL };
