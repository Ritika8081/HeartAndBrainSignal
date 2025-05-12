// src/webworker/bandPower.worker.ts

import { FFT } from '@/lib/fft';

// Frequency band definitions (Hz)
const BANDS: Record<string, [number, number]> = {
  delta: [0.5, 4],
  theta: [4, 8],
  alpha: [8, 12],
  beta: [12, 30],
  gamma: [30, 45],
};

/**
 * Calculate band power by summing squared magnitudes within a frequency range.
 */
function calculateBandPower(
  mags: Float32Array,
  freqRange: [number, number],
  sampleRate = 500,
  fftSize = 256
): number {
  const res = sampleRate / fftSize;
  const [f1, f2] = freqRange;
  const start = Math.max(1, Math.floor(f1 / res));
  const end = Math.min(mags.length - 1, Math.floor(f2 / res));
  let p = 0;
  for (let i = start; i <= end; i++) {
    p += mags[i] * mags[i];
  }
  return p;
}

// Worker context uses 'self'
self.onmessage = (e: MessageEvent<{
  eeg0: number[];
  eeg1: number[];
  sampleRate: number;
  fftSize: number;
}>) => {
  const { eeg0, eeg1, sampleRate, fftSize } = e.data;

  // Initialize FFT instances
  const fft0 = new FFT(fftSize);
  const fft1 = new FFT(fftSize);

  // Compute magnitude spectra
  const mags0 = fft0.computeMagnitudes(new Float32Array(eeg0));
  const mags1 = fft1.computeMagnitudes(new Float32Array(eeg1));

  // Calculate band power for each channel and each band
  const bandPower0: Record<string, number> = {};
  const bandPower1: Record<string, number> = {};

  for (const [band, range] of Object.entries(BANDS)) {
    bandPower0[band] = calculateBandPower(mags0, range, sampleRate, fftSize);
    bandPower1[band] = calculateBandPower(mags1, range, sampleRate, fftSize);
  }

  // Post results back to main thread
  self.postMessage({ bandPower0, bandPower1 });
};
