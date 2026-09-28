# Arquitetura

**Escolha: Web UI + agente local em Node.js** (opção A). Node já está na máquina, executa CLIs com `child_process` sem shell, dispensa build e dependências. Tauri e Electron adicionariam toolchain (Rust) ou ~150 MB sem ganho real para uma ferramenta pessoal.

```
public/ (UI, JS puro)  ──HTTP 127.0.0.1 + token──▶  src/app.js (rotas)
                                                        │
                        ProjectManager (store.js)  ContextService (context.js)
                                                        │
                                  integrations/ git · github · supabase · firebase
                                                        │
                                   runner.js (spawn sem shell, timeout, sanitização)
```

## Fluxo de troca

`status` (estado real) → `plan` (dry run: changes / unchanged / blocked) → confirmação → `apply` (uma integração por vez) → **`status` de novo, sem cache** → resultado `success | partial | failed`. O projeto só vira ativo se pelo menos uma integração for verificada; em `failed`, o anterior continua ativo.

## Contrato de uma integração

```js
{
  id, label, icon, section,            // section = chave no objeto do projeto
  fields: [{ key, label, validator }], // gera o formulário e a validação
  isConfigured(project), configId(project),
  getState(project, env) → { match: true|false|null, fixable, summary, observedId, fields, issues },
  plan(project, state) → [{ from, to, scope: 'local'|'global', description, command }],
  apply(project, change, env) → { ok, message, logId },
  detect(dir, env) → { values, checks },
  health?(env) → [checks],
}
```

`match: null` significa "não foi possível verificar" e **nunca** é tratado como sucesso. Para adicionar (ex.: Vercel): crie `src/integrations/vercel.js`, registre em `integrations/index.js` e declare o executável em `lib/tools.js`. UI, validação e export passam a incluir a integração automaticamente.

## Armazenamento

`%APPDATA%\ProjectSwitcher\`: `config.json` (projetos + configurações, gravação atômica com `.bak`), `history.jsonl` (auditoria das trocas), `commands.jsonl` (log técnico sanitizado, rotação em 2 MB).
