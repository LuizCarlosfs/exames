
# Appy.py - 02/06/2025
from flask import Flask, request, jsonify
from flask_cors import CORS
import os
from datetime import date
# REMOVIDAS: from google.adk.agents import Agent
# REMOVIDAS: from google.adk.runners import Runner
# REMOVIDAS: from google.adk.sessions import InMemorySessionService
# REMOVIDA: from google.adk.tools import Google Search
# REMOVIDA: from google.genai import types # Não é mais necessário para este padrão
import textwrap
import warnings
import PyPDF2 # Importar PyPDF2 para ler PDFs
from dotenv import load_dotenv # Importar para carregar variáveis de ambiente

warnings.filterwarnings("ignore")


app = Flask(__name__)

@app.route('/')
def home():
    """
    Rota inicial para verificar se o backend está funcionando.
    """
    return "Bem-vindo ao Backend do Gerador de Posts de IA! Acesse /generate-post para usar a API."

# ... (Suas outras rotas, como @app.route('/generate-post', methods=['POST'])) ...

#CORS(app, resources={r"/*": {"origins": "https://luizcarlosfs.github.io"
}})

# CORS(app, resources={r"/*": {"origins": [
#     "http://localhost:3000",
#     "https://luizcarlosfs.github.io"
# ]}})
CORS(app, resources={r"/*": {"origins": [
    "http://localhost:3000",
    "https://luizcarlosfs.github.io",
    "*" # Adicione o curinga aqui para permitir todas as outras origens
]}})

load_dotenv() # Carrega as variáveis de ambiente do arquivo .env

from google import generativeai as genai

# Configura a chave da API do Google Gemini
try:
    genai.configure(api_key=os.getenv("GOOGLE_API_KEY"))
except Exception as e:
    print(f"Erro ao configurar a API Key do GenAI: {e}")
    # Se a chave da API não estiver configurada, o app não vai funcionar.
    # Considere encerrar o app ou lidar com isso de forma mais robusta.
    # exit()

# Não há um 'client' global como antes com a ADK.
# Os modelos são acessados diretamente via genai.GenerativeModel ou dentro das funções dos agentes.

MODEL_ID = "gemini-1.5-flash-latest" # Sugestão: use 'gemini-1.5-flash-latest' ou 'gemini-1.5-pro-latest' para acesso a recursos mais recentes como context window maior. Ou 'gemini-2.0-flash' se for um modelo específico.

# --- FUNÇÃO AUXILIAR PARA CHAMAR O MODELO GEMINI ---
# Esta função substitui a lógica do ADK Runner

# --- FUNÇÃO AUXILIAR PARA CHAMAR O MODELO GEMINI ---
def call_gemini_model(instruction_text: str, user_input_text: str, model_id: str) -> str:
    """
    Chama o modelo Gemini com uma instrução de sistema e um texto de entrada do usuário.
    """
    # Cria uma instância do modelo GenerativeModel
    model_instance = genai.GenerativeModel(model_id) # MUDANÇA AQUI
    
    # Combine a instrução do "agente" com a entrada do usuário para formar o prompt completo.
    full_prompt_content = textwrap.dedent(f"""
    {instruction_text}
    
    --- INÍCIO DA ENTRADA DO USUÁRIO ---
    {user_input_text}
    --- FIM DA ENTRADA DO USUÁRIO ---
    """)

    try:
        response = model_instance.generate_content(full_prompt_content)
        return response.text
    except Exception as e:
        print(f"Erro na chamada do modelo Gemini: {e}")
        return f"Erro interno do modelo: {e}. Verifique os logs do backend."


# --- FUNÇÃO PARA EXTRAIR TEXTO DE ARQUIVOS ---
def extract_text_from_file(file):
    """Extrai texto de um objeto de arquivo (FileStorage)."""
    if file.filename.lower().endswith('.pdf'):
        try:
            reader = PyPDF2.PdfReader(file.stream)
            text = ""
            for page_num in range(len(reader.pages)):
                text += reader.pages[page_num].extract_text()
            return text
        except Exception as e:
            return f"Erro ao processar PDF '{file.filename}': {e}"
    elif file.filename.lower().endswith(('.txt', '.md')):
        try:
            return file.read().decode('utf-8')
        except Exception as e:
            return f"Erro ao processar arquivo de texto '{file.filename}': {e}"
    else:
        return f"Tipo de arquivo não suportado para extração de texto: '{file.filename}'"

# --- FUNÇÕES DOS AGENTES (AGORA CHAMANDO DIRETAMENTE O MODELO GEMINI) ---

