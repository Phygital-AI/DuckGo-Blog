import { FULL_OBSTACLE_COURSE } from "./fullCourse.js";

const TURN_RADIUS = 5;
export const CIRCUIT_HALF_WIDTH = 3.2;
export const CIRCUIT_LANES = Object.freeze([-2.25, -.75, .75, 2.25]);
const TRANSVERSE_SCALE = .78;
const sections = [
  { length: 13, point: (distance) => [distance, -10], yaw: () => 0 },
  { length: Math.PI * TURN_RADIUS / 2, point: (distance) => [13 + TURN_RADIUS * Math.cos(-Math.PI / 2 + distance / TURN_RADIUS), -5 + TURN_RADIUS * Math.sin(-Math.PI / 2 + distance / TURN_RADIUS)], yaw: (distance) => distance / TURN_RADIUS },
  { length: 10, point: (distance) => [18, -5 + distance], yaw: () => Math.PI / 2 },
  { length: Math.PI * TURN_RADIUS / 2, point: (distance) => [13 + TURN_RADIUS * Math.cos(distance / TURN_RADIUS), 5 + TURN_RADIUS * Math.sin(distance / TURN_RADIUS)], yaw: (distance) => Math.PI / 2 + distance / TURN_RADIUS },
  { length: 26, point: (distance) => [13 - distance, 10], yaw: () => Math.PI },
  { length: Math.PI * TURN_RADIUS / 2, point: (distance) => [-13 + TURN_RADIUS * Math.cos(Math.PI / 2 + distance / TURN_RADIUS), 5 + TURN_RADIUS * Math.sin(Math.PI / 2 + distance / TURN_RADIUS)], yaw: (distance) => Math.PI + distance / TURN_RADIUS },
  { length: 10, point: (distance) => [-18, 5 - distance], yaw: () => -Math.PI / 2 },
  { length: Math.PI * TURN_RADIUS / 2, point: (distance) => [-13 + TURN_RADIUS * Math.cos(Math.PI + distance / TURN_RADIUS), -5 + TURN_RADIUS * Math.sin(Math.PI + distance / TURN_RADIUS)], yaw: (distance) => -Math.PI / 2 + distance / TURN_RADIUS },
  { length: 13, point: (distance) => [-13 + distance, -10], yaw: () => 0 },
];

export const CIRCUIT_LENGTH = sections.reduce((total, section) => total + section.length, 0);

export function circuitPointAt(distance, lateral = 0) {
  let remaining = ((distance % CIRCUIT_LENGTH) + CIRCUIT_LENGTH) % CIRCUIT_LENGTH;
  let section = sections[0];
  for (const candidate of sections) {
    section = candidate;
    if (remaining <= candidate.length) break;
    remaining -= candidate.length;
  }
  const point = section.point(remaining);
  const yaw = section.yaw(remaining);
  return { x: point[0] - Math.sin(yaw) * lateral, y: point[1] + Math.cos(yaw) * lateral, yaw, tangent: [Math.cos(yaw), Math.sin(yaw)] };
}

