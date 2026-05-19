.PHONY: sim sim-go sim-tinygo clean

WASM_OUT := apps/web/static/sim.wasm

sim: sim-tinygo

sim-tinygo:
	tinygo build -o $(WASM_OUT) -target wasm -no-debug -opt=2 ./sim

sim-go:
	GOOS=js GOARCH=wasm go build -o $(WASM_OUT) ./sim

clean:
	rm -f $(WASM_OUT)
