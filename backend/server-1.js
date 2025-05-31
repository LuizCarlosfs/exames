// server.js (Exemplo de como deveria ser seu backend Node.js)
const express = require('express');
const multer = require('multer');
const cors = require('cors');
const pdf = require('pdf-parse'); // Para extrair texto de PDFs
const fs = require('fs'); // Para lidar com streams de arquivo (opcional, multer pode fazer isso)
const { GoogleGenerativeAI } = require('@google/generative-ai'); // Para a API Gemini

const app = express();
const port = 5000;

app.use(cors()); // Habilita CORS para que o frontend possa se comunicar

// Configuração do Multer para lidar com uploads de arquivos
// 'memoryStorage' armazena o arquivo na memória, útil para processamento rápido
// Para arquivos muito grandes, considere 'diskStorage' e limpar os arquivos após o processamento.
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Substitua "YOUR_API_KEY" pela sua chave da API do Gemini
// Lembre-se de usar variáveis de ambiente em produção!
const API_KEY = process.env.GOOGLE_API_KEY; // Carregue via .env ou ambiente
if (!API_KEY) {
    console.error("ERRO: A variável de ambiente GOOGLE_API_KEY não está configurada.");
    console.error("Defina-a antes de executar o servidor. Ex: export GOOGLE_API_KEY='SUA_CHAVE'");
    process.exit(1);
}

