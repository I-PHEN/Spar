const PCM_SAMPLE_RATE = 16000;

export function float32ToInt16(samples: Float32Array): Int16Array {
  const pcm = new Int16Array(samples.length);
  for (let index = 0; index < samples.length; index += 1) {
    const sample = Math.max(-1, Math.min(1, samples[index]));
    pcm[index] = sample < 0 ? sample * 32768 : sample * 32767;
  }
  return pcm;
}

/** Keeps the fractional output interval between callbacks, including at 44.1 kHz. */
export class MonoResampler {
  private intervalFilled = 0;
  private weightedSample = 0;

  constructor(
    private readonly inputRate: number,
    private readonly outputRate = PCM_SAMPLE_RATE,
  ) {
    if (!Number.isFinite(inputRate) || inputRate <= 0 || !Number.isFinite(outputRate) || outputRate <= 0) {
      throw new RangeError('Audio sample rates must be finite and positive');
    }
  }

  process(samples: Float32Array): Float32Array {
    const output: number[] = [];
    for (const sample of samples) {
      // Measuring durations in rate units avoids a cumulative floating point
      // phase error for integer sample rates such as 44100 and 16000.
      let remaining = this.outputRate;
      while (remaining > 0) {
        const duration = Math.min(remaining, this.inputRate - this.intervalFilled);
        this.weightedSample += sample * duration;
        this.intervalFilled += duration;
        remaining -= duration;
        if (this.intervalFilled >= this.inputRate) {
          output.push(this.weightedSample / this.inputRate);
          this.intervalFilled = 0;
          this.weightedSample = 0;
        }
      }
    }
    return new Float32Array(output);
  }
}

/** Resamples a standalone mono buffer; use MonoResampler for a live stream. */
export function resampleMono(
  samples: Float32Array,
  inputRate: number,
  outputRate = PCM_SAMPLE_RATE,
): Float32Array {
  return new MonoResampler(inputRate, outputRate).process(samples);
}

export interface MicrophoneChunk {
  sequence: number;
  audio: Uint8Array;
}

export interface MicrophoneStreamDependencies {
  mediaDevices?: Pick<MediaDevices, 'getUserMedia'>;
  createAudioContext?: () => AudioContext;
  createAudioWorkletNode?: (context: AudioContext, processorName: string) => AudioWorkletNode;
  createWorkletUrl?: (source: string) => string;
  revokeWorkletUrl?: (url: string) => void;
}

export interface MicrophoneStreamOptions {
  onChunk: (chunk: MicrophoneChunk) => void;
  onError?: (error: Error) => void;
  dependencies?: MicrophoneStreamDependencies;
}

const CHUNK_SAMPLES = PCM_SAMPLE_RATE * 0.08;
const WORKLET_NAME = 'spar-microphone';
const WORKLET_SOURCE = `
class SparMicrophoneProcessor extends AudioWorkletProcessor {
  process(inputs) {
    const channels = inputs[0];
    if (channels && channels.length && channels[0].length) {
      const mono = new Float32Array(channels[0].length);
      for (const channel of channels) {
        for (let index = 0; index < mono.length; index++) {
          mono[index] += channel[index] / channels.length;
        }
      }
      this.port.postMessage(mono, [mono.buffer]);
    }
    return true;
  }
}
registerProcessor('${WORKLET_NAME}', SparMicrophoneProcessor);
`;

interface CaptureRun {
  startPromise?: Promise<void>;
  stream?: MediaStream;
  context?: AudioContext;
  source?: MediaStreamAudioSourceNode;
  processor?: ScriptProcessorNode | AudioWorkletNode;
  worklet?: AudioWorkletNode;
  workletUrl?: string;
  resampler?: MonoResampler;
  pending: Int16Array;
  pendingLength: number;
  trackEndListeners: Array<{
    track: MediaStreamTrack;
    listener: EventListener;
  }>;
}

export class MicrophoneStream {
  private current?: CaptureRun;
  private sequence = 0;

  constructor(private readonly options: MicrophoneStreamOptions) {}

  start(): Promise<void> {
    if (this.current?.startPromise) return this.current.startPromise;
    const run: CaptureRun = {
      pending: new Int16Array(CHUNK_SAMPLES),
      pendingLength: 0,
      trackEndListeners: [],
    };
    this.current = run;
    run.startPromise = this.initialize(run);
    return run.startPromise;
  }

  stop(): void {
    const run = this.current;
    this.current = undefined;
    if (run) this.release(run);
  }

