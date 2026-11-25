const meses = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

const usuario =
    JSON.parse(
        localStorage.getItem(
            'usuario'
        )
    );

let dataAtual = new Date();
let anoAtual = dataAtual.getFullYear();
let mesAtual = dataAtual.getMonth();

let reservas = {};
let bloqueiosPorDia = {};
let tempoNotificacao;

// Bloqueios de horário (manutenção, feriado...) entram no calendário
async function carregarBloqueios() {

    try {

        const resposta = await fetch('/bloqueios');
        const resultado = await resposta.json();

        if (!resultado.sucesso) {
            return;
        }

        bloqueiosPorDia = {};

        (resultado.bloqueios || []).forEach(function (bloqueio) {

            const [ai, mi, di] = bloqueio.data_inicio.split('-').map(Number);
            const [af, mf, df] = bloqueio.data_fim.split('-').map(Number);

            const dia = new Date(ai, mi - 1, di);
            const fim = new Date(af, mf - 1, df);

            // Limite de segurança: no máximo 1 ano de dias por bloqueio
            for (let i = 0; dia <= fim && i < 370; i++) {

                const chave = dia.getFullYear() + '-' + dia.getMonth() + '-' + dia.getDate();

                if (!bloqueiosPorDia[chave]) {
                    bloqueiosPorDia[chave] = [];
                }

                bloqueiosPorDia[chave].push({
                    motivo: bloqueio.motivo,
                    horario: bloqueio.horario_inicio
                        ? formatarHorario(bloqueio.horario_inicio) + ' - ' + formatarHorario(bloqueio.horario_fim)
                        : 'Dia inteiro'
                });

                dia.setDate(dia.getDate() + 1);
            }
        });

    } catch (erro) {
        console.error('Erro ao carregar bloqueios:', erro);
    }
}

const tituloMes = document.querySelector('.calendar-controls h2');
const grid = document.querySelector('.calendar-grid');
const btnAnterior = document.querySelector('.calendar-controls button:first-child');
const btnProximo = document.querySelector('.calendar-controls button:last-child');

function mostrarNotificacao(
    mensagem,
    tipo
) {

    clearTimeout(
        tempoNotificacao
    );

    let notificacao =
        document.getElementById(
            'notificacaoCalendario'
        );

    if (!notificacao) {

        notificacao =
            document.createElement(
                'div'
            );

        notificacao.id =
            'notificacaoCalendario';

        document.body.appendChild(
            notificacao
        );
    }

    notificacao.textContent =
        mensagem;

    notificacao.className =
        'notificacao-calendario ' +
        tipo;

    requestAnimationFrame(
        function () {

            notificacao.classList.add(
                'ativa'
            );
        }
    );

    tempoNotificacao =
        setTimeout(
            function () {

                notificacao.classList.remove(
                    'ativa'
                );
            },
            4000
        );
}

async function carregarReservas() {

    gerarCalendario(
        anoAtual,
        mesAtual
    );

    try {

        await carregarBloqueios();

        const resposta =
            await fetch(
                '/reservas?filtro=calendario'
            );

        const resultado =
            await resposta.json();

        if (!resultado.sucesso) {

            console.error(
                resultado.mensagem
            );

            mostrarNotificacao(
                'Não foi possível carregar as reservas.',
                'erro'
            );

            return;
        }

        reservas = {};

        resultado.reservas.forEach(
            function (reserva) {

                const partes =
                    reserva.data_reserva.split('-');

                const chave =
                    partes[0] +
                    '-' +
                    (Number(partes[1]) - 1) +
                    '-' +
                    Number(partes[2]);

                if (!reservas[chave]) {

                    reservas[chave] =
                        [];
                }

                reservas[chave].push({
                    id:
                        reserva.id_reserva,

                    esporte:
                        reserva.modalidade,

                    horario:
                        formatarHorario(
                            reserva.horario_inicio
                        ) +
                        ' - ' +
                        formatarHorario(
                            reserva.horario_fim
                        ),

                    usuario:
                        reserva.usuario
                            ? reserva.usuario.nome
                            : 'Usuário',

                    tipo:
                        reserva.tipo_reserva,

                    status:
                        reserva.status
                });
            }
        );

        gerarCalendario(
            anoAtual,
            mesAtual
        );

    } catch (erro) {

        console.error(
            'Erro ao carregar reservas:',
            erro
        );

        mostrarNotificacao(
            'Erro ao carregar as reservas.',
            'erro'
        );
    }
}

