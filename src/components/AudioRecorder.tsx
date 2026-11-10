import React, { useState, useRef, useEffect } from 'react';
import {
  Mic,
  Square,
  Sparkles,
  FileAudio,
  Volume2,
  Upload,
  User,
  MapPin,
  Briefcase,
  Languages,
  RotateCcw,
  CheckCircle2,
  Edit2
} from 'lucide-react';
import { playSound, formatTime } from '../utils/audioUtils';
import { InterviewItem, ParticipantRole } from '../types';

const MAX_AUDIO_FILE_SIZE = 500 * 1024 * 1024;

interface AudioRecorderProps {
  onTranscriptionComplete: (item: InterviewItem) => Promise<void>;
}

export const AudioRecorder: React.FC<AudioRecorderProps> = ({ onTranscriptionComplete }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStage, setProcessingStage] = useState('');
  const [transcriptionError, setTranscriptionError] = useState('');
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  // Live Speech Recognition states
  const [recordingLanguage, setRecordingLanguage] = useState<'ml-IN' | 'en-IN'>('ml-IN');
  const [spokenTranscript, setSpokenTranscript] = useState('');
  const [isEditingTranscript, setIsEditingTranscript] = useState(false);

  // Form metadata
  const [patientName, setPatientName] = useState('');
  const [participantRole, setParticipantRole] = useState<ParticipantRole>('Patient');
  const [clinicLocation, setClinicLocation] = useState<'Kochi' | 'Kannur' > ('Kochi');

  // Audio Context & Canvas Visualizer
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerIntervalRef = useRef<any>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);

  // Speech Recognition Reference
  const recognitionRef = useRef<any>(null);
  const isRecordingRef = useRef<boolean>(false);
  const transcriptAccumulatorRef = useRef<string>('');

  useEffect(() => {
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (audioUrl) URL.revokeObjectURL(audioUrl);
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close().catch(() => {});
      }
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {}
      }
    };
  }, [audioUrl]);

  // Start Live Microphone Recording with simultaneous Speech-to-Text
  const startRecording = async () => {
    let stream: MediaStream | null = null;
    try {
      playSound('recStart');
      setTranscriptionError('');
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const audioCtx = new AudioCtx();
      audioContextRef.current = audioCtx;
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 64;
      source.connect(analyser);
      analyserRef.current = analyser;

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const recordedBlob = new Blob(audioChunksRef.current, {
          type: mediaRecorder.mimeType || audioChunksRef.current[0]?.type || 'audio/webm',
        });
        setAudioBlob(recordedBlob);
        const url = URL.createObjectURL(recordedBlob);
        setAudioUrl(url);
        stream?.getTracks().forEach((track) => track.stop());
        if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
          void audioContextRef.current.close();
          audioContextRef.current = null;
        }
      };

      mediaRecorder.start(250);
      setIsRecording(true);
      requestAnimationFrame(drawVisualizer);
      isRecordingRef.current = true;
      setRecordingSeconds(0);
      setSpokenTranscript('');
      transcriptAccumulatorRef.current = '';

      // Initialize browser SpeechRecognition for real-time speech capture
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        try {
          const recognition = new SpeechRecognition();
          recognition.continuous = true;
          recognition.interimResults = true;
          recognition.lang = recordingLanguage; // 'ml-IN' or 'en-IN'

          recognition.onresult = (event: any) => {
            let interim = '';
            for (let i = event.resultIndex; i < event.results.length; ++i) {
              const text = event.results[i][0].transcript;
              if (event.results[i].isFinal) {
                transcriptAccumulatorRef.current = (transcriptAccumulatorRef.current + ' ' + text).trim();
              } else {
                interim += ' ' + text;
              }
            }
            const fullText = (transcriptAccumulatorRef.current + interim).trim();
            setSpokenTranscript(fullText);
          };

          recognition.onerror = (e: any) => {
            console.warn('Speech recognition warning:', e.error);
          };

          recognition.onend = () => {
            // Keep speech recognition continuously running as long as user is recording
            if (isRecordingRef.current) {
              try {
                recognition.start();
              } catch {}
            }
          };

          recognition.start();
          recognitionRef.current = recognition;
        } catch (recErr) {
          console.warn('Speech recognition start failed:', recErr);
        }
      }

      timerIntervalRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } catch (err: any) {
      stream?.getTracks().forEach((track) => track.stop());
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        void audioContextRef.current.close();
        audioContextRef.current = null;
      }
      console.error('Microphone access error:', err);
      setTranscriptionError('Could not access the microphone. Check browser permissions and try again.');
    }
  };

  // Stop Recording
  const stopRecording = () => {
    playSound('recStop');
    isRecordingRef.current = false;

    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    }

    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
    }
  };

  // Live Canvas Waveform
  const drawVisualizer = () => {
    const canvas = canvasRef.current;
    const analyser = analyserRef.current;
    if (!canvas || !analyser) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const render = () => {
      animFrameRef.current = requestAnimationFrame(render);
      analyser.getByteFrequencyData(dataArray);

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const barWidth = (canvas.width / bufferLength) * 1.8;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const barHeight = (dataArray[i] / 255) * canvas.height * 0.85;

        const gradient = ctx.createLinearGradient(0, canvas.height, 0, canvas.height - barHeight);
        gradient.addColorStop(0, '#0d9488');
        gradient.addColorStop(0.6, '#0284c7');
        gradient.addColorStop(1, '#4f46e5');

        ctx.fillStyle = gradient;
        ctx.fillRect(x, canvas.height - barHeight, barWidth - 2, barHeight);

        x += barWidth;
      }
    };

    render();
  };

  // Handle Audio File Upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    playSound('click');
    setTranscriptionError('');
    if (file.size === 0) {
      setTranscriptionError('The selected audio file is empty. Choose a valid recording and try again.');
      return;
    }
    if (file.size > MAX_AUDIO_FILE_SIZE) {
      setTranscriptionError('Audio files must be 500 MB or smaller. Please choose a smaller file.');
      return;
    }

    setAudioBlob(file);
    const url = URL.createObjectURL(file);
    setAudioUrl(url);
    setSpokenTranscript('');

    const tempAudio = new Audio(url);
    tempAudio.onerror = () => {
      setTranscriptionError('The browser cannot preview this audio format. You can still try transcription; the app will attempt to convert it first.');
    };
    tempAudio.onloadedmetadata = () => {
      if (tempAudio.duration && !isNaN(tempAudio.duration) && isFinite(tempAudio.duration)) {
        setRecordingSeconds(Math.round(tempAudio.duration));
      }
    };
  };

  const handleResetRecording = () => {
    playSound('click');
    setTranscriptionError('');
    setAudioBlob(null);
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl(null);
    setSpokenTranscript('');
    setRecordingSeconds(0);
  };

  // Trigger Dual Transcription & Translation for the entire audio file
  const processTranscription = async () => {
    if (!audioBlob) return;

    const cleanPatientName = patientName.trim() || 'Anonymous Respondent';
    if (audioBlob.size === 0) {
      setTranscriptionError('The recording is empty. Record or select audio before transcribing.');
      return;
    }
    if (audioBlob.size > MAX_AUDIO_FILE_SIZE) {
      setTranscriptionError('Audio recordings must be 500 MB or smaller. This recording is still available to download or replace.');
      return;
    }

    setTranscriptionError('');
    setIsProcessing(true);
    setProcessingStage('Uploading audio securely for transcription...');

    try {
      const fileName = audioBlob instanceof File ? audioBlob.name : 'fieldwork-recording.webm';
      const formData = new FormData();
      formData.append('audio', audioBlob, fileName);
      formData.append('language', recordingLanguage);
      formData.append('speechTranscript', spokenTranscript.trim().slice(0, 20_000));
      const response = await fetch('/api/transcribe', {
        method: 'POST',
        body: formData,
      });

      const uploadResult = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(uploadResult?.error || `Audio upload failed (${response.status}).`);
      }
      if (typeof uploadResult?.jobId !== 'string' || !uploadResult.jobId) {
        throw new Error('The transcription service did not return a job ID. Your recording is still available to retry.');
      }

      let job: {
        status: 'working' | 'done' | 'error';
        progress: string;
        text: string;
        error?: string;
        transcriptMalayalam?: string;
        transcriptEnglish?: string;
      };

      do {
        const jobResponse = await fetch(`/api/transcribe/${encodeURIComponent(uploadResult.jobId)}`);
        const jobResult = await jobResponse.json().catch(() => null);
        if (!jobResponse.ok) {
          throw new Error(jobResult?.error || `Could not check transcription progress (${jobResponse.status}).`);
        }
        if (
          !jobResult ||
          !['working', 'done', 'error'].includes(jobResult.status) ||
          typeof jobResult.progress !== 'string'
        ) {
          throw new Error('The transcription service returned an invalid job status.');
        }

        job = jobResult;
        setProcessingStage(job.progress);
        if (typeof job.text === 'string' && job.text.trim()) {
          setSpokenTranscript(job.text);
        }

        if (job.status === 'working') {
          await new Promise((resolve) => window.setTimeout(resolve, 2000));
        }
      } while (job.status === 'working');

      if (job.status === 'error') {
        throw new Error(job.error || 'Transcription failed. Your recording is still available to retry.');
      }
      if (
        typeof job.transcriptMalayalam !== 'string' ||
        !job.transcriptMalayalam.trim() ||
        typeof job.transcriptEnglish !== 'string' ||
        !job.transcriptEnglish.trim()
      ) {
        throw new Error('The transcription service returned an incomplete transcript. Your audio is still available to retry.');
      }

      const newInterview: InterviewItem = {
        id: `int-${Date.now()}`,
        patientName: cleanPatientName,
        participantRole,
        clinicLocation,
        date: new Date().toISOString().split('T')[0],
        audioDuration: formatTime(recordingSeconds || 30),
        audioBlob,
        transcriptMalayalam: job.transcriptMalayalam,
        transcriptEnglish: job.transcriptEnglish,
        thematicTags: [],
        sociologicalInsights: [],
      };

      await onTranscriptionComplete(newInterview);
      playSound('capture');

      // Reset recording state
      setAudioBlob(null);
      setAudioUrl(null);
      setRecordingSeconds(0);
      setPatientName('');
      setSpokenTranscript('');
    } catch (err: any) {
      console.error('Transcription failed:', err);
      setTranscriptionError(
        err instanceof Error
          ? err.message
          : 'Transcription failed. Your audio is still available to retry.'
      );
    } finally {
      setIsProcessing(false);
      setProcessingStage('');
    }
  };

  return (
    <div className="bg-white p-7 rounded-2xl border border-slate-200 shadow-sm space-y-6">
      {/* Title */}
      <div className="border-b border-slate-200 pb-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <h3 className="text-2xl font-bold text-slate-900 flex items-center gap-2.5">
          <Mic className="text-teal-700" size={26} />
          Fieldwork Interview and transcription
        </h3>
        <p className="text-xs text-slate-500 max-w-xl">
          Automated transcripts can miss words. Review the transcript against the audio before using it as research data.
        </p>

        {/* Language Mode Selector */}
        <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-semibold">
          <Languages size={15} className="text-teal-700 ml-1.5" />
          <span className="text-slate-600">Voice Language:</span>
          <button
            onClick={() => setRecordingLanguage('ml-IN')}
            className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer font-bold ${
              recordingLanguage === 'ml-IN'
                ? 'bg-teal-700 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            മലയാളം (Malayalam)
          </button>
          <button
            onClick={() => setRecordingLanguage('en-IN')}
            className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer font-bold ${
              recordingLanguage === 'en-IN'
                ? 'bg-teal-700 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            English
          </button>
        </div>
      </div>

      {/* Fieldwork Informant Metadata form */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 bg-slate-50 p-5 rounded-2xl border border-slate-200">
        {/* Patient Name */}
        <div>
          <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1.5">
            Patient Name
          </label>
          <div className="relative">
            <User size={16} className="absolute left-3.5 top-3.5 text-slate-400" />
            <input
              type="text"
              value={patientName}
              onChange={(e) => setPatientName(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-xl pl-10 pr-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-teal-600 focus:ring-1 focus:ring-teal-600 shadow-sm"
              placeholder="Enter patient name..."
            />
          </div>
        </div>

        {/* Role: Patient, Plastic / Aesthetic Surgeon, Nurse of the clinic */}
        <div>
          <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1.5">
            Role
          </label>
          <div className="relative">
            <Briefcase size={16} className="absolute left-3.5 top-3.5 text-slate-400" />
            <select
              value={participantRole}
              onChange={(e) => setParticipantRole(e.target.value as ParticipantRole)}
              className="w-full bg-white border border-slate-300 rounded-xl pl-10 pr-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-teal-600 focus:ring-1 focus:ring-teal-600 shadow-sm cursor-pointer"
            >
              <option value="Patient">Patient</option>
              <option value="Plastic / Aesthetic Surgeon">Plastic / Aesthetic Surgeon</option>
              <option value="Nurse of the clinic">Nurse of the clinic</option>
              <option value="Family Member">Family Member</option>
              <option value="Other">Other</option>
            </select>
          </div>
        </div>

        {/* Kerala Clinic Hub: Only Kochi and Kannur */}
        <div>
          <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1.5">
            Kerala Clinic Hub
          </label>
          <div className="relative">
            <MapPin size={16} className="absolute left-3.5 top-3.5 text-slate-400" />
            <select
              value={clinicLocation}
              onChange={(e) => setClinicLocation(e.target.value as 'Kochi' | 'Kannur')}
              className="w-full bg-white border border-slate-300 rounded-xl pl-10 pr-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-teal-600 focus:ring-1 focus:ring-teal-600 shadow-sm cursor-pointer"
            >
              <option value="Kochi">Kochi</option>
              <option value="Kannur">Kannur</option>
            </select>
          </div>
        </div>
      </div>

      {/* Recording Workspace / Visualizer */}
      <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200 space-y-4">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          {/* Controls */}
          <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
            {!isRecording ? (
              <button
                onClick={startRecording}
                className="w-full sm:w-auto flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-xl font-bold text-sm bg-teal-700 hover:bg-teal-800 text-white shadow-md shadow-teal-700/20 transition-all cursor-pointer"
              >
                <Mic size={18} />
                <span>Record Voice</span>
              </button>
            ) : (
              <button
                onClick={stopRecording}
                className="w-full sm:w-auto flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-xl font-bold text-sm bg-rose-600 hover:bg-rose-700 text-white shadow-md shadow-rose-600/30 animate-pulse transition-all cursor-pointer"
              >
                <Square size={16} fill="white" />
                <span>Stop Recording ({formatTime(recordingSeconds)})</span>
              </button>
            )}

            {/* Upload Button */}
            <label
              title="Common audio formats are accepted; other formats your browser can decode are converted to WAV."
              className="w-full sm:w-auto flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-xl bg-white hover:bg-slate-100 border border-slate-300 text-slate-800 text-sm font-semibold cursor-pointer shadow-sm transition-all"
            >
              <Upload size={17} className="text-teal-700" />
              <span>Upload Audio File</span>
              <input
                type="file"
                accept="audio/*,.mp3,.wav,.m4a,.webm,.ogg,.oga,.aac,.aif,.aiff,.flac,.opus,.amr,.wma,.caf,.3gp"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>

            {/* Discard / Clear Button */}
            {audioBlob && !isRecording && (
              <button
                onClick={handleResetRecording}
                className="p-3 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-xl border border-slate-200 transition-colors cursor-pointer"
                title="Discard audio and re-record"
              >
                <RotateCcw size={17} />
              </button>
            )}
          </div>

          {/* Center: Live Waveform Canvas or Audio Preview Player */}
          <div className="w-full md:flex-1 min-h-[64px] bg-white rounded-xl border border-slate-200 overflow-hidden relative flex items-center justify-center shadow-inner p-2">
            {isRecording ? (
              <canvas ref={canvasRef} width={380} height={64} className="w-full h-16" />
            ) : audioBlob ? (
              <div className="w-full space-y-1.5 px-2">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                  <span className="flex items-center gap-1.5 text-teal-900 truncate max-w-[240px]">
                    <FileAudio size={16} className="text-teal-700 shrink-0" />
                    <span className="truncate">{audioBlob instanceof File ? audioBlob.name : 'Voice Recording'}</span>
                  </span>
                  <span className="font-mono bg-slate-100 text-slate-700 px-2 py-0.5 rounded border border-slate-200 shrink-0">
                    {formatTime(recordingSeconds)} • {Math.round(audioBlob.size / 1024)} KB
                  </span>
                </div>
                {audioUrl && (
                  <audio src={audioUrl} controls className="w-full h-8" />
                )}
              </div>
            ) : (
              <span className="text-sm text-slate-500 flex items-center gap-2">
                <Volume2 size={16} />
                Awaiting live microphone voice or uploaded audio file
              </span>
            )}
          </div>

          {/* Right: Convert Entire Audio Button */}
          {audioBlob && (
            <button
              onClick={processTranscription}
              disabled={isProcessing}
              className={`w-full md:w-auto flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl font-bold text-sm text-white transition-all shadow-md ${
                isProcessing
                  ? 'bg-slate-400 cursor-not-allowed opacity-75'
                  : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/25 cursor-pointer'
              }`}
            >
              <Sparkles size={17} />
              <span>
                {isProcessing
                  ? 'Converting Entire Audio...'
                  : `Convert Entire Audio (${formatTime(recordingSeconds || 30)})`}
              </span>
            </button>
          )}
        </div>

        {/* Real-time Voice Recognition Monitor & Transcript Box */}
        {(isRecording || spokenTranscript || audioBlob) && (
          <div className="pt-3 border-t border-slate-200 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-teal-900 flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${isRecording ? 'bg-rose-500 animate-ping' : 'bg-teal-600'}`} />
                {isRecording ? 'Live Voice Speech Recognition (വാക്കുകൾ):' : 'Spoken Speech in Audio (Detected):'}
              </span>

              {!isRecording && spokenTranscript && (
                <button
                  onClick={() => setIsEditingTranscript(!isEditingTranscript)}
                  className="text-xs text-teal-700 hover:text-teal-900 font-bold flex items-center gap-1 cursor-pointer"
                >
                  <Edit2 size={12} />
                  <span>{isEditingTranscript ? 'Done Editing' : 'Fine-Tune Spoken Words'}</span>
                </button>
              )}
            </div>

            {isEditingTranscript ? (
              <textarea
                value={spokenTranscript}
                onChange={(e) => setSpokenTranscript(e.target.value)}
                rows={3}
                className="w-full bg-white border-2 border-teal-600 rounded-xl p-3 text-sm font-malayalam text-slate-900 focus:outline-none shadow-sm"
                placeholder="Spoken words detected from the interview audio..."
              />
            ) : (
              <div className="p-3.5 rounded-xl bg-white border border-slate-200 text-sm text-slate-800 font-malayalam leading-relaxed shadow-xs min-h-[44px]">
                {spokenTranscript || (
                  <span className="text-slate-400 italic font-sans text-xs">
                    {isRecording
                      ? `Listening to speech in ${recordingLanguage === 'ml-IN' ? 'Malayalam' : 'English'}... Speak into your microphone`
                      : 'Audio ready for conversion. The complete recording will be transcribed and translated into Malayalam and English.'}
                  </span>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Progress banner during transcription */}
      {isProcessing && (
        <div className="p-4 rounded-xl bg-teal-50 border border-teal-200 text-teal-900 text-sm flex items-center gap-3 animate-pulse shadow-sm">
          <div className="w-5 h-5 border-2 border-teal-700 border-t-transparent rounded-full animate-spin"></div>
          <div>
            <p className="font-bold text-teal-900">Transcription & Translation in progress</p>
            <p className="text-xs text-teal-700 mt-0.5">{processingStage}</p>
          </div>
        </div>
      )}
      {transcriptionError && (
        <div role="alert" className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm">
          {transcriptionError}
        </div>
      )}
    </div>
  );
};
