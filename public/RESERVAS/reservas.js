const usuario =
    JSON.parse(
        localStorage.getItem(
            'usuario'
        )
    );

if (!usuario) {

    window.location.href =
        '../LOGIN/index.html';
}

if (
    localStorage.getItem('tema') ===
    'true'
) {

    document.documentElement.classList.add(
        'dark-mode'
    );
}

const listaReservas =
    document.getElementById(
        'listaReservas'
    );

const botoesFiltro =
    document.querySelectorAll(
        '.filtro-btn'
    );

const botoesStatus =
    document.querySelectorAll(
        '.status-filtro-btn'
    );

const btnPendentes =
    document.getElementById(
        'btnPendentes'
    );

const filtrosStatus =
    document.getElementById(
        'filtrosStatus'
    );

const tituloReservas =
    document.getElementById(
        'tituloReservas'
    );

const descricaoReservas =
    document.getElementById(
        'descricaoReservas'
    );

const notificacaoReservas =
    document.getElementById(
        'notificacaoReservas'
    );

let filtroAtual =
    'geral';

let statusAtual =
    'TODAS';

let reservasCarregadas =
    [];

let tempoNotificacao;



if (
    usuario.tipo_usuario ===
    'ADMINISTRADOR'
) {

    btnPendentes.style.display =
        'inline-block';
}



function mostrarNotificacao(
    mensagem,
    tipo
) {

    clearTimeout(
        tempoNotificacao
    );

    notificacaoReservas.textContent =
        mensagem;

    notificacaoReservas.className =
        'notificacao ' + tipo;

    requestAnimationFrame(
        () => {

            notificacaoReservas.classList.add(
                'ativa'
            );
        }
    );

    tempoNotificacao =
        setTimeout(
            () => {

                notificacaoReservas.classList.remove(
                    'ativa'
                );

            },
            4000
        );
}



function atualizarTitulo() {

    if (
        filtroAtual ===
        'minhas'
    ) {

        tituloReservas.textContent =
            'Minhas Reservas';

        descricaoReservas.textContent =
            'Acompanhe e gerencie as reservas feitas por você.';

        return;
    }

    if (
        filtroAtual ===
        'pendentes'
    ) {

        tituloReservas.textContent =
            'Reservas Pendentes';

        descricaoReservas.textContent =
            'Analise as reservas que aguardam aprovação.';

        return;
    }

    tituloReservas.textContent =
        'Reservas';

    descricaoReservas.textContent =
        'Consulte as reservas cadastradas no sistema.';
}



function mostrarCarregamento() {

    listaReservas.innerHTML =
        '';

    const estado =
        document.createElement(
            'div'
        );

    estado.className =
        'estado-lista';

    estado.textContent =
        'Carregando reservas...';

    listaReservas.appendChild(
        estado
    );
}



async function carregarReservas() {

    mostrarCarregamento();

    try {

        let url =
            'http://localhost:3333/reservas?filtro=' +
            filtroAtual;

        if (
            filtroAtual ===
            'minhas'
        ) {

            url +=
                '&id_usuario=' +
                usuario.id_usuario;
        }

        const resposta =
            await fetch(url);

        const resultado =
            await resposta.json();

        if (
            !resultado.sucesso
        ) {

            mostrarEstadoVazio(
                resultado.mensagem ||
                'Não foi possível carregar as reservas.'
            );

            return;
        }

        reservasCarregadas =
            resultado.reservas || [];

        aplicarFiltroStatus();

    } catch (erro) {

        console.error(
            erro
        );

        mostrarEstadoVazio(
            'Erro ao carregar reservas.'
        );
    }
}



function aplicarFiltroStatus() {

    let reservasFiltradas =
        reservasCarregadas.slice();

    if (
        statusAtual !==
        'TODAS'
    ) {

        reservasFiltradas =
            reservasFiltradas.filter(
                (reserva) =>
                    reserva.status ===
                    statusAtual
            );
    }

    renderizarReservas(
        reservasFiltradas
    );
}



