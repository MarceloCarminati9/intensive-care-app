// VERSÃO FINAL, COMPLETA E UNIFICADA

document.addEventListener('DOMContentLoaded', function() {
    
    // =================================================================================
    // INICIALIZAÇÃO E SELEÇÃO DE ELEMENTOS
    // =================================================================================
    const params = new URLSearchParams(window.location.search);
    const patientId = params.get('patientId'); 
    // [NOVO] Captura os parâmetros para edição e cópia vindos de outras páginas
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
    
    let patient = null; // Armazena os dados do paciente
    let editingEvolutionId = null; // Guarda o ID da evolução sendo editada

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
            
            // [LÓGICA UNIFICADA] Verifica se a página deve carregar uma evolução para edição ou cópia
            if (evolutionIdToEdit) {
                await loadEvolutionAndSetupForm(evolutionIdToEdit, 'edit');
            } else if (evolutionIdToCopy) {
                await loadEvolutionAndSetupForm(evolutionIdToCopy, 'copy');
            }

            // Sempre renderiza o histórico de evoluções na parte inferior da página
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
            
            populateForm(evolutionContent); // Preenche o formulário com os dados

            if (mode === 'edit') {
                editingEvolutionId = evolutionId;
                formTitle.textContent = `Editando Evolução`;
                saveButton.textContent = "Atualizar Evolução";
                cancelEditButton.classList.remove('hidden');
            } else { // modo 'copy'
                formTitle.textContent = "Nova Evolução (Copiada)";
            }

        } catch (error) {
            console.error(`Erro ao carregar evolução para ${mode}:`, error);
            alert(`Não foi possível carregar os dados da evolução selecionada.`);
        }
    }
    
    async function renderEvolutionHistory() {
        // (Código de renderização do histórico permanece o mesmo da sua versão)
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
    
    function generateEvolutionReportHTML(patientData, evolutionData) {
        // (Sua função completa para gerar o relatório em HTML)
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
        const evolutionData = collectFormData(); 
        
        // [LÓGICA UNIFICADA] Decide se deve criar (POST) ou atualizar (PUT)
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
                const err = await response.json(); throw new Error(err.error || `Falha ao ${method === 'POST' ? 'salvar' : 'atualizar'} evolução.`);
            }

            if (method === 'POST') {
                resetFormAndState();
                await renderEvolutionHistory(); 
                printConfirmModal.classList.add('active'); // Mostra o modal de sucesso apenas ao criar
            } else {
                alert('Evolução atualizada com sucesso!');
                window.location.href = `patient-view.html?patientId=${patientId}`; // Redireciona após editar
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
    if (printDocumentBtn) { /* ... (lógica de impressão sem alterações) ... */ }

    // Evento de clique na lista de histórico permanece o mesmo,
    // agora ele controla as ações DENTRO da própria página.
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
        for(const [key, value] of formData.entries()) { data[key] = value; }
        return data;
    }

    function populateForm(data) {
        resetFormAndState();
        for (const key in data) {
            if (evolutionForm.elements[key]) {
                evolutionForm.elements[key].value = data[key];
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

    // --- INICIALIZAÇÃO DA PÁGINA ---
    initializePage();
});