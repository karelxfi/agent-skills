# TradingView Lightweight Charts — Dashboard Patterns

Patterns for building real-time analytics dashboards with [TradingView Lightweight Charts v4](https://tradingview.github.io/lightweight-charts/). Covers CDN setup, dark themes, chart types, crosshair sync, and common pitfalls.

## CDN Setup (No Build Step)

For single-file dashboards, load from CDN — no npm/bundler required:

```html
<script src="https://unpkg.com/lightweight-charts@4/dist/lightweight-charts.standalone.production.js"></script>
```

All APIs are under `LightweightCharts.*`:

```javascript
var chart = LightweightCharts.createChart(container, options)
```

## Dark Theme Base

A proven dark palette that matches TradingView's aesthetic:

```javascript
var chart = LightweightCharts.createChart(container, {
  layout: {
    background: { color: '#131722' },
    textColor: '#d1d4dc',
  },
  grid: {
    vertLines: { color: '#1e222d' },
    horzLines: { color: '#1e222d' },
  },
  crosshair: {
    mode: LightweightCharts.CrosshairMode.Normal,
  },
  timeScale: {
    borderColor: '#2a2e39',
    timeVisible: true,
  },
  rightPriceScale: {
    borderColor: '#2a2e39',
  },
})
```

Matching CSS for the page:

```css
:root {
  --bg-primary: #131722;
  --bg-card: #1e222d;
  --border: #2a2e39;
  --text-primary: #d1d4dc;
  --text-secondary: #787b86;
  --green: #26a69a;
  --red: #ef5350;
}

body {
  background: var(--bg-primary);
  color: var(--text-primary);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  margin: 0;
}

.chart-panel {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 8px;
  overflow: hidden;
  height: 280px;  /* fixed height prevents layout shifts */
}
```

## Series Types for Analytics

### Area Series — Cumulative Metrics (Volume, Fees, TVL)

```javascript
var series = chart.addAreaSeries({
  lineColor: '#26a69a',
  topColor: 'rgba(38, 166, 154, 0.3)',
  bottomColor: 'rgba(38, 166, 154, 0.02)',
  lineWidth: 2,
})

series.setData([
  { time: 1710720000, value: 1234567.89 },
  { time: 1710723600, value: 2345678.90 },
])
```

### Histogram — Volume, Delta, Counts

```javascript
var series = chart.addHistogramSeries({
  priceFormat: { type: 'volume' },
  priceScaleId: '',  // overlay on main scale
})
```

**Conditional colors** (green positive, red negative):

```javascript
var data = rawData.map(function(d) {
  var value = parseFloat(d.delta) || 0
  return {
    time: toUnix(d.t),
    value: value,
    color: value >= 0 ? '#26a69a' : '#ef5350',
  }
})
series.setData(data)
```

### Multi-Category Histogram (e.g., Volume by Coin)

TradingView doesn't support stacked bars natively. Use **separate histogram series** with color per category:

```javascript
var COIN_COLORS = {
  BTC: '#f7931a',
  ETH: '#627eea',
  SOL: '#9945ff',
  HYPE: '#26a69a',
}

// One series per coin
var seriesMap = {}
Object.keys(COIN_COLORS).forEach(function(coin) {
  seriesMap[coin] = chart.addHistogramSeries({
    color: COIN_COLORS[coin],
    priceFormat: { type: 'volume' },
  })
})

// Group data by coin, set each series
Object.keys(grouped).forEach(function(coin) {
  if (seriesMap[coin]) {
    seriesMap[coin].setData(grouped[coin])
  }
})
```

**Caveat:** Multiple histogram series on the same time bucket overlap rather than stack. This is fine for "which coin dominates" but not for "total across all coins."

### Line Series — Rates, Ratios, Prices

```javascript
var series = chart.addLineSeries({
  color: '#2962ff',
  lineWidth: 2,
})
```

## Time Handling

**Critical:** TradingView expects Unix timestamps in **seconds**, not milliseconds.

```javascript
// Convert ISO string to Unix seconds
function toUnix(isoString) {
  return Math.floor(new Date(isoString).getTime() / 1000)
}

// Convert ClickHouse DateTime64 (already ISO) to Unix seconds
var data = response.data.map(function(d) {
  return { time: toUnix(d.t), value: parseFloat(d.volume) }
})
```

**Common bugs:**
- Passing milliseconds → chart shows year 55000+
- Passing Date objects → chart throws error
- Unsorted data → chart renders incorrectly

**Always sort by time ascending:**

```javascript
data.sort(function(a, b) { return a.time - b.time })
```

## Crosshair Sync Across Charts

Sync crosshair position so hovering one chart highlights the same time on all others:

```javascript
var charts = [chart1, chart2, chart3, chart4]

charts.forEach(function(source, i) {
  source.subscribeCrosshairMove(function(param) {
    if (!param.time) return
    charts.forEach(function(target, j) {
      if (i !== j) {
        target.setCrosshairPosition(undefined, undefined, target.series || target)
        // Or sync via time:
        // target.setCrosshairPosition(param.time)
      }
    })
  })
})
```

**Simpler approach** — just sync the time scale (scroll/zoom together):

```javascript
chart1.timeScale().subscribeVisibleLogicalRangeChange(function(range) {
  if (range) {
    chart2.timeScale().setVisibleLogicalRange(range)
    chart3.timeScale().setVisibleLogicalRange(range)
  }
})
```

## Responsive Charts

Use `ResizeObserver` to resize charts when their container changes:

```javascript
function makeResponsive(chart, container) {
  var observer = new ResizeObserver(function(entries) {
    var entry = entries[0]
    if (entry) {
      chart.applyOptions({
        width: entry.contentRect.width,
        height: entry.contentRect.height,
      })
    }
  })
  observer.observe(container)
}

// Usage
var container = document.getElementById('chart1')
var chart = LightweightCharts.createChart(container, { /* options */ })
makeResponsive(chart, container)
```

**Tip:** Set `height` on the container via CSS, not on the chart options. Let `ResizeObserver` propagate the height to the chart.

## Live Data Polling

For real-time dashboards, poll the API on an interval:

```javascript
var POLL_INTERVAL = 3000 // 3 seconds

function buildParams() {
  var interval = document.getElementById('interval-select').value
  var window = document.getElementById('window-select').value
  return 'interval=' + interval + '&window=' + window
}

function fetchJSON(url) {
  return fetch(url).then(function(r) { return r.json() })
}

function refreshAll() {
  var p = buildParams()
  Promise.all([
    fetchJSON('/api/stats?' + p).then(renderStats),
    fetchJSON('/api/volume?' + p).then(renderVolume),
    fetchJSON('/api/fees?' + p).then(renderFees),
  ]).catch(function(err) {
    console.error('Refresh failed:', err)
  })
}

// Initial load + polling
refreshAll()
setInterval(refreshAll, POLL_INTERVAL)

// Re-fetch on control change
document.getElementById('interval-select').addEventListener('change', refreshAll)
document.getElementById('window-select').addEventListener('change', refreshAll)
```

## Empty State Handling

Show a message when no data is available instead of a blank chart:

```javascript
function hideEmpty(emptyId, hasData) {
  var el = document.getElementById(emptyId)
  if (el) el.style.display = hasData ? 'none' : 'flex'
}

// In HTML
// <div id="empty-volume" class="empty-state">No data available</div>

// In refresh function
var hasData = res.data && res.data.length > 0
hideEmpty('empty-volume', hasData)
if (!hasData) return
```

CSS:
```css
.empty-state {
  display: none;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--text-secondary);
  font-size: 14px;
}
```

## Price Formatting

```javascript
// For USD values
priceFormat: {
  type: 'custom',
  formatter: function(price) {
    if (Math.abs(price) >= 1e9) return '$' + (price / 1e9).toFixed(2) + 'B'
    if (Math.abs(price) >= 1e6) return '$' + (price / 1e6).toFixed(2) + 'M'
    if (Math.abs(price) >= 1e3) return '$' + (price / 1e3).toFixed(1) + 'K'
    return '$' + price.toFixed(2)
  },
}

// For volume (auto-format with suffixes)
priceFormat: { type: 'volume' }

// For percentages
priceFormat: {
  type: 'custom',
  formatter: function(price) { return price.toFixed(2) + '%' },
}
```

## Dashboard Layout Pattern

CSS Grid works well for multi-chart dashboards:

```css
.dashboard {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  padding: 12px;
  max-width: 1400px;
  margin: 0 auto;
}

/* Full-width panels */
.full-width { grid-column: 1 / -1; }

/* Stats bar */
.stats-bar {
  grid-column: 1 / -1;
  display: flex;
  gap: 12px;
}

.stat-card {
  flex: 1;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 12px 16px;
}
```

## Common Pitfalls

1. **Time in milliseconds** → Charts show absurd dates. Always divide by 1000.
2. **Unsorted data** → Rendering glitches. Always `.sort()` by time.
3. **Calling `setData` before chart is mounted** → No-op or error. Defer to `DOMContentLoaded`.
4. **Chart height: 0** → Container has no height set. Always set explicit height on container.
5. **Too many series** → Performance degrades above ~10 series on one chart. Aggregate or paginate.
6. **`fitContent()` on every poll** → Chart jumps on each refresh. Only call on first load or control change.
7. **Cross-origin API calls** → Need `Access-Control-Allow-Origin: *` header on API responses.

## Related

- [TradingView Lightweight Charts Docs](https://tradingview.github.io/lightweight-charts/)
- [CLICKHOUSE_ANALYTICS.md](./CLICKHOUSE_ANALYTICS.md) — Query patterns for feeding these charts