// Display names describe the physical obstacle, count, and only meaningful variants.
// Identical obstacle layouts intentionally share the same name across checkpoints.
const stageDefinitions = [
  ["launch", "两道收窄门", "2 NARROW GATES", "precision", "Two narrowing gates"],
  ["slalom", "五桩蛇形", "5-POST SLALOM", "steering", "Five-post slalom"],
  ["double-gate", "两道摆门", "2 SWING GATES", "timing", "Two swing gates"],
  ["finish", "一道摆门", "1 SWING GATE", "timing", "One swing gate"],
  ["sweep", "三根旋转扫杆", "3 SWEEP BARS", "timing", "Three rotating sweep bars"],
  ["shutters", "三道横移挡板", "3 SLIDING PANELS", "timing", "Three sliding panels"],
  ["clearance", "三道往复低杆（错相）", "3 LOW BARS / PHASED", "timing", "Three reciprocating low bars (staggered)"],
  ["rails", "六道分段低栏", "6 SEGMENTED LOW RAILS", "skill", "Six rows of segmented low rails"],
  ["chicane", "宽幅 S 通道", "WIDE S PASSAGE", "steering", "Wide S passage"],
  ["triple-gate", "三道摆门", "3 SWING GATES", "timing", "Three swing gates"],
  ["rotor", "旋转转盘阵", "ROTATING DISC ARRAY", "balance", "Nine counter-rotating contact-active turntables"],
  ["plateau", "逆向传送带", "REVERSE CONVEYOR", "strategy", "Walk against a real returning-slat conveyor"],
  ["pistons", "三道升降墙与安全停靠", "3 LIFT WALLS / 2 REFUGES", "strategy", "Three phased lift walls with two permanent safe refuges"],
  ["transit", "三道往复低杆（同步）", "3 LOW BARS / SYNC", "timing", "Three reciprocating low bars (synchronized)"],
  ["trough", "三道横移挡板", "3 SLIDING PANELS", "timing", "Three sliding panels (same mechanism as stage 6)"],
  ["apex", "七道全宽贴地横杆", "7 FULL-WIDTH GROUND BARS", "skill", "Seven full-width ground-level crossbars"],
];

const geometry = [];
const stages = [];
const stageLength = CIRCUIT_LENGTH / stageDefinitions.length;
const localPoint = (distance, lateral, height) => {
  const sample = circuitPointAt(distance, lateral);
  return { sample, pos: [sample.x, sample.y, height] };
};

