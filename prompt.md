# PROJECT SWITCHER — GERENCIADOR VISUAL DE PROJETOS E CONTEXTOS DE DESENVOLVIMENTO

## PAPEL

Atue como um **Staff Software Engineer + Desktop/Web Application Architect + DevOps Engineer + UX/UI Designer**, especialista em:

* ferramentas para desenvolvedores;
* Git/GitHub;
* GitHub CLI;
* Supabase CLI;
* Firebase CLI;
* gerenciamento de ambientes;
* gerenciamento de projetos;
* shell/Bash/PowerShell;
* Windows;
* aplicações web;
* aplicações desktop;
* segurança de credenciais;
* UX/UI para ferramentas técnicas;
* automação de CLI;
* configuração de ambientes;
* arquitetura modular;
* desenvolvimento multiplataforma.

Você deverá projetar e implementar uma ferramenta pessoal chamada provisoriamente:

# Project Switcher

O nome pode ser alterado posteriormente.

---

# 1. PROBLEMA QUE O PROJETO DEVE RESOLVER

Existe uma dor recorrente durante o desenvolvimento de vários projetos.

Cada projeto pode utilizar serviços diferentes, como:

* GitHub;
* Supabase;
* Firebase;
* outros serviços posteriormente.

O problema é que as CLIs e configurações locais podem ficar apontando para projetos diferentes.

Por exemplo:

```text
GitHub → Projeto A
Supabase CLI → Projeto B
Firebase CLI → Projeto A
```

Quando preciso trabalhar no Projeto B, preciso manualmente:

* trocar projeto;
* executar comandos Bash;
* verificar qual conta está autenticada;
* descobrir qual projeto está conectado;
* lembrar IDs;
* fazer login novamente quando necessário;
* alterar configurações;
* conferir se a CLI realmente está apontando para o projeto correto.

Isso é irritante, repetitivo e propenso a erros.

---

# 2. OBJETIVO

Criar uma ferramenta visual que permita:

> **selecionar um projeto e fazer com que o ambiente de desenvolvimento seja configurado automaticamente para aquele projeto.**

A ideia é transformar:

```text
Projeto selecionado
       ↓
GitHub
Supabase
Firebase
Outros serviços
       ↓
Contexto configurado
```

em uma operação simples.

O usuário deve conseguir abrir o aplicativo, visualizar os projetos cadastrados e selecionar:

> **"EvangeliGO"**

e a ferramenta deve preparar automaticamente o contexto correspondente.

---

# 3. PRINCÍPIO FUNDAMENTAL

A ferramenta não deve simplesmente "guardar comandos Bash".

Ela deve entender o conceito de:

# PROJETO

Um projeto possui um conjunto de integrações.

Exemplo:

```text
Projeto:
EvangeliGO

GitHub:
matteusbonotto/dev-evangeligo

Supabase:
Project ID: abc123

Firebase:
Project ID: evangeligo

Diretório local:
C:\Projetos\EvangeliGO

Branch:
main

Outras integrações:
...
```

Outro:

```text
Projeto:
BNTT

GitHub:
matteusbonotto/bonotroll

Supabase:
Project ID: xyz789

Firebase:
bnttapp

Diretório local:
C:\Projetos\BNTT
```

Ao trocar o projeto:

```text
BNTT
↓
EvangeliGO
```

a ferramenta deve saber quais configurações pertencem a cada um.

---

# 4. PLATAFORMA

## PREFERÊNCIA

A primeira opção deve ser:

> **Aplicação Web local**

Preferencialmente:

```text
http://localhost:PORTA
```

Entretanto, existe uma limitação importante:

Uma aplicação web executada normalmente no navegador possui acesso limitado ao sistema operacional e não pode simplesmente executar:

```text
bash
powershell
gh
supabase
firebase
git
```

diretamente.

Portanto, se a arquitetura web pura não permitir executar as operações necessárias, utilize uma arquitetura híbrida.

---

# 5. ARQUITETURA PREFERENCIAL

Avalie esta arquitetura:

```text
                    ┌─────────────────────┐
                    │      Web UI          │
                    │      Frontend        │
                    └──────────┬──────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │ Local Agent / API   │
                    │ localhost           │
                    └──────────┬──────────┘
                               │
              ┌────────────────┼────────────────┐
              ▼                ▼                ▼
             Git             Supabase         Firebase
              CLI              CLI              CLI
              │                │                │
              ▼                ▼                ▼
           GitHub           Supabase          Firebase
```

