// VERSÃO FINAL E UNIFICADA - COM TODAS AS FUNCIONALIDADES E CORREÇÕES

document.addEventListener('DOMContentLoaded', function() {

    // =================================================================================
    // SELEÇÃO DE ELEMENTOS (COMPLETA)
    // =================================================================================
    const params = new URLSearchParams(window.location.search);
    const unitId = params.get('unitId');

    const unitNameTitle = document.getElementById('unitNameTitle');
    const unitBedCount = document.getElementById('unitBedCount');
    const bedGridContainer = document.getElementById('bedGridContainer');
    
    // Modal de ADICIONAR paciente
    const patientModal = document.getElementById('addPatientModal');
    const closePatientModal = document.getElementById('closePatientModal');
    const cancelPatientModal = document.getElementById('cancelPatientModal');
    const savePatientButton = document.getElementById('savePatientButton');
    const patientForm = document.getElementById('patientForm');

    // Modal de DAR ALTA
    const dischargeModal = document.getElementById('dischargeModal');
    const closeDischargeModal = document.getElementById('closeDischargeModal');
    const cancelDischargeBtn = document.getElementById('cancelDischargeBtn');
    const confirmDischargeBtn = document.getElementById('confirmDischargeBtn');
    const dischargePatientName = document.getElementById('dischargePatientName');
    const dischargeDateInput = document.getElementById('dischargeDate');

    // Modal de TRANSFERÊNCIA
    const transferModal = document.getElementById('transferModal');
    const closeTransferModal = document.getElementById('closeTransferModal');
    const cancelTransferBtn = document.getElementById('cancelTransferBtn');
    const confirmTransferBtn = document.getElementById('confirmTransferBtn');
    const transferPatientName = document.getElementById('transferPatientName');
    const destinationUnitSelect = document.getElementById('destinationUnitSelect');
    const destinationBedSelect = document.getElementById('destinationBedSelect');
    let unitsWithFreeBeds = []; // Armazena dados para o modal de transferência

    if (!unitId) {
        unitNameTitle.textContent = "ID da Unidade não fornecido.";
        bedGridContainer.innerHTML = '<p style="color: red;">Volte ao dashboard e selecione uma unidade.</p>';
        return;
    }

    // =================================================================================
    // FUNÇÕES DE CARREGAMENTO E RENDERIZAÇÃO
    // =================================================================================

    async function loadUnitAndBeds() {
        try {
            const unitResponse = await fetch(`/api/units/${unitId}`);
            if (!unitResponse.ok) throw new Error('Unidade não encontrada.');
            const unitResult = await unitResponse.json();
            const unit = unitResult.data;
            unitNameTitle.textContent = unit.name;
            unitBedCount.textContent = `Total de ${unit.total_beds} Leitos`;

            const bedsResponse = await fetch(`/api/units/${unitId}/beds`);
            if (!bedsResponse.ok) throw new Error('Não foi possível carregar os leitos.');
            const bedsResult = await bedsResponse.json();
            renderBeds(bedsResult.data);
        } catch (error) {
            console.error('Erro ao carregar dados da unidade:', error);
            bedGridContainer.innerHTML = `<p style="color: red;">${error.message}</p>`;
        }
    }

    function renderBeds(beds) {
        bedGridContainer.innerHTML = '';
        if (beds.length === 0) {
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

    // =================================================================================
    // LÓGICA DE EVENTOS DA PÁGINA E MODAIS
    // =================================================================================
    
    bedGridContainer.addEventListener('click', async function(event) {
        const target = event.target;
        const bedCard = target.closest('.bed-card');
        if (!bedCard) return;

        if (target.closest('.cadastrar-paciente-btn')) {
            document.getElementById('modalLeitoNum').textContent = bedCard.querySelector('h2').textContent.replace('Leito ','');
            patientModal.dataset.bedId = bedCard.dataset.bedId;
            patientModal.classList.add('active');
        }
        
        if (target.closest('.acessar-paciente-btn')) {
            const patientId = bedCard.dataset.patientId;
            if (patientId) window.location.href = `patient-view.html?patientId=${patientId}`;
        }

        if (target.closest('.dar-alta-btn')) {
            dischargePatientName.textContent = bedCard.querySelector('.patient-info p').lastChild.textContent.trim();
            dischargeModal.dataset.patientId = bedCard.dataset.patientId;
            dischargeModal.dataset.bedId = bedCard.dataset.bedId;
            const now = new Date();
            now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
            dischargeDateInput.value = now.toISOString().slice(0, 16);
            dischargeModal.classList.add('active');
        }

        if (target.closest('.transferir-paciente-btn')) {
            transferPatientName.textContent = bedCard.querySelector('.patient-info p').lastChild.textContent.trim();
            transferModal.dataset.patientId = bedCard.dataset.patientId;
            transferModal.dataset.oldBedId = bedCard.dataset.bedId;
            
            try {
                const response = await fetch('/api/units-with-free-beds');
                const result = await response.json();
                unitsWithFreeBeds = result.data;

                destinationUnitSelect.innerHTML = '<option value="">Selecione a unidade...</option>';
                unitsWithFreeBeds.forEach(unit => {
                    const option = document.createElement('option');
                    option.value = unit.id;
                    option.textContent = `${unit.name} (${unit.free_beds ? unit.free_beds.length : 0} leitos livres)`;
                    option.disabled = !unit.free_beds || unit.free_beds.length === 0;
                    destinationUnitSelect.appendChild(option);
                });
                destinationBedSelect.innerHTML = '<option value="">Selecione um leito livre...</option>';
                destinationBedSelect.disabled = true;
                transferModal.classList.add('active');
            } catch(error) {
                console.error("Erro ao carregar dados para transferência:", error);
                alert("Não foi possível carregar as unidades de destino.");
            }
        }
    });

    const closeModal = (modal) => { if(modal) modal.classList.remove('active'); };
    if(closePatientModal) closePatientModal.addEventListener('click', () => { closeModal(patientModal); patientForm.reset(); });
    if(cancelPatientModal) cancelPatientModal.addEventListener('click', () => { closeModal(patientModal); patientForm.reset(); });
    if(closeDischargeModal) closeDischargeModal.addEventListener('click', () => closeModal(dischargeModal));
    if(cancelDischargeBtn) cancelDischargeBtn.addEventListener('click', () => closeModal(dischargeModal));
    if(closeTransferModal) closeTransferModal.addEventListener('click', () => closeModal(transferModal));
    if(cancelTransferBtn) cancelTransferBtn.addEventListener('click', () => closeModal(transferModal));

    // [LÓGICA CORRIGIDA E COMPLETA] Event listener para Salvar Paciente
    savePatientButton.addEventListener('click', async () => {
        const bedId = patientModal.dataset.bedId;
        
        const patientData = {
            bed_id: bedId,
            name: document.getElementById('patientName').value.trim(),
            mother_name: document.getElementById('motherName').value.trim(),
            dob: document.getElementById('patientDob').value,
            cns: document.getElementById('patientCns').value.trim(),
            dih: document.getElementById('hospitalAdmissionDate').value,
            hd_primary_desc: document.getElementById('hd_primary_desc').value.trim(),
            hd_primary_cid: document.getElementById('hd_primary_cid').value.trim(),
            secondary_diagnoses: document.getElementById('secondary_diagnoses').value.trim(),
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
            patientForm.reset();
            loadUnitAndBeds();
        } catch(error) {
            console.error("Erro ao salvar paciente:", error);
            alert(`Erro: ${error.message}`);
        }
    });

    // [LÓGICA CORRIGIDA E COMPLETA] Event listener para Dar Alta
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
    
    // [LÓGICA CORRIGIDA E COMPLETA] Event listeners para Transferência
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

        if(!newBedId) {
            alert("Por favor, selecione um leito de destino.");
            return;
        }

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

    // INICIALIZAÇÃO
    loadUnitAndBeds();
});