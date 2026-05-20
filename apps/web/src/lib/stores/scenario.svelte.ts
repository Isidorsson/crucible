// Runs a Scenario: replaces the canvas with the scenario's topology,
// starts the sim, and schedules the scripted events via setTimeout against
// wall-clock. Notes are surfaced as a transient banner the UI reads.
//
// Wall-clock scheduling is intentionally simple. The sim's `speed` multiplier
// would let us compress drills, but a wall-clock script keeps the banner
// timings predictable for the user (a 60-sec scenario takes 60 seconds).
// Pausing/stopping the sim does NOT cancel pending events — only the
// scenario's own cancel() does.

import type { Edge, Node } from '@xyflow/svelte';
import { design, type CrucibleNodeData } from './design.svelte';
import { sim } from './sim.svelte';
import {
  SCENARIO_BY_ID,
  type Scenario,
  type ScenarioEvent
} from '$lib/types/scenarios';
import { CATALOG_BY_KIND } from '$lib/types/catalog';
import { nanoid } from 'nanoid';

function createScenarioStore() {
  let activeId = $state<string | null>(null);
  let startedAtMs = $state<number>(0);
  let currentNote = $state<string | null>(null);
  let lastResult = $state<string | null>(null);
  // Pending setTimeouts so cancel() can drop them all.
  const timers: ReturnType<typeof setTimeout>[] = [];
  // Track each scenarioId → real node id so events can reach the right node.
  let idMap: Record<string, string> = {};

  function clearTimers() {
    for (const t of timers) clearTimeout(t);
    timers.length = 0;
  }

  function applyEvent(ev: ScenarioEvent) {
    switch (ev.kind) {
      case 'note':
        currentNote = ev.text;
        // Hold a note on screen for ~5 seconds, then clear (unless overwritten).
        timers.push(
          setTimeout(() => {
            if (currentNote === ev.text) currentNote = null;
          }, 5000)
        );
        break;
      case 'setRPS': {
        const real = idMap[ev.target];
        if (real) sim.setRPS(real, ev.rps);
        break;
      }
      case 'injectFault': {
        const real = idMap[ev.target];
        if (!real) break;
        if (ev.durationSec && ev.durationSec > 0) {
          sim.injectFaultFor(real, ev.fault, ev.durationSec * 1000);
        } else {
          sim.setFault(real, ev.fault);
        }
        break;
      }
      case 'clearFault': {
        const real = idMap[ev.target];
        if (real) sim.clearFault(real);
        break;
      }
    }
  }

  function start(scenarioId: string) {
    const s: Scenario | undefined = SCENARIO_BY_ID[scenarioId];
    if (!s) return;
    cancel();
    // Build a fresh canvas from the scenario nodes. Use the scenario's
    // local node ids as keys into the id map so script events line up.
    idMap = {};
    const newNodes: Node<CrucibleNodeData>[] = s.nodes.map((sn) => {
      const id = nanoid(8);
      idMap[sn.id] = id;
      const entry = CATALOG_BY_KIND[sn.kind];
      return {
        id,
        type: 'crucible',
        dragHandle: '.node-drag-handle',
        position: { x: 200 + sn.dx, y: 120 + sn.dy },
        data: {
          kind: sn.kind,
          label: entry.label,
          props: { ...entry.defaults, ...(sn.propsOverride ?? {}) }
        }
      };
    });
    const newEdges: Edge[] = s.edges.map((se) => {
      const source = idMap[se.from];
      const target = idMap[se.to];
      return {
        id: `${source}->${target}-${nanoid(4)}`,
        source,
        target,
        type: 'flow'
      };
    });
    design.nodes = newNodes;
    design.edges = newEdges;

    activeId = scenarioId;
    startedAtMs = performance.now();
    currentNote = `${s.label} — ${s.goal}`;
    lastResult = null;

    // Schedule each event at its atSec wall offset from now.
    for (const ev of s.script) {
      timers.push(setTimeout(() => applyEvent(ev), ev.atSec * 1000));
    }
    // Final tick: clear the note + flag the run as finished.
    timers.push(
      setTimeout(() => {
        currentNote = null;
        lastResult = `Scenario finished. Pass condition: ${s.passCondition}`;
        activeId = null;
      }, s.durationSec * 1000)
    );

    // Start the sim with the new topology. Stop first to clear any prior
    // run; start() reads design.toSpec().
    sim.stop();
    sim.start();
  }

  function cancel() {
    clearTimers();
    activeId = null;
    currentNote = null;
    idMap = {};
  }

  return {
    get activeId() {
      return activeId;
    },
    get currentNote() {
      return currentNote;
    },
    get lastResult() {
      return lastResult;
    },
    get elapsedSec() {
      return activeId ? (performance.now() - startedAtMs) / 1000 : 0;
    },
    start,
    cancel
  };
}

export const scenario = createScenarioStore();
