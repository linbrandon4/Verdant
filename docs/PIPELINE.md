# BridgeSplat AI Production Architecture

## Local Prototype

The app currently performs inspection in the browser:

```text
media upload -> frame extraction -> defect heuristics -> 3D marker projection -> score/report
```

This is good for demos, UI validation, and explaining the product. It is not a certified structural assessment engine.

## Production Version

```text
phone/drone video
  -> object storage
  -> frame extraction
  -> COLMAP/GLOMAP pose solve
  -> Gaussian Splat training
  -> defect detector on sampled frames
  -> 2D-to-3D localization
  -> interactive model + report
```

## Services

- `ingest-api`: receives uploads and creates inspection jobs.
- `reconstruction-worker`: runs FFmpeg, COLMAP/GLOMAP, and Gaussian Splat training on GPU.
- `defect-worker`: runs crack/rust/spalling/water segmentation models on selected frames.
- `localization-worker`: projects 2D masks into 3D using camera poses and depth estimates.
- `report-api`: calculates health score, recommendations, and exports inspection reports.
- `web-app`: displays the splat, markers, issue list, and history.

## Defect Model Path

For a real deployment, replace the browser heuristics with segmentation models:

- Crack segmentation: fine-tuned YOLOv8-seg, SegFormer, or U-Net variant.
- Corrosion/spalling/water: multi-class segmentation on infrastructure datasets plus agency-labeled data.
- Output: masks with class, confidence, frame id, and pixel coordinates.

## 3D Localization Path

For each defect mask:

1. Use COLMAP camera intrinsics/extrinsics for the source frame.
2. Estimate depth from sparse points, MVS, or rendered splat depth.
3. Back-project mask centroid and mask boundary into world coordinates.
4. Cluster repeated detections across frames.
5. Store one 3D marker per physical issue with severity metadata.

## Scoring

The score should combine:

- defect severity
- confidence
- affected component
- area/length
- recurrence across scans
- growth rate between inspections
- agency-specific bridge element weights

The prototype score uses a transparent weighted penalty model so it can be replaced by engineering rules later.
