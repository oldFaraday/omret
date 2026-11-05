// Gera js/palavras.js a partir de biblioteca.json.
// Uso: node ferramentas/gerar-palavras.mjs
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const origem = path.join(raiz, 'biblioteca.json');

const bruto = JSON.parse(await readFile(origem, 'utf8'));
if (!Array.isArray(bruto)) {
  throw new Error('biblioteca.json precisa conter um array.');
}

const vistos = new Set();
const palavras = [];

for (const item of bruto) {
  const com = String(item?.com_especiais ?? '').trim();
  const sem = String(item?.sem_especiais ?? '').trim().toLowerCase();
  const significado = String(item?.significado ?? '').trim();

  if (!/^[a-z]{5}$/.test(sem)) {
    throw new Error(`Palavra inválida em biblioteca.json: ${JSON.stringify(item)}`);
  }
  if (vistos.has(sem)) continue; // garante uma única entrada por palavra normalizada

  vistos.add(sem);
  palavras.push([com, sem, significado]);
}

palavras.sort((a, b) => a[1].localeCompare(b[1], 'pt-BR'));

const linhas = palavras.map((par) => `  ${JSON.stringify(par)}`).join(',\n');
const conteudo = `// Arquivo gerado por ferramentas/gerar-palavras.mjs — não edite à mão.
// Fonte: biblioteca.json (${palavras.length} palavras de cinco letras).
window.OMRET_PALAVRAS = [
${linhas}
];
`;

await mkdir(path.join(raiz, 'js'), { recursive: true });
await writeFile(path.join(raiz, 'js', 'palavras.js'), conteudo, 'utf8');
console.log(`js/palavras.js gerado com ${palavras.length} palavras.`);
