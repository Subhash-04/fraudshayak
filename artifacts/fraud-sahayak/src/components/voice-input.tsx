import { useEffect, useRef, useState } from 'react';
import { LoaderCircle, Mic, Square, X } from 'lucide-react';
import { useTranscribeFraudVoice } from '@workspace/api-client-react';

// Convert the browser's compressed recording locally. Only a short WAV is sent
// for transcription; it is never stored as case evidence.
async function toWav(blob: Blob): Promise<File> {
  const context = new AudioContext();
  try {
    const audio = await context.decodeAudioData(await blob.arrayBuffer());
    if (audio.duration > 65) throw new Error('Please keep recordings under 60 seconds.');
    const samples = audio.length;
    const buffer = new ArrayBuffer(44 + samples * 2);
    const view = new DataView(buffer);
    const ascii = (offset: number, value: string) => {
      for (let i = 0; i < value.length; i++) view.setUint8(offset + i, value.charCodeAt(i));
    };
    ascii(0, 'RIFF'); view.setUint32(4, 36 + samples * 2, true);
    ascii(8, 'WAVE'); ascii(12, 'fmt '); view.setUint32(16, 16, true);
    view.setUint16(20, 1, true); view.setUint16(22, 1, true);
    view.setUint32(24, audio.sampleRate, true); view.setUint32(28, audio.sampleRate * 2, true);
    view.setUint16(32, 2, true); view.setUint16(34, 16, true);
    ascii(36, 'data'); view.setUint32(40, samples * 2, true);
    const channels = Array.from({ length: audio.numberOfChannels }, (_, i) => audio.getChannelData(i));
    for (let i = 0; i < samples; i++) {
      const sample = Math.max(-1, Math.min(1, channels.reduce((sum, channel) => sum + channel[i], 0) / channels.length));
      view.setInt16(44 + i * 2, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
    }
    return new File([buffer], 'voice.wav', { type: 'audio/wav' });
  } finally {
    await context.close();
  }
}

export function VoiceInput({ disabled, onTranscript, onBusyChange }: {
  disabled?: boolean;
  onTranscript: (text: string) => void;
  onBusyChange: (busy: boolean) => void;
}) {
  const transcribe = useTranscribeFraudVoice();
  const [state, setState] = useState<'idle' | 'permission' | 'recording' | 'transcribing'>('idle');
  const [error, setError] = useState('');
  const [seconds, setSeconds] = useState(0);
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const mounted = useRef(true);
  const cancelled = useRef(false);
  const transcriptHandler = useRef(onTranscript);
  transcriptHandler.current = onTranscript;
  useEffect(() => { onBusyChange(state !== 'idle'); }, [state, onBusyChange]);
  const release = () => {
    clearInterval(timer.current);
    stream.current?.getTracks().forEach(track => track.stop());
    stream.current = null;
  };
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      cancelled.current = true;
      if (recorder.current?.state === 'recording') recorder.current.stop();
      release();
    };
  }, []);
  const start = async () => {
    setError('');
    cancelled.current = false;
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setError('Voice recording is not supported here. Please use a recent browser or type your message.');
      return;
    }
    setState('permission');
    try {
      const media = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!mounted.current || cancelled.current) { media.getTracks().forEach(track => track.stop()); return; }
      stream.current = media;
      const mimeType = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm', 'audio/ogg;codecs=opus'].find(type => MediaRecorder.isTypeSupported(type));
      const recording = new MediaRecorder(media, mimeType ? { mimeType } : undefined);
      recorder.current = recording;
      const chunks: BlobPart[] = [];
      recording.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
      recording.onerror = () => {
        cancelled.current = true; release();
        if (mounted.current) { setError('Recording failed. Please try again.'); setState('idle'); }
      };
      recording.onstop = async () => {
        release();
        if (!mounted.current || cancelled.current) return;
        setState('transcribing');
        try {
          const file = await toWav(new Blob(chunks, { type: recording.mimeType }));
          const result = await transcribe.mutateAsync({ data: { file } });
          if (mounted.current && !cancelled.current) transcriptHandler.current(result.text);
        } catch (cause) {
          if (mounted.current && !cancelled.current) setError(cause instanceof Error ? cause.message : 'Transcription failed. Please try again.');
        } finally {
          if (mounted.current) setState('idle');
        }
      };
      recording.start();
      setSeconds(0);
      setState('recording');
      let elapsed = 0;
      timer.current = setInterval(() => {
        elapsed++; setSeconds(elapsed);
        if (elapsed >= 60 && recording.state === 'recording') recording.stop();
      }, 1000);
    } catch {
      release();
      if (mounted.current) {
        setError('Microphone access was blocked or unavailable. Allow it in your browser, or type your message.');
        setState('idle');
      }
    }
  };
  const cancel = () => {
    cancelled.current = true;
    if (recorder.current?.state === 'recording') recorder.current.stop();
    release();
    setState('idle');
  };
  return <div className="voice-input">
    <button type="button" className={`composer-attach voice-button ${state === 'recording' ? 'is-recording' : ''}`}
      disabled={disabled || state === 'permission' || state === 'transcribing'}
      onClick={state === 'recording' ? () => recorder.current?.stop() : start}
      aria-label={state === 'recording' ? 'Stop recording and transcribe' : 'Record voice message'}
      aria-pressed={state === 'recording'} title={state === 'recording' ? 'Stop and transcribe' : 'Voice input · review before sending'}
      data-testid="button-voice-input">
      {state === 'recording' ? <Square size={17} /> : state === 'idle' ? <Mic size={19} /> : <LoaderCircle size={19} className="voice-spinner" />}
    </button>
    {state !== 'idle' && <div className="voice-notice" role="status">
      <span>{state === 'recording' ? `Recording ${seconds}s / 60s · stop to transcribe` : state === 'permission' ? 'Allow microphone access to begin' : 'Transcribing with OpenAI…'}</span>
      {state !== 'transcribing' && <button type="button" onClick={cancel} aria-label="Cancel voice recording"><X size={14} /></button>}
    </div>}
    {error && <div className="voice-notice voice-error" role="alert">{error}<button type="button" onClick={() => setError('')} aria-label="Dismiss voice error"><X size={14} /></button></div>}
  </div>;
}