for (const [index, [id, title, shortTitle, challenge, titleEn]] of stageDefinitions.entries()) {
  const startS = index * stageLength;
  const endS = (index + 1) * stageLength;
  const beginning = circuitPointAt(startS);
  const ending = circuitPointAt(endS);
  const center = circuitPointAt((startS + endS) / 2);
  const prefix = `circuit${index}_`;
  let count = 0;
  const addBox = (name, fraction, lateral, size, height = size[2], extra = {}) => {
    const distance = startS + stageLength * fraction;
    for (const [laneIndex, laneCenter] of CIRCUIT_LANES.entries()) {
      const { sample, pos } = localPoint(distance, laneCenter + lateral * TRANSVERSE_SCALE, height);
      const motion = extra.motion ? { ...extra.motion } : null;
      if (motion?.kind === "slide" && motion.direction?.[1]) motion.amplitude *= TRANSVERSE_SCALE;
      const localPos = extra.localPos ? [extra.localPos[0], extra.localPos[1] * TRANSVERSE_SCALE, extra.localPos[2]] : undefined;
      const descriptor = {
        type: "box", name: `${prefix}${name}_${count++}`, pos, size: [size[0], size[1] * TRANSVERSE_SCALE, size[2]],
        yaw: sample.yaw, color: "#e68149", collision: true, dynamic: false, circuitS: distance, laneIndex, laneCenter,
        ...extra, ...(index >= 6 ? { ownerStage: index + 1 } : {}), motion, ...(localPos ? { localPos } : {}),
      };
      geometry.push(descriptor);
    }
  };
  const addTrackBox = (name, fraction, lateral, size, height = size[2], extra = {}) => {
    const distance = startS + stageLength * fraction;
    const { sample, pos } = localPoint(distance, lateral, height);
    const motion = extra.motion ? { ...extra.motion } : null;
    const localPos = extra.localPos ? [...extra.localPos] : undefined;
    geometry.push({
      type: "box", name: `${prefix}${name}_${count++}`, pos,
      size: [...size], yaw: sample.yaw, color: "#e68149", collision: true,
      dynamic: false, circuitS: distance, laneIndex: -1, laneCenter: 0,
      fullTrackWidth: Math.abs(lateral) + size[1] >= CIRCUIT_HALF_WIDTH,
      ...extra, ...(index >= 6 ? { ownerStage: index + 1 } : {}), motion, ...(localPos ? { localPos } : {}),
    });
  };
  // Telescopic, floor-supported leaves: overlapping short cassettes keep the
  // outer edge fixed while the two inner edges translate together. No changing
  // mesh sizes, off-track leaf storage, overhead duck-under or collision proxy.
  const movingGap = (label, s, halfGap, amplitude, period, phase, split = false, cycle = null) => {
    const inner = split ? 1.01 : halfGap + .28, outer = 2.82, n = 13;
    for (const side of [-1, 1]) for (let j = 0; j < n; j++) {
      const u = j / (n - 1), lateral = side * (inner + (outer - inner) * u);
      boxAt(`${label}_cassette`, s + side * j * .002, lateral, [.045, .28, .19], .19, {
        color: side < 0 ? "#3f8992" : "#d69a4c", dynamic: true,
        mechanism: label, obstacleClock: { kind:"simulation", simulationScale:.5 }, motion: {kind:"slide", direction:[0,1,0], amplitude:(split ? .50 : amplitude)*(1-u), frequency:1/period, phase, ...(cycle ? {cycle} : {})},
      });
    }
    for (const side of [-1, 1]) {
      boxAt(`${label}_end_shoe`, s, side*2.94, [.12,.16,.045], .045, {color:"#596571"});
      boxAt(`${label}_end_post`, s, side*2.94, [.055,.055,.23], .23, {color:"#596571"});
    }
  };
  const narrowGate = (fraction, offset = 0, halfGap = .28) => {
    for (const side of [-1, 1]) addBox("gate_pier", fraction, offset + side * (halfGap + .10), [.13, .10, .30]);
  };
  const swingGate = (fraction, side, phase) => {
    addBox("gate_pivot", fraction, side * .82, [.09, .09, .36]);
    addBox("gate_leaf", fraction, side * .82, [.045, .69, .21], .26, {
      localPos: [0, -side * .69, 0], dynamic: true,
      motion: { kind: "swing", amplitude: 1.20, offset: 0, frequency: .12, phase },
    });
  };
  const sweepBar = (fraction, side, speed) => {
    addBox("rotor_pier", fraction, side * .72, [.07, .07, .16]);
    addBox("rotor_arm", fraction, side * .72, [.045, .62, .035], .24, {
      localPos: [0, -side * .62, 0], dynamic: true,
      motion: { kind: "rotate", speed, offset: index * .4 },
    });
  };
  const slider = (fraction, phase) => {
    const halfWidth = .48;
    addTrackBox("slider_panel", fraction, 0, [.12, halfWidth, .34], .34, {
      dynamic: true, fullTrackSweep: true,
      ...(index === 14 ? { obstacleClock: { kind: "simulation", simulationScale: .5 } } : {}),
      motion: {
        kind: "slide", amplitude: CIRCUIT_HALF_WIDTH - halfWidth, frequency: .06,
        phase: -Math.PI / 2 + phase, direction: [0, 1, 0],
      },
    });
  };
  // V2 is one shared physical route, not four overlapping copies. Sizes are
  // MuJoCo HALF extents. All distances below are stage-local metres.
  const waitingRegions = [];
  const routeProfile = [];
  const boxAt = (name, s, lateral, size, z = size[2], extra = {}) => {
    addTrackBox(name, s / stageLength, lateral, size, z, {
      ownerStage: index + 1, ...extra,
    });
  };
  const wait = (from, to, lateral = 0, halfWidth = .6, purpose = "alignment / recovery") => {
    waitingRegions.push(Object.freeze({ from, to, lateral, halfWidth, purpose }));
  };
  // Short tangent-aligned wall tiles follow bends, with no long chord cutting
  // through the inside of the turn. Only human stage 9 uses short S dividers.
  const flanks = (from, to, profile, label = "guide") => {
    const n = Math.ceil((to - from) / .16);
    for (let j = 0; j < n; j++) {
      const a = from + (to - from) * j / n;
      const b = from + (to - from) * (j + 1) / n;
      const s = (a + b) / 2;
      const [center, halfGap] = profile(s);
      for (const side of [-1, 1]) {
        const inner = center + side * halfGap;
        const outer = side * 3.10;
        boxAt(label, s, (inner + outer) / 2, [(b - a) / 2 + .015, Math.abs(outer - inner) / 2, .36]);
      }
      routeProfile.push({ s, center, halfGap });
    }
  };
  const opening = (s, center, halfGap, depth = .12, label = "opening_wall") => {
    if (id === "pistons") {
      // Match the lift's exact tangent plane: bend-following tiles can intrude
      // into a narrow moving opening. Two coplanar banks meet, never overlap it.
      for (const side of [-1, 1]) {
        const inner = center + side * halfGap, outer = side * 3.10;
        boxAt(label, s, (inner + outer) / 2, [depth / 2, Math.abs(outer - inner) / 2, .36]);
      }
      routeProfile.push({s, center, halfGap});
    } else flanks(s - depth / 2, s + depth / 2, () => [center, halfGap], label);
  };
  if (index >= 6) {
    if (id === "rails") {
      // Original stage 13: six rows, four short rails per row, with gaps between lanes.
      for (let row = 0; row < 6; row++) addBox("low_rail", .15 + row * .13, 0, [.028, .83, .026]);
    } else if (id === "chicane") {
      // Four short alternating collision openings; no shared-side bypass.
      for (let j = 0; j < 4; j++) opening(1.15 + j * 1.38, j % 2 ? -1.40 : 1.40, .45, .24, "s_divider");
      wait(.05, .70, 0, 2.5); wait(5.75, 6.4, 0, 2.5);
    } else if (id === "clearance" || id === "transit") {
      // Original stages 7/14 in place: staggered straight bars, synchronized bend bars.
      for (let j = 0; j < 3; j++) boxAt("reciprocal_low_gate", stageLength * (.18 + j * .32), 0, [.07, CIRCUIT_HALF_WIDTH, .035], .25, {
        dynamic: true,
        motion: { kind: "translate", amplitude: .72, frequency: .045, phase: id === "transit" ? 0 : j * Math.PI * .7, direction: [1, 0, 0] },
      });
    } else if (id === "apex") {
      for (let j = 0; j < 7; j++) boxAt("roll_bar", stageLength * (.12 + j * .125), 0, [.015, CIRCUIT_HALF_WIDTH, .02], .02, {
        color: j % 2 ? "#d88955" : "#b85d68",
      });
    } else if (id === "triple-gate") {
      for (let j = 0; j < 3; j++) swingGate(.24 + j * .25, j % 2 ? -1 : 1, j * Math.PI * .78);
    } else if (id === "rotor") {
      // Low circular native-hinge surfaces: angular qvel creates real friction.
      // Separate discs follow the bend rather than one long chord platform.
      for (let row=0;row<3;row++) for(let col=0;col<3;col++) {
        const localS=1.4+row*1.75, lateral=(col-1)*1.65;
        boxAt(`turntable_${row}_${col}`,localS,lateral,[col===2?.53:.73,.008],.006,{
          type:'cylinder',dynamic:true,terrainSurface:true,turntable:true,
          friction:[1,.005,.0001],nativeSurface:true,
          obstacleClock:{kind:'simulation',simulationScale:.5},
          motion:{kind:'rotate',speed:((row+col)%2?-1:1)*.648},
          color:(row+col)%2?'#d6994f':'#438e9b',
        });
      }
      // Short end shoes close the outer walking corridors without adding
      // continuous side walls. Small gap shoes close between-disc shortcuts.
      for(let row=0;row<3;row++)for(const [a,b] of [[-3.06,-2.40],[-.90,-.75],[.75,1.10],[2.20,3.06]]){
        boxAt('turntable_end_shoe',1.4+row*1.75,(a+b)/2,[.09,(b-a)/2,.10],.10,{
          terrainBarrier:true,turntableShoe:true,color:'#596571',
        });
      }
      wait(.05,.40,0,2.5,'observe counter-rotating discs');
      routeProfile.push(...[[.2,0],[1.4,0],[3.15,0],[4.9,0],[6.25,0]].map(([s,center])=>({s,center,halfGap:.55})));
    } else if (id === "plateau") {
      // Closed-loop slats return BELOW the exposed top. Native translation
      // joints supply contact velocity; no duck pose edits or texture trick.
      const belt={from:1.85,to:5.25,top:.054,bottom:.014,speed:.90};
      const loop=2*(belt.to-belt.from)+2*(belt.top-belt.bottom);
      const n=68;
      for(let j=0;j<n;j++) boxAt(`conveyor_slat_${j}`,belt.from,0,[loop/n/2+.001,2.96,.006],belt.top,{
        dynamic:true,terrainSurface:true,nativeSurface:true,conveyor:true,
        friction:[1,.005,.0001],color:j%4===0?'#d7ad54':'#438e9b',
        obstacleClock:{kind:'simulation',simulationScale:.5},
        motion:{kind:'belt',...belt,phase:j*loop/n},
      });
      // Gentle static access ramps remain outside the moving return envelopes.
      for(const [a,b,rise] of [[.85,1.85,true],[5.25,6.25,false]]){
        const p=circuitPointAt(startS+a),q=circuitPointAt(startS+b),len=Math.hypot(q.x-p.x,q.y-p.y);
        const h0=rise?.002:.060,h1=rise?.060:.002,w=2.90;
        boxAt('conveyor_access',(a+b)/2,0,[len/2,w,.03],0,{
          type:'terrainPrism',pos:[(p.x+q.x)/2,(p.y+q.y)/2,0],yaw:Math.atan2(q.y-p.y,q.x-p.x),
          vertices:[[-len/2,-w,.001],[len/2,-w,.001],[len/2,w,.001],[-len/2,w,.001],[-len/2,-w,h0],[len/2,-w,h1],[len/2,w,h1],[-len/2,w,h0]],
          faces:[0,2,1,0,3,2,4,5,6,4,6,7,0,1,5,0,5,4,1,2,6,1,6,5,2,3,7,2,7,6,3,0,4,3,4,7],
          terrainSurface:true,color:'#9b9b7a',
        });
      }
      wait(.30,.55,0,.5,'observe backward belt before mounting');
      routeProfile.push(...[[.4,0],[2,0],[4,0],[6.25,0]].map(([s,center])=>({s,center,halfGap:2.5})));
    } else if (id === "pistons") {
      // Same supported lift assembly, repeated three times. Two permanent
      // refuges lie between the full swept envelopes, including on this bend.
      // Positive lateral is true track-left. Last bend's existing rail OBB
      // limits that opening to +2.40 m; +2.45 m already intersects the rail.
      for (const [j,s,center] of [[0,1.35,2.50],[1,3.25,-2.50],[2,5.15,2.40]]) {
        opening(s,center,.50,.20,"transit_aperture");
        boxAt("transit_lift_group",s,center,[.10,.50,.60],.60,{
          dynamic:true,color:j?"#52b6bb":"#e6a34e",
          obstacleClock:{kind:"simulation",simulationScale:.5},
          motion:{kind:"slide",direction:[0,0,1],offset:.30,amplitude:.30,frequency:1/20,
            cycle:{start:1+j*20/3,segments:[
              {duration:2,from:-1,to:1,label:"rising"},
              {duration:8,from:1,to:1,label:"high / cross"},
              {duration:2,from:1,to:-1,label:"lowering"},
              {duration:8,from:-1,to:-1,label:"low / wait"},
            ]}},
        });
      }
      wait(.30,.75,-1,.65,"observe first lift wall");
      wait(1.95,2.65,-.5,.65,"first permanent safe refuge / wait for wall 2");
      wait(3.85,4.55,.5,.65,"second permanent safe refuge / wait for wall 3");
      wait(5.70,5.80,.6,.55,"exit recovery; leave room for unchanged stage14 sweep");
      routeProfile.push(...[[.4,-1],[1.35,2.50],[2.3,-.5],[3.25,-2.50],[4.2,.5],[5.15,2.40],[5.8,.6]].map(([s,center])=>({s,center,halfGap:[1.35,3.25,5.15].includes(s)?.50:.65})));
    } else if (id === "trough") {
      // Reuse the actual stage-6 helper: three single translating panels,
      // identical local positions, half extents, amplitude, frequency and phase.
      // No paired leaves, cassettes, shoes or invented surrounding walls.
      for (let obstacle = 0; obstacle < 3; obstacle++) slider(.20 + obstacle * .28, obstacle * Math.PI * .65);
      wait(.30,.65,0,.65,"observe the same three sliding panels as stage 6");
      wait(5.70,6.20,0,.65,"exit recovery");

    }
  } else if (id === "launch") {
    narrowGate(.62, 0, .42);
    narrowGate(.84, 0, .29);
  } else if (id === "slalom" || id === "weave") {
    for (let obstacle = 0; obstacle < 5; obstacle++) addBox("slalom_pylon", .16 + obstacle * .16, (obstacle % 2 ? 1 : -1) * .26, [.14, .14, .26]);
  } else if (id === "double-gate" || id === "triple-gate" || id === "finish") {
    const total = id === "triple-gate" ? 3 : id === "finish" ? 1 : 2;
    for (let obstacle = 0; obstacle < total; obstacle++) swingGate(.24 + obstacle * .25, obstacle % 2 ? -1 : 1, obstacle * Math.PI * .7);
  } else if (id === "apex") {
    // Match the verified roll-bar route: thin ground-level crossbars at
    // roughly 0.8 m spacing. The official roulade skill is available here.
    for (let obstacle = 0; obstacle < 7; obstacle++) {
      const fraction = .12 + obstacle * .125;
      addTrackBox("roll_bar", fraction, 0, [.015, CIRCUIT_HALF_WIDTH, .02], .02, {
        color: obstacle % 2 ? "#d88955" : "#b85d68",
      });
    }
  } else if (id === "precision") {
    for (let obstacle = 0; obstacle < 3; obstacle++) narrowGate(.23 + obstacle * .25, obstacle === 1 ? .20 : -.12, .27);
  } else if (id === "sweep" || id === "rotor") {
    for (let obstacle = 0; obstacle < 3; obstacle++) sweepBar(.20 + obstacle * .28, obstacle % 2 ? -1 : 1, (obstacle % 2 ? -1 : 1) * (id === "rotor" ? .68 : .42));
  } else if (id === "shutters" || id === "pistons") {
    for (let obstacle = 0; obstacle < 3; obstacle++) slider(.20 + obstacle * .28, obstacle * Math.PI * .65);
  } else if (id === "clearance" || id === "transit") {
    // Match the verified Map 4 reciprocal slider: a low, thin full-width bar
    // moves along the route, leaving a timing window instead of a static roof.
    // Keep the same slow cycle and stroke as that scene.
    for (let obstacle = 0; obstacle < 3; obstacle++) {
      const fraction = .18 + obstacle * .32;
      // End exactly at the 6.4 m track edges; the prior 3.25 m half-width
      // intruded 5 cm into the visual shoulder/kerb on both sides.
      addTrackBox("reciprocal_low_gate", fraction, 0, [.07, CIRCUIT_HALF_WIDTH, .035], .25, {
        dynamic: true,
        // Stage 14 lies on a tight bend. Independent phase offsets make the
        // tangential sweep envelopes cross, so its gates move in sync.
        motion: { kind: "translate", amplitude: .72, frequency: .045, phase: id === "transit" ? 0 : obstacle * Math.PI * .7, direction: [1, 0, 0] },
      });
    }
  } else if (id === "chicane") {
    for (let obstacle = 0; obstacle < 4; obstacle++) addBox("chicane_divider", .18 + obstacle * .20, (obstacle % 2 ? 1 : -1) * .50, [.085, .28, .22]);
  } else if (id === "rails") {
    for (let obstacle = 0; obstacle < 6; obstacle++) addBox("low_rail", .15 + obstacle * .13, 0, [.028, .83, .026]);
  }
  stages.push(Object.freeze({
    index, id, title, titleEn, shortTitle, challenge, startS, endS,
    start: [beginning.x, beginning.y], end: [ending.x, ending.y], center: [center.x, center.y], yaw: center.yaw,
    checkpoint: { x: ending.x, y: ending.y, tangent: ending.tangent, s: endS, halfWidth: CIRCUIT_HALF_WIDTH, title },
    geometryPrefix: prefix, obstacleXs: [], envId: `circuit_${id}`,
    ...(index >= 6 ? { routeMode: [10,11,12,14].includes(index) ? "strategy-scheduling" : "baseline-obstacles", waitingRegions: Object.freeze(waitingRegions), routeProfile: Object.freeze(routeProfile) } : {}),
    ...(index === 8 ? { help: "Four alternating collision walls: horizontal openings 0.90 m (previously three 2.60 m openings). Local s=1.15, 2.53, 3.91, 5.29 m; lateral centers +1.40, -1.40, +1.40, -1.40 m. Geometry-only preview; robot traversal untested." } : {}),
    ...([10,11,12,14].includes(index) ? { help: ({
      10: "Nine low circular turntables follow the bend in three rows. Native vertical hinge velocities transfer friction to feet; alternating directions rotate at 0.324 rad/s simulation time. Sparse asymmetric cream arcs and an arrow expose actual rotation. Isolated geometry/kinematic preview only; traversal at this new speed is untested.",
      11: "Reverse conveyor: contact-active slats move upstream at 0.45 m/s simulation time and return underneath. Gentle ramps provide access. The .45 m/s belt exceeds the walk command limit .25 m/s. Run gait is required for a traversal attempt and may still be insufficient; no gait or traversal validation has been run. No robot teleportation or applied root force.",
      12: "Three 1.00 m openings at local s=1.35, 3.25, 5.15 m: true track-left / right / left, lateral centers +2.50 / -2.50 / +2.40 m, edges [2.00,3.00] / [-3.00,-2.00] / [1.90,2.90] m. Third left opening limited by existing curved guardrail OBB. Longitudinal spacing unchanged at 1.90 m. Two permanent safe refuges and entrance waiting rectangle unchanged. Unchanged fast 40 simulation-second cycle: 16 s high, 4 s lowering, 16 s low, 4 s rising; evenly spaced 13⅓ s phase offsets. Observe clearance, cross one wall, stop in each refuge and schedule the next crossing. CPU planar scheduling is not robot gait qualification.",
      14: "Exactly the stage 6 mechanism: three single panels slide laterally across the track, at 20%, 48% and 76% of the stage. Same .12/.48/.34 m half extents, 2.72 m amplitude, .06 Hz raw frequency and staggered phases. Explicit .5 simulation clock matches the stage 6 race/showcase clock; legacy stage 6 practice timing is unchanged. No telescopic closing-door leaves. Choose a clear side and time each panel crossing. Selected-phase CPU evidence is not all-phase or visual acceptance.",
    })[index] } : {}),
  }));
}

