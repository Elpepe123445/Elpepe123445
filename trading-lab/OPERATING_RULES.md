# Reglas de operación autónoma (delegadas por el usuario el 2026-11-15)

El usuario autoriza al agente a ejecutar cada día, **sin pedir confirmación**, la rutina del laboratorio:
verificar el entorno paper, actualizar fuentes, estudiar el mercado, evaluar predicciones, operar según las
estrategias y los límites de riesgo, mejorar parámetros mediante el proceso controlado, registrar todo y publicar el diario.

## Rutina diaria (lunes a viernes, tras el cierre, ~16:25 hora de Nueva York)
1. `git pull` de la rama `claude/festive-galileo-52tmju` si el contenedor es nuevo.
2. `python -m trading_lab tick` (paper, noticias, SEC, Fed, FRED, informe, predicciones, evaluación).
3. Estudio adicional en Internet con WebSearch para lo importante del día (resultados, decisiones de bancos centrales,
   eventos regulatorios o geopolíticos relevantes). Contrastar con fuentes oficiales; distinguir hecho, opinión y rumor.
   Anotar hallazgos relevantes en el informe del día. No usar información privada, filtrada ni de fuentes dudosas.
4. Revisar posiciones (stop-loss, cercanía a límites), errores, alertas de fuentes y rendimiento de predicciones.
5. Commit y push del diario a la rama. Resumen breve al usuario en español, con conclusiones honestas.

## Rutina semanal (sábado)
`python -m trading_lab tick` ejecuta el aprendizaje walk-forward. Revisar `versions` y los resultados.

## Qué puede hacer el agente por su cuenta
- Operar en paper con las estrategias, dentro de los límites de `config.json` → `risk`.
- Ajustar parámetros SOLO por el proceso controlado: walk-forward → fase shadow → promoción (auto_promote=true tras
  cumplir los criterios de `intel/learning.py`). Todas las versiones se conservan; `revert <estrategia>` deshace.
- Añadir activos a la lista de seguimiento (`intel.watchlist`) y mejorar el análisis, con tests y sin tocar protecciones.
- Corregir fallos del propio laboratorio y reconstruir el estado desde `journal/`.

## Lo que NO puede hacer (aunque no haya nadie para pararlo)
- Operar fuera de Alpaca Paper Trading, usar cuentas o claves reales, o añadir una opción para ello.
- Apalancamiento, posiciones cortas, opciones o derivados.
- Subir o relajar los límites de riesgo, el stop-loss, los frenos diarios o de drawdown, ni modificar `safety.py`,
  `risk.py` o la sección `risk` de `config.json`. Si cree que deben cambiar, lo propone al usuario y espera.
- Enviar órdenes basadas directamente en una noticia o en un sentimiento. Las noticias solo pueden VETAR entradas.
- Hacer operaciones discrecionales fuera de las señales de las estrategias.
- Aumentar el riesgo para recuperar pérdidas. Operar por obligación: si no hay señal justificada, se espera.
- Gastar dinero, contratar servicios de pago o publicar nada fuera del repositorio sin autorización del usuario.
- Dar por buena una estrategia por una buena semana ni afirmar rentabilidad futura por una simulación.

## Honestidad
Informar siempre de fallos, días sin ejecutar, datos que faltan y resultados malos, igual que de los buenos.
