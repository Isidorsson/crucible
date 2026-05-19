<script lang="ts">
  // Pure-decorative mini-chart of a recent time series. Renders as a small
  // SVG polyline scaled to the box. Always `aria-hidden`: the same data is
  // already announced as text alongside, so the chart is visual only.
  //
  // Usage:
  //   <Sparkline values={sim.nodeHistory[id]?.rps ?? []} width={56} height={14} />

  let {
    values,
    width = 56,
    height = 14,
    stroke = 'currentColor',
    fill = 'none',
    strokeWidth = 1.25,
    // When true, scales to the absolute max of values (good for rps).
    // When false, scales relative to 95th percentile so a single spike
    // doesn't flatten the rest of the trace (good for p99 latency).
    absoluteScale = true
  }: {
    values: number[];
    width?: number;
    height?: number;
    stroke?: string;
    fill?: string;
    strokeWidth?: number;
    absoluteScale?: boolean;
  } = $props();

  const path = $derived.by(() => {
    const n = values.length;
    if (n < 2) return '';

    // Lower bound at 0 so a flat zero line sits on the baseline rather
    // than the middle (which would lie about activity).
    const min = 0;
    let max: number;
    if (absoluteScale) {
      max = values.reduce((m, v) => (v > m ? v : m), 0);
    } else {
      const sorted = values.slice().sort((a, b) => a - b);
      max = sorted[Math.floor(sorted.length * 0.95)] || 1;
    }
    if (max <= min) return '';

    const stepX = width / (n - 1);
    // Leave one stroke-width of padding so the line doesn't clip at the
    // viewBox edges when it touches max.
    const pad = strokeWidth;
    const usable = height - pad * 2;

    let d = '';
    for (let i = 0; i < n; i++) {
      const x = i * stepX;
      const norm = Math.min(1, Math.max(0, (values[i] - min) / (max - min)));
      const y = height - pad - norm * usable;
      d += `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)} `;
    }
    return d.trim();
  });

  // Area fill: same path closed back to the baseline. Gives the trace a
  // subtle volume read without obscuring the line.
  const areaPath = $derived.by(() => {
    if (!path || fill === 'none') return '';
    return `${path} L ${width.toFixed(1)} ${height.toFixed(1)} L 0 ${height.toFixed(1)} Z`;
  });
</script>

{#if path}
  <svg
    {width}
    {height}
    viewBox="0 0 {width} {height}"
    preserveAspectRatio="none"
    aria-hidden="true"
    class="sparkline"
  >
    {#if areaPath}
      <path d={areaPath} fill={fill} opacity="0.18" />
    {/if}
    <path
      d={path}
      fill="none"
      {stroke}
      stroke-width={strokeWidth}
      stroke-linecap="round"
      stroke-linejoin="round"
      vector-effect="non-scaling-stroke"
    />
  </svg>
{/if}

<style>
  .sparkline {
    display: block;
    overflow: visible;
  }
</style>
