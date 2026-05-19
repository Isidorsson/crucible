<script lang="ts">
  // Accessible tooltip following the WAI-ARIA tooltip pattern:
  //   • shows on hover AND focus (keyboard parity)
  //   • Escape dismisses
  //   • `aria-describedby` links the floating bubble to the trigger so
  //     screen readers announce the description after the trigger's name
  //
  // Implementation uses `position: fixed` against `getBoundingClientRect`
  // of the trigger, so the bubble escapes any ancestor with
  // `overflow: hidden` (palette and inspector both scroll vertically).
  // Window scroll/resize re-positions while open.
  //
  // Overflow handling: after the bubble mounts, we measure it; if the
  // requested `side` would push it past the viewport edge, we flip to
  // the opposite side. The opacity fade-in masks the one-frame shift.

  import { onDestroy, tick, type Snippet } from 'svelte';

  type Side = 'top' | 'bottom' | 'left' | 'right';

  // Portal action: reparent the bubble to <body> so it escapes any
  // ancestor with `transform`, `filter`, or `overflow: hidden`. Without
  // this, tooltips inside SvelteFlow nodes (which transform their
  // viewport) render relative to the flow's transformed coords and get
  // clipped by the flow container.
  function portal(node: HTMLElement) {
    document.body.appendChild(node);
    return {
      destroy() {
        if (node.parentNode === document.body) {
          document.body.removeChild(node);
        }
      }
    };
  }

  let {
    content,
    side = 'top',
    delay = 220,
    block = false,
    children
  }: {
    content: string;
    side?: Side;
    delay?: number;
    /** Render the wrapper as `display: block` so `w-full` children fill the row. */
    block?: boolean;
    /** Trigger snippet — receives the tooltip id to wire up `aria-describedby`. */
    children: Snippet<[string]>;
  } = $props();

  // Stable per-instance id. Math.random is enough — collision-free in practice
  // and avoids hydration mismatches that `crypto.randomUUID()` would cause.
  const id = `tt-${Math.random().toString(36).slice(2, 10)}`;

  let open = $state(false);
  let top = $state(0);
  let left = $state(0);
  // The side we ultimately render on. Position() sets it from the prop
  // before the bubble becomes visible, and may flip it if the bubble
  // would overflow. Initialized to a placeholder so the prop is only
  // ever read inside a closure (keeps it reactive to prop changes).
  let actualSide = $state<Side>('top');
  let triggerEl: HTMLSpanElement | undefined = $state();
  let bubbleEl: HTMLSpanElement | undefined = $state();
  let openTimer: ReturnType<typeof setTimeout> | undefined;

  function computeCoords(r: DOMRect, s: Side, gap = 8) {
    switch (s) {
      case 'top':
        top = r.top - gap;
        left = r.left + r.width / 2;
        break;
      case 'bottom':
        top = r.bottom + gap;
        left = r.left + r.width / 2;
        break;
      case 'left':
        top = r.top + r.height / 2;
        left = r.left - gap;
        break;
      case 'right':
        top = r.top + r.height / 2;
        left = r.right + gap;
        break;
    }
  }

  function opposite(s: Side): Side {
    return s === 'top' ? 'bottom' : s === 'bottom' ? 'top' : s === 'left' ? 'right' : 'left';
  }

  async function position() {
    if (!triggerEl) return;
    const r = triggerEl.getBoundingClientRect();
    actualSide = side;
    computeCoords(r, actualSide);

    // Wait for the bubble to mount before measuring it. If the requested
    // side puts any edge outside the viewport, flip to the opposite side
    // and recompute. We only flip once — if both sides overflow (tiny
    // viewport, huge tooltip) we accept clipping on the original side.
    await tick();
    if (!bubbleEl) return;
    const bb = bubbleEl.getBoundingClientRect();
    const pad = 4;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let flip = false;
    if (actualSide === 'top' && bb.top < pad) flip = true;
    else if (actualSide === 'bottom' && bb.bottom > vh - pad) flip = true;
    else if (actualSide === 'left' && bb.left < pad) flip = true;
    else if (actualSide === 'right' && bb.right > vw - pad) flip = true;
    if (flip) {
      actualSide = opposite(actualSide);
      computeCoords(r, actualSide);
    }
  }

  function show() {
    if (openTimer) clearTimeout(openTimer);
    openTimer = setTimeout(async () => {
      open = true;
      await position();
    }, delay);
  }
  function hide() {
    if (openTimer) clearTimeout(openTimer);
    open = false;
  }
  function onKey(e: KeyboardEvent) {
    if (e.key === 'Escape') hide();
  }
  function onWindow() {
    if (open) void position();
  }

  onDestroy(() => {
    if (openTimer) clearTimeout(openTimer);
  });
</script>

<svelte:window onscroll={onWindow} onresize={onWindow} />

<!-- The wrapper exists only to host hover/focus listeners and to give the
     bubble a stable bounding box. It carries no semantics, so `role` /
     `aria-*` live on the actual trigger inside the snippet. -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<span
  bind:this={triggerEl}
  class="crucible-tt-trigger {block ? 'is-block' : ''}"
  onmouseenter={show}
  onmouseleave={hide}
  onfocusin={show}
  onfocusout={hide}
  onkeydown={onKey}
>
  {@render children(id)}
</span>

{#if open}
  <span
    bind:this={bubbleEl}
    use:portal
    role="tooltip"
    {id}
    class="crucible-tooltip side-{actualSide}"
    style="top: {top}px; left: {left}px;"
  >
    {content}
  </span>
{/if}

<style>
  .crucible-tt-trigger {
    display: inline-flex;
    align-items: center;
  }
  .crucible-tt-trigger.is-block {
    display: block;
    width: 100%;
  }
  .crucible-tooltip {
    position: fixed;
    z-index: 80;
    max-width: 20rem;
    pointer-events: none;
    padding: 0.5rem 0.625rem;
    border-radius: 0.375rem;
    border: 1px solid theme('colors.line');
    background: theme('colors.panel');
    color: theme('colors.ink');
    font-size: 0.6875rem;
    line-height: 1.45;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.45);
    white-space: normal;
    /* Only opacity animates so the side-* translate isn't disturbed. */
    animation: crucible-tt-in 120ms ease-out;
  }
  .side-top {
    transform: translate(-50%, -100%);
  }
  .side-bottom {
    transform: translate(-50%, 0);
  }
  .side-left {
    transform: translate(-100%, -50%);
  }
  .side-right {
    transform: translate(0, -50%);
  }
  @keyframes crucible-tt-in {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .crucible-tooltip {
      animation: none;
    }
  }
</style>