const path = [[0, -10]];
let distance = 0;
for (const section of sections) {
  const count = Math.ceil(section.length / .28);
  for (let index = 1; index <= count; index++) {
    const sample = circuitPointAt(distance + section.length * index / count);
    path.push([sample.x, sample.y]);
  }
  distance += section.length;
}
path[path.length - 1] = [0, -10];
const spawn = circuitPointAt(.12);
const gridSlots = Array.from({ length: 20 }, (_, index) => {
  const row = Math.floor(index / 4);
  const column = index % 4;
  const distance = 3.25 - row * .68;
  const lateral = CIRCUIT_LANES[column];
  const point = circuitPointAt(distance, lateral);
  return Object.freeze({ id: index + 1, row, column, s: distance, lateral, x: point.x, y: point.y, yaw: point.yaw, boxLength: .48, boxWidth: .48 });
});

// Continuous low collision rails keep the robot physically inside the lane.
// Each short box overlaps its neighbours, including around the four bends, so
// the boundary has no openings while remaining cheap for MuJoCo to simulate.
const guardrailGeometry = [];
for (let distance = 0, segment = 0; distance < CIRCUIT_LENGTH; segment += 1) {
  const nextDistance = Math.min(distance + .72, CIRCUIT_LENGTH);
  const a = circuitPointAt(distance);
  const b = circuitPointAt(nextDistance);
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const length = Math.hypot(dx, dy);
  const normal = [-dy / length, dx / length];
  const yaw = Math.atan2(dy, dx);
  const centerX = (a.x + b.x) / 2;
  const centerY = (a.y + b.y) / 2;
  for (const side of [-1, 1]) {
    guardrailGeometry.push(Object.freeze({
      type: "box", name: `course_guardrail_${side < 0 ? "right" : "left"}_${String(segment).padStart(3, "0")}`,
      pos: [centerX + normal[0] * (CIRCUIT_HALF_WIDTH - .04) * side, centerY + normal[1] * (CIRCUIT_HALF_WIDTH - .04) * side, .35],
      size: [length + .08, .10, .70], yaw, collision: true, dynamic: false,
      boundaryRail: true, laneIndex: -1, circuitS: distance,
    }));
  }
  distance = nextDistance;
}

