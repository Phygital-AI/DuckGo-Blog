import { sampleGeometryPose, geometryObstacleTime } from "./geometryPose.js";
import { circuitPointAt } from "./gauntletCircuit.js";

// V19 warm charcoal surfaces and cream motion indications. Only the paired
// access boards retain orange; all existing shapes and ground exclusions stay.
export const SURFACE_POLISH_PALETTE = Object.freeze({
  blue: 0x45413d, lightGray: 0xfff3de, slate: 0x302d2a,
  darkGray: 0x302d2a, rubber: 0x45413d,
});

// Full-width stage regions, not individual obstacle footprints. Fine convex
// cells follow the bend; a 0.1mm guard covers chord/Float32 error and boundaries.
export function surfaceStageRegions(env) {
  const stages = env.fullCourse?.stages?.filter(s => [10,11].includes(s.index) && env.geometry?.some(g => g.ownerStage === s.index+1 && (g.turntable || g.conveyor))) ?? [];
  const cells = [], guard = .0001, width = (env.course?.halfWidth ?? 3.2) + guard;
  for (const stage of stages) {
    const count = Math.ceil((stage.endS-stage.startS)/.1);
    for (let i=0;i<count;i++) {
      const a=stage.startS+(stage.endS-stage.startS)*i/count-guard;
      const b=stage.startS+(stage.endS-stage.startS)*(i+1)/count+guard;
      cells.push([[a,-width],[b,-width],[b,width],[a,width]].map(([s,l])=>{
        const p=circuitPointAt(s,l);return [p.x,-p.y];
      }));
    }
  }
  return cells;
}

export function excludeSurfaceStagePaint(vertices, regions) {
  if (!regions.length) return vertices;
  let triangles=[];
  for(let i=0;i<vertices.length;i+=9)triangles.push([vertices.slice(i,i+3),vertices.slice(i+3,i+6),vertices.slice(i+6,i+9)]);
  for(const polygon of regions) {
    const xs=polygon.map(p=>p[0]),zs=polygon.map(p=>p[1]);
    const minX=Math.min(...xs),maxX=Math.max(...xs),minZ=Math.min(...zs),maxZ=Math.max(...zs),result=[];
    for(const triangle of triangles) {
      if(Math.max(...triangle.map(p=>p[0]))<minX||Math.min(...triangle.map(p=>p[0]))>maxX||Math.max(...triangle.map(p=>p[2]))<minZ||Math.min(...triangle.map(p=>p[2]))>maxZ){result.push(triangle);continue;}
      let inside=triangle;
      for(let edge=0;edge<polygon.length&&inside.length;edge++) {
        const a=polygon[edge],b=polygon[(edge+1)%polygon.length];
        // Cells are clockwise in Three's x/z plane: interior is to the right.
        const distance=p=>(b[0]-a[0])*(p[2]-a[1])-(b[1]-a[1])*(p[0]-a[0]);
        const clip=outside=>{
          const out=[];
          for(let k=0;k<inside.length;k++){
            const p=inside[k],q=inside[(k+1)%inside.length],dp=distance(p),dq=distance(q);
            const kp=outside?dp>=0:dp<=0,kq=outside?dq>=0:dq<=0;
            if(kp)out.push(p);
            if(kp!==kq){const t=dp/(dp-dq);out.push(p.map((v,j)=>v+(q[j]-v)*t));}
          }
          return out;
        };
        const outside=clip(true),remainder=clip(false);
        for(let k=1;k<outside.length-1;k++)result.push([outside[0],outside[k],outside[k+1]]);
        inside=remainder;
      }
    }
    triangles=result;
  }
  return triangles.flat(2);
}

