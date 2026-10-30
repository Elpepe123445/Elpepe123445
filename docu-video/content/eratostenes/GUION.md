# La sombra que midió el mundo — guion y storyboard

**Duración objetivo:** unos 4 min · **Formato:** 1920×1080, 30 fps, MP4 · **Voz:** Piper `es_MX-claude-high` (offline)

La narración exacta (texto en pantalla + texto hablado) vive en `script.json`; este documento describe
el enfoque narrativo, qué se ve en cada escena y las fuentes. Los tiempos reales salen de la voz generada.

## Enfoque narrativo

Un misterio de detectives con una sola pista (una sombra que no aparece en Siena) y una herramienta
(la geometría). El espectador resuelve el problema junto con Eratóstenes. El giro final: el número exacto
es incierto porque no sabemos cuánto medía un estadio, pero el método era impecable, y su
legado llega hasta el metro que usamos hoy.

**Paleta:** noche azul profunda `#070B14` (ciencia/espacio) · oro solar `#F4B740` (luz, ángulos,
Eratóstenes) · cian `#4FD1E8` (datos modernos) · papiro `#EAD9B8` (texto) · terracota `#C2562F` (mundo antiguo).
**Tipografía:** Cinzel (títulos, inscripciones clásicas) + Inter (datos, subtítulos).

## Storyboard

| # | Escena | Narración (resumen) | Qué se ve | Técnica |
|---|--------|--------------------|-----------|---------|
| 1 | **Hook** | ¿Cuánto mide la Tierra? Hoy lo miden satélites… hace 2.200 años, sin salir de Egipto. Una vara, una sombra y una idea. | Globo 3D en el espacio con terminador día/noche y atmósfera; satélites en órbita; anillo que mide el ecuador; contador de año 2026 → 240 a. C.; la cámara gira hacia Egipto y aparece un marcador; iconos vara/sombra/idea dibujándose. Título "La sombra que midió el mundo". | Three.js (`@remotion/three`), textura generada con Natural Earth, campo de estrellas en Canvas, texto cinético |
| 2 | **Alejandría** | Siglo III a. C., el faro, la biblioteca. Eratóstenes de Cirene, matemático, astrónomo, poeta, geógrafo. Apodo «Beta». | Ilustración vectorial al atardecer con parallax de 4 capas: mar con reflejos, faro con haz giratorio, biblioteca con columnas, palmeras, aves, polvo en suspensión. Silueta de Eratóstenes con su vara. Rótulos con líneas guía; letra β dibujándose. | SVG por capas, partículas deterministas |
| 3 | **I · La pista** (mapa) | Siena, cerca de la actual Asuán. Mediodía del solsticio: el Sol justo encima. | Mapa real del Mediterráneo oriental y Egipto (Natural Earth 50m); la cámara se acerca; el Nilo se dibuja hacia el sur; marcadores de Alejandría y Siena; trópico de Cáncer; Sol que baja sobre Siena. | `d3-geo` + SVG, `stroke-dashoffset` |
| 4 | **Sombras** | En Siena no hay sombra y la luz llega al fondo de los pozos. En Alejandría, sí. ¿Por qué? | Pantalla dividida: vara sin sombra + pozo iluminado en corte transversal / vara con sombra creciente. Pregunta en tipografía cinética y silencio. | SVG, geometría de sombras |
| 5 | **II · La luz** | Rayos paralelos. Tierra plana → sombras iguales. Tierra curva → sombras distintas. Los griegos ya sabían que era esfera: él quería medirla. | Sol lejano con rayos fluyendo; escala Sol–Tierra (~150 millones de km); el suelo se curva de plano a arco en una transformación continua y las sombras se recalculan. | Diagrama científico SVG parametrizado |
| 6 | **III · El ángulo** | 1/50 de círculo = 7,2°. El centro de la Tierra. Las varas prolongadas forman el mismo ángulo. Paralelas cortadas por una recta. | Zoom a la vara de Alejandría: arco del ángulo + gráfico circular 1/50; la cámara se aleja hasta mostrar la Tierra entera en corte; radios hasta el centro; ángulos alternos resaltados. Ángulo real de 7,2° (varas no a escala). | SVG con cámara, `vector-effect` |
| 7 | **IV · La medida** | El arco es 1/50 de la vuelta. 5.000 estadios. 5.000 × 50 = 250.000 estadios. | El sector se replica 50 veces alrededor del círculo con contador; el arco se estira hasta formar un camino con pasos; ecuación cinética; cifra final con impacto. | SVG, contadores, `spring` |
| 8 | **V · ¿Acertó?** | No sabemos cuánto medía el estadio. ~157 m → ~39.400 km vs 40.000 actuales (<2 %). Si era más largo, ~16 %. Siena no estaba justo al sur. | Regla que oscila entre 155 y 185 m (incertidumbre); gráfico de barras animado con 3 barras y medallas de error; mini-mapa con el desfase de longitud de Siena. | Gráfico estadístico reutilizable |
| 9 | **VI · El legado** | Colón confió en una Tierra más pequeña. En 1791 el metro se definió como 1/10.000.000 de polo a ecuador → 40.000 km. | Mapa mundial: la ruta que Colón esperaba frente a la distancia real, con América en medio; cuarto de meridiano polo–ecuador = 10.000 km × 4. | `d3-geo` mundial + diagrama |
| 10 | **Cierre** | Nunca vio la Tierra desde el espacio. No le hizo falta. Una sombra. La próxima vez que veas la tuya… | El globo 3D se aleja; vara en la arena con la sombra girando (time-lapse); la sombra traza un círculo que se convierte en la Tierra; título final. | Three.js + SVG |

