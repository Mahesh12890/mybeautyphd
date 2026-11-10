import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { randomUUID } from 'crypto';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import multer from 'multer';
import ffmpegPath from 'ffmpeg-static';
import { GoogleGenAI, createPartFromUri, createUserContent } from '@google/genai';

dotenv.config({ path: ['.env.local', '.env'] });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const execFileAsync = promisify(execFile);
const portArgIndex = process.argv.indexOf('--port');
const cliPort = portArgIndex !== -1 ? parseInt(process.argv[portArgIndex + 1], 10) : NaN;
const PORT = !isNaN(cliPort) && cliPort > 0 ? cliPort : (process.env.PORT ? parseInt(process.env.PORT, 10) : 3000);

app.use(express.json({ limit: '60mb' }));
app.use(express.urlencoded({ extended: true, limit: '60mb' }));

interface TranscriptionJob {
  status: 'working' | 'done' | 'error';
  progress: string;
  text: string;
  error?: string;
  transcriptMalayalam?: string;
  transcriptEnglish?: string;
}

const transcriptionJobs = new Map<string, TranscriptionJob>();
const transcriptionRequestsHoldingSlots = new WeakSet<express.Request>();
let activeTranscriptionRequests = 0;
const transcriptionUploadDirectory = path.join(os.tmpdir(), 'aurascholar-uploads');
fs.mkdirSync(transcriptionUploadDirectory, { recursive: true });

const audioUpload = multer({
  dest: transcriptionUploadDirectory,
  limits: {
    fileSize: 500 * 1024 * 1024,
    files: 1,
    fields: 2,
    fieldSize: 20 * 1024,
  },
});

function releaseTranscriptionSlot(req: express.Request): void {
  if (!transcriptionRequestsHoldingSlots.has(req)) return;
  transcriptionRequestsHoldingSlots.delete(req);
  activeTranscriptionRequests -= 1;
}

const receiveAudioUpload: express.RequestHandler = (req, res, next) => {
  if (activeTranscriptionRequests >= 2) {
    res.status(429).json({ error: 'The transcription server is busy. Please retry in a few minutes.' });
    return;
  }

  activeTranscriptionRequests += 1;
  transcriptionRequestsHoldingSlots.add(req);
  req.once('aborted', () => {
    releaseTranscriptionSlot(req);
    if (req.file?.path) {
      void fs.promises.rm(req.file.path, { force: true }).catch((cleanupError) => {
        console.error('Could not remove aborted audio upload:', cleanupError);
      });
    }
  });
  audioUpload.single('audio')(req, res, (error: unknown) => {
    if (!error) {
      next();
      return;
    }

    releaseTranscriptionSlot(req);
    if (req.file?.path) {
      void fs.promises.rm(req.file.path, { force: true }).catch((cleanupError) => {
        console.error('Could not remove incomplete audio upload:', cleanupError);
      });
    }

    if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
      res.status(413).json({ error: 'Audio files must be 500 MB or smaller.' });
      return;
    }

    if (error instanceof multer.MulterError) {
      res.status(400).json({ error: `Audio upload failed: ${error.message}` });
      return;
    }

    next(error);
  });
};

// Shared server-side Gemini client
const getGeminiClient = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
};

