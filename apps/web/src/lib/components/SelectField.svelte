<script lang="ts">
  // Polished native <select>. Hides the browser's default arrow and
  // draws a Lucide chevron in its place so the control matches the rest
  // of the dark UI. The underlying control is still a real <select>,
  // so keyboard navigation, mobile pickers, and screen-readers work
  // exactly as users expect — no roll-your-own listbox required.

  import { ChevronDown } from '@lucide/svelte';

  export type SelectOption<V extends string = string> = {
    value: V;
    label: string;
  };

  let {
    id,
    name,
    value,
    options,
    ariaLabel,
    onchange
  }: {
    id: string;
    name: string;
    value: string;
    options: SelectOption[];
    ariaLabel: string;
    onchange: (e: Event & { currentTarget: HTMLSelectElement }) => void;
  } = $props();
</script>

<div class="crucible-field crucible-field--select">
  <select
    {id}
    {name}
    {value}
    aria-label={ariaLabel}
    {onchange}
    class="crucible-field__select"
  >
    {#each options as o (o.value)}
      <option value={o.value}>{o.label}</option>
    {/each}
  </select>
  <ChevronDown class="crucible-field__chevron" aria-hidden="true" />
</div>