O frontend fornece a interface.

Um pequeno agente local executa as operações que exigem acesso ao sistema.

---

# 6. SE WEB + AGENTE LOCAL FOR COMPLEXO

Caso uma aplicação web com agente local gere complexidade desnecessária, implemente uma aplicação desktop.

Preferências:

1. Web + Local Agent;
2. Electron/Tauri ou equivalente;
3. Python + UI somente se necessário.

Se Python for utilizado, a interface deve ser profissional.

Não quero uma interface típica de:

```text
Tkinter
Label
Entry
Button
```

com aparência de ferramenta antiga.

---

# 7. REQUISITO DE UX/UI

A interface deve parecer uma ferramenta moderna de desenvolvimento.

Referências conceituais:

* VS Code;
* GitHub Desktop;
* Vercel Dashboard;
* Linear;
* Raycast;
* Docker Desktop;
* ferramentas modernas de DevOps.

Não copie interfaces.

Use os princípios:

* sidebar;
* cards;
* status;
* badges;
* ícones;
* feedback;
* hierarquia;
* espaços bem definidos;
* dark/light mode, se apropriado;
* responsividade;
* atalhos;
* busca;
* estados de loading;
* mensagens claras.

---

# 8. DASHBOARD

A tela principal deve mostrar algo semelhante a:

```text
┌─────────────────────────────────────────────────────────┐
│ Project Switcher                              ⚙        │
├──────────────┬──────────────────────────────────────────┤
│              │                                          │
│ Projetos     │  Projeto atual                           │
│              │                                          │
│ ● EvangeliGO │  EVANGELIGO                              │
│ ○ BNTT       │                                          │
│ ○ QA Xp      │  C:\Projetos\EvangeliGO                 │
│ ○ Outro      │                                          │
│              │  ┌────────┐ ┌────────┐ ┌────────┐       │
│ + Projeto    │  │ GitHub │ │Supabase│ │Firebase│       │
│              │  │   ✓    │ │   ✓    │ │   ✓    │       │
│              │  └────────┘ └────────┘ └────────┘       │
│              │                                          │
│              │  [Aplicar configuração]                  │
│              │                                          │
└──────────────┴──────────────────────────────────────────┘
```

---

# 9. SEMPRE MOSTRAR O CONTEXTO ATUAL

Um requisito fundamental:

> O usuário nunca deve precisar adivinhar qual projeto está conectado.

Mostrar claramente:

```text
PROJETO ATUAL

EvangeliGO

GitHub
✓ autenticado
matteusbonotto

Repository
matteusbonotto/dev-evangeligo

Supabase
✓ conectado

Project
evangeligo

Firebase
✓ conectado

Project
evangeligo
```

Se houver divergência:

```text
⚠ Contexto inconsistente

GitHub → EvangeliGO
Supabase → BNTT
Firebase → EvangeliGO
```

Isso deve ser extremamente evidente.

---

# 10. TROCA DE PROJETO

Ao selecionar outro projeto:

```text
BNTT
```

mostrar uma confirmação/preview:

```text
Trocar contexto?

ATUAL
EvangeliGO

GitHub
dev-evangeligo

Supabase
evangeligo

Firebase
evangeligo


NOVO
BNTT

GitHub
bonotroll

Supabase
bntt

Firebase
bnttapp


[Cancelar]
[Aplicar]
```

Depois:

```text
Aplicando...

✓ GitHub
✓ Supabase
✓ Firebase

Contexto alterado para BNTT.
```

---

# 11. CONTAS AUTENTICADAS

O sistema deve distinguir:

## Conta

Exemplo:

```text
GitHub
matheus@example.com
```

de:

## Projeto

```text
Repository
matteusbonotto/bonotroll
```

Uma mesma conta pode possuir vários projetos.

Não confunda:

```text
Conta GitHub
```

com:

```text
Repository GitHub
```

ou:

```text
Conta Supabase
```

com:

```text
Projeto Supabase
```

---

# 12. GITHUB

Investigue a forma correta de integração com GitHub.

Preferencialmente utilize:

```text
GitHub CLI (gh)
```

quando disponível.

A ferramenta deve conseguir detectar:

* GitHub CLI instalada;
* usuário autenticado;
* conta atual;
* repository atual;
* remote;
* branch;
* estado do repositório.