export function createSurfacePolish(THREE) {
  const resources=new Set(),own=value=>{resources.add(value);return value;};
  const p=SURFACE_POLISH_PALETTE;
  const material=(color,roughness,metalness)=>own(new THREE.MeshStandardMaterial({color,roughness,metalness}));
  const materials={blue:material(p.blue,.76,.14),slate:material(p.slate,.76,.14),rubber:material(p.blue,.87,.06),lightGray:material(p.lightGray,.78,.04)};
  // Retain the existing edge draw group and finish, but remove orange strips.
  const beltEdge=material(p.rubber,.48,.2);
  // Paired full-width access boards: color-only change; retain their finish.
  const accessOrange=material(0xff7238,.76,.14);
  const sign=own(new THREE.MeshStandardMaterial({color:p.lightGray,roughness:.78,metalness:.04}));
  const beltMaterials=[materials.rubber,beltEdge];
  const beltShapes=new Map();
  const arrows=new Map();
  const paint=vertices=>{const g=own(new THREE.BufferGeometry());g.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));g.computeVertexNormals();return g;};
  const applies=g=>(g.ownerStage===11&&(g.turntable||g.turntableShoe))||(g.ownerStage===12&&(g.conveyor||g.name.includes('conveyor_access')));
  return {
    applies,
    materialFor(g){return g.conveyor?materials.rubber:g.turntable?materials.blue:g.ownerStage===12&&g.name.includes('conveyor_access')?accessOrange:materials.slate;},
    decorate(mesh,g){
      if(!applies(g))return;
      const [sx,sy,sz]=g.size;
      if(g.conveyor){
        // No separate side boards exist: partition the SAME box surface.
        // Two 12cm edge strips and lateral faces; no rim, overlay or new volume.
        const key=g.size.join('/');
        if(!beltShapes.has(key)){
          const box=own(new THREE.BoxGeometry(2*sx,2*sz,2*sy,1,1,3));
          const positions=box.attributes.position;
          for(let i=0;i<positions.count;i++){
            const z=positions.getZ(i);
            if(Math.abs(z)<sy*.9)positions.setZ(i,Math.sign(z)*(sy-.12));
          }
          positions.needsUpdate=true;box.clearGroups();
          const ids=box.index.array,faces=[[],[]];
          for(let i=0;i<ids.length;i+=3){
            const z=[0,1,2].reduce((s,k)=>s+positions.getZ(ids[i+k]),0)/3;
            faces[Math.abs(z)>sy-.120001?1:0].push(...ids.slice(i,i+3));
          }
          box.setIndex(faces.flat());
          box.addGroup(0,faces[0].length,0);box.addGroup(faces[0].length,faces[1].length,1);
          beltShapes.set(key,box);
        }
        mesh.geometry.dispose();mesh.geometry=beltShapes.get(key);mesh.material=beltMaterials;
      }
      let geometry,label,y;
      if(g.turntable){
        const sign=Math.sign(g.motion.speed);
        if(!arrows.has(sign)){
          // One short rotation arrow and one truly centered round dot.
          // Flat cream ink only: no arc patches, rings, rays or raised trim.
          const points=[],point=(a,r)=>[r*Math.cos(a),0,-r*Math.sin(a)];
          const arc=(start,length,inner,outer,steps)=>{
            for(let k=0;k<steps;k++){
              const a=sign*(start+k*length/steps),b=sign*(start+(k+1)*length/steps);
              const v=[point(a,inner),point(a,outer),point(b,outer),point(b,inner)];
              points.push(...(sign>0?[0,1,2,0,2,3]:[0,2,1,0,3,2]).flatMap(i=>v[i]));
            }
          };
          arc(-.50,1.00,.57,.63,24);
          const a=sign*.50,tip=point(a+sign*.22,.60),inner=point(a,.49),outer=point(a,.71);
          points.push(...(sign>0?[inner,outer,tip]:[inner,tip,outer]).flat());
          for(let k=0;k<32;k++)points.push(0,0,0,...point(k*2*Math.PI/32,.045),...point((k+1)*2*Math.PI/32,.045));
          arrows.set(sign,paint(points));
        }
        geometry=arrows.get(sign);label='rotation_arrow';y=g.size[1]/2+.0005;
      }else if(g.conveyor&&Number(/conveyor_slat_(\d+)_/.exec(g.name)?.[1])%4===0){
        if(!arrows.has('belt')){
          const vertices=[];
          // One broad, solid chevron per four slats: 68/4 closes the loop
          // with uniform spacing. All vertices remain on its actual parent.
          // The tip is -local X, matching the exposed run's negative qvel.
          const a=-sx*.8,b=sx*.8,w=.55,t=.032;
          const polygon=[[a,0],[b,-w],[b,-w+.18],[a+t,0],[b,w-.18],[b,w]];
          for(let k=1;k<polygon.length-1;k++)vertices.push(...[polygon[0],polygon[k+1],polygon[k]].flatMap(([x,z])=>[x,0,z]));
          arrows.set('belt',paint(vertices));
        }
        geometry=arrows.get('belt');label='reverse_chevrons';y=sz+.0005;
      }else return;
      const child=new THREE.Mesh(geometry,g.conveyor?sign:materials.lightGray);
      child.name=`${mesh.name}_${label}`;child.position.y=y;
      child.userData={visualOnly:true,surfacePolish:g.conveyor?'v18':'v21',ownerStage:g.ownerStage};
      if(g.turntable){child.scale.set(sx,1,sx);child.userData.rotationSign=Math.sign(g.motion.speed);}
      else child.userData.direction=[-1,0,0];
      mesh.add(child);
    },
    dispose(){for(const r of resources)r.dispose();resources.clear();},
  };
}

