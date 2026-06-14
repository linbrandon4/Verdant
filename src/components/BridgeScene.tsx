import { useEffect, useRef } from "react";
import { Box as BoxIcon, Maximize2, Share2, Tag } from "lucide-react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { issueStyles, severityRank } from "../data/sampleInspection";
import type { DamageIssue } from "../types";

interface BridgeSceneProps {
  issues: DamageIssue[];
  selectedIssueId: string | null;
  onSelectIssue: (issueId: string) => void;
}

export default function BridgeScene({
  issues,
  selectedIssueId,
  onSelectIssue,
}: BridgeSceneProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const markerGroupRef = useRef<THREE.Group | null>(null);
  const markerMapRef = useRef<Map<THREE.Object3D, string>>(new Map());
  const selectedRef = useRef<string | null>(selectedIssueId);
  const onSelectRef = useRef(onSelectIssue);

  selectedRef.current = selectedIssueId;
  onSelectRef.current = onSelectIssue;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#050505");
    scene.fog = new THREE.Fog("#050505", 15, 32);

    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
    camera.position.set(7.4, 4.4, 7.4);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = 4.8;
    controls.maxDistance = 17;
    controls.maxPolarAngle = Math.PI * 0.48;
    controls.target.set(0, -0.25, 0);

    scene.add(new THREE.HemisphereLight("#ffffff", "#121212", 1.32));
    const sun = new THREE.DirectionalLight("#ffffff", 3.1);
    sun.position.set(5, 8, 4);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    scene.add(sun);

    scene.add(createBridgeModel());

    const markerGroup = new THREE.Group();
    markerGroup.name = "damage-markers";
    scene.add(markerGroup);

    const ground = createGroundPlane();
    scene.add(ground);

    sceneRef.current = scene;
    rendererRef.current = renderer;
    cameraRef.current = camera;
    markerGroupRef.current = markerGroup;

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();

    const handlePointerDown = (event: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const objects = Array.from(markerMapRef.current.keys());
      const hits = raycaster.intersectObjects(objects, false);
      if (hits.length > 0) {
        const id = markerMapRef.current.get(hits[0].object);
        if (id) onSelectRef.current(id);
      }
    };

    const resize = () => {
      const { width, height } = container.getBoundingClientRect();
      const safeWidth = Math.max(1, width);
      const safeHeight = Math.max(1, height);
      camera.aspect = safeWidth / safeHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(safeWidth, safeHeight, false);
    };

    const observer = new ResizeObserver(resize);
    observer.observe(container);
    resize();

    renderer.domElement.addEventListener("pointerdown", handlePointerDown);

    let frameId = 0;
    const animate = () => {
      controls.update();
      const elapsed = performance.now() / 1000;
      markerGroup.children.forEach((child) => {
        if (child.userData.kind === "marker-shell") {
          const issueId = child.userData.issueId as string;
          const selected = selectedRef.current === issueId;
          const pulse = selected ? 1.15 + Math.sin(elapsed * 5) * 0.08 : 1;
          child.scale.setScalar(pulse);
        }
      });
      renderer.render(scene, camera);
      frameId = requestAnimationFrame(animate);
    };
    animate();

    return () => {
      cancelAnimationFrame(frameId);
      renderer.domElement.removeEventListener("pointerdown", handlePointerDown);
      observer.disconnect();
      controls.dispose();
      disposeObject(scene);
      renderer.dispose();
      renderer.domElement.remove();
      sceneRef.current = null;
      rendererRef.current = null;
      cameraRef.current = null;
      markerGroupRef.current = null;
      markerMapRef.current.clear();
    };
  }, []);

  useEffect(() => {
    const group = markerGroupRef.current;
    if (!group) return;

    markerMapRef.current.clear();
    clearGroup(group);

    for (const issue of issues) {
      const marker = createIssueMarker(issue, selectedIssueId === issue.id);
      group.add(marker);
      marker.traverse((object) => {
        if (object.userData.clickable) {
          markerMapRef.current.set(object, issue.id);
        }
      });
    }
  }, [issues, selectedIssueId]);

  return (
    <div className="scene-wrap" ref={containerRef}>
      <div className="scene-overlay top-left">
        <span>Interactive bridge twin</span>
        <strong>{issues.length} mapped issue{issues.length === 1 ? "" : "s"}</strong>
      </div>
      <div className="scene-toolbar" aria-label="Viewer controls">
        <button aria-label="Dollhouse view" title="Dollhouse view">
          <BoxIcon size={16} />
        </button>
        <button aria-label="Inspection tags" title="Inspection tags">
          <Tag size={16} />
        </button>
        <button aria-label="Share model" title="Share model">
          <Share2 size={16} />
        </button>
        <button aria-label="Fullscreen view" title="Fullscreen view">
          <Maximize2 size={16} />
        </button>
      </div>
      <div className="scene-mini-mark" aria-hidden="true">
        <span />
        <span />
        <span />
        <span />
        <span />
        <span />
      </div>
    </div>
  );
}