**Sonido:** base ambiental sintetizada por código (pads graves en re menor con color frigio, arpa
pulsada estilo Karplus-Strong, brillos agudos, pulso grave en los momentos de tensión, resolución a re
mayor en la cifra final y en el cierre). La música baja de volumen bajo la voz. Efectos sintetizados:
whoosh en las transiciones, impacto grave en las revelaciones, ticks en los contadores y brillo en los descubrimientos.

## Hechos verificados y matices incluidos

- El relato principal del método procede de **Cleomedes** (*Caelestia*, probablemente siglo I d. C.); la obra
  original de Eratóstenes, *Sobre la medida de la Tierra*, se perdió.
- Ángulo en Alejandría: **1/50 de círculo** (≈ 7,2°). Los grados son una conversión moderna; por eso el guion dice "lo que hoy llamamos 7,2 grados".
- Distancia Alejandría–Siena: **≈ 5.000 estadios**, según las fuentes antiguas, probablemente obtenida de medidores de pasos (bematistas); el guion no lo afirma como certeza.
- Resultado: **250.000 estadios** (Cleomedes). Otras fuentes antiguas (Estrabón, Plinio) dan 252.000, quizá un ajuste posterior. El video usa la cifra de Cleomedes, la que corresponde al cálculo explicado.
- Longitud del estadio: **incierta (≈ 155–185 m)**. Con 157,5 m → 39.375 km (−1,6 % frente a 40.008 km de polo a polo); con 185 m → 46.250 km (+15,6 %).
- Siena (Asuán, ~24,1° N) está algo al norte del trópico y ~3° al este del meridiano de Alejandría (~29,9° E): son fuentes de error reconocidas.
- La esfericidad de la Tierra ya era conocida por los griegos (p. ej., Aristóteles, s. IV a. C.); el video evita el mito de que Eratóstenes "descubrió" que la Tierra era redonda.
- El apodo «Beta» procede de una tradición antigua (recogida en la *Suda*); se presenta como tal.
- Colón trabajó con estimaciones de una Tierra más pequeña que la de Eratóstenes y subestimó la distancia a Asia; el atribuir la cifra a Posidonio o a Ptolomeo varía según el autor, así que el video no lo concreta.
- En 1791 la Academia de Ciencias de Francia definió el metro como **la diezmillonésima parte de la distancia entre el polo norte y el ecuador** (por el meridiano de París); de ahí que el meridiano completo mida ≈ 40.000 km (40.008 km, elipsoide WGS 84).
- Distancia media Tierra–Sol: ≈ 149,6 millones de km (1 unidad astronómica).

## Fuentes

- Cleomedes, *Caelestia* I.7 (trad. Bowen & Todd, *Cleomedes' Lectures on Astronomy*, University of California Press, 2004).
- MacTutor History of Mathematics (Univ. of St Andrews), "Eratosthenes of Cyrene": https://mathshistory.st-andrews.ac.uk/Biographies/Eratosthenes/
- APS News, "June, ca. 240 B.C.: Eratosthenes Measures the Earth" (2006): https://www.aps.org/apsnews/2006/06/eratosthenes-measures-earth
- Dutka, J. (1993). "Eratosthenes' measurement of the Earth reconsidered". *Archive for History of Exact Sciences*, 46(1), 55–66.
- "How Did Eratosthenes Come So Close?", American Federation of Teachers: https://www.aft.org/node/7489
- Observatoire de Paris, *Dictionnaire d'astronomie*, "Eratosthenes' method": https://dictionary.obspm.fr/terms/eratosthenes-method/
- "History of the metre" (resumen con referencias primarias): https://en.wikipedia.org/wiki/History_of_the_metre
- RISE (instituto nacional de metrología de Suecia), "How a metre became a metre": https://www.ri.se/en/story/how-a-metre-became-a-metre
- NGA / WGS 84 (circunferencia meridiana ≈ 40.007,86 km).
- Natural Earth (datos cartográficos de dominio público), vía el paquete `world-atlas`.
