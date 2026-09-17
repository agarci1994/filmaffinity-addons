'use strict';

const cheerio = require('cheerio');
const { fetchHtml, BASE_URL } = require('./http');

const MAX_USER_EXCERPT_CHARS = 260;

function truncate(text, max = MAX_USER_EXCERPT_CHARS) {
  const clean = String(text).replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max);
  const lastSpace = cut.lastIndexOf(' ');
  return `${cut.slice(0, lastSpace > 0 ? lastSpace : max)}…`;
}

/**
 * Críticas profesionales — confirmado en vivo: FA las sirve en una
 * tabla (país / medio / autor+medio / cita entrecomillada con enlace
 * "ver fuente"). El extracto YA viene recortado por FA; no lo ampliamos
 * ni vamos a buscar el artículo completo en la web del medio.
 *
 * Aviso legal que la propia FA muestra en esa página: los derechos de
 * las críticas son de los críticos/medios originales. Por eso el
 * formateador (format-meta.js) siempre añade el enlace "leer completa"
 * junto al extracto.
 */
async function getProfessionalReviews(faId, limit = 2) {
  const html = await fetchHtml(`/es/pro-reviews.php?movie-id=${faId}`);
  const $ = cheerio.load(html);
  const reviews = [];

  $('table tr').each((_, row) => {
    if (reviews.length >= limit) return;

    const cells = $(row).find('td');
    if (cells.length < 3) return; // cabecera u otra fila sin datos

    const quoteCell = cells.last();
    const quoteLink = quoteCell.find('a').first();
    const rawQuote = (quoteLink.text() || quoteCell.text()).trim();
    const quote = rawQuote.replace(/^["“]+|["”]+$/g, '').trim();
    if (quote.length < 15) return; // descarta filas sin cita real

    const authorCell = cells.eq(Math.max(cells.length - 2, 0));
    const author = authorCell.find('a').first().text().trim();
    const outlet =
      authorCell.find('i, em').first().text().trim() ||
      authorCell.find('a').eq(1).text().trim() ||
      author;

    reviews.push({
      outlet: outlet || 'Medio no identificado',
      author,
      excerpt: quote,
      sourceUrl: quoteLink.attr('href') || null,
    });
  });

  return reviews;
}

/**
 * Críticas de usuario — a diferencia de las profesionales, FA muestra
 * el texto COMPLETO (multi-párrafo) de cada reseña, ordenadas por
 * utilidad por defecto. Tomamos las N primeras de esa lista (ya son
 * las más votadas como útiles) y las truncamos nosotros a un extracto.
 *
 * No he podido confirmar los nombres de clase reales del contenedor de
 * cada reseña (mi entorno no tiene salida de red hacia filmaffinity.com),
 * así que en vez de un selector CSS por clase, trocea el HTML usando
 * como frontera el enlace al perfil de usuario, que sí es un patrón de
 * URL estable: /es/userratings.php?user_id=NNN. Es más tosco que un
 * selector fino, pero no depende de nada que no se pueda verificar.
 * Ver probe.js para calibrar/ajustar esto en 2 min.
 */
async function getUserReviews(faId, limit = 2) {
  const html = await fetchHtml(`/es/reviews/1/${faId}.html`);

  const chunks = html.split(/(?=<a[^>]+href="[^"]*\/userratings\.php\?user_id=\d+)/);
  const reviews = [];

  for (const chunk of chunks) {
    if (reviews.length >= limit) break;
    if (!/userratings\.php\?user_id=\d+/.test(chunk)) continue;

    const $ = cheerio.load(chunk);

    const username = $('a[href*="/userratings.php?user_id="]').first().text().trim();
    const permalinkEl = $('a[href*="/user/rating/"]').first();
    const permalink = permalinkEl.attr('href');
    if (!username || !permalink) continue;

    const paragraphs = $('p')
      .map((_, p) => $(p).text().trim())
      .get()
      .filter(Boolean);
    const body = paragraphs.length ? paragraphs.join(' ') : $.root().text();
    if (!body || body.replace(/\s+/g, ' ').trim().length < 30) continue;

    // Best-effort: la puntuación suele aparecer como número suelto
    // (1-10) cerca del principio del bloque. Puede fallar (p.ej. si
    // confunde un contador de votos) — por eso es opcional en el
    // resultado y el formateador lo omite si viene a null.
    const headText = $.root().text().replace(/\s+/g, ' ').trim().slice(0, 200);
    const scoreMatch = headText.match(/\b(10|[1-9])\b/);

    reviews.push({
      username,
      score: scoreMatch ? Number(scoreMatch[1]) : null,
      excerpt: truncate(body),
      sourceUrl: permalink.startsWith('http') ? permalink : `${BASE_URL}${permalink}`,
    });
  }

  return reviews;
}

module.exports = { getProfessionalReviews, getUserReviews, truncate };
