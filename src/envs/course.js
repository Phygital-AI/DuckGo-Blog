// Shared, deterministic kinematic motion: radians / metres / simulation seconds.
export function motionValue(m, t) {
 if (m.kind === 'rotate') return (m.offset ?? 0) + (m.speed ?? .65) * t;
  if (m.kind === 'linear') {
    const activeTime = Math.max(0, t - (m.delay ?? 0));
    const value = (m.offset ?? 0) + (m.speed ?? 0) * activeTime;
    return Math.max(m.min ?? -Infinity, Math.min(m.max ?? Infinity, value));
  }
 if (m.cycle) return (m.offset ?? 0) + (m.amplitude ?? 0) * cycleState(m.cycle, t).value;
 return (m.offset ?? 0) + (m.amplitude ?? 0) * Math.sin(2*Math.PI*(m.frequency ?? .1)*t + (m.phase ?? 0));
}
// Piecewise cycle in raw obstacle seconds; descriptor clock conversion belongs
// to geometryObstacleTime, never here. Linear transitions and exact stable dwells.
export function cycleState(cycle, time) {
 const duration = cycle.segments.reduce((sum, s) => sum + s.duration, 0);
 let remaining = ((time + (cycle.start ?? 0)) % duration + duration) % duration;
 for (const segment of cycle.segments) {
  if (remaining < segment.duration) return {
   value: segment.from + (segment.to - segment.from) * remaining / segment.duration,
   velocity: (segment.to - segment.from) / segment.duration,
   phase: segment.label, nextIn: segment.duration - remaining, duration,
  };
  remaining -= segment.duration;
 }
}
export function courseFor(id) {
 const raised=id.startsWith('water_');
 const slope=id==='lowfriction_wet-slope';
 const halfWidth=id==='crawl_door'?.15:id==='crawl_pipe'?.24:id==='crawl_mesh'?.4:.55;
  const longLowClearance = id.startsWith('lowclearance_');
  const rollBars = id === 'route_roll-bars';
  const finishX = longLowClearance ? 3.6 : rollBars ? 4.6 : 1.85;
 return {halfWidth, spawnHeight:raised?.3:0, goalHeight:raised?.3:slope?.24:0,
    path:id==='narrow_turn'?[[-1.9,0],[-.1,0],[-.1,.8],[1.85,.8]]:[[-1.9,0],[finishX,0]]};
}
export function outsideCourse(course, pose) {
  if(!course) return false;
 // A segmented route is inside when it is close to at least one segment.
 // Using every() here made any bend effectively impossible to traverse.
 if(course.segments) return !course.segments.some(s=>!outsideCourse({path:[s.a,s.b],halfWidth:s.halfWidth},pose));
  let nearest=Infinity;
  for(let i=1;i<course.path.length;i++) {
    const [ax,ay]=course.path[i-1], [bx,by]=course.path[i];
    const dx=bx-ax,dy=by-ay;
    const t=Math.max(0,Math.min(1,((pose.x-ax)*dx+(pose.y-ay)*dy)/(dx*dx+dy*dy)));
    nearest=Math.min(nearest,Math.hypot(pose.x-ax-t*dx,pose.y-ay-t*dy));
  }
  return nearest>course.halfWidth;
}