# AGENTE 1: ANALISADOR/BUSCADOR DE INFORMAÇÕES MÉDICAS
def agente_buscador(topico, age, gender, medical_specialty, additional_text, all_files_content, data_de_hoje):
    # A instrução do agente agora é uma string
    instruction_buscador = """
     Você é um médico com muitos anos de experiência e um especialista em medicina.
        Sua principal tarefa é analisar detalhadamente as informações de exames fornecidas no 'Tópico Principal/Exame'.
        Use as informações adicionais do paciente (idade, sexo, especialidade médica, texto adicional) e os 'Conteúdos dos Arquivos Anexados' para contextualizar e aprofundar sua análise.
      
        Você deve considerar a busca por informações médicas complementares, dados sobre doenças, tratamentos, ou artigos científicos relevantes que ajudem a compreender melhor os resultados dos exames e as condições do paciente. Embora eu não tenha acesso direto à internet para fazer buscas, você pode simular a consulta a conhecimentos médicos aprofundados com base na sua vasta base de dados.
            
        Seu objetivo é fornecer uma análise abrangente e embasada. Não invente informações. Foque em:
        1.  **Contextualização dos Dados:** Relacione os dados do paciente com as informações dos exames.
        2.  **Busca de Informações Relevantes:** Utilize a ferramenta google_search para encontrar dados adicionais que possam enriquecer sua análise.
        3.  **Organização Clara:** Estruture sua resposta de forma lógica, com seções claras e objetivas.   
        4.  **Ênfase Ética e Legal:** É fundamental que você deixe claro que:
        1.  **Você é uma inteligência artificial e não um médico humano.**      
        2.  **Este diagnóstico ou análise é apenas para fins de curiosidade e informação.**
        3.  **Sempre consulte um profissional de saúde qualificado para qualquer decisão médica.**  


        **É CRUCIAL ENFATIZAR CLARAMENTE EM CADA SAÍDA:**
        "ATENÇÃO: Sou uma inteligência artificial e não um médico. Este diagnóstico ou análise é apenas para fins de curiosidade e informação. Consulte sempre um profissional de saúde qualificado para qualquer decisão médica."

        Sua resposta deve ser um resumo organizado e analítico dos principais pontos, com base nas informações fornecidas e na sua pesquisa.
    """

    # Constrói a mensagem de entrada para o agente com todas as informações
    files_info_text = "\n".join([
        f"--- INÍCIO DO CONTEÚDO DO ARQUIVO {i+1} ({file_data['filename']}) ---\n{file_data['content']}\n--- FIM DO CONTEÚDO DO ARQUIVO {i+1} ---"
        for i, file_data in enumerate(all_files_content)
    ]) if all_files_content else "Nenhum arquivo anexado ou conteúdo não lido."

    user_input_for_buscador = textwrap.dedent(f"""
    Tópico Principal/Exame: {topico}
    Idade do Paciente: {age if age else 'Não informado'}
    Sexo do Paciente: {gender if gender else 'Não informado'}
    Especialidade Médica Relevante: {medical_specialty if medical_specialty else 'Não informado'}
    Texto Adicional para Análise: {additional_text if additional_text else 'Nenhum'}
    
    Conteúdo dos Arquivos Anexados:
    {files_info_text}
    
    Data da consulta/análise: {data_de_hoje}
    """)

    # Chamada para o modelo Gemini
    analise_medica_inicial = call_gemini_model(instruction_buscador, user_input_for_buscador, MODEL_ID)
    return analise_medica_inicial

# AGENTE 2: PLANEJADOR DE RELATÓRIO/PARECER MÉDICO
def agente_planejador(topico_original, analise_medica_inicial):
    instruction_planejador = """
    Você é um planejador de conteúdo médico. Com base na 'Análise Médica Inicial' fornecida,
    crie um plano detalhado para um parecer ou relatório médico.
    O plano deve incluir as seguintes seções bem definidas:
    1.  **Resumo dos Dados do Paciente e Exames:** Onde serão apresentadas as informações principais fornecidas.
    2.  **Análise dos Achados Principais:** Detalhar as observações mais relevantes da análise médica.
    3.  **Informações Complementares da Pesquisa (se houver):** Integrar dados relevantes encontrados pelo Agente 1 (simulando pesquisa).
    4.  **Considerações Finais e Observações:** Um espaço para conclusões cautelosas e a **ênfase obrigatória** sobre a natureza da análise (IA, não substitui médico).

    Seu objetivo é organizar o conteúdo de forma lógica e clara para a redação do parecer final.
    """
    user_input_for_planejador = f"Tópico Original: {topico_original}\nAnálise Médica Inicial: {analise_medica_inicial}"
    plano_do_relatorio = call_gemini_model(instruction_planejador, user_input_for_planejador, MODEL_ID)
    return plano_do_relatorio

