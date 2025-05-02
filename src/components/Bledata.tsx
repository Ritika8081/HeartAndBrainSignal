// lib/useBleStream.ts
import { useState, useRef, useEffect } from 'react';

// Separate types for EEG and ECG
export interface EEGDataEntry { time: number; ch0: number; ch1: number; }
export interface ECGDataEntry { time: number; ch2: number; }

// BLE & packet settings
const SERVICE_UUID = '4fafc201-1fb5-459e-8fcc-c5c9c331914b';
const DATA_CHAR_UUID = 'beb5483e-36e1-4688-b7f5-ea07361b26a8';
const CONTROL_CHAR_UUID = '0000ff01-0000-1000-8000-00805f9b34fb';
const SINGLE_SAMPLE_LEN = 7;        // bytes per sample packet
const BLOCK_COUNT = 10;            // samples per notification
const NEW_PACKET_LEN = SINGLE_SAMPLE_LEN * BLOCK_COUNT; // total bytes per notification

export function useBleStream() {
  const [eegData, setEegData] = useState<EEGDataEntry[]>([]);
  const [ecgData, setEcgData] = useState<ECGDataEntry[]>([]);
  const [connected, setConnected] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const rPeakThreshold = 0.2; // you may need to adjust this empirically
  let lastPeakTime = useRef<number | null>(null);
  let rrIntervals = useRef<number[]>([]);
  const [bpm, setBpm] = useState<number | null>(null);  

  const deviceRef = useRef<BluetoothDevice | null>(null);
  const controlRef = useRef<BluetoothRemoteGATTCharacteristic | null>(null);
  const dataRef = useRef<BluetoothRemoteGATTCharacteristic | null>(null);
  const timeIndex = useRef(0);

  class NotchFilter {
    private z1 = 0;
    private z2 = 0;
    constructor(private fs = 500) {}
    process(x: number) {
      // 50 Hz notch coefficients for 500 Hz sampling
      const a0 =  0.96508099;
      const a1 = -1.56202714;
      const a2 =  0.96508099;
      const b1 = -1.56858163;
      const b2 =  0.96424138;
  
      const w = x - b1 * this.z1 - b2 * this.z2;
      const y = a0 * w + a1 * this.z1 + a2 * this.z2;
      this.z2 = this.z1;
      this.z1 = w;
      return y;
    }
  }
  const notch0 = useRef(new NotchFilter(500));
  const notch1 = useRef(new NotchFilter(500));
  const notch2 = useRef(new NotchFilter(500));  // for ECG ch2
    
  const normalize = (value: number) => (value - 2048) * (2 / 4096); // for 12-bit ADC

  const handleNotification = (evt: Event) => {
    const char = evt.target as BluetoothRemoteGATTCharacteristic;
    const raw = new Uint8Array(char.value!.buffer);
    if (raw.length % SINGLE_SAMPLE_LEN !== 0) {
      console.warn(`Bad packet length: ${raw.length}`);
      return;
    }
  
    const newEegEntries: EEGDataEntry[] = [];
    const newEcgEntries: ECGDataEntry[] = [];
  
    for (let offset = 0; offset < raw.length; offset += SINGLE_SAMPLE_LEN) {
      const raw0 = raw[offset + 1] | (raw[offset + 2] << 8);
      const raw1 = raw[offset + 3] | (raw[offset + 4] << 8);
      const raw2 = raw[offset + 5] | (raw[offset + 6] << 8);
  
      const ch0 = normalize(notch0.current.process(raw0));
      const ch1 = normalize(notch1.current.process(raw1));
      const ch2 = normalize(notch2.current.process(raw2));
  
      const time = timeIndex.current++;
  
      newEegEntries.push({ time, ch0, ch1 });
      newEcgEntries.push({ time, ch2 });
  
      // --- BPM calculation ---
      
        if (lastPeakTime.current !== null) {
          const interval = time - lastPeakTime.current;
          if (interval > 30) { // debounce: ignore peaks < 60ms apart
            rrIntervals.current.push(interval);
            if (rrIntervals.current.length > 5) rrIntervals.current.shift();
            const avgRR = rrIntervals.current.reduce((a, b) => a + b, 0) / rrIntervals.current.length;
            const bpmVal = (60 * 500) / avgRR; // 500 = sampling rate
            setBpm(Math.round(bpmVal));
          }
      
        lastPeakTime.current = time;
      }
    }
    
    setEegData(prev => [...prev.slice(-99), ...newEegEntries]);
    setEcgData(prev => [...prev.slice(-99), ...newEcgEntries]);
  };

  const connect = async () => {
    const device = await navigator.bluetooth.requestDevice({
      filters: [{ namePrefix: 'NPG' }],
      optionalServices: [SERVICE_UUID],
    });
    deviceRef.current = device;
    const server = await device.gatt!.connect();
    const svc = await server.getPrimaryService(SERVICE_UUID);
    controlRef.current = await svc.getCharacteristic(CONTROL_CHAR_UUID);
    dataRef.current = await svc.getCharacteristic(DATA_CHAR_UUID);
    setConnected(true);
  };

  const start = async () => {
    if (!controlRef.current || !dataRef.current) return;
    await controlRef.current.writeValue(new TextEncoder().encode('START'));
    await dataRef.current.startNotifications();
    dataRef.current.addEventListener('characteristicvaluechanged', handleNotification);
    setStreaming(true);
  };

  const stop = async () => {
    if (!dataRef.current) return;
    await dataRef.current.stopNotifications();
    dataRef.current.removeEventListener('characteristicvaluechanged', handleNotification);
    setStreaming(false);
  };

  const disconnect = () => {
    stop();
    deviceRef.current?.gatt?.disconnect();
    setConnected(false);
  };

  useEffect(() => {
    return () => disconnect();
  }, []);

  return {
    eegData,
    ecgData,
    bpm,
    connected,
    streaming,
    connect,
    start,
    stop,
    disconnect,
  };
}
