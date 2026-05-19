<script lang="ts">
  import Palette from '$lib/components/Palette.svelte';
  import ControlBar from '$lib/components/ControlBar.svelte';
  import Inspector from '$lib/components/Inspector.svelte';
  import Canvas from '$lib/canvas/Canvas.svelte';
  import { design } from '$lib/stores/design.svelte';
  import { Flame } from '@lucide/svelte';
  import { SvelteFlowProvider } from '@xyflow/svelte';

  let selectedId = $state<string | null>(null);
  const selected = $derived(
    selectedId ? design.nodes.find((n) => n.id === selectedId) ?? null : null
  );
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

  <ControlBar />

  <SvelteFlowProvider>
    <main class="flex flex-1 overflow-hidden" aria-label="Editor">
      <Palette />
      <Canvas onSelect={(id) => (selectedId = id)} />
      <Inspector {selected} onSelect={(id) => (selectedId = id)} />
    </main>
  </SvelteFlowProvider>
</div>
