# BridgeSplat AI

Predictive infrastructure health monitoring prototype.

This app turns drone or phone footage into an interactive bridge inspection workflow:

- Upload image or video inspection media
- Extract representative visual frames in the browser
- Detect likely cracks, corrosion, spalling, and water staining with lightweight CV heuristics
- Project issue markers into an interactive 3D bridge twin
- Produce a Bridge Health Score, prioritized findings, maintenance action, and markdown report

## Run Locally

```powershell
npm install
npm run dev -- --port 5175
```

Then open:

```text
http://127.0.0.1:5175/
```

Build check:

```powershell
npm run build
```

## What Is Implemented

- React/Vite app with a dense inspection-dashboard UI
- Three.js bridge digital twin with orbit controls and clickable defect markers
- Browser-side image/video frame extraction
- CV-style visual heuristics for four defect classes
- 2D media coordinate to 3D bridge coordinate projection
- Health scoring and risk classification
- Markdown inspection report export/copy
- Sample demo mode when no media is provided

## Production Pipeline Hook

The current 3D scene is a generated inspection twin. For a production BridgeSplat system, replace the generated bridge geometry with a real Gaussian Splat generated from footage:

1. Upload video to backend storage.
2. Extract frames with FFmpeg.
3. Run COLMAP or GLOMAP for camera poses and sparse reconstruction.
4. Train 3D Gaussian Splatting with Nerfstudio/gsplat, OpenSplat, or Graphdeco-based tooling.
5. Return the `.splat`, `.ply`, `.ksplat`, or SOG asset URL to the frontend.
6. Project detected 2D defects into 3D using camera poses/depth and render those markers over the splat.

The prototype intentionally keeps this frontend/backend boundary clean so the reconstruction service can be added without redesigning the app.
