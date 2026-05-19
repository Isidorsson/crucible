<script lang="ts">
  import { Play, Pause, Square, Gauge, Activity, RotateCcw } from '@lucide/svelte';
  import { sim } from '$lib/stores/sim.svelte';
  import { design } from '$lib/stores/design.svelte';

  // Speed presets. "max" sends Infinity (the worker caps via TICK_BUDGET_MS).
  const SPEEDS: { label: string; value: number }[] = [
    { label: '0.25x', value: 0.25 },
    { label: '1x', value: 1 },
    { label: '2x', value: 2 },
    { label: '5x', value: 5 },
    { label: '100x', value: 100 },
    { label: 'max', value: 1e9 }
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
</script>

<div
  class="flex items-center gap-3 border-b border-line bg-panel px-4 py-2 font-mono text-xs text-ink"
>
  <button
    onclick={onPlayPause}
    class="flex items-center gap-1.5 rounded border border-line bg-bg px-3 py-1.5 hover:border-accent"
  >
    {#if sim.state === 'running'}
      <Pause class="h-3.5 w-3.5" /> Pause
    {:else}
      <Play class="h-3.5 w-3.5" /> {sim.state === 'paused' ? 'Resume' : 'Run'}
    {/if}
  </button>

  <button
    onclick={() => sim.stop()}
    class="flex items-center gap-1.5 rounded border border-line bg-bg px-3 py-1.5 hover:border-err"
  >
    <Square class="h-3.5 w-3.5" /> Stop
  </button>

  <div class="mx-2 h-5 w-px bg-line"></div>

  <div class="flex items-center gap-1.5">
    <Gauge class="h-3.5 w-3.5 text-muted" />
    <span class="text-muted">speed</span>
    {#each SPEEDS as s}
      <button
        onclick={() => onSpeed(s.value)}
        class="rounded px-2 py-1 {sim.speed === s.value
          ? 'bg-accent text-bg'
          : 'border border-line hover:border-accent'}"
      >
        {s.label}
      </button>
    {/each}
  </div>

  <div class="mx-2 h-5 w-px bg-line"></div>

  <div class="flex flex-1 items-center gap-2">
    <Activity class="h-3.5 w-3.5 text-muted" />
    <span class="text-muted">scale</span>
    <input
      type="range"
      min="0"
      max="100"
      step="0.5"
      bind:value={sliderValue}
      class="flex-1 accent-accent"
    />
    <span class="w-20 text-right tabular-nums">{globalRps.toLocaleString()} rps</span>
  </div>

  <div class="mx-2 h-5 w-px bg-line"></div>

  <button
    onclick={() => (design.seed = Math.floor(Math.random() * 1e9))}
    class="flex items-center gap-1.5 rounded border border-line bg-bg px-2.5 py-1.5 hover:border-accent"
    title="Reseed RNG"
  >
    <RotateCcw class="h-3.5 w-3.5" /> seed: {design.seed}
  </button>

  {#if sim.snapshot}
    <div class="ml-auto flex gap-3 text-muted">
      <span>born <span class="text-ink tabular-nums">{sim.snapshot.born}</span></span>
      <span>done <span class="text-ok tabular-nums">{sim.snapshot.completed}</span></span>
      <span>fail <span class="text-err tabular-nums">{sim.snapshot.failed}</span></span>
    </div>
  {/if}
</div>
