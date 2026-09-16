# Enriquecimiento de FilmAffinity para tu addon de Stremio

Añade a la `description` y a `links` del meta object 2 extractos de
crítica profesional + 2 de usuario, con enlace a la reseña completa.

## Instalación

```
npm install cheerio node-fetch@2
```

(sin más dependencias — la similitud de títulos usa una función propia
en `similarity.js`, sin librerías externas ni deprecadas)

## Paso 0 — calibrar antes de confiar en esto

Dos partes del scraper **no las he podido verificar contra el HTML real**
porque mi entorno no tiene salida de red hacia filmaffinity.com:

1. El selector de resultados del buscador (`resolve.js`)
2. El troceado de bloques de reseña de usuario (`reviews.js`)

Todo lo demás sí está confirmado en vivo (la tabla de críticas
profesionales, las URLs, el hecho de que las reseñas de usuario vienen
completas y no recortadas). Antes de usar esto en producción, corre:

```
node scripts/probe.js "Título de una película que sepas que tiene críticas" 2020
```

Si algo sale a 0, el propio script te dice qué archivo y qué parte
revisar. Es un ajuste de 5-10 minutos con las devtools abiertas sobre
una ficha real, no un rediseño.

## Integración con tu `defineMetaHandler`

```js
const { enrichMetaWithFilmAffinity } = require('./src/filmaffinity');

builder.defineMetaHandler(async ({ type, id }) => {
  const item = await getYourCatalogItem(id); // lo que ya tienes
  let meta = buildYourBaseMeta(item);         // lo que ya tienes

  meta = await enrichMetaWithFilmAffinity(meta, {
    title: item.title,
    year: item.year,
  });

  return { meta };
});
```

Nunca lanza excepción hacia afuera: si el matching falla o FA cambia
el HTML, `meta` vuelve tal cual, sin la sección de FilmAffinity.

## Mejor uso: en tu indexado por lotes, no en caliente

Como ya comentamos, lo ideal es llamar a `enrichMetaWithFilmAffinity`
(o directamente a `resolveFilmAffinityId` + `getProfessionalReviews` +
`getUserReviews`) en el mismo proceso donde indexas los foros, y
guardar el resultado junto al resto del registro. Así el
`defineMetaHandler` de arriba solo necesita leer de tu base de datos,
no golpear FA en cada apertura de ficha. La cache en disco
(`cache.js`) ya evita el peor caso, pero un precómputo es más rápido
y más respetuoso con FA.

## Aviso sobre los extractos

La propia página de críticas profesionales de FilmAffinity indica que
los derechos de esas críticas son de los medios/críticos originales.
Por diseño, este código:

- nunca amplía el extracto que FA ya recorta (profesionales),
- trunca a ~260 caracteres las de usuario (que en origen vienen
  completas, no recortadas),
- siempre añade el enlace a la fuente en `links`.

Para uso personal el riesgo práctico es bajo; si en algún momento
distribuyes el addon más ampliamente, merece la pena revisar los
términos de uso de FA primero.
