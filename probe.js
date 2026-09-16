'use strict';

/**
 * Uso: node scripts/probe.js "Título de la película" 2018
 *
 * Corre esto UNA VEZ con conexión real a filmaffinity.com antes de
 * confiar en resolve.js/reviews.js en producción. Imprime cuántos
 * candidatos encuentra el matching y cuántas reseñas extrae de cada
 * tipo, para pillar rápido si algún selector se ha quedado desfasado.
 */
const { resolveFilmAffinityId } = require('../src/filmaffinity/resolve');
const { getProfessionalReviews, getUserReviews } = require('../src/filmaffinity/reviews');

async function main() {
  const title = process.argv[2];
  const year = process.argv[3] ? Number(process.argv[3]) : undefined;

  if (!title) {
    console.error('Uso: node scripts/probe.js "Título" [año]');
    process.exit(1);
  }

  console.log(`\n→ Resolviendo "${title}" (${year || 'sin año'})...`);
  const match = await resolveFilmAffinityId(title, year);

  if (!match) {
    console.log('✗ No se encontró ningún candidato. Revisa SEARCH_RESULT_SELECTOR en resolve.js.');
    return;
  }

  console.log(`✓ Match: ${match.title} (${match.year}) — id ${match.id} — score ${match.score.toFixed(2)}`);
  console.log(`  ${match.url}`);

  console.log('\n→ Críticas profesionales...');
  const professional = await getProfessionalReviews(match.id, 2);
  console.log(`  ${professional.length} extraídas`);
  professional.forEach((r, i) => console.log(`  [${i + 1}] ${r.outlet}: "${r.excerpt.slice(0, 80)}..."`));

  console.log('\n→ Críticas de usuario...');
  const user = await getUserReviews(match.id, 2);
  console.log(`  ${user.length} extraídas`);
  user.forEach((r, i) => console.log(`  [${i + 1}] ${r.username} (${r.score ?? '?'}/10): "${r.excerpt.slice(0, 80)}..."`));

  if (professional.length === 0) {
    console.log('\n⚠ Cero críticas profesionales: revisa el selector de tabla en getProfessionalReviews.');
  }
  if (user.length === 0) {
    console.log('⚠ Cero críticas de usuario: revisa el troceado por userratings.php en getUserReviews.');
  }
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
