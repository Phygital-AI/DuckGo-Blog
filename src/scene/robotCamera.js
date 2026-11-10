export const AGENT_CAMERA = Object.freeze({
  id: "microduck-body-yaw-rgb-v1",
  width: 1280,
  height: 720,
  verticalFov: 40,
  near: .02,
  far: 160,
  poseModel: "base translation + yaw; horizon stabilized; not a calibrated head camera",
});

export function robotCameraPose(qpos, mode = "fpv") {
  if (!qpos || qpos.length < 7 || !Array.from(qpos).slice(0, 7).every(Number.isFinite)) return null;
  const yaw = Math.atan2(2 * (qpos[3] * qpos[6] + qpos[4] * qpos[5]), 1 - 2 * (qpos[5] ** 2 + qpos[6] ** 2));
  const forwardX = Math.cos(yaw);
  const forwardZ = -Math.sin(yaw);
  const root = [qpos[0], qpos[2], -qpos[1]];
  if (mode === "chase") return {
    position: [root[0] - forwardX * 1.25 - forwardZ * .45, root[1] + .66, root[2] - forwardZ * 1.25 + forwardX * .45],
    target: [root[0] + forwardX * .65, root[1] + .17, root[2] + forwardZ * .65],
    fov: 50,
  };
  if (mode === "front") return {
    position: [root[0] + forwardX * 1.15 - forwardZ * .35, root[1] + .62, root[2] + forwardZ * 1.15 + forwardX * .35],
    target: [root[0], root[1] + .10, root[2]],
    fov: 50,
  };
  return {
    position: [root[0] + forwardX * .13, root[1] + .28, root[2] + forwardZ * .13],
    target: [root[0] + forwardX * 1.8, root[1] + .22, root[2] + forwardZ * 1.8],
    fov: 64,
  };
}

export function createAgentCamera(THREE, { scene, renderer, spectatorCamera, getQpos, beforeRender }) {
  const sensor = new THREE.PerspectiveCamera(AGENT_CAMERA.verticalFov, AGENT_CAMERA.width / AGENT_CAMERA.height, AGENT_CAMERA.near, AGENT_CAMERA.far);
  return {
    contract: AGENT_CAMERA,
    capture() {
      const pose = robotCameraPose(getQpos());
      if (!pose) throw new Error("ROBOT_CAMERA_POSE_UNAVAILABLE");
      const size = renderer.getSize(new THREE.Vector2());
      const viewport = renderer.getViewport(new THREE.Vector4());
      const scissor = renderer.getScissor(new THREE.Vector4());
      const scissorTest = renderer.getScissorTest();
      const pixelRatio = renderer.getPixelRatio();
      const renderTarget = renderer.getRenderTarget();
      const cubeFace = renderer.getActiveCubeFace();
      const mipLevel = renderer.getActiveMipmapLevel();
      sensor.position.set(...pose.position);
      sensor.lookAt(...pose.target);
      try {
        beforeRender?.();
        renderer.setRenderTarget(null);
        renderer.setPixelRatio(1);
        renderer.setSize(AGENT_CAMERA.width, AGENT_CAMERA.height, false);
        renderer.setViewport(0, 0, AGENT_CAMERA.width, AGENT_CAMERA.height);
        renderer.setScissorTest(false);
        renderer.render(scene, sensor);
        return renderer.domElement.toDataURL("image/jpeg", .82);
      } finally {
        renderer.setPixelRatio(pixelRatio);
        renderer.setSize(size.x, size.y, false);
        renderer.setRenderTarget(renderTarget, cubeFace, mipLevel);
        renderer.setViewport(viewport);
        renderer.setScissor(scissor);
        renderer.setScissorTest(scissorTest);
        renderer.render(scene, spectatorCamera);
      }
    },
  };
}
