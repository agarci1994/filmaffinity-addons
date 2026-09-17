'use strict';

const cheerio = require('cheerio');
const { fetchHtml } = require('./http');

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

  return { title, year, poster, description };
}

module.exports = { getMovieDetails };
