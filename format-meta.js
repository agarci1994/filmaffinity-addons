'use strict';

/**
 * Construye el bloque de reseñas para inyectar en un meta object de
 * Stremio: un añadido de texto plano con jerarquía visual clara para
 * `description`, y una lista de `links` (chips cortos, no la cita
 * entera) que abren cada reseña completa en origen.
 *
 * Stremio no renderiza HTML/markdown en `description` — solo texto
 * plano — así que el "estilo" aquí se consigue con cabeceras en
 * mayúsculas, emojis como separador visual y una línea en blanco entre
 * bloques, no con maquetación real.
 */
function buildReviewsBlock({ professional = [], user = [], rating = null } = {}) {
  const lines = [];

  if (rating != null) {
    lines.push(`⭐ FilmAffinity: ${rating}/10`);
  }

  if (professional.length) {
    lines.push('', '🎬 CRÍTICA PROFESIONAL');
    for (const r of professional) {
      const attribution = [r.outlet, r.author].filter(Boolean).join(', ');
      lines.push(`"${r.excerpt}"`, `— ${attribution}`, '');
    }
    lines.pop(); // quita la línea en blanco sobrante del último bloque
  }

  if (user.length) {
    lines.push('', '👤 OPINIÓN DE USUARIOS');
    for (const r of user) {
      const scoreLabel = r.score != null ? ` (${r.score}/10)` : '';
      lines.push(`"${r.excerpt}"`, `— ${r.username}${scoreLabel}`, '');
    }
    lines.pop();
  }

  // Los links son chips cortos y tocables: aquí NO va la cita entera
  // (eso queda en description), solo el nombre + una llamada a la
  // acción, para que no se vean como bloques de texto gigantes.
  const links = [];
  for (const r of professional) {
    if (!r.sourceUrl) continue;
    links.push({
      name: `🎬 ${r.outlet} — ver crítica completa`,
      category: 'Crítica profesional',
      url: r.sourceUrl,
    });
  }
  for (const r of user) {
    if (!r.sourceUrl) continue;
    const scoreLabel = r.score != null ? ` (${r.score}/10)` : '';
    links.push({
      name: `👤 ${r.username}${scoreLabel} — ver reseña completa`,
      category: 'Opinión de usuarios',
      url: r.sourceUrl,
    });
  }

  return { descriptionSuffix: lines.length ? `\n\n${lines.join('\n')}` : '', links };
}

module.exports = { buildReviewsBlock };
