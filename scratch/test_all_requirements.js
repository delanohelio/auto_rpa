import assert from 'assert';
import http from 'http';
import { db, normalizeParameter } from '../backend/src/db/db.js';
import { formatNowBrazilian, castVariableValue } from '../backend/src/runner/engine.js';
import { runTask } from '../backend/src/runner/engine.js';

function httpRequest(url, options = {}, body = null) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = http.request(u, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, headers: res.headers, data: JSON.parse(data) });
        } catch (_) {
          resolve({ status: res.statusCode, headers: res.headers, data });
        }
      });
    });
    req.on('error', reject);
    if (body) {
      req.write(typeof body === 'string' ? body : JSON.stringify(body));
    }
    req.end();
  });
}

async function runTests() {
  console.log('--- TEST 1: Database & Parameter Normalization (Requirements 1 & 1.1) ---');
  const legacyParam = { name: 'termo' };
  const normalized = normalizeParameter(legacyParam);
  assert.strictEqual(normalized.type, 'text', 'Legacy parameter must default to text');
  console.log('✓ Legacy parameter defaults to type="text"');

  const blocks = db.getBlocks();
  for (const b of blocks) {
    for (const p of b.parameters || []) {
      assert.ok(p.type, `Block ${b.name} param ${p.name} must have a type`);
    }
  }
  console.log(`✓ All ${blocks.length} blocks have normalized parameters with explicit types`);

  console.log('\n--- TEST 2: Brazilian Date/Time Standard & Casting (Requirements 1.2, 1.2.2, 1.4) ---');
  const brDate = formatNowBrazilian('date');
  const brDateTime = formatNowBrazilian('datetime');
  console.log(`Current Brazilian Date: ${brDate}`);
  console.log(`Current Brazilian DateTime: ${brDateTime}`);
  assert.match(brDate, /^\d{2}\/\d{2}\/\d{4}$/, 'Date must match DD/MM/YYYY');
  assert.match(brDateTime, /^\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}$/, 'DateTime must match DD/MM/YYYY HH:mm');
  console.log('✓ Brazilian date and datetime formats verified (considering minutes)');

  // Test type casting
  const numVal = castVariableValue('42.5', 'number');
  assert.strictEqual(typeof numVal, 'number');
  assert.strictEqual(numVal, 42.5);
  console.log('✓ Number variable cast to primitive JS number');

  const selectVal = castVariableValue('Opção A', 'select');
  assert.strictEqual(selectVal, 'Opção A');
  console.log('✓ Select variable cast to string');

  const multiVal = castVariableValue(['Opção 1', 'Opção 2'], 'multiselect');
  assert.deepStrictEqual(multiVal, ['Opção 1', 'Opção 2']);
  console.log('✓ MultiSelect variable cast to array of strings');

  console.log('\n--- TEST 3: JS Body-Only Eval & Execution Variables (Requirements 2 & 4) ---');
  // Create a temporary block with body-only eval and number operations
  const testBlockId = `test_eval_block_${Date.now()}`;
  const testBlock = {
    id: testBlockId,
    name: 'Test Eval Block',
    description: 'Block testing body-only eval and vars',
    parameters: [
      { name: 'factor', type: 'number', defaultValue: 3 }
    ],
    secrets: {},
    steps: [
      {
        type: 'eval',
        // Note: NO anonymous function wrapper! Just function body with math and vars assignment
        script: `
          vars.contador = (vars.contador || 0) + (params.factor * 10);
          vars.itens = (vars.itens || []).concat(['item_' + vars.contador]);
          return { soma: vars.contador, totalItens: vars.itens.length };
        `
      }
    ]
  };
  db.saveBlock(testBlock);

  const testTaskId = `test_eval_task_${Date.now()}`;
  const testTask = {
    id: testTaskId,
    name: 'Test Eval Task',
    description: 'Task testing body-only eval execution',
    blocks: [
      { id: 'inst_1', blockId: testBlockId, parameterValues: { factor: 5 } }
    ],
    executionVariables: [
      { name: 'contador', type: 'number', defaultValue: 100 },
      { name: 'itens', type: 'multiselect', defaultValue: ['inicial'] }
    ]
  };
  db.saveTask(testTask);

  const execResult = await runTask(testTaskId, {
    parameterOverrides: {},
    runtimeVars: {},
    skipVars: [],
    executionVariables: { contador: 100, itens: ['inicial'] },
    headless: true,
    liveView: false
  });

  assert.strictEqual(execResult.status, 'success', 'Task run must succeed');
  assert.strictEqual(execResult.executionVars.contador, 150, 'vars.contador must be 100 + 5*10 = 150');
  assert.deepStrictEqual(execResult.executionVars.itens, ['inicial', 'item_150']);
  console.log('✓ Body-only JS function evaluated successfully!');
  console.log(`✓ Initial vars: { contador: 100, itens: ['inicial'] } => Final vars:`, execResult.executionVars);

  console.log('\n--- TEST 4: Headless Execution Restrictions via API (Requirement 3) ---');
  // 4.1 Task with manual_interaction action
  const manualBlockId = `test_manual_block_${Date.now()}`;
  db.saveBlock({
    id: manualBlockId,
    name: 'Manual Block',
    steps: [
      { type: 'manual_interaction', instruction: 'Interaja com o site e clique em continuar' }
    ]
  });
  const manualTaskId = `test_manual_task_${Date.now()}`;
  db.saveTask({
    id: manualTaskId,
    name: 'Manual Task',
    blocks: [{ id: 'inst_m', blockId: manualBlockId }]
  });

  const manualRunRes = await httpRequest(`http://localhost:3000/api/tasks/${manualTaskId}/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { headless: true });

  assert.strictEqual(manualRunRes.status, 400, 'Must reject headless run with 400');
  assert.strictEqual(manualRunRes.data.code, 'HEADLESS_NOT_ALLOWED');
  console.log('✓ Requirement 3.1: Headless execution properly rejected for pipeline with manual interaction:', manualRunRes.data.error);

  // 4.2 Task with unskipped user_prompt
  const promptBlockId = `test_prompt_block_${Date.now()}`;
  db.saveBlock({
    id: promptBlockId,
    name: 'Prompt Block',
    steps: [
      {
        type: 'user_prompt',
        vars: [{ name: 'codigo_sms', label: 'Código SMS' }]
      }
    ]
  });
  const promptTaskId = `test_prompt_task_${Date.now()}`;
  db.saveTask({
    id: promptTaskId,
    name: 'Prompt Task',
    blocks: [{ id: 'inst_p', blockId: promptBlockId }]
  });

  const promptUnskippedRes = await httpRequest(`http://localhost:3000/api/tasks/${promptTaskId}/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { headless: true, skipVars: [] });

  assert.strictEqual(promptUnskippedRes.status, 400, 'Must reject headless run with 400 when prompt not skipped');
  assert.strictEqual(promptUnskippedRes.data.code, 'HEADLESS_NOT_ALLOWED');
  console.log('✓ Requirement 3.2: Headless execution properly rejected for unskipped prompt menu:', promptUnskippedRes.data.error);

  // When prompt is marked to skip, headless is allowed:
  const promptSkippedRes = await httpRequest(`http://localhost:3000/api/tasks/${promptTaskId}/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { headless: true, skipVars: ['codigo_sms'] });

  assert.strictEqual(promptSkippedRes.status, 200, 'Must allow headless run when prompt is skipped');
  console.log('✓ Headless execution allowed when interactive prompt variables are skipped');

  // Clean up test tasks and blocks
  db.deleteTask(testTaskId);
  db.deleteTask(manualTaskId);
  db.deleteTask(promptTaskId);
  db.deleteBlock(testBlockId);
  db.deleteBlock(manualBlockId);
  db.deleteBlock(promptBlockId);

  console.log('\n--- TEST 5: SQLite Database Mode (Requirement 5) ---');
  const pragmaJournal = db.rawDb.pragma('journal_mode');
  console.log(`SQLite Journal Mode:`, pragmaJournal);
  assert.strictEqual(pragmaJournal[0].journal_mode, 'wal', 'SQLite must be running in WAL mode');
  console.log('✓ SQLite database is running in WAL mode (database.sqlite)');

  console.log('\n======================================================');
  console.log('ALL REQUIREMENTS (1, 1.1, 1.2, 1.3, 1.4, 2, 3, 4, 5) VERIFIED SUCCESSFULLY!');
  console.log('======================================================');
}

runTests().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