# AGENTE 3: REDATOR DO RELATÓRIO/PARECER MÉDICO
def agente_redator(topico_original, plano_de_relatorio):
    instruction_redator = """
    Você é um Redator Médico com experiência em criar relatórios e pareceres médicos claros, objetivos e profissionais.
    Utilize o 'Plano de Relatório' fornecido para escrever um rascunho completo de um parecer/relatório médico.
    **Mantenha um tom estritamente profissional e informativo.**
    **É ABSOLUTAMENTE ESSENCIAL INCLUIR NO INÍCIO OU FINAL DO PARECER A SEGUINTE NOTA:**
    "ATENÇÃO: Este parecer foi gerado por Inteligência Artificial e não substitui a consulta, diagnóstico ou tratamento médico por um profissional de saúde qualificado. É apenas para fins informativos e de curiosidade."

    Não faça diagnósticos diretos nem prescreva tratamentos. Apenas compile e apresente as informações de forma estruturada conforme o plano.
    """
    user_input_for_redator = f"Tópico Original: {topico_original}\nPlano de Relatório: {plano_de_relatorio}"
    rascunho_do_relatorio = call_gemini_model(instruction_redator, user_input_for_redator, MODEL_ID)
    return rascunho_do_relatorio

# AGENTE 4: REVISOR DE QUALIDADE DO RELATÓRIO/PARECER MÉDICO
def agente_revisor(topico_original, rascunho_gerado):
    instruction_revisor = """
    Você é um Editor e Revisor de Conteúdo médico meticuloso, com foco em clareza, precisão e adequação ética.
    Revise o rascunho do parecer/relatório médico abaixo sobre o 'Tópico Original', verificando:
    1.  **Clareza e Concisão:** O texto é fácil de entender e vai direto ao ponto?
    2.  **Precisão:** As informações estão corretas com base no que foi fornecido (sem inventar dados)?
    3.  **Aviso Legal:** Verifique se o aviso legal sobre ser uma IA (e não um substituto médico) está presente e em destaque. Se não estiver, adicione-o no início ou final do texto final.
    4.  **Não Diagnóstico/Tratamento:** Garanta que não há diagnósticos diretos, prescrições de tratamento ou conselhos médicos explícitos.
    5.  **Gramática e Formatação:** Corrija quaisquer erros gramaticais, de ortografia ou formatação.
    6.  **GARANTIR QUE O TEXTO FINAL TENHA QUEBRAS DE LINHA E PARÁGRAFOS BEM DEFINIDOS PARA UMA EXCELENTE LEGIBILIDADE.**

    Caso haja problemas, aponte-os e sugira melhorias.
    Em todos os casos, antes de transcrever o texto final revisado, coloque a frase:
    ***Texto final revisado:***
    """
    user_input_for_revisor = f"Tópico Original: {topico_original}\nRascunho: {rascunho_gerado}"
    texto_revisado = call_gemini_model(instruction_revisor, user_input_for_revisor, MODEL_ID)
    return texto_revisado

# --- ROTA PRINCIPAL DA API ---

@app.route('/generate-post', methods=['POST'])
def generate_post():
    topico = request.form.get('topic')
    age = request.form.get('age')
    gender = request.form.get('gender')
    medical_specialty = request.form.get('medicalSpecialty')
    additional_text = request.form.get('additionalText')

    data_de_hoje = date.today().strftime("%d/%m/%Y")

    if not topico:
        return jsonify({"error": "Topic is required"}), 400

    # Coleciona o conteúdo de TODOS os arquivos
    all_files_content = []
    # Itera sobre os arquivos nomeados 'file0', 'file1', etc.
    # request.files é um ImmutableMultiDict, que contém todos os arquivos enviados
    for key, file in request.files.items():
        # O frontend envia os arquivos como 'file0', 'file1', etc.
        # Mas o Flask pode recebê-los com o nome original do campo no formulário.
        # Para ser mais robusto, podemos iterar sobre todos os arquivos que não são outros campos.
        # No entanto, se você está usando a lógica do TopicForm.js, eles virão como 'fileX'.
        if key.startswith('file'):
            extracted_content = extract_text_from_file(file)
            all_files_content.append({
                'filename': file.filename,
                'content': extracted_content
            })

    try:
     
        # Passa a lista de conteúdos dos arquivos para o agente_buscador
        analise_medica_inicial = agente_buscador(topico, age, gender, medical_specialty, additional_text, all_files_content, data_de_hoje)

        plano_de_relatorio = agente_planejador(topico, analise_medica_inicial)
        rascunho_de_relatorio = agente_redator(topico, plano_de_relatorio)
        parecer_final_revisado = agente_revisor(topico, rascunho_de_relatorio)

        return jsonify({
            "buscador_output": analise_medica_inicial,
            "planejador_output": plano_de_relatorio,
            "redator_output": rascunho_de_relatorio,
            "revisor_output": parecer_final_revisado
        })

    except Exception as e:
        import traceback
        print(f"Error during agent execution: {e}\n{traceback.format_exc()}")
        return jsonify({"error": f"An error occurred: {str(e)}"}), 500

if __name__ == '__main__':
     # Este bloco só é executado quando você roda `python App.py` localmente
    # e não será usado pelo Gunicorn no Render.
    if not os.getenv("GOOGLE_API_KEY"):
        print("ERRO: A variável de ambiente GOOGLE_API_KEY não está configurada.")
        print("Defina-a no seu arquivo .env ou diretamente no ambiente.")
    else:
        app.run(port=5000, debug=True)