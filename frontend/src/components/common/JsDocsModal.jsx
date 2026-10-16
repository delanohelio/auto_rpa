import React, { useState } from 'react';
import {
  X, Code, BookOpen, Terminal, Database, Key, HelpCircle,
  Copy, Check, FileText, Calendar, Clock, Hash, List, ListFilter,
  Sparkles
} from 'lucide-react';

export default function JsDocsModal({ isOpen, onClose }) {
  const [activeTab, setActiveTab] = useState('params');
  const [copiedCode, setCopiedCode] = useState(null);

  if (!isOpen) return null;

  const handleCopy = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(id);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const tabs = [
    { id: 'params', label: 'Parâmetros (params)', icon: Database },
    { id: 'vars', label: 'Variáveis de Execução (vars)', icon: FileText },
    { id: 'logs', label: 'Função de Log (log)', icon: Terminal },
    { id: 'secrets', label: 'Segredos (secrets)', icon: Key },
    { id: 'return', label: 'Retorno & Arquivos', icon: Sparkles }
  ];

  return (
    <div
      className="modal-overlay"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 2000,
        background: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px'
      }}
      onClick={onClose}
    >
      <div
        className="modal-container"
        style={{
          width: '800px',
          maxWidth: '95vw',
          maxHeight: '90vh',
          background: 'var(--bg-card, #181b24)',
          border: '1px solid var(--border-color, #2d3343)',
          borderRadius: '12px',
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.7)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 20px',
            borderBottom: '1px solid var(--border-color, #2d3343)',
            background: 'rgba(255, 255, 255, 0.02)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                background: 'rgba(59, 130, 246, 0.15)',
                border: '1px solid rgba(59, 130, 246, 0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <Code size={18} color="var(--color-primary, #3b82f6)" />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>
                Referência de Ações JavaScript (Eval)
              </h3>
              <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-muted, #94a3b8)' }}>
                Guia de dados, tipos de variáveis, variáveis de execução e logs em tempo real
              </p>
            </div>
          </div>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={onClose}
            style={{ padding: '6px', borderRadius: '6px' }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div
          style={{
            display: 'flex',
            gap: '4px',
            padding: '10px 20px',
            borderBottom: '1px solid var(--border-color, #2d3343)',
            background: 'rgba(0, 0, 0, 0.2)',
            overflowX: 'auto'
          }}
        >
          {tabs.map(tab => {
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
                  padding: '8px 12px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: isActive ? 600 : 400,
                  cursor: 'pointer',
                  border: 'none',
                  background: isActive ? 'var(--color-primary, #3b82f6)' : 'transparent',
                  color: isActive ? '#ffffff' : 'var(--text-muted, #94a3b8)',
                  transition: 'all 0.15s ease',
                  whiteSpace: 'nowrap'
                }}
              >
                <Icon size={14} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Content Body */}
        <div
          style={{
            padding: '20px',
            overflowY: 'auto',
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            gap: '16px'
          }}
        >
          {/* TAB 1: PARAMS */}
          {activeTab === 'params' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ fontSize: '13px', color: 'var(--text-light, #f1f5f9)', lineHeight: '1.5' }}>
                Os parâmetros declarados no bloco são injetados diretamente no objeto{' '}
                <code style={{ color: '#38bdf8', fontWeight: 600 }}>params</code>. Cada tipo possui uma representação nativa em JavaScript:
              </div>

              {/* Types Breakdown Table */}
              <div
                style={{
                  border: '1px solid var(--border-color, #2d3343)',
                  borderRadius: '8px',
                  overflow: 'hidden',
                  background: 'rgba(255, 255, 255, 0.02)'
                }}
              >
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                  <thead>
                    <tr style={{ background: 'rgba(0, 0, 0, 0.3)', borderBottom: '1px solid var(--border-color, #2d3343)', textAlign: 'left' }}>
                      <th style={{ padding: '8px 12px', color: '#94a3b8' }}>Tipo</th>
                      <th style={{ padding: '8px 12px', color: '#94a3b8' }}>Tipo no JS</th>
                      <th style={{ padding: '8px 12px', color: '#94a3b8' }}>Exemplo de Valor</th>
                      <th style={{ padding: '8px 12px', color: '#94a3b8' }}>Como Acessar / Utilizar</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                      <td style={{ padding: '8px 12px', fontWeight: 600, color: '#93c5fd' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <FileText size={12} /> Texto
                        </span>
                      </td>
                      <td style={{ padding: '8px 12px', fontFamily: 'monospace', color: '#38bdf8' }}>string</td>
                      <td style={{ padding: '8px 12px', fontFamily: 'monospace' }}>"Relatório Anual"</td>
                      <td style={{ padding: '8px 12px', fontFamily: 'monospace' }}>const txt = params.meuTexto;</td>
                    </tr>

                    <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                      <td style={{ padding: '8px 12px', fontWeight: 600, color: '#34d399' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <Hash size={12} /> Número
                        </span>
                      </td>
                      <td style={{ padding: '8px 12px', fontFamily: 'monospace', color: '#34d399' }}>number (primitivo)</td>
                      <td style={{ padding: '8px 12px', fontFamily: 'monospace' }}>42 ou 3.14</td>
                      <td style={{ padding: '8px 12px', fontFamily: 'monospace' }}>
                        const dobro = params.quantidade * 2;
                      </td>
                    </tr>

                    <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                      <td style={{ padding: '8px 12px', fontWeight: 600, color: '#60a5fa' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <Calendar size={12} /> Data
                        </span>
                      </td>
                      <td style={{ padding: '8px 12px', fontFamily: 'monospace', color: '#38bdf8' }}>string (BR)</td>
                      <td style={{ padding: '8px 12px', fontFamily: 'monospace' }}>"16/10/2026"</td>
                      <td style={{ padding: '8px 12px', fontFamily: 'monospace' }}>
                        const [dia, mes, ano] = params.dataFiltro.split('/');
                      </td>
                    </tr>

                    <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                      <td style={{ padding: '8px 12px', fontWeight: 600, color: '#c084fc' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <Clock size={12} /> Data e Hora
                        </span>
                      </td>
                      <td style={{ padding: '8px 12px', fontFamily: 'monospace', color: '#38bdf8' }}>string (BR)</td>
                      <td style={{ padding: '8px 12px', fontFamily: 'monospace' }}>"16/10/2026 15:30"</td>
                      <td style={{ padding: '8px 12px', fontFamily: 'monospace' }}>
                        const [data, hora] = params.agendamento.split(' ');
                      </td>
                    </tr>

                    <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                      <td style={{ padding: '8px 12px', fontWeight: 600, color: '#fbbf24' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <List size={12} /> Seletor
                        </span>
                      </td>
                      <td style={{ padding: '8px 12px', fontFamily: 'monospace', color: '#38bdf8' }}>string</td>
                      <td style={{ padding: '8px 12px', fontFamily: 'monospace' }}>"Opção A"</td>
                      <td style={{ padding: '8px 12px', fontFamily: 'monospace' }}>
                        if (params.status === 'Ativo') {`{ ... }`}
                      </td>
                    </tr>

                    <tr>
                      <td style={{ padding: '8px 12px', fontWeight: 600, color: '#22d3ee' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <ListFilter size={12} /> Multi Seleção
                        </span>
                      </td>
                      <td style={{ padding: '8px 12px', fontFamily: 'monospace', color: '#22d3ee' }}>Array&lt;string&gt;</td>
                      <td style={{ padding: '8px 12px', fontFamily: 'monospace' }}>["Opção 1", "Opção 2"]</td>
                      <td style={{ padding: '8px 12px', fontFamily: 'monospace' }}>
                        if (params.filtros.includes('Vendas')) {`{ ... }`}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Code Example */}
              <div style={{ background: '#0f172a', borderRadius: '8px', border: '1px solid #1e293b', padding: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 600 }}>Exemplo Prático com Parâmetros:</span>
                  <button
                    type="button"
                    onClick={() => handleCopy(`// Exemplo de manipulação dos parâmetros recebidos
const preco = params.valorUnitario || 10;
const quantidade = params.qtd || 1;
const total = preco * quantidade;

// Multi seleção é um array nativo
if (params.categorias && params.categorias.includes('Prioritário')) {
  log("Item prioritário detectado!");
}

return { total, categoriaPrincipal: params.categoria };`, 'code-params')}
                    style={{ background: 'transparent', border: 'none', color: '#38bdf8', fontSize: '11px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                  >
                    {copiedCode === 'code-params' ? <Check size={12} color="#34d399" /> : <Copy size={12} />}
                    {copiedCode === 'code-params' ? 'Copiado!' : 'Copiar'}
                  </button>
                </div>
                <pre style={{ margin: 0, fontFamily: 'var(--font-mono, monospace)', fontSize: '12px', color: '#e2e8f0', lineHeight: '1.4' }}>
{`// Exemplo de manipulação dos parâmetros recebidos
const preco = params.valorUnitario || 10; // número já primitivo
const quantidade = params.qtd || 1;
const total = preco * quantidade;

// Multi seleção é um array nativo de textos
if (params.categorias && params.categorias.includes('Prioritário')) {
  log("Item prioritário detectado!");
}

return { total, statusEscolhido: params.status };`}
                </pre>
              </div>
            </div>
          )}

          {/* TAB 2: VARS */}
          {activeTab === 'vars' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ fontSize: '13px', color: 'var(--text-light, #f1f5f9)', lineHeight: '1.5' }}>
                O objeto <code style={{ color: '#a855f7', fontWeight: 600 }}>vars</code> contém as variáveis globais de execução do pipeline.
                Você pode <strong>ler e escrever</strong> livremente nesse objeto. Todas as alterações persistem e são compartilhadas entre todos os blocos subsequentes da pipeline!
              </div>

              <div style={{ background: '#0f172a', borderRadius: '8px', border: '1px solid #1e293b', padding: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 600 }}>Leitura, Escrita e Acúmulo de Dados:</span>
                  <button
                    type="button"
                    onClick={() => handleCopy(`// Ler variável global
const contadorAtual = vars.contador || 0;

// Atualizar valor da variável global (persistência automática!)
vars.contador = contadorAtual + 1;

// Criar listas ou objetos acumuladores
if (!vars.processados) vars.processados = [];
vars.processados.push({
  id: Date.now(),
  titulo: document.title,
  dataProcessamento: new Date().toISOString()
});

log("Total processado até agora:", vars.contador);
return vars.contador;`, 'code-vars')}
                    style={{ background: 'transparent', border: 'none', color: '#38bdf8', fontSize: '11px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                  >
                    {copiedCode === 'code-vars' ? <Check size={12} color="#34d399" /> : <Copy size={12} />}
                    {copiedCode === 'code-vars' ? 'Copiado!' : 'Copiar'}
                  </button>
                </div>
                <pre style={{ margin: 0, fontFamily: 'var(--font-mono, monospace)', fontSize: '12px', color: '#e2e8f0', lineHeight: '1.4' }}>
{`// 1. Ler variável global
const contadorAtual = vars.contador || 0;

// 2. Modificar ou criar nova variável global (persistência automática!)
vars.contador = contadorAtual + 1;

// 3. Acumular listas ou objetos para blocos futuros
if (!vars.processados) vars.processados = [];
vars.processados.push({
  titulo: document.title,
  hora: new Date().toLocaleTimeString()
});

// 4. Acessível em etapas futuras via: {{var:contador}} ou {{vars.contador}}
return vars.contador;`}
                </pre>
              </div>

              <div style={{ padding: '10px 14px', background: 'rgba(168, 85, 247, 0.1)', border: '1px solid rgba(168, 85, 247, 0.25)', borderRadius: '6px', fontSize: '12px', color: '#e9d5ff' }}>
                💡 <strong>Dica:</strong> Em etapas seguintes do pipeline (como Navegar, Digitar ou Clicar), você pode interpolar qualquer variável global usando a sintaxe <code>{'{{var:nome}}'}</code> ou <code>{'{{vars.nome}}'}</code>!
              </div>
            </div>
          )}

          {/* TAB 3: LOGS */}
          {activeTab === 'logs' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ fontSize: '13px', color: 'var(--text-light, #f1f5f9)', lineHeight: '1.5' }}>
                A função <code style={{ color: '#34d399', fontWeight: 600 }}>log(...args)</code> permite imprimir mensagens, números, arrays e objetos formatados durante a execução do script.
                Essas mensagens são transmitidas <strong>em tempo real</strong> para o monitor de logs e salvas no histórico da execução!
              </div>

              <div style={{ background: '#0f172a', borderRadius: '8px', border: '1px solid #1e293b', padding: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 600 }}>Exemplos de Uso do log():</span>
                  <button
                    type="button"
                    onClick={() => handleCopy(`// Imprimir texto simples
log("Iniciando coleta de dados na página...");

// Imprimir múltiplos argumentos e variáveis
const itens = document.querySelectorAll('.produto');
log("Encontrados", itens.length, "produtos na listagem.");

// Imprimir objetos e arrays formatados
log("Configuração atual:", { modo: "extracao", timeout: 5000 });

// Imprimir etapas dentro de loops
itens.forEach((el, index) => {
  log(\`Processando item \${index + 1}: \${el.innerText.trim()}\`);
});`, 'code-logs')}
                    style={{ background: 'transparent', border: 'none', color: '#38bdf8', fontSize: '11px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                  >
                    {copiedCode === 'code-logs' ? <Check size={12} color="#34d399" /> : <Copy size={12} />}
                    {copiedCode === 'code-logs' ? 'Copiado!' : 'Copiar'}
                  </button>
                </div>
                <pre style={{ margin: 0, fontFamily: 'var(--font-mono, monospace)', fontSize: '12px', color: '#e2e8f0', lineHeight: '1.4' }}>
{`// 1. Mensagem simples
log("Iniciando coleta de dados...");

// 2. Múltiplos parâmetros e variáveis
const total = document.querySelectorAll('table tr').length;
log("Total de linhas encontradas:", total);

// 3. Objetos e arrays estruturados
log("Dados extraídos:", { cliente: "Acme Corp", saldo: 1500.50 });

// 4. Logs informativos dentro de iterações
for (let i = 0; i < 3; i++) {
  log(\`Processando lote \${i + 1} de 3...\`);
}`}
                </pre>
              </div>

              <div style={{ padding: '10px 14px', background: 'rgba(52, 211, 153, 0.1)', border: '1px solid rgba(52, 211, 153, 0.25)', borderRadius: '6px', fontSize: '12px', color: '#a7f3d0' }}>
                ⚡ <strong>Visualização:</strong> Os logs emitidos aparecem na linha do tempo da etapa correspondente na visualização de detalhes da execução (LogDetailsModal).
              </div>
            </div>
          )}

          {/* TAB 4: SECRETS */}
          {activeTab === 'secrets' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ fontSize: '13px', color: 'var(--text-light, #f1f5f9)', lineHeight: '1.5' }}>
                Credenciais, chaves de API e senhas cadastradas no bloco são descriptografadas em tempo de execução e passadas no objeto{' '}
                <code style={{ color: '#fbbf24', fontWeight: 600 }}>secrets</code>.
              </div>

              <div style={{ background: '#0f172a', borderRadius: '8px', border: '1px solid #1e293b', padding: '12px' }}>
                <pre style={{ margin: 0, fontFamily: 'var(--font-mono, monospace)', fontSize: '12px', color: '#e2e8f0', lineHeight: '1.4' }}>
{`// Acessar um token ou senha confidencial
const apiKey = secrets.API_TOKEN;
const senha = secrets.SENHA_PORTAL;

// Usar em cabeçalhos ou chamadas fetch
log("Autenticando na API externa...");
const resp = await fetch("https://api.exemplo.com/dados", {
  headers: { "Authorization": "Bearer " + apiKey }
});
const dados = await resp.json();
return dados;`}
                </pre>
              </div>
            </div>
          )}

          {/* TAB 5: RETURN */}
          {activeTab === 'return' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ fontSize: '13px', color: 'var(--text-light, #f1f5f9)', lineHeight: '1.5' }}>
                Tudo o que sua função retornar através do comando <code style={{ color: '#38bdf8', fontWeight: 600 }}>return</code> será capturado, formatado e gravado no log da etapa.
                Além disso, se você preencher o campo <strong>Salvar Saída em Arquivo</strong> (ex: <code>relatorio.json</code> ou <code>dados.csv</code>), o retorno será automaticamente salvo em disco para download na tela de logs!
              </div>

              <div style={{ background: '#0f172a', borderRadius: '8px', border: '1px solid #1e293b', padding: '12px' }}>
                <pre style={{ margin: 0, fontFamily: 'var(--font-mono, monospace)', fontSize: '12px', color: '#e2e8f0', lineHeight: '1.4' }}>
{`// Retornar objeto ou lista para auditoria e download
const produtos = Array.from(document.querySelectorAll('.card-item')).map(c => ({
  nome: c.querySelector('h2')?.innerText.trim(),
  preco: c.querySelector('.price')?.innerText.trim()
}));

log(\`Sucesso: \${produtos.length} produtos coletados.\`);

// O objeto retornado ficará gravado no log e será exportado para o arquivo!
return {
  dataExtracao: new Date().toISOString(),
  total: produtos.length,
  itens: produtos
};`}
                </pre>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            padding: '12px 20px',
            borderTop: '1px solid var(--border-color, #2d3343)',
            background: 'rgba(255, 255, 255, 0.02)'
          }}
        >
          <button type="button" className="btn btn-primary" onClick={onClose} style={{ padding: '6px 16px', fontSize: '13px' }}>
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
}