  private async initialize(run: CaptureRun): Promise<void> {
    const dependencies = this.options.dependencies ?? {};
    try {
      const mediaDevices = dependencies.mediaDevices ?? globalThis.navigator?.mediaDevices;
      if (!mediaDevices) throw new Error('Microphone capture is unavailable');
      run.stream = await mediaDevices.getUserMedia({ audio: { channelCount: 1 }, video: false });
      if (this.current !== run) { this.release(run); return; }
      for (const track of run.stream.getTracks()) {
        const listener = () => this.failRuntime(run, 'Microphone track ended');
        track.addEventListener('ended', listener);
        run.trackEndListeners.push({ track, listener });
        if (track.readyState === 'ended') throw new Error('Microphone track ended');
      }

      const createContext = dependencies.createAudioContext ?? (() => new AudioContext());
      const context = createContext();
      run.context = context;
      run.resampler = new MonoResampler(context.sampleRate);
      run.source = context.createMediaStreamSource(run.stream);
      const createWorklet = dependencies.createAudioWorkletNode
        ?? (typeof AudioWorkletNode !== 'undefined'
          ? ((audioContext: AudioContext, name: string) => new AudioWorkletNode(audioContext, name))
          : undefined);

      if (context.audioWorklet && createWorklet) {
        try {
          const createUrl = dependencies.createWorkletUrl
            ?? ((source: string) => URL.createObjectURL(new Blob([source], { type: 'text/javascript' })));
          run.workletUrl = createUrl(WORKLET_SOURCE);
          await context.audioWorklet.addModule(run.workletUrl);
          if (this.current !== run) return;
          const worklet = createWorklet(context, WORKLET_NAME);
          run.processor = run.worklet = worklet;
          worklet.port.onmessage = (event: MessageEvent<Float32Array>) => this.accept(run, event.data);
          worklet.onprocessorerror = () => {
            this.failRuntime(run, 'Microphone audio processor failed');
          };
        } catch {
          // Browsers can expose AudioWorklet while CSP or module loading blocks it.
          // Keep the legacy processor contained to this capture adapter.
        } finally {
          this.revokeWorkletUrl(run);
        }
      }
      if (this.current !== run) return;

      if (!run.processor) {
        const processor = context.createScriptProcessor(2048, 1, 1);
        run.processor = processor;
        processor.onaudioprocess = (event) => {
          if (this.current !== run) return;
          const buffer = event.inputBuffer;
          const mono = new Float32Array(buffer.length);
          for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) {
            const samples = buffer.getChannelData(channel);
            for (let index = 0; index < samples.length; index += 1) {
              mono[index] += samples[index] / buffer.numberOfChannels;
            }
          }
          this.accept(run, mono);
        };
      }
      if (context.state === 'suspended') await context.resume();
      if (this.current !== run) return;
      run.source.connect(run.processor);
      // Both processors emit silence; connecting them keeps capture rendering active.
      run.processor.connect(context.destination);
    } catch (cause) {
      if (this.current !== run) { this.release(run); return; }
      this.stop();
      const error = cause instanceof Error ? cause : new Error(String(cause));
      this.options.onError?.(error);
      throw error;
    }
  }

  private accept(run: CaptureRun, samples: Float32Array): void {
    if (this.current !== run || !run.resampler) return;
    const pcm = float32ToInt16(run.resampler.process(samples));
    for (const sample of pcm) {
      if (this.current !== run) return;
      run.pending[run.pendingLength++] = sample;
      if (run.pendingLength === CHUNK_SAMPLES) {
        const audio = new Uint8Array(CHUNK_SAMPLES * 2);
        const view = new DataView(audio.buffer);
        for (let index = 0; index < CHUNK_SAMPLES; index += 1) {
          view.setInt16(index * 2, run.pending[index], true);
        }
        run.pendingLength = 0;
        this.options.onChunk({ sequence: this.sequence++, audio });
      }
    }
  }

  private revokeWorkletUrl(run: CaptureRun): void {
    if (!run.workletUrl) return;
    const url = run.workletUrl;
    run.workletUrl = undefined;
    const revoke = this.options.dependencies?.revokeWorkletUrl ?? ((value: string) => URL.revokeObjectURL(value));
    revoke(url);
  }

  private failRuntime(run: CaptureRun, message: string): void {
    if (this.current !== run) return;
    this.current = undefined;
    this.release(run);
    this.options.onError?.(new Error(message));
  }

  private release(run: CaptureRun): void {
    if (run.worklet) {
      run.worklet.port.onmessage = null;
      run.worklet.onprocessorerror = null;
      run.worklet.port.close();
      run.worklet = undefined;
    }
    if (run.processor) {
      if ('onaudioprocess' in run.processor) run.processor.onaudioprocess = null;
      run.processor.disconnect();
      run.processor = undefined;
    }
    run.source?.disconnect();
    run.source = undefined;
    for (const { track, listener } of run.trackEndListeners) {
      track.removeEventListener('ended', listener);
    }
    run.trackEndListeners = [];
    run.stream?.getTracks().forEach((track) => track.stop());
    run.stream = undefined;
    if (run.context) {
      void run.context.close().catch(() => {});
      run.context = undefined;
    }
    this.revokeWorkletUrl(run);
    run.pendingLength = 0;
  }
}
