export function courseMapProjection(path, halfWidth, frame, margin = 52) {
  const xs = path.map((point) => point[0]);
  const ys = path.map((point) => point[1]);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const scale = Math.min(
    (frame.width - margin * 2) / (maxX - minX + halfWidth * 2),
    (frame.height - margin * 2) / (maxY - minY + halfWidth * 2),
  );
  const centerX = frame.x + frame.width / 2;
  const centerY = frame.y + frame.height / 2;
  return {
    scale,
    point: (x, y) => [centerX + (x - (minX + maxX) / 2) * scale, centerY - (y - (minY + maxY) / 2) * scale],
  };
}

export function drawRaceMinimap(context, { frame, course, entrants, selectedId, compact = false }) {
  const { x, y, width, height } = frame;
  const { path, halfWidth } = course;
  const crowded = entrants.length > 3;
  const legendColumns = compact ? Math.max(1, Math.floor((width - 14) / 31)) : Math.max(1, Math.floor((width - 40) / 190));
  const reservedLegendHeight = crowded ? Math.ceil(entrants.length / legendColumns) * (compact ? 20 : 31) + (compact ? 8 : 16) : 0;
  const mapFrame = crowded ? { x, y, width, height: Math.max(40, height - reservedLegendHeight - (compact ? 0 : 56)) } : frame;
  const projection = courseMapProjection(path, halfWidth, mapFrame, compact ? (crowded ? 15 : 32) : 66);
  context.save();
  context.fillStyle = '#0b1822';
  context.fillRect(x, y, width, height);
  context.strokeStyle = 'rgba(116, 185, 195, 0.09)';
  context.lineWidth = 1;
  const grid = compact ? 28 : 44;
  for (let gx = x + grid; gx < x + width; gx += grid) {
    context.beginPath(); context.moveTo(gx, y); context.lineTo(gx, y + height); context.stroke();
  }
  for (let gy = y + grid; gy < y + height; gy += grid) {
    context.beginPath(); context.moveTo(x, gy); context.lineTo(x + width, gy); context.stroke();
  }

  context.beginPath();
  path.forEach(([px, py], index) => {
    const [screenX, screenY] = projection.point(px, py);
    if (index === 0) context.moveTo(screenX, screenY);
    else context.lineTo(screenX, screenY);
  });
  context.closePath();
  context.lineJoin = 'round';
  context.lineCap = 'round';
  context.shadowColor = 'rgba(65, 224, 234, 0.45)';
  context.shadowBlur = compact ? 9 : 16;
  context.strokeStyle = '#4ad7de';
  context.lineWidth = halfWidth * 2 * projection.scale + (compact ? 3 : 5);
  context.stroke();
  context.shadowBlur = 0;
  context.strokeStyle = '#243744';
  context.lineWidth = halfWidth * 2 * projection.scale;
  context.stroke();
  context.setLineDash(compact ? [4, 7] : [8, 11]);
  context.strokeStyle = 'rgba(199, 229, 231, 0.42)';
  context.lineWidth = compact ? 1 : 1.5;
  context.stroke();
  context.setLineDash([]);

  const [startX, startY] = projection.point(...path[0]);
  const flagSize = compact ? 5 : 9;
  context.fillStyle = '#ecf9fa';
  context.fillRect(startX - flagSize, startY - flagSize, flagSize * 2, flagSize * 2);
  context.fillStyle = '#12242f';
  context.fillRect(startX - flagSize, startY - flagSize, flagSize, flagSize);
  context.fillRect(startX, startY, flagSize, flagSize);

  for (const entrant of entrants) {
    const pose = entrant.pose;
    if (!pose || !Number.isFinite(pose.x) || !Number.isFinite(pose.y)) continue;
    const [px, py] = projection.point(pose.x, pose.y);
    const selected = entrant.id === selectedId;
    const yaw = Number.isFinite(pose.yaw) ? pose.yaw : 0;
    const forward = [Math.cos(yaw), -Math.sin(yaw)];
    const left = [-forward[1], forward[0]];
    const size = selected ? (compact ? 8 : 13) : (compact ? 5 : 9);
    const identityColor = entrant.identityColor ?? entrant.primary ?? '#6fe4eb';
    if (selected) {
      context.beginPath();
      context.arc(px, py, size + (compact ? 6 : 9), 0, Math.PI * 2);
      context.globalAlpha = .18;
      context.fillStyle = identityColor;
      context.fill();
      context.globalAlpha = .8;
      context.strokeStyle = identityColor;
      context.lineWidth = compact ? 1.5 : 2.5;
      context.stroke();
      context.globalAlpha = 1;
    }
    context.beginPath();
    context.moveTo(px + forward[0] * size, py + forward[1] * size);
    context.lineTo(px - forward[0] * size * .7 + left[0] * size * .7, py - forward[1] * size * .7 + left[1] * size * .7);
    context.lineTo(px - forward[0] * size * .7 - left[0] * size * .7, py - forward[1] * size * .7 - left[1] * size * .7);
    context.closePath();
    context.fillStyle = identityColor;
    context.fill();
    context.strokeStyle = identityColor;
    context.lineWidth = compact ? 1.5 : 2.5;
    context.stroke();

  }

  const fontSize = compact ? 8 : 13;
  const legendHeight = compact ? 17 : 27;
  const legendGap = compact ? 4 : 8;
  let legendX = x + (compact ? 7 : 24);
  let legendY = crowded ? y + mapFrame.height + 4 : y + (compact ? 7 : 19);
  context.font = `800 ${fontSize}px ui-monospace, monospace`;
  context.textBaseline = 'middle';
  for (const [index, entrant] of entrants.entries()) {
    const identityColor = entrant.identityColor ?? entrant.primary ?? '#6fe4eb';
    const agentName = String(entrant.label ?? entrant.id ?? 'AGENT').split(' · ')[0].toUpperCase();
    const duckNumber = String(entrant.number ?? index + 1).padStart(2, '0');
    // Dense live maps use number-only keys, matching the numbered HUD; the
    // full-size recording legend keeps exact model identity in a fixed grid.
    const markerLabel = crowded ? (compact ? duckNumber : `${duckNumber} ${entrant.model ?? entrant.label ?? entrant.id}`) : `${duckNumber} ${agentName}`;
    const labelWidth = crowded ? (width - (compact ? 14 : 48) - (legendColumns - 1) * legendGap) / legendColumns : Math.min(width - 14, markerLabel.length * fontSize * .61 + (compact ? 18 : 30));
    if (crowded) {
      legendX = x + (compact ? 7 : 24) + (index % legendColumns) * (labelWidth + legendGap);
      legendY = y + mapFrame.height + 4 + Math.floor(index / legendColumns) * (legendHeight + legendGap);
    }
    if (legendX + labelWidth > x + width - 7) {
      legendX = x + (compact ? 7 : 24);
      legendY += legendHeight + legendGap;
    }
    context.fillStyle = 'rgba(4, 15, 23, .9)';
    context.fillRect(legendX, legendY, labelWidth, legendHeight);
    context.fillStyle = identityColor;
    context.fillRect(legendX, legendY, compact ? 4 : 7, legendHeight);
    context.strokeStyle = identityColor;
    context.lineWidth = entrant.id === selectedId ? (compact ? 1.5 : 2.5) : (compact ? 1 : 2);
    context.strokeRect(legendX, legendY, labelWidth, legendHeight);
    context.fillStyle = '#f1ffff';
    context.fillText(markerLabel, legendX + (compact ? 8 : 14), legendY + legendHeight / 2, labelWidth - (compact ? 11 : 20));
    legendX += labelWidth + legendGap;
  }
  const selected = entrants.find((entrant) => entrant.id === selectedId);
  if (!compact) {
    context.font = '700 17px ui-monospace, monospace';
    context.textBaseline = 'middle';
    context.fillStyle = '#a8c9cd';
    context.fillText('TRACK MAP', x + 28, y + 62);
    const label = selected
      ? `DUCK ${String(selected.number ?? selected.id).padStart(2, '0')}   /   CHECKPOINT ${String(selected.checkpointIndex ?? 0).padStart(2, '0')} OF ${selected.checkpointCount ?? 16}`
      : `ALL ${entrants.length} DUCKS   /   WORLD POSITION + HEADING`;
    context.fillStyle = 'rgba(8, 22, 31, .9)';
    context.fillRect(x + 20, y + height - 58, Math.min(width - 40, label.length * 11 + 28), 38);
    context.fillStyle = '#e4f7f7';
    context.fillText(label, x + 34, y + height - 38);
  }
  context.restore();
}
