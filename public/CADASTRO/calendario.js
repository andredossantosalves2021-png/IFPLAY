const form = document.getElementById('cadastroForm');
const mensagemErro = document.getElementById('mensagemErro');

form.addEventListener('submit', async (e) => {
    e.preventDefault();
    mensagemErro.textContent = '';

    const nome = document.getElementById('nome').value.trim();
    const ra = document.getElementById('ra').value.trim();
    const senha = document.getElementById('senha').value;
    const confirmarSenha = document.getElementById('confirmarSenha').value;

    if (senha !== confirmarSenha) {
        mensagemErro.textContent = 'As senhas digitadas não são iguais.';
        return;
    }

    if (senha.length < 6) {
        mensagemErro.textContent = 'A senha precisa ter pelo menos 6 caracteres.';
        return;
    }

    try {
        // Envia só nome, RA e senha. O tipo de usuário (ALUNO)
        // é definido pelo servidor, não pela tela, por segurança.
        const resposta = await fetch('/cadastro', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                nome,
                ra,
                senha
            })
        });

        const dados = await resposta.json();

        if (dados.sucesso) {
            alert('Cadastro realizado com sucesso! Agora faça login.');
            window.location.href = '/index.html';
        } else {
            mensagemErro.textContent = dados.mensagem || 'Não foi possível concluir o cadastro.';
        }

    } catch (erro) {
        console.error(erro);
        mensagemErro.textContent = 'Erro ao conectar com o servidor.';
    }
});