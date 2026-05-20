<script lang="ts">
  import { untrack } from 'svelte';
  import { Play, Pause, Square, Gauge, Activity, RotateCcw, DollarSign } from '@lucide/svelte';
  import { sim } from '$lib/stores/sim.svelte';
  import { design } from '$lib/stores/design.svelte';
  import { CATALOG_BY_KIND } from '$lib/types/catalog';
  import Tooltip from './Tooltip.svelte';
  import Hint from './Hint.svelte';
  import Scrubber from './Scrubber.svelte';
  import { GLOSSARY } from './glossary';

  // Speed presets. "max" sends a large finite multiplier (1e9); worker
  // still caps each tick to TICK_BUDGET_MS so the UI stays responsive.
  const SPEEDS: { label: string; aria: string; value: number }[] = [
    { label: '0.25x', aria: 'Quarter speed', value: 0.25 },
    { label: '1x', aria: 'Real time', value: 1 },
    { label: '2x', aria: '2x speed', value: 2 },
    { label: '5x', aria: '5x speed', value: 5 },
    { label: '100x', aria: '100x speed', value: 100 },
    { label: 'max', aria: 'Maximum speed', value: 1e9 }
  ];

  const numberFmt = new Intl.NumberFormat();

  // Decade presets cover the simulator's load range in one tap. Mirrors the
  // speed-preset chip pattern above, so the toolbar reads as a consistent
  // segmented vocabulary instead of a slider competing with chips.
  const RPS_DECADES: { label: string; value: number }[] = [
    { label: '1', value: 1 },
    { label: '10', value: 10 },
    { label: '100', value: 100 },
    { label: '1k', value: 1_000 },
    { label: '10k', value: 10_000 },
    { label: '100k', value: 100_000 },
    { label: '1M', value: 1_000_000 }
  ];

  let globalRps = $state<number>(100);

  function setRps(v: number) {
    const clamped = Math.max(1, Math.min(1_000_000, Math.round(v)));
    if (clamped === globalRps) return;
    globalRps = clamped;
  }

  // Decade-aware step: fine = 10% of current decade, coarse = full decade.
  // Shared by the rps scrubber so dragging feels uniform across the log
  // range (10 at 100 rps, 1k at 10k rps, …).
  function decadeStep(v: number): { fine: number; coarse: number } {
    const decade = Math.pow(10, Math.floor(Math.log10(Math.max(1, v))));
    return { fine: Math.max(1, decade / 10), coarse: decade };
  }

  // Wrap the iteration in `untrack` so reading + writing `design.nodes`
  // doesn't retrigger this effect — only changes to globalRps should.
  // Match every node whose engine kind is `source` (Source, Web Client,
  // Mobile Client, Cron Job, …); matching the catalog kind string alone
  // missed those variants and made the scale slider silently no-op on
  // anything but the generic Source node.
  $effect(() => {
    const rps = globalRps;
    untrack(() => {
      for (const n of design.nodes) {
        if (CATALOG_BY_KIND[n.data.kind].engineKind !== 'source') continue;
        if (n.data.props.rps === rps) continue; // no-op write would still re-render
        design.updateNodeProps(n.id, { rps });
        sim.setRPS(n.id, rps);
      }
    });
  });

  function onSpeed(v: number) {
    sim.setSpeed(v);
  }

  // Speed scrubber: operates in "internal units" of hundredths of a multiplier
  // (so step granularity stays integer-friendly: 1 unit = 0.01x). The "max"
  // chip remains a sentinel that bypasses the scrubber — typing or scrubbing
  // a value above 1000 gets clamped, "max" sets sim.speed = 1e9.
  const SPEED_UNIT = 100; // 1 unit = 0.01x
  const SPEED_SCRUB_MIN = 25; // 0.25x
  const SPEED_SCRUB_MAX = 100_000; // 1000x
  const speedIsMax = $derived(sim.speed >= 1e6);
  // Treat sentinel speed as the scrubber's max so the UI never displays
  // "10000000x" by accident; the scrubber still shows "max" via formatter.
  const speedScrubValue = $derived(
    speedIsMax ? SPEED_SCRUB_MAX : Math.round(sim.speed * SPEED_UNIT)
  );

  function commitSpeedScrub(units: number) {
    const mult = units / SPEED_UNIT;
    // Crossing past 1000x snaps to the "max" sentinel so the user can land
    // there from a scrub without having to click the chip.
    if (units >= SPEED_SCRUB_MAX) {
      sim.setSpeed(1e9);
    } else {
      sim.setSpeed(mult);
    }
  }

  function formatSpeed(units: number): string {
    if (units >= SPEED_SCRUB_MAX) return 'max';
    const m = units / SPEED_UNIT;
    if (m >= 100) return `${Math.round(m)}x`;
    if (m >= 10) return `${m.toFixed(0)}x`;
    if (m >= 1) return `${m.toFixed(2).replace(/\.?0+$/, '')}x`;
    return `${m.toFixed(2)}x`;
  }

  function parseSpeed(s: string): number {
    const t = s.trim().toLowerCase();
    if (t === 'max' || t === 'm') return SPEED_SCRUB_MAX;
    const cleaned = t.replace(/[x×, _]/g, '');
    const m = Number(cleaned);
    if (!Number.isFinite(m) || m <= 0) return NaN;
    return Math.round(m * SPEED_UNIT);
  }

  // Decade-flavoured step but tuned for fractional speeds: 0.05x near 1x,
  // 1x near 10x, 10x near 100x — keeps the scrub feel proportional.
  function speedStep(units: number): { fine: number; coarse: number } {
    const m = units / SPEED_UNIT;
    if (m < 1) return { fine: 5, coarse: 25 };          // 0.05x / 0.25x
    if (m < 10) return { fine: 25, coarse: 100 };       // 0.25x / 1x
    if (m < 100) return { fine: 100, coarse: 500 };     // 1x / 5x
    return { fine: 500, coarse: 2500 };                  // 5x / 25x
  }

  function onPlayPause() {
    if (sim.state === 'running') sim.pause();
    else if (sim.state === 'paused') sim.resume();
    else sim.start();
  }

  // Sum monthly cost across every node on the canvas. Catalog values are
  // order-of-magnitude AWS list prices at default scale; sum is best read
  // as "what tier of monthly burn this design implies", not a quote.
  const totalCost = $derived(
    design.nodes.reduce(
      (sum, n) => sum + (CATALOG_BY_KIND[n.data.kind].costPerMonth ?? 0),
      0
    )
  );
  const totalCostFmt = $derived(
    totalCost >= 1000 ? `${(totalCost / 1000).toFixed(1)}k` : `${totalCost}`
  );

  const playLabel = $derived(
    sim.state === 'running' ? 'Pause' : sim.state === 'paused' ? 'Resume' : 'Run'
  );
  const playHint = $derived(
    sim.state === 'running'
      ? GLOSSARY.pause.full
      : sim.state === 'paused'
        ? GLOSSARY.play.full
        : GLOSSARY.play.full
  );
