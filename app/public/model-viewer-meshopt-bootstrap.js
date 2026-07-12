// @google/model-viewer 4.3.x loads this same-origin script before enabling its
// bundled MeshoptDecoder. The decoder and its WASM are already part of the
// model-viewer bundle; this file deliberately has no runtime side effects.
