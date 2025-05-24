import { FFT } from '@/lib/fft';

// Frequency band definitions (Hz)
const BANDS: Record<string, [number, number]> = {
  delta: [0.5, 4],
  theta: [4, 8],
  alpha: [8, 12],
  beta:  [12, 30],
  gamma: [30, 45],
};

// Simple sliding‐window smoother, just like on the main thread
class BandSmoother {
  private bufferSize: number;
  private buffers: Record<string, number[]>;
  private sums: Record<string, number>;
  private idx = 0;

  constructor(bufferSize: number) {
    this.bufferSize = bufferSize;
    this.buffers  = {};
    this.sums     = {};
    for (const band of Object.keys(BANDS)) {
      this.buffers[band] = new Array(bufferSize).fill(0);
      this.sums[band]    = 0;
    }
  }

  updateAll(vals: Record<string, number>) {
    for (const b of Object.keys(vals)) {
      const old = this.buffers[b][this.idx];
      this.sums[b] -= old;
      this.sums[b] += vals[b];
      this.buffers[b][this.idx] = vals[b];
    }
    this.idx = (this.idx + 1) % this.bufferSize;
  }

  getAll(): Record<string, number> {
    const out: Record<string, number> = {};
    for (const b of Object.keys(this.sums)) {
      out[b] = this.sums[b] / this.bufferSize;
    }
    return out;
  }
}

// band‐power calc (unchanged)
function calculateBandPower(
  mags: Float32Array,
  [f1, f2]: [number, number],
  sampleRate = 500,
  fftSize    = 256
): number {
  const res   = sampleRate / fftSize;
  const start = Math.max(1, Math.floor(f1 / res));
  const end   = Math.min(mags.length - 1, Math.floor(f2 / res));
  let   p     = 0;
  for (let i = start; i <= end; i++) {
    p += mags[i] * mags[i];
  }
  return p;
}

// one smoother per channel
const smoother0 = new BandSmoother(128);
const smoother1 = new BandSmoother(128);

self.onmessage = (e: MessageEvent<{
  eeg0: number[];
  eeg1: number[];
  sampleRate: number;
  fftSize: number;
}>) => {
  const { eeg0, eeg1, sampleRate, fftSize } = e.data;

  // run FFT
  const fft0 = new FFT(fftSize);
  const fft1 = new FFT(fftSize);
  const mags0 = fft0.computeMagnitudes(new Float32Array(eeg0));
  const mags1 = fft1.computeMagnitudes(new Float32Array(eeg1));

  // raw band-power
  const raw0: Record<string, number> = {};
  const raw1: Record<string, number> = {};
  for (const [band, range] of Object.entries(BANDS)) {
    raw0[band] = calculateBandPower(mags0, range, sampleRate, fftSize);
    raw1[band] = calculateBandPower(mags1, range, sampleRate, fftSize);
  }

  // compute total power for relative
  const total0 = Object.values(raw0).reduce((a, b) => a + b, 0);
  const total1 = Object.values(raw1).reduce((a, b) => a + b, 0);

  // instantaneous relative power
  const rel0: Record<string, number> = {};
  const rel1: Record<string, number> = {};
  for (const band of Object.keys(BANDS)) {
    rel0[band] = total0 > 0 ? raw0[band] / total0 : 0;
    rel1[band] = total1 > 0 ? raw1[band] / total1 : 0;
  }

  // update smoothers
  smoother0.updateAll(rel0);
  smoother1.updateAll(rel1);


  // pull out smoothed values
  const smooth0 = smoother0.getAll();
  const smooth1 = smoother1.getAll();

  console.log("smooth0", smooth0, "smooth1", smooth1);

  // send back smoothed, relative band powers
  self.postMessage({ smooth0, smooth1 });
};
