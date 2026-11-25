const usuario = JSON.parse(
    localStorage.getItem('usuario')
)

if (!usuario) {
    window.location.replace('../index.html')
}

document.getElementById('boasVindas').textContent =
    'Bem-vindo, ' + usuario.nome + '!'

const btnReclamacoes =
    document.getElementById('btnReclamacoes')

if (usuario.tipo_usuario === 'ADMINISTRADOR') {
    document.getElementById('linkCadastros').style.display = '';
}


if (btnReclamacoes) {
    btnReclamacoes.style.display =
        'inline-block'
}

const btnTema =
    document.getElementById('btnTema')

const iframe =
    document.getElementById('dashFrame')

const btnSair =
    document.getElementById('btnSair')

const modalSair =
    document.getElementById('modalSair')

const btnCancelarSaida =
    document.getElementById('btnCancelarSaida')

const btnConfirmarSaida =
    document.getElementById('btnConfirmarSaida')

const btnNotificacoes =
    document.getElementById('btnNotificacoes')

const contadorNotificacoes =
    document.getElementById('contadorNotificacoes')

const painelNotificacoes =
    document.getElementById('painelNotificacoes')

const listaNotificacoes =
    document.getElementById('listaNotificacoes')

let notificacoes = []

function formatarDataNotificacao(data) {

    if (!data) {
        return ''
    }

    const dataNotificacao =
        new Date(data)

    if (
        Number.isNaN(
            dataNotificacao.getTime()
        )
    ) {
        return ''
    }

    return dataNotificacao.toLocaleString(
        'pt-BR',
        {
            timeZone:
                'America/Sao_Paulo',

            day:
                '2-digit',

            month:
                '2-digit',

            year:
                'numeric',

            hour:
                '2-digit',

            minute:
                '2-digit'
        }
    )
}

function atualizarContadorNotificacoes() {

    const quantidade =
        notificacoes.filter(
            function (notificacao) {
                return !notificacao.lida
            }
        ).length

    contadorNotificacoes.textContent =
        quantidade > 99
            ? '99+'
            : String(quantidade)

    contadorNotificacoes.classList.toggle(
        'visivel',
        quantidade > 0
    )
}

function criarEstadoVazio() {

    const vazio =
        document.createElement('div')

    vazio.className =
        'notificacoes-vazio'

    const icone =
        document.createElement('i')

    icone.className =
        'fa-regular fa-bell'

    const titulo =
        document.createElement('strong')

    titulo.textContent =
        'Nenhuma notificação'

    const texto =
        document.createElement('span')

    texto.textContent =
        'Quando houver um aviso, ele aparecerá aqui.'

    vazio.appendChild(icone)
    vazio.appendChild(titulo)
    vazio.appendChild(texto)

    return vazio
}

function criarItemNotificacao(
    notificacao
) {

    const item =
        document.createElement('button')

    item.type =
        'button'

    item.className =
        'item-notificacao'

    if (!notificacao.lida) {
        item.classList.add('nao-lida')
    }

    const topo =
        document.createElement('div')

    topo.className =
        'notificacao-topo'

    const tipo =
        document.createElement('span')

    tipo.className =
        'notificacao-tipo'

    if (
        notificacao.tipo ===
        'RESERVA_CANCELADA'
    ) {
        tipo.textContent =
            'Reserva cancelada'
    } else if (
        notificacao.tipo ===
        'FEEDBACK_PROBLEMA'
    ) {
        tipo.textContent =
            'Avaliação com problema'
    } else {
        tipo.textContent =
            'Aviso'
    }

    topo.appendChild(tipo)

    if (!notificacao.lida) {

        const nova =
            document.createElement('span')

        nova.className =
            'notificacao-nova'

        nova.textContent =
            'Nova'

        topo.appendChild(nova)
    }

    const mensagem =
        document.createElement('p')

    mensagem.textContent =
        notificacao.mensagem

    const data =
        document.createElement('span')

    data.className =
        'notificacao-data'

    data.textContent =
        formatarDataNotificacao(
            notificacao.data_envio
        )

    item.appendChild(topo)
    item.appendChild(mensagem)
    item.appendChild(data)

    item.addEventListener(
        'click',
        async function () {

            if (notificacao.lida) {
                return
            }

            await marcarNotificacaoComoLida(
                notificacao
            )
        }
    )

    return item
}

function renderizarNotificacoes() {

    listaNotificacoes.innerHTML =
        ''

    if (
        notificacoes.length === 0
    ) {

        listaNotificacoes.appendChild(
            criarEstadoVazio()
        )

        atualizarContadorNotificacoes()

        return
    }

    notificacoes.forEach(
        function (notificacao) {

            listaNotificacoes.appendChild(
                criarItemNotificacao(
                    notificacao
                )
            )
        }
    )

    atualizarContadorNotificacoes()
}

async function carregarNotificacoes() {

    try {

        const resposta =
            await fetch(
                '/notificacoes?id_usuario=' +
                encodeURIComponent(
                    usuario.id_usuario
                )
            )

        const dados =
            await resposta.json()

        if (
            !resposta.ok ||
            !dados.sucesso
        ) {
            throw new Error(
                dados.mensagem ||
                'Erro ao carregar notificações.'
            )
        }

        notificacoes =
            dados.notificacoes || []

        renderizarNotificacoes()

    } catch (erro) {

        console.error(erro)

        listaNotificacoes.innerHTML =
            ''

        const erroElemento =
            document.createElement('div')

        erroElemento.className =
            'notificacoes-erro'

        erroElemento.textContent =
            'Não foi possível carregar as notificações.'

        listaNotificacoes.appendChild(
            erroElemento
        )

        notificacoes = []

        atualizarContadorNotificacoes()
    }
}

