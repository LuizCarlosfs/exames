// src/components/TopicForm.js
import React, { useState } from 'react';

const TopicForm = ({ topic, setTopic, loading, handleSubmit }) => {
  // Alterado de 'null' para um array vazio para armazenar múltiplos arquivos
  const [files, setFiles] = useState([]);
  const [age, setAge] = useState('');
  const [gender, setGender] = useState('');
  const [medicalSpecialty, setMedicalSpecialty] = useState('');
  const [additionalText, setAdditionalText] = useState('');

  const handleFileChange = (e) => {
    // e.target.files é um FileList, converta para Array
    setFiles(Array.from(e.target.files));
  };

  const handleFormSubmit = (e) => {
    e.preventDefault();
    const formData = new FormData();
    formData.append('topic', topic);

    // Itera sobre o array de arquivos e anexa cada um ao FormData
    files.forEach((file, index) => {
      formData.append(`file${index}`, file); // Nomeia os arquivos como file0, file1, etc.
    });

    formData.append('age', age);
    formData.append('gender', gender);
    formData.append('medicalSpecialty', medicalSpecialty);
    formData.append('additionalText', additionalText);
   
    handleSubmit(formData);
  };

  const medicalSpecialties = [
    "",
    "Clínico Geral",
    "Cardiologia",
    "Cirurgia Geral",
    "Dermatologia",
    "Gastroenterologia",
    "Geriatria",
    "Ginecologia",
    "Homeopatia",
    "Infectologia",
    "Neurologia",
    "Ortopedia",
    "Pneumologia",
    "Psiquiatria",
    "Urologia"
  ];

  return (
    <form onSubmit={handleFormSubmit} className='input-form'>
      <label htmlFor='topic-input'>
        ❓ Por favor, digite máximo de informações sobre o exame que deseja analisar:
      </label>
      <input
        id='topic-input'
        type='text'
        value={topic}
        onChange={(e) => setTopic(e.target.value)}
        placeholder='ex: Resultados de glicemia, histórico de dor de cabeça, etc.'
        disabled={loading}
        required
      />

      <label htmlFor='file-input'>Importar Arquivos (opcional, múltiplos):</label>
      <input
        id='file-input'
        type='file'
        onChange={handleFileChange}
        disabled={loading}
        multiple // Adiciona o atributo 'multiple' para permitir múltiplos arquivos
      />
      {files.length > 0 && (
        <p>Arquivos selecionados: {files.map(f => f.name).join(', ')}</p>
      )}

      <div className="inline-fields">
        <div className="field-group">
          <label htmlFor='age-input'>Idade (opcional):</label>
          <input
            id='age-input'
            type='number'
            value={age}
            onChange={(e) => setAge(e.target.value)}
            disabled={loading}
            min="0"
          />
        </div>

        <div className="field-group">
          <label htmlFor='gender-input'>Sexo (opcional):</label>
          <select
            id='gender-input'
            value={gender}
            onChange={(e) => setGender(e.target.value)}
            disabled={loading}
          >
            <option value=''>Selecione</option>
            <option value='Masculino'>Masculino</option>
            <option value='Feminino'>Feminino</option>
            <option value='Outro'>Outro</option>
          </select>
        </div>

        <div className="field-group">
          <label htmlFor='medical-specialty-input'>Especialidade(op.):</label>
          <select
            id='medical-specialty-input'
            value={medicalSpecialty}
            onChange={(e) => setMedicalSpecialty(e.target.value)}
            disabled={loading}
          >
            {medicalSpecialties.map((spec) => (
              <option key={spec} value={spec}>{spec}</option>
            ))}
          </select>
        </div>
      </div>

      <label htmlFor='additional-text-input'>Texto Adicional para Análise (opcional):</label>
      <textarea
        id='additional-text-input'
        value={additionalText}
        onChange={(e) => setAdditionalText(e.target.value)}
        placeholder='Insira qualquer texto relevante que a IA possa usar para a análise...'
        rows="5"
        disabled={loading}
      />

      <button type='submit' disabled={loading}>
        {loading ? "Gerando..." : "Gerar Post"}
      </button>
    </form>
  );
};

export default TopicForm;