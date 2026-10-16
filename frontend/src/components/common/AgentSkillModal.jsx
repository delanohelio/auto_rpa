import React, { useState, useEffect } from 'react';
import { XCircle, Bot, Download, Copy, Check, Terminal, Code2, ShieldAlert, BookOpen, ExternalLink, Play, Layers } from 'lucide-react';

export default function AgentSkillModal({ onClose }) {
  const [activeTab, setActiveTab] = useState('overview');
  const [copiedCode, setCopiedCode] = useState('');
  const [rawMarkdown, setRawMarkdown] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const saved = localStorage.getItem('systemPassword');
    const headers = saved ? { 'x-system-password': saved } : {};
    fetch('/api/agent/skill', { headers })
      .then(res => res.json())
      .then(data => {
        if (data.content) {
          setRawMarkdown(data.content);
        }
      })
      .catch(err => console.error('Erro ao buscar skill:', err))
      .finally(() => setLoading(false));
  }, []);

  const handleCopy = (code, id) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(id);
    setTimeout(() => setCopiedCode(''), 2500);
  };

  const handleDownload = async () => {
    try {
      const saved = localStorage.getItem('systemPassword');
      const url = saved ? `/api/agent/skill/download?password=${encodeURIComponent(saved)}` : '/api/agent/skill/download';
      const res = await fetch(url, {
        headers: saved ? { 'x-system-password': saved } : {}
      });
      if (!res.ok) throw new Error('Falha no download');
      const blob = await res.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = 'autorpa-agent-handoff.skill.md';
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(downloadUrl);
    } catch (err) {
      console.error('Erro no download via blob, tentando fallback:', err);
      const saved = localStorage.getItem('systemPassword');
      window.location.href = saved 
        ? `/api/agent/skill/download?password=${encodeURIComponent(saved)}` 
        : '/api/agent/skill/download';
    }
  };

  const nodeCode = `import fetch from 'node-fetch'; // ou nativo no Node 18+

const BASE_URL = process.env.AUTORPA_URL || 'http://localhost:3000';
const PASSWORD = process.env.AUTORPA_PASSWORD || '';

const headers = {
  'Content-Type': 'application/json',
  ...(PASSWORD ? { 'x-system-password': PASSWORD } : {})
};

async function handleAgentHandoff(targetRunId = null) {
  // 1. Identificar sessão em espera
  let runId = targetRunId;
  if (!runId) {
    const res = await fetch(\`\${BASE_URL}/api/agent/sessions\`, { headers });
    const sessions = await res.json();
    const waiting = sessions.find(s => s.status === 'waiting');
    if (!waiting) {
      console.log('Nenhuma sessão aguardando controle de agente.');
      return;
    }
    runId = waiting.runId;
  }

  console.log(\`[Agente] Assumindo controle da execução: \${runId}\`);

  // 2. Adquirir controle da sessão (SEMPRE antes de executar)
  const acquireRes = await fetch(\`\${BASE_URL}/api/agent/acquire\`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ runId })
  });

  if (!acquireRes.ok) {
    const err = await acquireRes.json();
    throw new Error(\`Falha ao adquirir sessão: \${err.error}\`);
  }

  const exec = async (action, params = {}) => {
    const r = await fetch(\`\${BASE_URL}/api/agent/execute\`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ runId, action, params })
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || \`Erro na ação \${action}\`);
    return data.result;
  };

  try {
    // 3. Inspeção e Ação Autônoma
    const url = await exec('eval', { script: 'window.location.href' });
    const title = await exec('eval', { script: 'document.title' });
    console.log(\`[Agente] Página ativa: "\${title}" (\${url})\`);

    // Capturar screenshot ou inspecionar HTML
    const screenshot = await exec('screenshot');
    // await exec('fill', { selector: '#campo-busca', value: 'AutoRPA' });
    // await exec('click', { selector: 'button[type="submit"]' });

  } finally {
    // 4. SEMPRE liberar a sessão de volta para a pipeline
    console.log(\`[Agente] Liberando sessão \${runId} de volta para a pipeline...\`);
    await fetch(\`\${BASE_URL}/api/agent/release\`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ runId })
    });
    console.log('[Agente] Controle liberado com sucesso!');
  }
}

handleAgentHandoff();`;

  const pythonCode = `import os
import requests

BASE_URL = os.getenv("AUTORPA_URL", "http://localhost:3000")
PASSWORD = os.getenv("AUTORPA_PASSWORD", "")

headers = { "Content-Type": "application/json" }
if PASSWORD:
    headers["x-system-password"] = PASSWORD

def run_agent_handoff(target_run_id=None):
    # 1. Localizar sessão aguardando
    run_id = target_run_id
    if not run_id:
        r = requests.get(f"{BASE_URL}/api/agent/sessions", headers=headers)
        sessions = r.json()
        waiting = next((s for s in sessions if s.get("status") == "waiting"), None)
        if not waiting:
            print("Nenhuma sessão aguardando controle de agente.")
            return
        run_id = waiting["runId"]

    print(f"[Agente] Adquirindo sessão {run_id}...")

    # 2. Acquire (cancela Acquire Timeout e inicia Execution Timeout)
    acq = requests.post(f"{BASE_URL}/api/agent/acquire", json={"runId": run_id}, headers=headers)
    acq.raise_for_status()

    def execute(action, params=None):
        payload = {"runId": run_id, "action": action, "params": params or {}}
        res = requests.post(f"{BASE_URL}/api/agent/execute", json=payload, headers=headers)
        data = res.json()
        if not res.ok:
            raise RuntimeError(data.get("error", f"Falha na ação {action}"))
        return data.get("result")

    try:
        # 3. Interagir com o navegador
        title = execute("eval", {"script": "document.title"})
        print(f"[Agente] Página ativa: {title}")

        # Captura de tela para modelos multimodais
        shot = execute("screenshot")
        # Base64 da imagem em shot["base64"]

    finally:
        # 4. Release obrigatório em bloco finally
        print(f"[Agente] Devolvendo controle da sessão {run_id}...")
        requests.post(f"{BASE_URL}/api/agent/release", json={"runId": run_id}, headers=headers)
        print("[Agente] Sessão liberada com sucesso.")

if __name__ == "__main__":
    run_agent_handoff()`;

  const curlCode = `# 1. Listar sessões aguardando
RUN_ID=$(curl -s http://localhost:3000/api/agent/sessions | jq -r '.[0].runId')
echo "RunID detectado: $RUN_ID"

# 2. Assumir controle
curl -s -X POST http://localhost:3000/api/agent/acquire \\
  -H "Content-Type: application/json" \\
  -d "{\\"runId\\": \\"$RUN_ID\\"}"

# 3. Executar comando (ex: capturar título)
curl -s -X POST http://localhost:3000/api/agent/execute \\
  -H "Content-Type: application/json" \\
  -d "{\\"runId\\": \\"$RUN_ID\\", \\"action\\": \\"eval\\", \\"params\\": {\\"script\\": \\"document.title\\"}}"

# 4. Devolver controle para retomar a pipeline
curl -s -X POST http://localhost:3000/api/agent/release \\
  -H "Content-Type: application/json" \\
  -d "{\\"runId\\": \\"$RUN_ID\\"}"`;

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 1200 }}>
      <div
        className="modal-content"
        style={{ maxWidth: '820px', maxHeight: '88vh', display: 'flex', flexDirection: 'column' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="modal-header" style={{ paddingBottom: '12px', borderBottom: '1px solid var(--border-color)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '8px',
                  background: 'rgba(168, 85, 247, 0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#c084fc',
                  border: '1px solid rgba(168, 85, 247, 0.3)'
                }}
              >
                <Bot size={20} />
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <h3 className="modal-title" style={{ fontSize: '16px', margin: 0 }}>
                    Skill: AutoRPA Agent Handoff
                  </h3>
                  <span
                    className="badge"
                    style={{
                      background: 'rgba(168, 85, 247, 0.15)',
                      color: '#c084fc',
                      fontSize: '10px',
                      border: '1px solid rgba(168, 85, 247, 0.3)'
                    }}
                  >
                    Handoff Agente
                  </span>
                </div>
                <p className="text-muted" style={{ fontSize: '12px', margin: '2px 0 0' }}>
                  Instruções e protocolo para modelos de IA assumirem o navegador durante a pipeline.
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleDownload}
                style={{
                  fontSize: '12px',
                  padding: '6px 12px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: 'var(--color-primary)'
                }}
                title="Baixar arquivo SKILL.md para usar no Claude, Antigravity ou agentes locais"
              >
                <Download size={14} /> Baixar SKILL.md
              </button>
              <XCircle className="modal-close" size={24} onClick={onClose} style={{ cursor: 'pointer' }} />
            </div>
          </div>

          {/* Navigation Tabs */}
          <div style={{ display: 'flex', gap: '6px', marginTop: '14px', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '6px' }}>
            {[
              { id: 'overview', label: 'Visão Geral & Protocolo', icon: Layers },
              { id: 'api', label: 'API & Endpoints', icon: Terminal },
              { id: 'code', label: 'Scripts Prontos', icon: Code2 },
              { id: 'markdown', label: 'SKILL.md Completo', icon: BookOpen }
            ].map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 12px',
                    fontSize: '12px',
                    borderRadius: '6px',
                    background: isActive ? 'rgba(168, 85, 247, 0.15)' : 'transparent',
                    color: isActive ? '#d8b4fe' : 'var(--text-muted)',
                    border: isActive ? '1px solid rgba(168, 85, 247, 0.35)' : '1px solid transparent',
                    fontWeight: isActive ? 600 : 400,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <Icon size={14} /> {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Scrollable Body */}
        <div className="modal-body" style={{ overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* TAB: OVERVIEW */}
          {activeTab === 'overview' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div
                style={{
                  padding: '14px 16px',
                  background: 'rgba(168, 85, 247, 0.05)',
                  borderRadius: '8px',
                  border: '1px solid rgba(168, 85, 247, 0.25)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px'
                }}
              >
                <h4 style={{ fontSize: '13px', color: '#c084fc', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Bot size={16} /> O que é o Modo Handoff Agente?
                </h4>
                <p style={{ fontSize: '12px', color: 'var(--text-light)', lineHeight: 1.5, margin: 0 }}>
                  O <strong>Handoff Agente</strong> é uma arquitetura híbrida de automação. Enquanto passos determinísticos
                  (navegar, preencher campos fixos, login prévio) são executados pelo AutoRPA em alta velocidade, etapas
                  complexas como desafios visuais, 2FA, CAPTCHA ou decisões inteligentes pausam a pipeline no passo <code>agent_control</code>.
                  O navegador fica congelado e aguarda que o Agente de IA assuma a sessão, execute as ações necessárias e devolva o controle.
                </p>
              </div>

              {/* Protocol Flow Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
                <div style={{ padding: '12px', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border-color)', borderRadius: '6px' }}>
                  <span style={{ fontSize: '11px', color: '#60a5fa', fontWeight: 700, display: 'block', marginBottom: '4px' }}>1. Detectar</span>
                  <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: 0 }}>
                    Agente consulta <code>GET /api/agent/sessions</code> para encontrar sessões com status <code>waiting</code>.
                  </p>
                </div>
                <div style={{ padding: '12px', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border-color)', borderRadius: '6px' }}>
                  <span style={{ fontSize: '11px', color: '#a78bfa', fontWeight: 700, display: 'block', marginBottom: '4px' }}>2. Assumir (Acquire)</span>
                  <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: 0 }}>
                    Chama <code>POST /api/agent/acquire</code> com o <code>runId</code>. O timer de espera é cancelado e o timer de execução inicia.
                  </p>
                </div>
                <div style={{ padding: '12px', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border-color)', borderRadius: '6px' }}>
                  <span style={{ fontSize: '11px', color: '#34d399', fontWeight: 700, display: 'block', marginBottom: '4px' }}>3. Interagir</span>
                  <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: 0 }}>
                    Executa comandos com <code>POST /api/agent/execute</code> (<code>screenshot</code>, <code>eval</code>, <code>click</code>, <code>fill</code>, <code>html</code>).
                  </p>
                </div>
                <div style={{ padding: '12px', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border-color)', borderRadius: '6px' }}>
                  <span style={{ fontSize: '11px', color: '#f87171', fontWeight: 700, display: 'block', marginBottom: '4px' }}>4. Devolver (Release)</span>
                  <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: 0 }}>
                    Chama <code>POST /api/agent/release</code> no bloco <code>finally</code>. A pipeline retoma a execução imediatamente.
                  </p>
                </div>
              </div>

              {/* Warning Alert */}
              <div
                style={{
                  padding: '10px 14px',
                  background: 'rgba(239, 68, 68, 0.08)',
                  borderRadius: '6px',
                  border: '1px solid rgba(239, 68, 68, 0.25)',
                  fontSize: '11px',
                  color: '#fca5a5',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                <ShieldAlert size={16} color="#f87171" />
                <span>
                  <strong>Atenção:</strong> Sempre libere a sessão via <code>/api/agent/release</code> para evitar que a
                  pipeline fique congelada esperando o tempo limite de execução (timeout).
                </span>
              </div>
            </div>
          )}

          {/* TAB: API */}
          {activeTab === 'api' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                URL Base padrão: <code style={{ color: '#60a5fa' }}>http://localhost:3000</code>. Header de autenticação (se configurado): <code>x-system-password: &lt;senha&gt;</code>.
              </div>

              {/* Endpoints Table */}
              <div style={{ border: '1px solid var(--border-color)', borderRadius: '6px', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                  <thead>
                    <tr style={{ background: 'rgba(255, 255, 255, 0.04)', borderBottom: '1px solid var(--border-color)', textAlign: 'left' }}>
                      <th style={{ padding: '8px 12px' }}>Método & Rota</th>
                      <th style={{ padding: '8px 12px' }}>Body / Parâmetros</th>
                      <th style={{ padding: '8px 12px' }}>Descrição</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.04)' }}>
                      <td style={{ padding: '8px 12px', fontFamily: 'var(--font-mono)', color: '#60a5fa' }}>GET /api/agent/sessions</td>
                      <td style={{ padding: '8px 12px', color: 'var(--text-muted)' }}>?runId=... (opcional)</td>
                      <td style={{ padding: '8px 12px' }}>Retorna lista de sessões aguardando agente (status: <code>waiting</code>).</td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.04)' }}>
                      <td style={{ padding: '8px 12px', fontFamily: 'var(--font-mono)', color: '#a78bfa' }}>POST /api/agent/acquire</td>
                      <td style={{ padding: '8px 12px', fontFamily: 'var(--font-mono)' }}>&#123; "runId": "..." &#125;</td>
                      <td style={{ padding: '8px 12px' }}>Assume controle da sessão. Obrigatório antes de qualquer comando.</td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.04)' }}>
                      <td style={{ padding: '8px 12px', fontFamily: 'var(--font-mono)', color: '#34d399' }}>POST /api/agent/execute</td>
                      <td style={{ padding: '8px 12px', fontFamily: 'var(--font-mono)' }}>&#123; "runId", "action", "params" &#125;</td>
                      <td style={{ padding: '8px 12px' }}>Executa ações: <code>eval</code>, <code>screenshot</code>, <code>click</code>, <code>fill</code>, <code>navigate</code>, <code>html</code>.</td>
                    </tr>
                    <tr>
                      <td style={{ padding: '8px 12px', fontFamily: 'var(--font-mono)', color: '#f87171' }}>POST /api/agent/release</td>
                      <td style={{ padding: '8px 12px', fontFamily: 'var(--font-mono)' }}>&#123; "runId": "..." &#125;</td>
                      <td style={{ padding: '8px 12px' }}>Libera o navegador e retoma os passos seguintes da pipeline.</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Action Payloads Details */}
              <div style={{ background: 'rgba(0, 0, 0, 0.25)', padding: '12px', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                <h5 style={{ fontSize: '12px', color: '#d8b4fe', margin: '0 0 8px' }}>Ações de Execução Suportadas (POST /api/agent/execute):</h5>
                <ul style={{ fontSize: '11px', color: 'var(--text-light)', margin: 0, paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <li><code>eval</code>: <code>&#123; "script": "document.title" &#125;</code> &rarr; Retorna resultado da expressão JS.</li>
                  <li><code>screenshot</code>: <code>&#123;&#125;</code> &rarr; Retorna imagem inteira da página em Base64.</li>
                  <li><code>html</code>: <code>&#123;&#125;</code> &rarr; Retorna string completa com o código HTML renderizado.</li>
                  <li><code>click</code>: <code>&#123; "selector": "#meu-botao" &#125;</code> &rarr; Clica no seletor CSS informado.</li>
                  <li><code>fill</code>: <code>&#123; "selector": "input[name='q']", "value": "Texto" &#125;</code> &rarr; Preenche input.</li>
                  <li><code>navigate</code>: <code>&#123; "url": "https://meusite.com" &#125;</code> &rarr; Navega para nova URL.</li>
                </ul>
              </div>
            </div>
          )}

          {/* TAB: CODE EXAMPLES */}
          {activeTab === 'code' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {/* Node.js Block */}
              <div style={{ background: '#090d16', border: '1px solid var(--border-color)', borderRadius: '6px', overflow: 'hidden' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: 'rgba(255, 255, 255, 0.03)', borderBottom: '1px solid rgba(255, 255, 255, 0.06)' }}>
                  <span style={{ fontSize: '11px', color: '#93c5fd', fontWeight: 600 }}>JavaScript / Node.js</span>
                  <button
                    type="button"
                    onClick={() => handleCopy(nodeCode, 'node')}
                    style={{ fontSize: '11px', background: 'transparent', border: 'none', color: copiedCode === 'node' ? '#4ade80' : 'var(--text-muted)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                  >
                    {copiedCode === 'node' ? <Check size={13} /> : <Copy size={13} />}
                    {copiedCode === 'node' ? 'Copiado!' : 'Copiar'}
                  </button>
                </div>
                <pre style={{ margin: 0, padding: '12px', fontSize: '11px', color: '#e2e8f0', overflowX: 'auto', maxHeight: '200px' }}>
                  <code>{nodeCode}</code>
                </pre>
              </div>

              {/* Python Block */}
              <div style={{ background: '#090d16', border: '1px solid var(--border-color)', borderRadius: '6px', overflow: 'hidden' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: 'rgba(255, 255, 255, 0.03)', borderBottom: '1px solid rgba(255, 255, 255, 0.06)' }}>
                  <span style={{ fontSize: '11px', color: '#facc15', fontWeight: 600 }}>Python</span>
                  <button
                    type="button"
                    onClick={() => handleCopy(pythonCode, 'python')}
                    style={{ fontSize: '11px', background: 'transparent', border: 'none', color: copiedCode === 'python' ? '#4ade80' : 'var(--text-muted)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                  >
                    {copiedCode === 'python' ? <Check size={13} /> : <Copy size={13} />}
                    {copiedCode === 'python' ? 'Copiado!' : 'Copiar'}
                  </button>
                </div>
                <pre style={{ margin: 0, padding: '12px', fontSize: '11px', color: '#e2e8f0', overflowX: 'auto', maxHeight: '200px' }}>
                  <code>{pythonCode}</code>
                </pre>
              </div>

              {/* cURL Block */}
              <div style={{ background: '#090d16', border: '1px solid var(--border-color)', borderRadius: '6px', overflow: 'hidden' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: 'rgba(255, 255, 255, 0.03)', borderBottom: '1px solid rgba(255, 255, 255, 0.06)' }}>
                  <span style={{ fontSize: '11px', color: '#34d399', fontWeight: 600 }}>Terminal / cURL</span>
                  <button
                    type="button"
                    onClick={() => handleCopy(curlCode, 'curl')}
                    style={{ fontSize: '11px', background: 'transparent', border: 'none', color: copiedCode === 'curl' ? '#4ade80' : 'var(--text-muted)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                  >
                    {copiedCode === 'curl' ? <Check size={13} /> : <Copy size={13} />}
                    {copiedCode === 'curl' ? 'Copiado!' : 'Copiar'}
                  </button>
                </div>
                <pre style={{ margin: 0, padding: '12px', fontSize: '11px', color: '#e2e8f0', overflowX: 'auto', maxHeight: '160px' }}>
                  <code>{curlCode}</code>
                </pre>
              </div>
            </div>
          )}

          {/* TAB: RAW MARKDOWN */}
          {activeTab === 'markdown' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  Conteúdo do arquivo <code>.agents/skills/autorpa-agent-handoff/SKILL.md</code>
                </span>
                <button
                  type="button"
                  onClick={() => handleCopy(rawMarkdown, 'raw')}
                  style={{ fontSize: '11px', background: 'transparent', border: 'none', color: copiedCode === 'raw' ? '#4ade80' : 'var(--text-muted)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                >
                  {copiedCode === 'raw' ? <Check size={13} /> : <Copy size={13} />}
                  {copiedCode === 'raw' ? 'Copiado!' : 'Copiar Todo Markdown'}
                </button>
              </div>
              <textarea
                readOnly
                value={loading ? 'Carregando skill...' : rawMarkdown}
                style={{
                  width: '100%',
                  height: '350px',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '11px',
                  background: '#090d16',
                  color: '#94a3b8',
                  padding: '12px',
                  borderRadius: '6px',
                  border: '1px solid var(--border-color)',
                  resize: 'none'
                }}
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="modal-footer" style={{ borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
            AutoRPA Handoff API • Porta 3000
          </span>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Fechar
            </button>
            <button type="button" className="btn btn-primary" onClick={handleDownload} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              <Download size={14} /> Baixar SKILL.md
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
