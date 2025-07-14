document.addEventListener('DOMContentLoaded', function() {

    // =================================================================================
    // SELEÇÃO DE ELEMENTOS
    // =================================================================================
    const params = new URLSearchParams(window.location.search);
    const unitId = params.get('unitId');

    const unitNameTitle = document.getElementById('unitNameTitle');
    const unitBedCount = document.getElementById('unitBedCount');
    const bedGridContainer = document.getElementById('bedGridContainer');
    
    // Modal de Adicionar Paciente
    const patientModal = document.getElementById('addPatientModal');
    const closePatientModal = document.getElementById('closePatientModal');
    const cancelPatientModal = document.getElementById('cancelPatientModal');
    const savePatientButton = document.getElementById('savePatientButton');
    const patientForm = document.getElementById('patientForm');

    // Modal de Dar Alta
    const dischargeModal = document.getElementById('dischargeModal');
    const closeDischargeModal = document.getElementById('closeDischargeModal');
    const cancelDischargeBtn = document.getElementById('cancelDischargeBtn');
    const confirmDischargeBtn = document.getElementById('confirmDischargeBtn');
    const dischargePatientName = document.getElementById('dischargePatientName');
    const dischargeDateInput = document.getElementById('dischargeDate');

    // Modal de Transferência
    const transferModal = document.getElementById('transferModal');
    const closeTransferModal = document.getElementById('closeTransferModal');
    const cancelTransferBtn = document.getElementById('cancelTransferBtn');
    const confirmTransferBtn = document.getElementById('confirmTransferBtn');
    const transferPatientName = document.getElementById('transferPatientName');
    const destinationUnitSelect = document.getElementById('destinationUnitSelect');
    const destinationBedSelect = document.getElementById('destinationBedSelect');
    let unitsWithFreeBeds = [];

    // ARMAZENAMENTO DE DADOS CID 
    let cid10Data = [];

    // Elementos da Busca de CID
    let cidTimeout;
    const hdPrimaryDesc = document.getElementById('hd_primary_desc');
    const hdPrimaryResults = document.getElementById('hd_primary_results');
    const hdPrimaryCid = document.getElementById('hd_primary_cid');
    const addSecondaryDiagBtn = document.getElementById('add_secondary_diag_btn');
    const secondaryDiagnosesContainer = document.getElementById('secondary_diagnoses_container');


    if (!unitId) {
        if (unitNameTitle) unitNameTitle.textContent = "ID da Unidade não fornecido.";
        if (bedGridContainer) bedGridContainer.innerHTML = '<p style="color: red;">Volte ao dashboard e selecione uma unidade.</p>';
        return;
    }

    // =================================================================================
    // FUNÇÕES DE CARREGAMENTO E RENDERIZAÇÃO
    // =================================================================================

    async function loadCidData() {
        try {
            const response = await fetch('data/cid10.json'); 
            if (!response.ok) throw new Error('Não foi possível carregar a lista de CIDs local.');
            cid10Data = await response.json();
        } catch (error) {
            console.error(error);
            if(hdPrimaryDesc) {
                hdPrimaryDesc.disabled = true;
                hdPrimaryDesc.placeholder = 'Erro ao carregar CIDs';
            }
            if (secondaryDiagnosesContainer) {
                secondaryDiagnosesContainer.querySelectorAll('.secondary_desc').forEach(input => {
                    input.disabled = true;
                    input.placeholder = 'Erro ao carregar CIDs';
                });
            }
        }
    }

    async function loadUnitAndBeds() {
        try {
            const unitResponse = await fetch(`/api/units/${unitId}`);
            if (!unitResponse.ok) throw new Error('Unidade não encontrada.');
            const unitResult = await unitResponse.json();
            const unit = unitResult.data;
            if (unitNameTitle) unitNameTitle.textContent = unit.name;
            if (unitBedCount) unitBedCount.textContent = `Total de ${unit.total_beds} Leitos`;

            const bedsResponse = await fetch(`/api/units/${unitId}/beds`);
            if (!bedsResponse.ok) throw new Error('Não foi possível carregar os leitos.');
            const bedsResult = await bedsResponse.json();
            renderBeds(bedsResult.data);
        } catch (error) {
            console.error('Erro ao carregar dados da unidade:', error);
            if (bedGridContainer) bedGridContainer.innerHTML = `<p style="color: red;">${error.message}</p>`;
        }
    }

    function renderBeds(beds) {
        if (!bedGridContainer) return;
        bedGridContainer.innerHTML = '';
        if (!beds || beds.length === 0) {
            bedGridContainer.innerHTML = '<p>Nenhum leito encontrado para esta unidade.</p>';
            return;
        }
        beds.forEach(bed => {
            const bedCard = document.createElement('div');
            bedCard.dataset.bedId = bed.id;
            if (bed.status === 'free') {
                bedCard.className = 'bed-card free';
                bedCard.innerHTML = `
                    <div class="bed-header"><h2>Leito ${bed.bed_number}</h2><span class="status-free">Livre</span></div>
                    <div class="bed-actions-free"><button class="action-btn-main cadastrar-paciente-btn">[+] Cadastrar Paciente</button></div>`;
            } else { 
                bedCard.className = 'bed-card occupied';
                bedCard.dataset.patientId = bed.patient_id;
                const patientName = bed.patient_name || 'Paciente não informado';
                bedCard.innerHTML = `
                    <div class="bed-header"><h2>Leito ${bed.bed_number}</h2><span class="status-occupied">Ocupado</span></div>
                    <div class="patient-info"><p><strong>Paciente:</strong> ${patientName}</p></div>
                    <div class="bed-actions">
                        <button class="action-btn-main acessar-paciente-btn">Acessar Prontuário</button>
                        <button class="action-btn transferir-paciente-btn">Transferir</button>
                        <button class="action-btn-danger dar-alta-btn">Dar Alta</button>
                    </div>`;
            }
            bedGridContainer.appendChild(bedCard);
        });
    }

    function searchCid(query, resultsContainer) {
        if (!resultsContainer) return;
        if (query.length < 2) {
            resultsContainer.innerHTML = '';
            resultsContainer.classList.remove('active');
            return;
        }
        const lowerCaseQuery = query.toLowerCase();
        const results = cid10Data.filter(item => 
            (item.display && item.display.toLowerCase().includes(lowerCaseQuery)) || 
            (item.code && item.code.toLowerCase().includes(lowerCaseQuery))
        ).slice(0, 10);
        
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
        } else {
            resultsContainer.innerHTML = '<div class="autocomplete-item error-item">Nenhum resultado encontrado.</div>';
        }
        resultsContainer.classList.add('active');
    }
    
    // =================================================================================
    // LÓGICA DE EVENTOS E MODAIS
    // =================================================================================
    
    if (bedGridContainer) {
        bedGridContainer.addEventListener('click', function(event) {
            const target = event.target;
            const bedCard = target.closest('.bed-card');
            if (!bedCard) return;

            const patientInfoP = bedCard.querySelector('.patient-info p');
            const patientName = patientInfoP && patientInfoP.lastChild ? patientInfoP.lastChild.textContent.trim() : 'Paciente';

            if (target.closest('.cadastrar-paciente-btn')) {
                if (patientModal) {
                    const bedNumberSpan = document.getElementById('modalLeitoNum');
                    if (bedNumberSpan) {
                         bedNumberSpan.textContent = bedCard.querySelector('h2').textContent.replace('Leito ','');
                    }
                    patientModal.dataset.bedId = bedCard.dataset.bedId;
                    patientModal.classList.add('active');
                }
            }
            
            else if (target.closest('.acessar-paciente-btn')) {
                const patientId = bedCard.dataset.patientId;
                if (patientId) window.location.href = `patient-view.html?patientId=${patientId}`;
            }

            else if (target.closest('.dar-alta-btn')) {
                if (dischargeModal) {
                    if (dischargePatientName) dischargePatientName.textContent = patientName;
                    dischargeModal.dataset.patientId = bedCard.dataset.patientId;
                    dischargeModal.dataset.bedId = bedCard.dataset.bedId;
                    const now = new Date();
                    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
                    if (dischargeDateInput) dischargeDateInput.value = now.toISOString().slice(0, 16);
                    dischargeModal.classList.add('active');
                }
            }

            else if (target.closest('.transferir-paciente-btn')) {
                if (transferModal) {
                    if (transferPatientName) transferPatientName.textContent = patientName;
                    transferModal.dataset.patientId = bedCard.dataset.patientId;
                    transferModal.dataset.oldBedId = bedCard.dataset.bedId;
                    
                    transferModal.classList.add('active'); 
                    
                    (async () => {
                        try {
                            const response = await fetch('/api/units-with-free-beds');
                            if (!response.ok) throw new Error('Falha ao buscar unidades de destino.');
                            const result = await response.json();
                            unitsWithFreeBeds = result.data;
                            if(destinationUnitSelect) {
                                destinationUnitSelect.innerHTML = '<option value="">Selecione a unidade...</option>';
                                unitsWithFreeBeds.forEach(unit => {
                                    const option = document.createElement('option');
                                    option.value = unit.id;
                                    option.textContent = `${unit.name} (${unit.free_beds ? unit.free_beds.length : 0} leitos livres)`;
                                    option.disabled = !unit.free_beds || unit.free_beds.length === 0;
                                    destinationUnitSelect.appendChild(option);
                                });
                            }
                           if(destinationBedSelect) {
                                destinationBedSelect.innerHTML = '<option value="">Selecione um leito livre...</option>';
                                destinationBedSelect.disabled = true;
                           }
                        } catch(error) {
                            console.error("Erro ao carregar dados para transferência:", error);
                            alert("Não foi possível carregar as unidades de destino.");
                        }
                    })();
                }
            }
        });
    }

    const closeModal = (modal) => { 
        if(modal) {
            modal.classList.remove('active');
            if (modal.id === 'addPatientModal' && patientForm && secondaryDiagnosesContainer) {
                patientForm.reset();
                const firstEntryHTML = `
                    <div class="secondary-diagnosis-entry">
                        <div class="autocomplete-container">
                            <textarea class="secondary_desc" rows="2" placeholder="Comece a digitar o diagnóstico..."></textarea>
                            <div class="autocomplete-results"></div>
                        </div>
                        <label class="cid-label">CID-10</label>
                        <input type="text" class="secondary_cid" placeholder="Ex: A00.1">
                        <button type="button" class="remove-diag-btn" disabled>&times;</button>
                    </div>`;
                secondaryDiagnosesContainer.innerHTML = firstEntryHTML;
            }
        }
    };
    
    if(closePatientModal) closePatientModal.addEventListener('click', () => closeModal(patientModal));
    if(cancelPatientModal) cancelPatientModal.addEventListener('click', () => closeModal(patientModal));
    if(closeDischargeModal) closeDischargeModal.addEventListener('click', () => closeModal(dischargeModal));
    if(cancelDischargeBtn) cancelDischargeBtn.addEventListener('click', () => closeModal(dischargeModal));
    if(closeTransferModal) closeTransferModal.addEventListener('click', () => closeModal(transferModal));
    if(cancelTransferBtn) cancelTransferBtn.addEventListener('click', () => closeModal(transferModal));

    if (savePatientButton) {
        savePatientButton.addEventListener('click', async () => {
            const secondaryDiagnoses = [];
            if (secondaryDiagnosesContainer) {
                document.querySelectorAll('.secondary-diagnosis-entry').forEach(entry => {
                    const desc = entry.querySelector('.secondary_desc').value.trim();
                    const cid = entry.querySelector('.secondary_cid').value.trim();
                    if (desc) {
                        secondaryDiagnoses.push({ desc, cid });
                    }
                });
            }
            const patientData = {
                bed_id: patientModal.dataset.bedId,
                name: document.getElementById('patientName').value.trim(),
                mother_name: document.getElementById('motherName').value.trim(),
                dob: document.getElementById('patientDob').value,
                cns: document.getElementById('patientCns').value.trim(),
                dih: document.getElementById('hospitalAdmissionDate').value,
                hd_primary_desc: hdPrimaryDesc.value.trim(),
                hd_primary_cid: hdPrimaryCid.value.trim(),
                secondary_diagnoses: secondaryDiagnoses,
                hpp: document.getElementById('hpp').value.trim(),
                allergies: document.getElementById('allergies').value.trim(),
            };
            if (!patientData.name || !patientData.dob) {
                alert('Por favor, preencha pelo menos o Nome e a Data de Nascimento do paciente.');
                return;
            }
            try {
                const response = await fetch('/api/patients', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(patientData)
                });
                if (!response.ok) {
                    const err = await response.json();
                    throw new Error(err.error || "Falha ao cadastrar paciente.");
                }
                alert("Paciente cadastrado com sucesso!");
                closeModal(patientModal);
                loadUnitAndBeds();
            } catch(error) {
                console.error("Erro ao salvar paciente:", error);
                alert(`Erro: ${error.message}`);
            }
        });
    }

    if (confirmDischargeBtn) {
        confirmDischargeBtn.addEventListener('click', async () => {
            const patientId = dischargeModal.dataset.patientId;
            const bedId = dischargeModal.dataset.bedId;
            const reason = document.getElementById('dischargeReason').value;
            const date = dischargeDateInput.value;
            if (!reason || !date) { alert("Preencha o motivo e a data da alta."); return; }
            try {
                const response = await fetch(`/api/patients/${patientId}/discharge`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ bedId, reason, date })
                });
                if (!response.ok) throw new Error("Falha ao dar alta.");
                alert("Alta registrada com sucesso!");
                closeModal(dischargeModal);
                loadUnitAndBeds();
            } catch (error) {
                alert(`Erro: ${error.message}`);
            }
        });
    }
    
    if (destinationUnitSelect) {
        destinationUnitSelect.addEventListener('change', () => {
            const selectedUnitId = destinationUnitSelect.value;
            const selectedUnit = unitsWithFreeBeds.find(u => u.id == selectedUnitId);
            destinationBedSelect.innerHTML = '<option value="">Selecione um leito livre...</option>';
            if(selectedUnit && selectedUnit.free_beds) {
                selectedUnit.free_beds.forEach(bed => {
                    const option = document.createElement('option');
                    option.value = bed.id;
                    option.textContent = `Leito ${bed.bed_number}`;
                    destinationBedSelect.appendChild(option);
                });
                destinationBedSelect.disabled = false;
            } else {
                destinationBedSelect.disabled = true;
            }
        });
    }

    if (confirmTransferBtn) {
        confirmTransferBtn.addEventListener('click', async () => {
            const patientId = transferModal.dataset.patientId;
            const oldBedId = transferModal.dataset.oldBedId;
            const newBedId = destinationBedSelect.value;
            if(!newBedId) { alert("Por favor, selecione um leito de destino."); return; }
            try {
                const response = await fetch(`/api/patients/${patientId}/transfer`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ oldBedId, newBedId })
                });
                if(!response.ok) {
                    const err = await response.json();
                    throw new Error(err.error || "Falha ao transferir paciente.");
                }
                alert("Paciente transferido com sucesso!");
                closeModal(transferModal);
                loadUnitAndBeds();
            } catch(error) {
                console.error("Erro ao confirmar transferência:", error);
                alert(`Erro: ${error.message}`);
            }
        });
    }
    
    if (addSecondaryDiagBtn) {
        addSecondaryDiagBtn.addEventListener('click', () => {
            const newEntry = document.createElement('div');
            newEntry.className = 'secondary-diagnosis-entry';
            newEntry.innerHTML = `
                <div class="autocomplete-container">
                    <textarea class="secondary_desc" rows="2" placeholder="Comece a digitar o diagnóstico..."></textarea>
                    <div class="autocomplete-results"></div>
                </div>
                <label class="cid-label">CID-10</label>
                <input type="text" class="secondary_cid" placeholder="Ex: A00.1">
                <button type="button" class="remove-diag-btn">&times;</button>
            `;
            secondaryDiagnosesContainer.appendChild(newEntry);
        });
    }
    
    if (secondaryDiagnosesContainer) {
        secondaryDiagnosesContainer.addEventListener('click', (e) => {
            if (e.target.classList.contains('remove-diag-btn')) {
                e.target.closest('.secondary-diagnosis-entry').remove();
            }
        });
    }

    if (patientForm) {
        patientForm.addEventListener('input', (e) => {
            const targetInput = e.target;
            let resultsContainer;
            if (targetInput.id === 'hd_primary_desc') {
                resultsContainer = hdPrimaryResults;
            } else if (targetInput.classList.contains('secondary_desc')) {
                resultsContainer = targetInput.closest('.secondary-diagnosis-entry').querySelector('.autocomplete-results');
            }

            if (resultsContainer) {
                clearTimeout(cidTimeout);
                cidTimeout = setTimeout(() => searchCid(targetInput.value, resultsContainer), 150);
            }
        });

        patientForm.addEventListener('click', function(e) {
            const item = e.target.closest('.autocomplete-item');
            if (item && !item.classList.contains('error-item')) {
                const container = item.parentElement;
                const parentGroup = container.closest('.form-group') || container.closest('.secondary-diagnosis-entry');
                
                if (parentGroup) {
                    const descInput = parentGroup.querySelector('#hd_primary_desc, .secondary_desc');
                    const cidInput = parentGroup.querySelector('#hd_primary_cid, .secondary_cid');
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

    document.addEventListener('click', function(e) {
        if (!e.target.closest('.form-group') && !e.target.closest('.secondary-diagnosis-entry')) {
            document.querySelectorAll('.autocomplete-results').forEach(res => res.classList.remove('active'));
        }
    });

    // INICIALIZAÇÃO DA PÁGINA
    loadUnitAndBeds();
    loadCidData();
});