Exemplo visual:

```text
GitHub

✓ CLI instalada
✓ Autenticado

Usuário:
matteusbonotto

Repository:
matteusbonotto/dev-evangeligo

Branch:
main

Status:
Clean
```

---

# 13. SUPABASE

Investigue a CLI instalada na máquina.

Não presuma comandos.

Descubra a versão instalada e os comandos compatíveis.

A ferramenta deve conseguir identificar:

* Supabase CLI instalada;
* autenticação;
* projeto atualmente vinculado;
* project ref;
* diretório local;
* configuração local.

Exemplo:

```text
Supabase

✓ CLI instalada
✓ Autenticado

Projeto atual:
EvangeliGO

Project Ref:
xxxxxxxx

Status:
Linked
```

---

# 14. FIREBASE

Da mesma maneira:

Detectar:

* Firebase CLI;
* autenticação;
* conta;
* projeto atual;
* project ID;
* configuração local.

Exemplo:

```text
Firebase

✓ CLI instalada
✓ Autenticado

Conta:
matheus@example.com

Projeto:
bnttapp

Project ID:
bnttapp
```

---

# 15. OUTRAS INTEGRAÇÕES

A arquitetura deve permitir futuramente:

```text
GitHub
Supabase
Firebase
Vercel
Netlify
AWS
Google Cloud
Azure
Docker
npm
Git
SSH
```

Mas:

> Não implemente integrações apenas para dizer que são suportadas.

Crie uma arquitetura extensível.

---

# 16. MODELO DE DADOS

Crie um modelo semelhante a:

```json
{
  "name": "EvangeliGO",
  "directory": "C:\\Projetos\\EvangeliGO",
  "github": {
    "repository": "matteusbonotto/dev-evangeligo",
    "branch": "main"
  },
  "supabase": {
    "projectRef": "..."
  },
  "firebase": {
    "projectId": "evangeligo"
  }
}
```

Adapte ao projeto real.

Não armazene secrets nesse objeto.

---

# 17. SEGURANÇA — MUITO IMPORTANTE

A aplicação não deve armazenar desnecessariamente:

* senhas;
* tokens;
* access tokens;
* service account;
* private keys;
* secrets.

Sempre que possível, utilize as próprias sessões/autenticações das CLIs.

Exemplo:

```text
GitHub CLI
→ gh auth

Supabase CLI
→ autenticação própria

Firebase CLI
→ autenticação própria
```

A aplicação deve **consultar o estado**, e não substituir o mecanismo seguro de autenticação de cada ferramenta.

---

# 18. NÃO COPIAR TOKENS

Não faça:

```text
GitHub token
→ salvar em JSON
→ copiar para outro projeto
```

Não faça:

```text
Supabase token
→ salvar em configuração do aplicativo
```

Não faça:

```text
Firebase service account
→ colocar no frontend
```

A ferramenta deve funcionar como um **orquestrador de contexto**, não como um cofre improvisado de credenciais.

---

# 19. CONFIGURAÇÃO POR PROJETO

Cada projeto deve possuir configurações independentes.

Exemplo:

```text
EvangeliGO
├── GitHub
├── Supabase
├── Firebase
└── Local

BNTT
├── GitHub
├── Supabase
├── Firebase
└── Local
```

O usuário deve conseguir editar individualmente:

```text
GitHub
Supabase
Firebase
Diretório
Branch
```

sem precisar recriar o projeto inteiro.

---

# 20. EDIÇÃO INDIVIDUAL

Na interface:

```text
EvangeliGO

GitHub
[Editar]

Supabase
[Editar]

Firebase
[Editar]

Diretório
[Editar]
```

Ao editar:

```text
Supabase

Project Ref
[________________]

[Cancelar] [Salvar]
```

Não obrigue o usuário a preencher tudo novamente.

---

# 21. DETECÇÃO AUTOMÁTICA

Quando possível, permita:

> **Detectar configuração atual**

Exemplo:

```text
Diretório:
C:\Projetos\EvangeliGO

[Detectar]

✓ Git repository encontrado
✓ GitHub remote encontrado
✓ Supabase project detectado
✓ Firebase project detectado
```

Isso facilita cadastrar projetos existentes.

---

# 22. "ADOTAR PROJETO ATUAL"

Uma funcionalidade importante:

```text
Adicionar projeto
```

