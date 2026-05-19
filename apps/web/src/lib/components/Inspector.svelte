<script lang="ts">
  import { Zap, Skull, Snail, ShieldOff, Copy, RotateCcw, Trash2, X } from '@lucide/svelte';
  import type { Node } from '@xyflow/svelte';
  import type { CrucibleNodeData } from '$lib/stores/design.svelte';
  import { design } from '$lib/stores/design.svelte';
  import { sim } from '$lib/stores/sim.svelte';
  import {
    FaultKill,
    FaultSlow,
    FaultPacketLoss,
    FaultNone,
    type FaultKind,
    type LBStrategy,
    type NodeProps
  } from '$lib/types/topology';
  import { CATALOG_BY_KIND } from '$lib/types/catalog';
  import Hint from './Hint.svelte';
  import Tooltip from './Tooltip.svelte';
  import { GLOSSARY } from './glossary';

  let {
    selected,
    onSelect
  }: {
    selected: Node<CrucibleNodeData> | null;
    onSelect: (id: string | null) => void;
  } = $props();

  const entry = $derived(selected ? CATALOG_BY_KIND[selected.data.kind] : null);
  const engineKind = $derived(entry?.engineKind);
  const metrics = $derived(selected ? sim.metricsByNode[selected.id] : undefined);
  const activeFault = $derived<FaultKind>(
    selected ? (sim.activeFaultByNode[selected.id] ?? FaultNone) : FaultNone
  );

  // Auto-clear duration (seconds). 0 = manual clear, otherwise pass through
  // to sim.injectFaultFor so the worker schedules the revert.
  let faultDurationSec = $state(0);

  function setProp<K extends keyof NodeProps>(key: K, value: NodeProps[K]) {
    if (!selected) return;
    design.updateNodeProps(selected.id, { [key]: value });
    if (key === 'rps' && typeof value === 'number') sim.setRPS(selected.id, value);
  }

  function applyFault(kind: FaultKind) {
    if (!selected) return;
    // Re-clicking the active button clears it. Otherwise inject (or swap).
    if (activeFault === kind) {
      sim.clearFault(selected.id);
      return;
    }
    if (faultDurationSec > 0) {
      sim.injectFaultFor(selected.id, kind, faultDurationSec * 1000);
    } else {
      sim.setFault(selected.id, kind);
    }
  }

  function clearActiveFault() {
    if (selected) sim.clearFault(selected.id);
  }

  function duplicateNode() {
    if (!selected) return;
    const id = design.duplicateNode(selected.id);
    if (id) onSelect(id);
  }

  function resetProps() {
    if (!selected || !entry) return;
    design.updateNodeProps(selected.id, { ...entry.defaults });
    if (engineKind === 'source' && entry.defaults.rps !== undefined) {
      sim.setRPS(selected.id, entry.defaults.rps);
    }
  }

  function deleteNode() {
    if (!selected) return;
    sim.clearFault(selected.id);
    design.removeNode(selected.id);
    onSelect(null);
  }

  // ── live-metrics formatting ────────────────────────────────────────────
  function fmtLatency(ns: number): string {
    if (!ns) return '—';
    if (ns < 1_000) return `${ns}ns`;
    if (ns < 1_000_000) return `${(ns / 1_000).toFixed(1)}µs`;
    if (ns < 1_000_000_000) return `${(ns / 1_000_000).toFixed(1)}ms`;
    return `${(ns / 1_000_000_000).toFixed(2)}s`;
  }
  function fmtRate(rps: number): string {
    if (!rps) return '0';
    if (rps < 1_000) return rps.toFixed(0);
    if (rps < 1_000_000) return `${(rps / 1_000).toFixed(1)}k`;
    return `${(rps / 1_000_000).toFixed(1)}M`;
  }

  // Shared classes pulled into consts to keep the markup readable.
  const faultBtn =
    'flex min-h-11 flex-col items-center justify-center gap-1 rounded border bg-bg p-2 text-xs ' +
    'transition-colors focus-visible:ring-2 focus-visible:ring-accent';
  const iconBtn =
    'flex h-7 w-7 items-center justify-center rounded border border-line bg-bg text-muted ' +
    'transition-colors hover:border-accent hover:text-ink ' +
    'focus-visible:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent';
  const propInput =
    'mt-1 w-full rounded border border-line bg-bg px-2 py-1 font-mono ' +
    'focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent';
