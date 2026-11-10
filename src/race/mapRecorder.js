import { GAUNTLET_CIRCUIT } from '../envs/gauntletCircuit.js';
import { drawRaceMinimap } from './recordingMap.js';

export const LIVE_MAP_RECORDING = Object.freeze({ width: 960, height: 540, fps: 5, mode: 'map', shared: true });

export function drawLiveRaceMap(context, snapshot, { width = 960, height = 540 } = {}) {
  drawRaceMinimap(context, {
    frame: { x: 0, y: 36, width, height: height - 36 },
    course: GAUNTLET_CIRCUIT.course,
    entrants: snapshot.entrants,
    selectedId: null,
  });
  context.fillStyle = '#0b1822';
  context.fillRect(0, 0, width, 36);
  context.fillStyle = '#eafcff';
  context.font = 'bold 16px ui-monospace, monospace';
  context.textBaseline = 'middle';
  context.fillText(`GLOBAL MAP · ${snapshot.entrants.length} DUCKS · SIM ${snapshot.simSeconds.toFixed(1)}s · WALL ${(snapshot.wallSeconds ?? 0).toFixed(1)}s`, 14, 18);
}

// Standalone Canvas2D recording: no scene, renderer, replay page or camera passes.
// onChunk is awaited in order; callers can stream to disk rather than retain a race in memory.
export function createRaceMapRecorder({ race, onChunk }) {
  const canvas = document.createElement('canvas');
  canvas.width = LIVE_MAP_RECORDING.width;
  canvas.height = LIVE_MAP_RECORDING.height;
  const context = canvas.getContext('2d', { alpha: false });
  const stream = canvas.captureStream(LIVE_MAP_RECORDING.fps);
  const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp8') ? 'video/webm;codecs=vp8' : 'video/webm';
  const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 1_200_000 });
  let writes = Promise.resolve();
  let failure = null;
  let frames = 0;
  let stopped = false;
  const startedAt = Date.now();
  const draw = () => {
    try { drawLiveRaceMap(context, race.snapshot()); frames++; }
    catch (error) { failure ??= error.message; }
  };
  recorder.addEventListener('dataavailable', ({ data }) => {
    if (data.size) writes = writes.then(() => onChunk(data)).catch((error) => { failure ??= error.message; });
  });
  recorder.addEventListener('error', (event) => { failure ??= event.error?.message ?? 'MAP_MEDIA_RECORDER_ERROR'; });
  let resolveStopped;
  const completed = new Promise((resolve) => { resolveStopped = resolve; });
  let timer;
  recorder.addEventListener('stop', async () => {
    clearInterval(timer);
    stream.getTracks().forEach((track) => track.stop());
    await writes;
    const stoppedAt = Date.now();
    resolveStopped({ ...LIVE_MAP_RECORDING, mimeType, startedAt, stoppedAt, durationSeconds: (stoppedAt - startedAt) / 1000, frames, failure });
  }, { once: true });
  draw();
  recorder.start(1000);
  timer = setInterval(draw, 1000 / LIVE_MAP_RECORDING.fps);
  return {
    get failure() { return failure; },
    stop() {
      if (!stopped) {
        stopped = true;
        clearInterval(timer);
        draw();
        recorder.stop();
      }
      return completed;
    },
  };
}
