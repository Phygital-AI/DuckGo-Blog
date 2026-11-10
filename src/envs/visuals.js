// Three.js visualization generated from the exact same geometry descriptors
// used by mjcf.js.  This is deliberately a thin presentation layer: it does
// not decide success and it does not replace MuJoCo collision geometry.

const toThree = ([x, y, z]) => [x, z, -y];
import {sampleGeometryPose,geometryObstacleTime} from './geometryPose.js';
import { createGoalFlag } from './goalFlag.js';
import { addChampionshipObstacleDetails, championshipMaterial } from './obstacleDetails.js';
import { createCircuitHardware, createSurfacePolish } from './circuitHardware.js';

export function createEnvironmentVisual(THREE, env, { championship = false } = {}) {
  const group = new THREE.Group();
  group.name = `environment_${env.id}`;
  const dynamic = [];
  const surfacePolish = env.circuit ? createSurfacePolish(THREE) : null;
  group.userData.disposeSurfacePolish = () => surfacePolish?.dispose();

  const materialFor = (geometry) => surfacePolish?.applies(geometry) ? surfacePolish.materialFor(geometry) : new THREE.MeshStandardMaterial({
    color: geometry.type === "water" ? 0x249cc7 : new THREE.Color(geometry.color ?? "#29445d"),
    emissive: geometry.type === "marker" ? 0x69de78 : geometry.type === "water" ? 0x073b61 : 0x071321,
    emissiveIntensity: geometry.type === "marker" ? 1.8 : geometry.type === "water" ? 0.32 : 0.2,
    roughness: geometry.type === "water" ? 0.3 : 0.76,
    metalness: geometry.type === "water" ? 0.1 : 0.14,
    transparent: geometry.type === "water" || geometry.type === "marker",
    opacity: geometry.type === "water" ? 0.62 : geometry.type === "marker" ? 0.5 : 1,
  });

  const lowGateLabelTexture = (() => {
    if (typeof document === "undefined" || !THREE.CanvasTexture) return null;
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 128;
    const context = canvas.getContext?.("2d");
    if (!context) return null;
    context.fillStyle = "#17232c";
    context.fillRect(5, 5, canvas.width - 10, canvas.height - 10);
    context.strokeStyle = "#e8dfc5";
    context.lineWidth = 5;
    context.strokeRect(7, 7, canvas.width - 14, canvas.height - 14);
    context.fillStyle = "#fff7db";
    context.font = "bold 72px sans-serif";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText("MOVING BAR", canvas.width / 2, canvas.height / 2);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace ?? texture.colorSpace;
    return texture;
  })();

  for (const geometry of env.geometry) {
    let mesh;
    if (geometry.type === 'terrainPrism') {
      const shape = new THREE.BufferGeometry();
      shape.setAttribute('position', new THREE.Float32BufferAttribute(geometry.vertices.flatMap(toThree), 3));
      shape.setIndex(geometry.faces);
      shape.computeVertexNormals();
      mesh = new THREE.Mesh(shape, materialFor(geometry));
    } else if (geometry.type === "cylinder") {
      const [radius, height] = geometry.size;
      mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, height, geometry.turntable && geometry.ownerStage === 11 ? 64 : 18), materialFor(geometry));
    } else if (geometry.name === "towel") {
      const [sx, sy] = geometry.size;
      const towelGeometry = new THREE.PlaneGeometry(sx * 2, sy * 2, 8, 4);
      const positions = towelGeometry.attributes.position;
      for (let i = 0; i < positions.count; i += 1) {
        const x = positions.getX(i);
        const y = positions.getY(i);
        positions.setZ(i, 0.003 * Math.sin((x + sx) * 85) * (0.4 + 0.6 * (y + sy) / (2 * sy)));
      }
      positions.needsUpdate = true;
      towelGeometry.computeVertexNormals();
      towelGeometry.rotateX(-Math.PI / 2);
      mesh = new THREE.Mesh(towelGeometry, materialFor(geometry));
    } else {
      const [sx, sy, sz] = geometry.size;
      mesh = new THREE.Mesh(new THREE.BoxGeometry(sx * 2, sz * 2, sy * 2), materialFor(geometry));
    }
    const initialPose = sampleGeometryPose(geometry, 0);
    mesh.position.set(...toThree(initialPose.position));
    mesh.name = geometry.name;
    if (championship) {
      if (!geometry.terrainSurface && !geometry.terrainBarrier) mesh.material = championshipMaterial(THREE, geometry);
      if (!env.circuit) addChampionshipObstacleDetails(THREE, mesh, geometry);
    }
    if (env.circuit && geometry.name.includes("reciprocal_low_gate")) {
      if (lowGateLabelTexture) {
        // Two single-sided planes per bar, back to back. A single DoubleSide
        // plane renders its reverse as mirrored text ("RAB GNIVOM"), which was
        // clearly readable from the spectator and chase cameras. Each face now
        // carries its own correctly-oriented copy.
        const [barHalfWidth] = geometry.size;
        const faceOffset = barHalfWidth + 0.004;
        // Three discrete plates per 6.4 m bar. The previous seven tiles at
        // .82 m wide with .9 m pitch nearly touched end to end, so the whole
        // bar read as one unbroken ribbon of text rather than signage.
        for (const [index, acrossBar] of [-2, 0, 2].entries()) {
          for (const facing of [1, -1]) {
            const decalMaterial = new THREE.MeshBasicMaterial({ map: lowGateLabelTexture, transparent: true, toneMapped: false, side: THREE.FrontSide, depthWrite: false });
            const label = new THREE.Mesh(new THREE.PlaneGeometry(1, 0.16), decalMaterial);
            label.name = `moving_low_bar_label_${index + 1}${facing < 0 ? "_reverse" : ""}`;
            label.position.set(faceOffset * facing, 0.11, acrossBar);
            label.rotation.y = Math.PI / 2 * facing;
            label.userData.facing = facing > 0 ? "positive-x" : "negative-x";
            mesh.add(label);
          }
        }
      }
    }
    if (geometry.name === "towel") {
      // The towel is a task object, not a translucent guide marker. It is a
      // rippled cloth surface with a contrasting woven-looking trim.
      mesh.material.color.set(0xf2c36e);
      mesh.material.emissive.set(0x6d3f12);
      mesh.material.emissiveIntensity = 0.35;
      mesh.material.transparent = false;
      mesh.material.opacity = 1;
      const trimMaterial = new THREE.MeshBasicMaterial({ color: 0xc9853e });
      for (let i = 0; i < 4; i += 1) {
        const stripe = new THREE.Mesh(new THREE.BoxGeometry(geometry.size[0] * 1.6, 0.003, 0.002), trimMaterial);
        stripe.position.set(0, 0.004, -geometry.size[1] * 0.55 + i * geometry.size[1] * 0.36);
        mesh.add(stripe);
      }
    }
    if (!geometry.dynamic || !geometry.motion) {
      // MuJoCo [x,y,z] -> Three [x,z,-y], including quaternion basis.
      const [w, x, y, z] = initialPose.quaternion;
      mesh.quaternion.set(x, z, -y, w);
    }
    mesh.castShadow = geometry.type !== "water";
    mesh.receiveShadow = geometry.type !== "water";
    mesh.userData.environmentGeometry = geometry;
    surfacePolish?.decorate(mesh, geometry);
    if (geometry.dynamic && geometry.motion) {
      const pivot=new THREE.Group(); pivot.position.copy(mesh.position);
      const [w,x,y,z] = initialPose.quaternion; pivot.quaternion.set(x,z,-y,w);
      mesh.position.set(...toThree(initialPose.localPos));
      mesh.rotation.set(0,0,0);
      pivot.add(mesh); group.add(pivot);
      dynamic.push({mesh:pivot,geometry});
    } else group.add(mesh);
  }

  // Paint only: small approach arrows and inset cassette seams. The collision
  // hardware remains exactly the descriptor meshes above, with no phantom rails.
  if (env.circuit) {
    const mechanisms = [...new Set(env.geometry.map(g => g.mechanism).filter(Boolean))];
    for (const mechanism of mechanisms) {
      const leaves = env.geometry.filter(g => g.mechanism === mechanism);
      const a = leaves[0], b = leaves[13], yaw = a.yaw;
      const centre = [(a.pos[0]+b.pos[0])/2,(a.pos[1]+b.pos[1])/2];
      for (const lateral of mechanism === 'route_switch' ? [-.85,.85] : [0]) {
        const paint = new THREE.BufferGeometry();
        paint.setAttribute('position',new THREE.Float32BufferAttribute([.16,0,0,-.10,0,-.09,-.10,0,.09],3));
        const arrow = new THREE.Mesh(paint,new THREE.MeshBasicMaterial({color:0xe9dfbf,side:THREE.DoubleSide,depthWrite:false}));
        arrow.name = `${mechanism}_approach_paint_${lateral}`;
        arrow.position.set(centre[0]-1.35*Math.cos(yaw)-lateral*Math.sin(yaw),.004,-centre[1]+1.35*Math.sin(yaw)-lateral*Math.cos(yaw));
        arrow.rotation.y=yaw;arrow.userData.visualOnly=true;group.add(arrow);
      }
    }
  }
  const hardware = env.circuit && championship ? createCircuitHardware(THREE, env.geometry) : null;
  if (hardware) group.add(hardware);
  const guideMaterial = new THREE.MeshStandardMaterial({ color: 0xbaf26e, emissive: 0x54e978, emissiveIntensity: 2.4, roughness: 0.25 });
  if (!championship) {
    const guideGeometry = new THREE.SphereGeometry(0.045, 12, 8);
    const guideCount = env.fullCourse ? 18 : 7;
    const routePath = env.course?.path?.length > 1
      ? env.course.path
      : [[env.spawn.x, env.spawn.y], [env.goal.x, env.goal.y]];
    const routeLengths = [0];
    for (let i = 1; i < routePath.length; i += 1) {
      const [ax, ay] = routePath[i - 1];
      const [bx, by] = routePath[i];
      routeLengths.push(routeLengths[i - 1] + Math.hypot(bx - ax, by - ay));
    }
    const routePointAt = (u) => {
      const target = routeLengths.at(-1) * u;
      const index = Math.max(1, routeLengths.findIndex((length) => length >= target));
      const a = routePath[index - 1];
      const b = routePath[index] ?? a;
      const span = routeLengths[index] - routeLengths[index - 1] || 1;
      const t = Math.max(0, Math.min(1, (target - routeLengths[index - 1]) / span));
      return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
    };
    for (let i = 0; i < guideCount; i += 1) {
      const u = i / (guideCount - 1);
      const [x, y] = routePointAt(u);
      const beacon = new THREE.Mesh(guideGeometry, guideMaterial);
      beacon.name = "route_beacon";
      beacon.position.set(x, Math.max(env.course?.spawnHeight??0,env.course?.goalHeight??0)+0.08, -y);
      beacon.userData.baseY = beacon.position.y;
      group.add(beacon);
    }
  }

  if (championship && !env.circuit) addChampionshipGroundMarkings(THREE, group, env);
  else if (!env.circuit) {
    const start = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.025, 1.35), new THREE.MeshBasicMaterial({ color: 0xffbd62 }));
    start.position.set(env.spawn.x, (env.course?.spawnHeight??0)+0.025, -env.spawn.y);
    group.add(start);
  }
  // The visible pole base and success radius share the same goal coordinates.
  if (!env.circuit) group.add(createGoalFlag(THREE, env, { championship }));

  if(env.course && !env.circuit) {
    const {path}=env.course;
    const height=Math.max(env.course.spawnHeight,env.course.goalHeight)+.012;
    const segments=env.course.segments??path.slice(1).map((b,i)=>({a:path[i],b,halfWidth:env.course.halfWidth}));
    for(const {a,b,halfWidth} of segments) {
      const [ax,ay]=a, [bx,by]=b;
      const length=Math.hypot(bx-ax,by-ay), angle=Math.atan2(by-ay,bx-ax);
      if (!championship) {
        const zone=new THREE.Mesh(new THREE.BoxGeometry(length,.002,halfWidth*2),new THREE.MeshBasicMaterial({color:0x47cfa9,transparent:true,opacity:.09,depthWrite:false}));
        zone.name = "route_zone";
        zone.position.set((ax+bx)/2,height-.006,-(ay+by)/2);zone.rotation.y=angle;group.add(zone);
      }
    }

    // Stitch route segments into polylines. Some composed routes list module
    // segments before their connectors, so join by shared endpoints instead
    // of trusting array order. The continuous tube border prevents visible
    // gaps where the route bends or changes module width.
    const remaining = segments.map(({a,b,halfWidth}) => ({a:[...a],b:[...b],halfWidth}));
    const closePoint = (a,b) => Math.hypot(a[0]-b[0],a[1]-b[1]) < 1e-4;
    const chains = [];
    while (remaining.length) {
      const first = remaining.shift();
      const chain = [{point:first.a,width:first.halfWidth},{point:first.b,width:first.halfWidth}];
      let extended = true;
      while (extended) {
        extended = false;
        const head = chain[0].point, tail = chain.at(-1).point;
        const index = remaining.findIndex(({a,b}) => closePoint(a,tail) || closePoint(b,tail) || closePoint(a,head) || closePoint(b,head));
        if (index < 0) continue;
        const edge = remaining.splice(index,1)[0];
        const edgeWidth = edge.halfWidth;
        if (closePoint(edge.a,tail)) chain.push({point:edge.b,width:edgeWidth});
        else if (closePoint(edge.b,tail)) chain.push({point:edge.a,width:edgeWidth});
        else if (closePoint(edge.b,head)) chain.unshift({point:edge.a,width:edgeWidth});
        else chain.unshift({point:edge.b,width:edgeWidth});
        extended = true;
      }
      chains.push(chain);
    }

    const boundaryMaterial = championship
      ? new THREE.MeshStandardMaterial({color:0xeadfc4,roughness:0.88,metalness:0.02})
      : new THREE.MeshBasicMaterial({color:0xffc857});
    for (const chain of chains) {
      if (chain.length < 2) continue;
      const offsetPoints = (side) => chain.map(({point,width},index) => {
        const previous = chain[Math.max(0,index-1)].point;
        const next = chain[Math.min(chain.length-1,index+1)].point;
        const dx0=point[0]-previous[0], dy0=point[1]-previous[1];
        const len0=Math.hypot(dx0,dy0)||1;
        const dx1=next[0]-point[0], dy1=next[1]-point[1];
        const len1=Math.hypot(dx1,dy1)||1;
        const n0=[-dy0/len0,dx0/len0], n1=[-dy1/len1,dx1/len1];
        if (index===0) return [point[0]+n1[0]*width*side,point[1]+n1[1]*width*side];
        if (index===chain.length-1) return [point[0]+n0[0]*width*side,point[1]+n0[1]*width*side];
        let mx=n0[0]+n1[0], my=n0[1]+n1[1], mlen=Math.hypot(mx,my);
        if (mlen<1e-5) { mx=n1[0]; my=n1[1]; mlen=1; }
        mx/=mlen; my/=mlen;
        const denom=mx*n1[0]+my*n1[1];
        const scale=Math.min(width*2.5,width/Math.max(.25,Math.abs(denom)))*side;
        return [point[0]+mx*scale,point[1]+my*scale];
      });
      for (const side of [-1,1]) {
        const points=offsetPoints(side).map(([x,y])=>new THREE.Vector3(x,height,-y));
        const curve=new THREE.CatmullRomCurve3(points,false,"centripetal");
        const length=chain.slice(1).reduce((sum,item,index)=>sum+Math.hypot(item.point[0]-chain[index].point[0],item.point[1]-chain[index].point[1]),0);
        const borderRadius = championship ? .0045 : .008;
        const border=new THREE.Mesh(new THREE.TubeGeometry(curve,Math.max(8,Math.ceil(length*18)),borderRadius,5,false),boundaryMaterial);
        border.name=`route_boundary_${side}`;
        group.add(border);
      }
    }
  }

  for(const [i,cp] of (env.circuit ? [] : env.checkpoints??[]).entries()) {
    const line=new THREE.Mesh(new THREE.BoxGeometry(.03,.012,cp.halfWidth*2), championship ? new THREE.MeshStandardMaterial({color:0xc8b392,roughness:.9}) : new THREE.MeshBasicMaterial({color:0x62e7f3}));
    line.position.set(cp.x,.02,-cp.y);group.add(line);
    if (!championship) {
      // DOM-free numbered markers can also be constructed in Node regression tests.
      for(let n=0;n<=i;n++) {
        const dot=new THREE.Mesh(new THREE.SphereGeometry(.025,8,6),guideMaterial);
        dot.name = "checkpoint_dot";
        dot.position.set(cp.x,.11+n*.065,-cp.halfWidth-.08);group.add(dot);
      }
    }
  }

  group.userData.update = (time = 0, {simulationTime = null, legacyScale = 1} = {}) => {
    hardware?.userData.update(time, {simulationTime, legacyScale});
    for (const item of dynamic) {
      const { mesh, geometry } = item;
      const pose = sampleGeometryPose(geometry, simulationTime === null ? time : geometryObstacleTime(geometry, simulationTime, legacyScale));
      mesh.position.set(...toThree(pose.position));
      const [w,x,y,z] = pose.quaternion;
      mesh.quaternion.set(x,z,-y,w);
    }
    group.children.filter((child) => child.userData.baseY !== undefined).forEach((child) => {
      child.position.y = child.userData.baseY + 0.018 * Math.sin(time * 3 + child.position.x);
    });
  };
  return group;
}

