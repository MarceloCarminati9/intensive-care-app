import { GoogleGenerativeAI } from "https://esm.run/@google/generative-ai";

const API_KEY = "API.KEY"; // Lembre-se do risco de segurança! Mova para o backend.

const genAI = new GoogleGenerativeAI(API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro-latest" });

// --- MAPA DE SINÔNIMOS ATUALIZADO (sem alterações) ---
const synonymMap = {
    // Coagulação
    'RELAÇÃO': 'RNI', // RELAÇÃO
    'INR': 'RNI',
    'TTPA': 'TEMPO DE TROMBOPLASTINA PARCIAL',
    // PCR
    'PROTEINA C REATIVA': 'PCR', 'PROTEÍNA C REATIVA': 'PCR',
    'PROTEINA C REATIVA QUANTITATIVA': 'PCR', 'PROTEÍNA C REATIVA QUANTITATIVA': 'PCR',
    // Hemograma
    'V.C.M.': 'VCM', 'V.C.M': 'VCM', 'H.C.M.': 'HCM', 'H.C.M': 'HCM',
    'C.H.C.M.': 'CHCM', 'C.H.C.M': 'CHCM', 'ÍNDICE DE ANISOCITOSE (RDW)': 'RDW',
    // Outros
    'ALBUMINA, DOSAGEM': 'ALBUMINA', 'CONTAGEM DE PLAQUETAS': 'PLAQUETAS',
    'CÁLCIO': 'CÁLCIO TOTAL', 'CÁLCIO SÉRICO': 'CÁLCIO TOTAL',
    'URÉIA': 'UREIA',
    // Transaminases
    'TRANSAMINASE OXALACETICA (TGO)': 'TGO', 'TRANSAMINASE PIRUVICA (TGP)': 'TGP'
};

// --- Função de Normalização (sem alterações) ---
function normalizeExamData(examData) {
    const normalizedData = { ...examData, exames: {} };
    for (const key in examData.exames) {
        const upperKey = key.trim().toUpperCase();
        const standardName = synonymMap[upperKey] || upperKey;
        normalizedData.exames[standardName] = examData.exames[key];
    }
    return normalizedData;
}

// --- Referências a todos os elementos HTML (sem alterações) ---
const patientNameInput = document.getElementById('patientNameInput');
const patientDobInput = document.getElementById('patientDobInput');
const patientSexInput = document.getElementById('patientSexInput');
const patientHeightInput = document.getElementById('patientHeightInput');
const patientWeightInput = document.getElementById('patientWeightInput');
const hrInput = document.getElementById('hrInput');
const pamInput = document.getElementById('pamInput');
const pvcInput = document.getElementById('pvcInput');
const sao2Input = document.getElementById('sao2Input');
const svo2Input = document.getElementById('svo2Input');
const fio2Input = document.getElementById('fio2Input');
const pao2Input = document.getElementById('pao2Input');
const pvo2Input = document.getElementById('pvo2Input');
const analyzeButton = document.getElementById('analyzeButton');
const fileInput = document.getElementById('fileInput');
const fileListContainer = document.getElementById('fileListContainer');
const loader = document.getElementById('loader');
const actionButtons = document.getElementById('actionButtons');
const printButton = document.getElementById('printButton');
const saveButton = document.getElementById('saveButton');
const printableArea = document.getElementById('printableArea');

// --- LÓGICA DE GERENCIAMENTO DE ARQUIVOS (sem alterações) ---
let selectedFiles = [];
fileInput.addEventListener('change', () => {
    for (const file of fileInput.files) {
        if (!selectedFiles.some(f => f.name === file.name)) {
            selectedFiles.push(file);
        }
    }
    renderFileList();
    fileInput.value = '';
});
function renderFileList() {
    fileListContainer.innerHTML = '';
    if (selectedFiles.length === 0) {
        fileListContainer.innerHTML = '<p>Nenhum arquivo selecionado.</p>';
        return;
    }
    selectedFiles.forEach((file, index) => {
        const fileItem = document.createElement('div');
        fileItem.className = 'file-item';
        fileItem.innerHTML = `<span>${file.name}</span><button class="remove-file-btn" data-index="${index}">×</button>`;
        fileListContainer.appendChild(fileItem);
    });
}
fileListContainer.addEventListener('click', (event) => {
    if (event.target.classList.contains('remove-file-btn')) {
        const indexToRemove = parseInt(event.target.dataset.index, 10);
        selectedFiles.splice(indexToRemove, 1);
        renderFileList();
    }
});
renderFileList();

// ***** INÍCIO DA MODIFICAÇÃO *****
// --- Função Auxiliar para Parse de Data e Hora ---
function parseDateTime(dateTimeString) {
    if (!dateTimeString || !dateTimeString.includes('/')) return null;
    const [datePart, timePart] = dateTimeString.split(' ');
    const [day, month, year] = datePart.split('/');
    const [hours, minutes] = timePart ? timePart.split(':') : [0, 0];

    // new Date(ano, mêsIndexadoEmZero, dia, horas, minutos)
    const dateObject = new Date(+year, +month - 1, +day, +hours, +minutes);
    // Validação simples para datas inválidas resultantes do parse
    if (isNaN(dateObject.getTime())) {
        return null;
    }
    return dateObject;
}
// ***** FIM DA MODIFICAÇÃO *****

// --- FUNÇÃO PRINCIPAL (COM A CORREÇÃO NO SORT) ---
analyzeButton.addEventListener('click', async () => {
    const patientData = {
        name: patientNameInput.value,
        dob: patientDobInput.value,
        sex: patientSexInput.value,
        height: parseFloat(patientHeightInput.value) || null,
        weight: parseFloat(patientWeightInput.value) || null,
        hr: parseFloat(hrInput.value) || null,
        pam: parseFloat(pamInput.value) || null,
        pvc: parseFloat(pvcInput.value) || null,
        sao2: parseFloat(sao2Input.value) || null,
        svo2: parseFloat(svo2Input.value) || null,
        fio2: parseFloat(fio2Input.value) || null,
        pao2: parseFloat(pao2Input.value) || null,
        pvo2: parseFloat(pvo2Input.value) || null,
    };

    if (!patientData.name || !patientData.dob || !patientData.sex) {
        alert('Por favor, preencha Nome, Data de Nascimento e Sexo.'); return;
    }
    if (selectedFiles.length === 0) {
        alert('Por favor, escolha pelo menos um arquivo PDF.'); return;
    }

    loader.classList.remove('hidden');
    printableArea.style.display = 'none';
    actionButtons.style.display = 'none';

    try {
        const analysisPromises = selectedFiles.map(file => processPdfFile(file));
        const analysisResults = await Promise.all(analysisPromises);

        const validResultsRaw = analysisResults.filter(r => r && r.status === "success").map(r => r.data);
        const validResults = validResultsRaw.map(normalizeExamData);

        const failedFiles = analysisResults.filter(r => r && r.status === 'error');
        if (failedFiles.length > 0) {
            const failedFileNames = failedFiles.map(f => f.message).join('\n');
            alert(`Atenção: Os seguintes arquivos não puderam ser processados:\n${failedFileNames}`);
        }

        if (validResults.length > 0) {
            patientData.age = calculateAge(patientData.dob);
            printableArea.innerHTML = '';
            const headerHTML = generatePatientHeaderHTML(patientData);
            const resultsTableContainer = document.createElement('div');
            resultsTableContainer.id = 'resultsTableContainer';
            const calculatedParametersContainer = document.createElement('div');
            calculatedParametersContainer.id = 'calculatedParameters';
            calculatedParametersContainer.style.display = 'none';

            printableArea.innerHTML = headerHTML;
            printableArea.appendChild(resultsTableContainer);
            printableArea.appendChild(calculatedParametersContainer);

            // ***** INÍCIO DA MODIFICAÇÃO *****
            // Lógica de ordenação por data e hora
            validResults.sort((a, b) => {
                const dateA = parseDateTime(a.dataHora);
                const dateB = parseDateTime(b.dataHora);

                if (!dateA && !dateB) return 0; // ambos inválidos
                if (!dateA) return -1; // 'a' inválido vem antes
                if (!dateB) return 1;  // 'b' inválido vem antes
                
                return dateA - dateB; // ordenação cronológica
            });
            
            const latestExamResults = validResults.length > 0 ? validResults[validResults.length - 1] : { exames: {} };
            // ***** FIM DA MODIFICAÇÃO *****

            renderTableAndCalculations(validResults, patientData, latestExamResults);

            const paramsDiv = document.getElementById('calculatedParameters');
            if (paramsDiv.innerHTML.trim() !== '' && paramsDiv.children.length > 1) {
                paramsDiv.style.display = 'block';
            }

            printableArea.style.display = 'block';
            actionButtons.style.display = 'block';

        } else {
            throw new Error("A IA não conseguiu analisar nenhum dos documentos enviados com sucesso.");
        }
    } catch (error) {
        console.error("Erro no processo:", error);
        alert(`Ocorreu um erro geral no processo: ${error.message}`);
    } finally {
        loader.classList.add('hidden');
    }
});

// --- FUNÇÕES DE RENDERIZAÇÃO E CÁLCULO ---
printButton.addEventListener('click', () => window.print());
saveButton.addEventListener('click', () => {
    const elementToSave = document.getElementById('printableArea');
    html2pdf().from(elementToSave).set({
        margin: 1,
        filename: `Relatorio_${patientNameInput.value.replace(/ /g, '_')}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2 },
        jsPDF: { unit: 'in', format: 'letter', orientation: 'landscape' }
    }).save();
});

// Função sem alterações
function generatePatientHeaderHTML(patientData) {
    const dob = new Date(patientData.dob + 'T00:00:00');
    const formattedDob = !isNaN(dob.getTime()) ? dob.toLocaleDateString('pt-BR') : 'N/A';
    const sexText = patientData.sex === 'male' ? 'Masculino' : (patientData.sex === 'female' ? 'Feminino' : 'N/A');

    let html = `<div id="patient-report-header">`;
    html += `<h2>Relatório do Paciente</h2>`;
    html += `<p><strong>Nome:</strong> ${patientData.name || 'N/A'}</p>`;
    html += `<p><strong>Idade:</strong> ${patientData.age} anos</p>`;
    html += `<p><strong>Data de Nascimento:</strong> ${formattedDob}</p>`;
    html += `<p><strong>Sexo:</strong> ${sexText}</p>`;
    html += `<hr><h4>Parâmetros Iniciais</h4>`;

    let paramsString = '';
    const addInfo = (label, value, unit = '') => {
        if (value !== null && value !== undefined && value !== '') {
            paramsString += `<strong>${label}:</strong> ${value}${unit} &nbsp; &nbsp; `;
        }
    };
    let fio2Display = patientData.fio2;
    if (fio2Display !== null && fio2Display <= 1) fio2Display = (fio2Display * 100).toFixed(0);
    addInfo('Altura', patientData.height, 'cm'); addInfo('Peso', patientData.weight, 'kg');
    addInfo('FC', patientData.hr, 'bpm'); addInfo('PAM', patientData.pam, 'mmHg');
    addInfo('PVC', patientData.pvc, 'mmHg'); addInfo('SaO₂', patientData.sao2, '%');
    addInfo('SvO₂', patientData.svo2, '%'); addInfo('FiO₂', fio2Display, '%');
    addInfo('PaO₂', patientData.pao2, 'mmHg'); addInfo('PvO₂', patientData.pvo2, 'mmHg');
    if (paramsString.length > 0) html += `<p style="text-align: justify;">${paramsString}</p>`;
    html += '<hr></div>';
    return html;
}


// ***** INÍCIO DA MODIFICAÇÃO *****
function renderTableAndCalculations(results, patientData, latestExamResults) {
    // Usa 'dataHora' para obter todas as datas e horas únicas e as ordena
    const allDateTimes = [...new Set(results.map(r => r.dataHora).filter(d => d))];
    allDateTimes.sort((a, b) => parseDateTime(a) - parseDateTime(b));

    const dataByDateTime = {};
    results.forEach(res => {
        if (res.dataHora) { // Agrupa os resultados por data e hora
            dataByDateTime[res.dataHora] = dataByDateTime[res.dataHora] ? { ...dataByDateTime[res.dataHora], ...res.exames } : res.exames;
        }
    });

    const calculatedRows = { 'eGFR (CKD-EPI)': {}, 'CÁLCIO CORRIGIDO': {} };
    allDateTimes.forEach(dateTime => {
        const exams = dataByDateTime[dateTime];
        const creat = parseFloat(exams['CREATININA']);
        if (creat) calculatedRows['eGFR (CKD-EPI)'][dateTime] = calculateEgfr(creat, patientData.age, patientData.sex);
        
        const calcio = parseFloat(exams['CÁLCIO TOTAL']);
        const albumina = parseFloat(exams['ALBUMINA']);
        if (calcio && albumina) calculatedRows['CÁLCIO CORRIGIDO'][dateTime] = (calcio + ((4 - albumina) * 0.8)).toFixed(2);
    });

    renderTable(results, calculatedRows, allDateTimes, dataByDateTime);
    renderOtherCalculations(patientData, latestExamResults.exames);
}
// ***** FIM DA MODIFICAÇÃO *****

// ***** INÍCIO DA MODIFICAÇÃO *****
function renderTable(results, calculatedRows, allDateTimes, dataByDateTime) {
    const priorityOrder = [
        'ERITRÓCITOS', 'HEMOGLOBINA', 'HEMATÓCRITO', 'VCM', 'HCM', 'CHCM', 'RDW',
        'LEUCÓCITOS', 'EOSINÓFILOS', 'BASÓFILOS', 'LINFÓCITOS', 'NEUTRÓFILOS',
        'MONÓCITOS', 'MIELÓCITOS', 'METAMIELÓCITOS', 'BASTONETES',
        'PLAQUETAS', 'CREATININA', 'UREIA', 'eGFR (CKD-EPI)', 'PCR',
        'BILIRRUBINA TOTAL', 'BILIRRUBINA INDIRETA', 'BILIRRUBINA DIRETA',
        'RNI', 'TAP', 'TEMPO DE TROMBOPLASTINA PARCIAL'
    ];
    // Filtra nomes de exames de resultados que têm data e hora válidas
    const allExamNames = [...new Set(results.filter(r => r.dataHora).flatMap(r => Object.keys(r.exames)))];
    const allRowNames = [...new Set([...allExamNames, ...Object.keys(calculatedRows)])];
    
    allRowNames.sort((a, b) => {
        let indexA = priorityOrder.indexOf(a); let indexB = priorityOrder.indexOf(b);
        if (indexA === -1) indexA = Infinity; if (indexB === -1) indexB = Infinity;
        return (indexA !== indexB) ? indexA - indexB : a.localeCompare(b);
    });

    let tableHTML = '<table><thead><tr><th>Exame</th>';
    // Cria o cabeçalho da tabela com data e hora
    allDateTimes.forEach(dateTime => tableHTML += `<th>${dateTime}</th>`);
    tableHTML += '</tr></thead><tbody>';

    allRowNames.forEach(rowName => {
        // Verifica se existe algum valor para esta linha em qualquer uma das datas/horas
        const hasValue = allDateTimes.some(dateTime => 
            (dataByDateTime[dateTime] && dataByDateTime[dateTime][rowName] !== undefined) || 
            (calculatedRows[rowName] && calculatedRows[rowName][dateTime] !== undefined)
        );

        if (!hasValue) return; // Não renderiza a linha se ela estiver vazia

        tableHTML += `<tr><td>${rowName}</td>`;
        allDateTimes.forEach(dateTime => {
            const value = (dataByDateTime[dateTime] && dataByDateTime[dateTime][rowName]) || 
                          (calculatedRows[rowName] && calculatedRows[rowName][dateTime]) || '';
            tableHTML += `<td>${value}</td>`;
        });
        tableHTML += '</tr>';
    });

    tableHTML += '</tbody></table>';
    document.getElementById('resultsTableContainer').innerHTML = tableHTML;
}
// ***** FIM DA MODIFICAÇÃO *****

// Função sem alterações substanciais
function renderOtherCalculations(patientData, latestExams) {
    const { weight, height, age, sex, hr, pam, pvc, sao2, svo2, pao2, fio2 } = patientData;
    const latestHb = latestExams ? parseFloat(latestExams['HEMOGLOBINA']) : null;
    let html = `<h3>Parâmetros Calculados Adicionais</h3>`;
    let asc, vo2, dcFick, cao2, do2, vs, rvs;

    const addCalc = (label, value, unit) => {
        if (value && isFinite(value)) html += `<p><strong>${label.padEnd(35, '.')}:</strong> ${value.toFixed(2)} ${unit}</p>`;
    };

    if (weight && height) asc = Math.sqrt((weight * height) / 3600);
    addCalc('Área de Superfície Corporal (ASC)', asc, 'm²');
    if (height) addCalc('Peso Predito', ((sex === 'male' ? 50 : 45.5) + 0.91 * (height - 152.4)), 'kg');
    if (weight && height && age) addCalc('Gasto Energético Basal (GEB)', ((sex === 'male') ? 88.362 + (13.397 * weight) + (4.799 * height) - (5.677 * age) : 447.593 + (9.247 * weight) + (3.098 * height) - (4.330 * age)), 'kcal/dia');
    if (asc) addCalc('Consumo de Oxigênio (VO₂)', (vo2 = (age >= 70 ? 110 : 125) * asc), 'mL/min');
    if (latestHb && sao2 && pao2) addCalc('Conteúdo Arterial de O₂ (CaO₂)', (cao2 = (1.34 * latestHb * (sao2 / 100)) + (0.003 * pao2)), 'mL/dL');
    if (vo2 && latestHb && sao2 && svo2) {
        const diff = (sao2 / 100) - (svo2 / 100);
        if (diff > 0) addCalc('Débito Cardíaco (Fick)', (dcFick = vo2 / ((1.34 * latestHb * diff) * 10)), 'L/min');
    }
    if (dcFick && cao2) addCalc('Entrega de Oxigênio (DO₂)', (do2 = dcFick * cao2 * 10), 'mL/min');
    if (vo2 && do2) addCalc('Taxa de Extração de O₂ (ERO₂)', (vo2 / do2) * 100, '%');
    if (dcFick && hr) addCalc('Volume Sistólico (VS)', (vs = (dcFick / hr) * 1000), 'mL/batimento');
    if (vs && asc) addCalc('Índice Sistólico (IS)', vs / asc, 'mL/batimento/m²');
    if (pam && pvc && dcFick) addCalc('Resistência Vascular Sistêmica (RVS)', (rvs = 80 * (pam - pvc) / dcFick), 'dyn·s·cm⁻⁵');
    if (rvs && asc) addCalc('Índice de Res. Vasc. Sist. (IRVS)', rvs * asc, 'dyn·s·cm⁻⁵·m²');
    if (pao2 && fio2) addCalc('Relação PaO₂/FiO₂', pao2 / (fio2 > 1.0 ? fio2 / 100 : fio2), '');
    
    document.getElementById('calculatedParameters').innerHTML = html;
}

// Funções sem alterações
function calculateAge(dobString) {
    if (!dobString) return 0;
    const dob = new Date(dobString + 'T00:00:00');
    if (isNaN(dob.getTime())) return 0;
    const today = new Date(); let age = today.getFullYear() - dob.getFullYear();
    const m = today.getMonth() - dob.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;
    return age;
}
function calculateEgfr(creatinine, age, sex) {
    const k = (sex === 'female') ? 0.7 : 0.9; const alpha = (sex === 'female') ? -0.241 : -0.302;
    const sexFactor = (sex === 'female') ? 1.012 : 1;
    return (142 * Math.min(creatinine / k, 1) ** alpha * Math.max(creatinine / k, 1) ** -1.200 * 0.9938 ** age * sexFactor).toFixed(0);
}

// --- FUNÇÃO DE PROCESSAR PDF (COM PROMPT MAIS ROBUSTO) ---
async function processPdfFile(file) {
    try {
        const fileReader = new FileReader();
        const pdfData = await new Promise((resolve, reject) => {
            fileReader.onload = (e) => resolve(new Uint8Array(e.target.result));
            fileReader.onerror = (err) => reject(new Error(`Erro ao ler o arquivo: ${err.message}`));
            fileReader.readAsArrayBuffer(file);
        });
        const pdf = await pdfjsLib.getDocument({ data: pdfData }).promise;
        let textContent = '';
        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const text = await page.getTextContent();
            textContent += text.items.map(item => item.str).join(' ');
        }
        if (!textContent.trim()) throw new Error('O PDF parece estar vazio ou contém apenas imagens.');

        // ***** INÍCIO DA MODIFICAÇÃO *****
        // 1. PROMPT ATUALIZADO PARA EXTRAIR DATA E HORA
        const prompt = `Você é um especialista em análise de laudos laboratoriais. Sua tarefa é extrair todos os exames de um texto e retorná-los em um objeto JSON plano.

REGRAS ESTRITAS:
1.  **JSON de Saída:** O JSON deve ter uma chave "exames" e uma chave "dataHora".
2.  **REGRA DE DATA E HORA (MAIS IMPORTANTE):**
    * Encontre a data e a hora de liberação do laudo no texto. A hora pode estar perto da data.
    * Combine-as no formato "DD/MM/AAAA HH:mm". Exemplo: "25/06/2025 14:30".
    * Se a hora não for encontrada, use "00:00" como padrão.
    * Se a data não for encontrada de forma alguma, retorne "dataHora": "" (uma string vazia).
    * É crucial que a chave "dataHora" sempre exista.
3.  **REGRA DE PREFIXO:**
    * Para cada componente que pertencer a um exame de urina (EAS, Sumário de Urina, Urina Tipo 1), você **DEVE** adicionar o prefixo "URINA_" ao nome da chave.
    * Para todos os outros exames (Hemograma, Bioquímica, Coagulação, etc.), use o nome normal, **SEM** prefixo.
4.  **Resultados:** O valor de cada exame deve ser uma string, seja ele numérico ('10.5') ou textual ('Negativo', '++').
5.  **Nomes das Chaves:** Use sempre letras maiúsculas e sem acentos.

**EXEMPLO DE SAÍDA PERFEITA:**
{
  "dataHora": "25/06/2025 14:30",
  "exames": {
    "HEMOGLOBINA": "14.5",
    "LEUCOCITOS": "8500",
    "URINA_DENSIDADE": "1.020",
    "URINA_NITRITO": "Negativo"
  }
}

**Texto do Laudo para Análise:**
---
${textContent}
---`;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const jsonText = response.text().replace(/`|json/g, '').trim();
        const parsedData = JSON.parse(jsonText);
        
        // Esta seção de filtragem permanece a mesma
        const filteredExams = {};
        for (const examName in parsedData.exames) {
            if (!examName.toUpperCase().startsWith('URINA_')) {
                filteredExams[examName] = parsedData.exames[examName];
            }
        }
        parsedData.exames = filteredExams;

        // ***** FIM DA MODIFICAÇÃO *****

        return { status: "success", data: parsedData };

    } catch (error) {
        console.error(`Falha ao processar o arquivo "${file.name}":`, error);
        return { status: "error", message: `Arquivo "${file.name}"` };
    }
}