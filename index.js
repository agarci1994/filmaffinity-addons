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
  idPrefixes: ['fa:'],
};

const builder = new addonBuilder(manifest);

function toCatalogMeta(movie) {
  return {
    id: `fa:${movie.id}`,
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
  if (type !== 'movie' || !id.startsWith('fa:')) return { meta: null };

  const faId = id.slice('fa:'.length);
  const hint = (await cache.get(`hint:${faId}`)) || {};
  const meta = await getFullMeta(faId, hint, cache);
  return { meta };
});

const port = process.env.PORT || 7000;

serveHTTP(builder.getInterface(), { port })
  .then(() => console.log(`Addon escuchando en el puerto ${port}`))
  .catch((err) => {
    console.error('No se pudo arrancar el addon:', err);
    process.exit(1);
  });
