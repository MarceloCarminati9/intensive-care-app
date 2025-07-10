// VERSÃO FINAL, COMPLETA E CORRIGIDA

document.addEventListener('DOMContentLoaded', function() {
    
    // =================================================================================
    // INICIALIZAÇÃO E SELEÇÃO DE ELEMENTOS
    // =================================================================================
    const params = new URLSearchParams(window.location.search);
    // [CORREÇÃO] Buscando o parâmetro correto 'patientId'
    const patientId = params.get('patientId'); 

    const patientNameHeader = document.getElementById('patientNameHeader');
    const backToPatientViewLink = document.getElementById('backToPatientViewLink');
    const evolutionHistoryList = document.getElementById('evolutionHistoryList');
    const evolutionForm = document.getElementById('evolutionForm');
    const formTitle = document.getElementById('formTitle');
    const saveButton = document.getElementById('saveEvolutionButton');
    const cancelEditButton = document.getElementById('cancelEditButton');

    const printConfirmModal = document.getElementById('printConfirmModal');
    const printConfirmYes = document.getElementById('printConfirmYes');
    const printConfirmNo = document.getElementById('printConfirmNo');
    
    const historyViewerModal = document.getElementById('historyViewerModal');
    const viewerTitle = document.getElementById('viewerTitle');
    const viewerContent = document.getElementById('viewerContent');
    const closeViewerBtn = document.getElementById('closeViewerBtn');
    
    let patient = null;
    let editingEvolutionId = null;

    if (!patientId) {
        patientNameHeader.textContent = "ERRO: ID do Paciente não encontrado na URL.";
        patientNameHeader.style.color = 'red';
        evolutionForm.style.display = 'none'; // Esconde o formulário se não houver ID
        return;
    }
    
    // =================================================================================
    // LÓGICA DE DADOS E RENDERIZAÇÃO (REFEITA PARA USAR A API)
    // =================================================================================

    async function loadPatientAndHistory() {
        try {
            // 1. Busca os dados do paciente
            const patientResponse = await fetch(`/api/patients/${patientId}`);
            if (!patientResponse.ok) throw new Error("Não foi possível carregar os dados do paciente.");
            const patientResult = await patientResponse.json();
            patient = patientResult.data;

            // 2. Atualiza o cabeçalho e o link de voltar
            patientNameHeader.textContent = patient.name;
            // [CORREÇÃO] Garantindo que o link de voltar use 'patientId'
            backToPatientViewLink.href = `patient-view.html?patientId=${patientId}`;
            
            // 3. Busca e renderiza o histórico de evoluções separadamente
            await renderEvolutionHistory();
        } catch (error) {
            console.error("Erro ao carregar dados:", error);
            document.querySelector('main').innerHTML = `<p style="color: red; text-align: center;">${error.message}</p>`;
        }
    }

    async function renderEvolutionHistory() {
        try {
            // Lógica de busca refatorada para chamar a API de evoluções
            const response = await fetch(`/api/patients/${patientId}/evolutions`);
            if (!response.ok) throw new Error("Falha ao buscar histórico de evoluções.");
            
            const result = await response.json();
            const evolutions = result.data || [];

            evolutionHistoryList.innerHTML = '';
            if (evolutions.length === 0) {
                evolutionHistoryList.innerHTML = '<p>Nenhuma evolução anterior encontrada para este paciente.</p>';
                return;
            }

            // A ordenação já vem do backend, mas podemos garantir aqui
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
    // EVENTOS E LÓGICA DA UI
    // =================================================================================

    evolutionForm.addEventListener('submit', async function(event) {
        event.preventDefault();
        const evolutionData = collectFormData(); 
        
        try {
            // Lógica de salvamento refatorada para usar a API
            const response = await fetch(`/api/patients/${patientId}/evolutions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(evolutionData),
            });

            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.error || 'Falha ao salvar evolução.');
            }
            
            // Sucesso!
            resetFormAndState();
            await renderEvolutionHistory(); 
            printConfirmModal.classList.add('active'); 
            
        } catch (error) {
            console.error("Erro ao salvar:", error);
            alert(`Não foi possível salvar a evolução: ${error.message}`);
        }
    });

    // [CORREÇÃO] Lógica simplificada e corrigida para os botões do modal de impressão
    const redirectToPatientView = () => {
        window.location.href = `patient-view.html?patientId=${patientId}`;
    };

    if (printConfirmYes) printConfirmYes.addEventListener('click', redirectToPatientView);
    if (printConfirmNo) printConfirmNo.addEventListener('click', redirectToPatientView);
    if (closeViewerBtn) closeViewerBtn.addEventListener('click', () => historyViewerModal.classList.remove('active'));

    // Lógica para os botões do histórico (Editar, Visualizar, etc.)
    evolutionHistoryList.addEventListener('click', function(event) {
        const button = event.target.closest('button[data-action]');
        if (!button) return;
        
        const action = button.dataset.action;
        const historyItem = button.closest('.history-item');
        const evolutionId = historyItem.dataset.evolutionId;
        const evolutionContent = JSON.parse(historyItem.dataset.evolutionContent);

        if (action === 'edit') {
            populateForm(evolutionContent);
            editingEvolutionId = evolutionId;
            formTitle.textContent = `Editando Evolução`;
            saveButton.textContent = "Atualizar Evolução";
            cancelEditButton.classList.remove('hidden');
            window.scrollTo({ top: 0, behavior: 'smooth' });
        } else if (action === 'print') {
            openHistoryViewer(evolutionContent, historyItem.querySelector('.history-item-header span').textContent);
        }
    });

    function openHistoryViewer(data, title) {
        viewerTitle.textContent = title;
        // Função para gerar um HTML bonito para a visualização/impressão
        viewerContent.innerHTML = `<h4>Impressão 24h:</h4><p>${data.impressao24h || 'N/A'}</p><h4>Condutas:</h4><p>${data.condutas || 'N/A'}</p>`;
        historyViewerModal.classList.add('active');
    }

    function collectFormData() {
        // Esta função coleta todos os dados do seu formulário e retorna um objeto JSON
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
        // Função para preencher o formulário com dados de uma evolução existente para edição
        resetFormAndState();
        for (const key in data) {
            const value = data[key];
            const element = evolutionForm.elements[key];
            if (element) {
                if (element.type === 'checkbox' || element.type === 'radio') {
                    // Lógica para marcar radios e checkboxes
                    if (Array.isArray(value)) {
                        document.querySelectorAll(`input[name="${key}"]`).forEach(el => {
                            if (value.includes(el.value)) el.checked = true;
                        });
                    } else {
                        const el = document.querySelector(`input[name="${key}"][value="${value}"]`);
                        if (el) el.checked = true;
                    }
                } else {
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