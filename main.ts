import * as files from 'node:fs';
import * as paths from 'node:path';
import { buildDossier } from './vendor/makefun-frontend.ts';

const sourceDirectory = new URL('.', import.meta.url);
const destination = paths.resolve(process.env.MAKEFUN_OUTPUT_DIR || '/output');
files.mkdirSync(destination, { recursive: true });
for (const directory of ['app', 'screenshots']) {
  const target = paths.join(destination, directory);
  files.rmSync(target, { recursive: true, force: true });
  files.cpSync(new URL(directory, sourceDirectory), target, { recursive: true });
}
const dossier = buildDossier(destination, {
  text_max_bytes: 160 * 1024,
  app_max_files: 993,
  app_max_bytes: 16 * 1024 * 1024,
  screenshots: { max: 3, max_bytes: 256 * 1024 }
});
files.writeFileSync(paths.join(destination, 'dossier.json'), dossier);
console.log('Frontend and dossier written to ' + destination);

// recorded rewrite
