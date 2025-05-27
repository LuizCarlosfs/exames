// src/SendToWhatsAppButton.js
// Enviar o texto revisado para o WhatsApp

import React, { useState } from 'react';
import './SendToWhatsAppButton.css'; // Opcional: crie um CSS específico para este botão

const SendToWhatsAppButton = ({ textToSend, children }) => {
  const [sendFeedback, setSendFeedback] = useState("");

  const handleSend = () => {
    const prefix = "***Texto final revisado:***";
    let actualTextToSend = textToSend;

    if (textToSend.includes(prefix)) {
      const startIndex = textToSend.indexOf(prefix) + prefix.length;
      actualTextToSend = textToSend.substring(startIndex).trim();
    } else {
      console.warn("Prefixo '***Texto final revisado:***' não encontrado no texto para enviar.");
      // Se o prefixo não for encontrado, ainda podemos tentar enviar o texto completo.
    }

    if (!actualTextToSend) {
      setSendFeedback("Nenhum texto para enviar!");
      setTimeout(() => setSendFeedback(""), 2000);
      return;
    }

    // Codifica o texto para ser seguro em uma URL
    const encodedText = encodeURIComponent(actualTextToSend);
    
    // Constrói a URL do WhatsApp Web/App
    // Note: para enviar para um número específico, você usaria 'whatsapp://send?phone=NUMERO&text=...'
    // Para abrir sem número específico, para o usuário escolher o contato, use 'whatsapp://send?text=...'
    // Para desktop, 'https://wa.me/?text=...'
    const whatsappUrl = `https://www.google.com/url?sa=E&source=gmail&q=https://wa.me/?text=${encodedText}`;

    try {
      window.open(whatsappUrl, '_blank'); // Abre em uma nova aba/janela
      setSendFeedback("Abrindo WhatsApp...");
    } catch (err) {
      setSendFeedback("Falha ao abrir WhatsApp!");
      console.error("Erro ao tentar abrir WhatsApp:", err);
    }

    setTimeout(() => {
      setSendFeedback("");
    }, 3000); // A mensagem desaparece após 3 segundos
  };

  return (
    <button
      onClick={handleSend}
      className='whatsapp-button' // Nova classe CSS
      disabled={!textToSend} // Desabilita o botão se não houver texto
    >
      {sendFeedback || children || "Enviar por WhatsApp"}
    </button>
  );
};

export default SendToWhatsAppButton;