import { db } from './db/db.js';

async function seed() {
  console.log('Seeding database with stable repeatable test automation...');

  // 1. Create Wikipedia Search Block
  const block = db.saveBlock({
    id: 'wikipedia-search-print',
    name: 'Wikipedia Search & Print',
    description: 'Navega para a Wikipedia, preenche um termo na busca, clica em pesquisar e tira um print.',
    parameters: [
      {
        name: 'termo_de_busca',
        description: 'Termo a ser pesquisado na Wikipedia',
        defaultValue: 'Playwright (software)'
      }
    ],
    steps: [
      {
        type: 'navigate',
        url: 'https://www.wikipedia.org'
      },
      {
        type: 'wait',
        condition: 'visible',
        selector: 'input#searchInput'
      },
      {
        type: 'type',
        selector: 'searchInput',
        selector_type: 'id',
        text: '{{param:termo_de_busca}}'
      },
      {
        type: 'click',
        selector: 'pure-button-primary-progressive',
        selector_type: 'class'
      },
      {
        type: 'wait',
        condition: 'load'
      },
      {
        type: 'take_screenshot'
      },
      {
        type: 'extract_html'
      }
    ]
  });

  console.log('Created/Updated Block:', block.id);

  // 2. Create Task Pipeline linking the block
  const task = db.saveTask({
    id: 'wikipedia-scraping-pipeline',
    name: 'Wikipedia Scraping Pipeline',
    description: 'Pipeline modular para extração de dados e captura de tela na Wikipedia',
    blocks: [
      {
        id: 'wiki-search-step-instance-1',
        blockId: block.id,
        parameterValues: {} // Empty to show default fallback
      }
    ]
  });

  console.log('Created/Updated Task:', task.id);

  // 2.2. Create Agent Control Block
  const agentBlock = db.saveBlock({
    id: 'agent-control-block',
    name: 'Agent Remote Control',
    description: 'Navega para a Wikipedia e cede o controle para um agente externo manipular a sessão.',
    steps: [
      {
        type: 'navigate',
        url: 'https://www.wikipedia.org'
      },
      {
        type: 'agent_control',
        acquireTimeout: 30,
        executionTimeout: 60
      },
      {
        type: 'take_screenshot'
      }
    ]
  });
  console.log('Created/Updated Agent Block:', agentBlock.id);

  // 2.3. Create Agent Task Pipeline linking the block
  const agentTask = db.saveTask({
    id: 'agent-handoff-pipeline',
    name: 'Agent Handoff Pipeline',
    description: 'Pipeline de demonstração para controle interativo por agentes de IA',
    blocks: [
      {
        id: 'agent-control-step-instance-1',
        blockId: agentBlock.id,
        parameterValues: {}
      }
    ]
  });
  console.log('Created/Updated Agent Task:', agentTask.id);

  // 3. Create a Schedule (disabled by default)
  const schedule = db.saveSchedule({
    id: 'wikipedia-hourly-schedule',
    taskId: task.id,
    cronExpression: '0 * * * *', // Every hour
    enabled: false
  });

  console.log('Created/Updated Schedule:', schedule.id);
  console.log('Seeding complete successfully.');
}

seed().catch(err => {
  console.error('Seeding failed:', err);
});
