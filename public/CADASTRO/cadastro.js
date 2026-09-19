const form = document.getElementById('cadastroForm');
const mensagemErro = document.getElementById('mensagemErro');

form.addEventListener('submit', async (e) => {
    e.preventDefault();
    mensagemErro.textContent = '';

    const ra = document.getElementById('ra').value.trim();
    const senha = document.getElementById('senha').value;
    const confirmarSenha = document.getElementById('confirmarSenha').value;

    if (!/^\d+$/.test(ra)) {
        mensagemErro.textContent = 'O RA deve conter apenas números.';
        return;
    }

    if (senha !== confirmarSenha) {
        mensagemErro.textContent = 'As senhas do SUAP digitadas não são iguais.';
        return;
    }z  

    if (senha.length < 6) {
        mensagemErro.textContent = 'A senha precisa ter pelo menos 6 caracteres.';
        return;
    }

    try {
        // Envia só RA e senha do SUAP. O tipo de usuário (ALUNO)
        // é definido pelo servidor, não pela tela, por segurança.
        const resposta = await fetch('/cadastro', {
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