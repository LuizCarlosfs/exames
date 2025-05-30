// server.js

import express from "express"
import cors from "cors"
import dotenv from "dotenv"
import {
  GoogleGenerativeAI,
  HarmBlockThreshold,
  HarmCategory,
} from "@google/generative-ai"
import multer from "multer" // Para lidar com uploads de arquivos
//import pdfParse from "pdf-parse" // Para analisar PDFs





dotenv.config() // Carrega variáveis de ambiente do arquivo .env

const app = express()
const port = process.env.PORT || 5000

app.use(cors())
app.use(express.json()) // Para analisar application/json - não é estritamente necessário com multer, mas é boa prática

// Configura o multer para uploads de arquivos
const upload = multer()

// Garanta que sua GOOGLE_API_KEY esteja configurada em seu arquivo .env
const API_KEY = process.env.GOOGLE_API_KEY

let genAI
try {
  genAI = new GoogleGenerativeAI(API_KEY)
} catch (e) {
  console.error(
    `Erro ao inicializar o cliente GenAI. Verifique sua GOOGLE_API_KEY: ${e}`
  )
  // Sair ou lidar graciosamente se a chave da API estiver faltando/inválida
  process.exit(1)
}

const MODEL_ID = "gemini-1.5-flash" // Usando 1.5-flash, pois geralmente é bom para essas tarefas

// --- FUNÇÕES AUXILIARES ---

async function callAgent(agentInstructions, messageText) {
  const model = genAI.getGenerativeModel({
    model: MODEL_ID,
    safetySettings: [
      {
        category: HarmCategory.HARM_CATEGORY_HARASSMENT,
        threshold: HarmBlockThreshold.BLOCK_NONE,
      },
      {
        category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
        threshold: HarmBlockThreshold.BLOCK_NONE,
      },
      {
        category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
        threshold: HarmBlockThreshold.BLOCK_NONE,
      },
      {
        category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
        threshold: HarmBlockThreshold.BLOCK_NONE,
      },
    ],
  })

  // Para agentes que usam ferramentas, nós os configuraríamos aqui.
  // Por enquanto, como seus agentes Python não usaram explicitamente a configuração de ferramentas do ADK
  // mas sim o Google Search como uma instrução conceitual, vamos adaptar.
  // Para realmente usar o Google Search como uma ferramenta, você integraria a Search Tool do SDK.
  // Para este exemplo, vamos mantê-lo como uma instrução baseada em texto para o modelo "simular" a busca.

  const chat = model.startChat({
    history: [],
    generationConfig: {
      maxOutputTokens: 8000, // Ajuste conforme necessário
    },
  })

  const result = await chat.sendMessage(
    `${agentInstructions}\n\n${messageText}`
  )
  const response = await result.response
  return response.text()
}

async function extractTextFromFile(file) {
  if (!file || !file.mimetype) {
    return "Erro: Nenhum arquivo ou tipo MIME inválido."
  }

  if (file.mimetype === "application/pdf") {
    try {
      const data = await pdfParse(file.buffer)
      return data.text
    } catch (e) {
      console.error(`Erro ao processar PDF '${file.originalname}':`, e)
      return `Erro ao processar PDF '${file.originalname}': ${e.message}`
    }
  } else if (
    file.mimetype === "text/plain" ||
    file.mimetype === "text/markdown"
  ) {
    try {
      return file.buffer.toString("utf8")
    } catch (e) {
      console.error(
        `Erro ao processar arquivo de texto '${file.originalname}':`,
        e
      )
      return `Erro ao processar arquivo de texto '${file.originalname}': ${e.message}`
    }
  } else {
    return `Tipo de arquivo não suportado para extração de texto: '${file.originalname}' (${file.mimetype})`
  }
}

// --- FUNÇÕES DOS AGENTES ---

