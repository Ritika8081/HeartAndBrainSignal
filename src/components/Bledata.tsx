'use client'
// lib/useBleStream.ts
import { useState, useRef, useEffect } from 'react';

import { FFT, calculateBandPower } from '@/lib/fft';
// --- Import notch and EXG filters for signal cleaning ---
import { NotchFilter } from '@/lib/notchfilter';  // 50 Hz notch filter implementation
import { EXGFilter } from '@/lib/eegfilter';            // Band-pass filter for EEG/ECG

// --- Data entry interfaces for EEG and ECG samples ---
export interface EEGDataEntry { ch0: number }            // Single-channel EEG sample after filtering
export interface ECGDataEntry { ch2: number; }  // Timestamped ECG sample

// --- BLE service and characteristic UUIDs ---
const SERVICE_UUID = '4fafc201-1fb5-459e-8fcc-c5c9c331914b';  // Custom BLE service for NPG device
const DATA_CHAR_UUID = 'beb5483e-36e1-4688-b7f5-ea07361b26a8'; // Characteristic for streaming data
const CONTROL_CHAR_UUID = '0000ff01-0000-1000-8000-00805f9b34fb'; // Characteristic for start/stop commands
const SINGLE_SAMPLE_LEN = 7;        // Number of bytes per sample packet from device

