'use strict';

const fetch = require('node-fetch');

// OMDb es gratis pero necesita una clave propia (30 segundos en
// https://www.omdbapi.com/apikey.aspx, plan gratuito). El límite del
// plan gratuito es 1.000 peticiones/día — de sobra para esto, porque
// el Top se cachea 3 días y solo se resuelve una vez por ventana de
// cache (ver catalog.js).
const OMDB_API_KEY = process.env.OMDB_API_KEY;

/**
 * Devuelve el id de IMDb ("tt1234567") para un título+año, o null si
 * no hay clave configurada, no hay match, o falla la petición. Nunca
 * lanza: quien llame simplemente no tendrá id de IMDb para esa
 * película y el catálogo la omite (ver catalog.js).
 */
async function getImdbId(title, year) {
  if (!OMDB_API_KEY) return null;

  try {
    const params = new URLSearchParams({
      apikey: OMDB_API_KEY,
      t: title,
      type: 'movie',
    });
    if (year) params.set('y', String(year));

    const res = await fetch(`https://www.omdbapi.com/?${params.toString()}`);
    if (!res.ok) return null;

    const data = await res.json();
    if (data.Response === 'False' || !data.imdbID) return null;

    return data.imdbID;
  } catch (err) {
    return null;
  }
}

module.exports = { getImdbId, hasOmdbKey: () => Boolean(OMDB_API_KEY) };
