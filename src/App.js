// src/App.js

import React, { useState } from "react"
import "./App.css" // Importa o arquivo CSS

// Importa os novos componentes
import Header from "./components/Header"
import TopicForm from "./components/TopicForm"
import LoadingAndErrorDisplay from "./components/LoadingAndErrorDisplay"
import ResultsDisplay from "./components/ResultsDisplay"
import Footer from "./components/Footer"

const express = require('express')
const app = express()
const port = process.env.PORT || 10000 

app.get('/', (req, res) => {
  res.send('Hello World!')
})

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})



function App() {
  const [topic, setTopic] = useState("")
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState(null)
  const [error, setError] = useState(null)

  const handleSubmit = async (formData) => {
    // Modificado para receber FormData
    setLoading(true)
    setResults(null)
    setError(null)

    try {
      //const response = await fetch("http://localhost:5000/generate-post", {
      const response = await fetch(port, {
        method: "POST",
             // Remova o cabeçalho "Content-Type", o navegador o define automaticamente para FormData
        body: formData, // Envie o FormData
      })

      if (!response.ok) {
        const errorData = await response.json
        throw new Error(
          errorData.error || "Something went wrong on the server."
        )
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