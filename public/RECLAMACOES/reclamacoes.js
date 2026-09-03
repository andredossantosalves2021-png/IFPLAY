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

const notificacao =
    document.getElementById('notificacao');

const CHAVE_RASCUNHO =
    'rascunho_reclamacao';

let tempoNotificacao;

const rascunhoSalvo =
    localStorage.getItem(CHAVE_RASCUNHO);

if (rascunhoSalvo) {
    descricaoInput.value =
        rascunhoSalvo;
}

descricaoInput.addEventListener(
    'input',
    () => {
        localStorage.setItem(
            CHAVE_RASCUNHO,
            descricaoInput.value
        );
    }
);

fotoInput.addEventListener(
    'change',
    () => {

        if (fotoInput.files[0]) {

            nomeArquivo.textContent =
                fotoInput.files[0].name;

            previewFoto.style.display =
                'flex';

        } else {

            previewFoto.style.display =
                'none';
        }
    }
);

btnRemoverFoto.addEventListener(
    'click',
    () => {

        fotoInput.value = '';

        previewFoto.style.display =
            'none';
    }
);

function mostrarNotificacao(
    mensagem,
    tipo
) {

    clearTimeout(
        tempoNotificacao
    );

    notificacao.textContent =
        mensagem;

    notificacao.className =
        'notificacao ' + tipo;

    requestAnimationFrame(
        () => {

            notificacao.classList.add(
                'ativa'
            );
        }
    );

    tempoNotificacao =
        setTimeout(
            () => {

                notificacao.classList.remove(
                    'ativa'
                );

            },
            4000
        );
}


async function carregarReclamacoes() {

    try {

        const resposta =
            await fetch(
                'http://localhost:3333/reclamacoes'
            );

        const resultado =
            await resposta.json();

        if (!resultado.sucesso) {

            listaReclamacoes.textContent =
                resultado.mensagem;

            return;
        }

        renderizarReclamacoes(
            resultado.reclamacoes
        );

    } catch (erro) {

        console.error(erro);

        listaReclamacoes.innerHTML =
            '<p>Erro ao carregar reclamações.</p>';
    }
}


function renderizarReclamacoes(
    reclamacoes
) {

    listaReclamacoes.innerHTML = '';

    if (reclamacoes.length === 0) {

        listaReclamacoes.innerHTML =
            '<p>Nenhuma reclamação registrada.</p>';

        return;
    }

    reclamacoes.forEach(
        (reclamacao) => {

            const classeBadge =
                reclamacao.status === 'PENDENTE'
                    ? 'pendente'
                    : reclamacao.status === 'ANALISADA'
                        ? 'analisada'
                        : 'resolvida';

            const classeBorda =
                reclamacao.status === 'PENDENTE'
                    ? ''
                    : reclamacao.status === 'ANALISADA'
                        ? 'borda-analisada'
                        : 'borda-resolvida';

            const nomeUsuario =
                reclamacao.usuario?.nome ??
                'Usuário';

            const item =
                document.createElement(
                    'div'
                );

            item.className =
                'reclamacao-item ' +
                classeBorda;

            const badge =
                document.createElement(
                    'span'
                );

            badge.className =
                'badge ' +
                classeBadge;

            badge.textContent =
                reclamacao.status;

            const dadosUsuario =
                document.createElement(
                    'p'
                );

            const nomeStrong =
                document.createElement(
                    'strong'
                );

            nomeStrong.textContent =
                nomeUsuario;

            dadosUsuario.appendChild(
                nomeStrong
            );

            const dataFormatada =
                new Date(
                    reclamacao.data_envio
                ).toLocaleDateString(
                    'pt-BR'
                );

            dadosUsuario.appendChild(
                document.createTextNode(
                    ' - ' +
                    dataFormatada
                )
            );

            const descricao =
                document.createElement(
                    'p'
                );

            descricao.textContent =
                reclamacao.descricao;

            item.appendChild(
                badge
            );

            item.appendChild(
                dadosUsuario
            );

            item.appendChild(
                descricao
            );

            if (
                reclamacao.imagem_anexo
            ) {

                const imagem =
                    document.createElement(
                        'img'
                    );

                imagem.src =
                    reclamacao.imagem_anexo;

                imagem.alt =
                    'Anexo da reclamação';

                item.appendChild(
                    imagem
                );
            }

            if (
                reclamacao.resposta
            ) {

                const respostaDiv =
                    document.createElement(
                        'div'
                    );

                respostaDiv.className =
                    'resposta-admin';

                const tituloResposta =
                    document.createElement(
                        'strong'
                    );

                tituloResposta.textContent =
                    'Resposta da administração:';

                const textoResposta =
                    document.createElement(
                        'p'
                    );

                textoResposta.textContent =
                    reclamacao.resposta;

                respostaDiv.appendChild(
                    tituloResposta
                );

                respostaDiv.appendChild(
                    textoResposta
                );

                item.appendChild(
                    respostaDiv
                );

            } else if (
                usuario.tipo_usuario ===
                'ADMINISTRADOR'
            ) {

                const formResposta =
                    document.createElement(
                        'div'
                    );

                formResposta.className =
                    'form-resposta';

                const inputResposta =
                    document.createElement(
                        'input'
                    );

                inputResposta.type =
                    'text';

                inputResposta.placeholder =
                    'Escreva uma resposta...';

                const btnResponder =
                    document.createElement(
                        'button'
                    );

                btnResponder.textContent =
                    'Responder';

                btnResponder.addEventListener(
                    'click',
                    () => {

                        responder(
                            reclamacao.id_reclamacao,
                            inputResposta.value
                        );
                    }
                );

                formResposta.appendChild(
                    inputResposta
                );

                formResposta.appendChild(
                    btnResponder
                );

                item.appendChild(
                    formResposta
                );
            }

            listaReclamacoes.appendChild(
                item
            );
        }
    );
}