function mostrarEstadoVazio(
    mensagem
) {

    listaReservas.innerHTML =
        '';

    const estado =
        document.createElement(
            'div'
        );

    estado.className =
        'estado-lista';

    const titulo =
        document.createElement(
            'strong'
        );

    titulo.textContent =
        'Nenhuma reserva encontrada';

    const texto =
        document.createElement(
            'span'
        );

    texto.textContent =
        mensagem;

    estado.appendChild(
        titulo
    );

    estado.appendChild(
        texto
    );

    listaReservas.appendChild(
        estado
    );
}



function renderizarReservas(
    reservas
) {

    listaReservas.innerHTML =
        '';

    if (
        reservas.length ===
        0
    ) {

        let mensagem =
            'Não existem reservas para este filtro.';

        if (
            statusAtual ===
            'APROVADA'
        ) {

            mensagem =
                'Nenhuma reserva aprovada foi encontrada.';
        }

        if (
            statusAtual ===
            'PENDENTE'
        ) {

            mensagem =
                'Nenhuma reserva pendente foi encontrada.';
        }

        if (
            statusAtual ===
            'CANCELADA'
        ) {

            mensagem =
                'Nenhuma reserva cancelada foi encontrada.';
        }

        mostrarEstadoVazio(
            mensagem
        );

        return;
    }

    const grupos = {};

    const individuais = [];

    reservas.forEach(
        (reserva) => {

            if (
                reserva.id_recorrencia
            ) {

                if (
                    !grupos[
                        reserva.id_recorrencia
                    ]
                ) {

                    grupos[
                        reserva.id_recorrencia
                    ] = [];
                }

                grupos[
                    reserva.id_recorrencia
                ].push(
                    reserva
                );

            } else {

                individuais.push(
                    reserva
                );
            }
        }
    );

    Object.values(
        grupos
    ).forEach(
        (ocorrencias) => {

            listaReservas.appendChild(
                criarCardGrupo(
                    ocorrencias
                )
            );
        }
    );

    individuais.forEach(
        (reserva) => {

            listaReservas.appendChild(
                criarCardIndividual(
                    reserva
                )
            );
        }
    );
}



function formatarStatus(
    status
) {

    if (
        status ===
        'APROVADA'
    ) {
        return 'APROVADA';
    }

    if (
        status ===
        'CANCELADA'
    ) {
        return 'CANCELADA';
    }

    return 'PENDENTE';
}


function formatarData(
    data
) {

    if (!data) {
        return '';
    }

    const partes =
        data.split('-');

    if (
        partes.length !==
        3
    ) {
        return data;
    }

    return (
        partes[2] +
        '/' +
        partes[1] +
        '/' +
        partes[0]
    );
}



