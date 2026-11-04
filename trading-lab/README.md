# AI Trading Research Lab: solo Alpaca Paper Trading

Laboratorio para investigar estrategias de trading algorítmico con **dinero ficticio**.
No existe ningún modo de operar con dinero real.

## Garantías de seguridad (aplicadas en el código y cubiertas por tests)

- La URL de trading está fijada en `safety.py` (`https://paper-api.alpaca.markets`) y no es configurable.
- Si `APCA_API_BASE_URL` apunta a otro sitio, el cliente se niega a arrancar.
- Antes de cada ciclo se verifica la cuenta. El número de cuenta debe empezar por `PA`, el estado debe ser `ACTIVE` y el trading no puede estar bloqueado. Sin esa verificación, `submit_order` lanza un error.
- `config.json` rechaza claves como `live`, `base_url` o `endpoint`, y no se carga si faltan los límites de riesgo.
- Sin apalancamiento: el tamaño de las órdenes se calcula con el **efectivo**, nunca con el buying power con margen, y exposición + reserva ≤ 100 %.
- Sin cortos: solo se vende la cantidad que se posee.
- Las órdenes llevan un `client_order_id` determinista (`lab-<estrategia>-<símbolo>-<fecha-señal>-<lado>`). Además se comprueban las órdenes pendientes, el registro local y la API, así que no puede haber duplicados.
- Las claves solo se leen de `ALPACA_API_KEY` / `ALPACA_SECRET_KEY`. Un filtro las borra de los logs y el cliente no las muestra en su `repr`.

## Arquitectura

| Módulo | Función |
|---|---|
| `safety.py` | Protecciones para operar solo en paper y redacción de secretos en los logs |
| `alpaca_client.py` | Cliente REST con reintentos y backoff ante desconexiones o errores 429/5xx |
| `data.py` | Barras diarias históricas (feed IEX, ajustadas), caché CSV y validación de calidad |
| `indicators.py` | SMA, EMA, RSI, MACD, volatilidad, ATR, volumen relativo, tendencia y cambios de tendencia (todos causales) |
| `strategies.py` | 5 estrategias con hipótesis documentadas y evaluación diagnóstica de señales |
| `backtest.py` | Motor de backtest, métricas, buy & hold, optimización en train y validación en test, avisos de sobreajuste |
| `evaluation.py` | Rendimiento diario y semanal, análisis de operaciones perdedoras, ranking y agregados por estrategia y activo |
| `risk.py` | Límites de posición y exposición, reserva de efectivo, pérdida diaria, drawdown y órdenes/día |
| `paper_trader.py` | Ciclo datos → señal → riesgo → orden paper → registro |
| `storage.py` | SQLite con decisiones, órdenes, errores y snapshots de equity |
| `dashboard/` | Servidor HTTP de solo lectura con interfaz web que se actualiza cada 30 s |

## Metodología del backtest

- La señal se calcula al **cierre** de t y se ejecuta en la **apertura** de t+1. Esto evita el look-ahead bias y hay un test que lo comprueba para cada estrategia.
- Costes: slippage de 5 pb por lado y comisión configurable (Alpaca no cobra comisión en acciones; por defecto 0 $).
- Los datos se dividen en 60 % train y 40 % test por fecha. Los parámetros se eligen **solo** en train y se evalúan una vez en test.
- El ranking se ordena por Sharpe **fuera de muestra**. Cada estrategia se compara con comprar y mantener el mismo activo.
- Avisos automáticos: menos de 30 operaciones, test de menos de un año, degradación entre train y test, demasiadas combinaciones probadas y sensibilidad a los parámetros.
- Sharpe: retornos diarios, rf = 0, anualizado con √252. Supone retornos aproximadamente i.i.d.

## Uso

```bash
cd trading-lab
pip install -r requirements.txt
export ALPACA_API_KEY=...      # claves de la cuenta PAPER (no las pegues en ningún chat)
export ALPACA_SECRET_KEY=...

python -m trading_lab verify                  # comprueba la conexión y que la cuenta es paper
python -m trading_lab backtest                # investigación completa → reports/backtest_latest.json
python -m trading_lab paper                   # un ciclo de paper trading
python -m trading_lab paper --loop --interval 900   # ciclo continuo cada 15 min
python -m trading_lab dashboard               # http://127.0.0.1:8050
python -m unittest discover -s tests          # tests
```

Las estrategias, los activos, los límites de riesgo y las rejillas de parámetros se configuran en `config.json`.
Cada símbolo se asigna a una sola estrategia para que las posiciones de distintas estrategias no se mezclen en la misma cuenta.

## Limitaciones conocidas

- Los datos IEX gratuitos empiezan a finales de 2018 y el volumen solo cubre IEX, no el mercado consolidado. Las primeras barras tienen muy poco volumen.
- Señales diarias: lo más coherente con el backtest es ejecutar el ciclo después del cierre. Las órdenes market `day` se ejecutan en la apertura siguiente.
- El estado de las órdenes en SQLite no se sincroniza tras la ejecución. El dashboard muestra el estado real consultando directamente a Alpaca.
- El simulador de Alpaca no modela impacto de mercado, dividendos ni la posición en la cola de órdenes.
- Una sola división train/test. Con un único período de test, los resultados dependen mucho del régimen de mercado de ese período.