function formatarHorario(horario) {

    if (!horario) {

        return '';
    }

    const partes =
        String(horario).split(':');

    return (
        partes[0] +
        ':' +
        partes[1]
    );
}

function formatarDataParaAgenda(
    ano,
    mes,
    dia
) {

    return (
        String(ano) +
        '-' +
        String(
            mes + 1
        ).padStart(
            2,
            '0'
        ) +
        '-' +
        String(
            dia
        ).padStart(
            2,
            '0'
        )
    );
}

function obterClasseTipo(tipo) {

    if (tipo === 'AULA') {

        return 'tag-aula';
    }

    if (tipo === 'EVENTO') {

        return 'tag-evento';
    }

    return 'tag-jogo';
}

function gerarCalendario(
    ano,
    mes
) {

    grid.innerHTML =
        '';

    tituloMes.textContent =
        meses[mes] +
        ' ' +
        ano;

    const primeiroDiaSemana =
        new Date(
            ano,
            mes,
            1
        ).getDay();

    const totalDias =
        new Date(
            ano,
            mes + 1,
            0
        ).getDate();

    for (
        let i = 0;
        i < primeiroDiaSemana;
        i++
    ) {

        const vazio =
            document.createElement(
                'div'
            );

        vazio.className =
            'day empty';

        grid.appendChild(
            vazio
        );
    }

    const hoje =
        new Date();

    for (
        let dia = 1;
        dia <= totalDias;
        dia++
    ) {

        const celula =
            document.createElement(
                'div'
            );

        celula.className =
            'day';

        const ehHoje =
            dia === hoje.getDate() &&
            mes === hoje.getMonth() &&
            ano === hoje.getFullYear();

        if (ehHoje) {

            celula.classList.add(
                'hoje'
            );
        }

        const numero =
            document.createElement(
                'strong'
            );

        numero.textContent =
            dia;

        celula.appendChild(
            numero
        );

        const chave =
            ano +
            '-' +
            mes +
            '-' +
            dia;

        const reservasDoDia =
            reservas[chave];

        const bloqueiosDoDia =
            bloqueiosPorDia[chave];

        if (bloqueiosDoDia && bloqueiosDoDia.length > 0) {

            celula.classList.add('dia-bloqueado');

            bloqueiosDoDia.slice(0, 1).forEach(function (bloqueio) {

                const tag = document.createElement('div');
                tag.className = 'reservation reservation-bloqueio';
                tag.textContent = 'Bloqueado • ' + bloqueio.horario;
                tag.title = bloqueio.motivo;

                celula.appendChild(tag);
            });
        }

        if (
            reservasDoDia &&
            reservasDoDia.length > 0
        ) {

            reservasDoDia
                .slice(0, 2)
                .forEach(
                    function (reserva) {

                        const tag =
                            document.createElement(
                                'div'
                            );

                        const classeTipo =
                            obterClasseTipo(
                                reserva.tipo
                            );

                        tag.className =
                            'reservation ' +
                            classeTipo;

                        if (
                            reserva.status ===
                            'PENDENTE'
                        ) {

                            tag.classList.add(
                                'reservation-pendente'
                            );
                        }

                        const texto =
                            document.createElement(
                                'span'
                            );

                        texto.textContent =
                            reserva.esporte +
                            ' • ' +
                            reserva.horario;

                        tag.appendChild(
                            texto
                        );

                        if (
                            reserva.status ===
                            'PENDENTE'
                        ) {

                            const status =
                                document.createElement(
                                    'span'
                                );

                            status.className =
                                'status-pendente';

                            status.textContent =
                                'Pendente';

                            tag.appendChild(
                                status
                            );
                        }

                        celula.appendChild(
                            tag
                        );
                    }
                );

            if (
                reservasDoDia.length > 2
            ) {

                const mais =
                    document.createElement(
                        'div'
                    );

                mais.className =
                    'reservation-mais';

                mais.textContent =
                    '+' +
                    (
                        reservasDoDia.length -
                        2
                    ) +
                    ' mais';

                celula.appendChild(
                    mais
                );
            }
        }

        celula.addEventListener(
            'click',
            function () {

                abrirDetalhes(
                    dia,
                    ano,
                    mes,
                    reservasDoDia
                );
            }
        );

        grid.appendChild(
            celula
        );
    }
}

