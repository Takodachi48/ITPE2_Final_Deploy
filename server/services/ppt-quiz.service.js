// server/services/ppt-quiz.service.js
import Groq from 'groq-sdk';
import { parseOffice } from 'officeparser';
import { AppError } from '../lib/errors.js';
import { env, groqConfigured } from '../config/env.js';
import { saveGeneratedQuizSchema } from '../validators/quiz.validator.js';

export const deps = {
  parseOffice,
  createGroq: (opts) => new Groq(opts),
};

export function setDeps(overrides) {
  if (overrides.parseOffice) deps.parseOffice = overrides.parseOffice;
  if (overrides.createGroq) deps.createGroq = overrides.createGroq;
}

function isPptxBlock(block) {
  if (!block) return false;
  if (block.type !== 'presentation' && block.type !== 'file') return false;
  const mime = String(block.fileMime || '').toLowerCase();
  const name = String(block.fileName || '').toLowerCase();
  const path = String(block.filePath || '').toLowerCase();
  return (
    mime === 'application/vnd.openxmlformats-officedocument.presentationml.presentation' ||
    name.endsWith('.pptx') ||
    path.endsWith('.pptx')
  );
}

export function listPptSources(blocks) {
  return (blocks || []).filter(isPptxBlock).map((b) => ({
    id: b.id,
    topicId: b.topicId,
    type: b.type,
    title: b.title || b.fileName || 'Presentation',
    fileName: b.fileName,
    fileMime: b.fileMime,
    filePath: b.filePath,
    visibleToStudents: b.visibleToStudents,
  }));
}

export async function extractPptText(buffer, fileName = 'presentation.pptx') {
  let result;
  try {
    result = await deps.parseOffice(buffer, { fileType: 'pptx', outputErrorToConsole: false });
  } catch (err) {
    throw new AppError(422, 'PPT_PARSE_FAILED', 'Could not read text from the PPTX file.', {
      reason: err?.message || 'Parse failed',
    });
  }
  let text = '';
  if (typeof result === 'string') text = result;
  else if (result && typeof result.toText === 'function') text = result.toText();
  else if (result && typeof result.text === 'string') text = result.text;
  else if (result && Array.isArray(result.slides)) text = result.slides.map((s) => s?.text || s).join('\n\n');
  else text = String(result || '');
  text = String(text || '').replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  if (!text) {
    throw new AppError(422, 'PPT_PARSE_FAILED', 'No readable text was found in the presentation.', { fileName });
  }
  const max = env.groq.maxInputChars || 12000;
  return text.length > max ? `${text.slice(0, max)}\n\n[Truncated for quiz generation]` : text;
}

function buildPrompt(text, count) {
  return `You generate classroom quiz questions from presentation text.

Return ONLY valid JSON with this exact shape:
{
  "questions": [
    {
      "type": "choice",
      "prompt": "Question text",
      "options": [{"label":"A"},{"label":"B"},{"label":"C"},{"label":"D"}],
      "correctOptionIndex": 0,
      "points": 1
    }
  ]
}

Rules:
- Create exactly ${count} questions.
- Use type "choice" for every question.
- Every question must have exactly 4 options.
- correctOptionIndex must be 0, 1, 2, or 3.
- Questions must be grounded in the presentation text.
- Keep prompts and options clear and factual.

Presentation text:
${text}`;
}

function stripFence(value) {
  const s = String(value || '').trim();
  const m = s.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return m ? m[1].trim() : s;
}

function parseGeneratedJson(raw) {
  const cleaned = stripFence(raw);
  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start >= 0 && end > start) return JSON.parse(cleaned.slice(start, end + 1));
    throw new Error('Invalid JSON');
  }
}

function isGroqModelError(err) {
  const code = String(err?.code || err?.error?.code || '').toLowerCase();
  const type = String(err?.type || err?.error?.type || '').toLowerCase();
  const msg = String(err?.message || err?.error?.message || '').toLowerCase();
  return code === 'model_not_found' || (type.includes('invalid_request') && msg.includes('model')) || msg.includes('does not exist');
}

export async function generateQuestionsFromPpt(buffer, count = 10, fileName = 'presentation.pptx') {
  if (!groqConfigured) {
    throw new AppError(503, 'AI_NOT_CONFIGURED', 'AI quiz generation is not configured. Set GROQ_API_KEY on the server.');
  }
  const text = await extractPptText(buffer, fileName);
  const groq = deps.createGroq({ apiKey: env.groq.apiKey, timeout: env.groq.timeoutMs });
  let lastError;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const completion = await groq.chat.completions.create(
        {
          model: env.groq.model,
          temperature: attempt === 0 ? 0.2 : 0,
          max_completion_tokens: 4096,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: 'You output valid JSON only.' },
            { role: 'user', content: buildPrompt(text, count) },
          ],
        },
        { timeout: env.groq.timeoutMs },
      );
      const content = completion?.choices?.[0]?.message?.content;
      const raw = typeof content === 'string' ? content : Array.isArray(content) ? content.map((p) => p?.text || '').join('') : '';
      const parsed = parseGeneratedJson(raw);
      const validated = saveGeneratedQuizSchema.safeParse(parsed);
      if (!validated.success) {
        throw new Error(validated.error.issues.map((i) => i.message).join('; '));
      }
      if (validated.data.questions.length !== count) {
        throw new Error(`Expected ${count} questions.`);
      }
      return validated.data.questions;
    } catch (err) {
      lastError = err;
      if (isGroqModelError(err)) break;
    }
  }
  if (isGroqModelError(lastError)) {
    throw new AppError(422, 'AI_GENERATION_FAILED', `Groq model "${env.groq.model}" is unavailable for this API key. Set GROQ_MODEL (for example openai/gpt-oss-120b) in .env and restart the API.`, {
      reason: lastError?.message || lastError?.error?.message || 'model_not_found',
      model: env.groq.model,
    });
  }
  throw new AppError(422, 'AI_GENERATION_FAILED', 'Could not generate valid quiz questions from the presentation.', {
    reason: lastError?.message || lastError?.error?.message || 'Unknown generation error',
  });
}