<script lang="ts">
  import { CATEGORIES, CATALOG_BY_CATEGORY } from '$lib/types/catalog';
  import { TEMPLATES } from '$lib/types/templates';
  import type { NodeKind } from '$lib/types/topology';
  import { design } from '$lib/stores/design.svelte';
  import { ChevronRight } from '@lucide/svelte';
  import Tooltip from './Tooltip.svelte';
  import { GLOSSARY } from './glossary';

  type Tab = 'components' | 'templates';
  let tab = $state<Tab>('components');

  // Roving-tabindex arrow-key nav between tabs (WAI-ARIA tab pattern).
  function onTabKeydown(e: KeyboardEvent) {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    tab = tab === 'components' ? 'templates' : 'components';
    // Focus moves implicitly because the newly-active tab becomes
    // tabindex=0 on re-render; we explicitly refocus to be safe.
    queueMicrotask(() => {
      const el = document.getElementById(`palette-tab-${tab}`);
      el?.focus();
    });
  }

  // ── Components tab ───────────────────────────────────────────────────
  function onDragStartKind(e: DragEvent, kind: NodeKind) {
    if (!e.dataTransfer) return;
    e.dataTransfer.setData('application/crucible-kind', kind);
    e.dataTransfer.effectAllowed = 'move';
  }

  function insertKindAtCenter(kind: NodeKind) {
    design.addNode(kind, { x: 240, y: 160 });
  }

  function onKindKeydown(e: KeyboardEvent, kind: NodeKind) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      insertKindAtCenter(kind);
    }
  }

  let query = $state('');
  const q = $derived(query.trim().toLowerCase());

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

  // ── Templates tab ────────────────────────────────────────────────────
  let tplQuery = $state('');
  const tq = $derived(tplQuery.trim().toLowerCase());

  const filteredTemplates = $derived(
    TEMPLATES.filter(
      (t) =>
        !tq || t.label.toLowerCase().includes(tq) || t.description.toLowerCase().includes(tq)
    )
  );

  function onDragStartTemplate(e: DragEvent, id: string) {
    if (!e.dataTransfer) return;
    e.dataTransfer.setData('application/crucible-template', id);
    e.dataTransfer.effectAllowed = 'move';
  }

  function insertTemplateAtCenter(id: string) {
    design.applyTemplate(id, { x: 80, y: 120 });
  }

  function onTemplateKeydown(e: KeyboardEvent, id: string) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      insertTemplateAtCenter(id);
    }
  }
</script>

<aside
  class="flex w-60 shrink-0 flex-col border-r border-line bg-panel"
  aria-labelledby="palette-heading"