→

```text
Usar configuração do diretório atual
```

A ferramenta detecta:

* Git;
* GitHub remote;
* Supabase;
* Firebase.

E cria automaticamente o cadastro.

---

# 23. TERMINAL INTEGRADO

Considere incluir uma área:

```text
Terminal / Logs
```

Exemplo:

```text
> git remote -v

✓ Repository detectado

> supabase status

✓ Projeto detectado

> firebase use

✓ Projeto detectado
```

Mas o usuário não precisa digitar os comandos.

O terminal serve para:

* transparência;
* diagnóstico;
* debugging.

---

# 24. LOG DE OPERAÇÕES

Mostrar:

```text
14:32:11  GitHub       ✓ Repository configurado
14:32:12  Supabase     ✓ Projeto vinculado
14:32:13  Firebase     ✓ Projeto selecionado
14:32:13  Context      ✓ BNTT ativado
```

Se houver erro:

```text
14:32:13  Supabase     ✕ Não foi possível vincular
```

Com:

```text
[Ver detalhes]
```

---

# 25. DRY RUN

Antes de executar alterações, permitir:

```text
Preview / Dry Run
```

Exemplo:

```text
As seguintes alterações serão realizadas:

GitHub
✓ nenhuma alteração necessária

Supabase
→ alterar projeto:
evangeligo
↓
bntt

Firebase
→ alterar projeto:
evangeligo
↓
bnttapp

[Cancelar]
[Aplicar]
```

Isso evita alterações acidentais.

---

# 26. DETECÇÃO DE INCONSISTÊNCIA

O sistema deve comparar:

```text
Projeto selecionado
        VS
Estado real da máquina
```

Exemplo:

```text
Projeto selecionado:
BNTT

Estado real:

GitHub
✓ BNTT

Supabase
✕ EvangeliGO

Firebase
✓ BNTT
```

Mostrar:

# CONTEXTO INCONSISTENTE

E oferecer:

```text
[Corrigir automaticamente]
```

---

# 27. VERIFICAÇÃO APÓS A TROCA

Nunca considere uma operação concluída apenas porque o comando retornou exit code 0.

Após aplicar:

```text
alterar
↓
consultar novamente
↓
comparar
↓
confirmar
```

Exemplo:

```text
Aplicando Supabase...

✓ comando executado

Verificando...

✓ Project Ref atual corresponde ao BNTT

Supabase:
CONNECTED
```

---

# 28. FALHAS PARCIAIS

Considere:

```text
GitHub ✓
Supabase ✓
Firebase ✕
```

Não diga:

> "Projeto alterado com sucesso."

Diga:

> "Contexto parcialmente aplicado."

E mostre:

```text
GitHub       ✓
Supabase     ✓
Firebase     ✕
```

---

# 29. ROLLBACK

Avalie se determinadas operações podem ser revertidas.

Exemplo:

```text
Contexto anterior:
EvangeliGO

Novo:
BNTT
```

Se Firebase falhar, a ferramenta deve informar claramente o estado.

Não finja que houve rollback se não houve.

---

# 30. DIRETÓRIO DO PROJETO

Cada projeto pode possuir:

```text
C:\Projetos\EvangeliGO
C:\Projetos\BNTT
C:\Projetos\QA-Xperience
```

A ferramenta deve permitir:

```text
[Abrir pasta]
[Copiar caminho]
[Abrir terminal aqui]
[Abrir VS Code]
```

Quando possível.

---

# 31. TERMINAL POR PROJETO

Uma função extremamente útil:

```text
Abrir terminal no projeto
```

deve abrir o terminal já em:

```text
C:\Projetos\EvangeliGO
```

Isso pode ser integrado ao:

* PowerShell;
* Windows Terminal;
* CMD;
* Bash;
* terminal disponível.

Detecte o ambiente.

Não assuma Bash no Windows.

---

# 32. VS CODE

Se o VS Code estiver instalado, considerar:

```text
[Open in VS Code]
```

executando o comando apropriado.

Novamente:

> detectar antes de assumir.

---

# 33. CONTEXTO DO GIT

Além do GitHub, considere o Git local.

Mostrar:

```text
Git

Repository:
dev-evangeligo

Branch:
main

Status:
Clean

Remote:
origin → GitHub
```

Isso é importante porque:

> GitHub e Git local são coisas diferentes.

---

