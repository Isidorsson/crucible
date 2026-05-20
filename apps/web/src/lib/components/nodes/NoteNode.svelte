<script lang="ts">
  // Sticky-note node. Editable inline (click to focus the textarea). No
  // handles — notes can't be wired into the topology. Sized via CSS so
  // they grow with content but don't dominate the canvas.
  import { NodeResizer } from '@xyflow/svelte';
  import { design, type NoteData } from '$lib/stores/design.svelte';

  // Svelte-Flow passes the same props every custom node receives. Use a
  // local shape to avoid coupling to @xyflow/svelte's NodeProps generic.
  let {
    id,
    data,
    selected
  }: { id: string; data: NoteData; selected?: boolean } = $props();

  function onInput(e: Event) {
    const t = e.currentTarget as HTMLTextAreaElement;
    design.updateNoteText(id, t.value);
  }
</script>

<NodeResizer minWidth={120} minHeight={60} isVisible={selected} />
<div
  class="flex h-full w-full flex-col rounded border border-warn/40 bg-warn/10 p-2 text-xs shadow-md
         {selected ? 'ring-2 ring-warn' : ''}"
>
  <textarea
    value={data.text}
    placeholder="note…"
    spellcheck="false"
    aria-label="Sticky note"
    oninput={onInput}
    class="h-full w-full resize-none border-0 bg-transparent text-warn placeholder:text-warn/50
           focus-visible:outline-none"
  ></textarea>
</div>

<style>
  /* Make the resizer handles visible against the dark UI. */
  :global(.svelte-flow__resize-control.handle) {
    background: var(--c-warn, #d29922);
    border-color: var(--c-warn, #d29922);
  }
</style>