function addChampionshipGroundMarkings(THREE, group, env) {
  const courseHeight = Math.max(env.course?.spawnHeight ?? 0, env.course?.goalHeight ?? 0) + 0.003;
  const markingMaterial = new THREE.MeshStandardMaterial({ color: 0xeadfc4, roughness: 0.7, metalness: 0.05 });
  const accentMaterial = new THREE.MeshStandardMaterial({ color: 0xa66a35, roughness: 0.35, metalness: 0.76 });
  const stripeGeometry = new THREE.BoxGeometry(0.035, 0.004, 0.11);
  const groundTexture = createChampionshipMarkingTexture(THREE);
  const addMarking = (name, point) => {
    const marking = new THREE.Group();
    marking.name = name;
    marking.position.set(point.x, courseHeight, -point.y);
    if (groundTexture) {
      const surface = new THREE.Mesh(new THREE.PlaneGeometry(0.38, 0.16), new THREE.MeshStandardMaterial({ map: groundTexture, roughness: 0.72, metalness: 0.04 }));
      surface.name = "championship_ground_texture";
      surface.rotation.x = -Math.PI / 2;
      marking.add(surface);
      group.add(marking);
      return;
    }
    for (let index = -4; index <= 4; index += 1) {
      const stripe = new THREE.Mesh(stripeGeometry, index % 2 === 0 ? markingMaterial : accentMaterial);
      stripe.position.x = index * 0.04;
      marking.add(stripe);
    }
    group.add(marking);
  };
  addMarking("championship_start_marking", env.spawn);
  addMarking("championship_finish_marking", env.goal);
}

function createChampionshipMarkingTexture(THREE) {
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 48;
  const context = canvas.getContext("2d");
  if (!context) return null;
  context.fillStyle = "#eadfc4";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "#a66a35";
  for (let index = 0; index < 8; index += 1) {
    if (index % 2 === 1) context.fillRect(index * 16, 0, 16, canvas.height);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
