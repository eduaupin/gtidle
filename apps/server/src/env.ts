// Carrega o arquivo .env (na raiz do projeto ou em apps/server) antes de qualquer outro módulo.
// Precisa ser o PRIMEIRO import de index.ts.
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

for (const file of [resolve(process.cwd(), '.env'), resolve(process.cwd(), '../../.env')]) {
  if (existsSync(file)) {
    process.loadEnvFile(file);
    break;
  }
}