async function marcarNotificacaoComoLida(
    notificacao
) {

    try {

        const resposta =
            await fetch(
                '/notificacoes/' +
                notificacao.id_notificacao,
                {
                    method:
                        'PATCH',

                    headers: {
                        'Content-Type':
                            'application/json'
                    },

                    body:
                        JSON.stringify({
                            id_usuario:
                                usuario.id_usuario
                        })
                }
            )

        const dados =
            await resposta.json()

        if (
            !resposta.ok ||
            !dados.sucesso
        ) {
            throw new Error(
                dados.mensagem ||
                'Erro ao atualizar notificação.'
            )
        }

        notificacao.lida =
            true

        renderizarNotificacoes()

    } catch (erro) {

        console.error(erro)
    }
}

function abrirPainelNotificacoes() {

    painelNotificacoes.classList.add(
        'ativo'
    )

    painelNotificacoes.setAttribute(
        'aria-hidden',
        'false'
    )

    btnNotificacoes.setAttribute(
        'aria-expanded',
        'true'
    )
}

function fecharPainelNotificacoes() {

    painelNotificacoes.classList.remove(
        'ativo'
    )

    painelNotificacoes.setAttribute(
        'aria-hidden',
        'true'
    )

    btnNotificacoes.setAttribute(
        'aria-expanded',
        'false'
    )
}

(function () {
    const isDark =
        localStorage.getItem('tema') === 'true'

    document.documentElement.classList.toggle(
        'dark-mode',
        isDark
    )

    const icone =
        btnTema?.querySelector('i')

    if (icone) {
        icone.className = isDark
            ? 'fa-solid fa-sun'
            : 'fa-solid fa-moon'
    }
})()

function aplicarTemaIframe(isDark) {
    try {
        const iframeDoc =
            iframe.contentDocument ||
            iframe.contentWindow.document

        iframeDoc.documentElement.classList.toggle(
            'dark-mode',
            isDark
        )

    } catch (e) {
        console.log(
            'Iframe ainda não carregado'
        )
    }
}

btnTema.addEventListener(
    'click',
    function () {

        const html =
            document.documentElement

        const isDark =
            !html.classList.contains(
                'dark-mode'
            )

        html.classList.toggle(
            'dark-mode',
            isDark
        )

        localStorage.setItem(
            'tema',
            isDark ? 'true' : 'false'
        )

        const icone =
            btnTema.querySelector('i')

        icone.className = isDark
            ? 'fa-solid fa-sun'
            : 'fa-solid fa-moon'

        aplicarTemaIframe(isDark)
    }
)

iframe.addEventListener(
    'load',
    function () {

        const isDark =
            localStorage.getItem(
                'tema'
            ) === 'true'

        aplicarTemaIframe(isDark)
    }
)

btnNotificacoes.addEventListener(
    'click',
    function (evento) {

        evento.stopPropagation()

        const estaAberto =
            painelNotificacoes.classList.contains(
                'ativo'
            )

        if (estaAberto) {
            fecharPainelNotificacoes()
        } else {
            abrirPainelNotificacoes()
        }
    }
)

painelNotificacoes.addEventListener(
    'click',
    function (evento) {
        evento.stopPropagation()
    }
)

document.addEventListener(
    'click',
    function () {

        if (
            painelNotificacoes.classList.contains(
                'ativo'
            )
        ) {
            fecharPainelNotificacoes()
        }
    }
)

function abrirModalSaida() {

    fecharPainelNotificacoes()

    modalSair.classList.add('ativo')

    modalSair.setAttribute(
        'aria-hidden',
        'false'
    )
}

function fecharModalSaida() {

    modalSair.classList.remove('ativo')

    modalSair.setAttribute(
        'aria-hidden',
        'true'
    )
}

btnSair.addEventListener(
    'click',
    function () {
        abrirModalSaida()
    }
)

btnCancelarSaida.addEventListener(
    'click',
    function () {
        fecharModalSaida()
    }
)

btnConfirmarSaida.addEventListener(
    'click',
    async function () {

        try {
            const resposta = await fetch('/logout', {
                method: 'POST'
            })

            if (!resposta.ok) {
                alert('Não foi possível encerrar a sessão. Tente novamente.')
                return
            }

            localStorage.clear()

            window.location.replace(
                '../index.html'
            )

        } catch (erro) {
            alert('Erro ao encerrar a sessão. Tente novamente.')
        }
    }
)

modalSair.addEventListener(
    'click',
    function (evento) {

        if (
            evento.target === modalSair
        ) {
            fecharModalSaida()
        }
    }
)

document.addEventListener(
    'keydown',
    function (evento) {

        if (
            evento.key === 'Escape'
        ) {

            if (
                painelNotificacoes.classList.contains(
                    'ativo'
                )
            ) {
                fecharPainelNotificacoes()
            }

            if (
                modalSair.classList.contains(
                    'ativo'
                )
            ) {
                fecharModalSaida()
            }
        }
    }
)

carregarNotificacoes()

setInterval(
    carregarNotificacoes,
    30000
)