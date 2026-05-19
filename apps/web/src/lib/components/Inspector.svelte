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
  import NumberField from './NumberField.svelte';
  import SelectField, { type SelectOption } from './SelectField.svelte';
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

  // Load-balancer strategy options. Stored as camelCase (matches sim
  // engine + LBStrategy type) but rendered with human-readable labels.
  const STRATEGY_OPTIONS: SelectOption[] = [
    { value: 'roundRobin', label: 'Round-robin' },
    { value: 'leastInFlight', label: 'Least in-flight' },
    { value: 'random', label: 'Random' }
  ];

  // Editor surfaces mean/std in milliseconds for sanity; the sim engine
  // stores nanoseconds. Convert on read + write.
  const NS_PER_MS = 1_000_000;
  function nsToMs(ns: number | undefined): number {
    return ns ? +(ns / NS_PER_MS).toFixed(3) : 0;
  }
  function msToNs(ms: number): number {
    return Math.max(0, Math.round(ms * NS_PER_MS));
  }
  function pctToFrac(pct: number): number {
    return Math.max(0, Math.min(1, pct / 100));
  }
  function fracToPct(f: number | undefined): number {
    return f === undefined ? 0 : Math.round(f * 100);
  }
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
            <div class="mt-1">
              <NumberField
                id="prop-rps-{selected.id}"
                name="rps"
                value={selected.data.props.rps ?? 100}
                min={0}
                step={10}
                suffix="rps"
                ariaLabel="requests per second"
                oninput={(e) => setProp('rps', +e.currentTarget.value)}
              />
            </div>
          </div>
        {/if}

        {#if engineKind === 'service' || engineKind === 'database'}
          <div>
            <Hint term="capacity" />
            <div class="mt-1">
              <NumberField
                id="prop-capacity-{selected.id}"
                name="capacity"
                value={selected.data.props.capacity ?? 50}
                min={1}
                suffix="slots"
                ariaLabel="capacity"
                oninput={(e) => setProp('capacity', +e.currentTarget.value)}
              />
            </div>
          </div>
          <div>
            <Hint term="queueLimit" />
            <div class="mt-1">
              <NumberField
                id="prop-queue-{selected.id}"
                name="queueLimit"
                value={selected.data.props.queueLimit ?? 500}
                min={0}
                suffix="slots"
                ariaLabel="queue limit"
                oninput={(e) => setProp('queueLimit', +e.currentTarget.value)}
              />
            </div>
          </div>
          <div class="grid grid-cols-2 gap-2">
            <div>
              <Hint term="meanNs" />
              <div class="mt-1">
                <NumberField
                  id="prop-mean-{selected.id}"
                  name="meanMs"
                  value={nsToMs(selected.data.props.meanNs)}
                  min={0}
                  step={0.1}
                  suffix="ms"
                  ariaLabel="mean latency in milliseconds"
                  oninput={(e) => setProp('meanNs', msToNs(+e.currentTarget.value))}
                />
              </div>
            </div>
            <div>
              <Hint term="stdNs" />
              <div class="mt-1">
                <NumberField
                  id="prop-std-{selected.id}"
                  name="stdMs"
                  value={nsToMs(selected.data.props.stdNs)}
                  min={0}
                  step={0.1}
                  suffix="ms"
                  ariaLabel="latency std deviation in milliseconds"
                  oninput={(e) => setProp('stdNs', msToNs(+e.currentTarget.value))}
                />
              </div>
            </div>
          </div>
        {/if}

        {#if engineKind === 'cache'}
          <div>
            <Hint term="hitRate" />
            <div class="mt-1">
              <NumberField
                id="prop-hit-{selected.id}"
                name="hitRatePct"
                value={fracToPct(selected.data.props.hitRate ?? 0.8)}
                min={0}
                max={100}
                step={1}
                suffix="%"
                ariaLabel="hit rate percent"
                oninput={(e) => setProp('hitRate', pctToFrac(+e.currentTarget.value))}
              />
            </div>
          </div>
          <div>
            <Hint term="capacity" />
            <div class="mt-1">
              <NumberField
                id="prop-capacity-{selected.id}"
                name="capacity"
                value={selected.data.props.capacity ?? 1000}
                min={1}
                suffix="keys"
                ariaLabel="cache capacity"
                oninput={(e) => setProp('capacity', +e.currentTarget.value)}
              />
            </div>
          </div>
        {/if}

        {#if engineKind === 'loadbalancer'}
          <div>
            <Hint term="strategy" />
            <div class="mt-1">
              <SelectField
                id="prop-strategy-{selected.id}"
                name="strategy"
                value={selected.data.props.strategy ?? 'roundRobin'}
                options={STRATEGY_OPTIONS}
                ariaLabel="load-balancer strategy"
                onchange={(e) =>
                  setProp('strategy', e.currentTarget.value as LBStrategy)}
              />
            </div>
          </div>
        {/if}

        {#if engineKind === 'queue'}
          <div>
            <Hint term="drainRPS" />
            <div class="mt-1">
              <NumberField
                id="prop-drain-{selected.id}"
                name="drainRPS"
                value={selected.data.props.drainRPS ?? 100}
                min={0}
                step={10}
                suffix="rps"
                ariaLabel="drain rate"
                oninput={(e) => setProp('drainRPS', +e.currentTarget.value)}
              />
            </div>
          </div>
          <div>
            <Hint term="maxQueueSize" />
            <div class="mt-1">
              <NumberField
                id="prop-max-{selected.id}"
                name="max"
                value={selected.data.props.max ?? 10000}
                min={1}
                step={1000}
                suffix="msgs"
                ariaLabel="max queue size"
                oninput={(e) => setProp('max', +e.currentTarget.value)}
              />
            </div>
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
            <div class="mt-1">
              <NumberField
                id="prop-fault-dur-{selected.id}"
                name="autoClearSec"
                value={faultDurationSec}
                min={0}
                step={1}
                suffix="s"
                placeholder="0 = manual"
                ariaLabel="auto-clear duration in seconds"
                oninput={(e) => (faultDurationSec = +e.currentTarget.value)}
              />
            </div>
          </div>
          <Tooltip content={GLOSSARY.clearFault.full} side="top">
            {#snippet children(id)}
              <button
                type="button"
                onclick={clearActiveFault}
                disabled={activeFault === FaultNone}
                aria-label="Clear active fault"
                aria-describedby={id}
                class="flex h-[34px] items-center gap-1 rounded border border-line bg-bg px-2.5 text-xs
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
