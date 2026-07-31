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
- `ExecutarJS(script)`: Executa um script JavaScript personalizado (eval) de forma síncrona no contexto da página e registra o retorno no histórico da execução.

---

## ⚙️ Variáveis Criptografadas (Secrets)

Para cadastrar dados sensíveis:
1. Acesse **Blocos de Ação** -> **Criar Bloco** ou **Editar**.
2. Na seção **Variáveis Privadas / Senhas (Secrets)**, defina a chave (ex: `senha_banco`) e o valor.
3. Para utilizar este valor em ações de digitação, use a sintaxe: `{{secret:senha_banco}}`.
4. O backend armazenará a chave no banco como um hash encriptado. Durante a automação, ela será resolvida em memória apenas no instante do preenchimento e logada no histórico como `●●●●●●`.

---

## 🏷️ Módulos Parametrizados e Sobrescritas (Parâmetros)

O AutoRPA permite criar blocos de ação dinâmicos utilizando variáveis parametrizáveis:

1. **Parâmetros de Blocos**: Ao editar ou criar um Bloco, declare parâmetros fornecendo um nome (ex: `termo_busca`) e um valor padrão. No corpo das etapas do bloco, use a sintaxe `{{param:termo_busca}}`.
2. **Sobrescritas Estáticas (Pipeline)**: Na montagem de uma tarefa (Pipeline), você pode preencher valores customizados para os parâmetros de cada bloco adicionado.
3. **Sobrescritas Dinâmicas (Runtime)**: Ao iniciar manualmente uma execução a partir da interface, o modal **"Configurar Execução"** será exibido, permitindo alterar os valores dos parâmetros apenas para aquela rodada.
4. **Ordem de Precedência**: Na resolução de variáveis, o motor respeita a precedência: **Overrides Temporários (Runtime) > Overrides Estáticos (Pipeline) > Padrões do Bloco (Default) > String vazia ("")**.

Além disso, a interface sinaliza visualmente com badges roxos os blocos e pipelines que contêm **Controle de Agente**, bem como a contagem de parâmetros ativos em cada bloco.

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

---

## 🔒 Outros Recursos Avançados

### 1. Modo Anti-Detecção (Bypass Bot Detection)
Para evitar o bloqueio e a detecção de automação por servidores e firewalls (como Cloudflare, Akamai e testes de impressão digital como o sannysoft):
- Ative o checkbox **"Ativar Modo Anti-Detecção"** na edição da Pipeline ou envie `"antiDetection": true` na API.
- O motor RPA iniciará o Playwright aplicando o argumento `--disable-blink-features=AutomationControlled`, mascarará o User-Agent, e removerá o indicador `navigator.webdriver` diretamente de `Navigator.prototype` em tempo de execução, além de mockar objetos globais do Google Chrome (`window.chrome`, plugins e idiomas).

### 2. Exportação e Importação de Módulos e Pipelines
Você pode realizar backups ou compartilhar suas automações facilmente:
- **Exportar**: Clique em **Exportar** nos cards de Blocos de Ações ou Pipelines para baixar um arquivo JSON estruturado contendo a definição da automação.
- **Importar**: Clique em **Importar Bloco** ou **Importar Pipeline** para ler um arquivo JSON local e carregá-lo instantaneamente no AutoRPA.

### 3. Links de Representação JSON (API) e Deep-linking
Para facilitar a leitura direta por agentes externos e operadores humanos:
- **Botão Link**: Copia a URL direta da API que retorna a representação JSON crua do objeto (`/api/blocks/<id>` ou `/api/tasks/<id>`), facilitando a extração programática dos passos pelo agente de IA.
- **Deep-linking Web**: A interface gráfica ainda suporta os parâmetros de URL `?tab=blocks&id=<id>` e `?tab=tasks&id=<id>` para redirecionamento automático de operadores na interface.

### 4. Geração e Download de Arquivos de Saída (Ex: CSV, TXT)
Para rotinas que extraem dados estruturados (por exemplo, listas de participantes, relatórios financeiros ou estatísticas de páginas):
- Ao adicionar uma etapa do tipo **Executar Javascript (Eval)**, preencha o campo **"Salvar Saída em Arquivo"** (ex: `participantes.csv`).
- O retorno síncrono da execução do JS será gravado automaticamente como arquivo sob a pasta persistente `/downloads/`.
- Após a conclusão da pipeline, o link do arquivo gerado estará disponível no histórico de logs da respectiva etapa para download direto.

### 5. Configurações de Autolimpeza e Manutenção de Disco
O painel administrativo do AutoRPA inclui a aba **Sistema** para gerenciamento global:
- **Backup e Restauração**: Permite exportar e importar a base inteira (`db.json`) contendo logs, blocos e pipelines.
- **Autolimpeza programada**: Você pode definir o número de dias para retenção dos dados. Logs de execuções, screenshots e downloads gerados com idade superior à quantidade de dias parametrizada serão removidos automaticamente uma vez por dia à meia-noite (e a cada reinicialização).
- **Limpeza Manual**: Permite esvaziar pastas de screenshots, downloads de arquivos e limpar histórico de logs instantaneamente.

### 6. Restrição de Acesso por Senha (Segurança)
Para proteger o orquestrador em rede exposta, defina `SYSTEM_PASSWORD` no arquivo `.env`.
- A interface React exibirá uma tela de autenticação por senha.
- Requisições REST API externas de robôs ou agentes externos devem incluir o cabeçalho HTTP `'x-system-password': 'suasenha'`.

### 7. Suporte a XPath em Todas as Ações de Seleção
Todas as etapas de ação que interagem com o DOM suportam seleção por XPath:
- **Digitar / Preencher (`type`)**: Permite localizar campos via XPath (ex: `//input[@name='login']`).
- **Aguardar Elemento Visível (`wait`)**: Permite aguardar a visibilidade de elementos via XPath (ex: `//div[contains(@class, 'success')]`).
- **Listar Elementos (`list_elements`)**: Extrai múltiplos nós DOM via XPath.
- **Seletor Condicional (`conditional_if`)**: Avalia a existência de elementos na página via XPath.


