// Remove segredos de qualquer texto antes de ser logado ou enviado à UI.
const PATTERNS = [
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g, '<private key>'],
  [/\bgh[pousr]_[A-Za-z0-9]{20,}/g, 'gh*_***'],
  [/\bgithub_pat_[A-Za-z0-9_]{20,}/g, 'github_pat_***'],
  [/\bsbp_[A-Za-z0-9]{20,}/g, 'sbp_***'],
  [/\bya29\.[A-Za-z0-9._-]+/g, 'ya29.***'],
  [/\b1\/\/[A-Za-z0-9._-]{20,}/g, '1//***'],
  [/\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g, '<jwt>'],
  [/(Bearer\s+)[A-Za-z0-9._~+/=-]{8,}/gi, '$1***'],
  [/("(?:access_token|refresh_token|id_token|token|secret|password|private_key|client_secret)"\s*:\s*")[^"]*(")/gi, '$1***$2'],
  [/\b((?:access[_-]?token|refresh[_-]?token|token|secret|password|passwd|api[_-]?key)\s*[=:]\s*)(?!\*)[^\s"',;]+/gi, '$1***'],
  [/(https?:\/\/)[^\/\s@]+@/gi, '$1***@'],
];

const ANSI = /\x1b\[[0-9;?]*[ -\/]*[@-~]/g;

export function stripAnsi(text) {
  return String(text ?? '').replace(ANSI, '');
}

export function sanitize(text) {
  let out = stripAnsi(text);
  for (const [re, rep] of PATTERNS) out = out.replace(re, rep);
  return out;
}

export function truncate(text, max = 20000) {
  return text.length > max ? `${text.slice(0, max)}\n… (${text.length - max} caracteres omitidos)` : text;
}