type GeminiClient = NonNullable<ReturnType<typeof getGeminiClient>>;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function generateWithRetry(
  ai: GeminiClient,
  contents: ReturnType<typeof createUserContent>
) {
  const models = [...new Set([
    process.env.GEMINI_MODEL?.trim() || 'gemini-3.8-flash',
    process.env.GEMINI_FALLBACK_MODEL?.trim(),
  ].filter((model): model is string => Boolean(model)))];

  let lastError: unknown;
  for (const model of models) {
    for (let attempt = 1; attempt <= 5; attempt++) {
      try {
        return await ai.models.generateContent({ model, contents });
      } catch (error) {
        lastError = error;
        const message = error instanceof Error ? error.message : String(error);
        const retryable = /503|UNAVAILABLE|429|overloaded|high demand|RESOURCE_EXHAUSTED/i.test(message);
        if (!retryable) throw error;

        console.warn(`[Gemini] Model ${model} is temporarily unavailable (attempt ${attempt}/5).`);
        if (attempt < 5) await sleep(attempt * 5_000);
      }
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error('All configured Gemini models are temporarily unavailable.');
}

function splitTranscriptIntoChunks(text: string, maxLength = 1600): string[] {
  const chunks: string[] = [];
  let remaining = text.trim();

  while (remaining.length > maxLength) {
    let splitIndex = -1;
    const minimumIndex = Math.floor(maxLength * 0.6);
    for (const boundary of ['.', '?', '!', '।', '\n']) {
      const candidate = remaining.lastIndexOf(boundary, maxLength);
      if (candidate >= minimumIndex && candidate > splitIndex) {
        splitIndex = candidate + 1;
      }
    }

    if (splitIndex === -1) {
      splitIndex = remaining.lastIndexOf(' ', maxLength);
      if (splitIndex < minimumIndex) splitIndex = maxLength;
    }

    chunks.push(remaining.slice(0, splitIndex).trim());
    remaining = remaining.slice(splitIndex).trim();
  }

  if (remaining) chunks.push(remaining);
  return chunks;
}

async function translateVerbatim(text: string, fromLang: 'ml' | 'en', toLang: 'ml' | 'en'): Promise<string> {
  if (!text || !text.trim()) return '';

  const ai = getGeminiClient();
  if (!ai) {
    throw new Error('Translation is unavailable because GEMINI_API_KEY is not configured on the server.');
  }

  const chunks = splitTranscriptIntoChunks(text);
  const translatedChunks: string[] = [];
  const sourceLanguage = fromLang === 'ml' ? 'Malayalam' : 'English';
  const targetLanguage = toLang === 'ml' ? 'Malayalam' : 'English';

  for (const [index, chunk] of chunks.entries()) {
    const sameLanguage = fromLang === toLang;
    const prompt = `You are a careful ${targetLanguage} translator preparing a complete, faithful transcript of spoken fieldwork.
Translate this transcript segment word-for-word from ${sourceLanguage} into ${targetLanguage}, as closely as the target language's grammar allows. ${
      sameLanguage
        ? `Keep words already spoken in ${targetLanguage} verbatim and translate any code-switched words into ${targetLanguage}.`
        : `Translate every spoken word and utterance into ${targetLanguage}, including code-switched words.`
    }
Preserve every sentence, repetition, filler, false start, name, number, and the original order. Do not summarize, omit, add, or explain anything. Use ${toLang === 'ml' ? 'Malayalam script' : 'Latin script'} for the translation. Return only this segment's complete translation.

Transcript segment ${index + 1} of ${chunks.length}:
${chunk}`;

    const response = await generateWithRetry(ai, createUserContent(prompt));

    if (String(response.candidates?.[0]?.finishReason) === 'MAX_TOKENS') {
      throw new Error(`The ${targetLanguage} translation stopped before segment ${index + 1} was complete. Please retry.`);
    }

    const translated = response.text?.trim();
    if (!translated) {
      throw new Error(`The ${targetLanguage} translation returned no text for segment ${index + 1}. Please retry.`);
    }
    translatedChunks.push(translated);
  }

  return translatedChunks.join('\n').trim();
}

async function processTranscriptionJob(
  jobId: string,
  filePath: string,
  language: 'ml-IN' | 'en-IN',
  speechTranscript: string
): Promise<void> {
  const job = transcriptionJobs.get(jobId);
  if (!job) throw new Error(`Transcription job ${jobId} was not found.`);

  const chunksDirectory = path.join(os.tmpdir(), `aurascholar-chunks-${jobId}`);
  const ai = getGeminiClient();

  try {
    if (!ai) throw new Error('Gemini transcription is not configured on the server.');
    if (!ffmpegPath) throw new Error('Audio conversion is unavailable on this server platform.');
    fs.mkdirSync(chunksDirectory, { recursive: true });
    job.progress = 'Converting audio into 10-minute transcription segments...';
    await execFileAsync(ffmpegPath, [
      '-hide_banner',
      '-loglevel', 'error',
      '-i', filePath,
      '-map', '0:a:0',
      '-vn',
      '-f', 'segment',
      '-segment_time', '600',
      '-reset_timestamps', '1',
      '-ac', '1',
      '-ar', '16000',
      '-c:a', 'pcm_s16le',
      '-segment_format', 'wav',
      '-y',
      path.join(chunksDirectory, 'part%03d.wav'),
    ]);

    const chunks = (await fs.promises.readdir(chunksDirectory))
      .filter((name) => /^part\d+\.wav$/i.test(name))
      .sort((left, right) => left.localeCompare(right, undefined, { numeric: true }));
    if (chunks.length === 0) {
      throw new Error('No audio track was found in the uploaded file.');
    }

    const transcribedChunks: string[] = [];
    const languageHint = language === 'en-IN' ? 'English' : 'Malayalam';
    const transcribeInstruction = `Transcribe this audio segment exactly as spoken. The primary speech language is ${languageHint}, but preserve any other spoken languages and code-switching. Write Malayalam in Malayalam script and English in Latin script. Preserve every audible word, repetition, filler, and false start. Do not translate, summarize, polish, or omit speech. Mark only unintelligible speech as [inaudible]; never guess. Return only the transcript.`;

    for (const [index, chunkName] of chunks.entries()) {
      job.progress = `Transcribing part ${index + 1} of ${chunks.length}...`;
      const uploadedFile = await ai.files.upload({
        file: path.join(chunksDirectory, chunkName),
        config: { mimeType: 'audio/wav' },
      });

      try {
        if (!uploadedFile.uri || !uploadedFile.mimeType) {
          throw new Error(`Gemini did not return a usable upload reference for part ${index + 1}.`);
        }

        const recognitionHint = index === 0 && speechTranscript
          ? `\n\nOptional browser speech-recognition hint (may be incomplete or incorrect; use only when supported by the audio):\n${speechTranscript}`
          : '';
        const response = await generateWithRetry(ai, createUserContent([
          createPartFromUri(uploadedFile.uri, uploadedFile.mimeType),
          `${transcribeInstruction}${recognitionHint}`,
        ]));

        if (String(response.candidates?.[0]?.finishReason) === 'MAX_TOKENS') {
          throw new Error(`The transcript reached the model output limit on part ${index + 1}.`);
        }
        const transcript = response.text?.trim();
        if (!transcript) {
          throw new Error(`Gemini returned no transcript for part ${index + 1}.`);
        }

        transcribedChunks.push(transcript);
        job.text = transcribedChunks.join('\n\n');
      } finally {
        if (uploadedFile.name) {
          try {
            await ai.files.delete({ name: uploadedFile.name });
          } catch (deleteError) {
            console.warn(`Could not delete the temporary Gemini upload for part ${index + 1}:`, deleteError);
          }
        }
      }
    }

    const verbatimAudioTranscript = transcribedChunks.join('\n\n').trim();
    if (!verbatimAudioTranscript) {
      throw new Error('No speech transcript was returned. Check the recording and retry.');
    }

    const sourceLanguage = /[\u0D00-\u0D7F]/.test(verbatimAudioTranscript)
      ? 'ml'
      : language === 'en-IN' ? 'en' : 'ml';
    job.progress = 'Translating the complete transcript into Malayalam...';
    job.transcriptMalayalam = sourceLanguage === 'ml'
      ? verbatimAudioTranscript
      : await translateVerbatim(verbatimAudioTranscript, sourceLanguage, 'ml');

    job.progress = 'Translating the complete transcript into English...';
    job.transcriptEnglish = sourceLanguage === 'en'
      ? verbatimAudioTranscript
      : await translateVerbatim(verbatimAudioTranscript, sourceLanguage, 'en');

    job.status = 'done';
    job.progress = 'Transcription and translation complete.';
  } finally {
    await Promise.all([
      fs.promises.rm(chunksDirectory, { recursive: true, force: true }),
      fs.promises.rm(filePath, { force: true }),
    ]);
  }
}

app.post('/api/transcribe', receiveAudioUpload, (req, res) => {
  const file = req.file;
  if (!file) {
    releaseTranscriptionSlot(req);
    return res.status(400).json({ error: 'Choose an audio file to transcribe.' });
  }

  const ai = getGeminiClient();
  if (!ai) {
    releaseTranscriptionSlot(req);
    void fs.promises.rm(file.path, { force: true }).catch((error) => {
      console.error('Could not remove audio upload after missing API configuration:', error);
    });
    return res.status(503).json({
      error: 'Gemini transcription is not configured on the server. Set GEMINI_API_KEY in the server environment and restart it.',
    });
  }

  const language = req.body.language === 'en-IN' ? 'en-IN' : 'ml-IN';
  const speechTranscript = typeof req.body.speechTranscript === 'string'
    ? req.body.speechTranscript.trim().slice(0, 20_000)
    : '';
  const jobId = randomUUID();
  const job: TranscriptionJob = {
    status: 'working',
    progress: 'Starting transcription...',
    text: '',
  };
  transcriptionJobs.set(jobId, job);

  void processTranscriptionJob(jobId, file.path, language, speechTranscript)
    .catch((error: unknown) => {
      console.error(`[Audio Transcribe] Job ${jobId} failed:`, error);
      job.status = 'error';
      job.error = error instanceof Error ? error.message : 'Transcription failed. Please retry with a valid audio file.';
    })
    .finally(() => {
      releaseTranscriptionSlot(req);
      const expiryTimer = setTimeout(() => transcriptionJobs.delete(jobId), 60 * 60 * 1000);
      expiryTimer.unref();
    });

  return res.json({ jobId });
});

app.get('/api/transcribe/:id', (req, res) => {
  const job = transcriptionJobs.get(req.params.id);
  if (!job) {
    return res.status(404).json({ status: 'error', error: 'Transcription job not found or expired.' });
  }
  return res.json(job);
});

// Route: Qualitative Coding & Fieldwork Synthesis helper
app.post('/api/analyze-transcript', async (req, res) => {
  try {
    const { text, existingTags, chapterContext } = req.body;
    const ai = getGeminiClient();

    if (!ai) {
      return res.json({
        theoreticalFramework: "Pierre Bourdieu's Theory of Bodily Capital & Anthony Giddens' Reflexive Project of the Self",
        recommendedCodingNodes: [
          "Habitus and Physical Capital in Matrimonial Negotiations",
          "Transnational Remittances & Commodification of Beauty in Kerala",
          "Stigma Management and Secrecy Strategies"
        ],
        thesisRelevance: "Directly corroborates Chapter 4 hypothesis regarding the shift from biological essentialism to customizable self-presentation in post-liberalization Kerala."
      });
    }

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: `You are an academic dissertation advisor in Medical Sociology specializing in Kerala society.
Analyze this interview extract or field note regarding cosmetic surgery:
"${text}"

Existing tags: ${JSON.stringify(existingTags || [])}
Chapter focus: ${chapterContext || 'Aesthetic economy and bodily capital in Kerala'}

Generate a JSON object with:
- "theoreticalFramework": String indicating primary theoretical lenses (e.g. Bourdieu, Foucault, Shilling, Hochschild)
- "recommendedCodingNodes": Array of 3 specific NVivo/Atlas.ti style coding nodes
- "thesisRelevance": String connecting this data to doctoral arguments on Kerala's socio-cultural landscape
- "keyQuotableExcerpt": String with the most impactful quote in English
- "critiqueOrNuance": String highlighting reflexive researcher considerations.`,
      config: {
        responseMimeType: 'application/json',
      },
    });

    const parsed = JSON.parse(response.text || '{}');
    return res.json(parsed);
  } catch (err: any) {
    console.error('Analysis error:', err);
    return res.status(500).json({ error: err?.message || 'Analysis failed' });
  }
});

