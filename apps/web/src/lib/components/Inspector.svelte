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
</script>

<aside class="w-72 shrink-0 border-l border-line bg-panel">
  <div class="border-b border-line px-3 py-2 text-xs uppercase tracking-widest text-muted">
    Inspector
  </div>

  {#if !selected || !entry}
    <div class="p-3 text-sm text-muted">Select a node to inspect.</div>
  {:else}
    <div class="space-y-3 p-3 text-xs">
      <div class="flex items-center gap-2">
        <entry.icon class="h-4 w-4 text-accent" />
        <span class="font-mono text-ink">{entry.label}</span>
        <span class="ml-auto font-mono text-muted">{selected.id}</span>
      </div>

      <div class="space-y-2">
        {#if selected.data.kind === 'source'}
          <label class="block">
            <span class="text-muted">rps</span>
            <input
              type="number"
              min="0"
              step="10"
              value={selected.data.props.rps ?? 100}
              oninput={(e) => setProp('rps', +(e.target as HTMLInputElement).value)}
              class="mt-1 w-full rounded border border-line bg-bg px-2 py-1 font-mono"
            />
          </label>
        {/if}
        {#if selected.data.kind === 'service' || selected.data.kind === 'database'}
          <label class="block">
            <span class="text-muted">capacity</span>
            <input
              type="number"
              min="1"
              value={selected.data.props.capacity ?? 50}
              oninput={(e) => setProp('capacity', +(e.target as HTMLInputElement).value)}
              class="mt-1 w-full rounded border border-line bg-bg px-2 py-1 font-mono"
            />
          </label>
          <label class="block">
            <span class="text-muted">queue limit</span>
            <input
              type="number"
              min="0"
              value={selected.data.props.queueLimit ?? 500}
              oninput={(e) => setProp('queueLimit', +(e.target as HTMLInputElement).value)}
              class="mt-1 w-full rounded border border-line bg-bg px-2 py-1 font-mono"
            />
          </label>
        {/if}
        {#if selected.data.kind === 'cache'}
          <label class="block">
            <span class="text-muted">hit rate</span>
            <input
              type="number"
              min="0"
              max="1"
              step="0.05"
              value={selected.data.props.hitRate ?? 0.8}
              oninput={(e) => setProp('hitRate', +(e.target as HTMLInputElement).value)}
              class="mt-1 w-full rounded border border-line bg-bg px-2 py-1 font-mono"
            />
          </label>
        {/if}
      </div>

      <div>
        <div class="mb-1 text-muted">Chaos</div>
        <div class="grid grid-cols-3 gap-1">
          <button
            onclick={() => setFault(FaultKill)}
            class="flex flex-col items-center gap-1 rounded border border-line bg-bg p-2 hover:border-err"
            title="Crash the node"
          >
            <Skull class="h-4 w-4 text-err" />
            <span>kill</span>
          </button>
          <button
            onclick={() => setFault(FaultSlow)}
            class="flex flex-col items-center gap-1 rounded border border-line bg-bg p-2 hover:border-warn"
            title="10x service time"
          >
            <Snail class="h-4 w-4 text-warn" />
            <span>slow</span>
          </button>
          <button
            onclick={() => setFault(FaultPacketLoss)}
            class="flex flex-col items-center gap-1 rounded border border-line bg-bg p-2 hover:border-warn"
            title="Drop 50% of requests"
          >
            <ShieldOff class="h-4 w-4 text-warn" />
            <span>loss</span>
          </button>
        </div>
        {#if metrics?.faulted}
          <div class="mt-2 flex items-center gap-1.5 text-err">
            <Zap class="h-3.5 w-3.5" /> faulted
          </div>
        {/if}
      </div>
    </div>
  {/if}
</aside>
