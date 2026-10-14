export function generateTechnicalSignals(indicators) {
  const { sma, ema, rsi, macd, bollingerBands } = indicators;
  const length = Math.max(sma.length, ema.length, rsi.length, macd.line.length, bollingerBands.middle.length);
  return Array.from({ length }, (_, index) => {
    const signals = [];
    const closeAboveSma = sma[index] !== null && indicators.close?.[index] > sma[index];
    const closeAboveEma = ema[index] !== null && indicators.close?.[index] > ema[index];
    if (closeAboveSma) signals.push('price_above_sma');
    if (closeAboveEma) signals.push('price_above_ema');
    if (rsi[index] !== null) {
      if (rsi[index] < 30) signals.push('rsi_oversold');
      if (rsi[index] > 70) signals.push('rsi_overbought');
    }
    if (macd.line[index] !== null && macd.signal[index] !== null) {
      if (macd.line[index] > macd.signal[index]) signals.push('macd_bullish');
      if (macd.line[index] < macd.signal[index]) signals.push('macd_bearish');
    }
    if (bollingerBands.upper[index] !== null && indicators.close?.[index] !== undefined) {
      if (indicators.close[index] > bollingerBands.upper[index]) signals.push('above_bollinger_upper');
      if (indicators.close[index] < bollingerBands.lower[index]) signals.push('below_bollinger_lower');
    }
    return { index, signals };
  });
}
