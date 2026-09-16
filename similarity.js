'use strict';

/**
 * Normaliza un título para comparar: minúsculas, sin acentos, sin
 * puntuación sobrante. Evita falsos negativos por "à" vs "a", etc.
 */
function normalize(str) {
  return String(str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Similitud de Sørensen–Dice sobre bigramas de caracteres.
 * Devuelve un valor entre 0 (nada parecido) y 1 (idéntico).
 * No necesita ninguna dependencia externa y funciona bien para
 * títulos cortos como los de películas.
 */
function bigrams(str) {
  const set = [];
  for (let i = 0; i < str.length - 1; i++) {
    set.push(str.slice(i, i + 2));
  }
  return set;
}

function diceCoefficient(a, b) {
  const normA = normalize(a);
  const normB = normalize(b);
  if (!normA || !normB) return 0;
  if (normA === normB) return 1;

  const bigramsA = bigrams(normA);
  const bigramsB = bigrams(normB);
  if (bigramsA.length === 0 || bigramsB.length === 0) return 0;

  const mapB = new Map();
  for (const bg of bigramsB) mapB.set(bg, (mapB.get(bg) || 0) + 1);

  let intersection = 0;
  for (const bg of bigramsA) {
    const count = mapB.get(bg) || 0;
    if (count > 0) {
      intersection++;
      mapB.set(bg, count - 1);
    }
  }

  return (2 * intersection) / (bigramsA.length + bigramsB.length);
}

module.exports = { normalize, diceCoefficient };