</script>

<div
  class="flex flex-wrap items-center gap-3 border-b border-line bg-panel px-4 py-2 font-mono text-xs text-ink"
  role="toolbar"
  aria-label="Simulation controls"
>
  <Tooltip content={playHint} side="bottom">
    {#snippet children(id)}
      <button
        type="button"
        onclick={onPlayPause}
        aria-label="{playLabel} simulation"
        aria-describedby={id}
        class="flex items-center gap-1.5 rounded border border-line bg-bg px-3 py-1.5
               transition-colors hover:border-accent
               focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent"
      >
        {#if sim.state === 'running'}
          <Pause class="h-3.5 w-3.5" aria-hidden="true" /> Pause
        {:else}
          <Play class="h-3.5 w-3.5" aria-hidden="true" /> {playLabel}
        {/if}
      </button>
    {/snippet}
  </Tooltip>

  <Tooltip content={GLOSSARY.stop.full} side="bottom">
    {#snippet children(id)}
      <button
        type="button"
        onclick={() => sim.stop()}
        aria-label="Stop simulation"
        aria-describedby={id}
        class="flex items-center gap-1.5 rounded border border-line bg-bg px-3 py-1.5
               transition-colors hover:border-err
               focus-visible:border-err focus-visible:ring-2 focus-visible:ring-err"
      >
        <Square class="h-3.5 w-3.5" aria-hidden="true" /> Stop
      </button>
    {/snippet}
  </Tooltip>

  <div class="mx-2 h-5 w-px bg-line" aria-hidden="true"></div>

  <div
    class="flex items-center gap-1.5"
    role="radiogroup"
    aria-label="Simulation speed"
  >
    <Gauge class="h-3.5 w-3.5 text-muted" aria-hidden="true" />
    <Hint term="speed" side="bottom" class="text-muted" />
    {#each SPEEDS as s}
      {@const active = sim.speed === s.value}
      {@const tip = s.value === 1e9 ? GLOSSARY.speedMax.full : `${GLOSSARY.speed.full} Current preset: ${s.label}.`}
      <Tooltip content={tip} side="bottom">
        {#snippet children(id)}
          <button
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={s.aria}
            aria-describedby={id}
            onclick={() => onSpeed(s.value)}
            class="rounded px-2 py-1 transition-colors
                   focus-visible:ring-2 focus-visible:ring-accent
                   {active ? 'bg-accent text-bg' : 'border border-line hover:border-accent'}"
          >
            {s.label}
          </button>
        {/snippet}
      </Tooltip>
    {/each}

    <Scrubber
      value={speedScrubValue}
      min={SPEED_SCRUB_MIN}
      max={SPEED_SCRUB_MAX}
      onCommit={commitSpeedScrub}
      formatDisplay={formatSpeed}
      formatEdit={(v) => formatSpeed(v)}
      parseEdit={parseSpeed}
      step={speedStep}
      width="3.5rem"
      label="speed multiplier"
      tooltip="Click to type (e.g. 1.5x, max), drag to scrub, or use arrow keys (Shift = coarse step)."
    />
  </div>

  <div class="mx-2 h-5 w-px bg-line" aria-hidden="true"></div>

  <div
    class="flex items-center gap-1.5"
    role="group"
    aria-label="Global RPS scale"
  >
    <Activity class="h-3.5 w-3.5 text-muted" aria-hidden="true" />
    <Hint term="scale" side="bottom" class="text-muted" />
    {#each RPS_DECADES as d}
      {@const active = globalRps === d.value}
      <Tooltip content="Set global source rate to {numberFmt.format(d.value)} rps." side="bottom">
        {#snippet children(id)}
          <button
            type="button"
            role="radio"
            aria-checked={active}
            aria-label="{numberFmt.format(d.value)} requests per second"
            aria-describedby={id}
            onclick={() => setRps(d.value)}
            class="rounded px-2 py-1 font-mono text-[11px] transition-colors
                   focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent
                   {active ? 'bg-accent text-bg' : 'border border-line hover:border-accent'}"
          >
            {d.label}
          </button>
        {/snippet}
      </Tooltip>
    {/each}

    <Scrubber
      value={globalRps}
      min={1}
      max={1_000_000}
      onCommit={setRps}
      formatDisplay={(v) => `${numberFmt.format(v)} rps`}
      step={decadeStep}
      width="5rem"
      label="global rps"
      tooltip="Click to type, drag horizontally to scrub, or use arrow keys (Shift = ×10 step)."
    />
  </div>

  <div class="mx-2 h-5 w-px bg-line" aria-hidden="true"></div>

  <Tooltip content={GLOSSARY.seed.full} side="bottom">
    {#snippet children(id)}
      <button
        type="button"
        onclick={() => (design.seed = Math.floor(Math.random() * 1e9))}
        aria-label="Reseed RNG, current seed {design.seed}"
        aria-describedby={id}
        class="flex items-center gap-1.5 rounded border border-line bg-bg px-2.5 py-1.5
               transition-colors hover:border-accent
               focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent"
      >
        <RotateCcw class="h-3.5 w-3.5" aria-hidden="true" />
        seed:&nbsp;<span class="tabular-nums">{design.seed}</span>
      </button>
    {/snippet}
  </Tooltip>

  {#if design.nodes.length > 0}
    <Tooltip
      content="Sum of every node's catalog costPerMonth at default scale. Anchor only — real cost moves 10× with usage."
      side="bottom"
    >
      {#snippet children(id)}
        <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
        <span
          tabindex="0"
          aria-describedby={id}
          aria-label="Estimated monthly cost {totalCostFmt} dollars across {design.nodes.length} nodes"
          class="flex cursor-help items-center gap-1 rounded border border-line bg-bg px-2 py-1
                 text-[11px] text-muted
                 focus-visible:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <DollarSign class="h-3 w-3" aria-hidden="true" />
          <span class="tabular-nums text-ink">{totalCostFmt}</span>/mo
        </span>
      {/snippet}
    </Tooltip>
  {/if}

  <div class="ml-auto flex items-center gap-3" aria-live="polite" aria-atomic="false">
    {#if sim.state === 'loading'}
      <span class="text-muted">loading sim…</span>
    {/if}
    {#if sim.error}
      <!-- Assertive so screen readers interrupt; visually a small red pill
           so a hot-mutation failure (e.g. addEdge for an unknown node) is
           obvious without being modal. -->
      <span
        role="alert"
        aria-live="assertive"
        class="rounded border border-err bg-err/10 px-2 py-0.5 text-[11px] font-semibold text-err"
        title={sim.error}
      >
        sim error: {sim.error}
      </span>
    {/if}
    {#if sim.snapshot}
      <div class="flex gap-3 text-muted">
        <span>
          <Hint term="born" side="bottom" />
          <span class="text-ink tabular-nums">{numberFmt.format(sim.snapshot.born)}</span>
        </span>
        <span>
          <Hint term="done" side="bottom" />
          <span class="text-ok tabular-nums">{numberFmt.format(sim.snapshot.completed)}</span>
        </span>
        <span>
          <Hint term="fail" side="bottom" />
          <span class="text-err tabular-nums">{numberFmt.format(sim.snapshot.failed)}</span>
        </span>
      </div>
    {/if}
  </div>
</div>

