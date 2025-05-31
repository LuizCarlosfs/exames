from flask import Flask, request, jsonify
from flask_cors import CORS
import os
from datetime import date
from google.adk.agents import Agent
from google.adk.runners import Runner
from google.adk.sessions import InMemorySessionService
from google.adk.tools import google_search
from google.genai import types
import textwrap
import warnings
import PyPDF2 # Importar PyPDF2 para ler PDFs
from dotenv import load_dotenv # Importar para carregar variáveis de ambiente

warnings.filterwarnings("ignore")

app = Flask(__name__)
CORS(app)

load_dotenv() # Carrega as variáveis de ambiente do arquivo .env

# Certifique-se de que sua GOOGLE_API_KEY está configurada no seu ambiente
# Remova a linha abaixo se você estiver usando .env ou variáveis de ambiente externas
# os.environ["GOOGLE_API_KEY"] = "SUA_CHAVE_AQUI" # COLOQUE SUA CHAVE AQUI, OU USE .env

from google import genai
try:
    client = genai.Client(api_key=os.getenv("GOOGLE_API_KEY"))
except Exception as e:
    print(f"Erro ao inicializar o cliente GenAI. Verifique sua GOOGLE_API_KEY: {e}")

MODEL_ID = "gemini-2.0-flash"

def call_agent(agent: Agent, message_text: str) -> str:
    session_service = InMemorySessionService()
    session = session_service.create_session(app_name=agent.name, user_id="user1", session_id="session1")
    runner = Runner(agent=agent, app_name=agent.name, session_service=session_service)
    content = types.Content(role="user", parts=[types.Part(text=message_text)])

    final_response = ""
    for event in runner.run(user_id="user1", session_id="session1", new_message=content):
        if event.is_final_response():
          for part in event.content.parts:
            if part.text is not None:
              final_response += part.text
              final_response += "\n"
    return final_response

# --- FUNÇÕES DOS AGENTES ---

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


# AGENTE 1: ANALISADOR/BUSCADOR DE INFORMAÇÕES MÉDICAS
def agente_buscador(topico, age, gender, medical_specialty, additional_text, all_files_content, data_de_hoje):
    buscador = Agent(
        name="agente_analisador_medico",
        model=MODEL_ID,
        instruction=f"""
        Você é um médico com muitos anos de experiência e um especialista em medicina.
        Sua principal tarefa é analisar detalhadamente as informações de exames fornecidas no 'Tópico Principal/Exame'.
        Use as informações adicionais do paciente (idade, sexo, especialidade médica, texto adicional) e os 'Conteúdos dos Arquivos Anexados' para contextualizar e aprofundar sua análise.

        Você deve utilizar a ferramenta de busca do Google (google_search) para encontrar informações médicas complementares, dados sobre doenças, tratamentos, ou artigos científicos relevantes que ajudem a compreender melhor os resultados dos exames e as condições do paciente.

        Seu objetivo é fornecer uma análise abrangente e embasada. Não invente informações ou faça diagnósticos diretos. Foque em:
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
        """,
        description="Agente que analisa informações médicas fornecidas pelo usuário.",
        tools=[google_search]
    )

    # Constrói a mensagem de entrada para o agente com todas as informações
    # Inclui o conteúdo de todos os arquivos
    files_info_text = "\n".join([
        f"--- INÍCIO DO CONTEÚDO DO ARQUIVO {i+1} ({file_data['filename']}) ---\n{file_data['content']}\n--- FIM DO CONTEÚDO DO ARQUIVO {i+1} ---"
        for i, file_data in enumerate(all_files_content)
    ]) if all_files_content else "Nenhum arquivo anexado ou conteúdo não lido."


    entrada_do_agente_buscador = textwrap.dedent(f"""
    Tópico Principal/Exame: {topico}
    Idade do Paciente: {age if age else 'Não informado'}
    Sexo do Paciente: {gender if gender else 'Não informado'}
    Especialidade Médica Relevante: {medical_specialty if medical_specialty else 'Não informado'}
    Texto Adicional para Análise: {additional_text if additional_text else 'Nenhum'}
    
    Conteúdo dos Arquivos Anexados:
    {files_info_text}
    
    Data da consulta/análise: {data_de_hoje}
    """)

    analise_medica_inicial = call_agent(buscador, entrada_do_agente_buscador)
    return analise_medica_inicial