# 34. BUSCA DE PROJETOS

Se houver muitos projetos:

```text
🔎 Buscar projeto...
```

Pesquisar por:

* nome;
* repository;
* diretório;
* Supabase;
* Firebase.

---

# 35. FAVORITOS

Permitir marcar:

```text
★ EvangeliGO
★ BNTT
```

e ordenar favoritos primeiro.

---

# 36. PROJETO ATUAL

O projeto atualmente ativo deve ficar visualmente destacado.

Exemplo:

```text
● ATIVO

EvangeliGO
```

Não dependa apenas da cor.

Utilize:

* texto;
* ícone;
* badge;
* contraste.

Isso também ajuda acessibilidade.

---

# 37. RESPONSIVIDADE

A interface deve funcionar em:

* desktop;
* notebook;
* tablet;
* telas menores.

Como é uma ferramenta de desenvolvimento, desktop é prioridade.

Mas não crie uma UI que simplesmente quebra em telas menores.

---

# 38. TEMA

Considere:

```text
Dark
Light
System
```

Se isso não adicionar complexidade excessiva.

Ferramentas de desenvolvimento frequentemente funcionam melhor com uma interface escura, mas não é obrigatório.

---

# 39. ARQUITETURA DO SOFTWARE

Use uma arquitetura modular.

Conceitualmente:

```text
UI
 ↓
Application Layer
 ↓
Project Manager
 ↓
Integration Adapters
 ↓
CLI / OS
```

Cada integração deve possuir seu próprio adapter.

Exemplo:

```text
integrations/
├── github
├── supabase
└── firebase
```

Cada adapter deve saber:

* detectar instalação;
* detectar autenticação;
* consultar estado;
* aplicar configuração;
* verificar estado;
* reportar erros.

---

# 40. INTERFACE COMUM PARA INTEGRAÇÕES

Considere algo conceitualmente parecido com:

```text
IntegrationAdapter

getStatus()
getCurrentContext()
applyContext(project)
verifyContext(project)
```

Assim, futuramente:

```text
VercelAdapter
AWSAdapter
DockerAdapter
```

podem seguir o mesmo contrato.

---

# 41. NÃO FAÇA UMA ABSTRAÇÃO ARTIFICIAL

Não crie uma interface enorme com:

```text
100 métodos que cada integração precisa implementar
```

Comece pelo conjunto mínimo realmente necessário.

---

# 42. CONFIGURAÇÃO DA APLICAÇÃO

A ferramenta deve possuir uma configuração própria para:

* terminal preferido;
* editor;
* diretório padrão de projetos;
* tema;
* comportamento de confirmação;
* integrações habilitadas.

---

# 43. BACKUP DA CONFIGURAÇÃO

Considere permitir:

```text
Exportar configuração
Importar configuração
```

Mas:

> não exporte secrets.

O arquivo exportado deve conter apenas referências de projeto.

---

# 44. EXEMPLO DE EXPORTAÇÃO

```json
{
  "projects": [
    {
      "name": "EvangeliGO",
      "directory": "C:\\Projetos\\EvangeliGO",
      "github": {
        "repository": "matteusbonotto/dev-evangeligo"
      },
      "supabase": {
        "projectRef": "..."
      },
      "firebase": {
        "projectId": "evangeligo"
      }
    }
  ]
}
```

---

# 45. PRIVACIDADE

A ferramenta deve funcionar preferencialmente:

> **local-first.**

Não envie:

* tokens;
* credenciais;
* caminhos;
* informações dos projetos

para um servidor externo sem necessidade.

Idealmente:

```text
Máquina do usuário
      ↓
Project Switcher
      ↓
CLIs locais
```

---

# 46. TECNOLOGIA

Antes de escolher a stack final, avalie:

### Opção A

Web UI + Local Agent

### Opção B

Tauri + Web UI

### Opção C

Electron + Web UI

### Opção D

Python + UI moderna

Escolha com base em:

* facilidade de desenvolvimento;
* integração com sistema operacional;
* execução de CLI;
* segurança;
* distribuição;
* manutenção;
* performance;
* simplicidade.

Não escolha tecnologia apenas por preferência pessoal.

---

# 47. WINDOWS

O ambiente principal provavelmente será Windows.

Portanto, trate como requisito real:

* PowerShell;
* Windows Terminal;
* caminhos Windows;
* `.exe`;
* PATH;
* processos;
* permissões;
* variáveis de ambiente.