function criarCardIndividual(
    reserva
) {

    let classeStatus =
        'pendente';

    let classeBorda =
        'borda-pendente';

    if (
        reserva.status ===
        'APROVADA'
    ) {

        classeStatus =
            'aprovada';

        classeBorda =
            'borda-aprovada';
    }

    if (
        reserva.status ===
        'CANCELADA'
    ) {

        classeStatus =
            'cancelada';

        classeBorda =
            'borda-cancelada';
    }

    const nomeUsuario =
        reserva.usuario &&
        reserva.usuario.nome
            ? reserva.usuario.nome
            : 'Usuário';

    const item =
        document.createElement(
            'div'
        );

    item.className =
        'reserva-item ' +
        classeBorda;

    const badge =
        document.createElement(
            'span'
        );

    badge.className =
        'badge ' +
        classeStatus;

    badge.textContent =
        formatarStatus(
            reserva.status
        );

    const modalidade =
        document.createElement(
            'strong'
        );

    modalidade.textContent =
        reserva.modalidade ||
        'Atividade';

    const data =
        document.createElement(
            'p'
        );

    data.textContent =
        'Data: ' +
        formatarData(
            reserva.data_reserva
        );

    const horario =
        document.createElement(
            'p'
        );

    horario.textContent =
        'Horário: ' +
        reserva.horario_inicio +
        ' às ' +
        reserva.horario_fim;

    const reservadoPor =
        document.createElement(
            'p'
        );

    reservadoPor.textContent =
        'Reservado por: ' +
        nomeUsuario;

    item.appendChild(
        badge
    );

    item.appendChild(
        modalidade
    );

    item.appendChild(
        data
    );

    item.appendChild(
        horario
    );

    item.appendChild(
        reservadoPor
    );

    if (
        filtroAtual ===
        'pendentes' &&
        usuario.tipo_usuario ===
        'ADMINISTRADOR' &&
        reserva.status ===
        'PENDENTE'
    ) {

        const acoes =
            document.createElement(
                'div'
            );

        acoes.className =
            'acoes-admin';

        const btnAprovar =
            document.createElement(
                'button'
            );

        btnAprovar.className =
            'btn-aprovar';

        btnAprovar.textContent =
            'Aprovar';

        btnAprovar.addEventListener(
            'click',
            () => {

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
                        async () => {

                            await atualizarStatus(
                                reserva.id_reserva,
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
            'btn-cancelar';

        btnCancelar.textContent =
            'Cancelar';

        btnCancelar.addEventListener(
            'click',
            () => {

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
                        async () => {

                            await atualizarStatus(
                                reserva.id_reserva,
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

    } else if (
        filtroAtual ===
        'minhas' &&
        reserva.status !==
        'CANCELADA'
    ) {

        const acoes =
            document.createElement(
                'div'
            );

        acoes.className =
            'acoes-admin';

        const btnCancelar =
            document.createElement(
                'button'
            );

        btnCancelar.className =
            'btn-cancelar';

        btnCancelar.textContent =
            'Cancelar Reserva';

        btnCancelar.addEventListener(
            'click',
            () => {

                abrirConfirmacao({
                    titulo:
                        'Cancelar reserva?',

                    mensagem:
                        'Tem certeza de que deseja cancelar esta reserva de ' +
                        formatarData(
                            reserva.data_reserva
                        ) +
                        '?',

                    textoBotao:
                        'Cancelar reserva',

                    tipo:
                        'cancelar',

                    aoConfirmar:
                        async () => {

                            await atualizarStatus(
                                reserva.id_reserva,
                                'CANCELADA'
                            );
                        }
                });
            }
        );

        acoes.appendChild(
            btnCancelar
        );

        item.appendChild(
            acoes
        );
    }

    return item;
}



function criarCardGrupo(
    ocorrencias
) {

    const diasSemana = [
        'Domingo',
        'Segunda-feira',
        'Terça-feira',
        'Quarta-feira',
        'Quinta-feira',
        'Sexta-feira',
        'Sábado'
    ];

    const ocorrenciasOrdenadas =
        ocorrencias
            .slice()
            .sort(
                (a, b) =>
                    a.data_reserva.localeCompare(
                        b.data_reserva
                    )
            );

    const primeira =
        ocorrenciasOrdenadas[0];

    const partesData =
        primeira.data_reserva
            .split('-')
            .map(Number);

    const ano =
        partesData[0];

    const mes =
        partesData[1];

    const dia =
        partesData[2];

    const nomeDiaSemana =
        diasSemana[
            new Date(
                ano,
                mes - 1,
                dia
            ).getDay()
        ];

    const aprovadas =
        ocorrencias.filter(
            (o) =>
                o.status ===
                'APROVADA'
        ).length;

    const pendentes =
        ocorrencias.filter(
            (o) =>
                o.status ===
                'PENDENTE'
        ).length;

    const canceladas =
        ocorrencias.filter(
            (o) =>
                o.status ===
                'CANCELADA'
        ).length;

    const card =
        document.createElement(
            'div'
        );

    card.className =
        'reserva-grupo';

    const tag =
        document.createElement(
            'span'
        );

    tag.className =
        'tag-recorrente';

    tag.textContent =
        'RECORRENTE';

    const titulo =
        document.createElement(
            'strong'
        );

    titulo.textContent =
        primeira.modalidade +
        ' (' +
        primeira.tipo_reserva +
        ')';

    const periodo =
        document.createElement(
            'p'
        );

    periodo.textContent =
        'Toda ' +
        nomeDiaSemana +
        ', ' +
        primeira.horario_inicio +
        ' às ' +
        primeira.horario_fim;

    const total =
        document.createElement(
            'p'
        );

    total.textContent =
        ocorrencias.length +
        ' ocorrências no total';

    const resumo =
        document.createElement(
            'div'
        );

    resumo.className =
        'resumo-status-grupo';

    if (
        aprovadas > 0
    ) {

        const contador =
            document.createElement(
                'span'
            );

        contador.className =
            'contador-status aprovada';

        contador.textContent =
            aprovadas +
            ' aprovada(s)';

        resumo.appendChild(
            contador
        );
    }

    if (
        pendentes > 0
    ) {

        const contador =
            document.createElement(
                'span'
            );

        contador.className =
            'contador-status pendente';

        contador.textContent =
            pendentes +
            ' pendente(s)';

        resumo.appendChild(
            contador
        );
    }

    if (
        canceladas > 0
    ) {

        const contador =
            document.createElement(
                'span'
            );

        contador.className =
            'contador-status cancelada';

        contador.textContent =
            canceladas +
            ' cancelada(s)';

        resumo.appendChild(
            contador
        );
    }

    const detalhes =
        document.createElement(
            'p'
        );

    detalhes.className =
        'detalhes-indicacao';

    detalhes.textContent =
        'Clique para ver os detalhes';

    card.appendChild(
        tag
    );

    card.appendChild(
        titulo
    );

    card.appendChild(
        periodo
    );

    card.appendChild(
        total
    );

    card.appendChild(
        resumo
    );

    card.appendChild(
        detalhes
    );

    card.addEventListener(
        'click',
        () => {

            abrirDetalhesGrupo(
                ocorrenciasOrdenadas
            );
        }
    );

    return card;
}



function abrirDetalhesGrupo(
    ocorrencias
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
        ocorrencias[0].modalidade +
        ' — Agendamento Recorrente';

    modal.appendChild(
        titulo
    );

    const podeCancelar =
        filtroAtual ===
        'minhas' ||
        usuario.tipo_usuario ===
        'ADMINISTRADOR';

    ocorrencias
        .slice()
        .sort(
            (a, b) =>
                a.data_reserva.localeCompare(
                    b.data_reserva
                )
        )
        .forEach(
            (ocorrencia) => {

                let classeOcorrencia =
                    '';

                if (
                    ocorrencia.status ===
                    'APROVADA'
                ) {

                    classeOcorrencia =
                        'aprovada';
                }

                if (
                    ocorrencia.status ===
                    'CANCELADA'
                ) {

                    classeOcorrencia =
                        'cancelada';
                }

                const item =
                    document.createElement(
                        'div'
                    );

                item.className =
                    'ocorrencia-item ' +
                    classeOcorrencia;

                const status =
                    document.createElement(
                        'span'
                    );

                status.className =
                    'ocorrencia-status';

                status.textContent =
                    ocorrencia.status;

                const data =
                    document.createElement(
                        'strong'
                    );

                data.style.display =
                    'block';

                data.textContent =
                    formatarData(
                        ocorrencia.data_reserva
                    );

                const horario =
                    document.createElement(
                        'span'
                    );

                horario.textContent =
                    ocorrencia.horario_inicio +
                    ' às ' +
                    ocorrencia.horario_fim;

                item.appendChild(
                    status
                );

                item.appendChild(
                    data
                );

                item.appendChild(
                    horario
                );

                if (
                    podeCancelar &&
                    ocorrencia.status !==
                    'CANCELADA'
                ) {

                    const btnCancelar =
                        document.createElement(
                            'button'
                        );

                    btnCancelar.className =
                        'btn-cancelar';

                    btnCancelar.style.marginTop =
                        '10px';

                    btnCancelar.textContent =
                        'Cancelar esta data';

                    btnCancelar.addEventListener(
                        'click',
                        (evento) => {

                            evento.stopPropagation();

                            abrirConfirmacao({
                                titulo:
                                    'Cancelar esta data?',

                                mensagem:
                                    'A reserva de ' +
                                    formatarData(
                                        ocorrencia.data_reserva
                                    ) +
                                    ' será cancelada.',

                                textoBotao:
                                    'Cancelar data',

                                tipo:
                                    'cancelar',

                                aoConfirmar:
                                    async () => {

                                        await atualizarStatus(
                                            ocorrencia.id_reserva,
                                            'CANCELADA'
                                        );
                                    }
                            });
                        }
                    );

                    item.appendChild(
                        btnCancelar
                    );
                }

                modal.appendChild(
                    item
                );
            }
        );

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
        () => {

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
        (e) => {

            if (
                e.target ===
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

    const modalDetalhesExistente =
        document.querySelector(
            '.modal-overlay'
        );

    if (
        modalDetalhesExistente
    ) {

        modalDetalhesExistente.remove();
    }

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
        'modal-confirmacao';

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
        () => {

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
        async () => {

            btnConfirmar.disabled =
                true;

            btnVoltar.disabled =
                true;

            btnConfirmar.textContent =
                'Aguarde...';

            try {

                await configuracao.aoConfirmar();

            } finally {

                if (
                    document.body.contains(
                        overlay
                    )
                ) {

                    overlay.remove();
                }
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
        (e) => {

            if (
                e.target ===
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



function fecharModais() {

    document
        .querySelectorAll(
            '.modal-overlay'
        )
        .forEach(
            (modal) => {

                modal.remove();
            }
        );
}

document.addEventListener(
    'keydown',
    (e) => {

        if (
            e.key ===
            'Escape'
        ) {

            fecharModais();
        }
    }
);



async function atualizarStatus(
    idReserva,
    novoStatus
) {

    try {

        const resposta =
            await fetch(
                'http://localhost:3333/reservas/' +
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

        if (
            !resultado.sucesso
        ) {

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

        } else if (
            novoStatus ===
            'CANCELADA'
        ) {

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



botoesFiltro.forEach(
    (botao) => {

        botao.addEventListener(
            'click',
            () => {

                botoesFiltro.forEach(
                    (b) => {

                        b.classList.remove(
                            'ativo'
                        );
                    }
                );

                botao.classList.add(
                    'ativo'
                );

                filtroAtual =
                    botao.dataset.filtro;

                statusAtual =
                    'TODAS';

                botoesStatus.forEach(
                    (b) => {

                        b.classList.toggle(
                            'ativo',
                            b.dataset.status ===
                            'TODAS'
                        );
                    }
                );

                if (
                    filtroAtual ===
                    'pendentes'
                ) {

                    filtrosStatus.style.display =
                        'none';

                } else {

                    filtrosStatus.style.display =
                        'flex';
                }

                atualizarTitulo();

                carregarReservas();
            }
        );
    }
);



botoesStatus.forEach(
    (botao) => {

        botao.addEventListener(
            'click',
            () => {

                botoesStatus.forEach(
                    (b) => {

                        b.classList.remove(
                            'ativo'
                        );
                    }
                );

                botao.classList.add(
                    'ativo'
                );

                statusAtual =
                    botao.dataset.status;

                aplicarFiltroStatus();
            }
        );
    }
);



atualizarTitulo();

carregarReservas();



setInterval(
    carregarReservas,
    60000
);