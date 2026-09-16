'use strict';

const { resolveFilmAffinityId } = require('./resolve');
const { getProfessionalReviews, getUserReviews } = require('./reviews');
const { buildReviewsBlock } = require('./format-meta');
const { createFileCache } = require('./cache');

const defaultCache = createFileCache();

/**
 * Enriquece un meta object de Stremio con extractos de FilmAffinity
 * (2 críticas profesionales + 2 de usuario). Diseñado para no romper
 * nunca la respuesta de `meta`: cualquier fallo (matching, scraping,
 * cambio de maquetación) hace que se devuelva el meta original intacto.
 *
 * @param {object} meta - meta object ya construido por tu addon
 * @param {{title: string, year: number}} info - para resolver el ID de FA
 * @param {{get: Function, set: Function}} [cache] - por defecto, cache en disco
 */
async function enrichMetaWithFilmAffinity(meta, { title, year }, cache = defaultCache) {
  try {
    const cacheKey = `fa:${title.toLowerCase()}:${year || 'sinanio'}`;
    let data = await cache.get(cacheKey);

    if (!data) {
      const match = await resolveFilmAffinityId(title, year);
      if (!match) {
        await cache.set(cacheKey, { faId: null, professional: [], user: [] }, { ttlDays: 7 });
        return meta;
      }

      const [professional, user] = await Promise.all([
        getProfessionalReviews(match.id, 2),
        getUserReviews(match.id, 2),
      ]);

      data = { faId: match.id, professional, user };
      await cache.set(cacheKey, data, { ttlDays: 21 });
    }

    if (!data.faId || (!data.professional.length && !data.user.length)) {
      return meta;
    }

    const { descriptionSuffix, links } = buildReviewsBlock(data);

    return {
      ...meta,
      description: `${meta.description || ''}${descriptionSuffix}`,
      links: [...(meta.links || []), ...links],
    };
  } catch (err) {
    console.warn(`[filmaffinity] no se pudo enriquecer "${title}":`, err.message);
    return meta;
  }
}

module.exports = { enrichMetaWithFilmAffinity };
