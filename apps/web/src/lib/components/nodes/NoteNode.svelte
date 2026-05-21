<script lang="ts">
  // Sticky-note node. The body is a textarea (.nodrag so a click inside
  // edits text instead of starting a node-move). A connector dot anchored
  // bottom-center is the user's hook to draw an annotation line — that
  // edge gets auto-tagged 'note-link' in design.addEdge.
  import { Handle, NodeResizer, Position } from '@xyflow/svelte';
  import { design, type NoteData } from '$lib/stores/design.svelte';

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

<NodeResizer minWidth={120} minHeight={70} isVisible={selected} />

<div class="note-card" class:note-card--selected={selected}>
  <!-- Tape strip: paper-tape illusion at the top. Also the visible drag
       affordance — users instinctively grab here to slide the note. -->
  <div class="note-tape" aria-hidden="true"></div>

  <textarea
    value={data.text}
    placeholder="note…"
    spellcheck="false"
    aria-label="Sticky note"
    oninput={onInput}
    class="note-text nodrag"
  ></textarea>

  <!-- Connector dot: the user drags from here to annotate another node.
       Loose connection mode + auto-tagging in design.addEdge make this
       work as either source or target side of a link. -->
  <Handle
    type="source"
    position={Position.Bottom}
    class="note-handle"
    aria-label="Drag to link this note to a component"
  />
</div>

<style>
  /* Subtle warm paper. We layer two gradients: a soft top-to-bottom warm
     fade for the page, then a faint diagonal sheen so the surface doesn't
     feel as flat as the rest of the canvas chrome. */
  .note-card {
    position: relative;
    height: 100%;
    width: 100%;
    padding: 18px 12px 12px;
    border-radius: 3px;
    border: 1px solid rgba(210, 153, 34, 0.45);
    background:
      linear-gradient(
        140deg,
        rgba(255, 255, 255, 0.04) 0%,
        rgba(255, 255, 255, 0) 35%
      ),
      linear-gradient(
        180deg,
        rgba(210, 153, 34, 0.22) 0%,
        rgba(210, 153, 34, 0.12) 100%
      ),
      #1a1610;
    box-shadow:
      0 1px 0 rgba(255, 255, 255, 0.04) inset,
      0 12px 24px -10px rgba(0, 0, 0, 0.55),
      0 2px 6px rgba(0, 0, 0, 0.35);
    transform: rotate(-0.4deg);
    transition:
      transform 180ms ease,
      box-shadow 180ms ease,
      border-color 160ms ease;
  }
  .note-card:hover {
    transform: rotate(0deg);
    box-shadow:
      0 1px 0 rgba(255, 255, 255, 0.05) inset,
      0 16px 30px -10px rgba(0, 0, 0, 0.6),
      0 2px 8px rgba(0, 0, 0, 0.4);
  }
  .note-card--selected {
    border-color: rgba(210, 153, 34, 0.85);
    box-shadow:
      0 0 0 1px rgba(210, 153, 34, 0.6),
      0 0 0 4px rgba(210, 153, 34, 0.15),
      0 16px 30px -10px rgba(0, 0, 0, 0.6);
  }
  .note-card:focus-within {
    border-color: rgba(210, 153, 34, 0.9);
  }

  /* Tape strip across the top. translateX(-50%) centers it; tiny rotation
     and translucent washi-tape gradient sell the "stuck-on" look. */
  .note-tape {
    position: absolute;
    top: -6px;
    left: 50%;
    width: 56px;
    height: 14px;
    transform: translateX(-50%) rotate(-2deg);
    background: linear-gradient(
      180deg,
      rgba(240, 200, 80, 0.55) 0%,
      rgba(240, 200, 80, 0.35) 100%
    );
    border: 1px solid rgba(240, 200, 80, 0.4);
    border-radius: 1px;
    box-shadow:
      0 1px 2px rgba(0, 0, 0, 0.3),
      0 0 0 1px rgba(0, 0, 0, 0.1) inset;
    pointer-events: none;
  }

  /* Notes deserve a different voice than the monospace topology labels —
     a humanist serif italic reads instantly as "margin comment / aside". */
  .note-text {
    height: 100%;
    width: 100%;
    resize: none;
    border: 0;
    background: transparent;
    padding: 0;
    color: #f5d98a;
    font-family: 'Iowan Old Style', 'Palatino Linotype', Palatino, Georgia, serif;
    font-style: italic;
    font-size: 13px;
    line-height: 1.35;
    text-wrap: pretty;
  }
  .note-text::placeholder {
    color: rgba(245, 217, 138, 0.5);
  }
  /* Keep focus visible: app.css gives a global focus ring; we just don't
     fight it. The card's selected ring on its container is the strong
     state; the textarea ring layers cleanly on top. */
  .note-text:focus-visible {
    outline: none;
  }

  /* Connector dot. Small, amber, just below the card. Stands out against
     the canvas dot-grid without competing with the crucible-handle ring
     used by data-flow nodes. */
  :global(.svelte-flow .note-handle) {
    width: 10px;
    height: 10px;
    background: #d29922;
    border: 2px solid #1a1610;
    border-radius: 9999px;
    box-shadow: 0 0 6px rgba(210, 153, 34, 0.55);
    opacity: 0;
    transition: opacity 140ms ease, transform 140ms ease;
  }
  :global(.svelte-flow .svelte-flow__node-note:hover .note-handle),
  :global(.svelte-flow .svelte-flow__node-note.selected .note-handle),
  :global(.svelte-flow .note-handle:hover) {
    opacity: 1;
  }
  :global(.svelte-flow .note-handle:hover) {
    transform: translate(-50%, 0) scale(1.25);
  }

  /* Resizer handle dots, visible only when the note is selected. */
  :global(.svelte-flow__resize-control.handle) {
    background: #d29922;
    border-color: #d29922;
  }

  @media (prefers-reduced-motion: reduce) {
    .note-card,
    .note-card:hover {
      transform: none;
      transition: none;
    }
    :global(.svelte-flow .note-handle) {
      transition: none;
    }
  }
</style>
