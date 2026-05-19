// Minimal type contract for Go's wasm_exec.js / TinyGo's runtime glue.
// We avoid bundling either one in the repo; instead the build step copies
// the appropriate one from the toolchain into /static.

declare global {
  class Go {
    importObject: WebAssembly.Imports;
    run(instance: WebAssembly.Instance): Promise<void>;
  }

  interface CrucibleAPI {
    load(specJson: string): { ok: true } | { error: string };
    step(wallBudgetMs: number): number;
    snapshot(): string; // JSON
    setSpeed(v: number): number;
    setRPS(nodeId: string, rps: number): boolean;
    injectFault(nodeId: string, kind: number, on: boolean): boolean;
    reset(): boolean;
  }

  // Set by the Go runtime in main()
  var crucible: CrucibleAPI;
}

export {};
