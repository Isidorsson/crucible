<script lang="ts">
  import { NODE_CATALOG } from '$lib/types/catalog';
  import type { NodeKind } from '$lib/types/topology';
  import { design } from '$lib/stores/design.svelte';

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
</script>

<aside class="w-56 shrink-0 border-r border-line bg-panel" aria-labelledby="palette-heading">
  <h2
    id="palette-heading"
    class="border-b border-line px-3 py-2 text-xs font-semibold uppercase tracking-widest text-muted"
  >
    Components
  </h2>
  <ul class="space-y-1 p-2" role="list">
    {#each NODE_CATALOG as entry}
      <li>
        <button
          type="button"
          draggable="true"
          ondragstart={(e) => onDragStart(e, entry.kind)}
          onclick={() => insertAtCenter(entry.kind)}
          onkeydown={(e) => onKeydown(e, entry.kind)}
          aria-label="Insert {entry.label} — {entry.description}"
          class="group flex w-full cursor-grab items-center gap-2 rounded border border-line bg-bg
                 px-2.5 py-2 text-left text-sm transition-colors
                 hover:border-accent hover:bg-panel
                 focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent
                 active:cursor-grabbing"
        >
          <entry.icon class="h-4 w-4 text-accent" aria-hidden="true" />
          <span class="text-ink">{entry.label}</span>
        </button>
      </li>
    {/each}
  </ul>
  <p class="px-3 py-2 text-[10px] leading-snug text-muted">
    Drag onto the canvas, or press <kbd class="rounded border border-line bg-bg px-1">Enter</kbd> to insert.
  </p>
</aside>