function createBridgeModel() {
  const bridge = new THREE.Group();
  bridge.name = "bridge-digital-twin";

  const concrete = new THREE.MeshStandardMaterial({
    color: "#d2d1c9",
    roughness: 0.78,
    metalness: 0.02,
  });
  const concreteDark = new THREE.MeshStandardMaterial({
    color: "#aaaea6",
    roughness: 0.82,
  });
  const asphalt = new THREE.MeshStandardMaterial({
    color: "#262626",
    roughness: 0.92,
  });
  const steel = new THREE.MeshStandardMaterial({
    color: "#828c8c",
    roughness: 0.55,
    metalness: 0.18,
  });
  const stripe = new THREE.MeshStandardMaterial({
    color: "#f5f1d8",
    roughness: 0.72,
  });
  const joint = new THREE.MeshStandardMaterial({
    color: "#171717",
    roughness: 0.7,
  });

  addBox(bridge, [10.2, 0.36, 3.1], [0, 0, 0], concrete, true);
  addBox(bridge, [10.0, 0.05, 2.86], [0, 0.24, 0], asphalt, false);
  addBox(bridge, [9.3, 0.035, 0.035], [0, 0.28, -0.45], stripe, false);
  addBox(bridge, [9.3, 0.035, 0.035], [0, 0.28, 0.45], stripe, false);

  addBox(bridge, [10.3, 0.18, 0.16], [0, 0.58, -1.65], concreteDark, true);
  addBox(bridge, [10.3, 0.18, 0.16], [0, 0.58, 1.65], concreteDark, true);
  addBox(bridge, [10.2, 0.18, 0.12], [0, -0.3, -1.26], concreteDark, true);
  addBox(bridge, [10.2, 0.18, 0.12], [0, -0.3, 1.26], concreteDark, true);

  for (const z of [-1.45, 1.45]) {
    for (let x = -4.8; x <= 4.8; x += 1.2) {
      addBox(bridge, [0.08, 0.62, 0.08], [x, 0.88, z], steel, true);
    }
    addBox(bridge, [10.1, 0.07, 0.07], [0, 1.2, z], steel, true);
    addBox(bridge, [10.1, 0.05, 0.05], [0, 0.88, z], steel, true);
  }

  for (const x of [-3.1, 3.1]) {
    addBox(bridge, [0.92, 1.85, 0.72], [x, -1.27, -0.74], concrete, true);
    addBox(bridge, [0.92, 1.85, 0.72], [x, -1.27, 0.74], concrete, true);
    addBox(bridge, [2.35, 0.24, 2.35], [x, -0.43, 0], concreteDark, true);
    addBox(bridge, [1.06, 0.16, 0.95], [x, -0.12, -1.13], joint, false);
    addBox(bridge, [1.06, 0.16, 0.95], [x, -0.12, 1.13], joint, false);
  }

  addBox(bridge, [0.18, 0.42, 3.1], [-4.9, 0.05, 0], joint, false);
  addBox(bridge, [0.18, 0.42, 3.1], [4.9, 0.05, 0], joint, false);

  addBox(bridge, [1.1, 1.25, 3.5], [-5.7, -0.78, 0], concreteDark, true);
  addBox(bridge, [1.1, 1.25, 3.5], [5.7, -0.78, 0], concreteDark, true);

  return bridge;
}

function addBox(
  group: THREE.Group,
  size: [number, number, number],
  position: [number, number, number],
  material: THREE.Material,
  castShadow: boolean,
) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
  mesh.position.set(...position);
  mesh.castShadow = castShadow;
  mesh.receiveShadow = true;
  group.add(mesh);
}

function createGroundPlane() {
  const group = new THREE.Group();
  const material = new THREE.MeshStandardMaterial({
    color: "#050505",
    roughness: 0.9,
  });
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(28, 18), material);
  plane.rotation.x = -Math.PI / 2;
  plane.position.y = -2.28;
  plane.receiveShadow = true;
  group.add(plane);

  const grid = new THREE.GridHelper(28, 28, "#1c1c1c", "#101010");
  grid.position.y = -2.27;
  group.add(grid);

  const serviceRoad = new THREE.Mesh(
    new THREE.PlaneGeometry(22, 2.2),
    new THREE.MeshStandardMaterial({ color: "#0a0a0a", roughness: 0.92 }),
  );
  serviceRoad.rotation.x = -Math.PI / 2;
  serviceRoad.rotation.z = -0.2;
  serviceRoad.position.set(0, -2.26, 3.6);
  serviceRoad.receiveShadow = true;
  group.add(serviceRoad);
  return group;
}

