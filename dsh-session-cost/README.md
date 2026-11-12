# dsh-session-cost

A small client plugin for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) that shows an estimated token cost in every sidebar session row, just before its relative update time.

![Screenshot](screenshot.png)

## What it does

- Reads the cumulative `tokenUsage` session projection: uncached input, cache read, cache write, and output tokens.
- Prices each bucket with configurable USD rates per one million tokens.
- Renders the result before the row's `17min`-style timestamp, e.g. `$1.98 1h`.
- Updates live as new usage arrives; it keeps no state of its own and sends nothing over the network.

The figure is an estimate, not a billing record.

## Default rates

| Bucket | USD per 1M tokens |
| --- | ---: |
| Input (cache miss) | 0.28 |
| Cache read | 0.028 |
| Cache write | 0.28 |
| Output | 0.42 |

Override them in the browser console without rebuilding:

```js
localStorage.setItem('dsh-session-cost:rates', JSON.stringify({
  input: 0.28,
  cacheRead: 0.028,
  cacheWrite: 0.28,
  output: 0.42
}))
```

## Installation

The plugin is a package directory, not an npm bundle. Make it available to a DSH profile and add one loader entry to the profile's `cordis.patch.yml`:

```yaml
- insert:
    - id: session-cost
      name: file:///ABSOLUTE/PATH/TO/dsh-session-cost/lib/index.js
```

Then restart (`dsh web`) or let the live profile reload, and refresh the browser tab.

The package's `dsh.client` declaration serves `lib/client.js` to the Web client; the Host entry in `lib/index.js` is intentionally a no-op.

## Layout

| Path | Role |
| --- | --- |
| `lib/client.js` | Browser plugin: frame-wide probe that decorates sidebar rows |
| `lib/index.js` | Host loader entry (no Host-side behavior) |
| `package.json` | Package metadata and `dsh.client` declaration |

## Limitations

- Pricing is a flat per-million rate; sessions that used several models are priced with the same table.
- The badge is injected through a `MutationObserver` and a CSS pseudo-element, because DSH has no trailing-slot seat between the sidebar row title and its relative time. A future slot there would remove the DOM dependency.
