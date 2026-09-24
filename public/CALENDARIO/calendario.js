const meses = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

let dataAtual = new Date();
let anoAtual = dataAtual.getFullYear();
let mesAtual = dataAtual.getMonth();

let reservas = {};

const tituloMes = document.querySelector('.calendar-controls h2');
const grid = document.querySelector('.calendar-grid');
const btnAnterior = document.querySelector('.calendar-controls button:first-child');
const btnProximo = document.querySelector('.calendar-controls button:last-child');

async function carregarReservas() {

    gerarCalendario(
        anoAtual,
        mesAtual
    );

    try {

        const resposta =
            await fetch(
                'http://localhost:3333/reservas?filtro=calendario'
            );

        const resultado =
            await resposta.json();

        if (!resultado.sucesso) {

            console.error(
                resultado.mensagem
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
                    reservas[chave] = [];
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

function obterClasseTipo(tipo) {

    if (tipo === 'AULA') {
        return 'tag-aula';
    }

    if (tipo === 'EVENTO') {
        return 'tag-evento';
    }

    return 'tag-jogo';
}

function gerarCalendario(ano, mes) {

    grid.innerHTML = '';

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
            document.createElement('div');

        vazio.className =
            'day empty';

        grid.appendChild(vazio);
    }

    const hoje =
        new Date();

    for (
        let dia = 1;
        dia <= totalDias;
        dia++
    ) {

        const celula =
            document.createElement('div');

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

    const modalExistente =
        document.querySelector(
            '.modal-overlay'
        );

    if (modalExistente) {
        modalExistente.remove();
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

                const quebra1 =
                    document.createElement(
                        'br'
                    );

                item.appendChild(
                    quebra1
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

                const quebra2 =
                    document.createElement(
                        'br'
                    );

                item.appendChild(
                    quebra2
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