'use strict';

/**
 * Uso: node probe.js
 *      node probe.js "término de búsqueda"
 *
 * Corre esto UNA VEZ con conexión real a filmaffinity.com (y con
 * OMDB_API_KEY configurada) antes de confiar en el addon en
 * producción. Sin argumentos, prueba el Top y construye la ficha
 * completa de la primera película con id de IMDb (con reseñas
 * incluidas). Con un argumento, prueba la búsqueda con ese término.
 */
const { getTopMovies, searchMovies } = require('./catalog');
const { getFullMeta } = require('./filmaffinity');
const { hasOmdbKey } = require('./imdb');

async function main() {
  if (!hasOmdbKey()) {
    console.log('⚠ OMDB_API_KEY no está configurada — todo saldrá sin id de IMDb (0 resultados).');
  }

  const query = process.argv[2];

  if (query) {
    console.log(`\n→ Buscando "${query}"...`);
    const results = await searchMovies(query);
    console.log(`  ${results.length} resultados con id de IMDb`);
    results.slice(0, 5).forEach((r) => console.log(`  - [FA ${r.faId} / ${r.imdbId}] ${r.title} (${r.year ?? '?'})`));
    if (results.length === 0) {
      console.log('⚠ Cero resultados: revisa el selector de search.php en catalog.js (searchMovies), o la clave de OMDb.');
    }
    return;
  }

  console.log('\n→ Top FilmAffinity...');
  const top = await getTopMovies({ limit: 10 });
  console.log(`  ${top.length} películas con id de IMDb resuelto`);
  top.forEach((m) =>
    console.log(
      `  [FA ${m.faId} / ${m.imdbId}] ${m.title} (${m.year ?? '?'}) — ${m.rating ?? '?'}/10 — dir: ${m.director.join(', ') || '?'} — póster: ${m.poster ? 'sí' : 'no'}`
    )
  );

  if (top.length === 0) {
    console.log('⚠ Top vacío: revisa chunkByFilmId/parseRankingEntry en catalog.js, o la clave de OMDb (sin ella se descarta todo).');
    return;
  }

  const first = top[0];
  console.log(`\n→ Ficha completa de "${first.title}" (FA ${first.faId} / ${first.imdbId})...`);
  const meta = await getFullMeta({ faId: first.faId, imdbId: first.imdbId, hint: first });
  console.log(JSON.stringify(meta, null, 2));
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
