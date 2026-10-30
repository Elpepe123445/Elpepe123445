# docu-video — generador de videos educativos animados (Remotion)

Videos de divulgación tipo documental hechos 100 % con código: React + TypeScript + Remotion para la
imagen, Piper (TTS local) para la voz y numpy para la música y los efectos. No usa servicios de pago.

Primer video: **«La sombra que midió el mundo»** (Eratóstenes) — guion, storyboard y fuentes en
[`content/eratostenes/GUION.md`](content/eratostenes/GUION.md).

## Requisitos

- Node 22+, FFmpeg.
- Python 3.10+ con `pip install piper-tts faster-whisper numpy` (en un venv).

## Flujo

```bash
npm i
PYTHON=/ruta/al/venv/bin/python npm run audio   # voz → alineación → plan de tiempos → música
npx remotion studio                             # previsualizar (escenas sueltas en "Eratostenes-Escenas")
npm run render                                  # out/eratostenes.mp4 (1920×1080, 30 fps, H.264 + AAC)
$PYTHON scripts/qa.py eratostenes out/eratostenes.mp4   # control de calidad + out/eratostenes.srt
```

`npm run audio` encadena:

| Paso | Script | Produce |
|------|--------|---------|
| Voz | `scripts/tts.py` | `public/<video>/voice/<línea>.wav` + `voice-timings.json` |
| Alineación | `scripts/align.py` | `voice-words.json` (instante de cada palabra, con faster-whisper) |
| Plan | `scripts/plan.py` | `plan.json`: fotograma exacto de cada escena y frase (fuente única de sincronía) |
| Música | `scripts/music.py` | `public/<video>/music.wav` + `sfx/*.wav` (sintetizados, acordes según las escenas) |

Para renderizar sin subtítulos integrados: `npx remotion render Eratostenes out/sin-subs.mp4 --props='{"subtitles":false}'`.

## Estructura

```
content/<video>/script.json   guion: escenas, frases, pausas, texto hablado ("say"), léxico de pronunciación
content/<video>/GUION.md      enfoque, storyboard, hechos verificados y fuentes
src/engine/                   plan y marcas de tiempo (useCues), tema visual
src/components/               piezas reutilizables (ver abajo)
src/videos/<video>/           escenas, datos (data.ts), composición principal (Video.tsx)
scripts/                      tts, alineación, plan, música, QA
```

**Componentes reutilizables:** `Globe3D` (Three.js, textura de Natural Earth, marcadores, anillos),
`GeoMap` (mapas históricos con d3-geo y cámara por viewBox), `BarChart` (gráfico estadístico animado),
`Diagram` (trazos que se dibujan, ángulos, gnomon, sol), `KineticText`, `Counter`, `ChapterTag`,
`Subtitles`, `Starfield`/`Dust`/`FilmLook`/`CameraRig` (atmósfera y cámara), transiciones propias
`blurDissolve` y `lightFlash`, y `Narration`/`MusicBed` (con ducking)/`SfxTrack`.

## Sincronía

Las escenas no usan tiempos fijos: piden marcas a la narración.

```tsx
const c = useCues();
c.start("geo-2");                 // fotograma en que empieza la frase
c.word("hook-5", "sombra");       // fotograma en que la voz dice «sombra»
```

Si cambias el guion o la voz, `npm run audio` recalcula todo y las animaciones se mueven solas.

## Crear un video nuevo

1. Copia `content/eratostenes/` → `content/<nuevo>/` y escribe `script.json` (ids de escena y de frase).
2. Crea `src/videos/<nuevo>/` con sus escenas (reutilizando `src/components`) y regístralo en `src/Root.tsx`.
3. Ajusta la partitura (`SCORE` en `scripts/music.py`) a los ids de las escenas.
4. `VIDEO=<nuevo> npm run audio` y `VIDEO=<Nuevo> npm run render`.

## Notas técnicas

- El contenedor no tiene GPU: `remotion.config.ts` usa `swangle` (WebGL por software) para Three.js.
- Las fuentes (Cinzel, Inter; licencia OFL) están en `public/fonts` para no depender de la red.
- La voz `es_MX-claude-high` pronuncia mal el hiato «-ía» (día → «dila») y la palabra «griego»; `voice.lexicon` en
  `script.json` reescribe «ía» → «íia» solo para la síntesis, y el guion evita «griego». Comprueba cada voz nueva
  transcribiendo sus clips con faster-whisper **sin** pista del guion.
- El audio generado (`public/*/voice`, `music.wav`, `sfx`) no se versiona: se regenera con `npm run audio`.
