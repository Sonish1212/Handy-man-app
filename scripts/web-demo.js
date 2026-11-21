// Starts the web preview in demo mode: Supabase switched off, sample data
// everywhere (including the Team and My jobs screens). Usage:
//   npm run web:demo            (port 8090)
//   npm run web:demo -- 8095
const { spawn } = require('node:child_process');

const port = Number(process.argv[2] ?? 8090);
if (!Number.isInteger(port) || port < 1024 || port > 65535) {
  console.error('Port must be a number between 1024 and 65535.');
  process.exit(1);
}

const child = spawn(`npx expo start --web --port ${port}`, {
  stdio: 'inherit',
  shell: true,
  env: { ...process.env, EXPO_PUBLIC_SUPABASE_URL: '', EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: '' },
});
child.on('exit', (code) => process.exit(code ?? 0));
