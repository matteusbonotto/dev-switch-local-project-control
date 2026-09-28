# Project Switcher

Ferramenta local para responder, sem adivinhação, **"qual projeto está conectado agora?"** — e trocar o contexto (Git, GitHub, Supabase, Firebase) com um clique, com verificação real depois da troca.

## Executar

Requisitos: Node.js 20+ (sem dependências npm).

```powershell
npm start          # ou dê dois cliques em "Project Switcher.bat"
```

Abre `http://127.0.0.1:4477`. Opções: `--port <n>` ou `PROJECT_SWITCHER_PORT`. Dados ficam em `%APPDATA%\ProjectSwitcher` (ou `PROJECT_SWITCHER_HOME`).

## Uso

1. **Cadastrar**: *Novo projeto* → escolha a pasta → *Detectar* (preenche GitHub, Supabase, Firebase). Ou *Importar de uma pasta* para varrer, por exemplo, `Documents\github` e cadastrar vários de uma vez.
2. **Trocar**: selecione o projeto → *Trocar para este projeto* → confira o preview (dry run) → *Aplicar e verificar*.
3. **Conferir**: a barra superior mostra sempre o projeto **ATIVO** e se ele está *Verificado* ou *Inconsistente*. Divergências aparecem em vermelho com *Corrigir automaticamente*.

**Corrigir**: todo aviso ou erro com solução conhecida tem um botão *Corrigir*. Ele mostra o comando antes, executa e verifica de novo. Instalações usam winget, npm ou o binário oficial da Supabase. Login e `supabase link` são interativos e abrem um terminal com o comando pronto.

Cada integração é editada individualmente (botão *Editar* no card). Também há: abrir pasta / terminal / VS Code, Health check, histórico, logs técnicos, export/import e tema claro/escuro.

## Como o contexto funciona

| Integração | O que é verificado | O que a troca faz | Escopo |
|---|---|---|---|
| Git local | branch, alterações, upstream | `git switch <branch>` (só se definida e árvore limpa) | diretório |
| GitHub | remote `origin` × repositório; conta ativa do `gh` | `gh auth switch --user <conta>` (se definida) | **global** |
| Supabase | `supabase/.temp/project-ref` × project ref | `supabase link --project-ref <ref>` | diretório |
| Firebase | `firebase use` × project ID | `firebase use <id>` | diretório |

Supabase e Firebase guardam o projeto **por diretório**, então "trocar" significa garantir que a pasta do projeto aponta para o recurso certo. Remote divergente nunca é alterado automaticamente: a ferramenta mostra o comando.

## Limitações conhecidas

- `gh` e `supabase` não estavam instalados na máquina de desenvolvimento: esses caminhos foram testados com respostas simuladas (testes unitários), não contra a CLI real.
- `supabase link` pode pedir a senha do banco em algumas versões. Se falhar, a mensagem orienta a rodar o comando pelo botão *Terminal*.
- A conta do Firebase exibida é a padrão da CLI; a troca de conta por diretório (`firebase login:use`) não é feita.
- Não há rollback automático. Em falha parcial, a tela informa exatamente o que mudou e oferece *Voltar para o projeto anterior*.

Mais: [ARCHITECTURE](docs/ARCHITECTURE.md) · [SECURITY](docs/SECURITY.md) · [DEVELOPMENT](docs/DEVELOPMENT.md)
