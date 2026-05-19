<script lang="ts">
  import { Zap, Skull, Snail, ShieldOff } from '@lucide/svelte';
  import type { Node } from '@xyflow/svelte';
  import type { CrucibleNodeData } from '$lib/stores/design.svelte';
  import { design } from '$lib/stores/design.svelte';
  import { sim } from '$lib/stores/sim.svelte';
  import {
    FaultKill,
    FaultSlow,
    FaultPacketLoss,
    FaultNone,
    type FaultKind
  } from '$lib/types/topology';
  import { CATALOG_BY_KIND } from '$lib/types/catalog';

  let { selected }: { selected: Node<CrucibleNodeData> | null } = $props();
  const entry = $derived(selected ? CATALOG_BY_KIND[selected.data.kind] : null);
  const metrics = $derived(selected ? sim.metricsByNode[selected.id] : undefined);

  function setFault(kind: FaultKind) {
    if (!selected) return;
    const currentlyOn = metrics?.faulted ?? false;
    const turningOn = !currentlyOn;
    sim.injectFault(selected.id, turningOn ? kind : FaultNone, turningOn);
  }

  function setProp(key: string, value: number) {
    if (!selected) return;
    design.updateNodeProps(selected.id, { [key]: value });
    if (key === 'rps') sim.setRPS(selected.id, value);
  }

  const faultButtonClasses =
    'flex min-h-11 flex-col items-center justify-center gap-1 rounded border border-line bg-bg p-2 ' +
    'transition-colors focus-visible:ring-2 focus-visible:ring-accent';
</script>

<aside
  class="w-72 shrink-0 border-l border-line bg-panel overflow-y-auto"
  aria-labelledby="inspector-heading"
>
  <h2
    id="inspector-heading"
    class="border-b border-line px-3 py-2 text-xs font-semibold uppercase tracking-widest text-muted"
  >
    Inspector
  </h2>

  {#if !selected || !entry}
    <p class="p-3 text-sm text-muted">Select a node to inspect.</p>
  {:else}
    <div class="space-y-4 p-3 text-xs">
      <div class="flex items-center gap-2">
        <entry.icon class="h-4 w-4 text-accent" aria-hidden="true" />
        <span class="font-mono text-ink">{entry.label}</span>
        <span class="ml-auto font-mono text-muted" translate="no">{selected.id}</span>
      </div>

      <div class="space-y-2">
        {#if selected.data.kind === 'source'}
          <label class="block">
            <span class="text-muted">rps</span>
            <input
              id="prop-rps-{selected.id}"
              name="rps"
              type="number"
              inputmode="numeric"
              autocomplete="off"
              spellcheck="false"
              min="0"
              step="10"
              value={selected.data.props.rps ?? 100}
              oninput={(e) => setProp('rps', +(e.target as HTMLInputElement).value)}
              class="mt-1 w-full rounded border border-line bg-bg px-2 py-1 font-mono
                     focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent"
            />
          </label>
        {/if}
        {#if selected.data.kind === 'service' || selected.data.kind === 'database'}
          <label class="block">
            <span class="text-muted">capacity</span>
            <input
              id="prop-capacity-{selected.id}"
              name="capacity"
              type="number"
              inputmode="numeric"
              autocomplete="off"
              spellcheck="false"
              min="1"
              value={selected.data.props.capacity ?? 50}
              oninput={(e) => setProp('capacity', +(e.target as HTMLInputElement).value)}
              class="mt-1 w-full rounded border border-line bg-bg px-2 py-1 font-mono
                     focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent"
            />
          </label>
          <label class="block">
            <span class="text-muted">queue limit</span>
            <input
              id="prop-queue-{selected.id}"
              name="queueLimit"
              type="number"
              inputmode="numeric"
              autocomplete="off"
              spellcheck="false"
              min="0"
              value={selected.data.props.queueLimit ?? 500}
              oninput={(e) => setProp('queueLimit', +(e.target as HTMLInputElement).value)}
              class="mt-1 w-full rounded border border-line bg-bg px-2 py-1 font-mono
                     focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent"
            />
          </label>
        {/if}
        {#if selected.data.kind === 'cache'}
          <label class="block">
            <span class="text-muted">hit rate</span>
            <input
              id="prop-hit-{selected.id}"
              name="hitRate"
              type="number"
              inputmode="decimal"
              autocomplete="off"
              spellcheck="false"
              min="0"
              max="1"
              step="0.05"
              value={selected.data.props.hitRate ?? 0.8}
              oninput={(e) => setProp('hitRate', +(e.target as HTMLInputElement).value)}
              class="mt-1 w-full rounded border border-line bg-bg px-2 py-1 font-mono
                     focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent"
            />
          </label>
        {/if}
      </div>

      <section aria-labelledby="chaos-heading">
        <h3 id="chaos-heading" class="mb-1 text-muted">Chaos</h3>
        <div class="grid grid-cols-3 gap-1">
          <button
            type="button"
            aria-pressed={metrics?.faulted ?? false}
            aria-describedby="chaos-kill-desc"
            onclick={() => setFault(FaultKill)}
            class="{faultButtonClasses} hover:border-err"
          >
            <Skull class="h-4 w-4 text-err" aria-hidden="true" />
            <span>kill</span>
          </button>
          <button
            type="button"
            aria-pressed={metrics?.faulted ?? false}
            aria-describedby="chaos-slow-desc"
            onclick={() => setFault(FaultSlow)}
            class="{faultButtonClasses} hover:border-warn"
          >
            <Snail class="h-4 w-4 text-warn" aria-hidden="true" />
            <span>slow</span>
          </button>
          <button
            type="button"
            aria-pressed={metrics?.faulted ?? false}
            aria-describedby="chaos-loss-desc"
            onclick={() => setFault(FaultPacketLoss)}
            class="{faultButtonClasses} hover:border-warn"
          >
            <ShieldOff class="h-4 w-4 text-warn" aria-hidden="true" />
            <span>loss</span>
          </button>
        </div>
        <p id="chaos-kill-desc" class="sr-only">Crash the node — drops all requests.</p>
        <p id="chaos-slow-desc" class="sr-only">Multiplies service time by ten.</p>
        <p id="chaos-loss-desc" class="sr-only">Randomly drops half of incoming requests.</p>

        <div class="mt-2" aria-live="polite">
          {#if metrics?.faulted}
            <div class="flex items-center gap-1.5 text-err">
              <Zap class="h-3.5 w-3.5" aria-hidden="true" /> faulted
            </div>
          {/if}
        </div>
      </section>
    </div>
  {/if}
</aside>

<style>
  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }
</style>
