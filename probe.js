'use strict';

/**
 * Uso: node probe.js
 *      node probe.js "término de búsqueda"
 *
 * Corre esto UNA VEZ con conexión real a filmaffinity.com antes de
 * confiar en el addon en producción. Sin argumentos, prueba el Top y
 * construye la ficha completa de la primera película (con reseñas
 * incluidas). Con un argumento, prueba la búsqueda con ese término.
 */
const { getTopMovies, searchMovies } = require('./catalog');
const { getFullMeta } = require('./filmaffinity');

async function main() {
  const query = process.argv[2];

  if (query) {
    console.log(`\n→ Buscando "${query}"...`);
    const results = await searchMovies(query);
    console.log(`  ${results.length} resultados`);
    results.slice(0, 5).forEach((r) => console.log(`  - [${r.id}] ${r.title} (${r.year ?? '?'})`));
    if (results.length === 0) {
      console.log('⚠ Cero resultados: revisa el selector de search.php en catalog.js (searchMovies).');
    }
    return;
  }

  console.log('\n→ Top FilmAffinity...');
  const top = await getTopMovies({ limit: 10 });
  console.log(`  ${top.length} películas`);
  top.forEach((m) =>
    console.log(
      `  #${m.id} ${m.title} (${m.year ?? '?'}) — ${m.rating ?? '?'}/10 — dir: ${m.director.join(', ') || '?'} — póster: ${m.poster ? 'sí' : 'no'}`
    )
  );

  if (top.length === 0) {
    console.log('⚠ Top vacío: revisa chunkByFilmId/parseRankingEntry en catalog.js.');
    return;
  }

  const first = top[0];
  console.log(`\n→ Ficha completa de "${first.title}" (id ${first.id})...`);
  const meta = await getFullMeta(first.id, first);
  console.log(JSON.stringify(meta, null, 2));
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
