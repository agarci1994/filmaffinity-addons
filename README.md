# Addon de Stremio: FilmAffinity

Addon centrado en FilmAffinity: catálogo con el Top de películas mejor
valoradas (con buscador), y en cada ficha, sinopsis y póster reales
más 2 extractos de crítica profesional y 2 de usuarios, cada uno con
enlace a la reseña completa.

El catálogo usa **ids reales de IMDb** (no un id inventado), para que
sea la misma ficha que ya reconocen AIOStream y AIOMetadata — no una
entrada aparte y desconectada. Esto significa que **AIOStream sí te
dará streams** en las películas de este catálogo. Lo que no puede
garantizar ningún addon por su cuenta: cuando dos addons responden a
la ficha del mismo id, Stremio se queda con el de mayor prioridad en
tu lista de addons, no los combina campo a campo — así que si
AIOMetadata está por delante en tu lista, verás su ficha (más rica
visualmente) sin nuestras reseñas; si pones este addon por delante,
verás las reseñas pero perderás lo que aporta AIOMetadata. Es una
limitación de la plataforma, no de este addon: ni AIOMetadata ni
Bingecat ofrecen una forma de añadir un addon propio como fuente de
metadatos (sus proveedores son una lista fija).

## Instalación y arranque

```
npm install
```

Necesitas una clave gratuita de OMDb (para pasar de título/año de FA a
id de IMDb): sácala en https://www.omdbapi.com/apikey.aspx (plan
gratuito, 1.000 peticiones/día — de sobra, porque el Top se cachea 3
días y solo se resuelve una vez por ventana de cache) y expórtala:

```
export OMDB_API_KEY=tu_clave
npm start
```

En Render/Beamup/etc., añade `OMDB_API_KEY` como variable de entorno
del servicio en vez de exportarla a mano.

Sin esa clave, el catálogo sale vacío: cada película se descarta si no
se le encuentra id de IMDb (a propósito — mejor vacío que colar ids
inventados que no le sirven a AIOStream/AIOMetadata).

Esto expone `http://localhost:7000/manifest.json`, instalable en
Stremio (Addons → pegar la URL del manifest).

## Estructura

- `http.js` — cliente HTTP compartido (User-Agent identificable, base URL)
- `catalog.js` — Top de FilmAffinity (`ranking.php?rn=ranking_fa_movies`) y buscador (`search.php`), con resolución de id de IMDb
- `imdb.js` — título/año de FA → id de IMDb, vía OMDb
- `movie.js` — título/póster/sinopsis de una película vía etiquetas Open Graph
- `reviews.js` — 2 extractos de crítica profesional + 2 de usuario por película (por id de FA)
- `format-meta.js` — construye el bloque de reseñas (con jerarquía visual) para `description`/`links`
- `filmaffinity.js` — junta todo lo anterior en la ficha completa; separa el id de FA (para scrapear) del id de IMDb (para Stremio)
- `cache.js` — cache mínima en disco (JSON), evita repetir peticiones a FA/OMDb
- `index.js` — entrypoint: `addonBuilder` + `serveHTTP`, catálogo y ficha con `idPrefixes: ['tt']`
- `probe.js` — script de calibración contra la red real (ver más abajo)

## Paso 0 — calibrar antes de confiar en esto

Todo el scraping de FilmAffinity se probó contra el HTML real
**excepto la página de búsqueda** (`search.php`), cuyo selector de
resultados es best-effort sin confirmar en vivo. Con `OMDB_API_KEY`
configurada:

```
node probe.js                  # Top + ficha completa de la 1ª película, con id de IMDb
node probe.js "algún título"   # buscador
```

Si el Top sale vacío, primero descarta que sea la clave de OMDb (el
propio script te avisa si falta). Si sale vacío incluso con la clave
puesta, revisa `chunkByFilmId`/`parseRankingEntry` en `catalog.js`.

## Aviso sobre los extractos de reseñas

La propia página de críticas profesionales de FilmAffinity indica que
los derechos de esas críticas son de los medios/críticos originales.
Por diseño, este código nunca amplía el extracto que FA ya recorta
(profesionales), trunca a ~260 caracteres las de usuario (que en
origen vienen completas), y siempre añade el enlace a la fuente.

Para uso personal el riesgo práctico es bajo; si en algún momento
distribuyes el addon más ampliamente, merece la pena revisar los
términos de uso de FA primero.
