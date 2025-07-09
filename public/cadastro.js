document.addEventListener('DOMContentLoaded', () => {
    const registerForm = document.getElementById('registerForm');

    if (registerForm) {
        registerForm.addEventListener('submit', async (event) => {
            // Impede o comportamento padrão do formulário (que é recarregar a página)
            event.preventDefault();

            // Pega os valores dos campos do formulário
            const fullName = document.getElementById('fullName').value;
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            const confirmPassword = document.getElementById('confirmPassword').value;

            // Validação simples no frontend
            if (password !== confirmPassword) {
                alert("As senhas não coincidem!");
                return;
            }
            if (password.length < 6) {
                alert("A senha deve ter pelo menos 6 caracteres.");
                return;
            }

            // Envia os dados para a API do nosso backend
            try {
                const response = await fetch('https://intensive-care-api.onrender.com/register', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ fullName, email, password }),
                });

                const result = await response.json();

                if (response.ok) { // Status de sucesso (ex: 201 Created)
                    alert(result.message); // Exibe "Usuário cadastrado com sucesso!"
                    window.location.href = 'login.html'; // Redireciona para a página de login
                } else {
                    // Exibe a mensagem de erro vinda do backend (ex: "E-mail já cadastrado")
                    alert(`Erro no cadastro: ${result.message}`);
                }

            } catch (error) {
                console.error('Falha ao conectar com o backend:', error);
                alert('Não foi possível conectar ao servidor. Verifique se o backend está rodando.');
            }
        });
    }
});