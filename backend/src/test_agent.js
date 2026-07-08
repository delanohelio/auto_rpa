const BASE_URL = 'http://localhost:3000';

async function run() {
  console.log('Starting Agent Control Handoff simulator...');

  let session = null;
  
  // 1. Poll for active sessions
  for (let i = 0; i < 15; i++) {
    console.log(`Polling for active waiting sessions (${i + 1}/15)...`);
    try {
      const res = await fetch(`${BASE_URL}/api/agent/sessions`);
      if (res.ok) {
        const sessions = await res.json();
        const waiting = sessions.find(s => s.status === 'waiting');
        if (waiting) {
          session = waiting;
          console.log('Found session waiting for control:', session.runId);
          break;
        }
      }
    } catch (err) {
      console.error('Error fetching sessions:', err.message);
    }
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  if (!session) {
    console.error('No session found waiting for control. Make sure you run a pipeline containing the agent_control step.');
    process.exit(1);
  }

  const runId = session.runId;

  // 2. Acquire control
  console.log(`Acquiring control for session ${runId}...`);
  const acquireRes = await fetch(`${BASE_URL}/api/agent/acquire`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ runId })
  });

  if (!acquireRes.ok) {
    const err = await acquireRes.json();
    console.error('Failed to acquire session:', err.error);
    process.exit(1);
  }

  console.log('Successfully acquired control!');

  // Helper helper to execute actions
  const executeAction = async (action, params = {}) => {
    console.log(`Executing agent action: ${action} with params:`, JSON.stringify(params));
    const executeRes = await fetch(`${BASE_URL}/api/agent/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ runId, action, params })
    });
    
    if (!executeRes.ok) {
      const err = await executeRes.json();
      throw new Error(`Action ${action} failed: ${err.error}`);
    }
    
    const data = await executeRes.json();
    return data.result;
  };

  try {
    // 3. Execute some browser commands
    const currentUrl = await executeAction('eval', { script: 'window.location.href' });
    console.log('Agent read current page URL:', currentUrl);

    const pageTitle = await executeAction('eval', { script: 'document.title' });
    console.log('Agent read current page title:', pageTitle);

    console.log('Agent navigating to DuckDuckGo...');
    await executeAction('navigate', { url: 'https://duckduckgo.com' });

    const newTitle = await executeAction('eval', { script: 'document.title' });
    console.log('Agent read new DuckDuckGo title:', newTitle);

    console.log('Agent taking screenshot...');
    const screenshotData = await executeAction('screenshot');
    console.log('Agent screenshot generated. Base64 length:', screenshotData.base64.length);

  } catch (error) {
    console.error('Agent execution error:', error.message);
  } finally {
    // 4. Release control
    console.log('Releasing control back to pipeline...');
    const releaseRes = await fetch(`${BASE_URL}/api/agent/release`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ runId })
    });
    
    if (releaseRes.ok) {
      console.log('Control released successfully! Pipeline will now resume.');
    } else {
      const err = await releaseRes.json();
      console.error('Failed to release session:', err.error);
    }
  }
}

run().catch(err => {
  console.error('Simulator crashed:', err.message);
});
