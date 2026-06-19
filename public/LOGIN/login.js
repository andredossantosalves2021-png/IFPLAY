const form = document.getElementById('loginForm');

form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const ra = document.getElementById('ra').value;
    const senha = document.getElementById('senha').value;

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
            alert(dados.mensagem);
        }

    } catch (erro) {
        console.error(erro);
        alert('Erro ao conectar com o servidor.');
    }
});