</script>

<aside
  class="w-72 shrink-0 overflow-y-auto border-l border-line bg-panel"
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
      <!-- ── header: icon + label + id + action row ───────────────────── -->
      <div class="space-y-2">
        <div class="flex items-center gap-2">
          <entry.icon class="h-4 w-4 text-accent" aria-hidden="true" />
          <Tooltip content={entry.details} side="bottom">
            {#snippet children(id)}
              <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
              <span
                tabindex="0"
                aria-describedby={id}
                class="cursor-help font-mono text-ink focus-visible:outline-none
                       focus-visible:ring-2 focus-visible:ring-accent"
              >
                {entry.label}
              </span>
            {/snippet}
          </Tooltip>
          <Tooltip
            content="Internal node id — stable across renders. Edges and the sim reference this id."
            side="left"
          >
            {#snippet children(id)}
              <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
              <span
                tabindex="0"
                aria-describedby={id}
                translate="no"
                class="ml-auto cursor-help font-mono text-muted focus-visible:outline-none
                       focus-visible:ring-2 focus-visible:ring-accent"
              >
                {selected.id}
              </span>
            {/snippet}
          </Tooltip>
        </div>

        <div class="flex items-center gap-1" role="group" aria-label="Node actions">
          <Tooltip content={GLOSSARY.duplicate.full} side="bottom">
            {#snippet children(id)}
              <button
                type="button"
                onclick={duplicateNode}
                aria-label="Duplicate node"
                aria-describedby={id}
                class={iconBtn}
              >
                <Copy class="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            {/snippet}
          </Tooltip>
          <Tooltip content={GLOSSARY.resetProps.full} side="bottom">
            {#snippet children(id)}
              <button
                type="button"
                onclick={resetProps}
                aria-label="Reset properties to defaults"
                aria-describedby={id}
                class={iconBtn}
              >
                <RotateCcw class="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            {/snippet}
          </Tooltip>
          <Tooltip content={GLOSSARY.deleteNode.full} side="bottom">
            {#snippet children(id)}
              <button
                type="button"
                onclick={deleteNode}
                aria-label="Delete node"
                aria-describedby={id}
                class="{iconBtn} hover:border-err hover:text-err"
              >
                <Trash2 class="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            {/snippet}
          </Tooltip>
        </div>
      </div>

      <!-- ── live metrics (only when sim is running for this node) ────── -->
      {#if metrics}
        <section aria-labelledby="metrics-heading" class="space-y-1">
          <h3 id="metrics-heading" class="flex items-center gap-1.5 text-muted">
            <Hint term="liveMetrics" />
            <span aria-hidden="true">metrics</span>
          </h3>
          <dl class="space-y-0.5 rounded border border-line bg-bg px-2 py-1.5">
            <div class="flex justify-between">
              <dt><Hint term="rps" /></dt>
              <dd class="tabular-nums text-ink">{fmtRate(metrics.throughput)}</dd>
            </div>
            <div class="flex justify-between">
              <dt><Hint term="p50" /></dt>
              <dd class="tabular-nums text-ink">{fmtLatency(metrics.p50)}</dd>
            </div>
            <div class="flex justify-between">
              <dt><Hint term="p99" /></dt>
              <dd class="tabular-nums text-ink">{fmtLatency(metrics.p99)}</dd>
            </div>
            <div class="flex justify-between">
              <dt><Hint term="inFlight" /></dt>
              <dd class="tabular-nums text-ink">{metrics.inFlight}</dd>
            </div>
            <div class="flex justify-between">
              <dt><Hint term="queue" /></dt>
              <dd
                class="tabular-nums {metrics.queueDepth > 0 ? 'text-warn' : 'text-ink'}"
              >
                {metrics.queueDepth}
              </dd>
            </div>
            <div class="flex justify-between">
              <dt><Hint term="errRate" /></dt>
              <dd
                class="tabular-nums {metrics.errorRate > 0 ? 'text-err' : 'text-ink'}"
              >
                {(metrics.errorRate * 100).toFixed(1)}%
              </dd>
            </div>
          </dl>
        </section>
      {/if}

      <!-- ── editable properties (per engineKind) ─────────────────────── -->
      <section aria-labelledby="props-heading" class="space-y-2">
        <h3 id="props-heading" class="text-muted">properties</h3>

        {#if engineKind === 'source'}
          <div>
            <Hint term="rps" />
            <label class="sr-only" for="prop-rps-{selected.id}">requests per second</label>
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
              class={propInput}
            />
          </div>
        {/if}

        {#if engineKind === 'service' || engineKind === 'database'}
          <div>
            <Hint term="capacity" />
            <label class="sr-only" for="prop-capacity-{selected.id}">capacity</label>
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
              class={propInput}
            />
          </div>
          <div>
            <Hint term="queueLimit" />
            <label class="sr-only" for="prop-queue-{selected.id}">queue limit</label>
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
              class={propInput}
            />
          </div>
          <div class="grid grid-cols-2 gap-2">
            <div>
              <Hint term="meanNs" />
              <label class="sr-only" for="prop-mean-{selected.id}">mean latency (ns)</label>
              <input
                id="prop-mean-{selected.id}"
                name="meanNs"
                type="number"
                inputmode="numeric"
                autocomplete="off"
                spellcheck="false"
                min="0"
                step="100000"
                value={selected.data.props.meanNs ?? 0}
                oninput={(e) => setProp('meanNs', +(e.target as HTMLInputElement).value)}
                class={propInput}
              />
            </div>
            <div>
              <Hint term="stdNs" />
              <label class="sr-only" for="prop-std-{selected.id}">std deviation (ns)</label>
              <input
                id="prop-std-{selected.id}"
                name="stdNs"
                type="number"
                inputmode="numeric"
                autocomplete="off"
                spellcheck="false"
                min="0"
                step="100000"
                value={selected.data.props.stdNs ?? 0}
                oninput={(e) => setProp('stdNs', +(e.target as HTMLInputElement).value)}
                class={propInput}
              />
            </div>
          </div>
        {/if}

        {#if engineKind === 'cache'}
          <div>
            <Hint term="hitRate" />
            <label class="sr-only" for="prop-hit-{selected.id}">hit rate</label>
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
              class={propInput}
            />
          </div>
          <div>
            <Hint term="capacity" />
            <label class="sr-only" for="prop-capacity-{selected.id}">capacity</label>
            <input
              id="prop-capacity-{selected.id}"
              name="capacity"
              type="number"
              inputmode="numeric"
              autocomplete="off"
              spellcheck="false"
              min="1"
              value={selected.data.props.capacity ?? 1000}
              oninput={(e) => setProp('capacity', +(e.target as HTMLInputElement).value)}
              class={propInput}
            />
          </div>
        {/if}

        {#if engineKind === 'loadbalancer'}
          <div>
            <Hint term="strategy" />
            <label class="sr-only" for="prop-strategy-{selected.id}">strategy</label>
            <select
              id="prop-strategy-{selected.id}"
              name="strategy"
              value={selected.data.props.strategy ?? 'roundRobin'}
              onchange={(e) =>
                setProp('strategy', (e.target as HTMLSelectElement).value as LBStrategy)}
              class={propInput}
            >
              <option value="roundRobin">roundRobin</option>
              <option value="leastInFlight">leastInFlight</option>
              <option value="random">random</option>
            </select>
          </div>
        {/if}

        {#if engineKind === 'queue'}
          <div>
            <Hint term="drainRPS" />
            <label class="sr-only" for="prop-drain-{selected.id}">drain rps</label>
            <input
              id="prop-drain-{selected.id}"
              name="drainRPS"
              type="number"
              inputmode="numeric"
              autocomplete="off"
              spellcheck="false"
              min="0"
              step="10"
              value={selected.data.props.drainRPS ?? 100}
              oninput={(e) => setProp('drainRPS', +(e.target as HTMLInputElement).value)}
              class={propInput}
            />
          </div>
          <div>
            <Hint term="maxQueueSize" />
            <label class="sr-only" for="prop-max-{selected.id}">max queue size</label>
            <input
              id="prop-max-{selected.id}"
              name="max"
              type="number"
              inputmode="numeric"
              autocomplete="off"
              spellcheck="false"
              min="1"
              step="1000"
              value={selected.data.props.max ?? 10000}
              oninput={(e) => setProp('max', +(e.target as HTMLInputElement).value)}
              class={propInput}
            />
          </div>
        {/if}
      </section>

      <!-- ── chaos ────────────────────────────────────────────────────── -->
      <section aria-labelledby="chaos-heading" class="space-y-2">
        <h3 id="chaos-heading" class="text-muted">chaos</h3>

        <div class="grid grid-cols-3 gap-1">
          <Tooltip content={GLOSSARY.faultKill.full} side="top">
            {#snippet children(id)}
              <button
                type="button"
                aria-pressed={activeFault === FaultKill}
                aria-describedby={id}
                onclick={() => applyFault(FaultKill)}
                class="{faultBtn} hover:border-err
                       {activeFault === FaultKill ? 'border-err bg-err/10 text-err' : 'border-line'}"
              >
                <Skull class="h-4 w-4 text-err" aria-hidden="true" />
                <span>kill</span>
              </button>
            {/snippet}
          </Tooltip>
          <Tooltip content={GLOSSARY.faultSlow.full} side="top">
            {#snippet children(id)}
              <button
                type="button"
                aria-pressed={activeFault === FaultSlow}
                aria-describedby={id}
                onclick={() => applyFault(FaultSlow)}
                class="{faultBtn} hover:border-warn
                       {activeFault === FaultSlow ? 'border-warn bg-warn/10 text-warn' : 'border-line'}"
              >
                <Snail class="h-4 w-4 text-warn" aria-hidden="true" />
                <span>slow</span>
              </button>
            {/snippet}
          </Tooltip>
          <Tooltip content={GLOSSARY.faultLoss.full} side="top">
            {#snippet children(id)}
              <button
                type="button"
                aria-pressed={activeFault === FaultPacketLoss}
                aria-describedby={id}
                onclick={() => applyFault(FaultPacketLoss)}
                class="{faultBtn} hover:border-warn
                       {activeFault === FaultPacketLoss ? 'border-warn bg-warn/10 text-warn' : 'border-line'}"
              >
                <ShieldOff class="h-4 w-4 text-warn" aria-hidden="true" />
                <span>loss</span>
              </button>
            {/snippet}
          </Tooltip>
        </div>

        <div class="flex items-end gap-2">
          <div class="flex-1">
            <Hint term="autoClearFault" />
            <label class="sr-only" for="prop-fault-dur-{selected.id}"
              >auto-clear duration in seconds</label
            >
            <input
              id="prop-fault-dur-{selected.id}"
              name="autoClearSec"
              type="number"
              inputmode="numeric"
              autocomplete="off"
              min="0"
              step="1"
              placeholder="0 = manual"
              bind:value={faultDurationSec}
              class={propInput}
            />
          </div>
          <Tooltip content={GLOSSARY.clearFault.full} side="top">
            {#snippet children(id)}
              <button
                type="button"
                onclick={clearActiveFault}
                disabled={activeFault === FaultNone}
                aria-label="Clear active fault"
                aria-describedby={id}
                class="flex h-[30px] items-center gap-1 rounded border border-line bg-bg px-2 text-xs
                       transition-colors hover:border-accent
                       focus-visible:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent
                       disabled:cursor-not-allowed disabled:opacity-40"
              >
                <X class="h-3.5 w-3.5" aria-hidden="true" /> clear
              </button>
            {/snippet}
          </Tooltip>
        </div>

        <div aria-live="polite" class="min-h-[1.25rem]">
          {#if activeFault !== FaultNone}
            <div class="flex items-center gap-1.5 text-err">
              <Zap class="h-3.5 w-3.5" aria-hidden="true" />
              <Hint term="activeFault" />
              <span class="font-mono">
                {activeFault === FaultKill
                  ? 'kill'
                  : activeFault === FaultSlow
                    ? 'slow'
                    : 'loss'}
              </span>
              {#if faultDurationSec > 0}
                <span class="ml-auto font-mono text-muted tabular-nums">
                  ≤ {faultDurationSec}s
                </span>
              {/if}
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
