const form = document.getElementById('cadastroForm');
const mensagemErro = document.getElementById('mensagemErro');
const campoRa = document.getElementById('campoRa');
const inputRa = document.getElementById('ra');
const radiosTipo = document.querySelectorAll('input[name="tipoCadastro"]');

function atualizarCampoRa() {

    const tipoSelecionado =
        document.querySelector('input[name="tipoCadastro"]:checked').value;

    if (tipoSelecionado === 'ALUNO') {
        campoRa.style.display = 'block';
        inputRa.required = true;
    } else {
        campoRa.style.display = 'none';
        inputRa.required = false;
        inputRa.value = '';
    }

}

radiosTipo.forEach((radio) => {
    radio.addEventListener('change', atualizarCampoRa);
});

atualizarCampoRa();

form.addEventListener('submit', async (e) => {
    e.preventDefault();
    mensagemErro.textContent = '';

    const tipoCadastro =
        document.querySelector('input[name="tipoCadastro"]:checked').value;

    const ra = document.getElementById('ra').value.trim();
    const nome = document.getElementById('nome').value.trim();
    const email = document.getElementById('email').value.trim();
    const senha = document.getElementById('senha').value;
    const confirmarSenha = document.getElementById('confirmarSenha').value;

    if (tipoCadastro === 'ALUNO' && !/^\d+$/.test(ra)) {
        mensagemErro.textContent = 'O RA deve conter apenas números.';
        return;
    }

    if (!nome) {
        mensagemErro.textContent = 'Digite seu nome completo.';
        return;
    }

    if (!email) {
        mensagemErro.textContent = 'Digite seu e-mail.';
        return;
    }

    if (senha !== confirmarSenha) {
        mensagemErro.textContent = 'As senhas digitadas não são iguais.';
        return;
    }

    if (senha.length < 6) {
        mensagemErro.textContent = 'A senha precisa ter pelo menos 6 caracteres.';
        return;
    }

    try {

        const resposta = await fetch('/cadastro', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                ra: tipoCadastro === 'ALUNO' ? ra : null,
                nome,
                email,
                senha,
                tipoCadastro
            })
        });

        const dados = await resposta.json();

        if (dados.sucesso) {
            mostrarCadastroEnviado(dados.mensagem);
        } else {
            mensagemErro.textContent = dados.mensagem || 'Não foi possível concluir o cadastro.';
        }

    } catch (erro) {
        console.error(erro);
        mensagemErro.textContent = 'Erro ao conectar com o servidor.';
    }
});

// Aviso estilizado (no lugar do alert nativo do navegador)
function mostrarCadastroEnviado(mensagem) {

    const modal = document.getElementById('modalCadastroEnviado');
    const botao = document.getElementById('btnCadastroEnviado');

    // O servidor manda "Cadastro enviado! Aguarde a aprovação de um administrador."
    // O título já diz "Cadastro enviado!", então tiramos a repetição do texto.
    const texto = String(mensagem || '')
        .replace(/^\s*Cadastro enviado!?\s*/i, '')
        .trim();

    if (texto) {
        document.getElementById('textoCadastroEnviado').textContent = texto;
    }

    function irParaLogin() {
        window.location.href = '/index.html';
    }

    botao.addEventListener('click', irParaLogin);

    modal.addEventListener('click', function (e) {
        if (e.target === modal) irParaLogin();
    });

    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') irParaLogin();
    });

    modal.hidden = false;
    botao.focus();
}
