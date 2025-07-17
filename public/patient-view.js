document.addEventListener('DOMContentLoaded', function() {

    // =================================================================================
    // SELEÇÃO DE ELEMENTOS
    // =================================================================================
    const params = new URLSearchParams(window.location.search);
    const patientId = params.get('patientId');

    const backLink = document.getElementById('backLink');
    const patientNameHeader = document.getElementById('patientNameHeader');
    const patientAgeEl = document.getElementById('patientAge');
    const patientCnsEl = document.getElementById('patientCns');
    const patientDihEl = document.getElementById('patientDih');
    const patientHdEl = document.getElementById('patientHd');
    const patientHppEl = document.getElementById('patientHpp');
    const patientDaysInIcuEl = document.getElementById('patientDaysInIcu');
    const patientMotherNameEl = document.getElementById('patientMotherName');
    const patientAllergiesEl = document.getElementById('patientAllergies');
    
    const admissionInfoContainer = document.getElementById('admission-info-container');
    const dischargeInfoContainer = document.getElementById('discharge-info-container');
    const readmitButtonContainer = document.getElementById('readmit-button-container');
    const readmitPatientBtn = document.getElementById('readmitPatientBtn');
    
    // Selecionando todos os botões de ação
    const goToEvolutionBtn = document.getElementById('goToEvolutionBtn');
    const goToPrescriptionBtn = document.getElementById('goToPrescriptionBtn');
    const goToReceitaBtn = document.getElementById('goToReceitaBtn');

    // Elementos do Histórico
    const historyList = document.getElementById('historyList');
    
    // Elementos do Modal de Visualização
    const historyViewerModal = document.getElementById('historyViewerModal');
    const viewerTitle = document.getElementById('viewerTitle');
    const viewerContent = document.getElementById('viewerContent');
    const closeViewerBtn = document.getElementById('closeViewerBtn');
    const printDocumentBtn = document.getElementById('printDocumentBtn');

    // Elementos do Modal de Reinternação
    const readmitModal = document.getElementById('readmitModal');
    const closeReadmitModalBtn = document.getElementById('closeReadmitModal');
    const cancelReadmitBtn = document.getElementById('cancelReadmitBtn');
    const confirmReadmitBtn = document.getElementById('confirmReadmitBtn');
    const readmitPatientNameEl = document.getElementById('readmitPatientName');
    const readmitUnitSelect = document.getElementById('readmitUnitSelect');
    const readmitBedSelect = document.getElementById('readmitBedSelect');
    const readmissionDateInput = document.getElementById('readmissionDate');
    const readmitHdPrimaryDesc = document.getElementById('readmit_hd_primary_desc');
    const readmitHdPrimaryCid = document.getElementById('readmit_hd_primary_cid');
    const readmitSecondaryDiagnosesContainer = document.getElementById('readmit_secondary_diagnoses_container');
    const readmitAddSecondaryDiagBtn = document.getElementById('readmit_add_secondary_diag_btn');
    const readmitForm = document.getElementById('readmitForm');
    
    // Dados em cache
    let cid10Data = [];
    let unitsWithFreeBeds = [];
    
    // =================================================================================
    // CARREGAMENTO E RENDERIZAÇÃO INICIAL
    // =================================================================================

    async function loadPageData() {
        try {
            if (!patientId) {
                throw new Error('ID do Paciente não fornecido na URL.');
            }
            const response = await fetch(`/api/patients/${patientId}`);
            if (!response.ok) {
                 const err = await response.json();
                 throw new Error(err.message || 'Paciente não encontrado ou erro no servidor.');
            }
            
            const result = await response.json();
            const patient = result.data;

            // ===== ATUALIZAÇÃO 1: VERIFICAÇÃO DE SEGURANÇA =====
            // Garante que os dados do paciente existem antes de continuar
            if (!patient || !patient.id) {
                throw new Error("Os dados do paciente recebidos do servidor estão incompletos ou em formato inválido.");
            }
            
            renderPatientInfo(patient);
            updateActionLinks(patient.id);
            loadHistory(patient);

        } catch (error) {
            console.error("Erro ao carregar dados da página:", error);
            const container = document.querySelector('.patient-view-container');
            if (container) {
                 container.innerHTML = `<p style="color: red; text-align: center; font-size: 1.2rem; padding: 40px;">${error.message}</p><a href="dashboard.html" class="back-link" style="text-align:center; display:block;">Voltar ao Dashboard</a>`;
            }
        }
    }

    function calculateAge(dob) {
        if (!dob) return '--';
        const birthDate = new Date(dob);
        const today = new Date();
        let age = today.getFullYear() - birthDate.getFullYear();
        const m = today.getMonth() - birthDate.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
            age--;
        }
        return age;
    }

    function renderPatientInfo(patient) {
        patientNameHeader.textContent = patient.name || 'Nome não encontrado';
        patientAgeEl.textContent = `${calculateAge(patient.dob)} anos`;
        patientCnsEl.textContent = patient.cns || 'Não informado';
        patientMotherNameEl.textContent = patient.mother_name || 'Não informado';
        patientAllergiesEl.textContent = patient.allergies || 'Nenhuma informada';
        patientHppEl.textContent = patient.hpp || 'Nenhuma informada';

        let hds = `<p><strong>Principal:</strong> ${patient.hd_primary_desc || 'N/A'} ${patient.hd_primary_cid ? `(${patient.hd_primary_cid})` : ''}</p>`;
        if (patient.secondary_diagnoses && patient.secondary_diagnoses.length > 0) {
            hds += `<strong>Secundárias:</strong><ul>`;
            patient.secondary_diagnoses.forEach(diag => {
                hds += `<li>${diag.desc} ${diag.cid ? `(${diag.cid})` : ''}</li>`;
            });
            hds += `</ul>`;
        }
        patientHdEl.innerHTML = hds;

        if (patient.discharge_date) {
            admissionInfoContainer.style.display = 'none';
            dischargeInfoContainer.style.display = 'block';
            dischargeInfoContainer.textContent = `Paciente de alta desde ${new Date(patient.discharge_date).toLocaleDateString('pt-BR')}`;
            readmitButtonContainer.style.display = 'block';
            document.querySelector('.actions-grid').style.display = 'none';
        } else {
            const admissionDate = new Date(patient.dih);
            const today = new Date();
            const diffTime = Math.abs(today - admissionDate);
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            patientDaysInIcuEl.textContent = diffDays;
            patientDihEl.textContent = admissionDate.toLocaleDateString('pt-BR');
            admissionInfoContainer.textContent = `${patient.unit_name || 'Unidade'} - Leito ${patient.bed_number || 'N/A'}`;
        }
    }

    function updateActionLinks(pId) {
        if (goToEvolutionBtn) goToEvolutionBtn.href = `patient-evolution.html?patientId=${pId}`;
        if (goToPrescriptionBtn) goToPrescriptionBtn.href = `prescricao.html?patientId=${pId}`;
        if (goToReceitaBtn) goToReceitaBtn.href = `receita.html?patientId=${pId}`;
    }

    async function loadHistory(patientData) {
        try {
            const [evolutionsResponse, prescriptionsResponse] = await Promise.all([
                fetch(`/api/patients/${patientId}/evolutions`),
                fetch(`/api/patients/${patientId}/prescriptions`)
            ]);
            
            if (!evolutionsResponse.ok || !prescriptionsResponse.ok) {
                throw new Error("Falha ao carregar o histórico do paciente.");
            }
            
            const evolutionsResult = await evolutionsResponse.json();
            const prescriptionsResult = await prescriptionsResponse.json();

            const combinedHistory = [
                ...(evolutionsResult.data || []).map(item => ({ ...item, type: 'Evolução Médica' })),
                ...(prescriptionsResult.data || []).map(item => {
                    const type = item.diet_description === 'Receituário simples' ? 'Receituário' : 'Prescrição';
                    return { ...item, type };
                })
            ];

            combinedHistory.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

            renderHistoryList(combinedHistory, patientData);
        } catch (error) {
            historyList.innerHTML = `<p style="color:red;">${error.message}</p>`;
        }
    }
    
    function renderHistoryList(history, patientData) {
        historyList.innerHTML = '';
        if (history.length === 0) {
            historyList.innerHTML = '<p>Nenhum registro encontrado no histórico.</p>';
            return;
        }

        history.forEach(item => {
            const historyItemDiv = document.createElement('div');
            historyItemDiv.className = 'history-item';
            
            const isDisabled = !!item.deleted_at;
            if(isDisabled) {
                historyItemDiv.classList.add('deleted');
            }

            // Armazena os dados completos no elemento para uso posterior
            historyItemDiv.dataset.item = JSON.stringify(item);
            historyItemDiv.dataset.patient = JSON.stringify(patientData);

            const createdAt = new Date(item.created_at);
            const formattedDate = createdAt.toLocaleDateString('pt-BR');
            const formattedTime = createdAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

            let editedText = '';
            if (item.updated_at && (new Date(item.updated_at) - createdAt > 60000)) {
                editedText = `<span class="edited-status">(editado)</span>`;
            }
            
            let buttonsHTML = '';
            if (item.type === 'Evolução Médica') {
                buttonsHTML = `
                    <button class="button-secondary" data-action="view" ${isDisabled ? 'disabled' : ''}>Visualizar/Imprimir</button>
                    <button class="button-secondary" data-action="copy" ${isDisabled ? 'disabled' : ''}>Copiar para Nova</button>
                    <button class="button-secondary" data-action="edit" ${isDisabled ? 'disabled' : ''}>Editar</button>
                    <button class="button-danger" data-action="delete" ${isDisabled ? 'disabled' : ''}>Excluir</button>
                `;
            } else if (item.type === 'Prescrição' || item.type === 'Receituário') {
                 buttonsHTML = `<button class="button-secondary" data-action="view-prescription" ${isDisabled ? 'disabled' : ''}>Visualizar/Imprimir</button>`;
            }

            historyItemDiv.innerHTML = `
                <div class="history-item-content">
                    <span class="history-item-title">${item.type} de ${formattedDate} às ${formattedTime} ${editedText}</span>
                    <div class="history-item-actions">
                        ${buttonsHTML}
                    </div>
                </div>
            `;
            historyList.appendChild(historyItemDiv);
        });
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
                     <p><strong>Idade:</strong> ${calculateAge(patientData.dob)} anos</p>
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
    // EVENT LISTENERS E LÓGICA DE MODAIS
    // =================================================================================
    
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
                        await loadPageData(); // Recarrega tudo
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
                    viewerContent.innerHTML = generateEvolutionReportHTML(patientData, itemData.content);
                    historyViewerModal.classList.add('active');
                    break;

                // ===== ATUALIZAÇÃO 2: LÓGICA PARA VISUALIZAR PRESCRIÇÃO =====
                case 'view-prescription':
                    try {
                        viewerTitle.textContent = `Carregando Prescrição...`;
                        viewerContent.innerHTML = '<p>Buscando dados da prescrição no servidor...</p>';
                        historyViewerModal.classList.add('active');

                        const response = await fetch(`/api/prescriptions/${itemData.id}`);
                        if (!response.ok) {
                            const err = await response.json();
                            throw new Error(err.error || 'Não foi possível carregar os detalhes da prescrição.');
                        }
                        const result = await response.json();
                        const prescription = result.data;

                        let prescriptionHtml = `<div class="report-section"><h4>Dieta</h4><p>${prescription.diet_description || 'Nenhuma dieta especificada.'}</p></div>`;

                        const hydrationItems = prescription.items.filter(i => i.item_type === 'hydration');
                        if (hydrationItems.length > 0) {
                            prescriptionHtml += `<div class="report-section"><h4>Hidratação Venosa</h4><ul>`;
                            hydrationItems.forEach(item => {
                                prescriptionHtml += `<li><strong>${item.name || ''}</strong> - ${item.dose || ''} - ${item.via || ''} - ${item.frequency || ''} ${item.notes ? `(${item.notes})` : ''}</li>`;
                            });
                            prescriptionHtml += `</ul></div>`;
                        }

                        const medicationItems = prescription.items.filter(i => i.item_type === 'medication');
                        if (medicationItems.length > 0) {
                            prescriptionHtml += `<div class="report-section"><h4>Medicamentos</h4><ul>`;
                            medicationItems.forEach(item => {
                                prescriptionHtml += `<li><strong>${item.name || ''}</strong> - ${item.dose || ''} - ${item.via || ''} - ${item.frequency || ''} ${item.notes ? `(${item.notes})` : ''}</li>`;
                            });
                            prescriptionHtml += `</ul></div>`;
                        }

                        viewerTitle.textContent = `Visualizar ${itemData.type} - ${new Date(itemData.created_at).toLocaleDateString('pt-BR')}`;
                        viewerContent.innerHTML = prescriptionHtml;

                    } catch (error) {
                        console.error("Erro ao visualizar prescrição:", error);
                        viewerContent.innerHTML = `<p style="color:red;">${error.message}</p>`;
                    }
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
            const styles = Array.from(document.styleSheets).map(sheet => `<link rel="stylesheet" href="${sheet.href}">`).join('');
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

    if(readmitPatientBtn) {
        readmitPatientBtn.addEventListener('click', async () => {
            const response = await fetch(`/api/patients/${patientId}`);
            const patient = (await response.json()).data;
            openReadmitModal(patient);
        });
    }
    
    if (confirmReadmitBtn) {
        confirmReadmitBtn.addEventListener('click', async () => {
            const secondaryDiagnoses = [];
            readmitSecondaryDiagnosesContainer.querySelectorAll('.secondary-diagnosis-entry').forEach(entry => {
                const desc = entry.querySelector('.secondary_desc').value.trim();
                const cid = entry.querySelector('.secondary_cid').value.trim();
                if (desc) { secondaryDiagnoses.push({ desc, cid }); }
            });

            const readmitData = {
                bed_id: readmitBedSelect.value,
                dih: readmissionDateInput.value,
                hd_primary_desc: readmitHdPrimaryDesc.value.trim(),
                hd_primary_cid: readmitHdPrimaryCid.value.trim(),
                secondary_diagnoses: secondaryDiagnoses
            };

            if (!readmitData.bed_id || !readmitData.dih) {
                alert('Selecione um leito de destino e uma data de internação.'); return;
            }
            
            try {
                const response = await fetch(`/api/patients/${patientId}/readmit`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(readmitData)
                });
                if (!response.ok) {
                    const err = await response.json();
                    throw new Error(err.error || 'Falha ao reinternar paciente.');
                }
                alert('Paciente reinternado com sucesso!');
                window.location.reload();
            } catch(error) {
                alert(`Erro: ${error.message}`);
            }
        });
    }

    async function loadCidData() {
        try {
            const response = await fetch('data/cid10.json');
            if (!response.ok) throw new Error('Falha ao carregar CID-10');
            cid10Data = await response.json();
        } catch (error) {
            console.error(error);
        }
    }
    
    function searchCid(query, resultsContainer) {
        if (query.length < 3) { resultsContainer.classList.remove('active'); return; }
        const lowerCaseQuery = query.toLowerCase();
        const results = cid10Data.filter(item => (item.display && item.display.toLowerCase().includes(lowerCaseQuery)) || (item.code && item.code.toLowerCase().includes(lowerCaseQuery))).slice(0, 10);
        resultsContainer.innerHTML = '';
        if (results.length > 0) {
            results.forEach(item => {
                const div = document.createElement('div');
                div.className = 'autocomplete-item';
                div.textContent = `${item.code} - ${item.display}`;
                div.dataset.cid = item.code;
                div.dataset.nome = item.display;
                resultsContainer.appendChild(div);
            });
            resultsContainer.classList.add('active');
        } else {
            resultsContainer.classList.remove('active');
        }
    }

    if (readmitForm) {
        readmitForm.addEventListener('input', (e) => {
            const targetInput = e.target;
            let resultsContainer;
            if (targetInput.matches('#readmit_hd_primary_desc')) {
                resultsContainer = targetInput.nextElementSibling;
            } else if (targetInput.matches('.secondary_desc')) {
                resultsContainer = targetInput.nextElementSibling;
            }
            if (resultsContainer) {
                searchCid(targetInput.value, resultsContainer);
            }
        });

        readmitForm.addEventListener('click', function(e) {
            const item = e.target.closest('.autocomplete-item');
            if (!item) return;
            const container = item.parentElement;
            const parentGroup = container.closest('.autocomplete-container').parentElement;
            if (parentGroup) {
                parentGroup.querySelector('.secondary_desc, #readmit_hd_primary_desc').value = item.dataset.nome;
                parentGroup.querySelector('.secondary_cid, #readmit_hd_primary_cid').value = item.dataset.cid;
            }
            container.innerHTML = '';
            container.classList.remove('active');
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