>
  <h2
    id="palette-heading"
    class="border-b border-line px-3 py-2 text-xs font-semibold uppercase tracking-widest text-muted"
  >
    Library
  </h2>

  <div role="tablist" aria-label="Library sections" class="flex border-b border-line">
    <Tooltip content={GLOSSARY.components.full} side="bottom">
      {#snippet children(id)}
        <button
          id="palette-tab-components"
          type="button"
          role="tab"
          aria-selected={tab === 'components'}
          aria-controls="palette-panel-components"
          aria-describedby={id}
          tabindex={tab === 'components' ? 0 : -1}
          onclick={() => (tab = 'components')}
          onkeydown={onTabKeydown}
          class="flex-1 px-3 py-2 text-xs font-semibold uppercase tracking-wider transition-colors
                 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent
                 {tab === 'components'
            ? 'border-b-2 border-accent text-ink'
            : 'border-b-2 border-transparent text-muted hover:text-ink'}"
        >
          Components
        </button>
      {/snippet}
    </Tooltip>
    <Tooltip content={GLOSSARY.templates.full} side="bottom">
      {#snippet children(id)}
        <button
          id="palette-tab-templates"
          type="button"
          role="tab"
          aria-selected={tab === 'templates'}
          aria-controls="palette-panel-templates"
          aria-describedby={id}
          tabindex={tab === 'templates' ? 0 : -1}
          onclick={() => (tab = 'templates')}
          onkeydown={onTabKeydown}
          class="flex-1 px-3 py-2 text-xs font-semibold uppercase tracking-wider transition-colors
                 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent
                 {tab === 'templates'
            ? 'border-b-2 border-accent text-ink'
            : 'border-b-2 border-transparent text-muted hover:text-ink'}"
        >
          Templates
        </button>
      {/snippet}
    </Tooltip>
  </div>

  {#if tab === 'components'}
    <div
      id="palette-panel-components"
      role="tabpanel"
      aria-labelledby="palette-tab-components"
      class="flex flex-1 flex-col overflow-hidden"
    >
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
                    <Tooltip
                      content="{entry.details} Drag onto canvas, or press Enter to insert at center."
                      side="right"
                      block
                    >
                      {#snippet children(id)}
                        <button
                          type="button"
                          draggable="true"
                          ondragstart={(e) => onDragStartKind(e, entry.kind)}
                          onclick={() => insertKindAtCenter(entry.kind)}
                          onkeydown={(e) => onKindKeydown(e, entry.kind)}
                          aria-describedby={id}
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
                      {/snippet}
                    </Tooltip>
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
    </div>
  {:else}
    <div
      id="palette-panel-templates"
      role="tabpanel"
      aria-labelledby="palette-tab-templates"
      class="flex flex-1 flex-col overflow-hidden"
    >
      <div class="border-b border-line p-2">
        <label class="block">
          <span class="sr-only">Filter templates</span>
          <input
            type="search"
            bind:value={tplQuery}
            placeholder="Filter, e.g. cache…"
            autocomplete="off"
            spellcheck="false"
            class="w-full rounded border border-line bg-bg px-2 py-1.5 text-xs
                   placeholder:text-muted
                   focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent"
          />
        </label>
      </div>

      <ul class="flex-1 space-y-2 overflow-y-auto p-2" role="list">
        {#each filteredTemplates as tpl (tpl.id)}
          <li>
            <Tooltip
              content="{tpl.description} Drops {tpl.nodes.length} pre-wired nodes with {tpl.edges.length} edge{tpl.edges.length === 1 ? '' : 's'} already connected. Drag onto canvas, or press Enter to insert."
              side="right"
              block
            >
              {#snippet children(id)}
                <button
                  type="button"
                  draggable="true"
                  ondragstart={(e) => onDragStartTemplate(e, tpl.id)}
                  onclick={() => insertTemplateAtCenter(tpl.id)}
                  onkeydown={(e) => onTemplateKeydown(e, tpl.id)}
                  aria-describedby={id}
                  aria-label="Insert {tpl.label} template — {tpl.description}"
                  class="flex w-full cursor-grab flex-col gap-1 rounded border border-line bg-bg px-2.5 py-2 text-left
                         transition-colors hover:border-accent hover:bg-panel
                         focus-visible:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent
                         active:cursor-grabbing"
                >
                  <span class="flex items-center gap-2">
                    <tpl.icon class="h-3.5 w-3.5 shrink-0 text-accent" aria-hidden="true" />
                    <span class="truncate text-xs font-semibold text-ink">{tpl.label}</span>
                    <span
                      class="ml-auto font-mono text-[10px] text-muted tabular-nums"
                      aria-label="{tpl.nodes.length} nodes, {tpl.edges.length} edges"
                    >
                      {tpl.nodes.length}n·{tpl.edges.length}e
                    </span>
                  </span>
                  <span class="line-clamp-2 text-[11px] leading-snug text-muted">
                    {tpl.description}
                  </span>
                </button>
              {/snippet}
            </Tooltip>
          </li>
        {/each}

        {#if tq && filteredTemplates.length === 0}
          <li>
            <p class="px-2 py-3 text-xs text-muted" aria-live="polite">
              No templates match &ldquo;{tplQuery}&rdquo;.
            </p>
          </li>
        {/if}
      </ul>

      <p class="border-t border-line px-3 py-2 text-[10px] leading-snug text-muted">
        Drag template onto canvas, or press
        <kbd class="rounded border border-line bg-bg px-1">Enter</kbd> to insert.
      </p>
    </div>
  {/if}
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
