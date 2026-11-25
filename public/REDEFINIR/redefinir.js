// Esqueci minha senha: sem token no endereço, pede o e-mail;
// com #token=... (link do e-mail), mostra o formulário de nova senha.

const formEmail = document.getElementById('formEmail');
const formSenha = document.getElementById('formSenha');
const mensagemEmail = document.getElementById('mensagemEmail');
const mensagemSenha = document.getElementById('mensagemSenha');

const token = new URLSearchParams(window.location.hash.slice(1)).get('token');

// Tira o token da barra de endereço (ele continua guardado na variável)
if (token) {
    history.replaceState(null, '', window.location.pathname);
}

function mostrarMensagem(elemento, texto, sucesso) {
    elemento.textContent = texto;
    elemento.classList.toggle('sucesso', Boolean(sucesso));
}

async function enviar(url, corpo) {

    const resposta = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(corpo)
    });

    const dados = await resposta.json().catch(() => ({}));

    return { ok: resposta.ok && dados.sucesso, dados };
}

if (token && /^[a-f0-9]{64}$/.test(token)) {

    formSenha.hidden = false;

    formSenha.addEventListener('submit', async (e) => {

        e.preventDefault();

        const senha = document.getElementById('senha').value;
        const confirmar = document.getElementById('confirmarSenha').value;
        const botao = formSenha.querySelector('.botao-login');

        if (senha.length < 6) {
            mostrarMensagem(mensagemSenha, 'A senha precisa ter pelo menos 6 caracteres.');
            return;
        }

        if (senha !== confirmar) {
            mostrarMensagem(mensagemSenha, 'As senhas digitadas não são iguais.');
            return;
        }

        botao.disabled = true;

        try {

            const { ok, dados } = await enviar('/redefinir-senha', { token, senha });

            if (!ok) {
                mostrarMensagem(mensagemSenha, dados.mensagem || 'Não foi possível salvar a nova senha.');
                botao.disabled = false;
                return;
            }

            mostrarMensagem(mensagemSenha, (dados.mensagem || 'Senha alterada!') + ' Levando você para o login...', true);
            localStorage.removeItem('usuario');
            setTimeout(() => window.location.replace('/index.html'), 2500);

        } catch (erro) {
            mostrarMensagem(mensagemSenha, 'Erro ao conectar com o servidor. Tente novamente.');
            botao.disabled = false;
        }
    });

} else {

    formEmail.hidden = false;

    formEmail.addEventListener('submit', async (e) => {

        e.preventDefault();

        const botao = formEmail.querySelector('.botao-login');
        botao.disabled = true;

        try {

            const { ok, dados } = await enviar('/esqueci-senha', {
                email: document.getElementById('email').value.trim()
            });

            mostrarMensagem(mensagemEmail, dados.mensagem || 'Não foi possível enviar o pedido.', ok);

        } catch (erro) {
            mostrarMensagem(mensagemEmail, 'Erro ao conectar com o servidor. Tente novamente.');
        } finally {
            botao.disabled = false;
        }
    });
}
