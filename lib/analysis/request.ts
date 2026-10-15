import type { AnalyzeRequest } from './types';
import { AnalysisError } from './config';
export function validateAnalyzeRequest(value: unknown): AnalyzeRequest {
  const v = value as AnalyzeRequest;
  if (!v || typeof v !== 'object' || !['en','zh'].includes(v.locale) || typeof v.imageDataUrl !== 'string') throw new AnalysisError('INVALID_INPUT', 'A photo and language are required.', 400);
  if (v.imageDataUrl.length > 2_600_000) throw new AnalysisError('IMAGE_TOO_LARGE', 'Please use a smaller image.', 413);
  const match = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(v.imageDataUrl);
  if (!match || match[2].length < 64 || match[2].length % 4 !== 0) throw new AnalysisError('INVALID_IMAGE', 'Please upload a JPEG, PNG or WebP image.', 400);
  let signature = ''; try { signature = atob(match[2].slice(0, 32)); } catch { /* Invalid base64 handled below. */ }
  if (!(match[1] === 'jpeg' && signature.startsWith('\xff\xd8\xff') || match[1] === 'png' && signature.startsWith('\x89PNG\r\n\x1a\n') || match[1] === 'webp' && signature.startsWith('RIFF') && signature.slice(8, 12) === 'WEBP')) throw new AnalysisError('INVALID_IMAGE', 'The file is not a supported image.', 400);
  if (typeof v.capturedAt !== 'string' || v.capturedAt.length > 40 || !/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(v.capturedAt) || !Number.isFinite(Date.parse(v.capturedAt)) || Date.parse(v.capturedAt) < Date.parse('2000-01-01') || Date.parse(v.capturedAt) > Date.now() + 86_400_000) throw new AnalysisError('INVALID_TIME', 'Please provide a valid capture time.', 400);
  if (typeof v.timeZone !== 'string' || v.timeZone.length > 80) throw new AnalysisError('INVALID_TIME', 'Please provide a valid time zone.', 400);
  try { new Intl.DateTimeFormat('en', { timeZone: v.timeZone }); } catch { throw new AnalysisError('INVALID_TIME', 'Please provide a valid time zone.', 400); }
  if (v.hint !== undefined && (typeof v.hint !== 'string' || v.hint.length > 400)) throw new AnalysisError('INVALID_INPUT', 'Keep the game hint under 400 characters.', 400);
  if (v.selectedEvent && (typeof v.selectedEvent.league !== 'string' || !/^[a-z0-9-]{1,30}$/.test(v.selectedEvent.league) || typeof v.selectedEvent.eventId !== 'string' || !/^\d{1,20}$/.test(v.selectedEvent.eventId))) throw new AnalysisError('INVALID_INPUT', 'Please choose a valid game.', 400);
  return { imageDataUrl: v.imageDataUrl, capturedAt: new Date(v.capturedAt).toISOString(), timeZone: v.timeZone, locale: v.locale, hint: v.hint?.trim(), selectedEvent: v.selectedEvent };
}
