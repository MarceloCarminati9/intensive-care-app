document.addEventListener('DOMContentLoaded', function() {
    // =================================================================================
    // SELEÇÃO DE ELEMENTOS
    // =================================================================================
    const params = new URLSearchParams(window.location.search);
    const patientId = params.get('patientId');

    // Cabeçalho
    const backLink = document.getElementById('backLink');
    const patientNameHeader = document.getElementById('patientNameHeader');
    const patientBedHeader = document.getElementById('patientBedHeader');
    const prescriptionDateEl = document.getElementById('prescriptionDate');

    // Seções
    const dietaDesc = document.getElementById('dietaDesc');
    const hydrationItemsContainer = document.getElementById('hydration-items-container');
    const medicationItemsContainer = document.getElementById('medication-items-container');

    // Botões
    const addHydrationBtn = document.getElementById('addHydrationBtn');
    const addMedicationBtn = document.getElementById('addMedicationBtn');
    const savePrescriptionBtn = document.getElementById('savePrescriptionBtn');
    const cancelPrescriptionBtn = document.getElementById('cancelPrescriptionBtn');
    
    // Dados
    let farmacosData = [];
    let patientData = {};

    // =================================================================================
    // INICIALIZAÇÃO
    // =================================================================================
    async function init() {
        if (!patientId) {
            document.body.innerHTML = '<h1>Erro: ID do paciente não fornecido.</h1><a href="dashboard.html">Voltar</a>';
            return;
        }
        
        await Promise.all([
            loadPatientData(),
            loadFarmacosData()
        ]);
        
        setupEventListeners();
        
        addPrescriptionItem('medication');
        addPrescriptionItem('hydration');
    }

    // =================================================================================
    // CARREGAMENTO DE DADOS
    // =================================================================================
    async function loadPatientData() {
        try {
            const response = await fetch(`/api/patients/${patientId}`);
            if (!response.ok) throw new Error('Paciente não encontrado');
            const result = await response.json();
            patientData = result.data;
            
            backLink.href = `patient-view.html?patientId=${patientId}`;
            patientNameHeader.textContent = patientData.name;
            patientBedHeader.textContent = `${patientData.unit_name || 'Unidade'} - Leito ${patientData.bed_number || 'N/A'}`;
            prescriptionDateEl.textContent = new Date().toLocaleDateString('pt-BR');
        } catch (error) {
            console.error("Erro ao carregar dados do paciente:", error);
            patientNameHeader.textContent = "Erro ao carregar";
        }
    }

    async function loadFarmacosData() {
        try {
            const response = await fetch('data/farmacos.json');
            if (!response.ok) throw new Error('Arquivo de fármacos não encontrado');
            farmacosData = await response.json();
        } catch (error) {
            console.error("Erro ao carregar fármacos:", error);
            alert("Atenção: A lista de medicamentos para autocompletar não foi encontrada. Verifique o arquivo public/data/farmacos.json");
        }
    }

    // =================================================================================
    // MANIPULAÇÃO DINÂMICA DE ITENS
    // =================================================================================
    function addPrescriptionItem(type) {
        const container = type === 'medication' ? medicationItemsContainer : hydrationItemsContainer;
        const itemHtml = `
            <div class="prescription-item" data-type="${type}">
                <div class="form-group autocomplete-container">
                    <label>Medicamento / Solução</label>
                    <input type="text" class="medication-name" placeholder="Digite para buscar...">
                    <div class="autocomplete-results"></div>
                </div>
                <div class="form-group">
                    <label>Dose / Volume</label>
                    <input type="text" class="medication-dose" placeholder="Ex: 500mg, 1000ml">
                </div>
                <div class="form-group">
                    <label>Via</label>
                    <input type="text" class="medication-via" placeholder="Ex: EV, VO">
                </div>
                <div class="form-group">
                    <label>Frequência</label>
                    <input type="text" class="medication-frequency" placeholder="Ex: 8/8h">
                </div>
                <div class="form-group">
                    <label>Observações</label>
                    <input type="text" class="medication-obs" placeholder="Diluir em...">
                </div>
                <button type="button" class="remove-item-btn" title="Remover item">&times;</button>
            </div>
        `;
        container.insertAdjacentHTML('beforeend', itemHtml);
    }

    function handleItemRemoval(event) {
        if (event.target.classList.contains('remove-item-btn')) {
            event.target.closest('.prescription-item').remove();
        }
    }

    // =================================================================================
    // LÓGICA DE AUTOCOMPLETAR
    // =================================================================================
    function handleMedicationInput(event) {
        const input = event.target;
        if (!input.classList.contains('medication-name')) return;

        const query = input.value.toLowerCase();
        const resultsContainer = input.nextElementSibling;
        resultsContainer.innerHTML = '';

        if (query.length < 2) {
            resultsContainer.classList.remove('active');
            return;
        }

        const filtered = farmacosData.filter(f => f.medicamento.toLowerCase().includes(query)).slice(0, 7);

        if(filtered.length > 0) {
            filtered.forEach(farmaco => {
                const div = document.createElement('div');
                div.className = 'autocomplete-item';
                div.textContent = farmaco.medicamento;
                div.addEventListener('click', () => {
                    const itemRow = input.closest('.prescription-item');
                    itemRow.querySelector('.medication-name').value = farmaco.medicamento;
                    // Tenta extrair a dose do texto completo
                    const doseMatch = farmaco.posologia_completa.match(/(\d+\s*m[g|L])/);
                    itemRow.querySelector('.medication-dose').value = doseMatch ? doseMatch[0] : '';
                    // Preenche com a posologia completa nas observações para referência
                    itemRow.querySelector('.medication-obs').value = farmaco.posologia_completa;
                    resultsContainer.classList.remove('active');
                    resultsContainer.innerHTML = '';
                });
                resultsContainer.appendChild(div);
            });
            resultsContainer.classList.add('active');
        } else {
            resultsContainer.classList.remove('active');
        }
    }

    // =================================================================================
    // LÓGICA PARA SALVAR PRESCRIÇÃO
    // =================================================================================
    async function savePrescription() {
        const prescriptionData = {
            patient_id: patientId,
            diet_description: dietaDesc.value.trim(),
            hydration_items: [],
            medication_items: []
        };

        hydrationItemsContainer.querySelectorAll('.prescription-item').forEach(item => {
            const name = item.querySelector('.medication-name').value.trim();
            if (name) {
                prescriptionData.hydration_items.push({
                    name: name,
                    dose: item.querySelector('.medication-dose').value.trim(),
                    via: item.querySelector('.medication-via').value.trim(),
                    frequency: item.querySelector('.medication-frequency').value.trim(),
                    notes: item.querySelector('.medication-obs').value.trim(),
                });
            }
        });

        medicationItemsContainer.querySelectorAll('.prescription-item').forEach(item => {
            const name = item.querySelector('.medication-name').value.trim();
            if (name) {
                prescriptionData.medication_items.push({
                    name: name,
                    dose: item.querySelector('.medication-dose').value.trim(),
                    via: item.querySelector('.medication-via').value.trim(),
                    frequency: item.querySelector('.medication-frequency').value.trim(),
                    notes: item.querySelector('.medication-obs').value.trim(),
                });
            }
        });

        console.log("Dados a serem salvos:", prescriptionData);

        try {
            savePrescriptionBtn.disabled = true;
            savePrescriptionBtn.textContent = 'Salvando...';

            const response = await fetch('/api/prescriptions', { 
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(prescriptionData)
            });

            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.error || "Falha ao salvar a prescrição.");
            }

            alert("Prescrição salva com sucesso!");
            window.location.href = `patient-view.html?patientId=${patientId}`;

        } catch (error) {
            console.error("Erro ao salvar prescrição:", error);
            alert(`Erro: ${error.message}`);
            savePrescriptionBtn.disabled = false;
            savePrescriptionBtn.textContent = 'Salvar Prescrição';
        }
    }

    // =================================================================================
    // CONFIGURAÇÃO DOS EVENT LISTENERS
    // =================================================================================
    function setupEventListeners() {
        addHydrationBtn.addEventListener('click', () => addPrescriptionItem('hydration'));
        addMedicationBtn.addEventListener('click', () => addPrescriptionItem('medication'));
        
        hydrationItemsContainer.addEventListener('click', handleItemRemoval);
        medicationItemsContainer.addEventListener('click', handleItemRemoval);
        
        const mainContainer = document.querySelector('.prescription-body');
        mainContainer.addEventListener('input', handleMedicationInput);
        
        savePrescriptionBtn.addEventListener('click', savePrescription);
        cancelPrescriptionBtn.addEventListener('click', () => {
            if(confirm("Tem certeza que deseja cancelar? Todas as alterações serão perdidas.")) {
                window.location.href = `patient-view.html?patientId=${patientId}`;
            }
        });
    }

    // Inicia a aplicação
    init();
});