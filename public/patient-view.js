document.addEventListener('DOMContentLoaded', function() {

    // =================================================================================
    // SELEÇÃO DE ELEMENTOS (EXISTENTES E NOVOS)
    // =================================================================================
    const params = new URLSearchParams(window.location.search);
    const patientId = params.get('patientId');

    // Elementos do Cabeçalho e Detalhes
    const patientNameHeader = document.getElementById('patientNameHeader');
    const patientAgeEl = document.getElementById('patientAge');
    const patientCnsEl = document.getElementById('patientCns');
    const patientDihEl = document.getElementById('patientDih');
    const patientHdEl = document.getElementById('patientHd');
    const patientHppEl = document.getElementById('patientHpp');

    // Container de Status: Internado
    const admissionContainer = document.getElementById('admission-info-container');
    const patientBedEl = document.getElementById('patientBed');
    
    // Container de Status: Alta
    const dischargeContainer = document.getElementById('discharge-info-container');
    const dischargeReasonEl = document.getElementById('dischargeReason');
    const dischargeDateEl = document.getElementById('dischargeDate');
    const readmitPatientBtn = document.getElementById('readmitPatientBtn');

    // Modal de Reinternação
    const readmitModal = document.getElementById('readmitModal');
    const readmitPatientNameEl = document.getElementById('readmitPatientName');
    const closeReadmitModalBtn = document.getElementById('closeReadmitModal');
    const cancelReadmitBtn = document.getElementById('cancelReadmitBtn');
    const confirmReadmitBtn = document.getElementById('confirmReadmitBtn');
    const readmitUnitSelect = document.getElementById('readmitUnitSelect');
    const readmitBedSelect = document.getElementById('readmitBedSelect');
    const readmissionDateInput = document.getElementById('readmissionDate');
    let unitsWithFreeBeds = [];

    // Elementos do Histórico
    const historyList = document.getElementById('historyList');
    const goToEvolutionBtn = document.getElementById('goToEvolutionBtn');
    const goToPrescriptionBtn = document.getElementById('goToPrescriptionBtn');
    const historyViewerModal = document.getElementById('historyViewerModal');
    const viewerTitle = document.getElementById('viewerTitle');
    const viewerContent = document.getElementById('viewerContent');
    const closeViewerBtn = document.getElementById('closeViewerBtn');
    const printDocumentBtn = document.getElementById('printDocumentBtn');

    if (!patientId) {
        document.body.innerHTML = '<h1>Erro: ID do paciente não fornecido.</h1><a href="dashboard.html">Voltar</a>';
        return;
    }

    // =================================================================================
    // FUNÇÕES DE RENDERIZAÇÃO E LÓGICA
    // =================================================================================

    async function loadPageData() {
        try {
            const response = await fetch(`/api/patients/${patientId}`);
            if (!response.ok) throw new Error('Paciente não encontrado ou erro no servidor.');
            
            const result = await response.json();
            const patient = result.data;

            // *** LINHA DE DIAGNÓSTICO IMPORTANTE ***
            console.log("Dados do paciente recebidos do servidor:", patient);

            renderPatientInfo(patient);
            updateActionLinks(patient.id);
            loadHistory(patient);

        } catch (error) {
            console.error("Erro ao carregar dados da página:", error);
            document.body.innerHTML = `<h1>Erro ao carregar dados do paciente.</h1><p>${error.message}</p>`;
        }
    }

    function renderPatientInfo(patient) {
        // 1. Preenche os dados gerais que aparecem sempre
        patientNameHeader.textContent = patient.name || 'Nome não encontrado';
        if(patientAgeEl) patientAgeEl.textContent = patient.age ? `${patient.age} anos` : 'N/A';
        if(patientCnsEl) patientCnsEl.textContent = patient.cns || 'N/A';
        if(patientDihEl) patientDihEl.textContent = patient.dih ? new Date(patient.dih).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : 'N/A';
        
        if (patientHppEl) patientHppEl.textContent = patient.hpp || 'Nenhuma informação de HPP cadastrada.';
        
        if (patientHdEl) {
            let hdContent = '';
            if (patient.hd_primary_desc) {
                const primaryCid = patient.hd_primary_cid ? `(${patient.hd_primary_cid})` : '';
                hdContent += `<p><strong>Primário:</strong> ${patient.hd_primary_desc} ${primaryCid}</p>`;
            }
            if (patient.secondary_diagnoses && patient.secondary_diagnoses.length > 0) {
                hdContent += '<strong>Secundários:</strong><ul>';
                patient.secondary_diagnoses.forEach(diag => {
                    const secondaryCid = diag.cid ? `(${diag.cid})` : '';
                    hdContent += `<li>${diag.desc} ${secondaryCid}</li>`;
                });
                hdContent += '</ul>';
            }
            patientHdEl.innerHTML = hdContent || '<p>Nenhuma hipótese diagnóstica cadastrada.</p>';
        }

        // 2. Lógica condicional para exibir o status correto
        if (patient.discharge_date) {
            // PACIENTE COM ALTA
            admissionContainer.style.display = 'none';
            dischargeContainer.style.display = 'block';

            const dischargeReasons = {
                'alta_enfermaria': 'Alta para Enfermaria',
                'alta_domiciliar': 'Alta Domiciliar',
                'obito': 'Óbito',
                'transferencia_externa': 'Transferência Externa'
            };
            dischargeReasonEl.textContent = dischargeReasons[patient.discharge_reason] || patient.discharge_reason;
            dischargeDateEl.textContent = new Date(patient.discharge_date).toLocaleDateString('pt-BR', { timeZone: 'UTC' });

            if (patient.discharge_reason === 'obito') {
                readmitPatientBtn.textContent = 'Paciente em Óbito';
                readmitPatientBtn.disabled = true;
            } else {
                readmitPatientBtn.addEventListener('click', () => openReadmitModal(patient));
            }
        } else {
            // PACIENTE INTERNADO
            admissionContainer.style.display = 'block';
            dischargeContainer.style.display = 'none';
            if(patientBedEl) patientBedEl.textContent = `${patient.unit_name || 'Unidade'} - Leito ${patient.bed_number || 'N/A'}`;
        }
    }

    async function loadHistory(patientData) {
        try {
            const [evolutionsResponse, prescriptionsResponse] = await Promise.all([
                fetch(`/api/patients/${patientData.id}/evolutions`),
                fetch(`/api/patients/${patientData.id}/prescriptions`)
            ]);

            if (!evolutionsResponse.ok || !prescriptionsResponse.ok) {
                throw new Error('Falha ao buscar o histórico do paciente.');
            }

            const evolutionsResult = await evolutionsResponse.json();
            const prescriptionsResult = await prescriptionsResponse.json();

            const combinedHistory = [
                ...(evolutionsResult.data || []).map(item => ({ ...item, type: 'Evolução Médica' })),
                ...(prescriptionsResult.data || []).map(item => ({ ...item, type: 'Receituário' }))
            ];
            
            renderHistoryList(combinedHistory, patientData);
        } catch(error) {
            console.error("Erro ao carregar histórico:", error);
            if(historyList) historyList.innerHTML = `<p style="color:red;">Não foi possível carregar o histórico.</p>`;
        }
    }
    
    function renderHistoryList(history, patientData) {
        if (!historyList) return;
        historyList.innerHTML = '';
        if (!history || history.length === 0) {
            historyList.innerHTML = '<p>Nenhum histórico de evoluções ou receitas encontrado.</p>';
            return;
        }

        history.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        
        history.forEach(item => {
            const historyItemDiv = document.createElement('div');
            historyItemDiv.className = `history-item ${item.deleted_at ? 'deleted' : ''}`;
            historyItemDiv.dataset.item = JSON.stringify(item); 
            historyItemDiv.dataset.patient = JSON.stringify(patientData);

            const createdAt = new Date(item.created_at);
            const updatedAt = item.updated_at ? new Date(item.updated_at) : null;
            let editedText = '';

            if (item.type === 'Evolução Médica' && updatedAt && (updatedAt.getTime() - createdAt.getTime() > 60000)) {
                const formattedEditDate = updatedAt.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
                const formattedEditTime = updatedAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                editedText = `<span class="edited-status">(editada em ${formattedEditDate} às ${formattedEditTime})</span>`;
            }
            
            const formattedCreationDate = createdAt.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
            const formattedCreationTime = createdAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

            let buttonsHTML = '';
            if (item.type === 'Evolução Médica') {
                const isDisabled = !!item.deleted_at;
                buttonsHTML = `
                    <button class="button-secondary" data-action="view" ${isDisabled ? 'disabled' : ''}>Visualizar/Imprimir</button>
                    <button class="button-secondary" data-action="copy" ${isDisabled ? 'disabled' : ''}>Copiar para Nova</button>
                    <button class="button-secondary" data-action="edit" ${isDisabled ? 'disabled' : ''}>Editar</button>
                    <button class="button-danger" data-action="delete" ${isDisabled ? 'disabled' : ''}>Excluir</button> 
                `;
            } else if (item.type === 'Receituário') {
                buttonsHTML = `<button class="button-secondary" data-action="view">Visualizar/Imprimir</button>`;
            }

            historyItemDiv.innerHTML = `
                <div class="history-item-content">
                    <div class="history-item-title">${item.type} - ${formattedCreationDate} às ${formattedCreationTime}${editedText}</div>
                    <div class="history-item-actions">${buttonsHTML}</div>
                </div>
            `;
            historyList.appendChild(historyItemDiv);
        });
    }

    function updateActionLinks(pId) {
        if (goToEvolutionBtn) goToEvolutionBtn.href = `patient-evolution.html?patientId=${pId}`;
        if (goToPrescriptionBtn) goToPrescriptionBtn.href = `receita.html?patientId=${pId}`;
    }

    function generateEvolutionReportHTML(patientData, evolutionContent) {
        if (!patientData || !evolutionContent) return '<p>Dados insuficientes para gerar o relatório.</p>';
        const getField = (field) => evolutionContent[field] || 'N/A';
        const patientDIH = patientData.dih ? new Date(patientData.dih).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : 'N/A';
        
        return `
            <div class="report-header"><h3>Evolução Médica Diária</h3><p>Intensive Care Brasil</p></div>
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
    }

    // Lógica dos listeners de histórico
    if (historyList) {
        historyList.addEventListener('click', async function(event) {
            const button = event.target.closest('button[data-action]');
            if (!button) return;

            const action = button.dataset.action;
            const historyItemDiv = button.closest('.history-item');
            const itemData = JSON.parse(historyItemDiv.dataset.item);
            const patientData = JSON.parse(historyItemDiv.dataset.patient);

            if (action === 'delete') {
                if (confirm(`Tem certeza que deseja excluir esta evolução?\n\nEla permanecerá no histórico, mas não poderá ser editada ou copiada.`)) {
                    try {
                        const response = await fetch(`/api/evolutions/${itemData.id}`, { method: 'DELETE' });
                        if (!response.ok) throw new Error('Falha ao excluir a evolução no servidor.');
                        await loadPageData();
                    } catch (error) {
                        console.error('Erro ao excluir evolução:', error);
                        alert(error.message);
                    }
                }
                return;
            }

            switch(action) {
                case 'view':
                    viewerTitle.textContent = `Visualizar ${itemData.type}`;
                    let contentHtml = '';
                    if (itemData.type === 'Receituário') {
                        contentHtml = `<div class="report-section"><h4>Medicamento</h4><p>${itemData.medicamento}</p></div><div class="report-section"><h4>Posologia</h4><p>${itemData.posologia}</p></div>`;
                    } else if (itemData.type === 'Evolução Médica') {
                        contentHtml = generateEvolutionReportHTML(patientData, itemData.content);
                    }
                    viewerContent.innerHTML = contentHtml;
                    historyViewerModal.classList.add('active');
                    break;
                case 'edit':
                    window.location.href = `patient-evolution.html?patientId=${patientId}&evolutionId=${itemData.id}`;
                    break;
                case 'copy':
                     window.location.href = `patient-evolution.html?patientId=${patientId}&copyFromId=${itemData.id}`;
                    break;
            }
        });
    }

    if (closeViewerBtn) closeViewerBtn.addEventListener('click', () => historyViewerModal.classList.remove('active'));
    if (printDocumentBtn) {
        printDocumentBtn.addEventListener('click', () => {
            const printWindow = window.open('', '_blank');
            const styles = Array.from(document.styleSheets)
                .map(sheet => `<link rel="stylesheet" href="${sheet.href}">`)
                .join('');
            printWindow.document.write(`<html><head><title>Imprimir</title>${styles}</head><body><div class="report-view">${viewerContent.innerHTML}</div></body></html>`);
            printWindow.document.close();
            setTimeout(() => {
                printWindow.print();
                printWindow.close();
            }, 500);
        });
    }

    // Lógica de reinternação
    async function openReadmitModal(patient) {
        if (!readmitModal) return;
        readmitPatientNameEl.textContent = patient.name;
        const now = new Date();
        now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
        readmissionDateInput.value = now.toISOString().slice(0, 16);

        try {
            const response = await fetch('/api/units-with-free-beds');
            if (!response.ok) throw new Error('Falha ao buscar unidades');
            unitsWithFreeBeds = (await response.json()).data;
            readmitUnitSelect.innerHTML = '<option value="">Selecione a unidade...</option>';
            unitsWithFreeBeds.forEach(unit => {
                const option = document.createElement('option');
                option.value = unit.id;
                option.textContent = `${unit.name} (${unit.free_beds ? unit.free_beds.length : 0} leitos livres)`;
                option.disabled = !unit.free_beds || unit.free_beds.length === 0;
                readmitUnitSelect.appendChild(option);
            });
        } catch (error) {
            alert('Não foi possível carregar as unidades para reinternação.');
            return;
        }
        readmitModal.classList.add('active');
    }

    function closeReadmitModal() {
        if(readmitModal) {
            readmitModal.classList.remove('active');
            readmitBedSelect.innerHTML = '<option value="">Selecione um leito livre...</option>';
            readmitBedSelect.disabled = true;
        }
    }

    if(readmitUnitSelect) {
        readmitUnitSelect.addEventListener('change', () => {
            const selectedUnitId = readmitUnitSelect.value;
            const selectedUnit = unitsWithFreeBeds.find(u => u.id == selectedUnitId);
            readmitBedSelect.innerHTML = '<option value="">Selecione um leito livre...</option>';
            if(selectedUnit && selectedUnit.free_beds) {
                selectedUnit.free_beds.forEach(bed => {
                    const option = document.createElement('option');
                    option.value = bed.id;
                    option.textContent = `Leito ${bed.bed_number}`;
                    readmitBedSelect.appendChild(option);
                });
                readmitBedSelect.disabled = false;
            } else {
                readmitBedSelect.disabled = true;
            }
        });
    }
    
    if(confirmReadmitBtn) {
        confirmReadmitBtn.addEventListener('click', async () => {
            const newBedId = readmitBedSelect.value;
            const newAdmissionDate = readmissionDateInput.value;
            if (!newBedId || !newAdmissionDate) {
                alert('Por favor, selecione a unidade, o leito e a data de reinternação.');
                return;
            }
            try {
                const response = await fetch(`/api/patients/${patientId}/readmit`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ bed_id: newBedId, dih: newAdmissionDate })
                });
                if (!response.ok) throw new Error((await response.json()).error || 'Falha ao processar reinternação.');
                alert('Paciente reinternado com sucesso!');
                window.location.reload();
            } catch (error) {
                alert(`Erro: ${error.message}`);
            }
        });
    }

    if(closeReadmitModalBtn) closeReadmitModalBtn.addEventListener('click', closeReadmitModal);
    if(cancelReadmitBtn) cancelReadmitBtn.addEventListener('click', closeReadmitModal);

    // INICIALIZAÇÃO
    loadPageData();
});