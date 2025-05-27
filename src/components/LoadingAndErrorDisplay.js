// src/components/LoadingAndErrorDisplay.js
// Exibir mensagens de carregamento ou erro

import React from 'react';

const LoadingAndErrorDisplay = ({ loading, error }) => {
  return (
    <>
      {error && <p className='error-message'>Erro: {error}</p>}

      {loading && (
        <div className='loading-spinner'>
          <p>Executando agentes... Por favor, aguarde.</p>
          <div className='spinner'></div>
        </div>
      )}
    </>
  );
};

export default LoadingAndErrorDisplay;