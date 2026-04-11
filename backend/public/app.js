document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('config-form');
    const btnSave = document.getElementById('btn-save');
    const loadingBox = document.getElementById('loading');
    const successMsg = document.getElementById('success-msg');
    const errorMsg = document.getElementById('error-msg');
    
    // Sliders
    const inputs = form.querySelectorAll('input[type="range"]');

    // Init Values
    let currentConfig = {};

    function showMsg(el) {
        successMsg.style.display = 'none';
        errorMsg.style.display = 'none';
        if (el) {
            el.style.display = 'block';
            setTimeout(() => el.style.display = 'none', 3000);
        }
    }

    // Load Data
    fetch('/api/config')
        .then(res => {
            if (!res.ok) throw new Error('Network error');
            return res.json();
        })
        .then(data => {
            if (data.error) throw new Error(data.error);
            currentConfig = data;
            
            // Map values to inputs
            inputs.forEach(input => {
                const key = input.id;
                if (currentConfig[key] !== undefined) {
                    input.value = currentConfig[key];
                    document.getElementById(`val_${key}`).innerText = currentConfig[key];
                }
            });

            loadingBox.style.display = 'none';
            form.style.display = 'block';
            btnSave.disabled = false;
        })
        .catch(err => {
            loadingBox.style.display = 'none';
            errorMsg.innerText = `Fehler beim Laden: ${err.message}`;
            errorMsg.style.display = 'block';
        });

    // Update Display value on slide
    inputs.forEach(input => {
        input.addEventListener('input', (e) => {
            document.getElementById(`val_${e.target.id}`).innerText = e.target.value;
        });
    });

    // Save Data
    btnSave.addEventListener('click', () => {
        btnSave.disabled = true;
        btnSave.innerText = 'Speichere...';

        const updatedConfig = {};
        inputs.forEach(input => {
            updatedConfig[input.id] = parseFloat(input.value);
        });

        fetch('/api/config', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updatedConfig)
        })
        .then(res => res.json())
        .then(data => {
            btnSave.disabled = false;
            btnSave.innerText = 'Speichern & Übernehmen';
            if (data.success) {
                showMsg(successMsg);
            } else {
                errorMsg.innerText = data.error || 'Fehler beim Speichern';
                showMsg(errorMsg);
            }
        })
        .catch(err => {
            btnSave.disabled = false;
            btnSave.innerText = 'Speichern & Übernehmen';
            errorMsg.innerText = `Fehler: ${err.message}`;
            showMsg(errorMsg);
        });
    });
});
