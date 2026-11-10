export const MIN_REALTIME_FACTOR = 0.95;
export const REALTIME_WINDOW_MS = 10_000;

export function graphicsBackend(gl) {
  const debug = gl?.getExtension?.('WEBGL_debug_renderer_info');
  const renderer = debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : gl?.getParameter?.(gl.RENDERER);
  const name = String(renderer ?? 'unknown');
  return { name, software: /swiftshader|llvmpipe|softpipe|software rasterizer|microsoft basic render driver/i.test(name) };
}

export function createRealtimeWatchdog({ startedAt, startedTick = 0, controlDt, minFactor = MIN_REALTIME_FACTOR, windowMs = REALTIME_WINDOW_MS }) {
  let lastAt = startedAt;
  let lastTick = startedTick;
  let slowWindows = 0;
  return {
    sample(now, tick) {
      const elapsed = now - lastAt;
      if (elapsed < windowMs) return null;
      const factor = Math.max(0, (tick - lastTick) * controlDt * 1000 / elapsed);
      slowWindows = factor < minFactor ? slowWindows + 1 : 0;
      lastAt = now;
      lastTick = tick;
      return { factor, slowWindows, invalid: slowWindows >= 2 };
    },
  };
}

export async function openHardwareChrome(path = `${location.pathname}${location.search}`) {
  const response = await fetch('/__race_launcher/open-chrome', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path }),
  });
  if (!response.ok) throw new Error((await response.json()).error ?? `HTTP ${response.status}`);
}
