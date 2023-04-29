const colors = {
  reset: '0m',
  error: '31m',
  warn: '33m',
  ok: '32m',
  info: '34m',
};

export function log(type: 'error' | 'warn' | 'ok' | 'info', title: string, ...message: unknown[]) {
  // eslint-disable-next-line no-console
  console[type === 'ok' ? 'info' : type](`\x1b[${colors[type]}${title}:\x1b[${colors.reset}`, ...message);
}