async function agenteBuscador(
  topic,
  age,
  gender,
  medicalSpecialty,
  additionalText,
  allFilesContent,
  todayDate
) {
  const instruction = `
        Você é um médico com muitos anos de experiência e um especialista em medicina.
        Sua principal tarefa é analisar detalhadamente as informações de exames fornecidas no 'Tópico Principal/Exame'.
        Use as informações adicionais do paciente (idade, sexo, especialidade médica, texto adicional) e os 'Conteúdos dos Arquivos Anexados' para contextualizar e aprofundar sua análise.

        Você deve utilizar a ferramenta de busca do Google (simule a busca, mencionando o que você procuraria ou o que encontraria) para encontrar informações médicas complementares, dados sobre doenças, tratamentos, ou artigos científicos relevantes que ajudem a compreender melhor os resultados dos exames e as condições do paciente.
        Seu objetivo é fornecer uma análise abrangente e embasada.

        **É CRUCIAL ENFATIZAR CLARAMENTE EM CADA SAÍDA:**
        "ATENÇÃO: Sou uma inteligência artificial e não um médico. Este diagnóstico ou análise é apenas para fins de curiosidade e informação. Consulte sempre um profissional de saúde qualificado para qualquer decisão médica."

        Sua resposta deve ser um resumo organizado e analítico dos principais pontos, com base nas informações fornecidas e na sua pesquisa.
    `

  const filesInfoText = allFilesContent.length
    ? allFilesContent
        .map(
          (fileData, i) =>
            `--- INÍCIO DO CONTEÚDO DO ARQUIVO ${i + 1} (${
              fileData.filename
            }) ---\n${fileData.content}\n--- FIM DO CONTEÚDO DO ARQUIVO ${
              i + 1
            } ---`
        )
        .join("\n")
    : "Nenhum arquivo anexado ou conteúdo não lido."

  const inputMessage = `
    Tópico Principal/Exame: ${topic}
    Idade do Paciente: ${age || "Não informado"}
    Sexo do Paciente: ${gender || "Não informado"}
    Especialidade Médica Relevante: ${medicalSpecialty || "Não informado"}
    Texto Adicional para Análise: ${additionalText || "Nenhum"}
    
    Conteúdo dos Arquivos Anexados:
    ${filesInfoText}
    
    Data da consulta/análise: ${todayDate}
    `
  return await callAgent(instruction, inputMessage)
}

async function agentePlanejador(originalTopic, initialMedicalAnalysis) {
  const instruction = `
        Você é um planejador de conteúdo médico. Com base na 'Análise Médica Inicial' fornecida pelo Agente 1,
        crie um plano detalhado para um parecer ou relatório médico.
        O plano deve incluir as seguintes seções bem definidas:
        1.  **Resumo dos Dados do Paciente e Exames:** Onde serão apresentadas as informações principais fornecidas.
        2.  **Análise dos Achados Principais:** Detalhar as observações mais relevantes da análise médica.
        3.  **Informações Complementares da Pesquisa (se houver):** Integrar dados relevantes encontrados pelo Agente 1 (simule a integração da pesquisa).
        4.  **Considerações Finais e Observações:** Um espaço para conclusões cautelosas e a **ênfase obrigatória** sobre a natureza da análise (IA, não substitui médico).

        Seu objetivo é organizar o conteúdo de forma lógica e clara para a redação do parecer final.
    `
  const inputMessage = `Tópico Original: ${originalTopic}\nAnálise Médica Inicial: ${initialMedicalAnalysis}`
  return await callAgent(instruction, inputMessage)
}

async function agenteRedator(originalTopic, reportPlan) {
  const instruction = `
        Você é um Redator Médico com experiência em criar relatórios e pareceres médicos claros, objetivos e profissionais.
        Utilize o 'Plano de Relatório' fornecido para escrever um rascunho completo de um parecer/relatório médico.
        **Mantenha um tom estritamente profissional e informativo.**
        **É ABSOLUTAMENTE ESSENCIAL INCLUIR NO INÍCIO OU FINAL DO PARECER A SEGUINTE NOTA:**
        "ATENÇÃO: Este parecer foi gerado por Inteligência Artificial e não substitui a consulta, diagnóstico ou tratamento médico por um profissional de saúde qualificado. É apenas para fins informativos e de curiosidade."

        Não faça diagnósticos diretos nem prescreva tratamentos. Apenas compile e apresente as informações de forma estruturada conforme o plano.
    `
  const inputMessage = `Tópico Original: ${originalTopic}\nPlano de Relatório: ${reportPlan}`
  return await callAgent(instruction, inputMessage)
}