function abrirDetalhes(
    dia,
    ano,
    mes,
    reservasDoDia
) {

    fecharModais();

    const overlay =
        document.createElement(
            'div'
        );

    overlay.className =
        'modal-overlay';

    const modal =
        document.createElement(
            'div'
        );

    modal.className =
        'modal-detalhes';

    const titulo =
        document.createElement(
            'h3'
        );

    titulo.textContent =
        dia +
        ' de ' +
        meses[mes] +
        ' de ' +
        ano;

    modal.appendChild(
        titulo
    );

    const bloqueiosDoDia =
        bloqueiosPorDia[ano + '-' + mes + '-' + dia] || [];

    bloqueiosDoDia.forEach(function (bloqueio) {

        const aviso = document.createElement('div');
        aviso.className = 'aviso-bloqueio';
        aviso.textContent =
            'Quadra bloqueada (' + bloqueio.horario + '): ' + bloqueio.motivo;

        modal.appendChild(aviso);
    });

    if (
        reservasDoDia &&
        reservasDoDia.length > 0
    ) {

        reservasDoDia.forEach(
            function (reserva) {

                const item =
                    document.createElement(
                        'div'
                    );

                const classeTipo =
                    obterClasseTipo(
                        reserva.tipo
                    );

                item.className =
                    'reservation-item ' +
                    classeTipo;

                if (
                    reserva.status ===
                    'PENDENTE'
                ) {

                    item.classList.add(
                        'reservation-item-pendente'
                    );
                }

                const nome =
                    document.createElement(
                        'strong'
                    );

                nome.className =
                    'reservation-usuario';

                nome.textContent =
                    reserva.usuario;

                item.appendChild(
                    nome
                );

                item.appendChild(
                    document.createElement(
                        'br'
                    )
                );

                const esporte =
                    document.createElement(
                        'strong'
                    );

                esporte.textContent =
                    reserva.esporte;

                item.appendChild(
                    esporte
                );

                const tipo =
                    document.createElement(
                        'span'
                    );

                tipo.className =
                    'tipo-label';

                tipo.textContent =
                    ' ' +
                    reserva.tipo;

                item.appendChild(
                    tipo
                );

                item.appendChild(
                    document.createElement(
                        'br'
                    )
                );

                const horario =
                    document.createElement(
                        'span'
                    );

                horario.textContent =
                    reserva.horario;

                item.appendChild(
                    horario
                );

                if (
                    reserva.status ===
                    'PENDENTE'
                ) {

                    const status =
                        document.createElement(
                            'div'
                        );

                    status.className =
                        'status-pendente-modal';

                    status.textContent =
                        'Aguardando aprovação';

                    item.appendChild(
                        status
                    );

                    if (
                        usuario &&
                        usuario.tipo_usuario ===
                        'ADMINISTRADOR'
                    ) {

                        const acoes =
                            document.createElement(
                                'div'
                            );

                        acoes.className =
                            'acoes-reserva-calendario';

                        const btnAprovar =
                            document.createElement(
                                'button'
                            );

                        btnAprovar.className =
                            'btn-aprovar-calendario';

                        btnAprovar.textContent =
                            'Aprovar';

                        btnAprovar.addEventListener(
                            'click',
                            function (evento) {

                                evento.stopPropagation();

                                abrirConfirmacao({
                                    titulo:
                                        'Aprovar reserva?',

                                    mensagem:
                                        'Esta reserva será marcada como aprovada.',

                                    textoBotao:
                                        'Aprovar',

                                    tipo:
                                        'aprovar',

                                    aoConfirmar:
                                        async function () {

                                            return await atualizarStatus(
                                                reserva.id,
                                                'APROVADA'
                                            );
                                        }
                                });
                            }
                        );

                        const btnCancelar =
                            document.createElement(
                                'button'
                            );

                        btnCancelar.className =
                            'btn-cancelar-calendario';

                        btnCancelar.textContent =
                            'Cancelar';

                        btnCancelar.addEventListener(
                            'click',
                            function (evento) {

                                evento.stopPropagation();

                                abrirConfirmacao({
                                    titulo:
                                        'Cancelar reserva?',

                                    mensagem:
                                        'Esta reserva será marcada como cancelada.',

                                    textoBotao:
                                        'Cancelar reserva',

                                    tipo:
                                        'cancelar',

                                    aoConfirmar:
                                        async function () {

                                            return await atualizarStatus(
                                                reserva.id,
                                                'CANCELADA'
                                            );
                                        }
                                });
                            }
                        );

                        acoes.appendChild(
                            btnAprovar
                        );

                        acoes.appendChild(
                            btnCancelar
                        );

                        item.appendChild(
                            acoes
                        );
                    }
                }

                modal.appendChild(
                    item
                );
            }
        );

    } else {

        const vazio =
            document.createElement(
                'p'
            );

        vazio.className =
            'sem-reservas';

        vazio.textContent =
            'Nenhuma reserva nesse dia.';

        modal.appendChild(
            vazio
        );
    }

    const dataSelecionada =
        formatarDataParaAgenda(
            ano,
            mes,
            dia
        );

    const hoje =
        new Date();

    hoje.setHours(
        0,
        0,
        0,
        0
    );

    const dataDoDia =
        new Date(
            ano,
            mes,
            dia
        );

    if (
        dataDoDia >=
        hoje
    ) {

        const btnCriarReserva =
            document.createElement(
                'button'
            );

        btnCriarReserva.className =
            'btn-criar-reserva';

        btnCriarReserva.textContent =
            '+ Criar reserva';

        btnCriarReserva.addEventListener(
            'click',
            function () {

                sessionStorage.setItem(
                    'data_reserva_calendario',
                    dataSelecionada
                );

                window.location.href =
                    '../AGENDA/agenda.html';
            }
        );

        modal.appendChild(
            btnCriarReserva
        );
    }

    const btnFechar =
        document.createElement(
            'button'
        );

    btnFechar.className =
        'btn-fechar-modal';

    btnFechar.textContent =
        'Fechar';

    btnFechar.addEventListener(
        'click',
        function () {

            overlay.remove();
        }
    );

    modal.appendChild(
        btnFechar
    );

    overlay.appendChild(
        modal
    );

    overlay.addEventListener(
        'click',
        function (evento) {

            if (
                evento.target ===
                overlay
            ) {

                overlay.remove();
            }
        }
    );

    document.body.appendChild(
        overlay
    );
}

