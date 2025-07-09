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

    if (!unitListContainer || !addUnitButton || !modalOverlay) {
        console.error("ERRO: Um ou mais elementos principais do dashboard não foram encontrados.");
        return;
    }

    // =================================================================================
    // FUNÇÃO PARA CARREGAR AS UNIDADES DO SERVIDOR
    // =================================================================================
    async function loadUnits() {
        try {
            // CORREÇÃO: Usando caminho relativo para a API
            const response = await fetch('/api/units'); 
            if (!response.ok) {
                throw new Error(`Erro de rede: ${response.statusText}`);
            }

            const result = await response.json();
            const units = result.data;

            unitListContainer.innerHTML = ''; 

            if (units.length === 0) {
                unitListContainer.innerHTML = '<p>Nenhuma unidade cadastrada.</p>';
                return;
            }

            units.forEach(unit => {
                const unitCard = document.createElement('article');
                unitCard.className = 'unit-card';
                unitCard.dataset.unitId = unit.id;
                unitCard.dataset.unitName = unit.name;

                const occupancyPercentage = unit.total_beds > 0 ? ((unit.occupied_beds / unit.total_beds) * 100).toFixed(0) : 0;

                unitCard.innerHTML = `
                    <div class="unit-info">
                        <h3>${unit.name}</h3>
                        <p>${unit.total_beds} Leitos</p>
                    </div>
                    <div class="unit-stats">
                        <span>Ocupação: <strong>${unit.occupied_beds || 0} / ${unit.total_beds}</strong> (${occupancyPercentage}%)</span>
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
            unitListContainer.innerHTML = '<p style="color: red;">Não foi possível carregar as unidades. O servidor backend está rodando?</p>';
        }
    }

    // =================================================================================
    // LÓGICA DO MODAL (ABRIR E FECHAR)
    // =================================================================================
    function openModal() { modalOverlay.classList.add('active'); }
    function closeModal() { modalOverlay.classList.remove('active'); unitNameInput.value = ''; unitBedsInput.value = ''; }

    addUnitButton.addEventListener('click', openModal);
    closeModalButton.addEventListener('click', closeModal);
    cancelModalButton.addEventListener('click', closeModal);

    // =================================================================================
    // LÓGICA PARA SALVAR E DELETAR (CONECTADA AO BACKEND)
    // =================================================================================
    saveUnitButton.addEventListener('click', async function() {
        const name = unitNameInput.value.trim();
        const total_beds = parseInt(unitBedsInput.value);

        if (!name || isNaN(total_beds) || total_beds <= 0) {
            alert('Por favor, preencha um nome válido e um número de leitos maior que zero.');
            return;
        }

        try {
            // CORREÇÃO: Usando caminho relativo para a API
            const response = await fetch('/api/units', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, total_beds }),
            });

            if (!response.ok) throw new Error('Erro ao criar a unidade.');
            
            closeModal();
            loadUnits();
            
        } catch (error) {
            alert(`Falha ao salvar a unidade: ${error.message}`);
        }
    });

    unitListContainer.addEventListener('click', async function(event) {
        const target = event.target;

        const manageButton = target.closest('.button-manage');
        if (manageButton) {
            event.preventDefault();
            const card = manageButton.closest('.unit-card');
            const unitId = card.dataset.unitId;
            if(unitId) {
                // A navegação continua sendo para um arquivo local, isso está correto
                window.location.href = `unit-view.html?unitId=${unitId}`;
            }
            return;
        }

        const deleteButton = target.closest('.button-delete');
        if (deleteButton) {
            const card = deleteButton.closest('.unit-card');
            const unitId = card.dataset.unitId;
            const unitName = card.dataset.unitName;

            if (confirm(`Tem certeza que deseja excluir a unidade "${unitName}"?\n\nEsta ação é permanente.`)) {
                try {
                    // CORREÇÃO: Usando caminho relativo para a API
                    const response = await fetch(`/api/units/${unitId}`, {
                        method: 'DELETE',
                    });
                    if (!response.ok) throw new Error('Erro ao deletar a unidade.');
                    loadUnits();
                } catch (error) {
                    alert(`Falha ao deletar a unidade: ${error.message}`);
                }
            }
        }
    });

    // INICIALIZAÇÃO
    loadUnits();
});