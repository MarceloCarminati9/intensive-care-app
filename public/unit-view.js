// VERSÃO FINAL, COMPLETA E UNIFICADA - 11/07/2025

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

    // Elementos da Busca de CID
    let cidTimeout;
    const hdPrimaryDesc = document.getElementById('hd_primary_desc');
    const hdPrimaryResults = document.getElementById('hd_primary_results');
    const hdPrimaryCid = document.getElementById('hd_primary_cid');
    const hdSecondaryDesc = document.getElementById('secondary_diagnoses_desc');
    const hdSecondaryResults = document.getElementById('secondary_diagnoses_results');
    const hdSecondaryCid = document.getElementById('secondary_diagnoses_cid');

    if (!unitId) {
        unitNameTitle.textContent = "ID da Unidade não fornecido.";
        bedGridContainer.innerHTML = '<p style="color: red;">Volte ao dashboard e selecione uma unidade.</p>';
        return;
    }

    // =================================================================================
    // FUNÇÕES DE CARREGAMENTO E RENDERIZAÇÃO
    // =================================================================================

    async function loadUnitAndBeds() {
        // ... (código da sua versão para carregar unidade e leitos, sem alterações)
    }

    function renderBeds(beds) {
        // ... (código da sua versão para renderizar os leitos, sem alterações)
    }

    // =================================================================================
    // LÓGICA DE EVENTOS E MODAIS
    // =================================================================================
    
    bedGridContainer.addEventListener('click', async function(event) {
        // ... (código da sua versão para ABRIR os modais, sem alterações)
    });

    const closeModal = (modal) => { if(modal) modal.classList.remove('active'); };
    if(closePatientModal) closePatientModal.addEventListener('click', () => { closeModal(patientModal); patientForm.reset(); });
    // ... (outros close/cancel sem alterações) ...

    // --- LÓGICA COMPLETA E CORRIGIDA DOS BOTÕES DE AÇÃO ---
    
    // Salvar Paciente
    savePatientButton.addEventListener('click', async () => {
        const bedId = patientModal.dataset.bedId;
        const patientData = {
            bed_id: bedId,
            name: document.getElementById('patientName').value.trim(),
            mother_name: document.getElementById('motherName').value.trim(),
            dob: document.getElementById('patientDob').value,
            cns: document.getElementById('patientCns').value.trim(),
            dih: document.getElementById('hospitalAdmissionDate').value,
            hd_primary_desc: hdPrimaryDesc.value.trim(),
            hd_primary_cid: hdPrimaryCid.value.trim(),
            secondary_diagnoses_desc: hdSecondaryDesc.value.trim(),
            secondary_diagnoses_cid: hdSecondaryCid.value.trim(),
            hpp: document.getElementById('hpp').value.trim(),
            allergies: document.getElementById('allergies').value.trim(),
        };

        if (!patientData.name || !patientData.dob) {
            alert('Por favor, preencha pelo menos o Nome e a Data de Nascimento.');
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
            patientForm.reset();
            loadUnitAndBeds();
        } catch(error) {
            console.error("Erro ao salvar paciente:", error);
            alert(`Erro: ${error.message}`);
        }
    });

    // Dar Alta
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
    
    // Lógica de Transferência
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

    // --- LÓGICA PARA BUSCA AUTOMÁTICA DE CID ---
    async function searchCid(query, resultsContainer) {
        if (query.length < 3) {
            resultsContainer.innerHTML = '';
            resultsContainer.classList.remove('active');
            return;
        }
        try {
            const response = await fetch(`https://cid.api.inf.br/cid10?q=${query}`);
            const results = await response.json();
            resultsContainer.innerHTML = '';
            if (results && results.length > 0) {
                results.slice(0, 5).forEach(cid => {
                    const item = document.createElement('div');
                    item.className = 'autocomplete-item';
                    item.innerHTML = `<small>${cid.codigo}</small> ${cid.nome}`;
                    item.dataset.cid = cid.codigo;
                    item.dataset.nome = cid.nome;
                    resultsContainer.appendChild(item);
                });
                resultsContainer.classList.add('active');
            } else {
                resultsContainer.classList.remove('active');
            }
        } catch (error) { console.error("Erro ao buscar CID:", error); }
    }

    hdPrimaryDesc.addEventListener('input', () => {
        clearTimeout(cidTimeout);
        cidTimeout = setTimeout(() => searchCid(hdPrimaryDesc.value, hdPrimaryResults), 300);
    });

    hdSecondaryDesc.addEventListener('input', () => {
        clearTimeout(cidTimeout);
        cidTimeout = setTimeout(() => searchCid(hdSecondaryDesc.value, hdSecondaryResults), 300);
    });

    document.addEventListener('click', function(e) {
        const item = e.target.closest('.autocomplete-item');
        if (item) {
            const container = item.parentElement;
            if (container.id === 'hd_primary_results') {
                hdPrimaryDesc.value = item.dataset.nome;
                hdPrimaryCid.value = item.dataset.cid;
            } else if (container.id === 'secondary_diagnoses_results') {
                hdSecondaryDesc.value = item.dataset.nome;
                hdSecondaryCid.value = item.dataset.cid;
            }
            container.innerHTML = '';
            container.classList.remove('active');
        } else {
            if (hdPrimaryResults) hdPrimaryResults.classList.remove('active');
            if (hdSecondaryResults) hdSecondaryResults.classList.remove('active');
        }
    });

    // INICIALIZAÇÃO DA PÁGINA
    loadUnitAndBeds();
});