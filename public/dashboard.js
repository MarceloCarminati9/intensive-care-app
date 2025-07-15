document.addEventListener('DOMContentLoaded', function() {

    // =================================================================================
    // Seleção de Elementos
    // =================================================================================
    const unitListContainer = document.querySelector('.unit-list');
    const addUnitButton = document.getElementById('addUnitBtn');
    const modalOverlay = document.getElementById('addUnitModal');
    const closeModalButton = document.getElementById('closeModalButton');
    const cancelModalButton = document.getElementById('cancelModalButton');
    const saveUnitButton = document.getElementById('saveUnitButton');
    const unitNameInput = document.getElementById('unitName');
    const unitBedsInput = document.getElementById('unitBeds');
    const hgrLogoSrc = 'intensivecare.jpeg'; // Caminho para o seu logotipo

    // Checagem de segurança para garantir que todos os elementos essenciais existem
    if (!unitListContainer || !addUnitButton || !modalOverlay) {
        console.error("ERRO: Um ou mais elementos principais do dashboard (unit-list, addUnitBtn, addUnitModal) não foram encontrados no HTML.");
        return;
    }

    // =================================================================================
    // FUNÇÃO PARA CARREGAR AS UNIDADES DO SERVIDOR
    // =================================================================================
    async function loadUnits() {
        try {
            // Caminho relativo para a API, funciona tanto localmente quanto no Render
            const response = await fetch('/api/units');

            if (!response.ok) {
                throw new Error(`Erro de rede ou servidor: ${response.statusText}`);
            }

            const result = await response.json();
            const units = result.data;

            unitListContainer.innerHTML = '';

            if (units.length === 0) {
                unitListContainer.innerHTML = '<p>Nenhuma unidade cadastrada. Clique em "+ Adicionar Nova Unidade" para começar.</p>';
                return;
            }

            units.forEach(unit => {
                const unitCard = document.createElement('article');
                unitCard.className = 'unit-card';
                unitCard.dataset.unitId = unit.id;
                unitCard.dataset.unitName = unit.name;

                // A contagem de ocupação virá do backend
                const occupiedBeds = unit.occupied_beds || 0;
                const totalBeds = unit.total_beds || 0;
                const occupancyPercentage = totalBeds > 0 ? ((occupiedBeds / totalBeds) * 100).toFixed(0) : 0;

                unitCard.innerHTML = `
                    <div class="unit-info">
                        <h3><img src="${hgrLogoSrc}" alt="Logo HGR"> ${unit.name}</h3>
                        <p>${totalBeds} Leitos</p>
                    </div>
                    <div class="unit-stats">
                        <span>Ocupação: <strong>${occupiedBeds} / ${totalBeds}</strong> (${occupancyPercentage}%)</span>
                    </div>
                    <div class="unit-actions">
                        <a href="#" class="button-manage">Gerenciar Leitos</a>
                        <button type="button" class="button-delete">🗑️</button>
                    </div>
                `;
                unitListContainer.appendChild(unitCard);
            });

        } catch (error) {
            console.error('Falha ao buscar unidades:', error);
            unitListContainer.innerHTML = '<p style="color: red;">Não foi possível carregar as unidades. Verifique se o servidor backend está rodando e acessível.</p>';
        }
    }

    // =================================================================================
    // LÓGICA DO MODAL (ABRIR E FECHAR)
    // =================================================================================
    function openModal() {
        if(modalOverlay) modalOverlay.classList.add('active');
    }
    function closeModal() {
        if(modalOverlay) {
            modalOverlay.classList.remove('active');
            unitNameInput.value = '';
            unitBedsInput.value = '';
        }
    }

    if(addUnitButton) addUnitButton.addEventListener('click', openModal);
    if(closeModalButton) closeModalButton.addEventListener('click', closeModal);
    if(cancelModalButton) cancelModalButton.addEventListener('click', closeModal);

    // =================================================================================
    // LÓGICA PARA SALVAR E DELETAR (CONECTADA AO BACKEND)
    // =================================================================================
    if(saveUnitButton) {
        saveUnitButton.addEventListener('click', async function() {
            const name = unitNameInput.value.trim();
            const total_beds = parseInt(unitBedsInput.value);

            if (!name || isNaN(total_beds) || total_beds <= 0) {
                alert('Por favor, preencha um nome válido e um número de leitos maior que zero.');
                return;
            }

            try {
                // Caminho relativo para a API
                const response = await fetch('/api/units', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name, total_beds }),
                });

                if (!response.ok) throw new Error('Erro ao criar a unidade no servidor.');

                closeModal();
                loadUnits();
            } catch (error) {
                alert(`Falha ao salvar a unidade: ${error.message}`);
            }
        });
    }

    unitListContainer.addEventListener('click', async function(event) {
        const target = event.target;

        const manageButton = target.closest('.button-manage');
        if (manageButton) {
            event.preventDefault();
            const card = manageButton.closest('.unit-card');
            const unitId = card.dataset.unitId;
            if(unitId) {
                window.location.href = `unit-view.html?unitId=${unitId}`;
            }
            return;
        }

        const deleteButton = target.closest('.button-delete');
        if (deleteButton) {
            const card = deleteButton.closest('.unit-card');
            const unitId = card.dataset.unitId;
            const unitName = card.dataset.unitName;

            if (confirm(`Tem certeza que deseja excluir a unidade "${unitName}"?\n\nEsta ação é permanente e não pode ser desfeita.`)) {
                try {
                    // Caminho relativo para a API
                    const response = await fetch(`/api/units/${unitId}`, {
                        method: 'DELETE',
                    });
                    if (!response.ok) throw new Error('Erro ao deletar a unidade no servidor.');
                    loadUnits();
                } catch (error) {
                    alert(`Falha ao deletar a unidade: ${error.message}`);
                }
            }
        }
    });

    // =================================================================================
    // NOVA LÓGICA DA BUSCA DE PACIENTES
    // =================================================================================
    const searchInput = document.getElementById('patientSearchInput');
    const searchResultsContainer = document.getElementById('patientSearchResults');
    let searchTimeout;

    if (searchInput && searchResultsContainer) {
        searchInput.addEventListener('input', () => {
            clearTimeout(searchTimeout);
            const query = searchInput.value.trim();

            if (query.length < 3) {
                searchResultsContainer.classList.remove('active');
                return;
            }

            // Espera 300ms após o usuário parar de digitar para fazer a busca
            searchTimeout = setTimeout(async () => {
                try {
                    // Futura rota de API para buscar pacientes
                    const response = await fetch(`/api/patients/search?q=${encodeURIComponent(query)}`);
                    if (!response.ok) throw new Error('Falha na busca.');

                    const results = await response.json();
                    displaySearchResults(results.data);
                } catch (error) {
                    console.error("Erro ao buscar pacientes:", error);
                    searchResultsContainer.innerHTML = '<div class="result-item"><p>Erro ao buscar. Tente novamente.</p></div>';
                    searchResultsContainer.classList.add('active');
                }
            }, 300);
        });

        // Esconde os resultados se o usuário clicar fora da área de busca
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.search-container')) {
                searchResultsContainer.classList.remove('active');
            }
        });
    }

    function displaySearchResults(patients) {
        if (!searchResultsContainer) return;
        searchResultsContainer.innerHTML = '';

        if (!patients || patients.length === 0) {
            searchResultsContainer.innerHTML = '<div class="result-item"><p>Nenhum paciente encontrado.</p></div>';
        } else {
            patients.forEach(patient => {
                const item = document.createElement('div');
                item.className = 'result-item';
                item.dataset.patientId = patient.id; // Armazena o ID do paciente

                const dob = new Date(patient.dob).toLocaleDateString('pt-BR');
                const statusClass = patient.status === 'admitted' ? 'admitted' : 'discharged';
                const statusText = patient.status === 'admitted' ? `Internado - ${patient.unit_name} / Leito ${patient.bed_number}` : 'Alta';

                item.innerHTML = `
                    <div class="info">
                        <p>${patient.name}</p>
                        <span>Nasc: ${dob} | CNS: ${patient.cns || 'Não informado'}</span>
                    </div>
                    <div class="status ${statusClass}">${statusText}</div>
                `;

                item.addEventListener('click', () => {
                    window.location.href = `patient-view.html?patientId=${patient.id}`;
                });

                searchResultsContainer.appendChild(item);
            });
        }
        searchResultsContainer.classList.add('active');
    }

    // =================================================================================
    // INICIALIZAÇÃO
    // =================================================================================
    loadUnits();
});