async function responder(
    idReclamacao,
    textoResposta
) {

    if (!textoResposta.trim()) {

        mostrarNotificacao(
            'Escreva uma resposta antes de enviar.',
            'aviso'
        );

        return;
    }

    try {

        const resposta =
            await fetch(
                'http://localhost:3333/reclamacoes/' +
                idReclamacao,
                {
                    method: 'PATCH',

                    headers: {
                        'Content-Type':
                            'application/json'
                    },

                    body: JSON.stringify({
                        resposta:
                            textoResposta,

                        id_usuario_admin:
                            usuario.id_usuario
                    })
                }
            );

        const resultado =
            await resposta.json();

        if (!resultado.sucesso) {

            mostrarNotificacao(
                resultado.mensagem,
                'erro'
            );

            return;
        }

        mostrarNotificacao(
            'Resposta enviada com sucesso!',
            'sucesso'
        );

        carregarReclamacoes();

    } catch (erro) {

        console.error(erro);

        mostrarNotificacao(
            'Erro ao enviar resposta.',
            'erro'
        );
    }
}


formReclamacao.addEventListener(
    'submit',
    async (e) => {

        e.preventDefault();

        if (
            !descricaoInput.value.trim()
        ) {

            mostrarNotificacao(
                'Descreva sua reclamação antes de enviar.',
                'aviso'
            );

            return;
        }

        const dadosForm =
            new FormData();

        dadosForm.append(
            'descricao',
            descricaoInput.value
        );

        dadosForm.append(
            'id_usuario',
            usuario.id_usuario
        );

        if (
            fotoInput.files[0]
        ) {

            dadosForm.append(
                'foto',
                fotoInput.files[0]
            );
        }

        try {

            const resposta =
                await fetch(
                    'http://localhost:3333/reclamacoes',
                    {
                        method: 'POST',
                        body: dadosForm
                    }
                );

            const resultado =
                await resposta.json();

            if (
                !resultado.sucesso
            ) {

                mostrarNotificacao(
                    resultado.mensagem,
                    'erro'
                );

                return;
            }

            mostrarNotificacao(
                'Reclamação enviada com sucesso!',
                'sucesso'
            );

            localStorage.removeItem(
                CHAVE_RASCUNHO
            );

            formReclamacao.reset();

            previewFoto.style.display =
                'none';

            carregarReclamacoes();

        } catch (erro) {

            console.error(erro);

            mostrarNotificacao(
                'Erro ao enviar reclamação.',
                'erro'
            );
        }
    }
);

carregarReclamacoes();