async function agenteRevisor(originalTopic, generatedDraft) {
  const instruction = `
        Você é um Editor e Revisor de Conteúdo médico meticuloso, com foco em clareza, precisão e adequação ética.
        Revise o rascunho do parecer/relatório médico abaixo sobre o 'Tópico Original', verificando:
        1.  **Clareza e Concisão:** O texto é fácil de entender e vai direto ao ponto?
        2.  **Precisão:** As informações estão corretas com base no que foi fornecido (sem inventar dados)?
        3.  **Aviso Legal:** Verifique se o aviso legal sobre ser uma IA (e não um substituto médico) está presente e em destaque. Se não estiver, adicione-o no início ou final do texto final.
        4.  **Não Diagnóstico/Tratamento:** Garanta que não há diagnósticos diretos, prescrições de tratamento ou conselhos médicos explícitos.
        5.  **Gramática e Formatação:** Corrija quaisquer erros gramaticais, de ortografia ou formatação.

        Se o rascunho estiver pronto e atender a todos os critérios (especialmente o aviso legal e a ausência de diagnóstico direto), responda :
        'O parecer está ótimo e pronto para ser revisado por um profissional humano!' e após repita o rascunho final.

        Caso haja problemas, aponte-os e sugira melhorias.
        Em todos os casos, antes de transcrever o texto final revisado, coloque a frase:
        ***Texto final revisado:***
    `
  const inputMessage = `Tópico Original: ${originalTopic}\nRascunho: ${generatedDraft}`
  return await callAgent(instruction, inputMessage)
}

// --- ROTA PRINCIPAL DA API ---

app.post("/generate-post", upload.any(), async (req, res) => {
  const { topic, age, gender, medicalSpecialty, additionalText } = req.body
  const todayDate = new Date().toLocaleDateString("pt-BR")

  if (!topic) {
    return res.status(400).json({ error: "Topic is required" })
  }

  if (!genAI) {
    return res
      .status(500)
      .json({ error: "GenAI Client not initialized. Check API Key." })
  }

  const allFilesContent = []
  if (req.files && req.files.length > 0) {
    for (const file of req.files) {
      const extractedContent = await extractTextFromFile(file)
      allFilesContent.push({
        filename: file.originalname,
        content: extractedContent,
      })
    }
  }

  try {
    const analiseMedicaInicial = await agenteBuscador(
      topic,
      age,
      gender,
      medicalSpecialty,
      additionalText,
      allFilesContent,
      todayDate
    )
    const planoDeRelatorio = await agentePlanejador(topic, analiseMedicaInicial)
    const rascunhoDeRelatorio = await agenteRedator(topic, planoDeRelatorio)
    const parecerFinalRevisado = await agenteRevisor(topic, rascunhoDeRelatorio)

    return res.json({
      buscador_output: analiseMedicaInicial,
      planejador_output: planoDeRelatorio,
      redator_output: rascunhoDeRelatorio,
      revisor_output: parecerFinalRevisado,
    })
  } catch (e) {
    console.error("Erro durante a execução do agente:", e)
    return res.status(500).json({ error: `Ocorreu um erro: ${e.message}` })
  }
})

app.listen(port, () => {
  if (!API_KEY) {
    console.warn(
      "AVISO: A variável de ambiente GOOGLE_API_KEY não está configurada. Por favor, defina-a em seu arquivo .env ou diretamente no ambiente."
    )
  }
  console.log(`Servidor ouvindo na porta ${port}`)
})