export function createCircuitHardware(THREE, descriptors) {
  const hardwareDescriptors = descriptors.filter((descriptor) => !descriptor.boundaryRail && !descriptor.terrainSurface && !(descriptor.ownerStage === 11 && descriptor.turntableShoe));
  const group = new THREE.Group();
  group.name = "circuit_instanced_hardware";
  group.userData.visualOnly = true;
  const material = new THREE.MeshStandardMaterial({ color: 0x7ce1e9, emissive: 0x248291, emissiveIntensity: .24, roughness: .3, metalness: .65 });
  const batch = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), material, hardwareDescriptors.length * 2);
  batch.name = "circuit_hardware_inlays";
  batch.frustumCulled = false;
  batch.receiveShadow = true;
  batch.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  group.add(batch);
  const transform = new THREE.Object3D();
  const pivotRotation = new THREE.Quaternion();
  const pivotPosition = new THREE.Vector3();
  const localPosition = new THREE.Vector3();
  const yawRotation = new THREE.Euler();
  let previousTime = null;
  group.userData.update = (time = 0, {simulationTime = null, legacyScale = 1} = {}) => {
    const clockKey = `${time}/${simulationTime}/${legacyScale}`;
    if (clockKey === previousTime) return;
    hardwareDescriptors.forEach((geometry, index) => {
      if (previousTime !== null && !geometry.dynamic) return;
      const pose = sampleGeometryPose(geometry, simulationTime === null ? time : geometryObstacleTime(geometry, simulationTime, legacyScale));
      pivotPosition.set(pose.position[0], pose.position[2], -pose.position[1]);
      pivotRotation.setFromEuler(yawRotation.set(0, pose.worldYaw, -pose.pitch, "YXZ"));
      const offset = pose.localPos;
      for (let sideIndex = 0; sideIndex < 2; sideIndex++) {
        const side = sideIndex === 0 ? -1 : 1;
        localPosition.set(offset[0] + side * geometry.size[0] * .76, offset[2] + geometry.size[2] + .006, -offset[1]);
        transform.position.copy(localPosition.applyQuaternion(pivotRotation)).add(pivotPosition);
        transform.quaternion.copy(pivotRotation);
        transform.scale.set(Math.min(.025, geometry.size[0] * .2), .009, Math.max(.025, geometry.size[1] * 1.55));
        transform.updateMatrix();
        batch.setMatrixAt(index * 2 + sideIndex, transform.matrix);
      }
    });
    batch.instanceMatrix.needsUpdate = true;
    previousTime = clockKey;
  };
  group.userData.update(0);
  return group;
}
