import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { RenderResolution, type RenderQuality } from "./render-quality";
import {
  BUMPERS,
  RAILS,
  RAMP_PATHS,
  SHOTS,
  SLINGS,
  TARGETS,
  ballHeight,
  pathPoint,
  rampHeight,
  type PinballEngine,
} from "./engine";
import {
  MODE_ORDER,
  SHOT_ORDER,
  type GameSettings,
  type ShotId,
} from "./types";
import { modeTarget } from "./rules";

const V = (x: number, y: number, h = 0) =>
  new THREE.Vector3(x - 300, h, y - 500);
const standard = (color: string, metalness = 0, roughness = 0.5) =>
  new THREE.MeshStandardMaterial({ color, metalness, roughness });
type Lamp = {
  mesh: THREE.Mesh;
  mat: THREE.MeshStandardMaterial;
  shot?: ShotId;
  mode?: number;
  lock?: number;
  save?: boolean;
};

/** A real depth-buffered cabinet. Physics stays deterministic on the playfield;
 * elevated paths use exactly the same spline and height function as their meshes. */
export class TableRenderer {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(31, 0.6, 10, 5000);
  private fixed = new THREE.Group();
  private chrome = standard("#b7c8d1", 0.93, 0.19);
  private steel = standard("#f4f8fa", 1, 0.08);
  private black = standard("#172025", 0.55, 0.38);
  private rubber = standard("#262d2e", 0.05, 0.8);
  private bone = new THREE.MeshPhysicalMaterial({
    color: "#f5e4bb",
    roughness: 0.27,
    metalness: 0,
    clearcoat: 0.65,
    clearcoatRoughness: 0.18,
  });
  private brass = standard("#b49059", 0.72, 0.32);
  private orange = standard("#b44420", 0.3, 0.42);
  private blue = standard("#23576a", 0.5, 0.4);
  private balls = new Map<
    number,
    { ball: THREE.Mesh; shadow: THREE.Mesh; trail: THREE.Line }
  >();
  private flippers: THREE.Group[] = [];
  private bumpers: THREE.Group[] = [];
  private targets: THREE.Group[] = [];
  private lamps: Lamp[] = [];
  private gates: THREE.Group[] = [];
  private spinners: THREE.Group[] = [];
  private spinnerAngles = [0, 0];
  private worm = new THREE.Group();
  private harvester = new THREE.Group();
  private pulse: THREE.Mesh[] = [];
  private textures: THREE.Texture[] = [];
  private environment: THREE.WebGLRenderTarget;
  private disposed = false;
  private last = 0;
  private routeLights: Array<{
    mesh: THREE.Mesh;
    shot: "harvest" | "dune";
    t: number;
  }> = [];
  private keyLight: THREE.DirectionalLight;
  private resolution: RenderResolution;
  private renderQuality: RenderQuality = "auto";
  constructor(private canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
    });
    this.renderer.setClearColor(0x070b10, 0);
    const gl = this.renderer.getContext();
    const info = gl.getExtension("WEBGL_debug_renderer_info");
    const device = info
      ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL))
      : "";
    this.resolution = new RenderResolution(
      /swiftshader|llvmpipe|software/i.test(device),
    );
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.96;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = this.resolution.software
      ? THREE.BasicShadowMap
      : THREE.PCFShadowMap;
    this.renderer.shadowMap.autoUpdate = false;
    this.renderer.shadowMap.needsUpdate = true;
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const room = new RoomEnvironment();
    this.environment = pmrem.fromScene(room, 0.04);
    this.scene.environment = this.environment.texture;
    this.scene.environmentIntensity = 0.48;
    room.dispose();
    pmrem.dispose();
    this.scene.add(this.fixed);
    this.scene.add(new THREE.HemisphereLight(0xa6c4e0, 0x81502d, 1.35));
    this.keyLight = new THREE.DirectionalLight(0xffe4b5, 2.35);
    this.keyLight.position.set(-340, 700, 120);
    this.keyLight.castShadow = true;
    Object.assign(this.keyLight.shadow.camera, {
      left: -400,
      right: 400,
      top: 680,
      bottom: -650,
      near: 10,
      far: 1600,
    });
    this.keyLight.shadow.mapSize.setScalar(
      this.resolution.software ? 1024 : 2048,
    );
    this.keyLight.shadow.bias = -0.0003;
    this.keyLight.shadow.normalBias = 0.5;
    this.scene.add(this.keyLight);
    const rim = new THREE.DirectionalLight(0x7ba7e8, 1.9);
    rim.position.set(420, 350, -450);
    this.scene.add(rim);
    this.buildCabinet();
    this.buildMechanisms();
    this.batchStaticGeometry();
    this.batchStaticGeometry(this.worm);
    this.batchStaticGeometry(this.harvester);
    for (const group of [
      ...this.flippers,
      ...this.bumpers,
      ...this.targets,
      ...this.gates,
      ...this.spinners,
    ])
      group.traverse((o) => {
        if (o instanceof THREE.Mesh) o.castShadow = false;
      });
    canvas.dataset.renderer = "webgl-3d";
    this.resize();
  }
  private mesh(
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    at: THREE.Vector3,
    parent: THREE.Object3D = this.fixed,
  ) {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.copy(at);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }
  private box(
    x: number,
    y: number,
    h: number,
    w: number,
    depth: number,
    tall: number,
    mat: THREE.Material,
    parent = this.fixed,
  ) {
    return this.mesh(
      new RoundedBoxGeometry(
        w,
        tall,
        depth,
        2,
        Math.min(1.8, w / 8, tall / 4, depth / 8),
      ),
      mat,
      V(x, y, h),
      parent,
    );
  }
  private cylinder(
    x: number,
    y: number,
    h: number,
    radius: number,
    tall: number,
    mat: THREE.Material,
    parent: THREE.Object3D = this.fixed,
  ) {
    return this.mesh(
      new THREE.CylinderGeometry(radius, radius, tall, 20),
      mat,
      V(x, y, h),
      parent,
    );
  }
  private pipe(
    points: THREE.Vector3[],
    radius: number,
    mat: THREE.Material,
    parent = this.fixed,
    segments = 48,
  ) {
    return this.mesh(
      new THREE.TubeGeometry(
        new THREE.CatmullRomCurve3(points),
        segments,
        radius,
        8,
        false,
      ),
      mat,
      new THREE.Vector3(),
      parent,
    );
  }
  private torus(
    x: number,
    y: number,
    h: number,
    r: number,
    tube: number,
    mat: THREE.Material,
    parent = this.fixed,
  ) {
    const m = this.mesh(
      new THREE.TorusGeometry(r, tube, 8, 32),
      mat,
      V(x, y, h),
      parent,
    );
    m.rotation.x = Math.PI / 2;
    return m;
  }
  private screw(x: number, y: number, h = 12) {
    this.cylinder(x, y, h, 3.3, 2, this.chrome);
    this.box(x, y, h + 1.2, 4, 0.8, 0.3, this.black);
  }
  private decal(
    text: string,
    x: number,
    y: number,
    w: number,
    h: number,
    color = "#18343d",
  ) {
    const c = document.createElement("canvas");
    c.width = 1024;
    c.height = 128;
    const ctx = c.getContext("2d")!;
    ctx.font = "600 72px 'Arial Narrow', Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = color;
    ctx.fillText(text, 512, 66, 996);
    const texture = new THREE.CanvasTexture(c);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
    this.textures.push(texture);
    const mat = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      depthWrite: false,
    });
    const m = this.mesh(new THREE.PlaneGeometry(w, h), mat, V(x, y, 2.1));
    m.rotation.x = -Math.PI / 2;
    m.castShadow = false;
  }
  private buildCabinet() {
    const art = new THREE.TextureLoader().load(
      "./assets/playfield-crisp.png",
      () => {
        if (!this.disposed) art.needsUpdate = true;
      },
    );
    art.colorSpace = THREE.SRGBColorSpace;
    art.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
    this.textures.push(art);
    const print = new THREE.MeshPhysicalMaterial({
      color: "#ffffff",
      metalness: 0,
      roughness: 0.48,
      clearcoat: 0.3,
      clearcoatRoughness: 0.28,
    });
    print.map = art;
    this.box(300, 500, -16, 616, 1016, 28, this.black);
    const deck = this.mesh(
      new THREE.PlaneGeometry(600, 1000),
      print,
      V(300, 500, 0),
    );
    deck.rotation.x = -Math.PI / 2;
    deck.castShadow = false;
    // Sidewalls, lockdown bar and shooter channel form an actual cabinet volume.
    for (const x of [9, 591]) {
      this.box(x, 498, 22, 17, 1008, 56, this.black);
      this.box(x, 498, 53, 19, 1008, 5, this.chrome);
      this.box(x < 300 ? 19 : 581, 500, 28, 2, 980, 3, this.brass);
      for (let y = 140; y < 920; y += 150) this.screw(x, y, 56);
    }
    this.box(300, 18, 28, 600, 24, 64, this.black);
    this.box(300, 980, 4, 580, 35, 29, this.black);
    this.box(300, 968, 23, 603, 12, 15, this.chrome);
    this.box(299, 920, 0.6, 365, 78, 1, this.black);
    this.decal("W O R L D S   O F   S P I C E", 297, 914, 323, 26, "#ebd6ac");
    this.decal("D E S E R T   P I N B A L L", 297, 937, 184, 11, "#9fa6a2");
    this.decal("P R E S C I E N C E", 298, 579, 182, 22, "#efe0b0");
    this.decal("HARVEST", 155, 509, 83, 16);
    this.decal("HIGH DUNE", 441, 509, 91, 16);
    this.decal("CITADEL  /  LOCK", 298, 213, 107, 12);
    this.decal("FLOW  ×  5", 298, 736, 98, 15);
    this.decal("SHOOT AGAIN", 298, 868, 102, 12);
    this.makeLamp(298, 850, undefined, undefined, 6);
    this.lamps.at(-1)!.save = true;
    this.decal("WYRM LOCKS", 298, 716, 97, 12);
    for (let i = 0; i < 3; i++) {
      this.makeLamp(274 + i * 24, 697, undefined, undefined, 6);
      this.lamps.at(-1)!.lock = i;
    }
    for (const [i, label] of [
      "HARVEST",
      "STORM",
      "SIEGE",
      "ORACLE",
    ].entries()) {
      this.decal(
        label,
        220 + (i % 2) * 151,
        627 + Math.floor(i / 2) * 43,
        105,
        14,
      );
      this.makeLamp(
        220 + (i % 2) * 151,
        609 + Math.floor(i / 2) * 43,
        undefined,
        i,
      );
    }
    // The ground orbit remains below the wireforms, with its own fine guide rails.
    this.pipe(
      [
        V(55, 425, 9),
        V(53, 219, 9),
        V(98, 89, 9),
        V(297, 45, 9),
        V(489, 87, 9),
        V(532, 214, 9),
        V(530, 426, 9),
      ],
      3,
      this.chrome,
      this.fixed,
      72,
    );
    for (const r of RAILS) {
      this.pipe(
        [V(r.a.x, r.a.y, 7), V(r.b.x, r.b.y, 7)],
        r.radius,
        this.rubber,
        this.fixed,
        1,
      );
      this.pipe(
        [V(r.a.x, r.a.y, 18), V(r.b.x, r.b.y, 18)],
        2.7,
        this.chrome,
        this.fixed,
        1,
      );
      for (const p of [r.a, r.b]) {
        this.cylinder(p.x, p.y, 9, 5, 21, this.brass);
        this.screw(p.x, p.y, 21);
      }
    }
    for (const shot of SHOT_ORDER) {
      const p = SHOTS[shot];
      this.makeLamp(p.x, p.y + 51, shot);
      // Three tiny route markers lead toward an illuminated entrance.
      for (let i = 0; i < 3; i++)
        this.makeLamp(
          p.x + (298 - p.x) * i * 0.08,
          p.y + 77 + i * 18,
          shot,
          undefined,
          4,
        );
    }
    // Plunger assembly: spring around its guide rod, behind the ball.
    this.pipe(
      [V(557, 891, 12), V(557, 954, 12)],
      3,
      this.chrome,
      this.fixed,
      1,
    );
    const spring: THREE.Vector3[] = [];
    for (let i = 0; i <= 160; i++)
      spring.push(
        V(
          557 + Math.cos(i * 0.6) * 6,
          910 + i * 0.23,
          12 + Math.sin(i * 0.6) * 6,
        ),
      );
    this.pipe(spring, 1.1, this.chrome, this.fixed, 160);
    this.box(557, 955, 12, 30, 12, 19, this.brass);
  }
  private makeLamp(
    x: number,
    y: number,
    shot?: ShotId,
    mode?: number,
    radius = 10,
  ) {
    this.torus(x, y, 1, radius + 2, 1.8, this.brass);
    const mat = standard("#809486", 0.2, 0.3);
    mat.emissive.set("#eaa552");
    let mesh: THREE.Mesh;
    if (shot && radius === 10) {
      const arrow = new THREE.Shape();
      arrow.moveTo(0, 13);
      arrow.lineTo(-9, -1);
      arrow.lineTo(-4, -1);
      arrow.lineTo(-4, -11);
      arrow.lineTo(4, -11);
      arrow.lineTo(4, -1);
      arrow.lineTo(9, -1);
      arrow.closePath();
      mesh = this.mesh(
        new THREE.ShapeGeometry(arrow),
        mat,
        V(x, y, 1.8),
        this.scene,
      );
      mesh.rotation.x = -Math.PI / 2;
    } else mesh = this.cylinder(x, y, 1.5, radius, 1.8, mat, this.scene);
    mesh.castShadow = false;
    this.lamps.push({ mesh, mat, shot, mode });
    return mesh;
  }
  private buildMechanisms() {
    for (const shot of ["harvest", "dune"] as const) this.buildRamp(shot);
    for (const p of BUMPERS) {
      this.cylinder(p.x, p.y, 5, 31, 10, this.rubber);
      this.cylinder(p.x, p.y, 13, 26, 14, this.chrome);
      this.torus(p.x, p.y, 18, 27, 3, this.bone);
      const g = new THREE.Group();
      g.position.copy(V(p.x, p.y));
      this.scene.add(g);
      this.mesh(
        new THREE.CylinderGeometry(28, 29, 10, 32),
        this.orange,
        new THREE.Vector3(0, 28, 0),
        g,
      );
      this.mesh(
        new THREE.CylinderGeometry(20, 23, 5, 32),
        this.brass,
        new THREE.Vector3(0, 35, 0),
        g,
      );
      this.mesh(
        new THREE.SphereGeometry(14, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2),
        this.bone,
        new THREE.Vector3(0, 37, 0),
        g,
      );
      this.bumpers.push(g);
    }
    for (const [i, p] of TARGETS.entries()) {
      this.box(p.x, p.y, 0.8, 38, 16, 2, this.black);
      const g = new THREE.Group();
      g.position.copy(V(p.x, p.y));
      this.scene.add(g);
      this.mesh(
        new THREE.BoxGeometry(28, 24, 8),
        this.chrome,
        new THREE.Vector3(0, 12, 0),
        g,
      );
      this.mesh(
        new THREE.BoxGeometry(22, 14, 1),
        this.blue,
        new THREE.Vector3(0, 16, 4.6),
        g,
      );
      this.mesh(
        new THREE.BoxGeometry(3, 7 + i * 2, 1),
        this.bone,
        new THREE.Vector3(0, 16, 5.2),
        g,
      );
      this.targets.push(g);
    }
    SLINGS.forEach((points) => {
      const shape = new THREE.Shape();
      points.forEach((p, i) =>
        i
          ? shape.lineTo(p.x - 300, -(p.y - 500))
          : shape.moveTo(p.x - 300, -(p.y - 500)),
      );
      shape.closePath();
      const geo = new THREE.ExtrudeGeometry(shape, {
        depth: 12,
        bevelEnabled: true,
        bevelSize: 2,
        bevelThickness: 2,
        bevelSegments: 1,
        steps: 1,
      });
      const m = this.mesh(geo, this.blue, new THREE.Vector3(0, 7, 0));
      m.rotation.x = -Math.PI / 2;
      this.pipe(
        [...points, points[0]].map((p) => V(p.x, p.y, 9)),
        5.5,
        this.bone,
        this.fixed,
        3,
      );
      for (const p of points) {
        this.cylinder(p.x, p.y, 13, 8, 26, this.chrome);
        this.screw(p.x, p.y, 27);
      }
    });
    for (const side of [0, 1]) {
      const g = new THREE.Group();
      g.position.copy(V(side ? 400 : 182, 826, 10));
      this.scene.add(g);
      const shape = new THREE.Shape();
      shape.moveTo(0, -12);
      shape.bezierCurveTo(-19, -12, -19, 12, 0, 12);
      shape.lineTo(91, 7);
      shape.bezierCurveTo(103, 7, 103, -7, 91, -7);
      shape.closePath();
      const geo = new THREE.ExtrudeGeometry(shape, {
        depth: 12,
        bevelEnabled: true,
        bevelSize: 2,
        bevelThickness: 2,
        bevelSegments: 2,
      });
      const base = this.mesh(geo, this.orange, new THREE.Vector3(0, -6, 0), g);
      base.rotation.x = -Math.PI / 2;
      const top = this.mesh(
        geo.clone(),
        this.bone,
        new THREE.Vector3(0, 9, 0),
        g,
      );
      top.rotation.x = -Math.PI / 2;
      top.scale.set(0.94, 0.7, 0.2);
      this.mesh(
        new THREE.CylinderGeometry(6, 6, 3, 16),
        this.brass,
        new THREE.Vector3(0, 13, 0),
        g,
      );
      this.flippers.push(g);
    }
    // Orbit spinners rotate only when a ball actually traverses their lane.
    for (const x of [82, 507]) {
      this.pipe(
        [
          V(x - 19, 393),
          V(x - 19, 393, 34),
          V(x + 19, 393, 34),
          V(x + 19, 393),
        ],
        2,
        this.chrome,
        this.fixed,
        3,
      );
      const g = new THREE.Group();
      g.position.copy(V(x, 393, 27));
      this.scene.add(g);
      this.mesh(
        new THREE.BoxGeometry(24, 21, 2),
        this.brass,
        new THREE.Vector3(),
        g,
      );
      this.mesh(
        new THREE.BoxGeometry(14, 12, 2.4),
        this.blue,
        new THREE.Vector3(),
        g,
      );
      this.spinners.push(g);
    }
    this.buildWorm();
    this.buildHarvester();
    // Visible insert rings are impact feedback, never full-screen flashes.
    for (let i = 0; i < 12; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: "#ffe6ac",
        transparent: true,
        opacity: 0,
        depthWrite: false,
      });
      const m = this.mesh(
        new THREE.RingGeometry(13, 17, 32),
        mat,
        V(300, 400, 2),
        this.scene,
      );
      m.rotation.x = -Math.PI / 2;
      m.castShadow = false;
      this.pulse.push(m);
    }
  }
  private buildRamp(shot: "harvest" | "dune") {
    const path = RAMP_PATHS[shot];
    const sample = (t: number, offset = 0, lift = 0) => {
      const p = pathPoint(path, t),
        p2 = pathPoint(path, Math.min(1, t + 0.002)),
        p0 = pathPoint(path, Math.max(0, t - 0.002));
      const dx = p2.x - p0.x,
        dy = p2.y - p0.y,
        d = Math.hypot(dx, dy) || 1;
      return V(
        p.x - (dy / d) * offset,
        p.y + (dx / d) * offset,
        rampHeight(t) + lift,
      );
    };
    for (const offset of [-17, -7, 7, 17]) {
      const points = Array.from({ length: 161 }, (_, i) =>
        sample(i / 160, offset, Math.abs(offset) === 17 ? 13 : 1),
      );
      this.pipe(
        points,
        Math.abs(offset) === 17 ? 2.7 : 2.2,
        this.chrome,
        this.fixed,
        160,
      );
    }
    // Open wire return: cross ties and slender stanchions show height over the orbit.
    for (let i = 2; i <= 29; i++) {
      const t = i / 31;
      this.pipe(
        [
          sample(t, -17, 12),
          sample(t, -17, 0),
          sample(t, 17, 0),
          sample(t, 17, 12),
        ],
        1.7,
        this.chrome,
        this.fixed,
        3,
      );
      if (i % 5 === 0 && t < 0.86) {
        const at = sample(t, 22),
          foot = at.clone();
        foot.y = 0;
        this.pipe(
          [foot, at.clone().add(new THREE.Vector3(0, 13, 0))],
          3,
          this.brass,
          this.fixed,
          1,
        );
      }
    }
    // Only the ascending entry is transparent acrylic. No opaque blue ribbon.
    const vertices: number[] = [],
      indices: number[] = [];
    for (let i = 0; i <= 40; i++) {
      for (const side of [-1, 1]) {
        const p = sample((i / 40) * 0.38, side * 16, -0.5);
        vertices.push(p.x, p.y, p.z);
      }
      if (i < 40) {
        const n = i * 2;
        indices.push(n, n + 1, n + 2, n + 1, n + 3, n + 2);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    const acrylic = new THREE.MeshStandardMaterial({
      color: "#82aec0",
      metalness: 0.2,
      roughness: 0.15,
      transparent: true,
      opacity: 0.3,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const ramp = this.mesh(geo, acrylic, new THREE.Vector3());
    ramp.castShadow = false;
    const gate = new THREE.Group();
    gate.position.copy(sample(0.025, 0, 21));
    this.scene.add(gate);
    this.mesh(
      new THREE.BoxGeometry(30, 17, 2),
      this.brass,
      new THREE.Vector3(0, -9, 0),
      gate,
    );
    this.gates.push(gate);
    for (let i = 0; i < 12; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: "#f5be72",
        transparent: true,
        opacity: 0.08,
      });
      const m = this.mesh(
        new THREE.SphereGeometry(3.2, 8, 6),
        mat,
        sample(0.08 + i * 0.07, -19, 15),
        this.scene,
      );
      m.castShadow = false;
      this.routeLights.push({ mesh: m, shot, t: 0.08 + i * 0.07 });
    }
  }
  private buildWorm() {
    // The scoop is a real dark opening with a ringed, rising worm above it.
    this.cylinder(298, 170, 0.6, 30, 1, this.black);
    this.torus(298, 170, 3, 32, 4, this.brass);
    this.worm.position.copy(V(298, 147, 6));
    this.scene.add(this.worm);
    for (let i = 0; i < 8; i++) {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(22 + i * 1.3, 4.1, 7, 32),
        i % 3 ? this.brass : this.orange,
      );
      ring.rotation.x = -Math.PI / 2 + 0.1 * i;
      ring.position.set(0, 7 + i * 5, -i * 2.6);
      ring.castShadow = true;
      this.worm.add(ring);
    }
    const mouth = this.mesh(
      new THREE.CircleGeometry(31, 40),
      new THREE.MeshBasicMaterial({ color: "#080908" }),
      new THREE.Vector3(0, 44, -17),
      this.worm,
    );
    mouth.rotation.x = -0.87;
    for (let i = 0; i < 26; i++) {
      const a = (i * Math.PI * 2) / 26;
      const radial = new THREE.Vector3(
        Math.cos(a),
        Math.sin(a) * Math.cos(0.87),
        -Math.sin(a) * Math.sin(0.87),
      );
      const tooth = this.mesh(
        new THREE.ConeGeometry(2.2, 12, 5),
        this.bone,
        radial
          .clone()
          .multiplyScalar(27)
          .add(new THREE.Vector3(0, 45, -16)),
        this.worm,
      );
      tooth.quaternion.setFromUnitVectors(
        new THREE.Vector3(0, 1, 0),
        radial.negate(),
      );
    }
    // Tower silhouettes live outside the main shooting fan, not invisible obstacles.
    for (const side of [0, 1])
      for (let i = 0; i < 3; i++) {
        const x = side ? 550 : 39,
          y = 145 + i * 45,
          h = 55 + i * 17;
        const rock = this.mesh(
          new THREE.CylinderGeometry(8, 14, h, 5),
          i % 2 ? this.orange : this.blue,
          V(x, y, h / 2),
        );
        rock.rotation.z = (i - 1) * 0.09;
        this.box(x, y + 9, h * 0.69, 3, 2, 9, this.bone);
      }
  }
  private buildHarvester() {
    this.harvester.position.copy(V(390, 89, 108));
    this.scene.add(this.harvester);
    this.mesh(
      new THREE.BoxGeometry(57, 17, 37),
      this.bone,
      new THREE.Vector3(),
      this.harvester,
    );
    this.mesh(
      new THREE.BoxGeometry(24, 15, 22),
      this.blue,
      new THREE.Vector3(5, 14, -2),
      this.harvester,
    );
    for (const x of [-26, 26])
      for (const z of [-14, 14]) {
        const wheel = this.mesh(
          new THREE.CylinderGeometry(9, 9, 8, 12),
          this.rubber,
          new THREE.Vector3(x, -9, z),
          this.harvester,
        );
        wheel.rotation.z = Math.PI / 2;
      }
    for (const z of [-9, 0, 9])
      this.mesh(
        new THREE.BoxGeometry(20, 4, 3),
        this.brass,
        new THREE.Vector3(-35, 0, z),
        this.harvester,
      );
    this.box(390, 89, 77, 82, 55, 3, this.black);
    for (const x of [359, 421]) this.cylinder(x, 89, 38, 3, 76, this.chrome);
  }
  /** Merge stationary metalwork by material: hundreds of modeled parts, few draw calls. */
  private batchStaticGeometry(group = this.fixed) {
    group.updateMatrixWorld(true);
    const inverse = group.matrixWorld.clone().invert();
    const buckets = new Map<
      THREE.Material,
      { geometry: THREE.BufferGeometry[]; cast: boolean; receive: boolean }
    >();
    const originals: THREE.BufferGeometry[] = [];
    for (const child of [...group.children]) {
      if (!(child instanceof THREE.Mesh) || Array.isArray(child.material))
        continue;
      const geom = child.geometry
        .clone()
        .applyMatrix4(inverse.clone().multiply(child.matrixWorld));
      const bucket = buckets.get(child.material) ?? {
        geometry: [],
        cast: child.castShadow,
        receive: child.receiveShadow,
      };
      bucket.geometry.push(geom);
      buckets.set(child.material, bucket);
      originals.push(child.geometry);
      group.remove(child);
    }
    for (const [material, bucket] of buckets) {
      const expanded = bucket.geometry.map((g) =>
        g.index ? g.toNonIndexed() : g,
      );
      const merged = mergeGeometries(expanded);
      if (merged) {
        const m = new THREE.Mesh(merged, material);
        m.castShadow = bucket.cast;
        m.receiveShadow = bucket.receive;
        group.add(m);
      }
      expanded.forEach((g) => g.dispose());
      bucket.geometry.forEach((g) => g.dispose());
    }
    originals.forEach((g) => g.dispose());
  }
  resize() {
    const rect = this.canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const ratio = this.resolution.ratio(
      rect.width,
      rect.height,
      window.devicePixelRatio,
      this.renderQuality,
    );
    if (Math.abs(this.renderer.getPixelRatio() - ratio) > 0.005)
      this.renderer.setPixelRatio(ratio);
    this.canvas.dataset.quality = `${this.renderQuality}${this.resolution.software ? "-software" : ""}`;
    this.canvas.dataset.pixelRatio = ratio.toFixed(2);
    this.renderer.setSize(rect.width, rect.height, false);
    this.camera.aspect = rect.width / rect.height;
    // Cabinet view with enough tilt to reveal raised ramps without hiding the fan.
    this.camera.position.set(0, 2050, 560);
    this.camera.lookAt(0, 0, 0);
    this.camera.updateMatrixWorld();
    this.camera.updateProjectionMatrix();
    // Fit all table corners in NDC; responsive without cropping the launch lane.
    for (let i = 0; i < 3; i++) {
      let extent = 0;
      for (const x of [-310, 310])
        for (const z of [-510, 515])
          for (const y of [0, 70]) {
            const p = new THREE.Vector3(x, y, z).project(this.camera);
            extent = Math.max(
              extent,
              Math.abs(p.x) / 0.98,
              Math.abs(p.y) / 0.975,
            );
          }
      this.camera.position.multiplyScalar(extent);
      this.camera.lookAt(0, 0, 0);
      this.camera.updateMatrixWorld();
    }
  }
  draw(e: PinballEngine, settings: GameSettings, now: number) {
    if (this.disposed || this.renderer.getContext().isContextLost()) return;
    const frameTime = now - this.last || 0.016;
    const dt = Math.min(0.05, frameTime);
    this.last = now;
    if (this.renderQuality !== settings.renderQuality) {
      this.renderQuality = settings.renderQuality;
      this.resolution.reset();
      this.resize();
    }
    if (this.resolution.observe(frameTime, now, this.renderQuality))
      this.resize();
    for (const [i, f] of [e.left, e.right].entries())
      this.flippers[i].rotation.y = -f.angle;
    this.bumpers.forEach((g, i) => {
      const p = BUMPERS[i],
        flash = e.flashes.findLast((f) => f.x === p.x && f.y === p.y);
      const t = flash ? Math.max(0, 1 - (e.clock - flash.time) / 0.16) : 0;
      g.position.y = -5 * t;
    });
    this.targets.forEach((g, i) => {
      g.position.y = THREE.MathUtils.damp(
        g.position.y,
        e.targetBank[i] ? -25 : 0,
        24,
        dt,
      );
    });
    const scoop = e.balls.some((b) => b.path?.kind === "scoop");
    const wormHeight = this.worm.position.y;
    this.worm.position.y = THREE.MathUtils.damp(
      wormHeight,
      scoop ? 33 : 6,
      8,
      dt,
    );
    if (Math.abs(wormHeight - this.worm.position.y) > 0.4)
      this.renderer.shadowMap.needsUpdate = true;
    this.harvester.rotation.y = settings.reducedMotion
      ? 0
      : Math.sin(e.clock * 0.55) * 0.035;
    this.harvester.position.y =
      108 +
      (e.balls.some((b) => b.path?.shot === "harvest") &&
      !settings.reducedMotion
        ? Math.sin(e.clock * 40) * 1.4
        : 0);
    for (let i = 0; i < 2; i++) {
      const shot = i ? "dune" : "harvest";
      const b = e.balls.find(
        (b) => b.path?.shot === shot && b.path.elapsed < 0.23,
      );
      this.gates[i].rotation.x = THREE.MathUtils.damp(
        this.gates[i].rotation.x,
        b ? -1.4 : 0,
        22,
        dt,
      );
      const orbit = e.balls.some(
        (b) =>
          b.path?.shot === (i ? "storm" : "caravan") && b.path.elapsed < 0.4,
      );
      if (orbit) this.spinnerAngles[i] = 24;
      this.spinners[i].rotation.x += this.spinnerAngles[i] * dt;
      this.spinnerAngles[i] *= Math.exp(-dt * 2.2);
    }
    for (const lamp of this.lamps) {
      const selected = lamp.shot === SHOT_ORDER[e.prescienceIndex];
      const mode =
        lamp.shot &&
        e.mode &&
        MODE_ORDER.includes(e.mode as (typeof MODE_ORDER)[number]) &&
        modeTarget(
          e.mode as (typeof MODE_ORDER)[number],
          lamp.shot,
          SHOT_ORDER[e.prescienceIndex],
        );
      const completed =
        lamp.mode !== undefined && e.completed.has(MODE_ORDER[lamp.mode]);
      const activeMode =
        lamp.mode !== undefined && e.mode === MODE_ORDER[lamp.mode];
      const locked =
        lamp.lock !== undefined &&
        (lamp.lock < e.locks || e.mode === "multiball");
      const saved = lamp.save && e.saveUntil > e.clock;
      const bright =
        !e.tilted &&
        (selected || mode || completed || activeMode || locked || saved);
      lamp.mat.color.set(bright ? "#9f7951" : "#23343a");
      lamp.mat.emissive.set(
        mode || activeMode || saved ? "#70c5f6" : "#e88d2c",
      );
      lamp.mat.emissiveIntensity = bright
        ? settings.reducedMotion || completed
          ? 1.2
          : 0.8 + Math.sin(now * 6) * 0.35
        : 0.035;
    }
    for (const light of this.routeLights) {
      const ball = e.balls.find((b) => b.path?.shot === light.shot);
      const p = ball?.path ? ball.path.elapsed / ball.path.duration : -1;
      (light.mesh.material as THREE.MeshBasicMaterial).opacity =
        p >= 0 && Math.abs(p - light.t) < 0.15 ? 1 : 0.08;
    }
    const ids = new Set(e.balls.map((b) => b.id));
    for (const [id, item] of this.balls)
      if (!ids.has(id)) {
        for (const obj of [item.ball, item.shadow, item.trail]) {
          this.scene.remove(obj);
          obj.geometry.dispose();
        }
        (item.shadow.material as THREE.Material).dispose();
        (item.trail.material as THREE.Material).dispose();
        this.balls.delete(id);
      }
    for (const b of e.balls) {
      let item = this.balls.get(b.id);
      if (!item) {
        const ball = this.mesh(
          new THREE.SphereGeometry(10, 24, 18),
          this.steel,
          V(b.x, b.y, 10),
          this.scene,
        );
        ball.castShadow = false; // A height-aware contact shadow below follows every frame.
        const shadow = this.mesh(
          new THREE.CircleGeometry(12, 24),
          new THREE.MeshBasicMaterial({
            color: "#080a0e",
            transparent: true,
            opacity: 0.28,
            depthWrite: false,
          }),
          V(b.x, b.y, 0.9),
          this.scene,
        );
        shadow.rotation.x = -Math.PI / 2;
        shadow.castShadow = false;
        const trail = new THREE.Line(
          new THREE.BufferGeometry().setAttribute(
            "position",
            new THREE.BufferAttribute(new Float32Array(18), 3).setUsage(
              THREE.DynamicDrawUsage,
            ),
          ),
          new THREE.LineBasicMaterial({
            color: "#e5f2ec",
            transparent: true,
            opacity: 0.22,
          }),
        );
        trail.frustumCulled = false;
        trail.geometry.setDrawRange(0, 0);
        this.scene.add(trail);
        item = { ball, shadow, trail };
        this.balls.set(b.id, item);
      }
      const h = ballHeight(b);
      item.ball.position.copy(V(b.x, b.y, h));
      item.ball.rotation.x += (b.vy * dt) / 10;
      item.ball.rotation.z -= (b.vx * dt) / 10;
      item.shadow.position.copy(
        V(
          b.x + Math.max(0, h - 10) * 0.17,
          b.y + Math.max(0, h - 10) * 0.18,
          0.8,
        ),
      );
      item.shadow.scale.setScalar(1 + Math.max(0, h - 10) / 80);
      (item.shadow.material as THREE.MeshBasicMaterial).opacity = Math.max(
        0.08,
        0.28 - h / 700,
      );
      item.shadow.visible = h >= 0;
      item.trail.visible =
        settings.ballTrail && !settings.reducedMotion && !b.waiting && !b.path;
      if (item.trail.visible) {
        const positions = item.trail.geometry.getAttribute(
          "position",
        ) as THREE.BufferAttribute;
        const count = Math.min(6, b.trail.length);
        for (let i = 0; i < count; i++) {
          const p = b.trail[b.trail.length - count + i];
          positions.setXYZ(i, p.x - 300, 10, p.y - 500);
        }
        positions.needsUpdate = true;
        item.trail.geometry.setDrawRange(0, count);
      }
    }
    this.pulse.forEach((m, i) => {
      const f = e.flashes[i];
      m.visible = !!f && !settings.reducedMotion;
      if (!f) return;
      const t = (e.clock - f.time) / 0.55;
      m.position.copy(V(f.x, f.y, 2));
      m.scale.setScalar(1 + t * 2.4);
      (m.material as THREE.MeshBasicMaterial).opacity = (1 - t) * 0.5;
    });
    this.keyLight.intensity =
      e.mode === "multiball" || e.mode === "wizard" ? 1.8 : 2.6;
    this.renderer.render(this.scene, this.camera);
    this.canvas.dataset.route =
      e.balls.find((b) => b.path?.kind === "ramp")?.path?.shot ?? "ground";
    this.canvas.dataset.drawcalls = String(this.renderer.info.render.calls);
  }
  destroy() {
    this.disposed = true;
    const materials = new Set<THREE.Material>();
    this.scene.traverse((o) => {
      if (o instanceof THREE.Mesh || o instanceof THREE.Line) {
        o.geometry.dispose();
        (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) =>
          materials.add(m),
        );
      }
    });
    materials.forEach((m) => m.dispose());
    this.textures.forEach((t) => t.dispose());
    this.environment.dispose();
    this.renderer.dispose();
  }
}
