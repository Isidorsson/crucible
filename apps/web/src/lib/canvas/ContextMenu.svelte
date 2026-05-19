<script lang="ts">
  import { Trash2, Copy, Skull, Snail, ShieldOff } from '@lucide/svelte';
  import { design } from '$lib/stores/design.svelte';
  import { sim } from '$lib/stores/sim.svelte';
  import { FaultKill, FaultSlow, FaultPacketLoss } from '$lib/types/topology';

  export type CtxTarget =
    | { kind: 'node'; id: string }
    | { kind: 'edge'; id: string }
    | { kind: 'pane' };

  let {
    x,
    y,
    target,
    onClose
  }: {
    x: number;
    y: number;
    target: CtxTarget;
    onClose: () => void;
  } = $props();

  // Lock menu inside the viewport so it never opens off-screen near the
  // bottom-right edge of the canvas. 200 / 240 are approximations of the
  // menu's width/height; close enough for nudge logic without measuring.
  const left = $derived(Math.min(x, window.innerWidth - 200));
  const top = $derived(Math.min(y, window.innerHeight - 240));

  function close() {
    onClose();
  }

  function deleteTarget() {
    if (target.kind === 'node') {
      // Honor multi-select: if the right-clicked node is part of a selection,
      // delete the whole selection. Otherwise delete just this one.
      const selected = design.nodes.filter((n) => n.selected).map((n) => n.id);
      if (selected.includes(target.id) && selected.length > 1) {
        design.removeNodes(selected);
      } else {
        design.removeNode(target.id);
      }
    } else if (target.kind === 'edge') {
      design.removeEdge(target.id);
    }
    close();
  }

  function duplicate() {
    if (target.kind !== 'node') return;
    design.duplicateNode(target.id);
    close();
  }

  function fault(kind: number) {
    if (target.kind !== 'node') return;
    sim.injectFault(target.id, kind as 0 | 1 | 2 | 3, true);
    close();
  }

  function clearFault() {
    if (target.kind !== 'node') return;
    sim.injectFault(target.id, 0, false);
    close();
  }

  function onKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') close();
  }
</script>

<svelte:window onclick={close} oncontextmenu={close} onkeydown={onKeydown} />

<div
  role="menu"
  tabindex="-1"
  aria-label="Context menu"
  class="fixed z-50 min-w-[180px] rounded-md border border-line bg-panel py-1 font-mono text-xs shadow-2xl"
  style="left:{left}px; top:{top}px;"
  onclick={(e) => e.stopPropagation()}
  oncontextmenu={(e) => e.preventDefault()}
  onkeydown={(e) => e.stopPropagation()}
>
  {#if target.kind === 'node'}
    <button
      type="button"
      role="menuitem"
      onclick={duplicate}
      class="flex w-full items-center gap-2 px-3 py-1.5 text-left text-ink
             hover:bg-bg focus-visible:bg-bg focus-visible:outline-none"
    >
      <Copy class="h-3.5 w-3.5" aria-hidden="true" /> Duplicate
    </button>

    <div class="my-1 border-t border-line" aria-hidden="true"></div>

    <button
      type="button"
      role="menuitem"
      onclick={() => fault(FaultKill)}
      class="flex w-full items-center gap-2 px-3 py-1.5 text-left text-ink hover:bg-bg"
    >
      <Skull class="h-3.5 w-3.5 text-err" aria-hidden="true" /> Kill
    </button>
    <button
      type="button"
      role="menuitem"
      onclick={() => fault(FaultSlow)}
      class="flex w-full items-center gap-2 px-3 py-1.5 text-left text-ink hover:bg-bg"
    >
      <Snail class="h-3.5 w-3.5 text-warn" aria-hidden="true" /> Slow
    </button>
    <button
      type="button"
      role="menuitem"
      onclick={() => fault(FaultPacketLoss)}
      class="flex w-full items-center gap-2 px-3 py-1.5 text-left text-ink hover:bg-bg"
    >
      <ShieldOff class="h-3.5 w-3.5 text-warn" aria-hidden="true" /> Packet loss
    </button>
    <button
      type="button"
      role="menuitem"
      onclick={clearFault}
      class="flex w-full items-center gap-2 px-3 py-1.5 text-left text-muted hover:bg-bg"
    >
      Clear fault
    </button>

    <div class="my-1 border-t border-line" aria-hidden="true"></div>
  {/if}

  {#if target.kind === 'node' || target.kind === 'edge'}
    <button
      type="button"
      role="menuitem"
      onclick={deleteTarget}
      class="flex w-full items-center gap-2 px-3 py-1.5 text-left text-err hover:bg-bg"
    >
      <Trash2 class="h-3.5 w-3.5" aria-hidden="true" />
      Delete
      <span class="ml-auto text-muted">Del</span>
    </button>
  {:else}
    <button
      type="button"
      role="menuitem"
      onclick={() => {
        design.nodes = [];
        design.edges = [];
        close();
      }}
      class="flex w-full items-center gap-2 px-3 py-1.5 text-left text-err hover:bg-bg"
    >
      <Trash2 class="h-3.5 w-3.5" aria-hidden="true" /> Clear canvas
    </button>
  {/if}
</div>
