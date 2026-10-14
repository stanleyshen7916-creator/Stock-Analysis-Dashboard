import { createChart, CandlestickSeries, HistogramSeries, LineSeries, ColorType } from '../vendor/lightweight-charts.standalone.production.mjs';

// Thin rendering wrapper around TradingView Lightweight Charts (Apache-2.0).
// All data shaping (indicator math, series formatting) happens in
// src/dashboard/chart-series.js so it stays independently unit-testable;
// this module only owns drawing.
//
// MA5/MA20/RSI14/Volume are visible by default (the locked, already-shipped
// view). Bollinger Bands (Issue #84) overlay the existing price pane, so
// they are created up front with visible: false - an invisible overlay
// series adds no height to a pane that is already shown. MACD/ATR/
// Stochastic/OBV each need their own pane, and pane height is NOT
// controlled by series visibility - a pane with only visible:false series
// still reserves its full height. Creating those 4 panes up front (as an
// earlier version of this file did) therefore made the default, nothing-
// checked view taller than before, which breaks the "do not redesign
// locked Dashboard UI" requirement. They are instead created lazily, only
// when the user actually opts in via the indicator toggle, and fully
// removed (chart.removePane) when toggled back off - see setSeriesVisibility.
export function createDashboardChart(container) {
  const chart = createChart(container, {
    layout: {
      // Light theme (redesign, 2026-09-18) - grid/border/text colors only;
      // candlestick/MA/RSI/etc. series colors below are unchanged, they
      // already read fine on a light background.
      background: { type: ColorType.Solid, color: 'transparent' },
      textColor: '#6b7488'
    },
    grid: {
      vertLines: { color: '#e2e6ef' },
      horzLines: { color: '#e2e6ef' }
    },
    rightPriceScale: { borderColor: '#e2e6ef' },
    timeScale: { borderColor: '#e2e6ef' },
    autoSize: true
  });

  const candlestickSeries = chart.addSeries(CandlestickSeries, {
    upColor: '#26a69a',
    downColor: '#ef5350',
    borderVisible: false,
    wickUpColor: '#26a69a',
    wickDownColor: '#ef5350'
  }, 0);

  const volumeSeries = chart.addSeries(HistogramSeries, {
    priceFormat: { type: 'volume' },
    priceScaleId: 'volume'
  }, 0);
  chart.priceScale('volume').applyOptions({ scaleMargins: { top: 0.8, bottom: 0 } });

  const ma5Series = chart.addSeries(LineSeries, { color: '#4f8cff', lineWidth: 1, priceLineVisible: false, lastValueVisible: false }, 0);
  const ma20Series = chart.addSeries(LineSeries, { color: '#ffa726', lineWidth: 1, priceLineVisible: false, lastValueVisible: false }, 0);
  const rsiSeries = chart.addSeries(LineSeries, { color: '#ab47bc', lineWidth: 1 }, 1);

  // Bollinger Bands - overlay on the price pane, same treatment as MA5/MA20.
  const bbUpperSeries = chart.addSeries(LineSeries, { color: '#78909c', lineWidth: 1, priceLineVisible: false, lastValueVisible: false, visible: false }, 0);
  const bbMiddleSeries = chart.addSeries(LineSeries, { color: '#546e7a', lineWidth: 1, priceLineVisible: false, lastValueVisible: false, visible: false }, 0);
  const bbLowerSeries = chart.addSeries(LineSeries, { color: '#78909c', lineWidth: 1, priceLineVisible: false, lastValueVisible: false, visible: false }, 0);

  // EMA20 (v0.3.0, Issue #94) - another pane-0 overlay, same treatment.
  const emaSeries = chart.addSeries(LineSeries, { color: '#66bb6a', lineWidth: 1, priceLineVisible: false, lastValueVisible: false, visible: false }, 0);

  return {
    chart, candlestickSeries, volumeSeries, ma5Series, ma20Series, rsiSeries,
    bbUpperSeries, bbMiddleSeries, bbLowerSeries, emaSeries,
    // MACD/ATR/Stochastic/OBV: null until the user opts in (see
    // setSeriesVisibility's setPaneVisible). Each holds { pane, ...series }.
    macd: null, atr: null, stoch: null, obv: null,
    // Most recently computed data for each - cached here (not just passed
    // through renderDashboardChart) so a pane created later, after the
    // checkbox is checked, can be populated immediately from data that is
    // already verified/computed rather than waiting for the next render.
    latestData: { macd: null, atr: null, stochastic: null, obv: null }
  };
}

