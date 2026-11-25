let usuario = null

try {
    usuario = JSON.parse(
        localStorage.getItem('usuario')
    )
} catch (erro) {
    usuario = null
}

if (!usuario) {
    localStorage.removeItem('usuario')
    window.location.replace('../index.html')
    throw new Error('Sem usuário salvo.')
}

// O localStorage serve só para desenhar a tela rápido. Quem diz quem
// está logado (e se é administrador) é o servidor, pelo cookie de sessão.
async function validarSessaoNoServidor() {

    try {

        const resposta =
            await fetch('/minha-sessao', { cache: 'no-store' })

        if (resposta.status === 401) {
            localStorage.removeItem('usuario')
            window.location.replace('../index.html')
            return
        }

        const dados =
            await resposta.json()

        if (!dados.sucesso || !dados.usuario) {
            return
        }

        const doServidor =
            dados.usuario

        const mudou =
            Number(doServidor.id_usuario) !== Number(usuario.id_usuario) ||
            doServidor.tipo_usuario !== usuario.tipo_usuario ||
            doServidor.nome !== usuario.nome

        if (mudou) {

            const idMudou =
                Number(doServidor.id_usuario) !== Number(usuario.id_usuario)

            localStorage.setItem(
                'usuario',
                JSON.stringify(
                    idMudou
                        ? doServidor
                        : { ...usuario, ...doServidor }
                )
            )

            window.location.reload()
        }

    } catch (erro) {
        // Sem conexão: as rotas do servidor continuam exigindo a sessão
        console.error('Não foi possível validar a sessão:', erro)
    }
}

validarSessaoNoServidor()

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

const filtrosNotificacoes =
    document.getElementById('filtrosNotificacoes')

const acoesNotificacoes =
    document.getElementById('acoesNotificacoes')

// Seleção de várias notificações para marcar como lidas
let modoSelecao = false

const selecionadas = new Set()

let notificacoes = []

const ehAdministrador =
    usuario.tipo_usuario === 'ADMINISTRADOR'

// Nome que aparece em cada notificação, conforme o tipo salvo no banco
const ROTULOS_TIPO_NOTIFICACAO = {
    RESERVA_PENDENTE: 'Reserva para aprovar',
    RESERVA_APROVADA: 'Reserva aprovada',
    RESERVA_CANCELADA: 'Reserva cancelada',
    RECLAMACAO_NOVA: 'Nova reclamação',
    CADASTRO_PENDENTE: 'Cadastro para aprovar',
    FEEDBACK_PROBLEMA: 'Avaliação com problema'
}

// Abas do administrador. Cada tipo de notificação cai em uma aba;
// tipos que não estão em nenhuma lista vão para "Outros".
const CATEGORIAS_ADMIN = [
    { id: 'todas', rotulo: 'Todas', tipos: null },
    { id: 'reservas', rotulo: 'Reservas para aprovar', tipos: ['RESERVA_PENDENTE'] },
    { id: 'reclamacoes', rotulo: 'Reclamações', tipos: ['RECLAMACAO_NOVA'] },
    { id: 'cadastros', rotulo: 'Cadastros', tipos: ['CADASTRO_PENDENTE'] },
    { id: 'avaliacoes', rotulo: 'Avaliações', tipos: ['FEEDBACK_PROBLEMA'] },
    { id: 'outros', rotulo: 'Outros', tipos: [] }
]

const TIPOS_COM_ABA_PROPRIA =
    CATEGORIAS_ADMIN.flatMap(
        function (categoria) {
            return categoria.tipos || []
        }
    )

let categoriaSelecionada = 'todas'

// Para onde o administrador vai ao clicar em cada tipo de notificação
const DESTINOS_ADMIN = {
    RESERVA_PENDENTE: '../RESERVAS/reservas.html?filtro=pendentes',
    RECLAMACAO_NOVA: '../RECLAMACOES/reclamacoes.html',
    CADASTRO_PENDENTE: '../CADASTROS/cadastros.html',
    FEEDBACK_PROBLEMA: '../HISTORICO/historico.html'
}

function obterDestinoNotificacao(notificacao) {

    if (!ehAdministrador) {
        return null
    }

    return DESTINOS_ADMIN[notificacao.tipo] || null
}

function abrirNoDashboard(destino) {

    fecharPainelNotificacoes()

    iframe.src = destino
}

function notificacaoPertenceACategoria(
    notificacao,
    categoria
) {

    if (categoria.id === 'todas') {
        return true
    }

    if (categoria.id === 'outros') {
        return !TIPOS_COM_ABA_PROPRIA.includes(
            notificacao.tipo
        )
    }

    return categoria.tipos.includes(
        notificacao.tipo
    )
}

