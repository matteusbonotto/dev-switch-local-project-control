# Segurança

**Credenciais**: a ferramenta não armazena nem lê tokens. A autenticação é sempre a das próprias CLIs (`gh auth`, `supabase login`, `firebase login`); o app apenas consulta o estado. Import/export e o `config.json` aceitam somente chaves conhecidas, então qualquer campo extra (ex.: `token`) é descartado.

**Atenção**: `firebase login:list --json` imprime access e refresh tokens. A ferramenta usa apenas a saída em texto. Mesmo assim, toda saída de comando passa por `sanitize()` (tokens gh/sbp/ya29/JWT/refresh, `Bearer`, `password=`, credenciais em URL) antes de ir para log ou UI.

**Execução de comandos**
- `.exe` roda via `spawn` com argumentos separados, sem shell.
- `.cmd`/`.bat` (shims do npm/Volta) exigem `cmd.exe`: cada argumento é recusado se contiver `" % ! ^ & | < > \` ou quebra de linha.
- IDs, branches, repositórios e caminhos são validados por regex antes de chegar a qualquer comando (`lib/validation.js`).
- Não existe endpoint para rodar comando arbitrário. O botão *Corrigir* envia apenas o id da correção. O servidor recalcula o estado, só aceita correções que esse estado oferece e monta o comando a partir do catálogo fixo em `lib/fixes.js`.
- Instalações só acontecem quando o usuário clica em *Corrigir* e confirma o comando exibido.

**Servidor local**
- Escuta apenas em `127.0.0.1`.
- Token aleatório por execução, exigido no header `x-ps-token` (sites externos não conseguem lê-lo).
- `Host` e `Origin` são validados (bloqueia DNS rebinding e CSRF).
- CSP `script-src 'self'`.
- Arquivos estáticos vêm de uma lista fixa (sem path traversal).
- A UI nunca usa `innerHTML` com dados.

**Limites**: qualquer processo local rodando como o seu usuário pode ler a página e obter o token. Isso já equivale ao acesso que esse processo teria às CLIs.