Não presuma que Bash está disponível.

Se Git Bash estiver instalado, detecte.

---

# 48. DETECÇÃO DE CLI

Na inicialização:

```text
Git
✓ instalado

GitHub CLI
✓ instalado

Supabase CLI
✓ instalado

Firebase CLI
✓ instalado
```

Se faltar:

```text
Firebase CLI
✕ não encontrado

[Como instalar]
```

Não instale automaticamente sem autorização explícita.

---

# 49. DETECÇÃO DE VERSÕES

Mostrar:

```text
GitHub CLI
vX.X.X

Supabase CLI
vX.X.X

Firebase CLI
vX.X.X
```

Isso ajuda diagnóstico.

---

# 50. TRATAMENTO DE ERROS

Nunca mostre apenas:

```text
Error: command failed
```

Mostre:

```text
Não foi possível identificar o projeto Supabase.

Possível motivo:
A CLI não está autenticada ou o diretório não possui um projeto vinculado.

[Ver detalhes]
[Executar diagnóstico]
```

---

# 51. DIAGNÓSTICO

Criar uma tela:

# Health Check

```text
Git              ✓
GitHub CLI       ✓
GitHub Auth      ✓
Supabase CLI     ✓
Supabase Auth    ✓
Firebase CLI     ✓
Firebase Auth    ✓
PowerShell       ✓
Git Bash         ✓
VS Code          ✓
```

E:

```text
[Executar diagnóstico novamente]
```

---

# 52. LOGS TÉCNICOS

Permitir visualizar:

* comando executado;
* stdout;
* stderr;
* exit code;
* duração.

Mas cuidado:

> Nunca exiba tokens ou secrets nos logs.

Faça sanitização.

---

# 53. AUDITORIA DAS OPERAÇÕES

Mantenha localmente um histórico simples:

```text
28/09 10:32
EvangeliGO → BNTT

GitHub ✓
Supabase ✓
Firebase ✓
```

Isso ajuda a descobrir o que aconteceu.

---

# 54. NÃO EXECUTE COMANDOS ARBITRÁRIOS

Não construa comandos concatenando strings fornecidas pelo usuário de forma insegura.

Use argumentos separados quando a plataforma permitir.

Faça escaping apropriado.

O usuário está entregando ao aplicativo caminhos, nomes e IDs.

Trate tudo isso como input potencialmente perigoso.

---

# 55. CONFIRMAÇÃO PARA OPERAÇÕES DE RISCO

Operações que podem alterar configuração devem possuir confirmação, especialmente inicialmente.

Exemplo:

```text
Você está prestes a alterar o contexto do Supabase.

Atual:
EvangeliGO

Novo:
BNTT

Isso pode alterar o projeto utilizado pelos comandos da CLI.

[Cancelar]
[Confirmar]
```

Depois o usuário poderá habilitar:

```text
☑ Não perguntar novamente para alterações seguras
```

se fizer sentido.

---

# 56. RESULTADO ESPERADO

O fluxo ideal deve ser:

```text
Abrir Project Switcher
        ↓
Ver projetos
        ↓
Selecionar BNTT
        ↓
Ver preview
        ↓
Aplicar
        ↓
GitHub ✓
Supabase ✓
Firebase ✓
        ↓
Verificar
        ↓
BNTT está ativo
```

Sem precisar:

```text
abrir PowerShell
↓
lembrar comandos
↓
trocar Supabase
↓
trocar Firebase
↓
verificar Git
↓
descobrir conta
↓
repetir tudo
```

---

# 57. DEFINIÇÃO DE PRONTO

Considere a primeira versão funcional quando for possível:

* [ ] cadastrar projeto;
* [ ] editar projeto;
* [ ] remover projeto;
* [ ] selecionar projeto;
* [ ] visualizar projeto atual;
* [ ] visualizar GitHub atual;
* [ ] visualizar Supabase atual;
* [ ] visualizar Firebase atual;
* [ ] detectar configurações;
* [ ] aplicar contexto;
* [ ] verificar contexto;
* [ ] detectar inconsistências;
* [ ] abrir terminal no diretório;
* [ ] visualizar logs;
* [ ] executar diagnóstico;
* [ ] preservar credenciais fora da aplicação;
* [ ] tratar erros;
* [ ] funcionar no Windows.

---

