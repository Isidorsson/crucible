<script lang="ts">
  import { Zap, X, Skull, Snail, ShieldOff, Scissors } from '@lucide/svelte';
  import { sim } from '$lib/stores/sim.svelte';
  import { selection } from '$lib/stores/selection.svelte';
  import {
    FaultKill,
    FaultSlow,
    FaultPacketLoss,
    FaultPartition,
    type FaultKind,
    type FaultEvent
  } from '$lib/types/topology';

  let open = $state(false);

  // Reverse-chronological: newest at the top. Slice a copy because
  // toReversed() isn't in all browsers we'd otherwise consider and the
  // returned reactive array shouldn't be mutated in place.
  const ordered = $derived(sim.faultLog.slice().reverse());
  const count = $derived(sim.faultLog.length);

  function kindLabel(k: FaultKind): string {
    if (k === FaultKill) return 'kill';
    if (k === FaultSlow) return 'slow';
    if (k === FaultPacketLoss) return 'loss';
    if (k === FaultPartition) return 'partition';
    return 'clear';
  }

  function kindClass(k: FaultKind, on: boolean): string {
    if (!on) return 'border-line bg-bg text-muted';
    if (k === FaultKill || k === FaultPartition) return 'border-err/60 bg-err/10 text-err';
    return 'border-warn/40 bg-warn/10 text-warn';
  }

  // Sim time is nanoseconds since sim start. Render as a stopwatch.
  function fmtSimTime(ns: number): string {
    const s = ns / 1_000_000_000;
    if (s < 60) return `${s.toFixed(1)}s`;
    const m = Math.floor(s / 60);
    const r = s - m * 60;
    return `${m}m${r.toFixed(0).padStart(2, '0')}s`;
  }

  function focusTarget(ev: FaultEvent) {
    if (ev.kind === FaultPartition) return; // edge — no inspector
    selection.set(ev.target);
    open = false;
  }
</script>

<div class="relative">
  <button
    type="button"
    onclick={() => (open = !open)}
    aria-expanded={open}
    aria-label="Chaos timeline: {count} events"
    class="flex items-center gap-1 rounded border px-2 py-1 text-[11px]
           transition-colors hover:border-accent
           focus-visible:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent
           {count > 0
             ? 'border-err/40 bg-err/10 text-err'
             : 'border-line bg-bg text-muted'}"
  >
    <Zap class="h-3 w-3" aria-hidden="true" />
    <span class="font-mono">chaos</span>
    {#if count > 0}
      <span class="tabular-nums">{count}</span>
    {:else}
      <span>—</span>
    {/if}
  </button>

  {#if open}
    <div
      role="dialog"
      aria-label="Chaos timeline"
      class="absolute bottom-full right-0 z-40 mb-1 max-h-[60vh] w-80 overflow-y-auto rounded border border-line bg-panel shadow-xl"
    >
      <header
        class="sticky top-0 flex items-center justify-between border-b border-line bg-panel px-2 py-1.5"
      >
        <span class="font-mono text-[10px] uppercase tracking-widest text-muted">
          chaos timeline
        </span>
        <button
          type="button"
          onclick={() => (open = false)}
          aria-label="Close chaos timeline"
          class="rounded p-1 text-muted hover:text-ink
                 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <X class="h-3 w-3" aria-hidden="true" />
        </button>
      </header>

      {#if count === 0}
        <p class="px-2 py-3 text-xs text-muted">No chaos events yet.</p>
      {:else}
        <ul class="divide-y divide-line" role="list">
          {#each ordered as ev, i (ev.t + '-' + ev.target + '-' + ev.kind + '-' + ev.on + '-' + i)}
            <li class="flex items-start gap-2 p-2 text-xs">
              <span
                class="shrink-0 rounded border px-1 py-px font-mono text-[10px] uppercase {kindClass(
                  ev.kind,
                  ev.on
                )}"
              >
                {#if ev.kind === FaultKill}
                  <Skull class="inline h-3 w-3" aria-hidden="true" />
                {:else if ev.kind === FaultSlow}
                  <Snail class="inline h-3 w-3" aria-hidden="true" />
                {:else if ev.kind === FaultPacketLoss}
                  <ShieldOff class="inline h-3 w-3" aria-hidden="true" />
                {:else if ev.kind === FaultPartition}
                  <Scissors class="inline h-3 w-3" aria-hidden="true" />
                {/if}
                {kindLabel(ev.kind)}
              </span>
              <div class="min-w-0 flex-1">
                <div class="flex items-baseline gap-1.5">
                  <span class="font-mono tabular-nums text-muted">
                    {fmtSimTime(ev.t)}
                  </span>
                  <span class="text-ink">{ev.on ? 'engaged' : 'cleared'}</span>
                </div>
                {#if ev.kind === FaultPartition}
                  <p class="mt-0.5 truncate font-mono text-[11px] text-muted">{ev.target}</p>
                {:else}
                  <button
                    type="button"
                    onclick={() => focusTarget(ev)}
                    class="mt-0.5 truncate font-mono text-[11px] text-muted underline-offset-2 hover:text-accent hover:underline
                           focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  >
                    {ev.target}
                  </button>
                {/if}
              </div>
            </li>
          {/each}
        </ul>
      {/if}
    </div>
  {/if}
</div>
