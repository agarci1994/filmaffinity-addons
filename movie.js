'use strict';

const cheerio = require('cheerio');
const { fetchHtml } = require('./http');

const NEXT_LABELS = ['Año', 'Duración', 'País', 'Dirección', 'Guion', 'Reparto'];

/**
 * Título original de la ficha técnica ("Título original · The
 * Godfather · Año · 1972 · Duración · ..."), confirmado en vivo hoy en
 * varias fichas reales de FA. Se busca sobre el texto plano de toda la
 * página (no una clase concreta, que no he podido confirmar) y se
 * corta en cuanto aparece la siguiente etiqueta conocida de la ficha
 * técnica. Es el título que hay que darle a OMDb: FA muestra el
 * título en español, pero OMDb/IMDb indexan por el título original —
 * "El padrino" no encuentra nada en OMDb, "The Godfather" sí.
 */
function extractOriginalTitle(pageText) {
  const idx = pageText.indexOf('Título original');
  if (idx === -1) return null;

  const afterLabel = pageText.slice(idx + 'Título original'.length);
  let cut = afterLabel.length;
  for (const label of NEXT_LABELS) {
    const labelIdx = afterLabel.indexOf(label);
    if (labelIdx !== -1 && labelIdx < cut) cut = labelIdx;
  }

  const value = afterLabel.slice(0, cut).replace(/^[\s·:]+|[\s·:]+$/g, '').trim();
  return value || null;
}

/**
 * Título, póster y sinopsis vía Open Graph (og:title, og:image,
 * og:description). Son etiquetas que cualquier sitio pensado para
 * compartirse en redes mantiene estables — a diferencia de las clases
 * CSS del maquetado, esto no depende de cómo FA organice su HTML por
 * dentro, así que es la parte del scraper con más garantías de seguir
 * funcionando aunque FA rediseñe la página.
 */
async function getMovieDetails(faId) {
  const html = await fetchHtml(`/es/film${faId}.html`);
  const $ = cheerio.load(html);

  const ogTitle = $('meta[property="og:title"]').attr('content') || '';
  const poster = $('meta[property="og:image"]').attr('content') || null;
  const description =
    $('meta[property="og:description"]').attr('content') ||
    $('meta[name="description"]').attr('content') ||
    '';

  // El título en og:title a veces incluye el año entre paréntesis
  // ("Título (2000)"); si está, lo separamos. Si no aparece, se deja a
  // null y quien llame puede rellenarlo con lo que ya sepa (p.ej. del
  // Top, que sí trae el año confirmado).
  const yearMatch = ogTitle.match(/\((\d{4})\)\s*$/);
  const title = (yearMatch ? ogTitle.slice(0, yearMatch.index) : ogTitle).trim() || null;
  const year = yearMatch ? Number(yearMatch[1]) : null;

  const pageText = $.root().text().replace(/\s+/g, ' ').trim();
  const originalTitle = extractOriginalTitle(pageText);

  return { title, year, poster, description, originalTitle };
}

module.exports = { getMovieDetails };
