import { db } from '../backend/src/db/db.js';
import { runTask } from '../backend/src/runner/engine.js';
import assert from 'assert';

console.log('=== TEST: JS log() function & execution variables in engine ===');

const testTaskId = 'test_js_log_task_' + Date.now();
const testBlockId = 'test_js_log_block_' + Date.now();

const block = {
  id: testBlockId,
  name: 'Test JS Log Block',
  description: 'Block testing log(...) execution and variable mutation',
  category: 'teste',
  steps: [
    {
      id: 'step_eval_with_log',
      type: 'eval',
      script: `
        log("Mensagem de log 1: Iniciando teste...");
        log("Parâmetros recebidos:", params.meuParam);
        vars.resultadoCalculado = (params.numero || 10) * 3;
        log("Resultado calculado:", vars.resultadoCalculado);
        log({ status: "SUCESSO", timestamp: Date.now() });
        return { total: vars.resultadoCalculado };
      `
    }
  ],
  parameters: [
    { name: 'meuParam', type: 'text', defaultValue: 'Valor Teste' },
    { name: 'numero', type: 'number', defaultValue: 15 }
  ],
  secrets: {},
  updated_at: new Date().toISOString()
};

const task = {
  id: testTaskId,
  name: 'Test JS Log Task',
  description: 'Task testing user JS logging',
  blocks: [
    {
      blockId: testBlockId,
      parameterValues: {}
    }
  ],
  execution_variables: [
    { name: 'resultadoCalculado', type: 'number', defaultValue: 0 }
  ],
  anti_detection: 0,
  updated_at: new Date().toISOString()
};

db.saveBlock(block);
db.saveTask(task);

// Execute the task
const result = await runTask(testTaskId, {
  headless: true,
  liveView: false
});

console.log('Task run finished. Status:', result.status);
assert.strictEqual(result.status, 'success', 'Task run should succeed');

// Check the log record
const log = db.getLog(result.id);
console.log('Steps executed:', log.stepsExecuted.length);
const evalStep = log.stepsExecuted[0];

console.log('Eval Step userLogs:', evalStep.userLogs);
assert(evalStep.userLogs && evalStep.userLogs.length >= 4, 'Should capture at least 4 user log calls');
assert(evalStep.userLogs[0].includes('Iniciando teste'), 'First log matches');
assert(evalStep.userLogs[1].includes('Valor Teste'), 'Param log matches');
assert(evalStep.userLogs[2].includes('45'), 'Calculated log matches');
assert(evalStep.userLogs[3].includes('SUCESSO'), 'Object log matches');

// Check execution variables mutation
console.log('ExecutionVars in log:', log.executionVars);
assert.strictEqual(log.executionVars.resultadoCalculado, 45, 'Variable should be updated to 45');

console.log('✓ JS log() function and execution variables verified successfully in engine!');

// Clean up
db.deleteTask(testTaskId);
db.deleteBlock(testBlockId);

console.log('=== ALL TESTS PASSED! ===');
