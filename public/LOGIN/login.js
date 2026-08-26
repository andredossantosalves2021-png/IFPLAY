const form = document.getElementById('loginForm');
const botaoLogin = document.querySelector('.botao-login');
const mensagemLogin = document.getElementById('mensagemLogin');

form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const ra = document.getElementById('ra').value;
    const senha = document.getElementById('senha').value;

    // Limpa mensagens de tentativas anteriores
    mensagemLogin.textContent = '';

    botaoLogin.disabled = true;

    botaoLogin.innerHTML = 'Entrando...';

    try {
        const resposta = await fetch('/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                ra,
                senha
            })
        });

        const dados = await resposta.json();

        if (dados.sucesso) {
            localStorage.setItem(
                'usuario',
                JSON.stringify(dados.usuario)
            );

            window.location.href =
                '../DASHBOARD/dashboard.html';

        } else {
            mensagemLogin.textContent =
                dados.mensagem || 'Matrícula ou senha incorreta.';

            botaoLogin.disabled = false;

            botaoLogin.innerHTML = `
                <i class="fa-solid fa-right-to-bracket"></i>
                Entrar
            `;
        }

    } catch (erro) {
        console.error(erro);

        mensagemLogin.textContent =
            'Erro ao conectar com o servidor. Tente novamente.';

        botaoLogin.disabled = false;

        botaoLogin.innerHTML = `
            <i class="fa-solid fa-right-to-bracket"></i>
            Entrar
        `;
    }
});