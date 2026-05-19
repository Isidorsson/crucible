<script lang="ts">
  // Sugar over <Tooltip> for the common case: an inline term whose label
  // text *is* the glossary entry. Renders a focusable, dotted-underlined
  // span that surfaces the glossary blurb on hover/focus.
  //
  //   <Hint term="rps" />                  → "rps" with tooltip
  //   <Hint term="rps">requests/sec</Hint> → custom label, same tooltip

  import Tooltip from './Tooltip.svelte';
  import { GLOSSARY, type Term } from './glossary';
  import type { Snippet } from 'svelte';

  let {
    term,
    side = 'top',
    class: cls = '',
    // Aliased to dodge the name collision with the Tooltip snippet param
    // (`{#snippet children(id)}`) defined inside this component's markup.
    children: label
  }: {
    term: Term;
    side?: 'top' | 'bottom' | 'left' | 'right';
    class?: string;
    children?: Snippet;
  } = $props();

  const def = $derived(GLOSSARY[term]);
</script>

<Tooltip content={def.full} {side}>
  {#snippet children(id)}
    <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
    <span tabindex="0" aria-describedby={id} class="crucible-hint {cls}">
      {#if label}{@render label()}{:else}{def.term}{/if}
    </span>
  {/snippet}
</Tooltip>

<style>
  .crucible-hint {
    cursor: help;
    text-decoration: underline dotted;
    text-decoration-color: theme('colors.muted');
    text-underline-offset: 2px;
    border-radius: 2px;
  }
  .crucible-hint:focus-visible {
    outline: 2px solid theme('colors.accent');
    outline-offset: 2px;
  }
</style>
