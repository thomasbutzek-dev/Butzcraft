# Performance measurements

## Frame-time capture

Open the production build with `?perf=1&scenario=<name>`. The capture waits for active gameplay, applies a five-second active warmup, and then records 30 seconds by default. Pauses, blocking overlays, hidden tabs, and spawn phases do not count as active measurement time.

The status is shown below the FPS summary. The completed JSON report is available through `window.butzcraftPerformance.getLastReport()` and can be downloaded with `window.butzcraftPerformance.downloadLastReport()`. A manual capture can be started with:

```js
window.butzcraftPerformance.start(30, 'desktop-sprint-straight')
```

Reports include p50, p95, p99 and worst frame time, frame-budget overruns, loaded and pending chunk work, entity and triangle ranges, and JS heap range when the browser exposes it. They also report worker generation, worker mesh building, request-to-response latency, main-thread mesh adoption, CPU renderer submission, horizontal travel distance, unique chunks, and chunk transitions.

cpuRenderSubmitMs is CPU time spent calling renderer.render(). It is not GPU execution time. GPU completion is currently not instrumented and is explicitly marked unavailable in report metadata.

## Verified desktop baseline, 2026-07-31

- Build: local production build from dirty project HEAD `fcd7e572fc60e6ca8620e03eb30151f351cd9eb8`
- Scenario: new-game steady state after five seconds active warmup
- Browser viewport: 1933 × 1165 at device pixel ratio 2
- Graphics variant: B
- Active capture: 30.00 seconds, 2,056 frames, no excluded gaps
- Frame time: p50 12.9 ms, p95 25.2 ms, p99 39.68 ms, worst 86.7 ms
- Frame budgets: 27.19% over 16.7 ms, 2.38% over 33.3 ms, 0.29% over 50 ms
- JS heap: 30.36–43.50 MiB
- Loaded chunks: stable at 81; no queued chunks or pending mesh work during the measured interval
- Raw report: [frame-time-desktop-2026-07-31.json](frame-time-desktop-2026-07-31.json)

This baseline measures a stable loaded world, not fast traversal. The in-app test browser cannot acquire pointer lock; its two startup errors happened before the five-second warmup completed and therefore outside the measured interval. A real desktop sprint or fly-through, actual GPU timing, and a real mobile-device run remain outstanding.

## Phase instrumentation validation, 2026-07-31

- A 30-second production-build steady-state run reported p95 24.9 ms and 33.9 ms worst frame. CPU renderer submission was p50 0.7 ms, p95 1.0 ms, and 2.7 ms worst.
- The traversal proof correctly reported 0 horizontal blocks, one unique chunk, and zero chunk transitions.
- A separate 10-second startup run captured one main-thread mesh-adoption sample at 0.1 ms. Worker generation and mesh events had completed before the active capture window.
- Worker generation, worker mesh building, round-trip latency, and main-thread adoption payloads are covered by integration tests. A real fast traversal is still required to collect representative runtime distributions for all of them.
- The in-app browser cannot hold movement input without perturbing the measurement. No synthetic keypress loop is accepted as a desktop traversal result.

## Chunk worker benchmark, 2026-07-31

`npm run perf:chunks` runs again after loading both worker dependencies in its VM harness. Median results for 25 chunks:

| Variant | Generation | Mesh | Total | Triangles | Output |
| --- | ---: | ---: | ---: | ---: | ---: |
| A | 262.3 ms | 651.7 ms | 914.0 ms | 32,782 | 3.88 MiB |
| B | 273.9 ms | 665.2 ms | 939.1 ms | 37,840 | 4.47 MiB |
| C | 247.5 ms | 698.0 ms | 945.5 ms | 38,356 | 4.54 MiB |