export function renderDashboardChart(handles, { candlesticks, volume, ma5, ma20, rsi, bollingerBands, ema, macd, atr, stochastic, obv }) {
  handles.candlestickSeries.setData(candlesticks);
  handles.volumeSeries.setData(volume);
  handles.ma5Series.setData(ma5);
  handles.ma20Series.setData(ma20);
  handles.rsiSeries.setData(rsi);
  if (bollingerBands) {
    handles.bbUpperSeries.setData(bollingerBands.upper);
    handles.bbMiddleSeries.setData(bollingerBands.middle);
    handles.bbLowerSeries.setData(bollingerBands.lower);
  }
  if (ema) handles.emaSeries.setData(ema);

  handles.latestData.macd = macd ?? null;
  handles.latestData.atr = atr ?? null;
  handles.latestData.stochastic = stochastic ?? null;
  handles.latestData.obv = obv ?? null;
  if (handles.macd) applyMacdData(handles.macd, handles.latestData.macd);
  if (handles.atr) handles.atr.series.setData(handles.latestData.atr ?? []);
  if (handles.stoch) applyStochData(handles.stoch, handles.latestData.stochastic);
  if (handles.obv) handles.obv.series.setData(handles.latestData.obv ?? []);

  handles.chart.timeScale().fitContent();
}

function applyMacdData(macdHandle, data) {
  macdHandle.lineSeries.setData(data ? data.macd : []);
  macdHandle.signalSeries.setData(data ? data.signal : []);
  macdHandle.histogramSeries.setData(data ? data.histogram : []);
}

function applyStochData(stochHandle, data) {
  stochHandle.kSeries.setData(data ? data.k : []);
  stochHandle.dSeries.setData(data ? data.d : []);
}

function createMacdPane(handles) {
  const pane = handles.chart.addPane();
  const lineSeries = pane.addSeries(LineSeries, { color: '#4f8cff', lineWidth: 1 });
  const signalSeries = pane.addSeries(LineSeries, { color: '#ffa726', lineWidth: 1 });
  const histogramSeries = pane.addSeries(HistogramSeries, {});
  const macdHandle = { pane, lineSeries, signalSeries, histogramSeries };
  applyMacdData(macdHandle, handles.latestData.macd);
  return macdHandle;
}

function createAtrPane(handles) {
  const pane = handles.chart.addPane();
  const series = pane.addSeries(LineSeries, { color: '#ef5350', lineWidth: 1 });
  series.setData(handles.latestData.atr ?? []);
  return { pane, series };
}

function createStochPane(handles) {
  const pane = handles.chart.addPane();
  const kSeries = pane.addSeries(LineSeries, { color: '#4f8cff', lineWidth: 1 });
  const dSeries = pane.addSeries(LineSeries, { color: '#ffa726', lineWidth: 1 });
  const stochHandle = { pane, kSeries, dSeries };
  applyStochData(stochHandle, handles.latestData.stochastic);
  return stochHandle;
}

function createObvPane(handles) {
  const pane = handles.chart.addPane();
  const series = pane.addSeries(LineSeries, { color: '#26a69a', lineWidth: 1 });
  series.setData(handles.latestData.obv ?? []);
  return { pane, series };
}

// Creates (opt-in) or fully removes (opt-out) the pane for one of the
// dedicated-pane indicators. Only ever reuses an already-created pane -
// never recreates one that is already showing, and never recomputes the
// underlying data (createXPane reads it from handles.latestData, already
// computed by renderDashboardChart).
function setPaneVisible(handles, key, visible, createPane) {
  if (visible) {
    if (!handles[key]) handles[key] = createPane(handles);
  } else if (handles[key]) {
    handles.chart.removePane(handles[key].pane.paneIndex());
    handles[key] = null;
  }
}

/**
 * Show/hide indicator series without touching their data - visibility is a
 * pure display toggle on already-computed data, never a recalculation.
 * MA/RSI/Volume/Bollinger Bands/EMA share a pane with content that is
 * already shown, so they toggle via applyOptions({ visible }). MACD/ATR/
 * Stochastic/OBV each own a dedicated pane, whose height is reserved
 * regardless of series visibility - those are created/removed outright
 * instead (see setPaneVisible) so an unchecked indicator adds no empty
 * space to the chart. Candlestick itself is not toggleable (not part of
 * the Indicator Visibility Controls scope).
 */
export function setSeriesVisibility(handles, { ma5, ma20, rsi, volume, bb, ema, macd, atr, stoch, obv }) {
  if (ma5 !== undefined) handles.ma5Series.applyOptions({ visible: ma5 });
  if (ma20 !== undefined) handles.ma20Series.applyOptions({ visible: ma20 });
  if (rsi !== undefined) handles.rsiSeries.applyOptions({ visible: rsi });
  if (volume !== undefined) handles.volumeSeries.applyOptions({ visible: volume });
  if (bb !== undefined) {
    handles.bbUpperSeries.applyOptions({ visible: bb });
    handles.bbMiddleSeries.applyOptions({ visible: bb });
    handles.bbLowerSeries.applyOptions({ visible: bb });
  }
  if (ema !== undefined) handles.emaSeries.applyOptions({ visible: ema });
  if (macd !== undefined) setPaneVisible(handles, 'macd', macd, createMacdPane);
  if (atr !== undefined) setPaneVisible(handles, 'atr', atr, createAtrPane);
  if (stoch !== undefined) setPaneVisible(handles, 'stoch', stoch, createStochPane);
  if (obv !== undefined) setPaneVisible(handles, 'obv', obv, createObvPane);
}
