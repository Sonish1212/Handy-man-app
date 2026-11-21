// Starts the professional app (same code, APP_VARIANT=pro) on its own port,
// so it can run next to the customer app. Extra words are passed to Expo:
//   npm run pro                 phone, through the tunnel
//   npm run pro:web             browser, connected to Supabase
//   npm run pro:demo            browser, sample data, nothing saved
const { spawn } = require('node:child_process');

const ALLOWED = new Set(['--tunnel', '--web', '--clear', '--localhost', '--android', '--demo']);
const args = process.argv.slice(2);
const unknown = args.filter((arg) => !ALLOWED.has(arg));
if (unknown.length) {
  console.error(`Unknown option: ${unknown.join(' ')}. Allowed: ${[...ALLOWED].join(' ')}`);
  process.exit(1);
}

const demo = args.includes('--demo');
const expoArgs = args.filter((arg) => arg !== '--demo').join(' ');
const env = { ...process.env, APP_VARIANT: 'pro' };
if (demo) {
  env.EXPO_PUBLIC_SUPABASE_URL = '';
  env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY = '';
}

const child = spawn(`npx expo start --port ${demo ? 8091 : 8082} ${expoArgs}`, { stdio: 'inherit', shell: true, env });
child.on('exit', (code) => process.exit(code ?? 0));