function abrirConfirmacao(
    configuracao
) {

    fecharModais();

    const overlay =
        document.createElement(
            'div'
        );

    overlay.className =
        'modal-overlay';

    const modal =
        document.createElement(
            'div'
        );

    modal.className =
        'modal-confirmacao-calendario';

    if (
        configuracao.tipo ===
        'aprovar'
    ) {

        modal.classList.add(
            'aprovar'
        );
    }

    const icone =
        document.createElement(
            'div'
        );

    icone.className =
        'modal-confirmacao-icone';

    icone.textContent =
        configuracao.tipo ===
        'aprovar'
            ? '✓'
            : '!';

    const titulo =
        document.createElement(
            'h3'
        );

    titulo.textContent =
        configuracao.titulo;

    const mensagem =
        document.createElement(
            'p'
        );

    mensagem.textContent =
        configuracao.mensagem;

    const acoes =
        document.createElement(
            'div'
        );

    acoes.className =
        'modal-confirmacao-acoes';

    const btnVoltar =
        document.createElement(
            'button'
        );

    btnVoltar.className =
        'btn-modal-voltar';

    btnVoltar.textContent =
        'Voltar';

    btnVoltar.addEventListener(
        'click',
        function () {

            overlay.remove();
        }
    );

    const btnConfirmar =
        document.createElement(
            'button'
        );

    btnConfirmar.className =
        'btn-modal-confirmar';

    btnConfirmar.textContent =
        configuracao.textoBotao;

    btnConfirmar.addEventListener(
        'click',
        async function () {

            btnConfirmar.disabled =
                true;

            btnVoltar.disabled =
                true;

            btnConfirmar.textContent =
                'Aguarde...';

            const sucesso =
                await configuracao.aoConfirmar();

            if (
                document.body.contains(
                    overlay
                )
            ) {

                overlay.remove();
            }

            if (!sucesso) {

                btnConfirmar.disabled =
                    false;

                btnVoltar.disabled =
                    false;
            }
        }
    );

    acoes.appendChild(
        btnVoltar
    );

    acoes.appendChild(
        btnConfirmar
    );

    modal.appendChild(
        icone
    );

    modal.appendChild(
        titulo
    );

    modal.appendChild(
        mensagem
    );

    modal.appendChild(
        acoes
    );

    overlay.appendChild(
        modal
    );

    overlay.addEventListener(
        'click',
        function (evento) {

            if (
                evento.target ===
                overlay
            ) {

                overlay.remove();
            }
        }
    );

    document.body.appendChild(
        overlay
    );
}

