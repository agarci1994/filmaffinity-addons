# Addon de Stremio: FilmAffinity

Addon de Stremio centrado enteramente en FilmAffinity: catálogo con el
Top de películas mejor valoradas (con buscador), y en cada ficha, la
sinopsis y el póster reales más 2 extractos de crítica profesional y 2
de usuarios, cada uno con enlace a la reseña completa.

No depende de ningún otro catálogo ni indexado externo — todos los
datos (título, año, póster, sinopsis, nota, director, reparto,
críticas) vienen de FilmAffinity.

## Instalación y arranque

```
npm install
npm start
```

Esto expone `http://localhost:7000/manifest.json`, instalable en
Stremio (Addons → pegar la URL del manifest).

## Estructura

- `http.js` — cliente HTTP compartido (User-Agent identificable, base URL)
- `catalog.js` — Top de FilmAffinity (`ranking.php?rn=ranking_fa_movies`) y buscador (`search.php`)
- `movie.js` — título/póster/sinopsis de una película vía etiquetas Open Graph
- `reviews.js` — 2 extractos de crítica profesional + 2 de usuario por película
- `format-meta.js` — construye el bloque de reseñas para `description`/`links`
- `filmaffinity.js` — junta todo lo anterior en la ficha (meta object) completa de una película
- `cache.js` — cache mínima en disco (JSON), evita repetir peticiones a FA
- `index.js` — entrypoint: `addonBuilder` + `serveHTTP`, catálogo y ficha
- `probe.js` — script de calibración contra la red real (ver más abajo)

## Paso 0 — calibrar antes de confiar en esto

Todo el scraping se probó hoy contra el HTML real de FilmAffinity
**excepto la página de búsqueda** (`search.php`), cuyo selector de
resultados es best-effort sin confirmar en vivo. Antes de depender de
esto en producción:

```
node probe.js                  # prueba el Top + la ficha completa de la 1ª película
node probe.js "algún título"   # prueba el buscador
```

Si el Top sale vacío o sin director/reparto, revisa
`chunkByFilmId`/`parseRankingEntry` en `catalog.js`. Si el buscador
sale vacío, revisa el selector en `searchMovies` (mismo fichero).

**Aviso:** desde el entorno donde se escribió este código, FilmAffinity
devuelve 403 en todas las peticiones (probablemente bloquea el rango
de IPs de ese entorno) — no es un fallo de la lógica, es un bloqueo de
red específico de ese entorno. Pruébalo desde tu máquina o desde donde
despliegues.

## Cómo se construye el catálogo

`getTopMovies()` scrapea la lista del Top (título, año, nota, director,
reparto), y busca el póster de cada película en paralelo (concurrencia
de 5, no 30 peticiones de golpe) porque la vista de lista no lo trae.
Todo el resultado se cachea 3 días, y cada película por separado otros
7 días (`hint:<id>`) para que `defineMetaHandler` no tenga que volver a
sacar nota/director/reparto al abrir la ficha.

## Aviso sobre los extractos de reseñas

La propia página de críticas profesionales de FilmAffinity indica que
los derechos de esas críticas son de los medios/críticos originales.
Por diseño, este código nunca amplía el extracto que FA ya recorta
(profesionales), trunca a ~260 caracteres las de usuario (que en
origen vienen completas), y siempre añade el enlace a la fuente.

Para uso personal el riesgo práctico es bajo; si en algún momento
distribuyes el addon más ampliamente, merece la pena revisar los
términos de uso de FA primero.
