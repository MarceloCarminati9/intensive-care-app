document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');

    if (loginForm) {
        loginForm.addEventListener('submit', async (event) => {
            console.log("PASSO 1: Formulário de login enviado. Prevenindo recarregamento...");
            event.preventDefault();

            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            
            console.log("PASSO 2: Dados capturados do formulário:", { email, password });

            if (!email || !password) {
                alert("Por favor, preencha todos os campos.");
                console.log("Validação falhou: campos vazios.");
                return;
            }

            console.log("PASSO 3: Enviando dados para o backend em https://intensive-care-api.onrender.com...");
            try {
                const response = await fetch('https://intensive-care-api.onrender.com/login', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ email, password }),
                });

                console.log("PASSO 4: Resposta recebida do backend. Status:", response.status, response.statusText);
                
                const result = await response.json();
                console.log("PASSO 5: Corpo da resposta (JSON):", result);

                if (response.ok) {
                    console.log("PASSO 6: Login bem-sucedido. Salvando token e redirecionando...");
                    alert(result.message);
                    localStorage.setItem('userToken', result.token);
                    window.location.href = 'dashboard.html'; 
                } else {
                    console.warn("Login falhou. Mensagem do servidor:", result.message);
                    alert(`Erro no login: ${result.message}`);
                }

            } catch (error) {
                console.error("ERRO CRÍTICO na requisição fetch. O backend está rodando?", error);
                alert('Não foi possível conectar ao servidor. Verifique o console para mais detalhes.');
            }
        });
    } else {
        console.error("Elemento com ID 'loginForm' não foi encontrado.");
    }
});