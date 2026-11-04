// Servidor estático mínimo, sem dependências.
// Uso: node servidor.mjs (ou npm start) e abra http://localhost:4173
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = fileURLToPath(new URL('.', import.meta.url));
const porta = Number(process.env.PORT) || 4173;

const tipos = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

const servidor = createServer(async (requisicao, resposta) => {
  try {
    const url = new URL(requisicao.url || '/', 'http://localhost');
    let caminho = decodeURIComponent(url.pathname);
    if (caminho.endsWith('/')) caminho += 'index.html';

    const destino = normalize(join(raiz, caminho));
    if (!destino.startsWith(raiz.endsWith(sep) ? raiz : raiz + sep)) {
      resposta.writeHead(403).end('Acesso negado');
      return;
    }

    const conteudo = await readFile(destino);
    resposta.writeHead(200, {
      'Content-Type': tipos[extname(destino).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-cache',
    });
    resposta.end(conteudo);
  } catch {
    resposta.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Não encontrado');
  }
});

servidor.listen(porta, () => {
  console.log(`omret em http://localhost:${porta}`);
});
