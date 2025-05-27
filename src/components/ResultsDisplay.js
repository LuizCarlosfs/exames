// src/components/ResultsDisplay.js
//  Exibir os resultados gerados pelos agentes.

import React from 'react';
import CopyToClipboardButton from './CopyToClipboardButton';
import SendToWhatsAppButton from './SendToWhatsAppButton';

const ResultsDisplay = ({ results }) => {
  if (!results) {
    return null; // Não renderiza nada se não houver resultados
  }

  return (
    <div className='results-container'>
      <h2>✨ Post Gerado e Saídas dos Agentes ✨</h2>
      <div className='agent-output-section'>
        <h3>Agente 1 (Buscador):</h3>
        <pre>{results.buscador_output}</pre>
      </div>
      <div className='agent-output-section'>
        <h3>Agente 2 (Planejador):</h3>
        <pre>{results.planejador_output}</pre>
      </div>
      <div className='agent-output-section'>
        <h3>Agente 3 (Redator - Rascunho):</h3>
        <pre className='draft-post'>{results.redator_output}</pre>
      </div>
      <div className='agent-output-section final-post'>
        <h3>Agente 4 (Revisor - Post Final):</h3>
        <pre>{results.revisor_output}</pre>
        {results.revisor_output &&
          results.revisor_output.includes("ótimo") && (
            <p className='ready-to-publish'>
              🎉 Lembre-se, foi emitido por IA, não substitui o médico! 🎉
            </p>
          )}
        <div style={{ display: 'flex', gap: '10px', marginTop: '15px' }}>
          <CopyToClipboardButton textToCopy={results.revisor_output}>
            Copiar Texto Final Revisado
          </CopyToClipboardButton>
          <SendToWhatsAppButton textToSend={results.revisor_output}>
            Enviar por WhatsApp
          </SendToWhatsAppButton>
        </div>
      </div>
    </div>
  );
};

export default ResultsDisplay;