<script lang="ts">
  import Palette from '$lib/components/Palette.svelte';
  import ControlBar from '$lib/components/ControlBar.svelte';
  import StatusBar from '$lib/components/StatusBar.svelte';
  import Inspector from '$lib/components/Inspector.svelte';
  import Canvas from '$lib/canvas/Canvas.svelte';
  import { design, type CrucibleNodeData } from '$lib/stores/design.svelte';
  import { selection } from '$lib/stores/selection.svelte';
  import { Flame } from '@lucide/svelte';
  import { SvelteFlowProvider, type Node } from '@xyflow/svelte';

  // Inspector only handles crucible nodes; note nodes are edited inline.
  const selected = $derived.by(() => {
    if (!selection.id) return null;
    const n = design.nodes.find((x) => x.id === selection.id);
    if (!n || n.type !== 'crucible') return null;
    return n as Node<CrucibleNodeData>;
  });
</script>

<svelte:head>
  <title>Crucible — System Design Simulator</title>
</svelte:head>

<a href="#canvas" class="skip-link">Skip to canvas</a>

<div class="flex h-screen flex-col">
  <header class="flex items-center gap-2 border-b border-line bg-panel px-4 py-2">
    <Flame class="h-5 w-5 text-err" aria-hidden="true" />
    <h1 class="font-mono text-sm tracking-widest text-ink" translate="no">CRUCIBLE</h1>
    <span class="text-xs text-muted">system design simulator</span>
  </header>

  <SvelteFlowProvider>
    <ControlBar />

    <main class="flex flex-1 overflow-hidden" aria-label="Editor">
      <Palette />
      <Canvas onSelect={(id) => selection.set(id)} />
      <Inspector {selected} onSelect={(id) => selection.set(id)} />
    </main>
  </SvelteFlowProvider>

  <StatusBar />
</div>
