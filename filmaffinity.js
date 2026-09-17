'use strict';

const { getMovieDetails } = require('./movie');
const { getProfessionalReviews, getUserReviews } = require('./reviews');
const { buildReviewsBlock } = require('./format-meta');
const { createFileCache } = require('./cache');

const defaultCache = createFileCache();

/**
 * Construye la ficha (meta object) completa de Stremio para una
 * película: título, póster y sinopsis de FilmAffinity (vía Open
 * Graph), más 2 extractos de crítica profesional y 2 de usuario.
 *
 * El id que se le da a Stremio (`imdbId`, tt...) es distinto del id
 * que se usa para scrapear FilmAffinity (`faId`, numérico) — así la
 * ficha es la MISMA que reconocen AIOStream/AIOMetadata, no una
 * entrada aparte que solo existe para este addon.
 *
 * `hint` viene del catálogo (catalog.js), que ya conoce
 * título/año/nota/director/reparto sin otra petición — se usa como
 * respaldo si movie.js falla, y para campos que movie.js no cubre.
 *
 * Nunca lanza hacia afuera: ante cualquier fallo devuelve una ficha
 * mínima a partir de `hint` en vez de romper la respuesta de Stremio.
 */
async function getFullMeta({ faId, imdbId, hint = {}, cache = defaultCache }) {
  const cacheKey = `meta:${imdbId}`;

  try {
    const cached = await cache.get(cacheKey);
    if (cached) return cached;

    const [details, professional, user] = await Promise.all([
      getMovieDetails(faId),
      getProfessionalReviews(faId, 2),
      getUserReviews(faId, 2),
    ]);

    const { descriptionSuffix, links } = buildReviewsBlock({ professional, user, rating: hint.rating });

    const synopsis = details.description || '';

    const meta = {
      id: imdbId,
      type: 'movie',
      name: details.title || hint.title || 'Título desconocido',
      poster: details.poster || hint.poster || null,
      releaseInfo: String(details.year || hint.year || ''),
      description: `${synopsis}${descriptionSuffix}`,
      links,
    };

    if (hint.director && hint.director.length) meta.director = hint.director;
    if (hint.cast && hint.cast.length) meta.cast = hint.cast;

    await cache.set(cacheKey, meta, { ttlDays: 14 });
    return meta;
  } catch (err) {
    console.warn(`[filmaffinity] no se pudo construir la ficha de ${imdbId} (FA ${faId}):`, err.message);
    return {
      id: imdbId,
      type: 'movie',
      name: hint.title || 'Título desconocido',
      poster: hint.poster || null,
      releaseInfo: hint.year ? String(hint.year) : '',
      description: hint.rating != null ? `⭐ FilmAffinity: ${hint.rating}/10` : '',
    };
  }
}

module.exports = { getFullMeta };
