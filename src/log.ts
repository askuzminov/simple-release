const colors = {
  reset: '0m',
  error: '31m',
  warn: '33m',
  info: '32m',
};

export function log(type: 'error' | 'warn' | 'info', title: string, message: unknown) {
  // tslint:disable-next-line: no-console
  console[type](`\x1b[${colors[type]}${title}:\x1b[${colors.reset}`, message);
}
