// Arquivo: evolucao-script.js (VERSÃO FINAL, COMPLETA E VALIDADA)

import { GoogleGenerativeAI } from "https://esm.run/@google/generative-ai";

// ===================================================================
// SEÇÃO 1: LÓGICA DE ANÁLISE DE PDF COM IA E FUNÇÕES GLOBAIS
// ===================================================================

const API_KEY = "AIzaSyCte3YxurHgEDG-NJO755VJ7lfczziVTME"; // <<<<<<< COLOQUE SUA API KEY AQUI
const genAI = new GoogleGenerativeAI(API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro-latest" });

const synonymMap = {
    'RELAÇÃO': 'RNI', 'INR': 'RNI', 'TTPA': 'TEMPO DE TROMBOPLASTINA PARCIAL',
    'PROTEINA C REATIVA': 'PCR', 'PROTEÍNA C REATIVA': 'PCR', 'PROTEINA C REATIVA QUANTITATIVA': 'PCR', 'PROTEÍNA C REATIVA QUANTITATIVA': 'PCR',
    'V.C.M.': 'VCM', 'V.C.M': 'VCM', 'H.C.M.': 'HCM', 'H.C.M': 'HCM', 'C.H.C.M.': 'CHCM', 'C.H.C.M': 'CHCM',
    'ÍNDICE DE ANISOCITOSE (RDW)': 'RDW', 'INDICE_DE_ANISOCITOSE_RDW': 'RDW',
    'ALBUMINA, DOSAGEM': 'ALBUMINA', 'ALBUMINA DOSAGEM': 'ALBUMINA',
    'CONTAGEM DE PLAQUETAS': 'PLAQUETAS', 'CÁLCIO': 'CÁLCIO TOTAL', 'CÁLCIO SÉRICO': 'CÁLCIO TOTAL', 'URÉIA': 'UREIA',
    'TRANSAMINASE OXALACETICA (TGO)': 'TGO', 'TRANSAMINASE_OXALACETICA_TGO': 'TGO',
    'TRANSAMINASE PIRUVICA (TGP)': 'TGP', 'TRANSAMINASE_PIRUVICA_TGP': 'TGP',
    'VOLUME_PLAQUETARIO_M.P.V.': 'VPM', 'VOLUME_PLAQUETARIO_MPV': 'VPM'
};

async function processPdfFile(file) {
    try {
        if (!window.pdfjsLib) { throw new Error("Biblioteca PDF.js não carregada."); }
        pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.11.338/pdf.worker.min.js`;
        const fileReader = new FileReader();
        const pdfData = await new Promise((resolve, reject) => { fileReader.onload = (e) => resolve(new Uint8Array(e.target.result)); fileReader.onerror = (err) => reject(new Error(`Erro ao ler o arquivo: ${err.message}`)); fileReader.readAsArrayBuffer(file); });
        const pdf = await pdfjsLib.getDocument({ data: pdfData }).promise;
        let textContent = '';
        for (let i = 1; i <= pdf.numPages; i++) { const page = await pdf.getPage(i); const text = await page.getTextContent(); textContent += text.items.map(item => item.str).join(' '); }
        if (!textContent.trim()) throw new Error('O PDF parece estar vazio ou contém apenas imagens.');
        const prompt = `Você é um especialista em análise de laudos laboratoriais. Sua tarefa é extrair todos os exames de um texto e retorná-los em um objeto JSON plano. REGRAS ESTRITAS: 1. JSON de Saída: O JSON deve ter uma chave "exames" e uma chave "dataHora". 2. REGRA DE DATA E HORA: Encontre a data e a hora do laudo. Combine-as no formato "DD/MM/AAAA HH:mm". Se a hora não for encontrada, use "00:00". Se a data não for encontrada, retorne "dataHora": "". A chave "dataHora" deve sempre existir. 3. Resultados: O valor de cada exame deve ser uma string. 4. Nomes das Chaves: Use sempre letras maiúsculas e sem acentos. Exemplo de saída perfeita: {"dataHora": "25/06/2025 14:30", "exames": {"HEMOGLOBINA": "14.5", "LEUCOCITOS": "8500"}}. Texto do Laudo para Análise: --- ${textContent} ---`;
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const jsonText = response.text().replace(/```json|```/g, '').trim();
        const parsedData = JSON.parse(jsonText);
        return { status: "success", data: parsedData };
    } catch (error) {
        console.error(`Falha ao processar o arquivo "${file.name}":`, error);
        return { status: "error", message: `Arquivo "${file.name}" (${error.message})` };
    }
}
function parseDateTime(dateTimeString) { if (!dateTimeString || !dateTimeString.includes('/')) return null; const [datePart, timePart] = dateTimeString.split(' '); const [day, month, year] = datePart.split('/'); const [hours, minutes] = timePart ? timePart.split(':') : [0, 0]; const dateObject = new Date(+year, +month - 1, +day, +hours, +minutes); if (isNaN(dateObject.getTime())) { return null; } return dateObject; }
function calculateEgfr(creatinine, age, sex) { if (!creatinine || !age || !sex) return 'N/A'; const creatNum = parseFloat(String(creatinine).replace(',', '.')); if (isNaN(creatNum)) return 'N/A'; const k = (sex === 'Feminino') ? 0.7 : 0.9; const alpha = (sex === 'Feminino') ? -0.241 : -0.302; const sexFactor = (sex === 'Feminino') ? 1.012 : 1; return (142 * Math.pow(Math.min(creatNum / k, 1), alpha) * Math.pow(Math.max(creatNum / k, 1), -1.200) * Math.pow(0.9938, age) * sexFactor).toFixed(0); }
function renderAggregatedTable(results) {
    const allDateTimes = [...new Set(results.map(r => r.data.dataHora).filter(d => d))].sort((a, b) => parseDateTime(a) - parseDateTime(b));
    const dataByDateTime = {};
    results.forEach(res => { if (res.data.dataHora) { const normalizedExams = {}; for (const key in res.data.exames) { const upperKey = key.trim().toUpperCase(); const standardName = synonymMap[upperKey] || upperKey; normalizedExams[standardName] = res.data.exames[key]; } dataByDateTime[res.data.dataHora] = { ...(dataByDateTime[res.data.dataHora] || {}), ...normalizedExams }; } });
    let dynamicPriorityOrder = []; const firstResultData = results.find(r => r.status === 'success')?.data; if (firstResultData && firstResultData.exames) { dynamicPriorityOrder = Object.keys(firstResultData.exames).map(key => { const upperKey = key.trim().toUpperCase(); return synonymMap[upperKey] || upperKey; }); }
    const allExamNames = [...new Set(results.flatMap(r => Object.keys(r.data.exames || {}).map(key => synonymMap[key.toUpperCase()] || key.toUpperCase())))];
    allExamNames.sort((a, b) => { const indexA = dynamicPriorityOrder.indexOf(a); const indexB = dynamicPriorityOrder.indexOf(b); if (indexA !== -1 && indexB !== -1) return indexA - indexB; if (indexA !== -1) return -1; if (indexB !== -1) return 1; return a.localeCompare(b); });
    let tableHTML = '<table><thead><tr><th>Exame</th>';
    allDateTimes.forEach(dateTime => tableHTML += `<th>${dateTime}</th>`);
    tableHTML += '</tr></thead><tbody>';
    allExamNames.forEach(rowName => { const hasValue = allDateTimes.some(dateTime => dataByDateTime[dateTime] && dataByDateTime[dateTime][rowName] !== undefined); if (!hasValue) return; tableHTML += `<tr><td>${rowName}</td>`; allDateTimes.forEach(dateTime => { const value = (dataByDateTime[dateTime] && dataByDateTime[dateTime][rowName]) || ''; tableHTML += `<td>${value}</td>`; }); tableHTML += '</tr>'; });
    tableHTML += '</tbody></table>';
    return tableHTML;
}

// ===================================================================
// SEÇÃO 2: LÓGICA DA PÁGINA DE EVOLUÇÃO MÉDICA
// ===================================================================
const form = document.getElementById('evolucaoForm');
const resultadoContainer = document.getElementById('resultadoContainer');
const evolucaoGerada = document.getElementById('evolucaoGerada');
const fileInput = document.getElementById('espelhoExames');
const fileListContainer = document.getElementById('fileListContainer');
const statusDisplay = document.getElementById('processingStatus');
const loadEvolutionButton = document.getElementById('loadEvolutionButton');
const loadEvolutionInput = document.getElementById('loadEvolutionInput');

let formDataCache = null;
let selectedPdfFiles = []; 

if (!form) {
    console.error("ERRO CRÍTICO: Formulário 'evolucaoForm' não foi encontrado.");
} else {

    function setupConditionalLogic() {
        document.querySelectorAll('input[name="ventilacao"]').forEach(radio => { radio.addEventListener('change', e => { document.getElementById('ventilacao_cn_options').classList.toggle('hidden', e.target.value !== 'Cateter Nasal'); document.getElementById('ventilacao_mascara_options').classList.toggle('hidden', e.target.value !== 'Máscara'); const isVm = e.target.value === 'Mecânica' || e.target.value === 'VNI'; document.getElementById('ventilacao_vm_options').classList.toggle('hidden', !isVm); }); });
        document.getElementById('glasgow_na')?.addEventListener('change', e => document.getElementById('glasgow_details').classList.toggle('hidden', e.target.checked));
        document.getElementById('abdome_outro_check')?.addEventListener('change', e => document.getElementById('abdome_outro_text').classList.toggle('hidden', !e.target.checked));
        document.getElementById('sopro_check')?.addEventListener('change', e => document.getElementById('sopro_desc').classList.toggle('hidden', !e.target.checked));
        document.querySelectorAll('input[name="dieta_intercorrencia_check"]').forEach(radio => { radio.addEventListener('change', e => document.getElementById('dieta_intercorrencia_desc_group').classList.toggle('hidden', e.target.value !== 'Sim')); });
        document.getElementById('tev_outro_check')?.addEventListener('change', e => document.getElementById('tev_outro_desc').classList.toggle('hidden', !e.target.checked));
        document.getElementById('lamg_outro_check')?.addEventListener('change', e => document.getElementById('lamg_outro_desc').classList.toggle('hidden', !e.target.checked));
        document.querySelectorAll('.ap_conditional_check').forEach(check => { check.addEventListener('change', () => { const showDetails = Array.from(document.querySelectorAll('.ap_conditional_check')).some(c => c.checked); document.getElementById('ap_details_group').classList.toggle('hidden', !showDetails); }); });
        document.querySelectorAll('input[name="secrecao_presente"]').forEach(radio => { radio.addEventListener('change', e => { document.getElementById('secrecao_details_group').classList.toggle('hidden', e.target.value !== 'Presente'); }); });
    }
    window.addDynamicInput = function(containerId, name, placeholder1, placeholder2, type2 = 'text', value1 = '', value2 = '') { const container = document.getElementById(containerId); if (!container) return; const div = document.createElement('div'); div.className = 'dynamic-input-group'; const label2 = (type2 === 'date') ? 'Data:' : ''; div.innerHTML = `<input type="text" name="${name}_nome" placeholder="${placeholder1}" value="${value1}"><label>${label2}</label><input type="${type2}" name="${name}_valor" value="${value2}"><button type="button" class="btn-remove" onclick="this.parentElement.remove()">×</button>`; container.appendChild(div); }
    window.addAntibiotico = function(nome = '', inicio = '', fim = '') { const container = document.getElementById('antibiotico-container'); if (!container) return; const div = document.createElement('div'); div.className = 'dynamic-input-group antibiotic-group'; div.innerHTML = `<input type="text" name="antibiotico_nome" placeholder="Nome do Antibiótico" value="${nome}"><label>Início:</label><input type="date" name="antibiotico_inicio" value="${inicio}"><label>Término:</label><input type="date" name="antibiotico_fim" value="${fim}"><button type="button" class="btn-remove" onclick="this.parentElement.remove()">×</button>`; container.appendChild(div); }
    window.addCulturaPendente = function(tipo = '', data = '') { const container = document.getElementById('culturas-pendentes-container'); if (!container) return; const div = document.createElement('div'); div.className = 'dynamic-input-group'; div.innerHTML = `<input type="text" name="cultura_pendente_tipo" placeholder="Tipo de Cultura (Ex: Hemocultura)" value="${tipo}"><label>Data Coleta:</label><input type="date" name="cultura_pendente_data" value="${data}"><button type="button" class="btn-remove" onclick="this.parentElement.remove()">×</button>`; container.appendChild(div); }
    window.addResultadoCultura = function(desc = '') { const container = document.getElementById('culturas-realizadas-container'); if (!container) return; const div = document.createElement('div'); div.className = 'dynamic-input-group'; div.innerHTML = `<textarea name="cultura_resultado_desc" placeholder="Descrever cultura e resultado">${desc}</textarea><button type="button" class="btn-remove" onclick="this.parentElement.remove()">×</button>`; container.appendChild(div); }
    
    function gerarHtmlEvolucao(formData, calculatedData) {
        const get = (key) => formData.get(key) || '';
        const getAll = (key) => formData.getAll(key) || [];
        const getDynamicList = (baseName, valLabel = 'Valor') => { const names = getAll(`${baseName}_nome`); if(names.length === 0 || (names.length === 1 && !names[0])) return 'Nenhum(a).'; const values = getAll(`${baseName}_valor`); return '<ul>' + names.map((name, i) => `<li><strong>${name}:</strong> ${values[i] || 'N/A'}</li>`).join('') + '</ul>'; };
        const getAntibioticList = () => { const names = getAll('antibiotico_nome'); if(names.length === 0 || (names.length === 1 && !names[0])) return 'Nenhum em uso.'; const inicios = getAll('antibiotico_inicio'); const fins = getAll('antibiotico_fim'); return '<ul>' + names.map((name, i) => `<li><strong>${name}</strong> (Início: ${inicios[i] || 'N/A'} | Término: ${fins[i] || 'N/A'})</li>`).join('') + '</ul>'; };
        const getCulturasPendentesList = () => { const tipos = getAll('cultura_pendente_tipo'); if(tipos.length === 0 || (tipos.length === 1 && !tipos[0])) return '<p>Nenhuma.</p>'; const datas = getAll('cultura_pendente_data'); return '<ul>' + tipos.map((tipo, i) => `<li><strong>${tipo}</strong> (Coletado em: ${datas[i] || 'N/A'})</li>`).join('') + '</ul>'; };
        const getResultadosCulturasList = () => { const resultados = getAll('cultura_resultado_desc'); if(resultados.length === 0 || (resultados.length === 1 && !resultados[0])) return '<p>Nenhum.</p>'; return '<ul>' + resultados.map(r => `<li>${r.replace(/\n/g, '<br>')}</li>`).join('') + '</ul>'; };
        const getCheckboxValues = (name) => { const values = getAll(name); return values.length > 0 ? values.join(', ') : 'Não avaliado'; };
        const getAuscultaCardiaca = () => { let findings = getAll('ausculta_cardiaca'); if (form.elements.sopro_check.checked) { const desc = get('sopro_desc'); findings.push(desc ? `Sopro (${desc})` : 'Sopro'); } return findings.length > 0 ? findings.join(', ') : 'Não avaliado'; };
        const getMethods = (baseName) => { let methods = getAll(`${baseName}_methods`); if(form.elements[`${baseName}_outro_check`]?.checked){ methods.push(get(`${baseName}_outro_desc`)); } return methods.length > 0 ? methods.join(', ') : 'Não descrito'; };
        const getVmParams = () => { if (get('ventilacao') !== 'Mecânica') return `<p><strong>Ventilação:</strong> ${get('ventilacao')}</p>`; return `<p><strong>Ventilação:</strong> Mecânica Invasiva (Modo: ${get('vm_modo')}, FiO₂: ${get('vm_fio2')}%, PEEP: ${get('vm_peep')}, P.Sup: ${get('vm_psup')}, VT: ${get('vm_vt')}mL, Outros: ${get('vm_outros')})</p>`; };
        const getAuscultaPulmonar = () => { let findings = []; const temDetalhes = Array.from(document.querySelectorAll('.ap_conditional_check')).some(c => c.checked); getAll('ausculta_pulmonar').forEach(achado => { if (temDetalhes && achado !== 'MV+ bilateralmente') { const lado = get('ap_lado'); const altura = get('ap_altura'); findings.push(`${achado} (Lado: ${lado || 'N/A'}, Altura: ${altura || 'N/A'})`); } else { findings.push(achado); } }); return findings.length > 0 ? findings.join('; ') : 'Não avaliado'; };
        const getSecrecaoTraqueal = () => { if (get('secrecao_presente') !== 'Presente') return 'Ausente.'; const aspectos = getAll('secrecao_aspecto').join(', '); const qtd = get('secrecao_qtd'); return `Presente - Aspecto: ${aspectos || 'N/A'}, Quantidade: ${qtd || 'N/A'}.`; };
        const getAbdomenChars = () => { let chars = getAll('abdome_carac').filter(c => c !== 'Outro' && c); if(getAll('abdome_carac').includes('Outro')){ chars.push(get('abdome_outro_desc')); } return chars.length > 0 ? chars.join(', ') : 'Não descrito.'; };
        
        let html = `<div class="report-title-bar">EVOLUÇÃO MÉDICA DIÁRIA</div><div class="report-data-row"><span class="data-item"><span class="data-label">PACIENTE:</span> ${get('nomePaciente')}</span><span class="data-item"><span class="data-label">IDADE:</span> ${get('idade')}</span><span class="data-item"><span class="data-label">LEITO:</span> ${get('leito')}</span><span class="data-item"><span class="data-label">UTI:</span> ${get('nomeUti')}</span></div><div class="report-data-row"><span class="data-item"><span class="data-label">DATA DA EVOLUÇÃO:</span> ${new Date().toLocaleString('pt-BR')}</span><span class="data-item"><span class="data-label">DIH:</span> ${get('dataInternacaoHospitalar')}</span><span class="data-item"><span class="data-label">DIH-UTI:</span> ${get('dataInternacaoUti')}</span></div><div class="report-data-row"><span class="data-item"><span class="data-label">ALTURA:</span> ${get('altura')}CM</span><span class="data-item"><span class="data-label">PESO:</span> ${get('peso')}KG</span><span class="data-item"><span class="data-label">PESO PREDITO:</span> ${calculatedData.pesoPredito}KG</span><span class="data-item"><span class="data-label">GEB:</span> ${calculatedData.geb}KCAL</span><span class="data-item"><span class="data-label">ASC:</span> ${calculatedData.asc}m²</span><span class="data-item"><span class="data-label">SOFA:</span> ${get('sofa')}</span></div><div class="report-section-final"><h2>1. Histórico</h2><p><strong>Hipótese Diagnóstica:</strong> ${get('hipoteseDiagnostica')}</p><p><strong>HPP:</strong> ${get('hpp')}</p><p><strong>Alergias:</strong> ${get('alergias')}</p></div><div class="report-section-final"><h2>2. Sinais Vitais e Balanço (24h)</h2><ul><li>PA: ${get('pasMin')}-${get('pasMax')} x ${get('padMin')}-${get('padMax')} mmHg | FC: ${get('fcMin')}-${get('fcMax')} bpm</li><li>Diurese: ${get('diurese')}mL | Balanço Hídrico: ${get('balancoHidrico')}mL</li><li>Diálise: ${get('dialise')} | Última UF: ${get('ultimaUf') || 'N/A'} mL | eGFR (CKD-EPI): ${calculatedData.clcr} mL/min/1.73m²</li></ul></div><div class="report-section-final"><h2>3. Exame Físico</h2><p><strong>Neurológico:</strong> ${get('glasgow_na') ? 'Não se aplica' : `Glasgow ${get('glasgow_total')}`}, RASS ${get('rass_na') ? 'Não se aplica' : get('rass')}. Pupilas ${get('pupilas_tamanho')}, ${get('pupilas_reatividade')}.</p><p><strong>Respiratório:</strong> Ausculta: ${getAuscultaPulmonar()}. | Secreção: ${getSecrecaoTraqueal()}</p><p><strong>Cardiovascular:</strong> Ausculta: ${getAuscultaCardiaca()}. | Pulsos: ${getCheckboxValues('pulso')}.</p><p><strong>Abdome:</strong> ${getAbdomenChars()}. | RHA: ${get('rha')}.</p><p><strong>Pele e Tegumentos:</strong> ${get('lesoesPele')}</p></div><div class="report-section-final"><h2>Dispositivos Invasivos</h2>${getDynamicList('dispositivo', 'Data')}</div><div class="report-section-final"><h2>4. Suporte e Terapias Ativas</h2>${getVmParams()}<p><strong>Suporte Hemodinâmico:</strong> ${get('hemodinamico')}</p><div class="report-therapies"><div><p><strong>Sedação:</strong></p>${getDynamicList('sedacao')}</div><div><p><strong>Analgesia:</strong></p>${getDynamicList('analgesia')}</div><div><p><strong>Drogas Vasoativas:</strong></p>${getDynamicList('dva')}</div></div><div><p><strong>Antibioticoterapia:</strong></p>${getAntibioticList()}</div><div><p><strong>Corticoides:</strong></p>${getDynamicList('corticoide', 'Início')}</div><div><p><strong>Outras Drogas:</strong></p>${getDynamicList('outras_drogas', 'Obs/Data')}</div></div><div class="report-section-final"><h2>5. Profilaxias</h2><ul><li><strong>TEV (${get('profilaxia_tev_status')}):</strong> ${getMethods('tev')}</li><li><strong>LAMG (${get('profilaxia_lamg_status')}):</strong> ${getMethods('lamg')}</li><li><strong>Lesão de Córnea (${get('profilaxia_cornea_status')}):</strong> ${get('profilaxia_cornea_desc')}</li><li><strong>Broncoaspiração (${get('profilaxia_bronco_status')}):</strong> ${get('profilaxia_bronco_desc')}</li></ul></div><div class="report-section-final"><h2>Culturas</h2><p><strong>Aguardando Resultado:</strong></p>${getCulturasPendentesList()}<p><strong>Resultados Liberados:</strong></p>${getResultadosCulturasList()}</div><div class="report-section-final"><h2>Exames de Imagem</h2><p>${get('examesImagem').replace(/\n/g, '<br>') || 'Nenhum realizado.'}</p></div><div class="report-section-final"><h2>Pareceres e Avaliações</h2><p>${get('pareceres').replace(/\n/g, '<br>') || 'Nenhum solicitado.'}</p></div>`;
        if (calculatedData.tabelaExames) { html += `<div class="report-section-final"><h2>Exames Laboratoriais</h2>${calculatedData.tabelaExames}</div>`; }
        html += `<div class="report-section-final"><h2>Conduta e Pendências</h2><p><strong>Conduta:</strong> ${get('conduta').replace(/\n/g, '<br>')}</p><p><strong>Pendências:</strong> ${get('pendencias').replace(/\n/g, '<br>')}</p></div><div class="report-section-final"><h2>Evolução e Impressão Clínica</h2><p>${get('evolucaoImpressao').replace(/\n/g, '<br>')}</p></div><div class="signature-area"><div class="signature-line">Assinatura e Carimbo do Médico</div></div>`;
        return html;
    }
    
    function renderFileList() { fileListContainer.innerHTML = ''; if (selectedPdfFiles.length === 0) { fileListContainer.innerHTML = '<p>Nenhum arquivo PDF selecionado.</p>'; return; } selectedPdfFiles.forEach((file, index) => { const fileItem = document.createElement('div'); fileItem.className = 'file-item'; fileItem.innerHTML = `<span>${file.name}</span><button class="remove-file-btn" data-index="${index}">×</button>`; fileListContainer.appendChild(fileItem); }); }
    fileInput.addEventListener('change', () => { for (const file of fileInput.files) { if (!selectedPdfFiles.some(f => f.name === file.name) && file.type === 'application/pdf') { selectedPdfFiles.push(file); } } renderFileList(); fileInput.value = ''; });
    fileListContainer.addEventListener('click', (event) => { if (event.target.classList.contains('remove-file-btn')) { const indexToRemove = parseInt(event.target.dataset.index, 10); selectedPdfFiles.splice(indexToRemove, 1); renderFileList(); } });

    loadEvolutionButton.addEventListener('click', () => { loadEvolutionInput.click(); });
    loadEvolutionInput.addEventListener('change', (event) => { const file = event.target.files[0]; if (!file || !file.name.endsWith('.json')) { if (file) alert('Por favor, selecione um arquivo .json de evolução salvo anteriormente.'); return; } const reader = new FileReader(); reader.onload = function(e) { try { const data = JSON.parse(e.target.result); form.reset(); document.querySelectorAll('.dynamic-input-group').forEach(el => el.remove()); for (const key in data) { const elements = form.elements[key]; if (!elements) continue; if (NodeList.prototype.isPrototypeOf(elements)) { elements.forEach(el => { el.checked = (el.value === data[key]); }); } else if (elements.type === 'checkbox') { if(Array.isArray(data[key])) { elements.forEach(el => { el.checked = data[key].includes(el.value); }); } else { elements.checked = !!data[key]; } } else { elements.value = data[key]; } } if(data.sedacao_dynamic) data.sedacao_dynamic.forEach(item => addDynamicInput('sedacao-container', 'sedacao', 'Droga', 'Dose', 'text', item.nome, item.valor)); if(data.analgesia_dynamic) data.analgesia_dynamic.forEach(item => addDynamicInput('analgesia-container', 'analgesia', 'Droga', 'Dose', 'text', item.nome, item.valor)); if(data.dva_dynamic) data.dva_dynamic.forEach(item => addDynamicInput('dva-container', 'dva', 'Droga', 'Dose (mcg/kg/min ou mL/h)', 'text', item.nome, item.valor)); if(data.dispositivo_dynamic) data.dispositivo_dynamic.forEach(item => addDynamicInput('dispositivos-container', 'dispositivo', 'Nome do Dispositivo', '', 'date', item.nome, item.valor)); if(data.corticoide_dynamic) data.corticoide_dynamic.forEach(item => addDynamicInput('corticoide-container', 'corticoide', 'Droga', 'Data de Início', 'date', item.nome, item.valor)); if(data.outras_drogas_dynamic) data.outras_drogas_dynamic.forEach(item => addDynamicInput('outras_drogas-container', 'outras_drogas', 'Droga', 'Observação/Data', 'text', item.nome, item.valor)); if(data.antibiotico_dynamic) data.antibiotico_dynamic.forEach(item => addAntibiotico(item.nome, item.inicio, item.fim)); if(data.culturas_pendentes_dynamic) data.culturas_pendentes_dynamic.forEach(item => addCulturaPendente(item.tipo, item.data)); if(data.culturas_realizadas_dynamic) data.culturas_realizadas_dynamic.forEach(item => addResultadoCultura(item.desc)); form.querySelectorAll('input, select, textarea').forEach(el => el.dispatchEvent(new Event('change', { bubbles: true }))); alert('Evolução anterior carregada com sucesso!'); } catch (err) { alert('Arquivo JSON inválido ou corrompido.'); console.error("Erro ao carregar JSON:", err); } }; reader.readAsText(file); event.target.value = ''; });

    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        statusDisplay.classList.remove('hidden');
        let tabelaHtmlProcessada = '';
        const calculatedData = { clcr: 'N/A', pesoPredito: 'N/A', geb: 'N/A', asc: 'N/A' };
        try {
            const idade = parseInt(form.elements.idade.value, 10); const sexo = form.elements.sexo.value; const altura = parseFloat(form.elements.altura.value); const peso = parseFloat(form.elements.peso.value);
            if (altura) { calculatedData.pesoPredito = ((sexo === 'Masculino' ? 50 : 45.5) + 0.91 * (altura - 152.4)).toFixed(2); }
            if (peso && altura && idade) { calculatedData.geb = ((sexo === 'Masculino') ? 88.362 + (13.397 * peso) + (4.799 * altura) - (5.677 * idade) : 447.593 + (9.247 * peso) + (3.098 * altura) - (4.330 * idade)).toFixed(0); }
            if (peso && altura) { calculatedData.asc = Math.sqrt((peso * altura) / 3600).toFixed(2); }

            if (selectedPdfFiles.length > 0) {
                statusDisplay.innerText = 'Analisando PDFs com IA...';
                const analysisPromises = selectedPdfFiles.map(file => processPdfFile(file));
                const analysisResults = await Promise.all(analysisPromises);
                const validResults = analysisResults.filter(r => r && r.status === "success");
                if (validResults.length > 0) {
                    tabelaHtmlProcessada = renderAggregatedTable(validResults);
                    const allDateTimes = [...new Set(validResults.map(r => r.data.dataHora).filter(d => d))].sort((a, b) => parseDateTime(a) - parseDateTime(b));
                    if (allDateTimes.length > 0) {
                        const latestDate = allDateTimes[allDateTimes.length - 1];
                        const latestExamsResult = validResults.find(r => r.data.dataHora === latestDate);
                        const creatininaKey = Object.keys(latestExamsResult?.data?.exames || {}).find(k => k.toUpperCase() === 'CREATININA');
                        const creatinina = creatininaKey ? latestExamsResult.data.exames[creatininaKey] : null;
                        if (creatinina && idade && sexo) { calculatedData.clcr = calculateEgfr(creatinina, idade, sexo); }
                    }
                } else {
                    tabelaHtmlProcessada = '<p>Não foi possível extrair dados de nenhum dos PDFs enviados.</p>';
                }
            }
            formDataCache = new FormData(form);
            const evolucaoHtml = gerarHtmlEvolucao(formDataCache, { tabelaExames: tabelaHtmlProcessada, ...calculatedData }); 
            evolucaoGerada.innerHTML = evolucaoHtml;
            form.style.display = 'none';
            resultadoContainer.classList.remove('hidden');
            window.scrollTo(0, 0);
        } catch (error) {
            alert(`Ocorreu um erro geral: ${error.message}`);
        } finally {
            statusDisplay.classList.add('hidden');
        }
    });

    document.getElementById('btnEditar').addEventListener('click', () => { if (formDataCache) { for (let [key, value] of formDataCache.entries()) { const elements = form.elements[key]; if (!elements) continue; if (elements.type === 'radio' || elements.type === 'checkbox') { if (NodeList.prototype.isPrototypeOf(elements) || Array.isArray(elements)) { elements.forEach(el => el.checked = formDataCache.getAll(key).includes(el.value)); } else { elements.checked = (value === elements.value); } } else { elements.value = value; } } document.querySelectorAll('input[type="radio"]:checked, input[type="checkbox"]:checked').forEach(el => { el.dispatchEvent(new Event('change', { 'bubbles': true })); }); } form.style.display = 'block'; resultadoContainer.classList.add('hidden'); });
    document.getElementById('btnImprimir').addEventListener('click', () => { const printWindow = window.open('', '_blank'); const styles = Array.from(document.styleSheets).map(s => `<link rel="stylesheet" href="${s.href}">`).join(''); printWindow.document.write(`<html><head><title>Evolução Médica</title>${styles}</head><body><div id="evolucaoGerada" style="padding: 20px;">${evolucaoGerada.innerHTML}</div></body></html>`); printWindow.document.close(); setTimeout(() => printWindow.print(), 500); });
    document.getElementById('btnSalvar').addEventListener('click', () => { const formData = new FormData(form); const dataToSave = {}; for(let [key, value] of formData.entries()) { if (key.startsWith('dispositivo_') || key.startsWith('sedacao_') || key.startsWith('analgesia_') || key.startsWith('dva_') || key.startsWith('corticoide_') || key.startsWith('outras_drogas_') || key.startsWith('antibiotico_') || key.startsWith('cultura_')) continue; if(dataToSave[key]){ if(!Array.isArray(dataToSave[key])){ dataToSave[key] = [dataToSave[key]]; } dataToSave[key].push(value); } else { dataToSave[key] = value; } } const saveDynamic = (baseName) => { const names = formData.getAll(`${baseName}_nome`); if(names.length > 0 && names[0]) { const values = formData.getAll(`${baseName}_valor`); dataToSave[`${baseName}_dynamic`] = names.map((nome, i) => ({ nome, valor: values[i] })); } }; ['sedacao', 'analgesia', 'dva', 'dispositivo', 'corticoide', 'outras_drogas'].forEach(saveDynamic); const atbNames = formData.getAll('antibiotico_nome'); if (atbNames.length > 0 && atbNames[0]) { const inicios = formData.getAll('antibiotico_inicio'); const fins = formData.getAll('antibiotico_fim'); dataToSave.antibiotico_dynamic = atbNames.map((nome, i) => ({ nome, inicio: inicios[i], fim: fins[i] })); } const cultPendenteTipos = formData.getAll('cultura_pendente_tipo'); if(cultPendenteTipos.length > 0 && cultPendenteTipos[0]) { const datas = formData.getAll('cultura_pendente_data'); dataToSave.culturas_pendentes_dynamic = cultPendenteTipos.map((tipo, i) => ({ tipo, data: datas[i] })); } const cultRealizadaDescs = formData.getAll('cultura_resultado_desc'); if(cultRealizadaDescs.length > 0 && cultRealizadaDescs[0]) { dataToSave.culturas_realizadas_dynamic = cultRealizadaDescs.map(desc => ({ desc })); } const blob = new Blob([JSON.stringify(dataToSave, null, 2)], { type: 'application/json' }); const link = document.createElement('a'); const nomePaciente = form.elements.nomePaciente.value || 'paciente'; const dataAtual = new Date().toISOString().split('T')[0]; link.download = `evolucao_${nomePaciente.replace(/\s+/g, '_')}_${dataAtual}.json`; link.href = window.URL.createObjectURL(blob); link.click(); });
    
    renderFileList();
    setupConditionalLogic();
}