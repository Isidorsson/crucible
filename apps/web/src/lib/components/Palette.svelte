<script lang="ts">
  import { CATEGORIES, CATALOG_BY_CATEGORY } from '$lib/types/catalog';
  import type { NodeKind } from '$lib/types/topology';
  import { design } from '$lib/stores/design.svelte';
  import { ChevronRight } from '@lucide/svelte';

  function onDragStart(e: DragEvent, kind: NodeKind) {
    if (!e.dataTransfer) return;
    e.dataTransfer.setData('application/crucible-kind', kind);
    e.dataTransfer.effectAllowed = 'move';
  }

  // Keyboard fallback for mouseless users: Enter/Space inserts the
  // component at canvas center (approximated as a fixed offset that
  // Svelte Flow will then fitView around).
  function insertAtCenter(kind: NodeKind) {
    design.addNode(kind, { x: 240, y: 160 });
  }

  function onKeydown(e: KeyboardEvent, kind: NodeKind) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      insertAtCenter(kind);
    }
  }

  // Search filter. Empty string = all items shown.
  let query = $state('');
  const q = $derived(query.trim().toLowerCase());

  // Precompute filtered groups once per query change instead of re-filtering
  // inside the template + again for the empty-state check.
  const filtered = $derived(
    CATEGORIES.map((cat) => ({
      cat,
      items: CATALOG_BY_CATEGORY[cat.id].filter(
        (e) =>
          !q || e.label.toLowerCase().includes(q) || e.description.toLowerCase().includes(q)
      )
    }))
  );
  const totalMatches = $derived(filtered.reduce((sum, g) => sum + g.items.length, 0));
</script>

<aside
  class="flex w-60 shrink-0 flex-col border-r border-line bg-panel"
  aria-labelledby="palette-heading"
>
  <h2
    id="palette-heading"
    class="border-b border-line px-3 py-2 text-xs font-semibold uppercase tracking-widest text-muted"
  >
    Components
  </h2>

  <div class="border-b border-line p-2">
    <label class="block">
      <span class="sr-only">Filter components</span>
      <input
        type="search"
        bind:value={query}
        placeholder="Filter, e.g. redis…"
        autocomplete="off"
        spellcheck="false"
        class="w-full rounded border border-line bg-bg px-2 py-1.5 text-xs
               placeholder:text-muted
               focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent"
      />
    </label>
  </div>

  <div class="flex-1 overflow-y-auto p-2">
    {#each filtered as group (group.cat.id)}
      {#if group.items.length > 0}
        <details
          open
          class="group mb-2 rounded border border-line bg-bg"
          aria-label={group.cat.label}
        >
          <summary
            class="flex cursor-pointer list-none items-center gap-1.5 rounded px-2 py-1.5 text-xs
                   font-semibold uppercase tracking-wider text-muted
                   hover:text-ink
                   focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <ChevronRight
              class="h-3 w-3 transition-transform group-open:rotate-90"
              aria-hidden="true"
            />
            <span>{group.cat.label}</span>
            <span class="ml-auto font-mono text-[10px] text-muted tabular-nums">
              {group.items.length}
            </span>
          </summary>
          <ul class="space-y-1 border-t border-line p-1.5" role="list">
            {#each group.items as entry (entry.kind)}
              <li>
                <button
                  type="button"
                  draggable="true"
                  ondragstart={(e) => onDragStart(e, entry.kind)}
                  onclick={() => insertAtCenter(entry.kind)}
                  onkeydown={(e) => onKeydown(e, entry.kind)}
                  title={entry.description}
                  aria-label="Insert {entry.label} — {entry.description}"
                  class="group/item flex w-full cursor-grab items-center gap-2 rounded border border-transparent
                         bg-panel px-2 py-1.5 text-left text-xs transition-colors
                         hover:border-accent hover:bg-bg
                         focus-visible:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent
                         active:cursor-grabbing"
                >
                  <entry.icon class="h-3.5 w-3.5 shrink-0 text-accent" aria-hidden="true" />
                  <span class="truncate text-ink">{entry.label}</span>
                </button>
              </li>
            {/each}
          </ul>
        </details>
      {/if}
    {/each}

    {#if q && totalMatches === 0}
      <p class="px-2 py-3 text-xs text-muted" aria-live="polite">
        No components match &ldquo;{query}&rdquo;.
      </p>
    {/if}
  </div>

  <p class="border-t border-line px-3 py-2 text-[10px] leading-snug text-muted">
    Drag onto canvas, or press <kbd class="rounded border border-line bg-bg px-1">Enter</kbd> to insert.
  </p>
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
  /* Hide native disclosure marker (Safari, Firefox). */
  summary::-webkit-details-marker {
    display: none;
  }
  summary {
    list-style: none;
  }
</style>
