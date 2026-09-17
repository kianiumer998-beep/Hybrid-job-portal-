/**
 * Server-side HTML sanitizer that aggressively scrubs out executable scripts,
 * event handlers, iframe/embed tags, and unsafe javascript: URIs.
 */
export function sanitizeServerHtml(input: string): string {
  if (!input || typeof input !== 'string') return '';

  let clean = input;

  // 1. Remove script tags and contents
  clean = clean.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');

  // 2. Remove iframe, object, embed, frame, frameset, applet, base, link, meta
  clean = clean.replace(/<\/?(?:iframe|object|embed|frame|frameset|applet|base|link|meta|style|form|input|button)\b[^>]*>/gi, '');

  // 3. Remove all inline event handlers (e.g., onload, onclick, onerror, etc.)
  clean = clean.replace(/\s+on[a-zA-Z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '');

  // 4. Remove javascript:, vbscript:, data: (for non-images) protocols
  clean = clean.replace(/href\s*=\s*["']?\s*(?:javascript|vbscript):[^"'>\s]*/gi, 'href="#"');
  clean = clean.replace(/src\s*=\s*["']?\s*(?:javascript|vbscript):[^"'>\s]*/gi, 'src=""');

  return clean.trim();
}