function obterCategoriaSelecionada() {

    return (
        CATEGORIAS_ADMIN.find(
            function (categoria) {
                return categoria.id === categoriaSelecionada
            }
        ) || CATEGORIAS_ADMIN[0]
    )
}

function renderizarFiltrosNotificacoes() {

    if (!ehAdministrador) {
        filtrosNotificacoes.hidden = true
        return
    }

    filtrosNotificacoes.hidden = false
    filtrosNotificacoes.innerHTML = ''

    CATEGORIAS_ADMIN.forEach(
        function (categoria) {

            const daCategoria =
                notificacoes.filter(
                    function (notificacao) {
                        return notificacaoPertenceACategoria(
                            notificacao,
                            categoria
                        )
                    }
                )

            // "Outros" só aparece quando há algo nela
            if (
                categoria.id === 'outros' &&
                daCategoria.length === 0
            ) {
                return
            }

            const naoLidas =
                daCategoria.filter(
                    function (notificacao) {
                        return !notificacao.lida
                    }
                ).length

            const botaoFiltro =
                document.createElement('button')

            botaoFiltro.type = 'button'
            botaoFiltro.className = 'filtro-notificacao'
            botaoFiltro.setAttribute('role', 'tab')

            const ativo =
                categoria.id === categoriaSelecionada

            botaoFiltro.classList.toggle('ativo', ativo)
            botaoFiltro.setAttribute(
                'aria-selected',
                ativo ? 'true' : 'false'
            )

            const texto =
                document.createElement('span')

            texto.textContent = categoria.rotulo

            botaoFiltro.appendChild(texto)

            if (naoLidas > 0) {

                const contador =
                    document.createElement('span')

                contador.className = 'filtro-contador'
                contador.textContent =
                    naoLidas > 99 ? '99+' : String(naoLidas)

                botaoFiltro.appendChild(contador)
            }

            botaoFiltro.addEventListener(
                'click',
                function () {
                    categoriaSelecionada = categoria.id
                    renderizarNotificacoes()
                }
            )

            filtrosNotificacoes.appendChild(botaoFiltro)
        }
    )
}

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

