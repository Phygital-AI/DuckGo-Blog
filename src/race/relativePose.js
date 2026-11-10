export function relativePose(worldPose, origin) {
  const dx = worldPose.x - origin.x;
  const dy = worldPose.y - origin.y;
  const cosine = Math.cos(origin.yaw);
  const sine = Math.sin(origin.yaw);
  const yaw = worldPose.yaw - origin.yaw;
  return {
    x: cosine * dx + sine * dy,
    y: -sine * dx + cosine * dy,
    yaw: Math.atan2(Math.sin(yaw), Math.cos(yaw)),
  };
}
