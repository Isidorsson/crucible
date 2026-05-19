<script lang="ts">
  import { untrack } from 'svelte';
  import { Play, Pause, Square, Gauge, Activity, RotateCcw } from '@lucide/svelte';
  import { sim } from '$lib/stores/sim.svelte';
  import { design } from '$lib/stores/design.svelte';
  import { CATALOG_BY_KIND } from '$lib/types/catalog';
  import Tooltip from './Tooltip.svelte';
  import Hint from './Hint.svelte';
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

  // Logarithmic RPS slider: slider 0..100 maps to 1..1_000_000 rps.
  function sliderToRps(s: number): number {
    const min = Math.log10(1);
    const max = Math.log10(1_000_000);
    return Math.round(Math.pow(10, min + ((max - min) * s) / 100));
  }
  function rpsToSlider(rps: number): number {
    const min = Math.log10(1);
    const max = Math.log10(1_000_000);
    return ((Math.log10(Math.max(1, rps)) - min) / (max - min)) * 100;
  }

  const numberFmt = new Intl.NumberFormat();

  let sliderValue = $state<number>(rpsToSlider(100));
  const globalRps = $derived(sliderToRps(sliderValue));

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

  function onPlayPause() {
    if (sim.state === 'running') sim.pause();
    else if (sim.state === 'paused') sim.resume();
    else sim.start();
  }

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
  </div>

  <div class="mx-2 h-5 w-px bg-line" aria-hidden="true"></div>

  <div class="flex min-w-0 flex-1 items-center gap-2">
    <Activity class="h-3.5 w-3.5 text-muted" aria-hidden="true" />
    <Hint term="scale" side="bottom" class="text-muted" />
    <label class="sr-only" for="rps-scale">Global RPS scale</label>
    <input
      id="rps-scale"
      name="rps-scale"
      type="range"
      min="0"
      max="100"
      step="0.5"
      bind:value={sliderValue}
      aria-valuetext="{numberFmt.format(globalRps)} requests per second"
      class="flex-1 accent-accent focus-visible:ring-2 focus-visible:ring-accent"
    />
    <span class="w-24 text-right tabular-nums">
      {numberFmt.format(globalRps)} <Hint term="rps" />
    </span>
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

  <div class="ml-auto flex items-center gap-3" aria-live="polite" aria-atomic="false">
    {#if sim.state === 'loading'}
      <span class="text-muted">loading sim…</span>
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