export const GAUNTLET_CIRCUIT = Object.freeze({
  ...FULL_OBSTACLE_COURSE,
  id: "gauntlet_gp_v2", title: "Microduck 极限环线 GP V2", name: "GAUNTLET GP / CIRCUIT 02", category: "环形综合障碍赛",
  description: "独立 V2：第13关增加第三道同款升降墙和两处安全停靠；第15关完全复用第6关三道横移挡板。其余14关、6.4m边界和发车格保持V12不变。",
  abilities: ["长程路线保持", "连续弯道", "多周期动态窗口", "窄门定位", "姿态切换", "连续技能与恢复"],
  metrics: ["有序检查门完成数", "有效弧长进度", "正向整圈完成", "执行时间", "跌倒与越界"],
  spawn: Object.freeze({ x: spawn.x, y: spawn.y, z: .12, yaw: spawn.yaw }),
  goal: Object.freeze({ x: 0, y: -10, z: 0, radius: .3 }),
  geometry: Object.freeze([...geometry, ...guardrailGeometry]),
  checkpoints: Object.freeze(stages.map((stage) => stage.checkpoint)),
  course: Object.freeze({ halfWidth: CIRCUIT_HALF_WIDTH, spawnHeight: 0, goalHeight: 0, path }),
  circuit: Object.freeze({
    version: "gauntlet-gp-v2", layoutRevision: "lift-extremes-20261106T165526Z", resultNamespace: "gauntlet-gp-v2-lift-extremes-20261106T165526Z", lapLength: CIRCUIT_LENGTH, requiredLaps: 1,
    stageCount: stages.length, maxStepDistance: .5, bounds: { minX: -18, maxX: 18, minY: -10, maxY: 10 },
    obstacleChannels: CIRCUIT_LANES, trackWidth: CIRCUIT_HALF_WIDTH * 2,
    grid: Object.freeze({ capacity: 20, columns: 4, rows: 5, columnSpacing: 1.5, rowSpacing: .68, slots: Object.freeze(gridSlots) }),
    executionMode: "single-practice",
  }),
  fullCourse: Object.freeze({ name: "GAUNTLET GP V2", stages: Object.freeze(stages), routeLength: CIRCUIT_LENGTH, stageCount: stages.length }),
  timeLimitSteps: 180000,
});

export function circuitGridEntry(slotId) {
  const slot = gridSlots.find((entry) => entry.id === slotId);
  if (!slot) throw new RangeError("Grid slot must be an integer from 1 to 20");
  return { ...GAUNTLET_CIRCUIT, spawn: { x: slot.x, y: slot.y, z: GAUNTLET_CIRCUIT.spawn.z, yaw: slot.yaw }, gridSlot: slot.id };
}
