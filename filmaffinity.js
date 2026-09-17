'use strict';

const { getMovieDetails } = require('./movie');
const { getProfessionalReviews, getUserReviews } = require('./reviews');
const { buildReviewsBlock } = require('./format-meta');
const { createFileCache } = require('./cache');

const defaultCache = createFileCache();

/**
 * Construye la ficha (meta object) completa de Stremio para una
 * película de FilmAffinity: título, póster y sinopsis (vía Open Graph),
 * más 2 extractos de crítica profesional y 2 de usuario.
 *
 * `hint` es opcional y viene del catálogo (catalog.js), que ya conoce
 * título/año/nota/director/reparto sin necesidad de otra petición —
 * se usa como respaldo si movie.js no consigue algún dato, y para
 * rellenar campos que movie.js no cubre (director, reparto, nota).
 *
 * Nunca lanza hacia afuera: ante cualquier fallo (red, cambio de
 * maquetación) devuelve una ficha mínima a partir de `hint` en vez de
 * romper la respuesta de Stremio.
 */
async function getFullMeta(faId, hint = {}, cache = defaultCache) {
  const id = `fa:${faId}`;
  const cacheKey = `meta:${faId}`;

  try {
    const cached = await cache.get(cacheKey);
    if (cached) return cached;

    const [details, professional, user] = await Promise.all([
      getMovieDetails(faId),
      getProfessionalReviews(faId, 2),
      getUserReviews(faId, 2),
    ]);

    const { descriptionSuffix, links } = buildReviewsBlock({ professional, user });

    const ratingLine = hint.rating != null ? `FilmAffinity: ${hint.rating}/10\n\n` : '';
    const synopsis = details.description || '';

    const meta = {
      id,
      type: 'movie',
      name: details.title || hint.title || 'Título desconocido',
      poster: details.poster || hint.poster || null,
      releaseInfo: String(details.year || hint.year || ''),
      description: `${ratingLine}${synopsis}${descriptionSuffix}`,
      links,
    };

    if (hint.director && hint.director.length) meta.director = hint.director;
    if (hint.cast && hint.cast.length) meta.cast = hint.cast;

    await cache.set(cacheKey, meta, { ttlDays: 14 });
    return meta;
  } catch (err) {
    console.warn(`[filmaffinity] no se pudo construir la ficha de ${faId}:`, err.message);
    return {
      id,
      type: 'movie',
      name: hint.title || 'Título desconocido',
      poster: hint.poster || null,
      releaseInfo: hint.year ? String(hint.year) : '',
      description: hint.rating != null ? `FilmAffinity: ${hint.rating}/10` : '',
    };
  }
}

module.exports = { getFullMeta };