async function atualizarStatus(
    idReserva,
    novoStatus
) {

    if (!usuario) {

        mostrarNotificacao(
            'Usuário não identificado.',
            'erro'
        );

        return false;
    }

    try {

        const resposta =
            await fetch(
                '/reservas/' +
                idReserva,
                {
                    method:
                        'PATCH',

                    headers: {
                        'Content-Type':
                            'application/json'
                    },

                    body:
                        JSON.stringify({
                            novoStatus:
                                novoStatus,

                            id_usuario_acao:
                                usuario.id_usuario
                        })
                }
            );

        const resultado =
            await resposta.json();

        if (!resultado.sucesso) {

            mostrarNotificacao(
                resultado.mensagem ||
                'Não foi possível atualizar a reserva.',
                'erro'
            );

            return false;
        }

        if (
            novoStatus ===
            'APROVADA'
        ) {

            mostrarNotificacao(
                'Reserva aprovada com sucesso!',
                'sucesso'
            );

        } else {

            mostrarNotificacao(
                'Reserva cancelada com sucesso!',
                'sucesso'
            );
        }

        await carregarReservas();

        return true;

    } catch (erro) {

        console.error(
            erro
        );

        mostrarNotificacao(
            'Erro ao atualizar a reserva.',
            'erro'
        );

        return false;
    }
}

function fecharModais() {

    document
        .querySelectorAll(
            '.modal-overlay'
        )
        .forEach(
            function (modal) {

                modal.remove();
            }
        );
}

document.addEventListener(
    'keydown',
    function (evento) {

        if (
            evento.key ===
            'Escape'
        ) {

            fecharModais();
        }
    }
);

btnAnterior.addEventListener(
    'click',
    function () {

        mesAtual--;

        if (mesAtual < 0) {

            mesAtual = 11;
            anoAtual--;
        }

        gerarCalendario(
            anoAtual,
            mesAtual
        );
    }
);

btnProximo.addEventListener(
    'click',
    function () {

        mesAtual++;

        if (mesAtual > 11) {

            mesAtual = 0;
            anoAtual++;
        }

        gerarCalendario(
            anoAtual,
            mesAtual
        );
    }
);

carregarReservas();