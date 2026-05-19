<script lang="ts">
  // Editable + scrubbable numeric field. Click to type, drag horizontally
  // to scrub, arrow keys to step. The step size is supplied by the parent
  // via a callback so log-scale controls can vary granularity with the
  // current value — e.g. step by 10 around 100, step by 1k around 10k.
  //
  // Used in the toolbar for global RPS and speed; designed to scale to any
  // single-value numeric control where a slider would be too coarse and a
  // bare input wouldn't read as a "knob".

  let {
    value,
    min,
    max,
    onCommit,
    formatDisplay,
    formatEdit = (v) => String(v),
    parseEdit = (s) => Number(s.replace(/[, _]/g, '')),
    step,
    width = '4.5rem',
    label = 'value',
    tooltip = 'Click to type, drag horizontally to scrub, or use arrow keys (Shift = ×10 step).'
  }: {
    value: number;
    min: number;
    max: number;
    onCommit: (v: number) => void;
    formatDisplay: (v: number) => string;
    formatEdit?: (v: number) => string;
    parseEdit?: (s: string) => number;
    // Returns the increment to apply at the given current value. Lets
    // callers implement decade-aware steps without us hardcoding log10.
    step: (v: number) => { fine: number; coarse: number };
    width?: string;
    label?: string;
    tooltip?: string;
  } = $props();

  import Tooltip from './Tooltip.svelte';

  let editing = $state(false);
  let editValue = $state('');
  let inputEl = $state<HTMLInputElement | null>(null);

  function clamp(v: number) {
    if (!Number.isFinite(v)) return value;
    return Math.max(min, Math.min(max, v));
  }

  function commitNum(v: number) {
    const next = clamp(Math.round(v));
    if (next === value) return;
    onCommit(next);
  }

  function beginEdit() {
    editValue = formatEdit(value);
    editing = true;
    queueMicrotask(() => {
      inputEl?.focus();
      inputEl?.select();
    });
  }

  function commitEdit() {
    const parsed = parseEdit(editValue);
    if (Number.isFinite(parsed) && parsed > 0) commitNum(parsed);
    editing = false;
  }

  function onEditKey(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault();
      commitEdit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      editing = false;
    }
  }

  let scrubStartX = 0;
  let scrubStartVal = 0;
  function onScrubDown(e: PointerEvent) {
    if (editing) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    scrubStartX = e.clientX;
    scrubStartVal = value;
  }
  function onScrubMove(e: PointerEvent) {
    if (editing) return;
    const el = e.currentTarget as HTMLElement;
    if (!el.hasPointerCapture(e.pointerId)) return;
    const dx = e.clientX - scrubStartX;
    if (Math.abs(dx) < 2) return;
    const { fine } = step(scrubStartVal);
    // 2 px per fine step keeps the scrub controllable on trackpads.
    commitNum(scrubStartVal + Math.round(dx / 2) * fine);
  }
  function onScrubUp(e: PointerEvent) {
    const el = e.currentTarget as HTMLElement;
    if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
  }
  function onScrubKey(e: KeyboardEvent) {
    if (editing) return;
    const { fine, coarse } = step(value);
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
      e.preventDefault();
      commitNum(value + (e.shiftKey ? coarse : fine));
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
      e.preventDefault();
      commitNum(value - (e.shiftKey ? coarse : fine));
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      beginEdit();
    }
  }
</script>

<Tooltip content={tooltip} side="bottom">
  {#snippet children(tipId)}
    {#if editing}
      <label class="sr-only" for={`scrub-edit-${tipId}`}>{label}</label>
      <input
        id={`scrub-edit-${tipId}`}
        bind:this={inputEl}
        bind:value={editValue}
        onblur={commitEdit}
        onkeydown={onEditKey}
        type="text"
        inputmode="numeric"
        autocomplete="off"
        spellcheck="false"
        aria-label="Type {label}"
        aria-describedby={tipId}
        style="width: {width};"
        class="rounded border border-accent bg-bg px-1.5 py-1 text-right font-mono text-[11px]
               tabular-nums text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      />
    {:else}
      <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
      <span
        role="spinbutton"
        tabindex="0"
        aria-label={label}
        aria-describedby={tipId}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
        aria-valuetext={formatDisplay(value)}
        onpointerdown={onScrubDown}
        onpointermove={onScrubMove}
        onpointerup={onScrubUp}
        onpointercancel={onScrubUp}
        onkeydown={onScrubKey}
        ondblclick={beginEdit}
        onclick={beginEdit}
        style="min-width: {width};"
        class="crucible-scrub rounded border border-line bg-bg px-2 py-1 text-right
               font-mono text-[11px] tabular-nums text-ink hover:border-accent
               focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        {formatDisplay(value)}
      </span>
    {/if}
  {/snippet}
</Tooltip>

<style>
  /* ew-resize on hover hints the drag; touch-action:none lets us own the
     horizontal pointer gesture without fighting page scroll on touch. */
  :global(.crucible-scrub) {
    cursor: ew-resize;
    user-select: none;
    touch-action: none;
  }
  :global(.crucible-scrub:active) {
    cursor: grabbing;
  }
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
