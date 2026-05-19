<script lang="ts">
  import '../app.css';
  import { Toaster, toast } from 'svelte-sonner';
  import { sim } from '$lib/stores/sim.svelte';

  let { children } = $props();

  // Surface sim worker errors as a sticky toast with a Copy action.
  // Toasts are deduplicated against the last shown error so a single
  // failure doesn't fan out as the snapshot tick re-reads sim.error.
  let lastError: string | null = null;
  $effect(() => {
    const err = sim.error;
    if (err && err !== lastError) {
      toast.error('Simulation error', {
        description: err,
        duration: Number.POSITIVE_INFINITY,
        action: {
          label: 'Copy',
          onClick: () => {
            void navigator.clipboard.writeText(err);
            toast.success('Error copied to clipboard…');
          }
        }
      });
    }
    lastError = err;
  });
</script>

<Toaster
  theme="dark"
  position="bottom-right"
  richColors
  closeButton
  toastOptions={{ class: 'crucible-toast' }}
/>

{@render children()}

<style>
  :global(.crucible-toast) {
    font-family:
      ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, 'Liberation Mono', monospace;
    font-size: 12px;
  }
  :global(.crucible-toast [data-description]) {
    word-break: break-word;
    max-height: 12rem;
    overflow-y: auto;
  }
</style>
