document.addEventListener('DOMContentLoaded', () => {
    const drugSelect = document.getElementById('drug');
    const drugAmountInput = document.getElementById('drugAmount');
    const solutionVolumeInput = document.getElementById('solutionVolume');
    const doseLabel = document.getElementById('doseLabel');
    const calculateBtn = document.getElementById('calculateBtn');
    const resultBox = document.getElementById('resultBox');
    const resultText = document.getElementById('resultText');
    const weightInput = document.getElementById('weight');
    const doseInput = document.getElementById('dose');
    const rateInput = document.getElementById('rate');

    const standardDilutions = {
        norepinephrine: { amount: 16, volume: 250, unit: 'mcg/kg/min' },
        dobutamine: { amount: 250, volume: 250, unit: 'mcg/kg/min' },
        dopamine: { amount: 500, volume: 250, unit: 'mcg/kg/min' },
        epinephrine: { amount: 10, volume: 250, unit: 'mcg/kg/min' },
        vasopressin: { amount: 20, volume: 100, unit: 'UI/min' }
    };

    function updateDilution() {
        const selectedDrug = drugSelect.value;
        const dilution = standardDilutions[selectedDrug];
        drugAmountInput.value = dilution.amount;
        solutionVolumeInput.value = dilution.volume;
        doseLabel.textContent = `Dose Desejada (${dilution.unit})`;
    }

    function calculate() {
        const weight = parseFloat(weightInput.value);
        const drugAmount = parseFloat(drugAmountInput.value);
        const solutionVolume = parseFloat(solutionVolumeInput.value);
        const dose = parseFloat(doseInput.value);
        const rate = parseFloat(rateInput.value);
        const selectedDrug = drugSelect.value;
        const unit = standardDilutions[selectedDrug].unit;

        if (!weight || !drugAmount || !solutionVolume) {
            alert('Por favor, preencha o peso e os dados de diluição.');
            return;
        }

        const concentration = (drugAmount * 1000) / solutionVolume; // mcg/ml

        let finalResult = '--';
        let calculationPerformed = false;

        if (rate && !dose) { // Calcular dose a partir da infusão
            let calculatedDose;
            if (unit === 'UI/min') { // Vasopressina
                const concentration_UI = drugAmount / solutionVolume; // UI/ml
                calculatedDose = (rate * concentration_UI) / 60; // UI/min
                finalResult = `${calculatedDose.toFixed(4)} <span>${unit}</span>`;
            } else { // Outras drogas
                calculatedDose = (rate * concentration) / (weight * 60);
                finalResult = `${calculatedDose.toFixed(2)} <span>${unit}</span>`;
            }
            calculationPerformed = true;
        } else if (dose && !rate) { // Calcular infusão a partir da dose
            let calculatedRate;
            if (unit === 'UI/min') { // Vasopressina
                const concentration_UI = drugAmount / solutionVolume; // UI/ml
                calculatedRate = (dose * 60) / concentration_UI;
                finalResult = `${calculatedRate.toFixed(1)} <span>ml/h</span>`;
            } else { // Outras drogas
                calculatedRate = (dose * weight * 60) / concentration;
                finalResult = `${calculatedRate.toFixed(1)} <span>ml/h</span>`;
            }
            calculationPerformed = true;
        } else {
            alert('Preencha a Dose para calcular a Infusão, ou a Infusão para calcular a Dose.');
            return;
        }

        if (calculationPerformed) {
            resultText.innerHTML = finalResult;
            resultBox.style.display = 'block';
        }
    }
    
    drugSelect.addEventListener('change', updateDilution);
    calculateBtn.addEventListener('click', calculate);
    
    // Limpar campos de cálculo ao digitar em um deles
    doseInput.addEventListener('input', () => rateInput.value = '');
    rateInput.addEventListener('input', () => doseInput.value = '');

    // Inicializar
    updateDilution();
});