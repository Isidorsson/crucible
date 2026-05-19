<script lang="ts">
  import { NODE_CATALOG } from '$lib/types/catalog';
  import type { NodeKind } from '$lib/types/topology';

  function onDragStart(e: DragEvent, kind: NodeKind) {
    if (!e.dataTransfer) return;
    e.dataTransfer.setData('application/crucible-kind', kind);
    e.dataTransfer.effectAllowed = 'move';
  }
</script>

<aside class="w-56 shrink-0 border-r border-line bg-panel">
  <div class="border-b border-line px-3 py-2 text-xs uppercase tracking-widest text-muted">
    Components
  </div>
  <div class="space-y-1 p-2">
    {#each NODE_CATALOG as entry}
      <div
        role="button"
        tabindex="0"
        draggable="true"
        ondragstart={(e) => onDragStart(e, entry.kind)}
        class="group flex cursor-grab items-center gap-2 rounded border border-line bg-bg px-2.5 py-2 text-sm
               transition hover:border-accent hover:bg-panel active:cursor-grabbing"
        title={entry.description}
      >
        <entry.icon class="h-4 w-4 text-accent" />
        <span class="text-ink">{entry.label}</span>
      </div>
    {/each}
  </div>
</aside>