// Persistent server-side filesystem backup for Plastic Beauty Showcase Photos
const SHOWCASE_DATA_FILE = path.resolve(__dirname, 'src', 'data', 'showcase_photos.json');

function ensureShowcaseDirectory() {
  const dir = path.dirname(SHOWCASE_DATA_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function readStoredShowcasePhotos(): any[] {
  try {
    ensureShowcaseDirectory();
    if (fs.existsSync(SHOWCASE_DATA_FILE)) {
      const data = fs.readFileSync(SHOWCASE_DATA_FILE, 'utf-8');
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (err) {
    console.warn('Could not read showcase photos file:', err);
  }
  return [];
}

function writeStoredShowcasePhotos(photos: any[]) {
  try {
    ensureShowcaseDirectory();
    fs.writeFileSync(SHOWCASE_DATA_FILE, JSON.stringify(photos, null, 2), 'utf-8');
  } catch (err) {
    console.error('Could not save showcase photos file:', err);
  }
}

app.get('/api/showcase/all', (_req, res) => {
  const photos = readStoredShowcasePhotos();
  res.json(photos);
});

app.post('/api/showcase/save', (req, res) => {
  const item = req.body;
  if (!item || !item.id) {
    return res.status(400).json({ error: 'Item with ID required' });
  }
  const photos = readStoredShowcasePhotos();
  const index = photos.findIndex((p: any) => p.id === item.id);
  if (index >= 0) {
    photos[index] = item;
  } else {
    photos.unshift(item);
  }
  writeStoredShowcasePhotos(photos);
  res.json({ success: true, count: photos.length });
});

app.post('/api/showcase/batch', (req, res) => {
  const items = req.body;
  if (!Array.isArray(items)) {
    return res.status(400).json({ error: 'Array of items required' });
  }
  writeStoredShowcasePhotos(items);
  res.json({ success: true, count: items.length });
});

app.delete('/api/showcase/:id', (req, res) => {
  const id = req.params.id;
  let photos = readStoredShowcasePhotos();
  photos = photos.filter((p: any) => p.id !== id);
  writeStoredShowcasePhotos(photos);
  res.json({ success: true, count: photos.length });
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`AuraScholar server running at http://0.0.0.0:${PORT}`);
  });
  server.requestTimeout = 30 * 60 * 1000;

  server.on('error', (err: any) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`Port ${PORT} is already in use. Retrying...`);
    } else {
      console.error('Server error:', err);
    }
  });

  process.on('SIGTERM', () => {
    server.close(() => process.exit(0));
  });
}

process.on('uncaughtException', (err) => {
  console.error('Uncaught exception in server:', err);
});

process.on('unhandledRejection', (reason) => {
  console.warn('Unhandled promise rejection:', reason);
});

startServer();