const genAI = new GoogleGenerativeAI(API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" }); // Ou o MODEL_ID que você usa

// Helper function para extrair texto de PDF
async function extractTextFromPdfBuffer(buffer) {
    try {
        const data = await pdf(buffer);
        return data.text;
    } catch (error) {
        console.error("Erro ao extrair texto do PDF:", error);
        return `Erro ao processar PDF: ${error.message}`;
    }
}

// --- FUNÇÕES DOS AGENTES (Adaptadas para JavaScript) ---
// Você precisará traduzir a lógica de cada agente Python para JavaScript aqui.
// Esta é uma simplificação para mostrar a estrutura.

async function callAgent(agentInstruction, messageText, tools = []) {
    // A implementação da chamada do agente será diferente em JS.
    // Usaremos diretamente a API Gemini.
    const parts = [
        { text: agentInstruction }, // Instrução do sistema
        { text: messageText } // Mensagem do usuário com o input
    ];

    try {
        const result = await model.generateContent({
            contents: [{ role: "user", parts }],
            tools: tools.length > 0 ? [{ function_declarations: tools }] : undefined // Se houver ferramentas
        });
        const response = await result.response;
        return response.text();
    } catch (error) {
        console.error("Erro ao chamar o agente:", error);
        return `Erro interno do agente: ${error.message}`;
    }
}

// Agente 1: Analisador/Buscador de Informações Médicas (Exemplo JS)
async function agenteBuscador(topico, age, gender, medicalSpecialty, additionalText, allFilesContent) {
    const agentInstruction = `Você é um médico com muitos anos de experiência e um especialista em medicina.
        Sua principal tarefa é analisar detalhadamente as informações de exames fornecidas no 'Tópico Principal/Exame'.
        Use as informações adicionais do paciente (idade, sexo, especialidade médica, texto adicional) e os 'Conteúdos dos Arquivos Anexados' para contextualizar e aprofundar sua análise.

        Você deve utilizar a ferramenta de busca do Google (Google Search) para encontrar informações médicas complementares, dados sobre doenças, tratamentos, ou artigos científicos relevantes que ajudem a compreender melhor os resultados dos exames e as condições do paciente.
        Seu objetivo é fornecer uma análise abrangente e embasada.

        **É CRUCIAL ENFATIZAR CLARAMENTE EM CADA SAÍDA:**
        "ATENÇÃO: Sou uma inteligência artificial e não um médico. Este diagnóstico ou análise é apenas para fins de curiosidade e informação. Consulte sempre um profissional de saúde qualificado para qualquer decisão médica."

        Sua resposta deve ser um resumo organizado e analítico dos principais pontos, com base nas informações fornecidas e na sua pesquisa.`;

    const filesInfoText = allFilesContent.length > 0 ? allFilesContent.map((fileData, i) =>
        `--- INÍCIO DO CONTEÚDO DO ARQUIVO ${i + 1} (${fileData.filename}) ---\n${fileData.content}\n--- FIM DO CONTEÚDO DO ARQUIVO ${i + 1} ---`
    ).join('\n') : "Nenhum arquivo anexado ou conteúdo não lido.";

    const messageText = `
        Tópico Principal/Exame: ${topico}
        Idade do Paciente: ${age || 'Não informado'}
        Sexo do Paciente: ${gender || 'Não informado'}
        Especialidade Médica Relevante: ${medicalSpecialty || 'Não informado'}
        Texto Adicional para Análise: ${additionalText || 'Nenhum'}
        
        Conteúdo dos Arquivos Anexados:
        ${filesInfoText}
        
        Data da consulta/análise: ${new Date().toLocaleDateString('pt-BR')}`; // Data de hoje

    // Para usar a ferramenta de busca do Google no Gemini API em Node.js,
    // você precisa integrar isso de forma explícita, usando `tool_code` ou
    // definindo Function Calling. É um pouco mais complexo do que a ADK do Python.
    // Para simplificar, vou manter sem tool_code aqui, mas saiba que para busca real, é necessário.
    // Se a instrução do agente fala em usar Google Search, você precisará implementar a chamada a ferramenta
    // de busca (ex: via uma função que faça a request para a Google Search API) e passá-la ao modelo.
    // Por enquanto, o modelo pode "simular" a busca com base em seu conhecimento, mas não fará uma busca real.
    const tools = []; // Adicione definições de ferramentas aqui se for usar Function Calling.

    return await callAgent(agentInstruction, messageText, tools);
}

// ... Implemente agentePlanejador, agenteRedator, agenteRevisor de forma similar em JavaScript ...
// Por simplicidade, vou apenas mockar as respostas para o exemplo.
async function agentePlanejador(topico, analiseInicial) { return "Plano gerado com base na análise inicial."; }
async function agenteRedator(topico, plano) { return "Rascunho do relatório médico pronto."; }
async function agenteRevisor(topico, rascunho) { return "Parecer final revisado: Tudo ok!"; }


// --- ROTA PRINCIPAL ---
app.post('/generate-post', upload.any(), async (req, res) => { // Use upload.any() para múltiplos arquivos
    const { topic, age, gender, medicalSpecialty, additionalText } = req.body;

    if (!topic) {
        return res.status(400).json({ error: "Topic is required" });
    }

    // Processar os arquivos enviados
    const allFilesContent = [];
    if (req.files && req.files.length > 0) {
        for (const file of req.files) {
            let extractedContent = '';
            if (file.mimetype === 'application/pdf') {
                extractedContent = await extractTextFromPdfBuffer(file.buffer);
            } else if (file.mimetype === 'text/plain' || file.mimetype === 'text/markdown') {
                extractedContent = file.buffer.toString('utf8');
            } else {
                extractedContent = `Tipo de arquivo não suportado para extração de texto: '${file.originalname}'`;
            }
            allFilesContent.push({
                filename: file.originalname,
                content: extractedContent
            });
        }
    }

    try {
        const analiseMedicaInicial = await agenteBuscador(topic, age, gender, medicalSpecialty, additionalText, allFilesContent);
        const planoDeRelatorio = await agentePlanejador(topic, analiseMedicaInicial);
        const rascunhoDeRelatorio = await agenteRedator(topic, planoDeRelatorio);
        const parecerFinalRevisado = await agenteRevisor(topic, rascunhoDeRelatorio);

        return res.json({
            buscador_output: analiseMedicaInicial,
            planejador_output: planoDeRelatorio,
            redator_output: rascunhoDeRelatorio,
            revisor_output: parecerFinalRevisado
        });

    } catch (error) {
        console.error("Erro durante a execução dos agentes:", error);
        return res.status(500).json({ error: `Ocorreu um erro: ${error.message}` });
    }
});


app.listen(port, () => {
    console.log(`Servidor rodando em http://localhost:${port}`);
});