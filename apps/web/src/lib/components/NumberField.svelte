<script lang="ts">
  // Polished numeric input. Wraps a native <input type="number"> in a
  // shared field shell (.crucible-field) so the dark-theme border, focus
  // ring, and unit-suffix slot stay consistent across the app.
  //
  // Native spinner buttons are hidden by the shell's CSS — pair this
  // with sensible `step` values instead. Keyboard arrow keys still
  // increment/decrement, which is what most users actually want.

  let {
    id,
    name,
    value,
    min,
    max,
    step,
    suffix,
    placeholder,
    ariaLabel,
    oninput
  }: {
    id: string;
    name: string;
    value: number;
    min?: number;
    max?: number;
    step?: number;
    /** Unit shown in the right-hand chip (e.g. "rps", "ms", "%"). */
    suffix?: string;
    placeholder?: string;
    ariaLabel: string;
    oninput: (e: Event & { currentTarget: HTMLInputElement }) => void;
  } = $props();
</script>

<div class="crucible-field">
  <input
    {id}
    {name}
    type="number"
    inputmode="numeric"
    autocomplete="off"
    spellcheck="false"
    {min}
    {max}
    {step}
    {value}
    {placeholder}
    aria-label={ariaLabel}
    {oninput}
    class="crucible-field__input"
  />
  {#if suffix}
    <span class="crucible-field__suffix">{suffix}</span>
  {/if}
</div>
