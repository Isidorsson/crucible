<script lang="ts">
  import { Download, Upload, Copy, Check, X } from '@lucide/svelte';
  import { design } from '$lib/stores/design.svelte';

  let { open = $bindable(false) }: { open?: boolean } = $props();

  // Local text mirror so the user can paste, edit, and only commit when
  // they press Import. We re-serialize on every open so the textarea
  // matches the live design.
  let text = $state('');
  let copied = $state(false);
  let error = $state<string | null>(null);
  let dialogEl = $state<HTMLDivElement | null>(null);

  $effect(() => {
    if (open) {
      text = JSON.stringify(design.toJSON(), null, 2);
      copied = false;
      error = null;
      // Focus the dialog so Esc works immediately.
      queueMicrotask(() => dialogEl?.focus());
    }
  });

  function copy() {
    navigator.clipboard.writeText(text).then(
      () => {
        copied = true;
        setTimeout(() => (copied = false), 1500);
      },
      () => (error = 'clipboard write failed')
    );
  }

  function download() {
    const blob = new Blob([text], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `crucible-design-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function doImport() {
    error = null;
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch (e) {
      error = (e as Error).message;
      return;
    }
    const err = design.fromJSON(parsed);
    if (err) {
      error = err;
      return;
    }
    open = false;
  }

  function onKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      e.preventDefault();
      open = false;
    }
  }
</script>

{#if open}
  <!-- Click-outside dismiss; inner panel stops propagation. -->
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
      aria-labelledby="export-import-title"
      tabindex="-1"
      onkeydown={onKeydown}
      onclick={(e) => e.stopPropagation()}
      class="flex max-h-[80vh] w-full max-w-2xl flex-col rounded border border-line bg-panel shadow-2xl
             focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
    >
      <header class="flex items-center justify-between border-b border-line px-3 py-2">
        <h2 id="export-import-title" class="font-mono text-xs uppercase tracking-widest text-muted">
          Export / Import design
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

      <p class="border-b border-line px-3 py-2 text-[11px] text-muted">
        Versioned JSON with every node's kind, position, and props. Copy to share, paste to load.
        Importing replaces the current canvas.
      </p>

      <textarea
        bind:value={text}
        spellcheck="false"
        aria-label="Design JSON"
        class="min-h-[40vh] flex-1 resize-none border-0 bg-bg p-3 font-mono text-xs leading-tight text-ink
               focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent"
      ></textarea>

      {#if error}
        <div role="alert" class="border-t border-err bg-err/10 px-3 py-2 text-xs text-err">
          {error}
        </div>
      {/if}

      <footer class="flex flex-wrap items-center justify-end gap-2 border-t border-line px-3 py-2">
        <button
          type="button"
          onclick={copy}
          class="flex items-center gap-1.5 rounded border border-line bg-bg px-2.5 py-1.5 text-xs
                 transition-colors hover:border-accent
                 focus-visible:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          {#if copied}
            <Check class="h-3.5 w-3.5 text-ok" aria-hidden="true" /> copied
          {:else}
            <Copy class="h-3.5 w-3.5" aria-hidden="true" /> copy
          {/if}
        </button>
        <button
          type="button"
          onclick={download}
          class="flex items-center gap-1.5 rounded border border-line bg-bg px-2.5 py-1.5 text-xs
                 transition-colors hover:border-accent
                 focus-visible:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <Download class="h-3.5 w-3.5" aria-hidden="true" /> download
        </button>
        <button
          type="button"
          onclick={doImport}
          class="flex items-center gap-1.5 rounded border border-accent bg-accent/10 px-2.5 py-1.5 text-xs text-accent
                 transition-colors hover:bg-accent/20
                 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <Upload class="h-3.5 w-3.5" aria-hidden="true" /> replace canvas
        </button>
      </footer>
    </div>
  </div>
{/if}
