document.addEventListener('DOMContentLoaded', function() {

    // =================================================================================
    // SELEÇÃO DE ELEMENTOS
    // =================================================================================
    const params = new URLSearchParams(window.location.search);
    const patientId = params.get('patientId');

    const backLink = document.querySelector('.back-link');
    const patientNameHeader = document.getElementById('patientNameHeader');
    const patientAgeEl = document.getElementById('patientAge');
    const patientCnsEl = document.getElementById('patientCns');
    const patientDihEl = document.getElementById('patientDih');
    const patientHdEl = document.getElementById('patientHd');
    const patientHppEl = document.getElementById('patientHpp');
    const patientDaysInIcuEl = document.getElementById('patientDaysInIcu');

    const admissionContainer = document.getElementById('admission-info-container');
    const patientBedEl = document.getElementById('patientBed');
    const dischargeContainer = document.getElementById('discharge-info-container');
    const dischargeReasonEl = document.getElementById('dischargeReason');
    const dischargeDateEl = document.getElementById('dischargeDate');
    const readmitPatientBtn = document.getElementById('readmitPatientBtn');
    
    const readmitModal = document.getElementById('readmitModal');
    const readmitForm = document.getElementById('readmitForm');
    const readmitPatientNameEl = document.getElementById('readmitPatientName');
    const closeReadmitModalBtn = document.getElementById('closeReadmitModal');
    const cancelReadmitBtn = document.getElementById('cancelReadmitBtn');
    const confirmReadmitBtn = document.getElementById('confirmReadmitBtn');
    const readmitUnitSelect = document.getElementById('readmitUnitSelect');
    const readmitBedSelect = document.getElementById('readmitBedSelect');
    const readmissionDateInput = document.getElementById('readmissionDate');
    let unitsWithFreeBeds = [];
    const readmitHdPrimaryDesc = document.getElementById('readmit_hd_primary_desc');
    const readmitHdPrimaryResults = document.getElementById('readmit_hd_primary_results');
    const readmitHdPrimaryCid = document.getElementById('readmit_hd_primary_cid');
    const readmitAddSecondaryDiagBtn = document.getElementById('readmit_add_secondary_diag_btn');
    const readmitSecondaryDiagnosesContainer = document.getElementById('readmit_secondary_diagnoses_container');
    
    const historyList = document.getElementById('historyList');
    const goToEvolutionBtn = document.getElementById('goToEvolutionBtn');
    const goToPrescriptionBtn = document.getElementById('goToPrescriptionBtn');
    const historyViewerModal = document.getElementById('historyViewerModal');
    const viewerTitle = document.getElementById('viewerTitle');
    const viewerContent = document.getElementById('viewerContent');
    const closeViewerBtn = document.getElementById('closeViewerBtn');
    const printDocumentBtn = document.getElementById('printDocumentBtn');
    
    let cid10Data = [];
    let cidTimeout;

    if (!patientId) {
        document.body.innerHTML = '<h1>Erro: ID do paciente não fornecido.</h1><a href="dashboard.html">Voltar</a>';
        return;
    }

    // =================================================================================
    // FUNÇÕES AUXILIARES DE CÁLCULO
    // =================================================================================
    function calculateAge(dobString) {
        if (!dobString) return 'N/A';
        const birthDate = new Date(dobString);
        birthDate.setMinutes(birthDate.getMinutes() + birthDate.getTimezoneOffset());
        const today = new Date();
        if (birthDate > today) return 'Data de nascimento futura';
        let years = today.getFullYear() - birthDate.getFullYear();
        let months = today.getMonth() - birthDate.getMonth();
        let days = today.getDate() - birthDate.getDate();
        if (days < 0) {
            months--;
            const lastMonth = new Date(today.getFullYear(), today.getMonth(), 0);
            days += lastMonth.getDate();
        }
        if (months < 0) {
            years--;
            months += 12;
        }
        const parts = [];
        if (years > 0) parts.push(`${years} ${years > 1 ? 'anos' : 'ano'}`);
        if (months > 0) parts.push(`${months} ${months > 1 ? 'meses' : 'mês'}`);
        if (days >= 0 && parts.length < 2) {
             parts.push(`${days} ${days === 1 ? 'dia' : 'dias'}`);
        }
        return parts.join(', ') || 'Hoje';
    }
    
    function calculateIcuDays(admissionDateString) {
        if (!admissionDateString) return 'N/A';
        const admissionDate = new Date(admissionDateString);
        const today = new Date();
        admissionDate.setHours(0, 0, 0, 0);
        today.setHours(0, 0, 0, 0);
        if (admissionDate > today) return 'N/A';
        const diffTime = Math.abs(today - admissionDate);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
        return `${diffDays} ${diffDays === 1 ? 'dia' : 'dias'}`;
    }

    // =================================================================================
    // FUNÇÕES DE LÓGICA PRINCIPAL E RENDERIZAÇÃO
    // =================================================================================
    async function loadCidData() {
        try {
            const response = await fetch('data/cid10.json'); 
            if (!response.ok) throw new Error('Não foi possível carregar a lista de CIDs.');
            cid10Data = await response.json();
        } catch (error) {
            console.error(error);
        }
    }

    async function loadPageData() {
        try {
            const response = await fetch(`/api/patients/${patientId}`);
            if (!response.ok) throw new Error('Paciente não encontrado ou erro no servidor.');
            const result = await response.json();
            const patient = result.data;
            renderPatientInfo(patient);
            updateActionLinks(patient.id);
            loadHistory(patient);
        } catch (error) {
            console.error("Erro ao carregar dados da página:", error);
            document.body.innerHTML = `<h1>Erro ao carregar dados do paciente.</h1><p>${error.message}</p>`;
        }
    }

    function renderPatientInfo(patient) {
        patientNameHeader.textContent = patient.name || 'Nome não encontrado';
        if(patientAgeEl) patientAgeEl.textContent = calculateAge(patient.dob);
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

        if (backLink) {
            if (patient.unit_id) {
                backLink.href = `unit-view.html?unitId=${patient.unit_id}`;
            } else {
                backLink.href = 'dashboard.html';
            }
        }

        if (patient.discharge_date) {
            admissionContainer.style.display = 'none';
            dischargeContainer.style.display = 'block';
            if (patientDaysInIcuEl) patientDaysInIcuEl.parentElement.style.display = 'none';
            const dischargeReasons = { 'alta_enfermaria': 'Alta para Enfermaria', 'alta_domiciliar': 'Alta Domiciliar', 'obito': 'Óbito', 'transferencia_externa': 'Transferência Externa' };
            dischargeReasonEl.textContent = dischargeReasons[patient.discharge_reason] || patient.discharge_reason;
            dischargeDateEl.textContent = new Date(patient.discharge_date).toLocaleDateString('pt-BR', { timeZone: 'UTC' });
            if (patient.discharge_reason === 'obito') {
                readmitPatientBtn.textContent = 'Paciente em Óbito';
                readmitPatientBtn.disabled = true;
            } else {
                readmitPatientBtn.addEventListener('click', () => openReadmitModal(patient));
            }
        } else {
            admissionContainer.style.display = 'block';
            dischargeContainer.style.display = 'none';
            if(patientBedEl) patientBedEl.textContent = `${patient.unit_name || 'Unidade'} - Leito ${patient.bed_number || 'N/A'}`;
            if (patientDaysInIcuEl) {
                patientDaysInIcuEl.parentElement.style.display = 'inline';
                // ATUALIZADO: Usa a data de criação da internação para o cálculo
                patientDaysInIcuEl.textContent = calculateIcuDays(patient.icu_admission_date);
            }
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
                buttonsHTML = `<button class="button-secondary" data-action="view" ${isDisabled ? 'disabled' : ''}>Visualizar/Imprimir</button><button class="button-secondary" data-action="copy" ${isDisabled ? 'disabled' : ''}>Copiar para Nova</button><button class="button-secondary" data-action="edit" ${isDisabled ? 'disabled' : ''}>Editar</button><button class="button-danger" data-action="delete" ${isDisabled ? 'disabled' : ''}>Excluir</button> `;
            } else if (item.type === 'Receituário') {
                buttonsHTML = `<button class="button-secondary" data-action="view">Visualizar/Imprimir</button>`;
            }
            historyItemDiv.innerHTML = `<div class="history-item-content"><div class="history-item-title">${item.type} - ${formattedCreationDate} às ${formattedCreationTime}${editedText}</div><div class="history-item-actions">${buttonsHTML}</div></div>`;
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
        return `<div class="report-header"><h3>Evolução Médica Diária</h3><p>Intensive Care Brasil</p></div><div class="report-id-section"><h4>Identificação do Paciente</h4><div class="report-id-grid"><p><strong>Nome:</strong> ${patientData.name || 'N/A'}</p><p><strong>Idade:</strong> ${calculateAge(patientData.dob)}</p><p><strong>Leito:</strong> ${patientData.bed_number || 'N/A'}</p><p><strong>DIH:</strong> ${patientDIH}</p></div></div><div class="report-section"><h4>Impressão 24h</h4><p>${getField('impressao24h')}</p></div><div class="report-section"><h4>Condutas</h4><p>${getField('condutas')}</p></div><div class="signature-area"><div class="signature-line">${getField('medico_responsavel')}<br>CRM: ${getField('crm_medico')}</div></div>`;
    }
    
    function searchCid(query, resultsContainer) {
        if (!resultsContainer) return;
        resultsContainer.innerHTML = '';
        if (query.length < 2) {
            resultsContainer.classList.remove('active');
            return;
        }
        const lowerCaseQuery = query.toLowerCase();
        const results = cid10Data.filter(item => 
            (item.display && item.display.toLowerCase().includes(lowerCaseQuery)) || 
            (item.code && item.code.toLowerCase().includes(lowerCaseQuery))
        ).slice(0, 10);
        if (results.length > 0) {
            results.forEach(item => {
                const div = document.createElement('div');
                div.className = 'autocomplete-item';
                div.textContent = `${item.code} - ${item.display}`;
                div.dataset.cid = item.code;
                div.dataset.nome = item.display;
                resultsContainer.appendChild(div);
            });
        } else {
            resultsContainer.innerHTML = '<div class="autocomplete-item error-item">Nenhum resultado encontrado.</div>';
        }
        resultsContainer.classList.add('active');
    }

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
            const secondaryDiagnoses = [];
            if (readmitSecondaryDiagnosesContainer) {
                readmitSecondaryDiagnosesContainer.querySelectorAll('.secondary-diagnosis-entry').forEach(entry => {
                    const desc = entry.querySelector('.secondary_desc').value.trim();
                    const cid = entry.querySelector('.secondary_cid').value.trim();
                    if (desc) { secondaryDiagnoses.push({ desc, cid }); }
                });
            }
            const readmissionData = {
                bed_id: readmitBedSelect.value,
                dih: readmissionDateInput.value,
                hd_primary_desc: readmitHdPrimaryDesc.value.trim(),
                hd_primary_cid: readmitHdPrimaryCid.value.trim(),
                secondary_diagnoses: secondaryDiagnoses
            };
            if (!readmissionData.bed_id || !readmissionData.dih) {
                alert('Por favor, selecione a unidade, o leito e a data de reinternação.');
                return;
            }
            try {
                const response = await fetch(`/api/patients/${patientId}/readmit`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(readmissionData)
                });
                if (!response.ok) throw new Error((await response.json()).error || 'Falha ao processar reinternação.');
                alert('Paciente reinternado com sucesso!');
                window.location.reload();
            } catch (error) {
                alert(`Erro: ${error.message}`);
            }
        });
    }

    if(readmitForm) {
        readmitForm.addEventListener('input', (e) => {
            const targetInput = e.target;
            let resultsContainer;
            if (targetInput.id === 'readmit_hd_primary_desc') {
                resultsContainer = document.getElementById('readmit_hd_primary_results');
            } else if (targetInput.classList.contains('secondary_desc')) {
                resultsContainer = targetInput.closest('.autocomplete-container').querySelector('.autocomplete-results');
            }
            if (resultsContainer) {
                clearTimeout(cidTimeout);
                cidTimeout = setTimeout(() => searchCid(targetInput.value, resultsContainer), 150);
            }
        });
        readmitForm.addEventListener('click', function(e) {
            const item = e.target.closest('.autocomplete-item');
            if (item && !item.classList.contains('error-item')) {
                const container = item.parentElement;
                const parentGroup = container.closest('.form-group') || container.closest('.secondary-diagnosis-entry');
                if (parentGroup) {
                    const descInput = parentGroup.querySelector('#readmit_hd_primary_desc, .secondary_desc');
                    const cidInput = parentGroup.querySelector('#readmit_hd_primary_cid, .secondary_cid');
                    if (descInput && cidInput) {
                        descInput.value = item.dataset.nome;
                        cidInput.value = item.dataset.cid;
                    }
                }
                container.innerHTML = '';
                container.classList.remove('active');
            }
        });
    }

    if (readmitAddSecondaryDiagBtn) {
        readmitAddSecondaryDiagBtn.addEventListener('click', () => {
            const uniqueId = 'readmit_sec_diag_' + Date.now();
            const newEntry = document.createElement('div');
            newEntry.className = 'secondary-diagnosis-entry';
            newEntry.innerHTML = `<div class="autocomplete-container"><label for="${uniqueId}_desc" class="sr-only">Descrição do Diagnóstico Secundário</label><textarea id="${uniqueId}_desc" name="secondary_desc[]" class="secondary_desc" rows="2" placeholder="Comece a digitar o diagnóstico..."></textarea><div class="autocomplete-results"></div></div><label for="${uniqueId}_cid" class="cid-label">CID-10</label><input type="text" id="${uniqueId}_cid" name="secondary_cid[]" class="secondary_cid" placeholder="Ex: A00.1"><button type="button" class="remove-diag-btn">&times;</button>`;
            if (readmitSecondaryDiagnosesContainer) readmitSecondaryDiagnosesContainer.appendChild(newEntry);
        });
    }
    
    if (readmitSecondaryDiagnosesContainer) {
        readmitSecondaryDiagnosesContainer.addEventListener('click', (e) => {
            if (e.target.classList.contains('remove-diag-btn')) {
                e.target.closest('.secondary-diagnosis-entry').remove();
            }
        });
    }

    if(closeReadmitModalBtn) closeReadmitModalBtn.addEventListener('click', closeReadmitModal);
    if(cancelReadmitBtn) cancelReadmitBtn.addEventListener('click', closeReadmitModal);

    // INICIALIZAÇÃO
    loadPageData();
    loadCidData(); 
});