# AGENTE 2: PLANEJADOR DE RELATÓRIO/PARECER MÉDICO (Adaptação)
def agente_planejador(topico_original, analise_medica_inicial):
    planejador = Agent(
        name="agente_planejador_relatorio_medico",
        model=MODEL_ID,
        instruction=f"""
        Você é um planejador de conteúdo médico. Com base na 'Análise Médica Inicial' fornecida pelo Agente 1,
        crie um plano detalhado para um parecer ou relatório médico.
        O plano deve incluir as seguintes seções bem definidas:
        1.  **Resumo dos Dados do Paciente e Exames:** Onde serão apresentadas as informações principais fornecidas.
        2.  **Análise dos Achados Principais:** Detalhar as observações mais relevantes da análise médica.
        3.  **Informações Complementares da Pesquisa (se houver):** Integrar dados relevantes encontrados pelo Agente 1 via google_search.
        4.  **Considerações Finais e Observações:** Um espaço para conclusões cautelosas e a **ênfase obrigatória** sobre a natureza da análise (IA, não substitui médico).

        Seu objetivo é organizar o conteúdo de forma lógica e clara para a redação do parecer final.
        """,
        description="Agente que planeja a estrutura de um parecer/relatório médico.",
    )
    entrada_do_agente_planejador = f"Tópico Original: {topico_original}\nAnálise Médica Inicial: {analise_medica_inicial}"
    plano_do_relatorio = call_agent(planejador, entrada_do_agente_planejador)
    return plano_do_relatorio

# AGENTE 3: REDATOR DO RELATÓRIO/PARECER MÉDICO (Adaptação)
def agente_redator(topico_original, plano_de_relatorio):
    redator = Agent(
        name="agente_redator_relatorio_medico",
        model=MODEL_ID,
        instruction=f"""
            Você é um Redator Médico com experiência em criar relatórios e pareceres médicos claros, objetivos e profissionais.
            Utilize o 'Plano de Relatório' fornecido para escrever um rascunho completo de um parecer/relatório médico.
            **Mantenha um tom estritamente profissional e informativo.**
            **É ABSOLUTAMENTE ESSENCIAL INCLUIR NO INÍCIO OU FINAL DO PARECER A SEGUINTE NOTA:**
            "ATENÇÃO: Este parecer foi gerado por Inteligência Artificial e não substitui a consulta, diagnóstico ou tratamento médico por um profissional de saúde qualificado. É apenas para fins informativos e de curiosidade."

            Não faça diagnósticos diretos nem prescreva tratamentos. Apenas compile e apresente as informações de forma estruturada conforme o plano.
            """,
        description="Agente redator de pareceres/relatórios médicos."
    )
    entrada_do_agente_redator = f"Tópico Original: {topico_original}\nPlano de Relatório: {plano_de_relatorio}"
    rascunho_do_relatorio = call_agent(redator, entrada_do_agente_redator)
    return rascunho_do_relatorio

# AGENTE 4: REVISOR DE QUALIDADE DO RELATÓRIO/PARECER MÉDICO (Adaptação)
def agente_revisor(topico_original, rascunho_gerado):
    revisor = Agent(
        name="agente_revisor_medico_final",
        model=MODEL_ID,
        instruction=f"""
            Você é um Editor e Revisor de Conteúdo médico meticuloso, com foco em clareza, precisão e adequação ética.
            Revise o rascunho do parecer/relatório médico abaixo sobre o 'Tópico Original', verificando:
            1.  **Clareza e Concisão:** O texto é fácil de entender e vai direto ao ponto?
            2.  **Precisão:** As informações estão corretas com base no que foi fornecido (sem inventar dados)?
            3.  **Aviso Legal:** Verifique se o aviso legal sobre ser uma IA (e não um substituto médico) está presente e em destaque. Se não estiver, adicione-o no início ou final do texto final.
            4.  **Não Diagnóstico/Tratamento:** Garanta que não há diagnósticos diretos, prescrições de tratamento ou conselhos médicos explícitos.
            5.  **Gramática e Formatação:** Corrija quaisquer erros gramaticais, de ortografia ou formatação.

            Se o rascunho estiver pronto e atender a todos os critérios (especialmente o aviso legal e a ausência de diagnóstico direto), responda apenas:
            'O parecer está ótimo e pronto para ser revisado por um profissional humano!'

            Caso haja problemas, aponte-os e sugira melhorias.
            Em todos os casos, antes de transcrever o texto final revisado, coloque a frase:
            ***Texto final revisado:***
            """,
        description="Agente revisor de pareceres/relatórios médicos, com foco ético e legal."
    )
    entrada_do_agente_revisor = f"Tópico Original: {topico_original}\nRascunho: {rascunho_gerado}"
    texto_revisado = call_agent(revisor, entrada_do_agente_revisor)
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
    for key, file in request.files.items():
        if key.startswith('file'): # Verifica se a chave corresponde ao padrão de nomeação
            extracted_content = extract_text_from_file(file)
            all_files_content.append({
                'filename': file.filename,
                'content': extracted_content
            })

    try:
        if not client:
             return jsonify({"error": "GenAI Client not initialized. Check API Key."}), 500

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
    if not os.getenv("GOOGLE_API_KEY"):
        print("ERRO: A variável de ambiente GOOGLE_API_KEY não está configurada.")
        print("Defina-a no seu arquivo .env ou diretamente no ambiente.")
    else:
        app.run(port=5000, debug=True)