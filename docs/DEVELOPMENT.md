# Desenvolvimento

```powershell
npm run dev   # reinicia o servidor ao salvar (UI é lida do disco a cada request)
npm test      # node:test, sem dependências
```

Use `PROJECT_SWITCHER_HOME=<pasta temporária>` para não mexer nos seus dados reais.

**Testes** (`test/core.test.js`): validação e entradas maliciosas, sanitização, runner (exit code, timeout, quoting do cmd), ProjectManager (CRUD, persistência, import sem segredos), cada adapter com um `fakeEnv` (CLI ausente, autenticado/não, correto/incorreto, erro), orquestrador (sucesso, parcial com exit 0 mas estado divergente, falha total, inconsistência) e segurança HTTP (token, Host, Origin, traversal, CSP).

**Adapters** recebem um `env` injetável (`exec`, `tool`, `readText`, `isDir`, `isFile`, `cached`), então novos adapters podem ser testados sem CLIs reais.