// --- Settings for FFT and signal analysis ---
const FFT_SIZE = 256;              // Size of FFT window (must be power of two)
const SAMPLE_RATE = 500;           // Sampling rate of device in Hz
// Definitions for EEG frequency bands
const DELTA_RANGE: [number, number] = [0.5, 4];
const THETA_RANGE: [number, number] = [4, 8];
const ALPHA_RANGE: [number, number] = [8, 12];
const BETA_RANGE: [number, number] = [12, 30];
const GAMMA_RANGE: [number, number] = [30, 45];
const ZZZ: number[] = []
// --- React hook: useBleStream ---
export function useBleStream() {

  useEffect(() => {
    const SAMPLE_RATE = 500;         // Hz
    const CHUNK_SECONDS = 10;
    const CHUNK_SIZE = SAMPLE_RATE * CHUNK_SECONDS; // 5000

    const interval = setInterval(() => {
      const ctrs = counterLog.current;
      const ecgs = ecgLog.current;
      const chunks = Math.floor(ctrs.length / CHUNK_SIZE);
      for (let i = 0; i < chunks; i++) {
        const start = i * CHUNK_SIZE;
        const end = start + CHUNK_SIZE;
        const sliceCtr = ctrs.slice(start, end);
        const sliceEcg = ecgs.slice(start, end);
        // build CSV text
        const lines = ['counter,ecg'];
        for (let j = 0; j < CHUNK_SIZE; j++) {
          lines.push(`${sliceCtr[j]},${sliceEcg[j]}`);
          ZZZ.push(sliceCtr[j]);
        }

        const csv = lines.join('\n');

        // trigger download
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `ecg_${i + 1}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
      console.log(ZZZ, "ZZZ");
      // remove the chunks we've just downloaded:
      if (chunks > 0) {
        counterLog.current.splice(0, chunks * CHUNK_SIZE);
        ecgLog.current.splice(0, chunks * CHUNK_SIZE);
      }
    }, CHUNK_SECONDS * 1000);

    return () => clearInterval(interval);
  }, []);
  
  // State for raw data arrays (capped at MAX_POINTS for performance)
  const [eegData, setEegData] = useState<number[]>([]);          // Filtered EEG values
  const [ecgData, setEcgData] = useState<ECGDataEntry[]>([]);     // ECG entries with timestamp
  const [connected, setConnected] = useState(false);             // BLE connection status
  const [streaming, setStreaming] = useState(false);             // Notification streaming status
  const [counters, setCounters] = useState<number[]>([]);
  const counterLog = useRef<number[]>([]);
  const ecgLog = useRef<number[]>([]);

  // Refs for heart-rate calculation (RR interval detection)
  const lastPeakTime = useRef<number | null>(null);              // Timestamp of last detected R-peak
  const rrIntervals = useRef<number[]>([]);                      // List of recent RR intervals
  const [bpm, setBpm] = useState<number | null>(null);           // Computed beats per minute

  // BLE device and characteristic references (persist across renders)
  const deviceRef = useRef<BluetoothDevice | null>(null);
  const controlRef = useRef<BluetoothRemoteGATTCharacteristic | null>(null);
  const dataRef = useRef<BluetoothRemoteGATTCharacteristic | null>(null);
  const timeIndex = useRef(0);  // Incrementing timestamp for ECG samples

  // Filter instances for two EEG channels
  const eegFilter0 = useRef(new EXGFilter(12));  // Band-pass filter order 12
  const eegFilter1 = useRef(new EXGFilter(12));

  // Notch filters to remove 50Hz power-line noise on EEG and ECG channels
  const notch0 = useRef(new NotchFilter());  // EEG channel 0
  const notch1 = useRef(new NotchFilter());  // EEG channel 1
  const notch2 = useRef(new NotchFilter());  // ECG channel

  // Buffers and FFT objects to compute spectral band powers
  const fft0 = useRef(new FFT(FFT_SIZE));
  const fft1 = useRef(new FFT(FFT_SIZE));
  const buf0 = useRef<number[]>(Array(FFT_SIZE).fill(0)); // Rolling buffer for channel 0
  const buf1 = useRef<number[]>(Array(FFT_SIZE).fill(0)); // Rolling buffer for channel 1
  const sampleCounter = useRef(0);                          // Counts samples to trigger FFT

  // State to hold computed band power values for each EEG channel
  const [bandPower, setBandPower] = useState({
    ch0: { delta: 0, theta: 0, alpha: 0, beta: 0, gamma: 0 },
    ch1: { delta: 0, theta: 0, alpha: 0, beta: 0, gamma: 0 },
  });

  // Handler: processes incoming BLE data notifications
  const handleNotification = (evt: Event) => {
    const char = evt.target as BluetoothRemoteGATTCharacteristic;
    const raw = new Uint8Array(char.value!.buffer);
    // Ensure full samples in packet
    if (raw.length % SINGLE_SAMPLE_LEN !== 0) return;

    // Temporary arrays for new batch of data
    const newCounters: number[] = [];
    const newEegEntries: number[] = [];
    const newEcgEntries: ECGDataEntry[] = [];


    // Loop over each sample in the notification packet
    for (let offset = 0; offset < raw.length; offset += SINGLE_SAMPLE_LEN) {

      const counter = raw[offset];
      newCounters.push(counter);
      // console.log("Counter:", counter);

      // Extract 16-bit values for 3 channels from bytes
      const raw0 = raw[offset + 1] | (raw[offset + 2] << 8);
      const raw1 = raw[offset + 3] | (raw[offset + 4] << 8);
      const raw2 = raw[offset + 5] | (raw[offset + 6] << 8);

      // 1) Apply notch filter to remove 50 Hz noise
      const notch0Out = notch0.current.process(raw0);
      const notch1Out = notch1.current.process(raw1);
      const notch2Out = notch2.current.process(raw2);

      // 2) Apply EXG band-pass filters for EEG channels
      const eeg0 = eegFilter0.current.process(notch0Out);
      const eeg1 = eegFilter1.current.process(notch1Out);
      // ECG channel uses notch only (no further band-pass)
      const ecg = notch2Out;

      // Assign timestamp and store new entries
      const time = timeIndex.current++;
      newEegEntries.push(eeg0);
      newEcgEntries.push({ ch2: ecg });


      // in handleNotification, after you extract `rawCounter` and `ecg`:
      counterLog.current.push(counter);
      ecgLog.current.push(ecg);

      // 3) Append to FFT buffers and maintain window size
      buf0.current.push(eeg0);
      buf1.current.push(eeg1);
      if (buf0.current.length > FFT_SIZE) buf0.current.shift();
      if (buf1.current.length > FFT_SIZE) buf1.current.shift();



      // 4) Every 5 samples, compute band power for each EEG channel
      if ((sampleCounter.current = (sampleCounter.current + 1) % 5) === 0) {
        const mags0 = fft0.current.computeMagnitudes(new Float32Array(buf0.current));
        const mags1 = fft1.current.computeMagnitudes(new Float32Array(buf1.current));
        setBandPower({
          ch0: {
            delta: calculateBandPower(mags0, DELTA_RANGE, SAMPLE_RATE, FFT_SIZE),
            theta: calculateBandPower(mags0, THETA_RANGE, SAMPLE_RATE, FFT_SIZE),
            alpha: calculateBandPower(mags0, ALPHA_RANGE, SAMPLE_RATE, FFT_SIZE),
            beta: calculateBandPower(mags0, BETA_RANGE, SAMPLE_RATE, FFT_SIZE),
            gamma: calculateBandPower(mags0, GAMMA_RANGE, SAMPLE_RATE, FFT_SIZE),
          },
          ch1: {
            delta: calculateBandPower(mags1, DELTA_RANGE, SAMPLE_RATE, FFT_SIZE),
            theta: calculateBandPower(mags1, THETA_RANGE, SAMPLE_RATE, FFT_SIZE),
            alpha: calculateBandPower(mags1, ALPHA_RANGE, SAMPLE_RATE, FFT_SIZE),
            beta: calculateBandPower(mags1, BETA_RANGE, SAMPLE_RATE, FFT_SIZE),
            gamma: calculateBandPower(mags1, GAMMA_RANGE, SAMPLE_RATE, FFT_SIZE),
          },
        });
      }

      // 5) R-peak detection for BPM: check interval since last peak
      if (lastPeakTime.current !== null) {
        const interval = time - lastPeakTime.current;
        if (interval > 30) {
          rrIntervals.current.push(interval);
          // Keep only last 5 intervals for averaging
          if (rrIntervals.current.length > 5) rrIntervals.current.shift();
          const avgRR = rrIntervals.current.reduce((a, b) => a + b, 0) / rrIntervals.current.length;
          setBpm(Math.round((60 * SAMPLE_RATE) / avgRR));
        }
      }
      // Update last peak time for next iteration
      lastPeakTime.current = time;
    }



    // Limit history arrays to MAX_POINTS to avoid memory bloat

    const MAX_POINTS = 500;
    setCounters(prev => {
      const combined = [...prev, ...newCounters];
      return combined.length > MAX_POINTS
        ? combined.slice(combined.length - MAX_POINTS)
        : combined;
    });
    setEegData(prev => {
      const combined = [...prev, ...newEegEntries];
      return combined.length > MAX_POINTS
        ? combined.slice(combined.length - MAX_POINTS)
        : combined;
    });
    setEcgData(prev => {
      const combined = [...prev, ...newEcgEntries];
      return combined.length > MAX_POINTS
        ? combined.slice(combined.length - MAX_POINTS)
        : combined;
    });
  };

  // --- BLE connection lifecycle functions ---
  const connect = async () => {
    // Prompt user to select a BLE device matching 'NPG' prefix
    const device = await navigator.bluetooth.requestDevice({
      filters: [{ namePrefix: 'NPG' }],
      optionalServices: [SERVICE_UUID],
    });
    deviceRef.current = device;
    const server = await device.gatt!.connect();
    const svc = await server.getPrimaryService(SERVICE_UUID);
    controlRef.current = await svc.getCharacteristic(CONTROL_CHAR_UUID);
    dataRef.current = await svc.getCharacteristic(DATA_CHAR_UUID);
    setConnected(true);  // Update connection state
  };

  const start = async () => {
    // Send 'START' command and enable notifications
    if (!controlRef.current || !dataRef.current) return;
    await controlRef.current.writeValue(new TextEncoder().encode('START'));
    await dataRef.current.startNotifications();
    dataRef.current.addEventListener('characteristicvaluechanged', handleNotification);
    setStreaming(true);
  };

  const stop = async () => {
    // Disable notifications and update streaming flag
    if (!dataRef.current) return;
    await dataRef.current.stopNotifications();
    dataRef.current.removeEventListener('characteristicvaluechanged', handleNotification);
    setStreaming(false);
  };

  const disconnect = () => {
    // Stop streaming and disconnect BLE device
    stop();
    deviceRef.current?.gatt?.disconnect();
    setConnected(false);
  };

  // Automatically disconnect on unmount
  useEffect(() => () => disconnect(), []);

  // Return state and control methods to component
  return {
    eegData,
    ecgData,
    counters,
    bpm,
    connected,
    streaming,
    connect,
    start,
    stop,
    disconnect,
    bandPower,
  };
}