function criarEstadoVazio(textoTitulo, textoDescricao) {

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
        textoTitulo ||
        'Nenhuma notificação'

    const texto =
        document.createElement('span')

    texto.textContent =
        textoDescricao ||
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

    const destino =
        obterDestinoNotificacao(notificacao)

    if (destino && !modoSelecao) {
        item.classList.add('com-destino')
        item.title = 'Abrir'
    }

    const estaSelecionada =
        selecionadas.has(notificacao.id_notificacao)

    if (modoSelecao) {

        item.classList.add('selecionavel')
        item.classList.toggle('selecionada', estaSelecionada)
        item.setAttribute('aria-pressed', estaSelecionada ? 'true' : 'false')

        const marcador =
            document.createElement('span')

        marcador.className = 'marcador-selecao'
        marcador.setAttribute('aria-hidden', 'true')
        marcador.innerHTML = estaSelecionada ? '<i class="fa-solid fa-check"></i>' : ''

        item.appendChild(marcador)
    }

    const topo =
        document.createElement('div')

    topo.className =
        'notificacao-topo'

    const tipo =
        document.createElement('span')

    tipo.className =
        'notificacao-tipo'

    tipo.textContent =
        ROTULOS_TIPO_NOTIFICACAO[
            notificacao.tipo
        ] || 'Aviso'

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

            if (modoSelecao) {

                if (selecionadas.has(notificacao.id_notificacao)) {
                    selecionadas.delete(notificacao.id_notificacao)
                } else {
                    selecionadas.add(notificacao.id_notificacao)
                }

                renderizarNotificacoes()

                return
            }

            if (destino) {
                abrirNoDashboard(destino)
            }

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

function obterNotificacoesVisiveis() {

    if (!ehAdministrador) {
        return notificacoes
    }

    const categoria =
        obterCategoriaSelecionada()

    return notificacoes.filter(
        function (notificacao) {
            return notificacaoPertenceACategoria(
                notificacao,
                categoria
            )
        }
    )
}

function criarBotaoAcao(texto, aoClicar, opcoes) {

    const botao =
        document.createElement('button')

    botao.type = 'button'
    botao.className = 'acao-notificacao' + (opcoes && opcoes.principal ? ' principal' : '')
    botao.textContent = texto
    botao.disabled = Boolean(opcoes && opcoes.desativado)

    botao.addEventListener('click', aoClicar)

    return botao
}

function sairDoModoSelecao() {

    modoSelecao = false
    selecionadas.clear()

    renderizarNotificacoes()
}

function renderizarAcoesNotificacoes(visiveis) {

    acoesNotificacoes.innerHTML = ''

    // Tira da seleção o que não está mais na tela (aba trocada ou lista recarregada)
    const idsVisiveis =
        new Set(visiveis.map((n) => n.id_notificacao))

    Array.from(selecionadas).forEach(
        function (id) {
            if (!idsVisiveis.has(id)) {
                selecionadas.delete(id)
            }
        }
    )

    const naoLidasVisiveis =
        visiveis.filter((n) => !n.lida)

    if (visiveis.length === 0) {
        acoesNotificacoes.hidden = true
        return
    }

    acoesNotificacoes.hidden = false

    if (!modoSelecao) {

        acoesNotificacoes.appendChild(
            criarBotaoAcao(
                'Selecionar',
                function () {
                    modoSelecao = true
                    renderizarNotificacoes()
                }
            )
        )

        acoesNotificacoes.appendChild(
            criarBotaoAcao(
                'Marcar todas como lidas',
                function () {
                    marcarVariasComoLidas(
                        naoLidasVisiveis.map((n) => n.id_notificacao)
                    )
                },
                { desativado: naoLidasVisiveis.length === 0 }
            )
        )

        return
    }

    const todasSelecionadas =
        selecionadas.size === visiveis.length

    acoesNotificacoes.appendChild(
        criarBotaoAcao(
            todasSelecionadas ? 'Desmarcar todas' : 'Selecionar todas',
            function () {

                if (todasSelecionadas) {
                    selecionadas.clear()
                } else {
                    visiveis.forEach((n) => selecionadas.add(n.id_notificacao))
                }

                renderizarNotificacoes()
            }
        )
    )

    acoesNotificacoes.appendChild(
        criarBotaoAcao('Cancelar', sairDoModoSelecao)
    )

    const idsParaMarcar =
        visiveis
            .filter((n) => selecionadas.has(n.id_notificacao) && !n.lida)
            .map((n) => n.id_notificacao)

    acoesNotificacoes.appendChild(
        criarBotaoAcao(
            'Marcar como lidas' + (selecionadas.size > 0 ? ' (' + selecionadas.size + ')' : ''),
            async function () {

                if (idsParaMarcar.length > 0) {
                    const ok = await marcarVariasComoLidas(idsParaMarcar)
                    if (!ok) return
                }

                sairDoModoSelecao()
            },
            { principal: true, desativado: selecionadas.size === 0 }
        )
    )
}

async function marcarVariasComoLidas(ids) {

    if (!ids || ids.length === 0) {
        return true
    }

    try {

        const resposta =
            await fetch(
                '/notificacoes/lidas',
                {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ ids: ids })
                }
            )

        const dados =
            await resposta.json()

        if (!resposta.ok || !dados.sucesso) {
            throw new Error(dados.mensagem || 'Erro ao atualizar notificações.')
        }

        const marcadas =
            new Set(dados.ids || [])

        notificacoes.forEach(
            function (notificacao) {
                if (marcadas.has(notificacao.id_notificacao)) {
                    notificacao.lida = true
                }
            }
        )

        renderizarNotificacoes()

        return true

    } catch (erro) {

        console.error(erro)

        alert('Não foi possível marcar as notificações como lidas. Tente novamente.')

        return false
    }
}

function renderizarNotificacoes() {

    listaNotificacoes.innerHTML =
        ''

    renderizarFiltrosNotificacoes()

    const categoria =
        obterCategoriaSelecionada()

    const visiveis =
        obterNotificacoesVisiveis()

    renderizarAcoesNotificacoes(visiveis)

    listaNotificacoes.classList.toggle('modo-selecao', modoSelecao)

    if (
        visiveis.length === 0
    ) {

        listaNotificacoes.appendChild(
            ehAdministrador && categoria.id !== 'todas'
                ? criarEstadoVazio(
                    'Nada em "' + categoria.rotulo + '"',
                    'Os avisos desse tipo aparecerão aqui.'
                )
                : criarEstadoVazio()
        )

        atualizarContadorNotificacoes()

        return
    }

    visiveis.forEach(
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

        acoesNotificacoes.hidden = true

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

    if (modoSelecao) {
        modoSelecao = false
        selecionadas.clear()
        renderizarNotificacoes()
    }

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