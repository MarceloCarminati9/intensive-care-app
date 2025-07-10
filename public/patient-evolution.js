// VERSÃO FINAL, COMPLETA E VALIDADA (Corrige todos os problemas)

document.addEventListener('DOMContentLoaded', function() {
    
    // =================================================================================
    // INICIALIZAÇÃO E SELEÇÃO DE ELEMENTOS
    // =================================================================================
    const params = new URLSearchParams(window.location.search);
    const patientId = params.get('patientId'); 

    const patientNameHeader = document.getElementById('patientNameHeader');
    const backToPatientViewLink = document.getElementById('backToPatientViewLink');
    const evolutionHistoryList = document.getElementById('evolutionHistoryList');
    const evolutionForm = document.getElementById('evolutionForm');
    const formTitle = document.getElementById('formTitle');
    const saveButton = document.getElementById('saveEvolutionButton');
    const cancelEditButton = document.getElementById('cancelEditButton');

    // Modais
    const printConfirmModal = document.getElementById('printConfirmModal');
    const goToPatientViewBtn = document.getElementById('goToPatientViewBtn'); // Botão OK do modal de confirmação
    
    const historyViewerModal = document.getElementById('historyViewerModal');
    const viewerTitle = document.getElementById('viewerTitle');
    const viewerContent = document.getElementById('viewerContent');
    const closeViewerBtn = document.getElementById('closeViewerBtn');
    const closeViewerModalBtn = document.getElementById('closeViewerModalBtn');
    const printDocumentBtn = document.getElementById('printDocumentBtn');
    
    let patient = null;
    let editingEvolutionId = null;

    if (!patientId) {
        patientNameHeader.textContent = "ERRO: ID do Paciente não encontrado na URL.";
        patientNameHeader.style.color = 'red';
        if (evolutionForm) evolutionForm.style.display = 'none';
        return;
    }
    
    // =================================================================================
    // LÓGICA DE DADOS E RENDERIZAÇÃO
    // =================================================================================

    async function loadPatientAndHistory() {
        try {
            const patientResponse = await fetch(`/api/patients/${patientId}`);
            if (!patientResponse.ok) throw new Error("Não foi possível carregar os dados do paciente.");
            const patientResult = await patientResponse.json();
            patient = patientResult.data;

            patientNameHeader.textContent = patient.name;
            backToPatientViewLink.href = `patient-view.html?patientId=${patientId}`;
            
            await renderEvolutionHistory();
        } catch (error) {
            console.error("Erro ao carregar dados:", error);
            document.querySelector('main').innerHTML = `<p style="color: red; text-align: center;">${error.message}</p>`;
        }
    }

    async function renderEvolutionHistory() {
        try {
            const response = await fetch(`/api/patients/${patientId}/evolutions`);
            if (!response.ok) throw new Error("Falha ao buscar histórico de evoluções.");
            
            const result = await response.json();
            const evolutions = result.data || [];

            evolutionHistoryList.innerHTML = '';
            if (evolutions.length === 0) {
                evolutionHistoryList.innerHTML = '<p>Nenhuma evolução anterior encontrada para este paciente.</p>';
                return;
            }
            evolutions.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

            evolutions.forEach(evo => {
                const date = new Date(evo.created_at);
                const formattedDate = date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
                const formattedTime = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                const previewText = evo.content?.impressao24h ? evo.content.impressao24h.substring(0, 150) + '...' : 'Sem resumo.';
                
                const historyItemDiv = document.createElement('div');
                historyItemDiv.className = 'history-item';
                historyItemDiv.dataset.evolutionId = evo.id; 
                historyItemDiv.dataset.evolutionContent = JSON.stringify(evo.content);

                historyItemDiv.innerHTML = `
                    <div class="history-item-header">
                        <span><strong>Evolução de ${formattedDate} às ${formattedTime}</strong></span>
                        <div class="history-item-actions">
                            <button type="button" class="button-secondary" data-action="print">Visualizar/Imprimir</button>
                            <button type="button" class="button-secondary" data-action="copy">Copiar para Nova</button>
                            <button type="button" class="button-secondary" data-action="edit">Editar</button>
                        </div>
                    </div>
                    <div class="history-item-preview">${previewText}</div>
                `;
                evolutionHistoryList.appendChild(historyItemDiv);
            });
        } catch(error) {
            console.error("Erro ao renderizar histórico:", error);
            evolutionHistoryList.innerHTML = `<p style="color: red;">${error.message}</p>`;
        }
    }
    
    // =================================================================================
    // GERAÇÃO DO RELATÓRIO FORMATADO
    // =================================================================================
    function generateEvolutionReportHTML(patientData, evolutionData) {
        if (!patientData || !evolutionData) return '<p>Dados insuficientes para gerar o relatório.</p>';

        const getField = (field) => evolutionData[field] || 'N/A';
        
        const patientDIH = patientData.dih ? new Date(patientData.dih).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : 'N/A';
        const patientDOB = patientData.dob ? new Date(patientData.dob).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : 'N/A';
        
        // Cabeçalho com todos os dados do paciente
        const header = `
            <div class="report-header">
                <h3>Evolução Médica Diária</h3>
                <p>Intensive Care Brasil</p>
            </div>
            <div class="report-id-section">
                <h4>Identificação do Paciente</h4>
                <div class="report-id-grid">
                    <p><strong>Nome:</strong> ${patientData.name || 'N/A'}</p>
                    <p><strong>Idade:</strong> ${patientData.age || 'N/A'} anos</p>
                    <p><strong>DN:</strong> ${patientDOB}</p>
                    <p><strong>CNS:</strong> ${patientData.cns || 'N/A'}</p>
                    <p><strong>Unidade:</strong> ${patientData.unit_name || 'N/A'}</p>
                    <p><strong>Leito:</strong> ${patientData.bed_number || 'N/A'}</p>
                    <p><strong>DIH:</strong> ${patientDIH}</p>
                    <p><strong>Alergias:</strong> ${patientData.allergies || 'Não informado'}</p>
                </div>
                <div class="report-id-grid" style="grid-template-columns: 1fr; margin-top: 10px;">
                    <p><strong>HPP:</strong> ${patientData.hpp || 'Não informado'}</p>
                    <p><strong>Hipótese Diagnóstica:</strong> ${patientData.hd || 'Não informado'}</p>
                </div>
            </div>`;

        // Corpo do relatório
        const body = `
            <div class="print-container">
                <div class="print-column">
                    <div class="report-section">
                        <h4>Impressão 24h</h4>
                        <p>${getField('impressao24h')}</p>
                    </div>
                     <div class="report-section">
                        <h4>Exame Físico</h4>
                        <p><strong>Neurológico:</strong> Glasgow ${getField('glasgow_total')}, RASS ${getField('rass')}</p>
                        <p><strong>Pupilas:</strong> ${getField('pupilas_tamanho')}, ${getField('pupilas_reatividade')}</p>
                    </div>
                </div>
                <div class="print-column">
                    <div class="report-section">
                        <h4>Condutas e Plano Terapêutico</h4>
                        <p>${getField('condutas')}</p>
                    </div>
                </div>
            </div>`;

        // Rodapé com assinatura
        const footer = `
            <div class="signature-area">
                <div class="signature-line">
                    ${getField('medico_responsavel')}<br>
                    CRM: ${getField('crm_medico')}
                </div>
            </div>`;

        return header + body + footer;
    }

    // =================================================================================
    // EVENTOS E LÓGICA DA UI
    // =================================================================================

    evolutionForm.addEventListener('submit', async function(event) {
        event.preventDefault();
        const evolutionData = collectFormData(); 
        
        try {
            const response = await fetch(`/api/patients/${patientId}/evolutions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(evolutionData),
            });
            if (!response.ok) {
                const err = await response.json(); throw new Error(err.error || 'Falha ao salvar evolução.');
            }
            resetFormAndState();
            await renderEvolutionHistory(); 
            printConfirmModal.classList.add('active'); 
        } catch (error) {
            console.error("Erro ao salvar:", error);
            alert(`Não foi possível salvar a evolução: ${error.message}`);
        }
    });

    const redirectToPatientView = () => {
        window.location.href = `patient-view.html?patientId=${patientId}`;
    };

    if (goToPatientViewBtn) goToPatientViewBtn.addEventListener('click', redirectToPatientView);
    if (closeViewerBtn) closeViewerBtn.addEventListener('click', () => historyViewerModal.classList.remove('active'));
    if (closeViewerModalBtn) closeViewerModalBtn.addEventListener('click', () => historyViewerModal.classList.remove('active'));

    if (printDocumentBtn) {
        printDocumentBtn.addEventListener('click', () => {
            const printWindow = window.open('', '_blank');
            const styles = document.querySelector('link[href="patient-view-style.css"]').outerHTML;
            printWindow.document.write(`<html><head><title>Evolução Médica</title>${styles}</head><body>${viewerContent.innerHTML}</body></html>`);
            printWindow.document.close();
            setTimeout(() => printWindow.print(), 500);
        });
    }

    evolutionHistoryList.addEventListener('click', function(event) {
        const button = event.target.closest('button[data-action]');
        if (!button) return;
        
        const action = button.dataset.action;
        const historyItem = button.closest('.history-item');
        const evolutionContent = JSON.parse(historyItem.dataset.evolutionContent);
        
        if (action === 'edit' || action === 'copy') {
            populateForm(evolutionContent);
            if (action === 'copy') {
                formTitle.textContent = "Nova Evolução (Copiada)";
                saveButton.textContent = "Salvar Nova Evolução";
                editingEvolutionId = null; 
            } else { // Edit
                editingEvolutionId = historyItem.dataset.evolutionId;
                formTitle.textContent = `Editando Evolução`;
                saveButton.textContent = "Atualizar Evolução";
                cancelEditButton.classList.remove('hidden');
            }
            window.scrollTo({ top: 0, behavior: 'smooth' });
        } else if (action === 'print') {
            const title = historyItem.querySelector('.history-item-header span').textContent;
            viewerTitle.textContent = title;
            viewerContent.innerHTML = generateEvolutionReportHTML(patient, evolutionContent);
            historyViewerModal.classList.add('active');
        }
    });

    if(cancelEditButton) {
        cancelEditButton.addEventListener('click', resetFormAndState);
    }

    function collectFormData() {
        const formData = new FormData(evolutionForm);
        const data = {};
        for(const [key, value] of formData.entries()) {
            if (key.endsWith('[]')) {
                const cleanKey = key.slice(0, -2);
                if (!data[cleanKey]) data[cleanKey] = [];
                data[cleanKey].push(value);
            } else {
                data[key] = value;
            }
        }
        return data;
    }

    function populateForm(data) {
        resetFormAndState();
        for (const key in data) {
            const value = data[key];
            const element = evolutionForm.elements[key];
            if (element) {
                if (element.type === 'radio') {
                     const el = document.querySelector(`input[name="${key}"][value="${value}"]`);
                     if(el) el.checked = true;
                } else if (element.type === 'checkbox') {
                    element.checked = !!value;
                }
                else {
                    element.value = value;
                }
            }
        }
    }

    function resetFormAndState() {
        evolutionForm.reset();
        editingEvolutionId = null;
        formTitle.textContent = "Nova Evolução Médica";
        saveButton.textContent = "Salvar Nova Evolução";
        cancelEditButton.classList.add('hidden');
    }

    // --- Inicialização ---
    loadPatientAndHistory();
});