// Currently-selected node id. Lives in its own tiny store so any component
// (ControlBar diagnosis pill, lint warning row, scenario picker) can drive
// selection without prop-drilling through +page.svelte.
//
// Canvas remains the authority for Svelte-Flow's internal selection; the
// onSelect callback wired in +page.svelte sets `id` here.

function createSelectionStore() {
  let id = $state<string | null>(null);
  return {
    get id() {
      return id;
    },
    set(next: string | null) {
      id = next;
    }
  };
}

export const selection = createSelectionStore();
