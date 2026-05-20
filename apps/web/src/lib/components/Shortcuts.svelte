<script lang="ts">
  import { Keyboard, X } from '@lucide/svelte';

  let open = $state(false);
  let dialogEl = $state<HTMLDivElement | null>(null);

  // Global ? handler. Skip when focus is inside a text input so the user can
  // type a real question mark in the export textarea or rename field.
  function onWindowKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape' && open) {
      e.preventDefault();
      open = false;
      return;
    }
    if (e.key !== '?') return;
    const t = e.target as HTMLElement | null;
    if (
      t &&
      (t.tagName === 'INPUT' ||
        t.tagName === 'TEXTAREA' ||
        (t as HTMLElement).isContentEditable)
    ) {
      return;
    }
    e.preventDefault();
    open = !open;
    if (open) queueMicrotask(() => dialogEl?.focus());
  }

  $effect(() => {
    window.addEventListener('keydown', onWindowKeydown);
    return () => window.removeEventListener('keydown', onWindowKeydown);
  });

  // Single source of truth for the catalogue. Grouped so it reads as a
  // cheat-sheet, not a dump.
  const GROUPS: { title: string; rows: { keys: string[]; desc: string }[] }[] = [
    {
      title: 'Canvas',
      rows: [
        { keys: ['Click'], desc: 'Select a node or edge.' },
        { keys: ['Drag'], desc: 'Move the selected node (handle on header).' },
        { keys: ['Del', 'Backspace'], desc: 'Delete selection.' },
        { keys: ['Scroll'], desc: 'Zoom in / out.' },
        { keys: ['Space', 'Drag'], desc: 'Pan the canvas.' },
        { keys: ['Esc'], desc: 'Clear selection / close popovers.' }
      ]
    },
    {
      title: 'Palette',
      rows: [
        { keys: ['Enter'], desc: 'Insert focused component at canvas center.' },
        { keys: ['Drag'], desc: 'Drag component onto the canvas to place.' },
        { keys: ['/', 'Cmd+K'], desc: 'Focus search.' }
      ]
    },
    {
      title: 'Simulation',
      rows: [
        { keys: ['Space'], desc: 'Run / pause (when not focused in canvas).' },
        { keys: ['1', '2', '5'], desc: 'Speed presets — 1×, 2×, 5×.' },
        { keys: ['M'], desc: 'Max speed.' },
        { keys: ['R'], desc: 'Re-seed the RNG.' }
      ]
    },
    {
      title: 'Inspector',
      rows: [
        { keys: ['K'], desc: 'Inject kill fault on selected node.' },
        { keys: ['S'], desc: 'Inject slow fault.' },
        { keys: ['L'], desc: 'Inject packet-loss fault.' },
        { keys: ['C'], desc: 'Clear active fault.' },
        { keys: ['D'], desc: 'Duplicate selected node.' }
      ]
    },
    {
      title: 'Tools',
      rows: [
        { keys: ['?'], desc: 'Toggle this overlay.' },
        { keys: ['E'], desc: 'Open export / import.' },
        { keys: ['W'], desc: 'Toggle lint panel.' }
      ]
    }
  ];
</script>

<!-- Discoverable launcher pill — also opens via ? -->
<button
  type="button"
  onclick={() => (open = true)}
  aria-label="Keyboard shortcuts (press ?)"
  class="flex items-center gap-1 rounded border border-line bg-bg px-2 py-1 text-[11px] text-muted
         transition-colors hover:border-accent hover:text-ink
         focus-visible:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
>
  <Keyboard class="h-3 w-3" aria-hidden="true" />
  <span class="font-mono">?</span>
</button>

{#if open}
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
  <div
    role="presentation"
    class="fixed inset-0 z-50 flex items-center justify-center bg-bg/70 p-4"
    onclick={() => (open = false)}
  >
    <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
    <div
      bind:this={dialogEl}
      role="dialog"
      aria-modal="true"
      aria-labelledby="shortcuts-title"
      tabindex="-1"
      onclick={(e) => e.stopPropagation()}
      class="max-h-[80vh] w-full max-w-2xl overflow-y-auto rounded border border-line bg-panel shadow-2xl
             focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
    >
      <header class="flex items-center justify-between border-b border-line px-3 py-2">
        <h2 id="shortcuts-title" class="font-mono text-xs uppercase tracking-widest text-muted">
          Keyboard shortcuts
        </h2>
        <button
          type="button"
          onclick={() => (open = false)}
          aria-label="Close"
          class="rounded p-1 text-muted hover:text-ink
                 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <X class="h-4 w-4" aria-hidden="true" />
        </button>
      </header>

      <div class="grid grid-cols-1 gap-4 p-3 md:grid-cols-2">
        {#each GROUPS as g (g.title)}
          <section class="space-y-1.5">
            <h3 class="font-mono text-[10px] uppercase tracking-widest text-muted">
              {g.title}
            </h3>
            <ul class="space-y-1 text-xs" role="list">
              {#each g.rows as row, i (g.title + '-' + i)}
                <li class="flex items-baseline gap-2">
                  <span class="flex shrink-0 gap-1">
                    {#each row.keys as k (k)}
                      <kbd
                        class="rounded border border-line bg-bg px-1.5 py-px font-mono text-[10px] text-ink"
                      >
                        {k}
                      </kbd>
                    {/each}
                  </span>
                  <span class="text-muted">{row.desc}</span>
                </li>
              {/each}
            </ul>
          </section>
        {/each}
      </div>

      <footer class="border-t border-line px-3 py-2 text-[11px] text-muted">
        Press <kbd class="rounded border border-line bg-bg px-1.5 py-px font-mono text-[10px] text-ink">?</kbd>
        anywhere to toggle this overlay.
      </footer>
    </div>
  </div>
{/if}
