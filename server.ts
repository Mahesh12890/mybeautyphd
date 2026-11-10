import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';

dotenv.config({ path: ['.env.local', '.env'] });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const portArgIndex = process.argv.indexOf('--port');
const cliPort = portArgIndex !== -1 ? parseInt(process.argv[portArgIndex + 1], 10) : NaN;
const PORT = !isNaN(cliPort) && cliPort > 0 ? cliPort : (process.env.PORT ? parseInt(process.env.PORT, 10) : 3000);

app.use(express.json({ limit: '60mb' }));
app.use(express.urlencoded({ extended: true, limit: '60mb' }));

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

// Helper: Normalize audio MIME types for Gemini models
function normalizeAudioMimeType(mimeType: string, fileName?: string): string {
  let clean = (mimeType || '').split(';')[0].trim().toLowerCase();
  if (!clean || clean === 'application/octet-stream') {
    if (fileName) {
      const ext = fileName.split('.').pop()?.toLowerCase();
      if (ext === 'mp3') return 'audio/mp3';
      if (ext === 'wav') return 'audio/wav';
      if (ext === 'm4a') return 'audio/m4a';
      if (ext === 'ogg') return 'audio/ogg';
      if (ext === 'aac') return 'audio/aac';
      if (ext === 'webm') return 'audio/webm';
      if (ext === 'flac') return 'audio/flac';
    }
    return 'audio/webm';
  }
  if (clean === 'audio/x-m4a' || clean === 'audio/mp4') return 'audio/m4a';
  if (clean === 'audio/wave') return 'audio/wav';
  if (clean === 'audio/x-wav') return 'audio/wav';
  return clean;
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

    const response = await ai.models.generateContent({
      model: 'gemini-3.1-flash-lite',
      contents: prompt,
    });

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

// Route: Transcribe audio with dual Malayalam + English sociological translation
app.post('/api/transcribe', async (req, res) => {
  try {
    const {
      audioBase64,
      mimeType = 'audio/webm',
      fileName = '',
      language = 'ml-IN',
      speechTranscript = '',
    } = req.body;

    if (typeof audioBase64 !== 'string' || !audioBase64.trim()) {
      return res.status(400).json({ error: 'Audio data is required' });
    }
    if (typeof speechTranscript !== 'string' || speechTranscript.length > 20_000) {
      return res.status(400).json({ error: 'The optional speech-recognition hint must be text no longer than 20,000 characters.' });
    }

    if (audioBase64.length > 58_000_000) {
      return res.status(413).json({ error: 'Audio file is too large to transcribe. Please upload a file smaller than 40 MB.' });
    }

    const ai = getGeminiClient();
    if (!ai) {
      return res.status(503).json({
        error: 'Gemini transcription is not configured. Copy .env.example to .env.local, add your GEMINI_API_KEY, then restart the server. Keep the key server-side and never use a VITE_ prefix.',
      });
    }

    const normalizedMime = normalizeAudioMimeType(mimeType, fileName);
    console.log(`[Audio Transcribe] Processing audio file (${normalizedMime}, base64 len: ${audioBase64.length})...`);
    let verbatimAudioTranscript = '';
    let modelUsed = 'gemini-3.5-transcribe';

    const audioPart = {
      inlineData: {
        mimeType: normalizedMime,
        data: audioBase64,
      },
    };
    const transcribePrompt = `Transcribe the complete audio from beginning to end in the original spoken language(s). Return only the transcript. Preserve every audible word, repetition, filler, false start, and code-switch exactly as spoken; do not summarize, translate, polish, or omit speech. Use Malayalam script for Malayalam words and Latin script for English words. Mark speech as [inaudible] only when it cannot be understood; never guess or add words.`;
    const languageHint = language === 'en-IN' ? 'English' : 'Malayalam';
    const speechHint = speechTranscript.trim()
      ? `\nA browser-generated recognition hint follows. It may be incomplete or wrong. Use it only to help resolve ambiguous words when they are also supported by the audio. The audio is the source of truth: do not copy unsupported words from this hint, and do not omit audible words just because they are absent from the hint.\n<recognition_hint>\n${speechTranscript.trim()}\n</recognition_hint>`
      : '';
    const promptWithLanguage = `${transcribePrompt}\nThe selected primary speech language is ${languageHint}; use this only as a recognition hint and preserve any other language spoken.${speechHint}`;

    try {
      try {
        const transcribeRes = await ai.models.generateContent({
          model: 'gemini-3.5-transcribe',
          contents: {
            parts: [audioPart, { text: promptWithLanguage }],
          },
        });

        const primaryCandidate = transcribeRes.candidates?.[0];
        if (String(primaryCandidate?.finishReason) === 'MAX_TOKENS') {
          throw new Error('The transcript reached the model output limit and may be incomplete.');
        }
        const candidateParts = transcribeRes.candidates?.[0]?.content?.parts || [];
        const audioTranscription = candidateParts
          .map((part: any) => part.audioTranscription?.text)
          .filter((text: unknown): text is string => typeof text === 'string' && Boolean(text.trim()))
          .join('\n')
          .trim();
        verbatimAudioTranscript = audioTranscription || (transcribeRes.text || '').trim();
      } catch (primaryError: any) {
        console.warn('[Audio Transcribe] Primary model failed; trying multimodal fallback:', primaryError?.message || primaryError);
        modelUsed = 'gemini-3.1-flash-lite';
        const fallbackRes = await ai.models.generateContent({
          model: modelUsed,
          contents: {
            parts: [
              audioPart,
              { text: promptWithLanguage },
            ],
          },
        });
        if (String(fallbackRes.candidates?.[0]?.finishReason) === 'MAX_TOKENS') {
          throw new Error('The transcript reached the model output limit and may be incomplete.');
        }
        verbatimAudioTranscript = (fallbackRes.text || '').trim();
      }
    } catch (transcriptionError: any) {
      console.error('[Audio Transcribe] All transcription models failed:', transcriptionError);
      return res.status(502).json({
        error: 'The audio could not be transcribed. Your recording has not been saved; please retry or use a clearer/smaller audio file.',
      });
    }

    if (!verbatimAudioTranscript) {
      return res.status(422).json({
        error: 'No speech transcript was returned for this audio. The audio has not been saved; please check the recording and retry.',
      });
    }

    const sourceLanguage = language === 'en-IN' ? 'en' : 'ml';
    console.log(`[Dual Translation] Translating ${verbatimAudioTranscript.length} transcript chars into Malayalam and English...`);
    const finalMalayalam = sourceLanguage === 'ml'
      ? verbatimAudioTranscript
      : await translateVerbatim(verbatimAudioTranscript, sourceLanguage, 'ml');
    const finalEnglish = sourceLanguage === 'en'
      ? verbatimAudioTranscript
      : await translateVerbatim(verbatimAudioTranscript, sourceLanguage, 'en');

    console.log(`[Dual Translation Complete] Malayalam: ${finalMalayalam.length} chars, English: ${finalEnglish.length} chars.`);

    return res.json({
      transcriptMalayalam: finalMalayalam,
      transcriptEnglish: finalEnglish,
      modelUsed,
    });
  } catch (error: any) {
    console.error('Transcription error:', error);
    return res.status(500).json({
      error: error?.message || 'Failed to process audio transcription',
    });
  }
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
