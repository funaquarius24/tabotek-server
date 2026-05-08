let buffer = '';

export function log(...args: any[]) {
  const line = args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ');
  const timestamp = new Date().toISOString().slice(11, 23);
  buffer += `[${timestamp}] ${line}\n`;
  console.log(...args);
}

export function getLog(): string {
  return buffer;
}

export function clearLog() {
  buffer = '';
}
