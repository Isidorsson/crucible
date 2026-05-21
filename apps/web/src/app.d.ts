// See https://svelte.dev/docs/kit/types#app
declare global {
  namespace App {
    // interface Error {}
    // interface Locals {}
    // interface PageData {}
    // interface PageState {}
    // interface Platform {}
  }

  // Go runtime constructor injected by /wasm_exec.js
  class Go {
    importObject: WebAssembly.Imports;
    run(instance: WebAssembly.Instance): Promise<void>;
  }

  // Surface exported by sim/main.go via syscall/js
  interface CrucibleAPI {
    load(specJson: string): { ok: true } | { error: string };
    step(wallBudgetMs: number): number;
    snapshot(): string;
    setSpeed(v: number): number;
    setRPS(nodeId: string, rps: number): boolean;
    injectFault(nodeId: string, kind: number, on: boolean): boolean;
    partitionEdge(src: string, dst: string, on: boolean): boolean;
    reset(): boolean;
    // Returns true on success, or a JSON error string on failure.
    addNode(nodeDefJson: string): boolean | string;
    addEdge(src: string, dst: string): boolean | string;
  }

  // Set by Go main() on globalThis. Available in both window and worker scope
  // because syscall/js writes to js.Global() which is globalThis in both.
  var crucible: CrucibleAPI;
}

export {};
