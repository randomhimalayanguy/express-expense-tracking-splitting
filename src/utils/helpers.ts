export function generateCode(length: number): string {
  const SEQUENCE = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789abcdefghijklmnopqrstuvwxyz';
  let code = '';
  for (let i = 0; i < length; i++) {
    code += SEQUENCE[Math.floor(Math.random() * SEQUENCE.length)];
  }
  return code;
}
