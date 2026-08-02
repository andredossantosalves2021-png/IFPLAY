const usuario =
    JSON.parse(localStorage.getItem('usuario'));

if (!usuario) {
    window.location.href = '../LOGIN/index.html';
}

if (localStorage.getItem('tema') === 'true') {
    document.documentElement.classList.add('dark-mode');
}

const formReclamacao =
    document.getElementById('formReclamacao');

const descricaoInput =
    document.getElementById('descricao');

const fotoInput =
    document.getElementById('foto');

const listaReclamacoes =
    document.getElementById('listaReclamacoes');

const previewFoto =
    document.getElementById('previewFoto');

const nomeArquivo =
    document.getElementById('nomeArquivo');

const btnRemoverFoto =
    document.getElementById('btnRemoverFoto');

const CHAVE_RASCUNHO = 'rascunho_reclamacao';

const rascunhoSalvo =
    localStorage.getItem(CHAVE_RASCUNHO);

if (rascunhoSalvo) {
    descricaoInput.value = rascunhoSalvo;
}

descricaoInput.addEventListener('input', () => {
    localStorage.setItem(CHAVE_RASCUNHO, descricaoInput.value);
});


fotoInput.addEventListener('change', () => {

    if (fotoInput.files[0]) {
        nomeArquivo.textContent = fotoInput.files[0].name;
        previewFoto.style.display = 'flex';
    } else {
        previewFoto.style.display = 'none';
    }

});

btnRemoverFoto.addEventListener('click', () => {
    fotoInput.value = '';
    previewFoto.style.display = 'none';
});

async function carregarReclamacoes() {

    try {

        const resposta =
            await fetch('http://localhost:3333/reclamacoes');

        const resultado =
            await resposta.json();

        if (!resultado.sucesso) {
            listaReclamacoes.innerHTML = `<p>${resultado.mensagem}</p>`;
            return;
        }

        renderizarReclamacoes(resultado.reclamacoes);

    } catch (erro) {
        console.error(erro);
        listaReclamacoes.innerHTML = '<p>Erro ao carregar reclamações.</p>';
    }

}

function renderizarReclamacoes(reclamacoes) {

    listaReclamacoes.innerHTML = '';

    if (reclamacoes.length === 0) {
        listaReclamacoes.innerHTML = '<p>Nenhuma reclamação registrada.</p>';
        return;
    }

    reclamacoes.forEach((reclamacao) => {

        const classeBadge =
            reclamacao.status === 'PENDENTE' ? 'pendente' :
            reclamacao.status === 'ANALISADA' ? 'analisada' : 'resolvida';

        const classeBorda =
            reclamacao.status === 'PENDENTE' ? '' :
            reclamacao.status === 'ANALISADA' ? 'borda-analisada' : 'borda-resolvida';

        const nomeUsuario =
            reclamacao.usuario?.nome ?? 'Usuário';

        const item = document.createElement('div');
        item.className = `reclamacao-item ${classeBorda}`;

        item.innerHTML = `
            <span class="badge ${classeBadge}">${reclamacao.status}</span>
            <p><strong>${nomeUsuario}</strong> - ${new Date(reclamacao.data_envio).toLocaleDateString('pt-BR')}</p>
            <p>${reclamacao.descricao}</p>
            ${reclamacao.imagem_anexo ? `<img src="${reclamacao.imagem_anexo}" alt="Anexo da reclamação">` : ''}
        `;

        if (reclamacao.resposta) {

            const respostaDiv = document.createElement('div');
            respostaDiv.className = 'resposta-admin';
            respostaDiv.innerHTML = `<strong>Resposta da administração:</strong><p>${reclamacao.resposta}</p>`;
            item.appendChild(respostaDiv);

        } else if (usuario.tipo_usuario === 'ADMINISTRADOR') {

            const formResposta = document.createElement('div');
            formResposta.className = 'form-resposta';

            const inputResposta = document.createElement('input');
            inputResposta.type = 'text';
            inputResposta.placeholder = 'Escreva uma resposta...';

            const btnResponder = document.createElement('button');
            btnResponder.textContent = 'Responder';
            btnResponder.addEventListener('click', () =>
                responder(reclamacao.id_reclamacao, inputResposta.value));

            formResposta.appendChild(inputResposta);
            formResposta.appendChild(btnResponder);
            item.appendChild(formResposta);

        }

        listaReclamacoes.appendChild(item);

    });

}

async function responder(idReclamacao, textoResposta) {

    if (!textoResposta.trim()) {
        alert('Escreva uma resposta antes de enviar.');
        return;
    }

    try {

        const resposta =
            await fetch(`http://localhost:3333/reclamacoes/${idReclamacao}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    resposta: textoResposta,
                    id_usuario_admin: usuario.id_usuario
                })
            });

        const resultado = await resposta.json();

        if (!resultado.sucesso) {
            alert(resultado.mensagem);
            return;
        }

        carregarReclamacoes();

    } catch (erro) {
        console.error(erro);
        alert('Erro ao enviar resposta.');
    }

}

formReclamacao.addEventListener('submit', async (e) => {

    e.preventDefault();

    if (!descricaoInput.value.trim()) {
        alert('Descreva sua reclamação antes de enviar.');
        return;
    }

    const dadosForm = new FormData();
    dadosForm.append('descricao', descricaoInput.value);
    dadosForm.append('id_usuario', usuario.id_usuario);

    if (fotoInput.files[0]) {
        dadosForm.append('foto', fotoInput.files[0]);
    }

    try {

        const resposta =
            await fetch('http://localhost:3333/reclamacoes', {
                method: 'POST',
                body: dadosForm
            });

        const resultado = await resposta.json();

        if (!resultado.sucesso) {
            alert(resultado.mensagem);
            return;
        }

        alert('Reclamação enviada com sucesso!');
        localStorage.removeItem(CHAVE_RASCUNHO);
        formReclamacao.reset();
        previewFoto.style.display = 'none';
        carregarReclamacoes();

    } catch (erro) {
        console.error(erro);
        alert('Erro ao enviar reclamação.');
    }

});


carregarReclamacoes();
