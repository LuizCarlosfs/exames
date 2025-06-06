// src/App.js 02/06/2025

import React, { useState } from "react"
import "./App.css" // Importa o arquivo CSS

// Importa os novos componentes
import Header from "./components/Header"
import TopicForm from "./components/TopicForm"
import LoadingAndErrorDisplay from "./components/LoadingAndErrorDisplay"
import ResultsDisplay from "./components/ResultsDisplay"
import Footer from "./components/Footer"



function App() {
  const [topic, setTopic] = useState("")
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState(null)
  const [error, setError] = useState(null)

  const handleSubmit = async (formData) => {
    setLoading(true)
    setResults(null)
    setError(null)

    try {
      // ESTA É A LINHA MAIS IMPORTANTE A SER CORRIGIDA:
      // Você precisa substituir "SUA_URL_DO_BACKEND_NO_RENDER_AQUI" pela URL real do seu serviço no Render.
  
      //const response = await fetch("http://localhost:5000/generate-post", {
      const response = await fetch("https://exames.onrender.com/generate-post", {
          method: "POST",
          body: formData, // Envie o FormData
        }
      )

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Algo deu errado no servidor.")
      }

      const data = await response.json()
      setResults(data)
    } catch (err) {
      console.error("Erro ao buscar dados:", err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className='App'>
      <Header />
      <main className='App-main'>
        <TopicForm
          topic={topic}
          setTopic={setTopic}
          loading={loading}
          handleSubmit={handleSubmit}
        />
        <LoadingAndErrorDisplay loading={loading} error={error} />
        <ResultsDisplay results={results} />
      </main>
      <Footer />
    </div>
  )
}

export default App
