<script lang="ts">
  import { CATEGORIES, CATALOG_BY_CATEGORY } from '$lib/types/catalog';
  import type { NodeKind } from '$lib/types/topology';

  // Mini-palette shown when a connection drag drops on empty pane.
  // Inspired by n8n/Figma where releasing an edge in empty space opens
  // a quick-create menu so you wire up a flow in a single gesture.
  let {
    x,
    y,
    onPick,
    onClose
  }: {
    x: number;
    y: number;
    onPick: (kind: NodeKind) => void;
    onClose: () => void;
  } = $props();

  let query = $state('');
  let listEl = $state<HTMLUListElement | null>(null);
  let inputEl = $state<HTMLInputElement | null>(null);
  let activeIndex = $state(0);

  const q = $derived(query.trim().toLowerCase());
  const matches = $derived(
    CATEGORIES.flatMap((cat) =>
      CATALOG_BY_CATEGORY[cat.id]
        .filter(
          (e) => !q || e.label.toLowerCase().includes(q) || e.description.toLowerCase().includes(q)
        )
        .map((entry) => ({ entry, catLabel: cat.label }))
    )
  );

  $effect(() => {
    // Reset highlight when results shrink.
    if (activeIndex >= matches.length) activeIndex = 0;
  });

  $effect(() => {
    inputEl?.focus();
  });

  function pick(kind: NodeKind) {
    onPick(kind);
  }

  function onKey(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      activeIndex = Math.min(activeIndex + 1, matches.length - 1);
      scrollActive();
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      activeIndex = Math.max(activeIndex - 1, 0);
      scrollActive();
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      const m = matches[activeIndex];
      if (m) pick(m.entry.kind);
    }
  }

  function scrollActive() {
    queueMicrotask(() => {
      const el = listEl?.children[activeIndex] as HTMLElement | undefined;
      el?.scrollIntoView({ block: 'nearest' });
    });
  }

  // Click-outside / scroll-away closes the popover. Mirrors the pattern in
  // ContextMenu so behavior feels identical for users.
  function onWindowPointer(e: PointerEvent) {
    const root = (e.target as HTMLElement | null)?.closest?.('[data-connect-popover]');
    if (!root) onClose();
  }
</script>

<svelte:window onpointerdown={onWindowPointer} />

<div
  data-connect-popover
  class="fixed z-50 w-64 overflow-hidden rounded-lg border border-line bg-panel shadow-2xl ring-1 ring-line"
  style="left: {x}px; top: {y}px;"
  role="dialog"
  aria-label="Connect to new component"
>
  <div class="border-b border-line p-2">
    <input
      bind:this={inputEl}
      bind:value={query}
      onkeydown={onKey}
      type="search"
      placeholder="Connect to…"
      autocomplete="off"
      spellcheck="false"
      class="w-full rounded border border-line bg-bg px-2 py-1.5 font-mono text-xs
             placeholder:text-muted
             focus-visible:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
    />
  </div>

  {#if matches.length === 0}
    <p class="px-3 py-4 text-xs text-muted" aria-live="polite">
      No match for &ldquo;{query}&rdquo;.
    </p>
  {:else}
    <ul
      bind:this={listEl}
      role="listbox"
      aria-label="Component options"
      class="max-h-72 overflow-y-auto p-1"
    >
      {#each matches as m, i (m.entry.kind)}
        <li>
          <button
            type="button"
            role="option"
            aria-selected={i === activeIndex}
            onpointerdown={(e) => {
              // Avoid the window listener closing us before click fires.
              e.stopPropagation();
            }}
            onclick={() => pick(m.entry.kind)}
            onmouseenter={() => (activeIndex = i)}
            class="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left font-mono text-xs
                   text-ink transition-colors
                   {i === activeIndex ? 'bg-bg ring-1 ring-accent' : 'hover:bg-bg'}"
          >
            <m.entry.icon class="h-3.5 w-3.5 shrink-0 text-accent" aria-hidden="true" />
            <span class="truncate">{m.entry.label}</span>
            <span class="ml-auto text-[10px] uppercase tracking-wider text-muted">
              {m.catLabel}
            </span>
          </button>
        </li>
      {/each}
    </ul>
  {/if}

  <p class="border-t border-line px-3 py-1.5 text-[10px] text-muted">
    <kbd class="rounded border border-line bg-bg px-1">↑↓</kbd> nav ·
    <kbd class="rounded border border-line bg-bg px-1">Enter</kbd> pick ·
    <kbd class="rounded border border-line bg-bg px-1">Esc</kbd> close
  </p>
</div>