function createIssueMarker(issue: DamageIssue, selected: boolean) {
  const group = new THREE.Group();
  const style = issueStyles[issue.type];
  const color = new THREE.Color(style.color);
  const position = new THREE.Vector3(issue.position.x, issue.position.y + 0.12, issue.position.z);
  group.position.copy(position);

  const radius = selected ? 0.16 : 0.12;
  const markerMaterial = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.32,
    emissive: color,
    emissiveIntensity: selected ? 0.28 : 0.12,
  });
  const marker = new THREE.Mesh(new THREE.SphereGeometry(radius, 24, 24), markerMaterial);
  marker.userData.clickable = true;
  marker.castShadow = true;
  group.add(marker);

  const shellMaterial = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: selected ? 0.32 : 0.18,
    side: THREE.DoubleSide,
  });
  const shell = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.014, 12, 36), shellMaterial);
  shell.rotation.x = Math.PI / 2;
  shell.userData.kind = "marker-shell";
  shell.userData.issueId = issue.id;
  group.add(shell);

  const lineMaterial = new THREE.MeshBasicMaterial({ color });
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.46, 8), lineMaterial);
  stem.position.y = 0.28;
  group.add(stem);

  const label = createLabelSprite(
    `${markerLabel(issue.type)} ${Math.round(issue.confidence * 100)}%`,
    style.color,
  );
  label.position.set(0, 0.58, 0);
  label.scale.set(selected ? 1.08 : 0.94, selected ? 1.08 : 0.94, 1);
  group.add(label);

  const priority = new THREE.Mesh(
    new THREE.RingGeometry(0.29, 0.33, 36),
    new THREE.MeshBasicMaterial({
      color: severityColor(issue.severity),
      transparent: true,
      opacity: 0.9,
      side: THREE.DoubleSide,
    }),
  );
  priority.rotation.x = Math.PI / 2;
  priority.position.y = -0.005;
  group.add(priority);

  return group;
}

function createLabelSprite(text: string, color: string) {
  const canvas = document.createElement("canvas");
  canvas.width = 420;
  canvas.height = 96;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas is unavailable");
  context.shadowColor = "rgba(0, 0, 0, 0.34)";
  context.shadowBlur = 14;
  context.shadowOffsetY = 8;
  context.fillStyle = "rgba(251,252,248,0.94)";
  roundRect(context, 20, 18, 380, 58, 12);
  context.fill();
  context.shadowColor = "transparent";
  context.strokeStyle = color;
  context.lineWidth = 4;
  roundRect(context, 20, 18, 380, 58, 12);
  context.stroke();
  context.fillStyle = "#17211b";
  context.font = "700 27px Inter, Arial, sans-serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(text, 210, 48);

  const texture = new THREE.CanvasTexture(canvas);
  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthTest: false,
  });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(1.22, 0.28, 1);
  return sprite;
}

function markerLabel(type: DamageIssue["type"]) {
  if (type === "corrosion") return "RUST";
  if (type === "spalling") return "SPALL";
  if (type === "water") return "WATER";
  return "CRACK";
}

function roundRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  context.beginPath();
  context.moveTo(x + radius, y);
  context.lineTo(x + width - radius, y);
  context.quadraticCurveTo(x + width, y, x + width, y + radius);
  context.lineTo(x + width, y + height - radius);
  context.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  context.lineTo(x + radius, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - radius);
  context.lineTo(x, y + radius);
  context.quadraticCurveTo(x, y, x + radius, y);
  context.closePath();
}

function severityColor(severity: DamageIssue["severity"]) {
  if (severityRank[severity] >= 4) return "#ba2f2b";
  if (severityRank[severity] === 3) return "#d15c3a";
  if (severityRank[severity] === 2) return "#ad6a16";
  return "#247343";
}

function clearGroup(group: THREE.Group) {
  while (group.children.length > 0) {
    const child = group.children.pop();
    if (child) disposeObject(child);
  }
}

function disposeObject(object: THREE.Object3D) {
  object.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (mesh.geometry) mesh.geometry.dispose();
    const material = mesh.material;
    if (Array.isArray(material)) {
      material.forEach(disposeMaterial);
    } else if (material) {
      disposeMaterial(material);
    }
  });
}

function disposeMaterial(material: THREE.Material) {
  const withMap = material as THREE.Material & { map?: THREE.Texture };
  if (withMap.map) withMap.map.dispose();
  material.dispose();
}
