// VERSÃO CORRETA E COMPLETA de public/unit-view.js

document.addEventListener('DOMContentLoaded', function() {

    // =================================================================================
    // INICIALIZAÇÃO E CARREGAMENTO DE DADOS
    // =================================================================================
    const params = new URLSearchParams(window.location.search);
    const unitId = params.get('unitId');

    // Referências a elementos da página principal
    const unitNameTitle = document.getElementById('unitNameTitle');
    const unitBedCount = document.getElementById('unitBedCount');
    const bedGridContainer = document.getElementById('bedGridContainer');
    
    // Referências ao modal de ADICIONAR paciente
    const patientModal = document.getElementById('addPatientModal');
    const closePatientModal = document.getElementById('closePatientModal');
    const cancelPatientModal = document.getElementById('cancelPatientModal');
    const savePatientButton = document.getElementById('savePatientButton');
    const patientForm = document.getElementById('patientForm');

    // Referências ao modal de DAR ALTA do paciente
    const dischargeModal = document.getElementById('dischargeModal');
    const closeDischargeModal = document.getElementById('closeDischargeModal');
    const cancelDischargeBtn = document.getElementById('cancelDischargeBtn');
    const confirmDischargeBtn = document.getElementById('confirmDischargeBtn');
    const dischargePatientName = document.getElementById('dischargePatientName');
    const dischargeReasonSelect = document.getElementById('dischargeReason');
    const dischargeDateInput = document.getElementById('dischargeDate');

    if (!unitId) {
        unitNameTitle.textContent = "ID da Unidade não fornecido.";
        bedGridContainer.innerHTML = '<p style="color: red;">Volte ao dashboard e selecione uma unidade.</p>';
        return;
    }

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
            const beds = bedsResult.data;
            
            renderBeds(beds);

        } catch (error) {
            console.error('Erro ao carregar dados da unidade:', error);
            bedGridContainer.innerHTML = `<p style="color: red;">${error.message}</p>`;
        }
    }

    // =================================================================================
    // RENDERIZAÇÃO DA GRADE DE LEITOS
    // =================================================================================
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
                        <button class="action-btn-main acessar-paciente-btn">Acessar Paciente</button>
                        <button class="action-btn" disabled>Transferir</button>
                        <button class="action-btn-danger dar-alta-btn">Dar Alta</button>
                    </div>`;
            }
            bedGridContainer.appendChild(bedCard);
        });
    }
    
    // =================================================================================
    // LÓGICA DE EVENTOS DA PÁGINA (CORRIGIDO)
    // =================================================================================
    
    bedGridContainer.addEventListener('click', function(event) {
        
        const cadastrarBtn = event.target.closest('.cadastrar-paciente-btn');
        if (cadastrarBtn) {
            const bedCard = cadastrarBtn.closest('.bed-card');
            const bedId = bedCard.dataset.bedId;
            const modalLeitoNumSpan = document.getElementById('modalLeitoNum');
            if(modalLeitoNumSpan) modalLeitoNumSpan.textContent = bedCard.querySelector('h2').textContent.replace('Leito ','');
            
            patientModal.dataset.bedId = bedId;
            patientModal.classList.add('active');
            return;
        }
        
        const acessarBtn = event.target.closest('.acessar-paciente-btn');
        if (acessarBtn) {
            const patientId = acessarBtn.closest('.bed-card').dataset.patientId;
            if (patientId) {
                window.location.href = `patient-view.html?patientId=${patientId}`;
            }
            return;
        }

        const darAltaBtn = event.target.closest('.dar-alta-btn');
        if (darAltaBtn) {
            const bedCard = darAltaBtn.closest('.bed-card');
            const patientId = bedCard.dataset.patientId;
            const bedId = bedCard.dataset.bedId;
            const patientName = bedCard.querySelector('.patient-info p').lastChild.textContent.trim();

            dischargePatientName.textContent = patientName;
            dischargeModal.dataset.patientId = patientId;
            dischargeModal.dataset.bedId = bedId;
            
            const now = new Date();
            now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
            dischargeDateInput.value = now.toISOString().slice(0, 16);
            
            dischargeModal.classList.add('active');
            return;
        }
    });

    // --- Lógica do Modal de ADICIONAR Paciente ---
    const closePatientModalFunc = () => { patientModal.classList.remove('active'); if(patientForm) patientForm.reset(); };
    if(closePatientModal) closePatientModal.addEventListener('click', closePatientModalFunc);
    if(cancelPatientModal) cancelPatientModal.addEventListener('click', closePatientModalFunc);

    if (savePatientButton) {
        savePatientButton.addEventListener('click', async () => {
            const bedId = patientModal.dataset.bedId;
            const patientData = {
                name: document.getElementById('patientName').value.trim(),
                dob: document.getElementById('patientDob').value,
                age: document.getElementById('patientAge').value,
                cns: document.getElementById('patientCns').value,
                dih: document.getElementById('hospitalAdmissionDate').value,
                unitId: unitId,
                bedId: bedId
            };
            
            if (!patientData.name) {
                alert('O nome do paciente é obrigatório.');
                return;
            }

            try {
                const response = await fetch('/api/patients', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(patientData)
                });

                if (!response.ok) {
                    const errorResult = await response.json();
                    throw new Error(errorResult.error || 'Falha ao cadastrar paciente.');
                }

                alert('Paciente cadastrado com sucesso!');
                closePatientModalFunc();
                loadUnitAndBeds();

            } catch (error) {
                console.error('Erro ao salvar paciente:', error);
                alert(`Erro: ${error.message}`);
            }
        });
    }

    // --- Lógica do Modal de DAR ALTA ---
    const closeDischargeModalFunc = () => dischargeModal.classList.remove('active');
    if(closeDischargeModal) closeDischargeModal.addEventListener('click', closeDischargeModalFunc);
    if(cancelDischargeBtn) cancelDischargeBtn.addEventListener('click', closeDischargeModalFunc);

    if(confirmDischargeBtn) {
        confirmDischargeBtn.addEventListener('click', async () => {
            const patientId = dischargeModal.dataset.patientId;
            const bedId = dischargeModal.dataset.bedId;
            const dischargeData = {
                reason: dischargeReasonSelect.value,
                datetime: dischargeDateInput.value,
                bedId: bedId
            };

            if (!dischargeData.datetime) {
                alert('Por favor, selecione a data e hora da alta.');
                return;
            }
            
            try {
                const response = await fetch(`/api/patients/${patientId}/discharge`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(dischargeData)
                });

                if (!response.ok) {
                    const err = await response.json();
                    throw new Error(err.error || 'Falha ao processar a alta.');
                }

                alert('Alta do paciente registrada com sucesso!');
                closeDischargeModalFunc();
                loadUnitAndBeds();

            } catch (error) {
                console.error('Erro no processo de alta:', error);
                alert(`Erro: ${error.message}`);
            }
        });
    }

    // =================================================================================
    // INICIALIZAÇÃO
    // =================================================================================
    loadUnitAndBeds();
});