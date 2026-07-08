# AutoRPA 🤖 - Orquestrador de Automação Web e RPA

O **AutoRPA** é uma aplicação web completa para orquestração, agendamento e execução de rotinas de automação de navegação web (RPA / Web Scraping). A plataforma foca na modularidade e no reaproveitamento de rotinas, permitindo que blocos de ação lógica sejam encadeados em sequências funcionais (pipelines) configuráveis via interface gráfica.

---

## ✨ Recursos Core

- **Blocos de Ação (Módulos)**: Criação visual de etapas de navegação reaproveitáveis.
- **Composição de Pipelines (Tarefas)**: Linha de fluxo interativa onde blocos de ação são sequenciados (`Bloco Login` -> `Extrair Dados` -> `Tirar Print`).
- **Agendador Cron integrado**: Execução periódica autônoma em background gerenciada por regras cron (ex: a cada 2 horas, toda segunda às 08h).
- **Variáveis Privadas Criptografadas (Secrets)**: Armazenamento seguro de senhas e tokens com criptografia **AES-256-CBC** no banco e decodificação sob demanda, mantendo os logs de execução mascarados.
- **Relatório de Execução Detalhado**: Histórico de runs com status (sucesso/falha), passo em que ocorreu o erro, código-fonte HTML extraído e screenshot do navegador.
- **Pronto para Docker**: Totalmente conteinerizado usando a imagem oficial do Playwright com todos os drivers e navegadores pré-instalados.

---

## 🛠️ Tecnologias Utilizadas

- **Frontend**: React (Vite), Vanilla CSS (Design Tokens, Glassmorphism, Responsive Grid), Lucide React.
- **Backend**: Node.js, Express.js.
- **Automação**: Playwright (Headless Browser Automation).
- **Agendador**: `node-cron`, `cron-parser`.
- **Banco de Dados**: Armazenamento em arquivos JSON com gravação atômica tolerante a quedas bruscas.
- **Segurança**: Criptografia simétrica baseada no módulo `crypto` do Node.

---

## 📁 Estrutura de Diretórios do Projeto

```
/web_automacao
  ├── backend/
  │    ├── data/                # Banco db.json, chave mestra e pasta de screenshots
  │    ├── src/
  │    │    ├── db/             # Gerenciador do banco de dados atômico
  │    │    ├── runner/         # Motor de execução Playwright RPA
  │    │    ├── scheduler/      # Orquestrador node-cron
  │    │    ├── utils/          # Módulo de criptografia AES-256-CBC
  │    │    ├── seed.js         # Script de carga inicial de teste da Wikipedia
  │    │    └── server.js       # Servidor Express API e servidor de arquivos estáticos
  │    └── package.json
  │
  ├── frontend/
  │    ├── src/
  │    │    ├── styles/         # CSS Tokens e Componentes
  │    │    ├── App.jsx         # Interface Dashboard e Modais
  │    │    └── main.jsx
  │    ├── index.html
  │    ├── vite.config.js       # Proxy CORS para desenvolvimento local
  │    └── package.json
  │
  ├── package.json              # Orquestrador de desenvolvimento raiz
  ├── Dockerfile                # Build unificado de produção
  └── docker-compose.yml        # Implantação e volumes estáveis
```

---

## 📋 Repercussão de Ações (O que um bloco pode fazer)

A interface permite encadear os seguintes comandos:
- `Navegar(url)`: Acessa uma página web específica.
- `Clicar(seletor, tipo_seletor)`: Clica em botões ou elementos via ID, Classe, XPath ou texto literal.
- `Digitar(texto, seletor)`: Digita em inputs buscando por ID/CSS, label correspondente ou placeholder.
- `Esperar(condicao)`: Aguarda o carregamento total ou aguarda que um elemento fique visível.
- `ApertarTecla(tecla)`: Simula eventos do teclado (Enter, Tab, Escape, etc.).
- `ExtrairHTML()`: Captura e grava o código-fonte atual da página.
- `ListarElementos(query_selector)`: Retorna uma lista de atributos e textos dos nós DOM correspondentes.
- `TirarScreenshot()`: Captura o estado visual atual da tela (salvo no log e acessível via modal).
- `CondicionalSe(seletor_existe)`: Executa a etapa subsequente somente se o elemento fornecido existir no DOM.

---

## ⚙️ Variáveis Criptografadas (Secrets)

Para cadastrar dados sensíveis:
1. Acesse **Blocos de Ação** -> **Criar Bloco** ou **Editar**.
2. Na seção **Variáveis Privadas / Senhas (Secrets)**, defina a chave (ex: `senha_banco`) e o valor.
3. Para utilizar este valor em ações de digitação, use a sintaxe: `{{secret:senha_banco}}`.
4. O backend armazenará a chave no banco como um hash encriptado. Durante a automação, ela será resolvida em memória apenas no instante do preenchimento e logada no histórico como `●●●●●●`.

---

## 🚀 Como Rodar a Aplicação

### Opção 1: Via Docker Compose (Recomendado para Produção)

Certifique-se de ter o Docker e Docker Compose instalados.

1. No diretório raiz do projeto, execute o build e inicialize o contêiner:
   ```bash
   docker-compose up --build -d
   ```
2. Acesse a aplicação no seu navegador: `http://localhost:3000`.
3. Os dados do banco de dados e screenshots serão salvos no volume persistente `rpa_data`.

### Opção 2: Desenvolvimento Local (Node.js)

Requisitos: Node.js 18 ou superior.

1. Instale as dependências na raiz (instala as dependências da raiz, backend e frontend):
   ```bash
   npm install && npm run install-all
   ```
2. Instale o navegador Chromium do Playwright:
   ```bash
   npx --prefix backend playwright install chromium
   ```
3. (Opcional) Popule o banco com um pipeline de teste automatizado de busca na Wikipedia:
   ```bash
   node backend/src/seed.js
   ```
4. Rode a aplicação em modo de desenvolvimento (inicia o backend na porta 3000 e o Vite na porta 5173 com proxy automático):
   ```bash
   npm run dev
   ```
5. Acesse a interface web em: `http://localhost:5173`.

---

## 🤖 Integração com Agentes de IA (Browser Handoff)

O **AutoRPA** possui um barramento de controle que permite que agentes de IA e scripts externos assumam o controle do navegador em tempo de execução.

### Fluxo de Funcionamento:
1. Adicione uma etapa do tipo **"Controle do Agente"** (`agent_control`) em qualquer bloco.
2. Dispare a execução via **`POST /api/tasks/:id/run`**. O retorno da API incluirá o `runId` exclusivo daquela execução.
3. O agente pode consultar a sessão ativa filtrando diretamente pelo identificador em **`GET /api/agent/sessions?runId=XYZ`**.
4. O agente assume a sessão enviando um payload com `{ runId }` para **`POST /api/agent/acquire`**.
5. Uma vez conectado, o agente manipula a página enviando comandos para **`POST /api/agent/execute`** (com suporte a ações como `eval`, `navigate`, `click`, `fill`, `screenshot` e `html`).
6. Por fim, o agente devolve o controle para a pipeline prosseguir chamando **`POST /api/agent/release`** com `{ runId }`.

