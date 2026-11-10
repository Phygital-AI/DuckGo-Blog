// Visual only: the goal flag must not become a new collision obstacle.
export function createGoalFlag(THREE, env, { championship = false } = {}) {
  const flag = new THREE.Group();
  flag.name = "goal_flag";
  flag.position.set(env.goal.x, env.course?.goalHeight ?? 0, -env.goal.y);
  flag.userData.goalRadius = env.goal.radius;
  if (championship) {
    const poleMaterial = new THREE.MeshStandardMaterial({ color: 0xb8b8a8, metalness: .75, roughness: .35 });
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(.009, .013, .8, 12), poleMaterial);
    pole.name = "goal_flag_pole";
    pole.position.y = .4;
    pole.castShadow = true;
    flag.add(pole);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(.046, .06, .022, 16), poleMaterial);
    base.name = "goal_flag_base";
    base.position.y = .011;
    flag.add(base);
    const material = new THREE.MeshStandardMaterial({ color: 0xe5e0d0, roughness: .87, side: THREE.DoubleSide });
    if (typeof document !== "undefined") {
      const canvas = document.createElement("canvas");
      canvas.width = 768;
      canvas.height = 512;
      const context = canvas.getContext("2d");
      for (let row = 0; row < 4; row++) {
        for (let column = 0; column < 6; column++) {
          context.fillStyle = (row + column) % 2 ? "#203c32" : "#e8e2cd";
          context.fillRect(column * 128, row * 128, 128, 128);
        }
      }
      material.map = new THREE.CanvasTexture(canvas);
      material.map.colorSpace = THREE.SRGBColorSpace;
      material.color.set(0xffffff);
    }
    for (const angle of [0, Math.PI / 2]) {
      const panel = new THREE.Mesh(new THREE.PlaneGeometry(.3, .2), material);
      panel.position.set(Math.cos(angle) * .15, .66, -Math.sin(angle) * .15);
      panel.rotation.y = angle;
      flag.add(panel);
    }
    return flag;
  }
  const bright = (color) => new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide });
  const green = bright(0xbaf26e), white = bright(0xffffff), black = bright(0x08131b);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.024, 0.8, 12), white);
  pole.name = "goal_flag_pole";
  pole.position.y = 0.4;
  flag.add(pole);
  const base = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.035, 0.12), green);
  base.name = "goal_flag_base";
  base.position.y = 0.0175;
  flag.add(base);
  // Two perpendicular, double-sided flags stay visible from front and side.
  for (const angle of [0, Math.PI / 2]) {
    const panel = new THREE.Group();
    panel.rotation.y = angle;
    panel.position.y = 0.52;
    const border = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.44), green);
    border.position.x = 0.3;
    panel.add(border);
    for (let row = 0; row < 4; row++) {
      for (let col = 0; col < 6; col++) {
        const cell = new THREE.Mesh(new THREE.PlaneGeometry(0.09, 0.09), (row + col) % 2 ? black : white);
        // Offset each face to keep the green backing from hiding the pattern.
        cell.position.set(0.075 + col * 0.09, 0.135 - row * 0.09, 0.001);
        panel.add(cell);
        const back = cell.clone();
        back.position.z = -0.001;
        panel.add(back);
      }
    }
    flag.add(panel);
  }
  return flag;
}
