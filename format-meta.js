'use strict';

/**
 * Construye el bloque de reseñas para inyectar en un meta object de
 * Stremio: un añadido de texto plano para `description` y una lista de
 * `links` (categoría propia) que abren cada reseña completa en origen.
 */
function buildReviewsBlock({ professional = [], user = [] }) {
  const lines = [];

  if (professional.length) {
    lines.push('', '— Crítica profesional —');
    for (const r of professional) {
      const attribution = [r.outlet, r.author].filter(Boolean).join(', ');
      lines.push(`"${r.excerpt}" (${attribution})`);
    }
  }

  if (user.length) {
    lines.push('', '— Opinión de usuarios (FilmAffinity) —');
    for (const r of user) {
      const scoreLabel = r.score != null ? `, ${r.score}/10` : '';
      lines.push(`"${r.excerpt}" (${r.username}${scoreLabel})`);
    }
  }

  const links = [];
  for (const r of professional) {
    if (!r.sourceUrl) continue;
    links.push({
      name: `${r.outlet} — leer completa`,
      category: 'Crítica profesional',
      url: r.sourceUrl,
    });
  }
  for (const r of user) {
    if (!r.sourceUrl) continue;
    links.push({
      name: `${r.username} — leer completa`,
      category: 'Opinión de usuarios',
      url: r.sourceUrl,
    });
  }

  return { descriptionSuffix: lines.join('\n'), links };
}

module.exports = { buildReviewsBlock };
