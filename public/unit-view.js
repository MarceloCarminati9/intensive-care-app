document.addEventListener('DOMContentLoaded', function() {

    // =================================================================================
    // INICIALIZAÇÃO E CARREGAMENTO DE DADOS
    // =================================================================================
    const params = new URLSearchParams(window.location.search);
    const unitId = params.get('unitId');

    const unitNameTitle = document.getElementById('unitNameTitle');
    const unitBedCount = document.getElementById('unitBedCount');
    const bedGridContainer = document.getElementById('bedGridContainer');
    
    const patientModal = document.getElementById('addPatientModal');
    const closeModalButton = document.getElementById('closePatientModal');
    const cancelModalButton = document.getElementById('cancelPatientModal');
    const savePatientButton = document.getElementById('savePatientButton');
    const patientForm = document.getElementById('patientForm');

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
                bedCard.innerHTML = `
                    <div class="bed-header"><h2>Leito ${bed.bed_number}</h2><span class="status-occupied">Ocupado</span></div>
                    <div class="patient-info"><p><strong>Paciente:</strong> ${bed.patient_name || 'Não informado'}</p></div>
                    <div class="bed-actions">
                        <button class="action-btn-main acessar-paciente-btn">Acessar Paciente</button>
                        <button class="action-btn">Transferir</button>
                        <button class="action-btn-danger">Dar Alta</button>
                    </div>`;
            }
            bedGridContainer.appendChild(bedCard);
        });
    }
    
    // =================================================================================
    // LÓGICA DE EVENTOS E MODAL
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
        }
        
        const acessarBtn = event.target.closest('.acessar-paciente-btn');
        if (acessarBtn) {
            const patientId = acessarBtn.closest('.bed-card').dataset.patientId;
            if (patientId) {
                // ======================================================
                // AQUI ESTÁ A CORREÇÃO: trocamos 'id=' por 'patientId='
                // ======================================================
                window.location.href = `patient-view.html?patientId=${patientId}`;
            }
        }
    });
    
    const closeModal = () => { patientModal.classList.remove('active'); patientForm.reset(); };
    if(closeModalButton) closeModalButton.addEventListener('click', closeModal);
    if(cancelModalButton) cancelModalButton.addEventListener('click', closeModal);

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
                // Esta rota para criar o paciente ainda precisa ser criada no seu backend (server.js)
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
                closeModal();
                loadUnitAndBeds();

            } catch (error) {
                console.error('Erro ao salvar paciente:', error);
                alert(`Erro: ${error.message}`);
            }
        });
    }
// Em public/unit-view.js

// No início do arquivo, adicione as referências ao novo modal
const dischargeModal = document.getElementById('dischargeModal');
const closeDischargeModal = document.getElementById('closeDischargeModal');
const cancelDischargeBtn = document.getElementById('cancelDischargeBtn');
const confirmDischargeBtn = document.getElementById('confirmDischargeBtn');
const dischargePatientName = document.getElementById('dischargePatientName');
const dischargeReasonSelect = document.getElementById('dischargeReason');
const dischargeDateInput = document.getElementById('dischargeDate');


// Dentro do event listener bedGridContainer.addEventListener('click', ...)
// Adicione este novo bloco de código:

const darAltaBtn = event.target.closest('.action-btn-danger');
if (darAltaBtn) {
    const bedCard = darAltaBtn.closest('.bed-card');
    const patientId = bedCard.dataset.patientId;
    const bedId = bedCard.dataset.bedId;
    const patientName = bedCard.querySelector('.patient-info p strong').nextSibling.textContent.trim();

    // Preenche os dados no modal e o exibe
    dischargePatientName.textContent = patientName;
    dischargeModal.dataset.patientId = patientId;
    dischargeModal.dataset.bedId = bedId;
    
    // Define a data e hora atual como padrão
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    dischargeDateInput.value = now.toISOString().slice(0, 16);
    
    dischargeModal.classList.add('active');
}


// Adicione estes event listeners no final do arquivo, para o novo modal

if(closeDischargeModal) closeDischargeModal.addEventListener('click', () => dischargeModal.classList.remove('active'));
if(cancelDischargeBtn) cancelDischargeBtn.addEventListener('click', () => dischargeModal.classList.remove('active'));

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
            dischargeModal.classList.remove('active');
            loadUnitAndBeds(); // Recarrega a grade de leitos

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