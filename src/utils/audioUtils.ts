import { InterviewItem } from '../types';

// Web Audio API synth sounds for tactile feedback in chess and recording
let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    audioCtx = new AudioContextClass();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

export function playSound(type: 'move' | 'capture' | 'check' | 'gameover' | 'recStart' | 'recStop' | 'click') {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === 'move') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.exponentialRampToValueAtTime(320, now + 0.08);
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
      osc.start(now);
      osc.stop(now + 0.08);
    } else if (type === 'capture') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(260, now);
      osc.frequency.exponentialRampToValueAtTime(600, now + 0.12);
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
      osc.start(now);
      osc.stop(now + 0.12);
    } else if (type === 'check') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(580, now);
      osc.frequency.linearRampToValueAtTime(880, now + 0.18);
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
      osc.start(now);
      osc.stop(now + 0.18);
    } else if (type === 'gameover') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(330, now);
      osc.frequency.setValueAtTime(440, now + 0.15);
      osc.frequency.setValueAtTime(660, now + 0.3);
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
      osc.start(now);
      osc.stop(now + 0.5);
    } else if (type === 'recStart') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.12);
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
      osc.start(now);
      osc.stop(now + 0.14);
    } else if (type === 'recStop') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, now);
      osc.frequency.exponentialRampToValueAtTime(440, now + 0.12);
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
      osc.start(now);
      osc.stop(now + 0.14);
    } else {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(500, now);
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
      osc.start(now);
      osc.stop(now + 0.04);
    }
  } catch (e) {
    // AudioContext might be restricted prior to user gesture
  }
}

export function exportToFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Plain text PDF export without decorative boxes or watermarks
 */
export function exportInterviewToPdf(interview: InterviewItem) {
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (!doc) return;

  const pName = interview?.patientName || (interview as any)?.codeName || 'Participant';
  const pRole = interview?.participantRole || (interview as any)?.participantType || 'Patient';
  const pLoc = interview?.clinicLocation || 'Kochi';
  const pDate = interview?.date || '';
  const pDur = interview?.audioDuration || '00:00';
  const pMl = interview?.transcriptMalayalam || '';
  const pEng = interview?.transcriptEnglish || '';

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${pName} - Transcript</title>
  <style>
    @page { margin: 25mm 20mm; size: A4; }
    body {
      font-family: 'Times New Roman', Times, serif;
      color: #000000;
      line-height: 1.6;
      margin: 0;
      padding: 0;
      font-size: 12pt;
    }
    h1 {
      font-size: 16pt;
      font-weight: bold;
      margin: 0 0 14pt 0;
      color: #000000;
    }
    .details {
      margin-bottom: 20pt;
      font-size: 11.5pt;
      line-height: 1.5;
    }
    .details p {
      margin: 3pt 0;
    }
    h2 {
      font-size: 13pt;
      font-weight: bold;
      margin-top: 20pt;
      margin-bottom: 8pt;
      color: #000000;
    }
    .transcript-text {
      font-size: 12pt;
      line-height: 1.8;
      margin: 0 0 20pt 0;
      white-space: pre-wrap;
    }
  </style>
</head>
<body>
  <h1>Fieldwork Interview Transcript</h1>

  <div class="details">
    <p><strong>Patient Name:</strong> ${pName}</p>
    <p><strong>Role:</strong> ${pRole}</p>
    <p><strong>Clinic Hub:</strong> ${pLoc}</p>
    <p><strong>Date:</strong> ${pDate}</p>
    <p><strong>Duration:</strong> ${pDur}</p>
  </div>

  <h2>1. Malayalam Audio Transcript (യഥാർത്ഥ വിവരണം)</h2>
  <div class="transcript-text">
    ${pMl ? pMl.replace(/\n/g, '<br/>') : 'No transcript recorded.'}
  </div>

  <h2>2. Parallel English Translation</h2>
  <div class="transcript-text">
    ${pEng ? pEng.replace(/\n/g, '<br/>') : 'No translation recorded.'}
  </div>
</body>
</html>`;

  doc.open();
  doc.write(html);
  doc.close();

  setTimeout(() => {
    iframe.contentWindow?.focus();
    iframe.contentWindow?.print();
    setTimeout(() => {
      document.body.removeChild(iframe);
    }, 1000);
  }, 400);
}

/**
 * Plain text Microsoft Word (.doc) export without boxes, borders, or watermarks
 */
export function exportInterviewToDoc(interview: InterviewItem) {
  const pName = interview?.patientName || (interview as any)?.codeName || 'Participant';
  const pRole = interview?.participantRole || (interview as any)?.participantType || 'Patient';
  const pLoc = interview?.clinicLocation || 'Kochi';
  const pDate = interview?.date || '';
  const pDur = interview?.audioDuration || '00:00';
  const pMl = interview?.transcriptMalayalam || '';
  const pEng = interview?.transcriptEnglish || '';

  const content = `<!DOCTYPE html>
<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
<head>
  <meta charset="utf-8">
  <title>${pName} - Transcript</title>
  <style>
    body {
      font-family: 'Times New Roman', serif;
      font-size: 12pt;
      line-height: 1.6;
      color: #000000;
      margin: 1in;
    }
    h1 {
      font-size: 16pt;
      font-weight: bold;
      margin: 0 0 14pt 0;
      color: #000000;
    }
    .details {
      margin-bottom: 20pt;
      font-size: 12pt;
      line-height: 1.5;
    }
    .details p {
      margin: 3pt 0;
    }
    h2 {
      font-size: 13pt;
      font-weight: bold;
      margin-top: 20pt;
      margin-bottom: 8pt;
      color: #000000;
    }
    .transcript-text {
      font-size: 12pt;
      line-height: 1.8;
      margin: 0 0 20pt 0;
    }
  </style>
</head>
<body>
  <h1>Fieldwork Interview Transcript</h1>

  <div class="details">
    <p><strong>Patient Name:</strong> ${pName}</p>
    <p><strong>Role:</strong> ${pRole}</p>
    <p><strong>Clinic Hub:</strong> ${pLoc}</p>
    <p><strong>Date:</strong> ${pDate}</p>
    <p><strong>Duration:</strong> ${pDur}</p>
  </div>

  <h2>1. Malayalam Audio Transcript (യഥാർത്ഥ വിവരണം)</h2>
  <div class="transcript-text">
    ${pMl ? pMl.replace(/\n/g, '<br/>') : 'No transcript recorded.'}
  </div>

  <h2>2. Parallel English Translation</h2>
  <div class="transcript-text">
    ${pEng ? pEng.replace(/\n/g, '<br/>') : 'No translation recorded.'}
  </div>
</body>
</html>`;

  exportToFile(content, `${pName.replace(/\s+/g, '_')}_Transcript.doc`, 'application/msword');
}
