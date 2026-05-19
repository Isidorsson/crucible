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

  // Editable/scrubbable rps field. The field lifts into edit mode on click
  // or focus; drag (or arrow keys) scrubs by the current decade so the
  // step matches the magnitude — dragging at 1k tunes by 100, dragging at
  // 10 tunes by 1.
  let editing = $state(false);
  let editValue = $state('');
  let editInput = $state<HTMLInputElement | null>(null);

  function setRps(v: number) {
    const clamped = Math.max(1, Math.min(1_000_000, Math.round(v)));
    if (clamped === globalRps) return;
    globalRps = clamped;
  }

  function beginEdit() {
    editValue = String(globalRps);
    editing = true;
    queueMicrotask(() => {
      editInput?.focus();
      editInput?.select();
    });
  }

  function commitEdit() {
    const parsed = Number(editValue.replace(/[, _]/g, ''));
    if (Number.isFinite(parsed) && parsed > 0) setRps(parsed);
    editing = false;
  }

  function onEditKey(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault();
      commitEdit();
      return;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      editing = false;
      return;
    }
  }

  // Pointer-scrub: drag the number left/right to change. Step scales with
  // the current decade so the drag feel stays consistent across the log
  // range — Figma/Blender-style.
  let scrubStartX = 0;
  let scrubStartVal = 0;
  function onScrubDown(e: PointerEvent) {
    if (editing) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    scrubStartX = e.clientX;
    scrubStartVal = globalRps;
  }
  function onScrubMove(e: PointerEvent) {
    if (editing) return;
    const el = e.currentTarget as HTMLElement;
    if (!el.hasPointerCapture(e.pointerId)) return;
    const dx = e.clientX - scrubStartX;
    if (Math.abs(dx) < 2) return;
    // Step = 10% of starting decade, e.g. start at 100 → step 10/px.
    const decade = Math.pow(10, Math.floor(Math.log10(Math.max(1, scrubStartVal))));
    const step = Math.max(1, decade / 10);
    // 2 px per step keeps the scrub feeling controlled, not skittish.
    setRps(scrubStartVal + Math.round(dx / 2) * step);
  }
  function onScrubUp(e: PointerEvent) {
    const el = e.currentTarget as HTMLElement;
    if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
  }

  function onScrubKey(e: KeyboardEvent) {
    if (editing) return;
    const decade = Math.pow(10, Math.floor(Math.log10(Math.max(1, globalRps))));
    const fine = Math.max(1, decade / 10);
    const coarse = decade;
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
      e.preventDefault();
      setRps(globalRps + (e.shiftKey ? coarse : fine));
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
      e.preventDefault();
      setRps(globalRps - (e.shiftKey ? coarse : fine));
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      beginEdit();
    }
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

    <!--
      Scrubbable + editable rps. Drag horizontally, arrow-key, or click to
      type. Step auto-scales with the current decade so the feel stays
      uniform across the log range.
    -->
    <Tooltip
      content="Click to type, drag horizontally to scrub, or use arrow keys (Shift = ×10 step)."
      side="bottom"
    >
      {#snippet children(tipId)}
        {#if editing}
          <label class="sr-only" for="rps-edit">Global RPS</label>
          <input
            id="rps-edit"
            name="rps-scale"
            bind:this={editInput}
            bind:value={editValue}
            onblur={commitEdit}
            onkeydown={onEditKey}
            type="number"
            inputmode="numeric"
            min="1"
            max="1000000"
            autocomplete="off"
            spellcheck="false"
            aria-label="Type global rps"
            aria-describedby={tipId}
            class="w-20 rounded border border-accent bg-bg px-1.5 py-1 text-right font-mono text-[11px]
                   tabular-nums text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          />
        {:else}
          <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
          <span
            role="spinbutton"
            tabindex="0"
            aria-label="Custom rps"
            aria-describedby={tipId}
            aria-valuemin="1"
            aria-valuemax="1000000"
            aria-valuenow={globalRps}
            aria-valuetext="{numberFmt.format(globalRps)} requests per second"
            onpointerdown={onScrubDown}
            onpointermove={onScrubMove}
            onpointerup={onScrubUp}
            onpointercancel={onScrubUp}
            onkeydown={onScrubKey}
            ondblclick={beginEdit}
            onclick={beginEdit}
            class="crucible-scrub min-w-[3.5rem] rounded border border-line bg-bg px-2 py-1 text-right
                   font-mono text-[11px] tabular-nums text-ink hover:border-accent
                   focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            {numberFmt.format(globalRps)}<span class="ml-1 text-[9px] text-muted">rps</span>
          </span>
        {/if}
      {/snippet}
    </Tooltip>
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

<style>
  /* Scrubbable rps value: ew-resize cursor on hover hints the drag, and
     touch-action:none lets us own horizontal pointer gestures without
     fighting the page from panning underneath on touch devices. */
  .crucible-scrub {
    cursor: ew-resize;
    user-select: none;
    touch-action: none;
  }
  .crucible-scrub:active {
    cursor: grabbing;
  }
</style>