# 58. FASES DE IMPLEMENTAÇÃO

## FASE 1 — Descoberta

Estude:

* SO;
* CLIs;
* versões;
* autenticação;
* comandos disponíveis;
* estrutura dos projetos.

Não codifique ainda.

## FASE 2 — Arquitetura

Defina:

* modelo de projeto;
* adapters;
* armazenamento;
* comunicação UI ↔ agente;
* segurança.

## FASE 3 — MVP

Implemente:

* projetos;
* GitHub;
* Supabase;
* Firebase;
* seleção;
* status;
* aplicação;
* verificação.

## FASE 4 — UX

Implemente:

* dashboard;
* busca;
* cards;
* logs;
* health check;
* preview;
* feedback.

## FASE 5 — Robustez

Implementar:

* erros;
* inconsistências;
* rollback quando possível;
* sanitização;
* validação;
* testes.

## FASE 6 — Recursos adicionais

Depois:

* favoritos;
* export/import;
* VS Code;
* terminal;
* histórico;
* outras integrações.

---

# 59. TESTES

Crie testes para:

### Project Manager

* criar;
* editar;
* excluir;
* selecionar;
* persistir.

### GitHub Adapter

* CLI ausente;
* CLI instalada;
* autenticado;
* não autenticado;
* repository correto;
* repository incorreto.

### Supabase Adapter

* CLI ausente;
* autenticado;
* projeto correto;
* projeto incorreto;
* erro.

### Firebase Adapter

* CLI ausente;
* autenticado;
* projeto correto;
* projeto incorreto;
* erro.

### Context Switcher

* sucesso;
* falha parcial;
* falha total;
* estado inconsistente.

---

# 60. TESTE DE SEGURANÇA

Verifique:

* command injection;
* path traversal;
* secrets em logs;
* secrets em arquivos;
* permissões;
* execução de comandos;
* inputs maliciosos;
* arquivos de configuração.

---

# 61. DOCUMENTAÇÃO

Crie documentação curta para:

```text
README
ARCHITECTURE
SECURITY
DEVELOPMENT
```

Explique:

* como executar;
* como adicionar integração;
* como adicionar projeto;
* como funciona o contexto;
* como testar;
* limitações.

---

# 62. REGRA FINAL

Não quero simplesmente um "painel bonito".

Quero uma ferramenta que realmente elimine esta dor:

> **"Qual projeto está conectado agora?"**

e:

> **"Preciso ficar trocando isso manualmente pelo Bash toda vez que mudo de projeto."**

A ferramenta deve transformar essa tarefa em:

> **selecionar projeto → aplicar contexto → verificar → trabalhar.**

A interface deve ser bonita, mas a arquitetura deve ser ainda mais importante.

Priorize:

```text
Confiabilidade
↓
Segurança
↓
Correção
↓
Clareza
↓
Facilidade de uso
↓
Performance
↓
Estética
```

Nunca esconda um estado inconsistente.

Nunca diga que uma troca foi concluída sem verificar.

Nunca armazene secrets desnecessariamente.

Nunca execute comandos arbitrários sem sanitização.

Nunca presuma que uma CLI está instalada.

Nunca presuma que o usuário está autenticado.

E nunca faça o usuário adivinhar:

> **qual projeto está ativo agora.**

## RESULTADO FINAL ESPERADO

Uma ferramenta local profissional na qual eu consiga abrir o aplicativo, olhar para a tela e imediatamente saber:

```text
┌────────────────────────────────────────────┐
│ PROJECT SWITCHER                           │
│                                            │
│ PROJETO ATIVO                              │
│                                            │
│ 🟢 EvangeliGO                              │
│                                            │
│ GitHub      ✓ dev-evangeligo               │
│ Supabase    ✓ evangeligo                   │
│ Firebase    ✓ evangeligo                   │
│                                            │
│ Diretório                                   │
│ C:\Projetos\EvangeliGO                    │
│                                            │
│ [ TROCAR PROJETO ]                         │
│ [ ABRIR VS CODE ] [ TERMINAL ]             │
└────────────────────────────────────────────┘
```

E, ao escolher outro projeto:

```text
BNTT
↓
Aplicar
↓
GitHub ✓
Supabase ✓
Firebase ✓
↓
VERIFICADO
↓
"Você está trabalhando no BNTT."
```

Esse é o comportamento central que o projeto deve entregar.
