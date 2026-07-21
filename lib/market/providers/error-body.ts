const MAX_ERROR_BODY_LENGTH = 256;

export function sanitizeErrorBody(value: string) {
  const clean = value
    .replace(/[\u0000-\u001f\u007f-\u009f]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!clean) return "empty response body";
  return clean.length <= MAX_ERROR_BODY_LENGTH
    ? clean
    : `${clean.slice(0, MAX_ERROR_BODY_LENGTH - 1)}…`;
}
