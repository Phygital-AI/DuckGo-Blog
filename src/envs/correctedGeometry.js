// Metres, Z up. Box sizes are HALF extents. Used by both renderer and MuJoCo.
const box = (name, pos, size, extra = {}) => ({type: 'box', name, pos, size,
  collision: true, color: '#788577', dynamic: false, motion: null, ...extra});

// The robot's standing head/collar must intersect the panel, while the
// sitstand pose must have a visible clearance margin underneath it.  The
// previous panel bottom was 0.14 m, which was still inside the seated pose.
// Keep the same panel thickness and raise the whole obstacle so its bottom is
// 0.215 m above the floor: standing is blocked, sitting can pass.
const CRAWL_BAR_HALF_Z = 0.035;
const CRAWL_BAR_CENTER_Z = 0.215 + CRAWL_BAR_HALF_Z;

export function correctedGeometry(id, original) {
  if (id === 'route_roll-bars') {
    // A sequence of fixed bars spans the whole course width, so the robot
    // cannot simply route around them. They are deliberately low enough for
    // the official roulade policy. These are thin, low crossbars rather than
    // slabs: the scene tests a forward roll over a threshold, not collision
    // with a wide wall.
    const barXs = [-1.05, -.25, .55, 1.35, 2.15, 2.95, 3.75];
    return barXs.map((x, index) => box(
      `roll_bar_${index}`,
      [x, 0, .02],
      [.015, .55, .02],
      { color: index % 2 ? '#d88955' : '#b85d68' },
    ));
  }
  if (id === 'lowclearance_one-way') {
    // Three low horizontal bars rotate from the lane edge. Their underside
    // is at the same 0.215 m clearance as the verified crawl panels: the
    // seated pose fits beneath them, while the standing head/collar does not.
    // Leave enough longitudinal room to observe and handle one bar at a time.
    const bar = (name, x, color, offset) => [
      box(`${name}_post`, [x, -.48, .16], [.055, .055, .16], { color: '#8f6d45' }),
      box(name, [x, -.48, CRAWL_BAR_CENTER_Z], [.035, .44, CRAWL_BAR_HALF_Z], {
        color, dynamic: true, localPos: [0, .44, 0],
        motion: { kind: 'rotate', offset, speed: .82 },
      }),
    ];
    return [
      ...bar('crawl_rotate_bar_a', .5, '#bd6f72', 0),
      ...bar('crawl_rotate_bar_b', 2.0, '#d28a62', Math.PI * .66),
      ...bar('crawl_rotate_bar_c', 3.35, '#e7b85e', Math.PI * 1.32),
      box('crawl_marker_one_way', [-.15, 0, .012], [.035, .55, .012], { color: '#ffbf69', collision: false }),
    ];
  }
  if (id === 'lowclearance_reciprocal') {
    const panel = (name, x, color) => box(name, [x, 0, CRAWL_BAR_CENTER_Z], [.07, .62, CRAWL_BAR_HALF_Z], {
      color, dynamic: true,
      motion: { kind: 'translate', axis: 'x', offset: 0, amplitude: .72, frequency: .045 },
    });
    return [
      panel('crawl_slider_reciprocal_a', .45, '#8e78c4'),
      panel('crawl_slider_reciprocal_b', 2.25, '#667fc4'),
      box('crawl_marker_reciprocal', [-.15, 0, .012], [.035, .55, .012], { color: '#62e7f3', collision: false }),
    ];
  }
  if (id === 'route_skill-carry-kick') return [
    {type:'marker',name:'towel',pos:[-.75,0,.018],size:[.16,.11,.01],collision:false,color:'#f2c36e'},
    {type:'marker',name:'basket',pos:[.05,0,.08],size:[.22,.28,.08],collision:false,color:'#baf26e'},
    {type:'marker',name:'kick_zone',pos:[.72,0,.018],size:[.18,.5,.01],collision:false,color:'#ff8a76'},
  ];
  if(id==='dynamic_sweep') return [
    box('sweep_pedestal',[.35,0,.07],[.055,.055,.07],{color:'#ff9b40'}),
    box('sweep_arm',[.35,0,.105],[.72,.022,.022],{color:'#ff9b40',dynamic:true,motion:{kind:'rotate',speed:.65}}),
  ];
  if(id==='dynamic_swing') return [
    box('gate_post',[.35,-.55,.25],[.035,.035,.25],{color:'#f7c35f'}),
    // Body origin is the edge hinge; local leaf extends across the lane.
    box('gate_leaf',[.35,-.55,.22],[.022,.55,.22],{color:'#d99c43',dynamic:true,
      localPos:[0,.55,0],motion:{kind:'swing',offset:-Math.PI/4,amplitude:Math.PI/4,frequency:.025}}),
  ];
  if(id==='lowfriction_wet-slope') {
    const angle=Math.atan(.24/2), length=Math.hypot(2,.24);
    return [box('wet_ramp',[.1,0,.12-.02/Math.cos(angle)],[length/2,.7,.02],
      {color:'#4b7c8b',motion:{kind:'ramp',pitch:-angle},friction:[.18,.001,.0001]}),
      box('wet_exit',[1.7,0,.12],[.6,.7,.12],{color:'#4b7c8b',friction:[.18,.001,.0001]})];
  }
  if(id==='lowfriction_mud') {
    // Thin, irregular muddy contact surface, not a raised platform. Rigid approximation.
    const result=[box('mud_bed',[.35,0,.002],[1.15,.7,.002],{color:'#594332',friction:[.3,.005,.001]})];
    for(let i=0;i<24;i++) result.push(box(`mud_clod_${i}`,
      [-.7+(i%8)*.29,-.45+Math.floor(i/8)*.45,.004],
      [.08,.045,.004],{color:i%2?'#72543b':'#44362b',yaw:i*.7,friction:[.3,.005,.001]}));
    return result;
  }
  if(id.startsWith('water_')) {
    const depth=id==='water_shallow'?.035:.1;
    // Four pieces around a real recessed bed, no solid slab beneath the water surface.
    const result=[box('start_bank',[-1.525,0,.15],[.875,.85,.15]),
      box('finish_bank',[1.675,0,.15],[.725,.85,.15]),
      box('channel_bed',[.15,0,(.3-depth)/2],[.8,.85,(.3-depth)/2],{color:'#526858'}),
      { ...box('water_surface',[.15,0,.3-depth/2],[.8,.7,.002]),type:'water',collision:false}];
    for(const y of [-.79,.79]) result.push(box(`bank_side_${y}`,[.15,y,.15],[.8,.06,.15]));
    if(id==='water_steps') for(let i=0;i<3;i++) result.push(box(`submerged_step_${i}`,
      [-.4+i*.5,0,.2+(i+1)*.012],[.1,.7,(i+1)*.012],{color:'#84988e'}));
    return result;
  }
  if (id === 'crawl_mesh') {
    // A horizontal overhead lattice, never a solid vertical barrier.
    const result = [];
    for (const x of [-.5, 1.1]) for (const y of [-.48, .48])
      result.push(box(`net_post_${x}_${y}`, [x,y,.16], [.018,.018,.16]));
    for (let i=0;i<=16;i++) result.push(box(`net_cross_${i}`,
      [-.5+i*.1,0,.27], [.004,.48,.004], {color:'#b6a785'}));
    for (let i=0;i<=10;i++) result.push(box(`net_long_${i}`,
      [.3,-.48+i*.096,.278], [.8,.004,.004], {color:'#b6a785'}));
    return result;
  }
  if (id === 'terrain_rubble') {
    // Deterministic dense, low, angular fixed rock bed; not four tall pillars.
    let seed=731;
    const random=()=> ((seed=(1664525*seed+1013904223)>>>0)/4294967296);
    const result=[];
    for(let row=0;row<10;row++) for(let col=0;col<16;col++) {
      const sx=.035+random()*.024, sy=.028+random()*.019, sz=.008+random()*.017;
      result.push(box(`rock_${row}_${col}`,
        [-.62+col*.13+(random()-.5)*.035,-.58+row*.13+(random()-.5)*.035,sz],
        [sx,sy,sz], {yaw:random()*Math.PI, color:['#77746a','#949083','#605f5a'][col%3]}));
    }
    return result;
  }
  if (id === 'terrain_bumps') return Array.from({length:6},(_,i)=>box(
    `bump_${i}`,[-.5+i*.32,0,.025],[.055,.6,.025],{color:'#56755c'}));
  if (id === 'crawl_door') return [
    box('door_left',[.3,-.26,.32],[.08,.1,.32]),
    box('door_right',[.3,.26,.32],[.08,.1,.32]),
    box('door_header',[.3,0,.6],[.08,.36,.04]),
  ];
  if (id === 'crawl_pipe') return [
    box('pipe_left',[.3,-.3,.17],[.8,.035,.17]),
    box('pipe_right',[.3,.3,.17],[.8,.035,.17]),
    box('pipe_roof',[.3,0,.32],[.8,.335,.025]),
  ];
  if (id === 'cross_hurdle') return [
    box('hurdle_bar',[.15,0,.065],[.015,.55,.012],{color:'#d39b50'}),
    ...[-.55,.55].map(y=>box(`hurdle_post_${y}`,[.15,y,.038],[.022,.022,.038])),
  ];
  if (id === 'cross_stepping') return original.filter(g=>g.name!=='stepping_hurdle');
  if (id === 'balance_board') return [box('balance_board',[.25,0,.035],[.82,.25,.035],{color:'#8374ad'})];
  if (id === 'narrow_bridge' || id === 'narrow_rail') return [
    box('deck',[.3,0,.055],[.95,id==='narrow_bridge'?.2:.09,.055],{color:'#b89058'}),
    box('entry',[-.9,0,.025],[.25,.3,.025]), box('exit',[1.5,0,.025],[.25,.3,.025]),
  ];
  if (id === 'narrow_turn') return [
    box('deck_entry',[-.55,0,.035],[.45,.15,.035]),
    box('deck_turn',[0,.4,.035],[.15,.55,.035]),
    box('deck_exit',[.85,.8,.035],[.85,.15,.035]),
  ];
  if (id === 'lowfriction_ice') return [box('ice',[.35,0,.006],[1,.7,.006],
    {color:'#69a6c3',friction:[.06,.001,.0001]})];
  return original;
}
