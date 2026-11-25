const usuario =
    JSON.parse(localStorage.getItem('usuario'));

if (!usuario) {
    window.location.href = '/index.html';
}

if (usuario.tipo_usuario !== 'ADMINISTRADOR') {
    document.body.innerHTML =
        '<p style="padding:40px;text-align:center;">Acesso restrito a administradores.</p>';
    throw new Error('Acesso negado');
}

if (localStorage.getItem('tema') === 'true') {
    document.documentElement.classList.add('dark-mode');
}

function confirmarModal(texto, textoBotao = 'Confirmar') {
    return new Promise((resolve) => {
        const overlay = document.getElementById('modalConfirmacao');
        const btnOk = document.getElementById('modalConfirmar');
        const btnCancelar = document.getElementById('modalCancelar');

        document.getElementById('modalTexto').textContent = texto;
        btnOk.textContent = textoBotao;

        function fechar(resposta) {
            overlay.classList.remove('ativo');
            resolve(resposta);
        }

        btnOk.onclick = () => fechar(true);
        btnCancelar.onclick = () => fechar(false);
        overlay.onclick = (e) => { if (e.target === overlay) fechar(false); };

        overlay.classList.add('ativo');
    });
}

const listaCadastros =
    document.getElementById('listaCadastros');

async function carregarCadastros() {

    try {

        const resposta = await fetch(
            `/cadastros/pendentes?id_usuario_admin=${usuario.id_usuario}`
        );

        const resultado = await resposta.json();

        if (!resultado.sucesso) {
            listaCadastros.innerHTML = '';
            const aviso = document.createElement('p');
            aviso.textContent = resultado.mensagem || 'Erro ao carregar cadastros.';
            listaCadastros.appendChild(aviso);
            return;
        }

        renderizarCadastros(resultado.cadastros);

    } catch (erro) {
        console.error(erro);
        listaCadastros.innerHTML = '<p>Erro ao carregar cadastros.</p>';
    }

}

function renderizarCadastros(cadastros) {

    listaCadastros.innerHTML = '';

    if (cadastros.length === 0) {
        listaCadastros.innerHTML = '<p>Nenhum cadastro pendente.</p>';
        return;
    }

    cadastros.forEach((cadastro) => {

        const item = document.createElement('div');
        item.className = 'cadastro-item';

        // textContent (e não innerHTML): o nome e o e-mail são digitados por
        // quem se cadastra e nunca podem virar HTML/JavaScript na tela do admin.
        const linhaNome = document.createElement('p');
        const nomeForte = document.createElement('strong');
        nomeForte.textContent = cadastro.nome;
        linhaNome.appendChild(nomeForte);

        const linhaRa = document.createElement('p');
        linhaRa.textContent = 'RA: ' + (cadastro.ra || 'Não informado (professor/servidor)');

        const linhaEmail = document.createElement('p');
        linhaEmail.textContent = 'E-mail: ' + cadastro.email;

        item.appendChild(linhaNome);
        item.appendChild(linhaRa);
        item.appendChild(linhaEmail);

        const selectTipo = document.createElement('select');
        selectTipo.className = 'select-tipo';

        ['ALUNO', 'PROFESSOR', 'ADMINISTRADOR'].forEach((tipo) => {
            const option = document.createElement('option');
            option.value = tipo;
            option.textContent = tipo;
            selectTipo.appendChild(option);
        });

        selectTipo.value = cadastro.ra ? 'ALUNO' : 'PROFESSOR';

        item.appendChild(selectTipo);

        const acoes = document.createElement('div');
        acoes.className = 'acoes-cadastro';

        const btnAprovar = document.createElement('button');
        btnAprovar.className = 'btn-aprovar';
        btnAprovar.textContent = 'Aprovar';
        btnAprovar.addEventListener('click', () =>
            atualizarCadastro(cadastro.id_usuario, 'APROVADO', selectTipo.value));

        const btnRejeitar = document.createElement('button');
        btnRejeitar.className = 'btn-rejeitar';
        btnRejeitar.textContent = 'Rejeitar';
        btnRejeitar.addEventListener('click', async () => {
            const ok = await confirmarModal(
                `Rejeitar o cadastro de ${cadastro.nome}?`,
                'Rejeitar'
            );

            if (ok) {
                atualizarCadastro(cadastro.id_usuario, 'REJEITADO', null);
            }
        });

        acoes.appendChild(btnAprovar);
        acoes.appendChild(btnRejeitar);
        item.appendChild(acoes);

        listaCadastros.appendChild(item);

    });

}

async function atualizarCadastro(idUsuario, novoStatus, tipoUsuario) {

    try {

        const resposta = await fetch(
            `/cadastros/${idUsuario}`,
            {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    novoStatus,
                    tipoUsuario,
                    id_usuario_admin: usuario.id_usuario
                })
            }
        );

        const resultado = await resposta.json();

        if (!resultado.sucesso) {
            alert(resultado.mensagem);
            return;
        }

        carregarCadastros();

    } catch (erro) {
        console.error(erro);
        alert('Erro ao atualizar cadastro.');
    }

}

carregarCadastros();
