// src/CopyToClipboardButton.js
import React, { useState } from 'react';
import './CopyToClipboardButton.css'; // Opcional: crie um CSS específico para o botão de cópia

const CopyToClipboardButton = ({ textToCopy, children }) => {
  const [copySuccess, setCopySuccess] = useState("");

  const handleCopy = async () => {
    const prefix = "***Texto final revisado:***";
    let actualTextToCopy = textToCopy;

    if (textToCopy.includes(prefix)) {
      const startIndex = textToCopy.indexOf(prefix) + prefix.length;
      actualTextToCopy = textToCopy.substring(startIndex).trim();
    } else {
      console.warn("Prefixo '***Texto final revisado:***' não encontrado no texto a ser copiado.");
      // Opcional: você pode querer ajustar o comportamento aqui se o prefixo for essencial
      // Por exemplo, pode não copiar nada ou dar um feedback diferente.
    }

    try {
      await navigator.clipboard.writeText(actualTextToCopy);
      setCopySuccess("Copiado!");
    } catch (err) {
      setCopySuccess("Falha ao copiar!");
      console.error("Erro ao copiar para a área de transferência:", err);
    }

    // Limpa a mensagem de sucesso/erro após um tempo
    setTimeout(() => {
      setCopySuccess("");
    }, 2000); // A mensagem desaparece após 2 segundos
  };

  return (
    <button
      onClick={handleCopy}
      className='copy-button' // Pode ser a mesma classe de App.css ou uma nova em CopyToClipboardButton.css
      disabled={!textToCopy} // Desabilita o botão se não houver texto para copiar
    >
      {copySuccess || children || "Copiar"}
    </button>
  );
};

export default CopyToClipboardButton;