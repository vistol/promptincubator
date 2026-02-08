// ─── Built-in Strategy Library ───────────────────────────────────
// 18 estrategias curadas de libros reales de trading.
// Cada una en formato PASOS (espanol) con provenance completo.
// Sin dependencia de API — siempre disponibles.

export const LIBRARY_CATEGORIES = [
  { id: 'classic-ta', name: 'Analisis Tecnico Clasico', icon: 'TrendingUp' },
  { id: 'momentum', name: 'Momentum', icon: 'Zap' },
  { id: 'mean-reversion', name: 'Mean Reversion', icon: 'RefreshCw' },
  { id: 'breakout', name: 'Breakout', icon: 'ArrowUpRight' },
  { id: 'volume', name: 'Volumen', icon: 'BarChart3' }
]

export const STRATEGY_LIBRARY = [

  // ═══════════════════════════════════════════════════════════════
  // CATEGORIA 1: ANALISIS TECNICO CLASICO
  // ═══════════════════════════════════════════════════════════════

  {
    id: 'lib-golden-cross',
    name: 'Golden Cross / Death Cross',
    category: 'classic-ta',
    content: `PASO 1 — CONFIGURACION INICIAL:
Activos: cualquier par crypto con volumen diario > $50M. Temporalidad: velas de 1h. Capital por operacion: 5% del portafolio. Apalancamiento maximo: 3x.

PASO 2 — CALCULAR MEDIAS MOVILES:
Calcular SMA(50) = promedio de cierre de las ultimas 50 velas.
Calcular SMA(200) = promedio de cierre de las ultimas 200 velas.
Calcular ADX(14) para confirmar tendencia.

PASO 3 — CONDICIONES DE ENTRADA LONG:
Abrir LONG cuando:
- SMA(50) cruza POR ENCIMA de SMA(200) (Golden Cross)
- ADX(14) > 20 (confirma que hay tendencia, no rango)
- Precio actual esta por encima de ambas medias
Entrada: al cierre de la vela que confirma el cruce.

PASO 4 — CONDICIONES DE ENTRADA SHORT:
Abrir SHORT cuando:
- SMA(50) cruza POR DEBAJO de SMA(200) (Death Cross)
- ADX(14) > 20
- Precio actual esta por debajo de ambas medias
Entrada: al cierre de la vela que confirma el cruce.

PASO 5 — STOP LOSS Y TAKE PROFIT:
SL: 2% desde el precio de entrada (entry * 0.98 para LONG, entry * 1.02 para SHORT).
TP: 5% desde el precio de entrada (entry * 1.05 para LONG, entry * 0.95 para SHORT).
Ratio riesgo/beneficio: 1:2.5.

PASO 6 — FILTROS ADICIONALES:
NO operar si ADX < 20 (mercado sin tendencia).
NO operar si el spread bid-ask > 0.1%.
Maximo 1 operacion abierta por activo.`,
    status: 'active',
    capital: 1000,
    leverage: 3,
    executionTime: 'intraday',
    aiModel: 'groq',
    numResults: 3,
    minIpe: 70,
    provenance: {
      type: 'built-in-library',
      source: 'Technical Analysis of the Financial Markets — John J. Murphy (1999)',
      chapter: 'Chapter 9 — Moving Averages',
      url: 'https://www.amazon.com/dp/0735200661',
      importedAt: '2025-01-01T00:00:00Z',
      method: 'Estrategia codificada de referencia bibliografica',
      qualityScore: 85,
      notes: 'Sistema clasico de cruce de medias moviles SMA(50)/SMA(200). El mas utilizado en el mundo para identificar cambios de tendencia a medio plazo.'
    }
  },

  {
    id: 'lib-three-line-break',
    name: 'Three-Line Break Reversal',
    category: 'classic-ta',
    content: `PASO 1 — CONFIGURACION INICIAL:
Activos: BTC/USDT, ETH/USDT, SOL/USDT. Temporalidad: velas de 4h. Capital: 4% del portafolio. Apalancamiento: 3x.

PASO 2 — CONSTRUIR GRAFICO THREE-LINE BREAK:
Mantener registro de las ultimas 3 lineas (candles de cierre).
Una nueva linea blanca (alcista) se dibuja solo si el cierre actual supera el maximo de las 3 lineas anteriores.
Una nueva linea negra (bajista) se dibuja solo si el cierre actual rompe el minimo de las 3 lineas anteriores.

PASO 3 — CONDICIONES DE ENTRADA LONG:
Abrir LONG cuando:
- Aparece una nueva linea blanca despues de 3 o mas lineas negras consecutivas (reversal alcista)
- Volumen de la vela actual > promedio de volumen de 20 periodos
Entrada: al cierre de la vela de confirmacion.

PASO 4 — CONDICIONES DE ENTRADA SHORT:
Abrir SHORT cuando:
- Aparece una nueva linea negra despues de 3 o mas lineas blancas consecutivas (reversal bajista)
- Volumen de la vela actual > promedio de volumen de 20 periodos
Entrada: al cierre de la vela de confirmacion.

PASO 5 — STOP LOSS Y TAKE PROFIT:
SL: 1.5% desde entrada (entry * 0.985 para LONG).
TP: 4% desde entrada (entry * 1.04 para LONG).
Ratio R:R = 1:2.67.

PASO 6 — GESTION:
Cerrar posicion si aparece una nueva linea en direccion opuesta.
Maximo 2 operaciones abiertas simultaneas.`,
    status: 'active',
    capital: 1000,
    leverage: 3,
    executionTime: 'swing',
    aiModel: 'groq',
    numResults: 3,
    minIpe: 70,
    provenance: {
      type: 'built-in-library',
      source: 'Japanese Candlestick Charting Techniques — Steve Nison (1991)',
      chapter: 'Chapter 11 — Three-Line Break',
      url: 'https://www.amazon.com/dp/0735201811',
      importedAt: '2025-01-01T00:00:00Z',
      method: 'Estrategia codificada de referencia bibliografica',
      qualityScore: 80,
      notes: 'Tecnica japonesa de graficos de ruptura de 3 lineas para identificar reversiones. Reduce ruido del mercado.'
    }
  },

  {
    id: 'lib-hammer-hanging-man',
    name: 'Hammer / Hanging Man',
    category: 'classic-ta',
    content: `PASO 1 — CONFIGURACION INICIAL:
Activos: top 5 crypto por volumen. Temporalidad: 1h. Capital: 3% del portafolio. Apalancamiento: 5x.

PASO 2 — IDENTIFICAR PATRON HAMMER (para LONG):
Una vela es Hammer cuando:
- Cuerpo real pequeno (abs(open - close) < 30% del rango total high-low)
- Sombra inferior larga: (min(open,close) - low) >= 2 * abs(open - close)
- Sombra superior corta o inexistente: (high - max(open,close)) < 0.1 * (high - low)
- Aparece en zona de soporte (cerca de minimo de ultimas 20 velas)

PASO 3 — CONDICIONES DE ENTRADA LONG (Hammer):
Abrir LONG cuando:
- Se identifica Hammer en soporte
- La siguiente vela cierra por encima del maximo del Hammer (confirmacion)
- RSI(14) < 40 (zona de sobreventa relativa)
Entrada: al cierre de la vela de confirmacion.

PASO 4 — IDENTIFICAR HANGING MAN (para SHORT):
Misma forma que Hammer pero aparece en zona de resistencia (cerca de maximo de ultimas 20 velas).

PASO 5 — CONDICIONES DE ENTRADA SHORT (Hanging Man):
Abrir SHORT cuando:
- Se identifica Hanging Man en resistencia
- La siguiente vela cierra por debajo del minimo del Hanging Man
- RSI(14) > 60
Entrada: al cierre de la vela de confirmacion.

PASO 6 — STOP LOSS Y TAKE PROFIT:
SL: por debajo de la sombra del Hammer (o por encima para Hanging Man) + 0.3% margen.
TP: 2x la distancia del SL (R:R = 1:2).
Trailing stop: mover SL a breakeven cuando ganancia alcanza 1x SL.`,
    status: 'active',
    capital: 1000,
    leverage: 5,
    executionTime: 'intraday',
    aiModel: 'groq',
    numResults: 3,
    minIpe: 70,
    provenance: {
      type: 'built-in-library',
      source: 'Japanese Candlestick Charting Techniques — Steve Nison (1991)',
      chapter: 'Chapter 4 — Reversal Patterns',
      url: 'https://www.amazon.com/dp/0735201811',
      importedAt: '2025-01-01T00:00:00Z',
      method: 'Estrategia codificada de referencia bibliografica',
      qualityScore: 82,
      notes: 'Patrones de velas japonesas de reversion. Hammer (martillo) en soporte y Hanging Man (hombre colgado) en resistencia.'
    }
  },

  {
    id: 'lib-rsi-divergence',
    name: 'RSI Divergence con Price Action',
    category: 'classic-ta',
    content: `PASO 1 — CONFIGURACION INICIAL:
Activos: BTC/USDT, ETH/USDT, SOL/USDT, BNB/USDT, XRP/USDT. Temporalidad: 1h. Capital: 4% del portafolio. Apalancamiento: 5x.

PASO 2 — CALCULAR RSI:
RSI(14) = 100 - (100 / (1 + RS)) donde RS = promedio de ganancias 14p / promedio de perdidas 14p.
Identificar minimos y maximos locales del RSI y del precio en las ultimas 30 velas.

PASO 3 — DIVERGENCIA ALCISTA (para LONG):
Abrir LONG cuando:
- Precio hace un LOWER LOW (minimo mas bajo que el anterior)
- RSI(14) hace un HIGHER LOW (minimo mas alto que el anterior) = divergencia alcista
- RSI(14) esta por debajo de 35
- Confirmacion: la vela siguiente cierra verde (alcista)
Entrada: al cierre de la vela de confirmacion.

PASO 4 — DIVERGENCIA BAJISTA (para SHORT):
Abrir SHORT cuando:
- Precio hace un HIGHER HIGH (maximo mas alto)
- RSI(14) hace un LOWER HIGH (maximo mas bajo) = divergencia bajista
- RSI(14) esta por encima de 65
- Confirmacion: la vela siguiente cierra roja (bajista)
Entrada: al cierre de la vela de confirmacion.

PASO 5 — STOP LOSS Y TAKE PROFIT:
SL: 2% desde entrada (entry * 0.98 para LONG, entry * 1.02 para SHORT).
TP: 4.5% desde entrada (entry * 1.045 para LONG, entry * 0.955 para SHORT).
Ratio R:R = 1:2.25.

PASO 6 — FILTROS:
NO operar si volumen < 50% del promedio de 20 periodos (divergencia sin volumen no es confiable).
Esperar minimo 5 velas entre divergencia detectada y la anterior.`,
    status: 'active',
    capital: 1000,
    leverage: 5,
    executionTime: 'intraday',
    aiModel: 'groq',
    numResults: 3,
    minIpe: 70,
    provenance: {
      type: 'built-in-library',
      source: 'Technical Analysis of the Financial Markets — John J. Murphy (1999)',
      chapter: 'Chapter 10 — Oscillators and Contrary Opinion',
      url: 'https://www.amazon.com/dp/0735200661',
      importedAt: '2025-01-01T00:00:00Z',
      method: 'Estrategia codificada de referencia bibliografica',
      qualityScore: 88,
      notes: 'Divergencia entre precio y RSI como senal de agotamiento de tendencia. Una de las senales mas confiables en analisis tecnico.'
    }
  },

  {
    id: 'lib-bb-squeeze',
    name: 'Bollinger Band Squeeze Breakout',
    category: 'classic-ta',
    content: `PASO 1 — CONFIGURACION INICIAL:
Activos: top 5 crypto por capitalizacion. Temporalidad: 1h. Capital: 5% del portafolio. Apalancamiento: 3x.

PASO 2 — CALCULAR BOLLINGER BANDS:
BB_upper = SMA(20) + 2 * stdDev(20)
BB_lower = SMA(20) - 2 * stdDev(20)
BB_middle = SMA(20)
Bandwidth = (BB_upper - BB_lower) / BB_middle * 100
Bandwidth_avg = promedio de Bandwidth de los ultimos 120 periodos.

PASO 3 — DETECTAR SQUEEZE:
Squeeze activo cuando: Bandwidth actual < Bandwidth_avg (las bandas se estan comprimiendo).
Esperar a que el Squeeze dure al menos 10 velas consecutivas.

PASO 4 — CONDICIONES DE ENTRADA LONG:
Abrir LONG cuando:
- Squeeze estuvo activo (10+ velas con Bandwidth < Bandwidth_avg)
- Precio cierra POR ENCIMA de BB_upper (breakout alcista)
- Volumen > 1.5x promedio de 20 periodos
Entrada: al cierre de la vela de breakout.

PASO 5 — CONDICIONES DE ENTRADA SHORT:
Abrir SHORT cuando:
- Squeeze estuvo activo (10+ velas)
- Precio cierra POR DEBAJO de BB_lower (breakdown bajista)
- Volumen > 1.5x promedio de 20 periodos
Entrada: al cierre de la vela de breakdown.

PASO 6 — STOP LOSS Y TAKE PROFIT:
SL: BB_middle (SMA 20). Para LONG: si precio cae a SMA(20), cerrar.
TP: 1.5x el ancho de banda al momento del breakout. Ejemplo: si bandwidth era 2%, TP a 3% desde entrada.
Trailing stop: mover SL a banda media si ganancia > 1%.`,
    status: 'active',
    capital: 1000,
    leverage: 3,
    executionTime: 'intraday',
    aiModel: 'groq',
    numResults: 3,
    minIpe: 70,
    provenance: {
      type: 'built-in-library',
      source: 'Bollinger on Bollinger Bands — John Bollinger (2001)',
      chapter: 'Chapter 10 — The Squeeze',
      url: 'https://www.amazon.com/dp/0071373683',
      importedAt: '2025-01-01T00:00:00Z',
      method: 'Estrategia codificada de referencia bibliografica',
      qualityScore: 87,
      notes: 'El Squeeze de Bollinger identifica periodos de baja volatilidad que preceden movimientos explosivos. Creado por el inventor de las propias Bollinger Bands.'
    }
  },

  // ═══════════════════════════════════════════════════════════════
  // CATEGORIA 2: MOMENTUM
  // ═══════════════════════════════════════════════════════════════

  {
    id: 'lib-dual-momentum',
    name: 'Dual Momentum (Absoluto + Relativo)',
    category: 'momentum',
    content: `PASO 1 — CONFIGURACION INICIAL:
Activos: BTC/USDT, ETH/USDT, SOL/USDT, BNB/USDT, XRP/USDT. Temporalidad: 4h. Capital: 5% del portafolio. Apalancamiento: 2x.

PASO 2 — CALCULAR MOMENTUM RELATIVO:
Para cada activo calcular retorno de ultimos 12 periodos:
Retorno_12 = (precio_actual - precio_hace_12_periodos) / precio_hace_12_periodos * 100
Ordenar activos por Retorno_12 de mayor a menor.

PASO 3 — FILTRO DE MOMENTUM ABSOLUTO:
Solo considerar activos con Retorno_12 > 0 (momentum absoluto positivo).
Si ningun activo tiene retorno positivo → no operar (quedarse en cash).

PASO 4 — CONDICIONES DE ENTRADA LONG:
Abrir LONG en el activo con mayor Retorno_12 positivo (momentum relativo mas fuerte).
Solo si Retorno_12 > 0 (momentum absoluto).
Entrada: al cierre del periodo actual.

PASO 5 — CONDICIONES DE ENTRADA SHORT:
Abrir SHORT en el activo con menor Retorno_12 (mas negativo).
Solo si Retorno_12 < -5% (momentum bajista fuerte).
Entrada: al cierre del periodo actual.

PASO 6 — STOP LOSS Y TAKE PROFIT:
SL: 3% desde entrada.
TP: 6% desde entrada.
Ratio R:R = 1:2.
Rebalancear: cada 12 periodos recalcular y rotar al activo con mejor momentum.`,
    status: 'active',
    capital: 1000,
    leverage: 2,
    executionTime: 'swing',
    aiModel: 'groq',
    numResults: 3,
    minIpe: 70,
    provenance: {
      type: 'built-in-library',
      source: 'Dual Momentum Investing — Gary Antonacci (2014)',
      chapter: 'Chapter 7 — Dual Momentum',
      url: 'https://www.amazon.com/dp/0071849440',
      importedAt: '2025-01-01T00:00:00Z',
      method: 'Estrategia codificada de referencia bibliografica',
      qualityScore: 84,
      notes: 'Combina momentum absoluto (>0) y relativo (mejor del grupo). Historicamente supera buy-and-hold con menor drawdown.'
    }
  },

  {
    id: 'lib-adx-trend',
    name: 'ADX Trend Following (+DI/-DI)',
    category: 'momentum',
    content: `PASO 1 — CONFIGURACION INICIAL:
Activos: BTC/USDT, ETH/USDT, SOL/USDT. Temporalidad: 1h. Capital: 4% del portafolio. Apalancamiento: 5x.

PASO 2 — CALCULAR INDICADORES:
ADX(14): indice de fuerza de tendencia (0-100).
+DI(14): indice direccional positivo.
-DI(14): indice direccional negativo.
ATR(14): rango verdadero promedio para sizing de SL/TP.

PASO 3 — CONDICIONES DE ENTRADA LONG:
Abrir LONG cuando:
- ADX(14) > 25 (tendencia fuerte confirmada)
- +DI(14) > -DI(14) (direccion alcista)
- +DI cruzo por encima de -DI en las ultimas 3 velas
Entrada: al cierre de la vela de confirmacion.

PASO 4 — CONDICIONES DE ENTRADA SHORT:
Abrir SHORT cuando:
- ADX(14) > 25 (tendencia fuerte confirmada)
- -DI(14) > +DI(14) (direccion bajista)
- -DI cruzo por encima de +DI en las ultimas 3 velas
Entrada: al cierre de la vela de confirmacion.

PASO 5 — STOP LOSS Y TAKE PROFIT:
SL: 1.5 * ATR(14) desde el precio de entrada.
TP: 3 * ATR(14) desde el precio de entrada.
Ratio R:R = 1:2.

PASO 6 — SALIDA ANTICIPADA:
Cerrar si ADX cae por debajo de 20 (tendencia se debilita).
Cerrar si +DI y -DI se cruzan en contra de la posicion.`,
    status: 'active',
    capital: 1000,
    leverage: 5,
    executionTime: 'intraday',
    aiModel: 'groq',
    numResults: 3,
    minIpe: 70,
    provenance: {
      type: 'built-in-library',
      source: 'New Concepts in Technical Trading Systems — J. Welles Wilder Jr. (1978)',
      chapter: 'Chapter 3 — Average Directional Movement Index',
      url: 'https://www.amazon.com/dp/0894590278',
      importedAt: '2025-01-01T00:00:00Z',
      method: 'Estrategia codificada de referencia bibliografica',
      qualityScore: 86,
      notes: 'Wilder invento el ADX, RSI y ATR. El ADX mide fuerza de tendencia sin importar direccion. +DI/-DI dan la direccion.'
    }
  },

  {
    id: 'lib-ema-ribbon',
    name: 'EMA Ribbon (10/20/30/50)',
    category: 'momentum',
    content: `PASO 1 — CONFIGURACION INICIAL:
Activos: BTC/USDT, ETH/USDT, SOL/USDT, BNB/USDT. Temporalidad: 1h. Capital: 5% del portafolio. Apalancamiento: 3x.

PASO 2 — CALCULAR EMA RIBBON:
EMA(10) = media exponencial de 10 periodos.
EMA(20) = media exponencial de 20 periodos.
EMA(30) = media exponencial de 30 periodos.
EMA(50) = media exponencial de 50 periodos.

PASO 3 — CONDICIONES DE ENTRADA LONG:
Abrir LONG cuando TODAS las EMAs estan alineadas alcistas:
- EMA(10) > EMA(20) > EMA(30) > EMA(50)
- Precio actual esta POR ENCIMA de EMA(10)
- La separacion entre EMA(10) y EMA(50) esta AUMENTANDO (ribbon expandiendose)
Entrada: al cierre de la vela que confirma alineacion completa.

PASO 4 — CONDICIONES DE ENTRADA SHORT:
Abrir SHORT cuando TODAS las EMAs estan alineadas bajistas:
- EMA(10) < EMA(20) < EMA(30) < EMA(50)
- Precio actual esta POR DEBAJO de EMA(10)
- La separacion esta aumentando (ribbon expandiendose a la baja)
Entrada: al cierre de la vela de confirmacion.

PASO 5 — STOP LOSS Y TAKE PROFIT:
SL: por debajo de EMA(30) para LONG, por encima de EMA(30) para SHORT.
En numeros: ~1.5% tipicamente.
TP: 2x la distancia del SL (R:R = 1:2).

PASO 6 — SALIDA ANTICIPADA:
Cerrar si EMA(10) cruza por debajo de EMA(20) (para LONG).
Cerrar si EMA(10) cruza por encima de EMA(20) (para SHORT).
Indica que el momentum se esta debilitando.`,
    status: 'active',
    capital: 1000,
    leverage: 3,
    executionTime: 'intraday',
    aiModel: 'groq',
    numResults: 3,
    minIpe: 70,
    provenance: {
      type: 'built-in-library',
      source: 'Stocks on the Move — Andreas Clenow (2015)',
      chapter: 'Chapter 8 — The Trend Model',
      url: 'https://www.amazon.com/dp/1511466685',
      importedAt: '2025-01-01T00:00:00Z',
      method: 'Estrategia codificada de referencia bibliografica',
      qualityScore: 83,
      notes: 'El ribbon de EMAs muestra el momentum en multiples timeframes. La expansion indica fortaleza, la compresion indica debilitamiento.'
    }
  },

  {
    id: 'lib-roc-momentum',
    name: 'Rate of Change Momentum (ROC)',
    category: 'momentum',
    content: `PASO 1 — CONFIGURACION INICIAL:
Activos: BTC/USDT, ETH/USDT, SOL/USDT, BNB/USDT, XRP/USDT. Temporalidad: 4h. Capital: 4% del portafolio. Apalancamiento: 3x.

PASO 2 — CALCULAR ROC:
ROC(12) = ((precio_actual - precio_hace_12) / precio_hace_12) * 100
ROC(26) = ((precio_actual - precio_hace_26) / precio_hace_26) * 100
Calcular tendencia de cada ROC: ROC_trend = ROC actual > ROC de hace 3 periodos.

PASO 3 — CONDICIONES DE ENTRADA LONG:
Abrir LONG cuando:
- ROC(12) > 0 Y ROC(26) > 0 (ambos positivos)
- ROC(12) > ROC(26) (momentum corto > largo = aceleracion)
- Ambos ROC tienen tendencia ascendente (ROC_trend = true)
Entrada: al cierre del periodo actual.

PASO 4 — CONDICIONES DE ENTRADA SHORT:
Abrir SHORT cuando:
- ROC(12) < 0 Y ROC(26) < 0 (ambos negativos)
- ROC(12) < ROC(26) (momentum corto mas negativo = aceleracion bajista)
- Ambos ROC tienen tendencia descendente
Entrada: al cierre del periodo actual.

PASO 5 — STOP LOSS Y TAKE PROFIT:
SL: 2% desde entrada.
TP: 5% desde entrada.
Ratio R:R = 1:2.5.

PASO 6 — SALIDA ANTICIPADA:
Cerrar LONG si ROC(12) cruza por debajo de 0.
Cerrar SHORT si ROC(12) cruza por encima de 0.
Recalcular en cada periodo.`,
    status: 'active',
    capital: 1000,
    leverage: 3,
    executionTime: 'swing',
    aiModel: 'groq',
    numResults: 3,
    minIpe: 70,
    provenance: {
      type: 'built-in-library',
      source: 'Technical Analysis Explained — Martin Pring (2014, 5th ed.)',
      chapter: 'Chapter 11 — Rate of Change',
      url: 'https://www.amazon.com/dp/0071825177',
      importedAt: '2025-01-01T00:00:00Z',
      method: 'Estrategia codificada de referencia bibliografica',
      qualityScore: 81,
      notes: 'ROC doble (corto y largo plazo) identifica aceleracion del momentum. Cuando ambos son positivos y acelerando, la tendencia es muy fuerte.'
    }
  },

  // ═══════════════════════════════════════════════════════════════
  // CATEGORIA 3: MEAN REVERSION
  // ═══════════════════════════════════════════════════════════════

  {
    id: 'lib-connors-rsi2',
    name: 'Connors RSI(2) Mean Reversion',
    category: 'mean-reversion',
    content: `PASO 1 — CONFIGURACION INICIAL:
Activos: BTC/USDT, ETH/USDT. Temporalidad: 1h. Capital: 5% del portafolio. Apalancamiento: 3x.

PASO 2 — CALCULAR INDICADORES:
RSI(2) = RSI de 2 periodos (ultra-sensible a movimientos recientes).
SMA(200) = media simple de 200 periodos (filtro de tendencia macro).

PASO 3 — CONDICIONES DE ENTRADA LONG:
Abrir LONG cuando:
- Precio esta POR ENCIMA de SMA(200) (tendencia macro alcista)
- RSI(2) < 10 (extremo de sobreventa en el corto plazo)
Entrada: al cierre de la vela donde RSI(2) cae por debajo de 10.

PASO 4 — CONDICIONES DE ENTRADA SHORT:
Abrir SHORT cuando:
- Precio esta POR DEBAJO de SMA(200) (tendencia macro bajista)
- RSI(2) > 90 (extremo de sobrecompra en el corto plazo)
Entrada: al cierre de la vela donde RSI(2) sube por encima de 90.

PASO 5 — CONDICIONES DE SALIDA:
Cerrar LONG cuando RSI(2) cruza por encima de 50 (precio ha revertido a la media).
Cerrar SHORT cuando RSI(2) cruza por debajo de 50.
NO usar TP fijo — dejar que RSI determine la salida.

PASO 6 — STOP LOSS:
SL de emergencia: 3% desde entrada (entry * 0.97 para LONG, entry * 1.03 para SHORT).
Este SL solo se activa si la reversion falla completamente.`,
    status: 'active',
    capital: 1000,
    leverage: 3,
    executionTime: 'intraday',
    aiModel: 'groq',
    numResults: 3,
    minIpe: 70,
    provenance: {
      type: 'built-in-library',
      source: 'Short Term Trading Strategies That Work — Larry Connors & Cesar Alvarez (2008)',
      chapter: 'Chapter 4 — The 2-Period RSI',
      url: 'https://www.amazon.com/dp/0981923909',
      importedAt: '2025-01-01T00:00:00Z',
      method: 'Estrategia codificada de referencia bibliografica',
      qualityScore: 86,
      notes: 'RSI de 2 periodos para trading de reversion a la media. Connors demostro que RSI(2) < 10 con tendencia alcista macro genera tasas de acierto > 80% en acciones.'
    }
  },

  {
    id: 'lib-keltner-reversion',
    name: 'Keltner Channel Mean Reversion',
    category: 'mean-reversion',
    content: `PASO 1 — CONFIGURACION INICIAL:
Activos: BTC/USDT, ETH/USDT, SOL/USDT. Temporalidad: 1h. Capital: 4% del portafolio. Apalancamiento: 5x.

PASO 2 — CALCULAR KELTNER CHANNEL:
KC_middle = EMA(20)
KC_upper = EMA(20) + 2 * ATR(10)
KC_lower = EMA(20) - 2 * ATR(10)
RSI(14) como filtro de momentum.

PASO 3 — CONDICIONES DE ENTRADA LONG:
Abrir LONG cuando:
- Precio cierra POR DEBAJO de KC_lower (sobreextendido a la baja)
- RSI(14) < 35 (confirma sobreventa)
- La vela muestra rechazo (sombra inferior > 50% del cuerpo)
Entrada: al cierre de la vela de rechazo.

PASO 4 — CONDICIONES DE ENTRADA SHORT:
Abrir SHORT cuando:
- Precio cierra POR ENCIMA de KC_upper (sobreextendido al alza)
- RSI(14) > 65 (confirma sobrecompra)
- La vela muestra rechazo (sombra superior > 50% del cuerpo)
Entrada: al cierre de la vela de rechazo.

PASO 5 — STOP LOSS Y TAKE PROFIT:
SL: 1 * ATR(10) desde el precio de entrada.
TP: KC_middle (EMA 20) — se espera reversion a la media.
Ratio R:R variable, tipicamente 1:1.5 a 1:2.

PASO 6 — FILTROS:
NO operar si ATR(10) > 2x su promedio de 50 periodos (volatilidad extrema).
Maximo 1 posicion de reversion abierta por activo.`,
    status: 'active',
    capital: 1000,
    leverage: 5,
    executionTime: 'intraday',
    aiModel: 'groq',
    numResults: 3,
    minIpe: 70,
    provenance: {
      type: 'built-in-library',
      source: 'The New Trading for a Living — Alexander Elder (2014)',
      chapter: 'Chapter 22 — Channels and Bands',
      url: 'https://www.amazon.com/dp/1118443926',
      importedAt: '2025-01-01T00:00:00Z',
      method: 'Estrategia codificada de referencia bibliografica',
      qualityScore: 83,
      notes: 'Keltner Channels basados en ATR son mas adaptativos que Bollinger Bands. Reversion a EMA(20) cuando el precio toca los extremos del canal.'
    }
  },

  {
    id: 'lib-zscore-reversion',
    name: 'Z-Score Mean Reversion',
    category: 'mean-reversion',
    content: `PASO 1 — CONFIGURACION INICIAL:
Activos: BTC/USDT, ETH/USDT. Temporalidad: 1h. Capital: 5% del portafolio. Apalancamiento: 3x.

PASO 2 — CALCULAR Z-SCORE:
Z = (precio_actual - SMA(20)) / stdDev(20)
Donde stdDev(20) es la desviacion estandar de los ultimos 20 cierres.
Z = 0 significa precio en la media. Z = 2 significa 2 desviaciones por encima.

PASO 3 — CONDICIONES DE ENTRADA LONG:
Abrir LONG cuando:
- Z < -2.0 (precio 2 desviaciones por debajo de la media = extremadamente barato)
- Volumen > promedio 20 periodos (confirma interes)
Entrada: al cierre de la vela donde Z cruza -2.0 hacia abajo.

PASO 4 — CONDICIONES DE ENTRADA SHORT:
Abrir SHORT cuando:
- Z > 2.0 (precio 2 desviaciones por encima = extremadamente caro)
- Volumen > promedio 20 periodos
Entrada: al cierre de la vela donde Z cruza 2.0 hacia arriba.

PASO 5 — CONDICIONES DE SALIDA:
Cerrar cuando Z regresa al rango -0.5 a 0.5 (precio cerca de la media).
LONG: cerrar cuando Z > -0.5.
SHORT: cerrar cuando Z < 0.5.

PASO 6 — STOP LOSS:
SL: si Z excede -3.0 para LONG (la anomalia se profundiza, posible break estructural).
SL: si Z excede +3.0 para SHORT.
En porcentaje: ~3-4% dependiendo de la volatilidad.
Position sizing: inversamente proporcional a stdDev (menor volatilidad = mayor posicion).`,
    status: 'active',
    capital: 1000,
    leverage: 3,
    executionTime: 'intraday',
    aiModel: 'groq',
    numResults: 3,
    minIpe: 70,
    provenance: {
      type: 'built-in-library',
      source: 'Algorithmic Trading — Ernest Chan (2013)',
      chapter: 'Chapter 3 — Mean-Reverting Strategies',
      url: 'https://www.amazon.com/dp/1118460146',
      importedAt: '2025-01-01T00:00:00Z',
      method: 'Estrategia codificada de referencia bibliografica',
      qualityScore: 85,
      notes: 'Z-Score es la base estadistica de mean reversion. Chan demuestra que crypto y commodities tienen propiedades mean-reverting en timeframes cortos.'
    }
  },

  // ═══════════════════════════════════════════════════════════════
  // CATEGORIA 4: BREAKOUT
  // ═══════════════════════════════════════════════════════════════

  {
    id: 'lib-turtle-donchian',
    name: 'Turtle Trading (Donchian Breakout)',
    category: 'breakout',
    content: `PASO 1 — CONFIGURACION INICIAL:
Activos: BTC/USDT, ETH/USDT, SOL/USDT, BNB/USDT, XRP/USDT. Temporalidad: 4h. Capital: 4% del portafolio. Apalancamiento: 2x.

PASO 2 — CALCULAR DONCHIAN CHANNELS:
DC_upper_20 = maximo mas alto de las ultimas 20 velas.
DC_lower_20 = minimo mas bajo de las ultimas 20 velas.
DC_upper_10 = maximo de ultimas 10 velas (para salida).
DC_lower_10 = minimo de ultimas 10 velas (para salida).
ATR(20) para position sizing.

PASO 3 — CONDICIONES DE ENTRADA LONG:
Abrir LONG cuando:
- Precio rompe por ENCIMA de DC_upper_20 (nuevo maximo de 20 periodos)
- Confirmar con cierre de vela por encima del nivel
Entrada: al cierre de la vela de breakout.
Position size: riesgo 1% del capital / ATR(20).

PASO 4 — CONDICIONES DE ENTRADA SHORT:
Abrir SHORT cuando:
- Precio rompe por DEBAJO de DC_lower_20 (nuevo minimo de 20 periodos)
- Confirmar con cierre de vela por debajo del nivel
Entrada: al cierre de la vela de breakdown.

PASO 5 — CONDICIONES DE SALIDA:
Salida LONG: cuando precio cae por debajo de DC_lower_10 (minimo de 10 periodos).
Salida SHORT: cuando precio sube por encima de DC_upper_10 (maximo de 10 periodos).

PASO 6 — STOP LOSS:
SL: 2 * ATR(20) desde precio de entrada.
Piramidacion: si precio se mueve 1*ATR a favor, agregar 1 unidad mas (maximo 4 unidades).
Riesgo total maximo por trade: 2% del capital.`,
    status: 'active',
    capital: 1000,
    leverage: 2,
    executionTime: 'swing',
    aiModel: 'groq',
    numResults: 3,
    minIpe: 70,
    provenance: {
      type: 'built-in-library',
      source: 'Way of the Turtle — Curtis Faith (2007)',
      chapter: 'Chapter 6 — The Turtle Way',
      url: 'https://www.amazon.com/dp/007148664X',
      importedAt: '2025-01-01T00:00:00Z',
      method: 'Estrategia codificada de referencia bibliografica',
      qualityScore: 90,
      notes: 'El sistema Turtle original de Richard Dennis. Convirtio $400 en $200M+ en los anos 80. Donchian Channel breakout con position sizing basado en ATR.'
    }
  },

  {
    id: 'lib-opening-range',
    name: 'Opening Range Breakout',
    category: 'breakout',
    content: `PASO 1 — CONFIGURACION INICIAL:
Activos: BTC/USDT, ETH/USDT. Temporalidad: 15m o 1h. Capital: 5% del portafolio. Apalancamiento: 5x.

PASO 2 — DEFINIR OPENING RANGE:
Tomar la primera vela de 1h del dia (00:00-01:00 UTC para crypto).
Range_high = maximo de esa primera vela.
Range_low = minimo de esa primera vela.
Range_width = Range_high - Range_low.

PASO 3 — CONDICIONES DE ENTRADA LONG:
Abrir LONG cuando:
- Precio rompe por ENCIMA de Range_high
- Volumen de la vela de breakout > 1.5x promedio de volumen de 20 periodos
- Hora: entre las 01:00 y 05:00 UTC (primeras 4 horas despues del rango)
Entrada: al cierre de la vela que rompe Range_high.

PASO 4 — CONDICIONES DE ENTRADA SHORT:
Abrir SHORT cuando:
- Precio rompe por DEBAJO de Range_low
- Volumen de la vela > 1.5x promedio
- Hora: entre las 01:00 y 05:00 UTC
Entrada: al cierre de la vela que rompe Range_low.

PASO 5 — STOP LOSS Y TAKE PROFIT:
SL: lado opuesto del Opening Range. Si LONG, SL = Range_low. Si SHORT, SL = Range_high.
TP: 1.5 * Range_width desde el punto de breakout.
Ratio R:R = 1:1.5 minimo.

PASO 6 — INVALIDACION:
Si no hay breakout en las primeras 4 horas → no operar ese dia.
Si el precio vuelve dentro del rango despues del breakout → cerrar inmediatamente (fakeout).`,
    status: 'active',
    capital: 1000,
    leverage: 5,
    executionTime: 'scalping',
    aiModel: 'groq',
    numResults: 3,
    minIpe: 70,
    provenance: {
      type: 'built-in-library',
      source: 'Mastering the Trade — John Carter (2006)',
      chapter: 'Chapter 9 — Opening Range Breakout',
      url: 'https://www.amazon.com/dp/0071775145',
      importedAt: '2025-01-01T00:00:00Z',
      method: 'Estrategia codificada de referencia bibliografica',
      qualityScore: 82,
      notes: 'El Opening Range Breakout es una de las estrategias mas antiguas y efectivas para day trading. Adaptada para mercado crypto 24/7.'
    }
  },

  {
    id: 'lib-inside-bar',
    name: 'Inside Bar Breakout',
    category: 'breakout',
    content: `PASO 1 — CONFIGURACION INICIAL:
Activos: top 5 crypto por volumen. Temporalidad: 4h. Capital: 4% del portafolio. Apalancamiento: 3x.

PASO 2 — IDENTIFICAR INSIDE BAR:
Una Inside Bar (IB) ocurre cuando:
- High de la vela actual < High de la vela anterior (mother bar)
- Low de la vela actual > Low de la vela anterior (mother bar)
Es decir: la vela esta COMPLETAMENTE contenida dentro de la anterior.
Mother Bar (MB) = la vela grande que contiene a la IB.

PASO 3 — CONDICIONES DE ENTRADA LONG:
Abrir LONG cuando:
- Se identifica Inside Bar
- Tendencia general es alcista: precio > EMA(50)
- Precio rompe por ENCIMA del High de la Mother Bar
Entrada: al cierre de la vela que rompe MB_high.

PASO 4 — CONDICIONES DE ENTRADA SHORT:
Abrir SHORT cuando:
- Se identifica Inside Bar
- Tendencia general es bajista: precio < EMA(50)
- Precio rompe por DEBAJO del Low de la Mother Bar
Entrada: al cierre de la vela que rompe MB_low.

PASO 5 — STOP LOSS Y TAKE PROFIT:
SL: extremo opuesto de la Mother Bar.
- LONG: SL = MB_low - 0.1% margen.
- SHORT: SL = MB_high + 0.1% margen.
TP: 2x la distancia del SL (R:R = 1:2).

PASO 6 — FILTROS:
NO operar Inside Bars en mercados laterales (ADX < 20).
La Mother Bar debe tener cuerpo real > 0.5% (no doji).
Maximo 2 operaciones simultaneas.`,
    status: 'active',
    capital: 1000,
    leverage: 3,
    executionTime: 'swing',
    aiModel: 'groq',
    numResults: 3,
    minIpe: 70,
    provenance: {
      type: 'built-in-library',
      source: 'Price Action Trading Secrets — Rayner Teo (2020)',
      chapter: 'Chapter 6 — Inside Bar',
      url: 'https://www.tradingwithrayner.com',
      importedAt: '2025-01-01T00:00:00Z',
      method: 'Estrategia codificada de referencia bibliografica',
      qualityScore: 80,
      notes: 'Inside Bar representa indecision del mercado seguida de expansion. Es un patron de continuacion que funciona mejor en tendencias fuertes.'
    }
  },

  // ═══════════════════════════════════════════════════════════════
  // CATEGORIA 5: VOLUMEN
  // ═══════════════════════════════════════════════════════════════

  {
    id: 'lib-obv-divergence',
    name: 'OBV Divergence (On-Balance Volume)',
    category: 'volume',
    content: `PASO 1 — CONFIGURACION INICIAL:
Activos: BTC/USDT, ETH/USDT, SOL/USDT, BNB/USDT, XRP/USDT. Temporalidad: 1h. Capital: 4% del portafolio. Apalancamiento: 3x.

PASO 2 — CALCULAR OBV:
OBV = volumen acumulado:
- Si cierre > cierre anterior: OBV += volumen
- Si cierre < cierre anterior: OBV -= volumen
- Si cierre = cierre anterior: OBV sin cambio
Calcular SMA(20) del OBV para tendencia.

PASO 3 — DIVERGENCIA ALCISTA (LONG):
Abrir LONG cuando:
- Precio hace LOWER LOW (minimo mas bajo)
- OBV hace HIGHER LOW (minimo mas alto) = dinero entrando a pesar de que el precio baja
- OBV esta por encima de su SMA(20) o cruzandola al alza
Entrada: al cierre de la vela de confirmacion (siguiente vela verde).

PASO 4 — DIVERGENCIA BAJISTA (SHORT):
Abrir SHORT cuando:
- Precio hace HIGHER HIGH (maximo mas alto)
- OBV hace LOWER HIGH (maximo mas bajo) = dinero saliendo a pesar de que el precio sube
- OBV esta por debajo de su SMA(20) o cruzandola a la baja
Entrada: al cierre de la vela de confirmacion (siguiente vela roja).

PASO 5 — STOP LOSS Y TAKE PROFIT:
SL: 2% desde entrada.
TP: 4% desde entrada.
Ratio R:R = 1:2.

PASO 6 — FILTROS:
La divergencia debe formarse en al menos 5 velas (no en 1-2 velas).
Volumen promedio del activo debe ser > $10M/24h.`,
    status: 'active',
    capital: 1000,
    leverage: 3,
    executionTime: 'intraday',
    aiModel: 'groq',
    numResults: 3,
    minIpe: 70,
    provenance: {
      type: 'built-in-library',
      source: 'Technical Analysis of the Financial Markets — John J. Murphy (1999)',
      chapter: 'Chapter 7 — Volume and Open Interest',
      url: 'https://www.amazon.com/dp/0735200661',
      importedAt: '2025-01-01T00:00:00Z',
      method: 'Estrategia codificada de referencia bibliografica',
      qualityScore: 84,
      notes: 'OBV fue creado por Joe Granville. Las divergencias entre OBV y precio son senales poderosas de acumulacion (compra institucional) o distribucion (venta institucional).'
    }
  },

  {
    id: 'lib-volume-profile-poc',
    name: 'Volume Profile POC Bounce',
    category: 'volume',
    content: `PASO 1 — CONFIGURACION INICIAL:
Activos: BTC/USDT, ETH/USDT. Temporalidad: 1h. Capital: 5% del portafolio. Apalancamiento: 5x.

PASO 2 — CALCULAR VOLUME PROFILE:
Dividir el rango de precios de las ultimas 20 velas en 50 niveles.
Para cada nivel: sumar el volumen de las velas cuyo rango (high-low) incluye ese nivel.
POC (Point of Control) = el nivel de precio con mayor volumen acumulado.
VAH (Value Area High) = nivel donde se acumula el 70% superior del volumen.
VAL (Value Area Low) = nivel donde se acumula el 70% inferior del volumen.

PASO 3 — CONDICIONES DE ENTRADA LONG (POC como soporte):
Abrir LONG cuando:
- Precio cae HACIA el POC desde arriba
- Vela muestra rechazo en el POC (sombra inferior larga, cierre por encima del POC)
- Volumen de la vela > promedio de 20 periodos
Entrada: al cierre de la vela de rechazo.

PASO 4 — CONDICIONES DE ENTRADA SHORT (POC como resistencia):
Abrir SHORT cuando:
- Precio sube HACIA el POC desde abajo
- Vela muestra rechazo en el POC (sombra superior larga, cierre por debajo del POC)
- Volumen de la vela > promedio de 20 periodos
Entrada: al cierre de la vela de rechazo.

PASO 5 — STOP LOSS Y TAKE PROFIT:
SL: 1% mas alla del POC (entry * 0.99 para LONG).
TP: 3% desde entrada (entry * 1.03 para LONG).
Ratio R:R = 1:3.

PASO 6 — FILTROS:
El POC debe tener al menos 3x el volumen promedio de otros niveles (POC fuerte).
NO operar si el precio ya reboto del POC 3+ veces (nivel gastado).`,
    status: 'active',
    capital: 1000,
    leverage: 5,
    executionTime: 'intraday',
    aiModel: 'groq',
    numResults: 3,
    minIpe: 70,
    provenance: {
      type: 'built-in-library',
      source: 'Mind Over Markets — James Dalton, Eric Jones, Robert Dalton (1993)',
      chapter: 'Chapter 5 — The Composite Profile',
      url: 'https://www.amazon.com/dp/1118531736',
      importedAt: '2025-01-01T00:00:00Z',
      method: 'Estrategia codificada de referencia bibliografica',
      qualityScore: 86,
      notes: 'Market Profile y Volume Profile fueron desarrollados en el CBOT (Chicago). El POC actua como iman — el precio tiende a ser atraido hacia los niveles de mayor actividad.'
    }
  },

  {
    id: 'lib-vwap-surge',
    name: 'VWAP + Volume Surge',
    category: 'volume',
    content: `PASO 1 — CONFIGURACION INICIAL:
Activos: BTC/USDT, ETH/USDT, SOL/USDT. Temporalidad: 15m o 1h. Capital: 5% del portafolio. Apalancamiento: 5x.

PASO 2 — CALCULAR VWAP:
VWAP = suma(precio_tipico * volumen) / suma(volumen)
Donde precio_tipico = (high + low + close) / 3.
Calcular desde el inicio del dia (00:00 UTC).
Volumen promedio = SMA(volumen, 20).

PASO 3 — CONDICIONES DE ENTRADA LONG:
Abrir LONG cuando:
- Precio cruza POR ENCIMA de VWAP (de abajo hacia arriba)
- Volumen de la vela actual > 2x el volumen promedio de 20 periodos (surge)
- La vela es verde (cierre > apertura)
Entrada: al cierre de la vela de cruce.

PASO 4 — CONDICIONES DE ENTRADA SHORT:
Abrir SHORT cuando:
- Precio cruza POR DEBAJO de VWAP (de arriba hacia abajo)
- Volumen de la vela actual > 2x el volumen promedio de 20 periodos (surge)
- La vela es roja (cierre < apertura)
Entrada: al cierre de la vela de cruce.

PASO 5 — STOP LOSS Y TAKE PROFIT:
SL: nivel del VWAP (trailing). Si el precio vuelve al otro lado del VWAP, cerrar.
TP: 2% desde entrada.
Trailing stop: mover SL al VWAP en cada nueva vela.

PASO 6 — FILTROS:
Solo operar en las primeras 12 horas del dia (mayor volumen y fiabilidad del VWAP).
NO operar si el rango diario ya supero 3% (movimiento ya extendido).
Verificar que el surge de volumen no es un spike aislado (siguiente vela debe mantener volumen > promedio).`,
    status: 'active',
    capital: 1000,
    leverage: 5,
    executionTime: 'scalping',
    aiModel: 'groq',
    numResults: 3,
    minIpe: 70,
    provenance: {
      type: 'built-in-library',
      source: 'Algorithmic Trading & DMA — Barry Johnson (2010)',
      chapter: 'Chapter 8 — VWAP Strategies',
      url: 'https://www.amazon.com/dp/0956399207',
      importedAt: '2025-01-01T00:00:00Z',
      method: 'Estrategia codificada de referencia bibliografica',
      qualityScore: 83,
      notes: 'VWAP es el benchmark institucional de ejecucion. Un cruce de VWAP con surge de volumen indica participacion institucional significativa.'
    }
  }
]

/**
 * Get strategies not yet imported
 * @param {string[]} alreadyImportedIds - Array of library IDs already imported
 * @returns {Object[]} Array of strategy objects ready to import
 */
export const getUnimportedStrategies = (alreadyImportedIds = []) => {
  return STRATEGY_LIBRARY.filter(s => !alreadyImportedIds.includes(s.id))
}
