#!/usr/bin/env node
'use strict';

const { addonBuilder, serveHTTP } = require('stremio-addon-sdk');
const { getTopMovies, searchMovies } = require('./catalog');
const { getFullMeta } = require('./filmaffinity');
const { createFileCache } = require('./cache');

const cache = createFileCache();

const manifest = {
  id: 'org.tuusuario.filmaffinity-addons', // cámbialo por tu propio id único antes de publicar
  version: '1.0.0',
  name: 'FilmAffinity',
  description: 'Top de FilmAffinity con extractos de crítica profesional y de usuarios en cada ficha',
  resources: ['catalog', 'meta'],
  types: ['movie'],
  catalogs: [
    {
      type: 'movie',
      id: 'fa-top',
      name: 'FilmAffinity — Top valoradas',
      extra: [{ name: 'search' }],
    },
  ],
  // 'tt' (no 'fa:'): el catálogo usa ids reales de IMDb para que sea
  // la MISMA ficha que reconocen AIOStream y AIOMetadata, no una
  // entrada aparte. Ver filmaffinity.js para el porqué.
  idPrefixes: ['tt'],
};

const builder = new addonBuilder(manifest);

function toCatalogMeta(movie) {
  return {
    id: movie.imdbId,
    type: 'movie',
    name: movie.title,
    poster: movie.poster || undefined,
    releaseInfo: movie.year ? String(movie.year) : undefined,
  };
}

builder.defineCatalogHandler(async ({ type, id, extra }) => {
  if (type !== 'movie' || id !== 'fa-top') return { metas: [] };

  try {
    const movies = extra && extra.search ? await searchMovies(extra.search) : await getTopMovies();
    return { metas: movies.map(toCatalogMeta) };
  } catch (err) {
    console.warn('[filmaffinity] no se pudo cargar el catálogo:', err.message);
    return { metas: [] };
  }
});

builder.defineMetaHandler(async ({ type, id }) => {
  if (type !== 'movie' || !id.startsWith('tt')) return { meta: null };

  // Solo tenemos algo que aportar si esta película pasó por nuestro
  // catálogo (Top o búsqueda) y quedó su "pista" (id de FA + datos) en
  // cache. Para cualquier otro tt-id, no respondemos — así no
  // sustituimos la ficha de Cinemeta/AIOMetadata con una vacía.
  const hint = await cache.get(`hint:${id}`);
  if (!hint) return { meta: null };

  const meta = await getFullMeta({ faId: hint.faId, imdbId: id, hint, cache });
  return { meta };
});

const port = process.env.PORT || 7000;

serveHTTP(builder.getInterface(), { port })
  .then(() => console.log(`Addon escuchando en el puerto ${port}`))
  .catch((err) => {
    console.error('No se pudo arrancar el addon:', err);
    process.exit(1);
  });
