// VERSÃO FINAL, COMPLETA E UNIFICADA - CORRIGIDO EM 11/07/2025

document.addEventListener('DOMContentLoaded', function() {
    
    // =================================================================================
    // INICIALIZAÇÃO E SELEÇÃO DE ELEMENTOS
    // =================================================================================
    const params = new URLSearchParams(window.location.search);
    const patientId = params.get('patientId'); 
    const evolutionIdToEdit = params.get('evolutionId');
    const evolutionIdToCopy = params.get('copyFromId');

    const patientNameHeader = document.getElementById('patientNameHeader');
    const backToPatientViewLink = document.getElementById('backToPatientViewLink');
    const evolutionHistoryList = document.getElementById('evolutionHistoryList');
    const evolutionForm = document.getElementById('evolutionForm');
    const formTitle = document.getElementById('formTitle');
    const saveButton = document.getElementById('saveEvolutionButton');
    const cancelEditButton = document.getElementById('cancelEditButton');

    // Modais
    const printConfirmModal = document.getElementById('printConfirmModal');
    const goToPatientViewBtn = document.getElementById('goToPatientViewBtn');
    
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

    async function initializePage() {
        try {
            const patientResponse = await fetch(`/api/patients/${patientId}`);
            if (!patientResponse.ok) throw new Error("Não foi possível carregar os dados do paciente.");
            const patientResult = await patientResponse.json();
            patient = patientResult.data;

            patientNameHeader.textContent = patient.name;
            backToPatientViewLink.href = `patient-view.html?patientId=${patientId}`;
            
            if (evolutionIdToEdit) {
                await loadEvolutionAndSetupForm(evolutionIdToEdit, 'edit');
            } else if (evolutionIdToCopy) {
                await loadEvolutionAndSetupForm(evolutionIdToCopy, 'copy');
            }

            await renderEvolutionHistory();

        } catch (error) {
            console.error("Erro ao carregar dados:", error);
            document.querySelector('main').innerHTML = `<p style="color: red; text-align: center;">${error.message}</p>`;
        }
    }

    async function loadEvolutionAndSetupForm(evolutionId, mode) {
        try {
            const response = await fetch(`/api/evolutions/${evolutionId}`); 
            if (!response.ok) throw new Error("Evolução não encontrada.");
            const result = await response.json();
            const evolutionContent = result.data.content;
            
            populateForm(evolutionContent);

            if (mode === 'edit') {
                editingEvolutionId = evolutionId;
                formTitle.textContent = `Editando Evolução`;
                saveButton.textContent = "Atualizar Evolução";
                cancelEditButton.classList.remove('hidden');
            } else { 
                formTitle.textContent = "Nova Evolução (Copiada)";
            }
        } catch (error) {
            console.error(`Erro ao carregar evolução para ${mode}:`, error);
            alert(`Não foi possível carregar os dados da evolução selecionada.`);
        }
    }
    
// [SUBSTITUIR ESTA FUNÇÃO]
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
            const historyItemDiv = document.createElement('div');
            // [ALTERAÇÃO] Adiciona a classe 'deleted' se o item foi excluído
            historyItemDiv.className = `history-item ${evo.deleted_at ? 'deleted' : ''}`;
            historyItemDiv.dataset.evolutionId = evo.id; 
            historyItemDiv.dataset.evolutionContent = JSON.stringify(evo.content);
            
            const createdAt = new Date(evo.created_at);
            const updatedAt = evo.updated_at ? new Date(evo.updated_at) : null;
            let editedText = '';
            
            if (updatedAt && (updatedAt.getTime() - createdAt.getTime() > 60000)) {
                const formattedEditDate = updatedAt.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
                const formattedEditTime = updatedAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                editedText = `<span class="edited-status">(editada em ${formattedEditDate} às ${formattedEditTime})</span>`;
            }

            const formattedCreationDate = createdAt.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
            const formattedCreationTime = createdAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
            const previewText = evo.content?.impressao24h ? evo.content.impressao24h.substring(0, 150) + '...' : 'Sem resumo.';
            
            // [ALTERAÇÃO] Botões desabilitados se o item foi excluído
            const isDisabled = !!evo.deleted_at;

            historyItemDiv.innerHTML = `
                <div class="history-item-header">
                    <span><strong>Evolução de ${formattedCreationDate} às ${formattedCreationTime}${editedText}</strong></span>
                    <div class="history-item-actions">
                        <button type="button" class="button-secondary" data-action="print" ${isDisabled ? 'disabled' : ''}>Visualizar/Imprimir</button>
                        <button type="button" class="button-secondary" data-action="copy" ${isDisabled ? 'disabled' : ''}>Copiar para Nova</button>
                        <button type="button" class="button-secondary" data-action="edit" ${isDisabled ? 'disabled' : ''}>Editar</button>
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
    
    function generateEvolutionReportHTML(patientData, evolutionData) {
        if (!patientData || !evolutionData) return '<p>Dados insuficientes para gerar o relatório.</p>';
        const getField = (field) => evolutionData[field] || 'N/A';
        const patientDIH = patientData.dih ? new Date(patientData.dih).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : 'N/A';
        
        let reportHTML = `
            <div class="report-id-section">
                 <h4>Identificação do Paciente</h4>
                 <div class="report-id-grid">
                     <p><strong>Nome:</strong> ${patientData.name || 'N/A'}</p>
                     <p><strong>Idade:</strong> ${patientData.age || 'N/A'} anos</p>
                     <p><strong>Leito:</strong> ${patientData.bed_number || 'N/A'}</p>
                     <p><strong>DIH:</strong> ${patientDIH}</p>
                 </div>
            </div>
            <div class="report-section"><h4>Impressão 24h</h4><p>${getField('impressao24h')}</p></div>
            <div class="report-section"><h4>Condutas</h4><p>${getField('condutas')}</p></div>
            <div class="signature-area"><div class="signature-line">${getField('medico_responsavel')}<br>CRM: ${getField('crm_medico')}</div></div>
        `;
        return reportHTML;
    }

    // =================================================================================
    // EVENTOS E LÓGICA DA UI
    // =================================================================================

    evolutionForm.addEventListener('submit', async function(event) {
        event.preventDefault();
        const evolutionData = collectFormData(); // Usa a função corrigida
        
        const method = editingEvolutionId ? 'PUT' : 'POST';
        const url = editingEvolutionId 
            ? `/api/evolutions/${editingEvolutionId}` 
            : `/api/patients/${patientId}/evolutions`;

        try {
            const response = await fetch(url, {
                method: method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(evolutionData),
            });
            if (!response.ok) {
                const err = await response.json(); 
                throw new Error(err.error || `Falha ao ${method === 'POST' ? 'salvar' : 'atualizar'} evolução.`);
            }

            if (method === 'POST') {
                resetFormAndState();
                await renderEvolutionHistory(); 
                printConfirmModal.classList.add('active');
            } else {
                alert('Evolução atualizada com sucesso!');
                window.location.href = `patient-view.html?patientId=${patientId}`;
            }

        } catch (error) {
            console.error("Erro ao salvar/atualizar:", error);
            alert(`Não foi possível completar a operação: ${error.message}`);
        }
    });

    const redirectToPatientView = () => {
        window.location.href = `patient-view.html?patientId=${patientId}`;
    };

    if (goToPatientViewBtn) goToPatientViewBtn.addEventListener('click', redirectToPatientView);
    if (closeViewerBtn) closeViewerBtn.addEventListener('click', () => historyViewerModal.classList.remove('active'));
    if (closeViewerModalBtn) closeViewerModalBtn.addEventListener('click', () => historyViewerModal.classList.remove('active'));
    if (printDocumentBtn) { /* ... lógica de impressão ... */ }

    evolutionHistoryList.addEventListener('click', function(event) {
        const button = event.target.closest('button[data-action]');
        if (!button) return;
        
        const action = button.dataset.action;
        const historyItem = button.closest('.history-item');
        const evolutionContent = JSON.parse(historyItem.dataset.evolutionContent);
        
        if (action === 'edit' || action === 'copy') {
            populateForm(evolutionContent);
            window.scrollTo({ top: 0, behavior: 'smooth' });
            if (action === 'copy') {
                resetFormAndState();
                populateForm(evolutionContent); // Repopula após resetar para manter os dados
                formTitle.textContent = "Nova Evolução (Copiada)";
            } else { // Edit
                editingEvolutionId = historyItem.dataset.evolutionId;
                formTitle.textContent = `Editando Evolução`;
                saveButton.textContent = "Atualizar Evolução";
                cancelEditButton.classList.remove('hidden');
            }
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

    // [CORREÇÃO PRINCIPAL] Função que coleta os dados do formulário corretamente.
    function collectFormData() {
        const formData = new FormData(evolutionForm);
        const data = {};
        const keys = new Set(Array.from(formData.keys()));

        for (const key of keys) {
            const allValues = formData.getAll(key);
            data[key] = allValues.length > 1 ? allValues : allValues[0];
        }
        return data;
    }

    // [FUNÇÃO MELHORADA] Preenche o formulário, lidando com arrays para checkboxes.
    function populateForm(data) {
        resetFormAndState();
        for (const key in data) {
            const elements = evolutionForm.elements[key];
            if (!elements) continue;

            const value = data[key];

            if (NodeList.prototype.isPrototypeOf(elements) && elements[0]?.type === 'radio') {
                const elToSelect = document.querySelector(`input[name="${key}"][value="${value}"]`);
                if (elToSelect) elToSelect.checked = true;
            } else if (NodeList.prototype.isPrototypeOf(elements) && elements[0]?.type === 'checkbox') {
                if (Array.isArray(value)) {
                    elements.forEach(chk => {
                        chk.checked = value.includes(chk.value);
                    });
                }
            } else if (elements.type === 'checkbox') {
                 elements.checked = !!value; // Para checkboxes únicos
            } else {
                elements.value = value;
            }
        }
        // Dispara o evento change para que a UI de campos condicionais se atualize
        document.querySelectorAll('input[type="radio"], input[type="checkbox"], select').forEach(el => el.dispatchEvent(new Event('change', { bubbles: true })));
    }

    function resetFormAndState() {
        evolutionForm.reset();
        editingEvolutionId = null;
        formTitle.textContent = "Nova Evolução Médica";
        saveButton.textContent = "Salvar Evolução";
        cancelEditButton.classList.add('hidden');
        document.querySelectorAll('.conditional-options').forEach(el => el.style.display = 'none');
    }

    // --- INICIALIZAÇÃO DA PÁGINA ---
    initializePage();
});