# MMA Fighter Sprite Bundle

Production bundle generated with the `generate2dsprite` workflow.

- Animations: 51
- Frames: 334
- Frame size: 256 x 256
- Authored facing: right
- Runtime left-facing: mirror X
- Pivot: (128, 228)
- QC passed: 51/51

## Layout

- `fighters/`: standalone locomotion, defense, strikes, damage, and result animations
- `interactions/`: paired clinch, takedown, ground, submission, tap-out, and ground recovery
- `effects/`: transparent impact and motion effects
- `previews/`: contact sheets and animated GIFs
- `fighter-sprites.json`: frame rectangles, timing, pivot, pairing, impacts, and transitions
- `sprite-qc-report.json`: per-animation chroma-key/alignment QC

All strips are horizontal RGBA PNGs. Frame indices in the manifest are zero-based.
