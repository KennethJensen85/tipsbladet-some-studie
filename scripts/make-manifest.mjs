// Laver public/logos/logos.json ud fra de filer, der ligger i public/logos.
import { readdir, writeFile } from 'node:fs/promises';

const dir = new URL('../public/logos/', import.meta.url);
const files = (await readdir(dir))
  .filter(f => /\.(png|svg|webp|jpe?g)$/i.test(f))
  .sort((a, b) => a.localeCompare(b, 'da'));
const pretty = f => f.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim();

await writeFile(new URL('logos.json', dir), JSON.stringify(files.map(file => ({ name: pretty(file), file })), null, 2) + '\n');
console.log(`logos.json opdateret: ${files.length} logoer`);
