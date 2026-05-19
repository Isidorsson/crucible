<script lang="ts">
  import { Play, Pause, Square, Gauge, Activity, RotateCcw } from '@lucide/svelte';
  import { sim } from '$lib/stores/sim.svelte';
  import { design } from '$lib/stores/design.svelte';

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

  function applyRpsToAllSources() {
    for (const n of design.nodes) {
      if (n.data.kind === 'source') {
        design.updateNodeProps(n.id, { rps: globalRps });
        sim.setRPS(n.id, globalRps);
      }
    }
  }

  $effect(() => {
    void globalRps;
    applyRpsToAllSources();
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
</script>

<div
  class="flex flex-wrap items-center gap-3 border-b border-line bg-panel px-4 py-2 font-mono text-xs text-ink"
  role="toolbar"
  aria-label="Simulation controls"
>
  <button
    type="button"
    onclick={onPlayPause}
    aria-label="{playLabel} simulation"
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

  <button
    type="button"
    onclick={() => sim.stop()}
    aria-label="Stop simulation"
    class="flex items-center gap-1.5 rounded border border-line bg-bg px-3 py-1.5
           transition-colors hover:border-err
           focus-visible:border-err focus-visible:ring-2 focus-visible:ring-err"
  >
    <Square class="h-3.5 w-3.5" aria-hidden="true" /> Stop
  </button>

  <div class="mx-2 h-5 w-px bg-line" aria-hidden="true"></div>

  <div
    class="flex items-center gap-1.5"
    role="radiogroup"
    aria-label="Simulation speed"
  >
    <Gauge class="h-3.5 w-3.5 text-muted" aria-hidden="true" />
    <span class="text-muted" aria-hidden="true">speed</span>
    {#each SPEEDS as s}
      {@const active = sim.speed === s.value}
      <button
        type="button"
        role="radio"
        aria-checked={active}
        aria-label={s.aria}
        onclick={() => onSpeed(s.value)}
        class="rounded px-2 py-1 transition-colors
               focus-visible:ring-2 focus-visible:ring-accent
               {active ? 'bg-accent text-bg' : 'border border-line hover:border-accent'}"
      >
        {s.label}
      </button>
    {/each}
  </div>

  <div class="mx-2 h-5 w-px bg-line" aria-hidden="true"></div>

  <div class="flex min-w-0 flex-1 items-center gap-2">
    <Activity class="h-3.5 w-3.5 text-muted" aria-hidden="true" />
    <label for="rps-scale" class="text-muted">scale</label>
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
    <span class="w-24 text-right tabular-nums" aria-hidden="true">
      {numberFmt.format(globalRps)} rps
    </span>
  </div>

  <div class="mx-2 h-5 w-px bg-line" aria-hidden="true"></div>

  <button
    type="button"
    onclick={() => (design.seed = Math.floor(Math.random() * 1e9))}
    aria-label="Reseed RNG, current seed {design.seed}"
    class="flex items-center gap-1.5 rounded border border-line bg-bg px-2.5 py-1.5
           transition-colors hover:border-accent
           focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent"
  >
    <RotateCcw class="h-3.5 w-3.5" aria-hidden="true" />
    seed:&nbsp;<span class="tabular-nums">{design.seed}</span>
  </button>

  <div class="ml-auto" aria-live="polite" aria-atomic="false">
    {#if sim.snapshot}
      <div class="flex gap-3 text-muted">
        <span>born <span class="text-ink tabular-nums">{numberFmt.format(sim.snapshot.born)}</span></span>
        <span>done <span class="text-ok tabular-nums">{numberFmt.format(sim.snapshot.completed)}</span></span>
        <span>fail <span class="text-err tabular-nums">{numberFmt.format(sim.snapshot.failed)}</span></span>
      </div>
    {/if}
  </div>
</div>
