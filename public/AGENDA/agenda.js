const usuario =
    JSON.parse(
        localStorage.getItem('usuario')
    );

if (!usuario) {
    window.location.href =
        '../index.html';
}

if (
    localStorage.getItem('tema') ===
    'true'
) {
    document.documentElement.classList.add(
        'dark-mode'
    );
}

const atividade =
    document.getElementById('atividade');

const atividadePersonalizada =
    document.getElementById(
        'atividadePersonalizada'
    );

const outraAtividade =
    document.getElementById(
        'outraAtividade'
    );

const dataReserva =
    document.getElementById(
        'dataReserva'
    );

const nomeInput =
    document.getElementById('nome');

const ocupacaoSelect =
    document.getElementById(
        'ocupacao'
    );

const checkbox =
    document.getElementById(
        'agendamentoRecorrente'
    );

const agendamentoUnico =
    document.getElementById(
        'agendamentoUnico'
    );

const camposRecorrentes =
    document.getElementById(
        'camposRecorrentes'
    );

const botao =
    document.querySelector(
        '.submit-btn'
    );

const horarioInicio =
    document.getElementById(
        'horarioInicio'
    );

const horarioFim =
    document.getElementById(
        'horarioFim'
    );

const resumoReserva =
    document.getElementById(
        'resumoReserva'
    );

const formReserva =
    document.getElementById(
        'formReserva'
    );

const diaSemanaSelect =
    document.getElementById(
        'diaSemana'
    );

const quantidadeSemanasInput =
    document.getElementById(
        'quantidadeSemanas'
    );

const horarioInicioRecorrente =
    document.getElementById(
        'horarioInicioRecorrente'
    );

const horarioFimRecorrente =
    document.getElementById(
        'horarioFimRecorrente'
    );

const tipoReservaSelect =
    document.getElementById(
        'tipoReserva'
    );

const dataInicioRecorrente =
    document.getElementById(
        'dataInicioRecorrente'
    );

const notificacaoAgenda =
    document.getElementById(
        'notificacaoAgenda'
    );

const CHAVE_RASCUNHO_AGENDA =
    'rascunho_agenda';

const CHAVE_DATA_CALENDARIO =
    'data_reserva_calendario';

let tempoNotificacao;

nomeInput.value =
    usuario.nome;

ocupacaoSelect.value =
    usuario.tipo_usuario;

function mostrarNotificacao(
    mensagem,
    tipo
) {

    clearTimeout(
        tempoNotificacao
    );

    notificacaoAgenda.textContent =
        mensagem;

    notificacaoAgenda.className =
        'notificacao ' + tipo;

    requestAnimationFrame(
        () => {

            notificacaoAgenda.classList.add(
                'ativa'
            );
        }
    );

    tempoNotificacao =
        setTimeout(
            () => {

                notificacaoAgenda.classList.remove(
                    'ativa'
                );

            },
            4000
        );
}

function obterDataHoje() {

    const agora =
        new Date();

    const ano =
        agora.getFullYear();

    const mes =
        String(
            agora.getMonth() + 1
        ).padStart(2, '0');

    const dia =
        String(
            agora.getDate()
        ).padStart(2, '0');

    return (
        ano +
        '-' +
        mes +
        '-' +
        dia
    );
}

const dataHoje =
    obterDataHoje();

const anoAtual =
    new Date().getFullYear();

const dataMaxima =
    String(anoAtual + 1) +
    '-12-31';

dataReserva.min =
    dataHoje;

dataReserva.max =
    dataMaxima;

dataInicioRecorrente.min =
    dataHoje;

dataInicioRecorrente.max =
    dataMaxima;

function dataEhPassada(
    data
) {

    if (!data) {
        return false;
    }

    return data < dataHoje;
}

function horarioJaPassou(
    data,
    horario
) {

    if (
        !data ||
        !horario
    ) {
        return false;
    }

    if (
        data !==
        obterDataHoje()
    ) {
        return false;
    }

    const agora =
        new Date();

    const minutosAgora =
        agora.getHours() * 60 +
        agora.getMinutes();

    return (
        converterHorarioEmMinutos(
            horario
        ) <
        minutosAgora
    );
}

function dataEhValidaParaAgenda(
    data
) {

    if (
        !data ||
        !/^\d{4}-\d{2}-\d{2}$/.test(
            data
        )
    ) {

        return false;
    }

    if (
        data < dataHoje ||
        data > dataMaxima
    ) {

        return false;
    }

    const partes =
        data
            .split('-')
            .map(Number);

    const dataTeste =
        new Date(
            partes[0],
            partes[1] - 1,
            partes[2]
        );

    return (
        dataTeste.getFullYear() ===
            partes[0] &&
        dataTeste.getMonth() ===
            partes[1] - 1 &&
        dataTeste.getDate() ===
            partes[2]
    );
}

atividade.addEventListener(
    'change',
    () => {

        if (
            atividade.value ===
            'Outro'
        ) {

            outraAtividade.style.display =
                'flex';

        } else {

            outraAtividade.style.display =
                'none';

            atividadePersonalizada.value =
                '';
        }
    }
);

if (
    usuario.tipo_usuario ===
    'ALUNO'
) {

    checkbox.parentElement.style.display =
        'none';

    camposRecorrentes.style.display =
        'none';
}

function atualizarModoReserva() {

    if (checkbox.checked) {

        agendamentoUnico.style.display =
            'none';

        camposRecorrentes.style.display =
            'block';

        botao.textContent =
            'Criar Agendamento Recorrente';

    } else {

        agendamentoUnico.style.display =
            'block';

        camposRecorrentes.style.display =
            'none';

        botao.textContent =
            'Confirmar Reserva';
    }
}

checkbox.addEventListener(
    'change',
    atualizarModoReserva
);

// Limites da reserva (o servidor confere os mesmos valores)
const ABERTURA_MINUTOS =
    7 * 60;

const FECHAMENTO_MINUTOS =
    21 * 60;

const DURACAO_MAXIMA_MINUTOS =
    4 * 60;

// Duração escolhida por último. Quando o horário inicial muda,
// o final acompanha mantendo essa duração.
let duracaoAtualMinutos =
    60;

function converterHorarioEmMinutos(
    horario
) {

    if (!horario) {
        return null;
    }

    const partes =
        horario.split(':');

    const horas =
        Number(partes[0]);

    const minutos =
        Number(partes[1]);

    return (
        horas * 60 +
        minutos
    );
}

function converterMinutosEmHorario(
    totalMinutos
) {

    const horas =
        Math.floor(
            totalMinutos / 60
        );

    const minutos =
        totalMinutos % 60;

    return (
        String(horas).padStart(
            2,
            '0'
        ) +
        ':' +
        String(minutos).padStart(
            2,
            '0'
        )
    );
}

// Devolve a mensagem de erro do horário da reserva única,
// ou null quando está tudo certo.
function erroHorarioReservaUnica(
    inicio,
    fim
) {

    if (
        !inicio ||
        !fim
    ) {
        return 'Preencha o horário inicial e final.';
    }

    const inicioMinutos =
        converterHorarioEmMinutos(
            inicio
        );

    const fimMinutos =
        converterHorarioEmMinutos(
            fim
        );

    if (
        inicioMinutos <
        ABERTURA_MINUTOS
    ) {
        return 'O horário inicial deve ser a partir das 07:00.';
    }

    if (
        fimMinutos >
        FECHAMENTO_MINUTOS
    ) {
        return 'O horário final não pode ultrapassar 21:00.';
    }

    if (
        fimMinutos <=
        inicioMinutos
    ) {
        return 'O horário final precisa ser depois do horário inicial.';
    }

    if (
        fimMinutos - inicioMinutos >
        DURACAO_MAXIMA_MINUTOS
    ) {
        return 'A reserva pode durar no máximo 4 horas.';
    }

    return null;
}

function formatarDuracao(
    totalMinutos
) {

    const horas =
        Math.floor(
            totalMinutos / 60
        );

    const minutos =
        totalMinutos % 60;

    if (horas === 0) {
        return minutos + ' min';
    }

    if (minutos === 0) {
        return horas + 'h';
    }

    return (
        horas +
        'h' +
        String(minutos).padStart(
            2,
            '0'
        )
    );
}

function atualizarResumo() {

    const inicio =
        horarioInicio.value;

    const fim =
        horarioFim.value;

    const erro =
        erroHorarioReservaUnica(
            inicio,
            fim
        );

    resumoReserva.classList.toggle(
        'erro',
        Boolean(erro)
    );

    if (erro) {

        resumoReserva.textContent =
            erro;

        return;
    }

    resumoReserva.textContent =
        inicio +
        ' às ' +
        fim +
        ' (' +
        formatarDuracao(
            converterHorarioEmMinutos(fim) -
            converterHorarioEmMinutos(inicio)
        ) +
        ')';
}

// Mudou o início: o final anda junto, mantendo a duração
function ajustarFimPeloInicio() {

    if (!horarioInicio.value) {

        atualizarResumo();

        return;
    }

    const inicioMinutos =
        converterHorarioEmMinutos(
            horarioInicio.value
        );

    const novoFim =
        Math.min(
            inicioMinutos +
            duracaoAtualMinutos,
            FECHAMENTO_MINUTOS
        );

    if (
        novoFim >
        inicioMinutos
    ) {

        horarioFim.value =
            converterMinutosEmHorario(
                novoFim
            );
    }

    atualizarResumo();
}

// Mudou o final: guarda a nova duração (se for válida)
function guardarDuracaoPeloFim() {

    if (
        !erroHorarioReservaUnica(
            horarioInicio.value,
            horarioFim.value
        )
    ) {

        duracaoAtualMinutos =
            converterHorarioEmMinutos(
                horarioFim.value
            ) -
            converterHorarioEmMinutos(
                horarioInicio.value
            );
    }

    atualizarResumo();
}

horarioInicio.addEventListener(
    'change',
    ajustarFimPeloInicio
);

horarioInicio.addEventListener(
    'input',
    atualizarResumo
);

horarioFim.addEventListener(
    'change',
    guardarDuracaoPeloFim
);

horarioFim.addEventListener(
    'input',
    atualizarResumo
);

atualizarResumo();

function calcularDatasRecorrentes(
    diaSemana,
    quantidadeSemanas,
    dataInicioStr
) {

    const datas = [];

    const partes =
        dataInicioStr
            .split('-')
            .map(Number);

    const ano =
        partes[0];

    const mes =
        partes[1];

    const dia =
        partes[2];

    const dataBase =
        new Date(
            ano,
            mes - 1,
            dia
        );

    const diaBase =
        dataBase.getDay();

    let diferenca =
        diaSemana -
        diaBase;

    if (
        diferenca < 0
    ) {
        diferenca += 7;
    }

    const primeiraData =
        new Date(
            dataBase
        );

    primeiraData.setDate(
        dataBase.getDate() +
        diferenca
    );

    for (
        let i = 0;
        i < quantidadeSemanas;
        i++
    ) {

        const data =
            new Date(
                primeiraData
            );

        data.setDate(
            primeiraData.getDate() +
            i * 7
        );

        const anoStr =
            data.getFullYear();

        const mesStr =
            String(
                data.getMonth() + 1
            ).padStart(
                2,
                '0'
            );

        const diaStr =
            String(
                data.getDate()
            ).padStart(
                2,
                '0'
            );

        datas.push(
            anoStr +
            '-' +
            mesStr +
            '-' +
            diaStr
        );
    }

    return datas;
}

function obterModalidade() {

    if (
        !atividade.value
    ) {

        mostrarNotificacao(
            'Selecione um esporte ou atividade.',
            'aviso'
        );

        return null;
    }

    if (
        atividade.value ===
        'Outro'
    ) {

        const personalizada =
            atividadePersonalizada
                .value
                .trim();

        if (
            !personalizada
        ) {

            mostrarNotificacao(
                'Digite qual atividade será realizada.',
                'aviso'
            );

            return null;
        }

        return personalizada;
    }

    return atividade.value;
}

function validarReservaRecorrente() {

    if (
        !dataInicioRecorrente.value
    ) {

        mostrarNotificacao(
            'Escolha a data de início.',
            'aviso'
        );

        return false;
    }

    if (
        dataEhPassada(
            dataInicioRecorrente.value
        )
    ) {

        mostrarNotificacao(
            'Não é possível criar uma reserva em uma data passada.',
            'aviso'
        );

        return false;
    }

    const horaInicio =
        horarioInicioRecorrente.value;

    const horaFim =
        horarioFimRecorrente.value;

    if (
        !horaInicio ||
        !horaFim
    ) {

        mostrarNotificacao(
            'Preencha o horário inicial e final.',
            'aviso'
        );

        return false;
    }

    const primeiraData =
        calcularDatasRecorrentes(
            Number(diaSemanaSelect.value),
            1,
            dataInicioRecorrente.value
        )[0];

    if (
        horarioJaPassou(
            primeiraData,
            horaInicio
        )
    ) {

        mostrarNotificacao(
            'O primeiro dia dessa reserva já passou nesse horário. Escolha outra data de início ou outro horário.',
            'aviso'
        );

        return false;
    }

    const inicioMinutos =
        converterHorarioEmMinutos(
            horaInicio
        );

    const fimMinutos =
        converterHorarioEmMinutos(
            horaFim
        );

    const limiteInicio =
        7 * 60;

    const limiteFim =
        21 * 60;

    if (
        inicioMinutos <
        limiteInicio
    ) {

        mostrarNotificacao(
            'O horário inicial deve ser a partir das 07:00.',
            'aviso'
        );

        return false;
    }

    if (
        fimMinutos >
        limiteFim
    ) {

        mostrarNotificacao(
            'O horário final não pode ultrapassar 21:00.',
            'aviso'
        );

        return false;
    }

    if (
        fimMinutos <=
        inicioMinutos
    ) {

        mostrarNotificacao(
            'O horário final precisa ser depois do horário inicial.',
            'aviso'
        );

        return false;
    }

    const duracaoMinutos =
        fimMinutos -
        inicioMinutos;

    if (
        duracaoMinutos >
        4 * 60
    ) {

        mostrarNotificacao(
            'A reserva pode durar no máximo 4 horas.',
            'aviso'
        );

        return false;
    }

    const quantidadeSemanas =
        Number(
            quantidadeSemanasInput.value
        );

    if (
        !quantidadeSemanas ||
        quantidadeSemanas < 1 ||
        quantidadeSemanas > 16
    ) {

        mostrarNotificacao(
            'Escolha entre 1 e 16 semanas.',
            'aviso'
        );

        return false;
    }

    return true;
}

function validarReservaUnica() {

    if (
        !dataReserva.value
    ) {

        mostrarNotificacao(
            'Escolha a data da reserva.',
            'aviso'
        );

        return false;
    }

    if (
        dataEhPassada(
            dataReserva.value
        )
    ) {

        mostrarNotificacao(
            'Não é possível criar uma reserva em uma data passada.',
            'aviso'
        );

        return false;
    }

    const inicio =
        horarioInicio.value;

    if (!inicio) {

        mostrarNotificacao(
            'Escolha o horário inicial.',
            'aviso'
        );

        return false;
    }

    if (
        horarioJaPassou(
            dataReserva.value,
            inicio
        )
    ) {

        mostrarNotificacao(
            'Esse horário já passou. Escolha um horário a partir de agora.',
            'aviso'
        );

        return false;
    }

    const erroHorario =
        erroHorarioReservaUnica(
            inicio,
            horarioFim.value
        );

    if (erroHorario) {

        mostrarNotificacao(
            erroHorario,
            'aviso'
        );

        return false;
    }

    return true;
}

function limparFormulario() {

    formReserva.reset();

    nomeInput.value =
        usuario.nome;

    ocupacaoSelect.value =
        usuario.tipo_usuario;

    outraAtividade.style.display =
        'none';

    checkbox.checked =
        false;

    atualizarModoReserva();

    duracaoAtualMinutos =
        60;

    atualizarHorariosDisponiveis();

    localStorage.removeItem(
        CHAVE_RASCUNHO_AGENDA
    );
}

formReserva.addEventListener(
    'submit',
    async (e) => {

        e.preventDefault();

        const modalidade =
            obterModalidade();

        if (!modalidade) {
            return;
        }

        if (
            checkbox.checked
        ) {

            if (
                !validarReservaRecorrente()
            ) {
                return;
            }

            const diaSemana =
                Number(
                    diaSemanaSelect.value
                );

            const quantidadeSemanas =
                Number(
                    quantidadeSemanasInput.value
                );

            const horaInicio =
                horarioInicioRecorrente.value;

            const horaFim =
                horarioFimRecorrente.value;

            const datas =
                calcularDatasRecorrentes(
                    diaSemana,
                    quantidadeSemanas,
                    dataInicioRecorrente.value
                );

            try {

                const idGrupoRecorrencia =
                    crypto.randomUUID();

                for (
                    const data of datas
                ) {

                    const resposta =
                        await fetch(
                            '/reservas',
                            {
                                method:
                                    'POST',

                                headers: {
                                    'Content-Type':
                                        'application/json'
                                },

                                body:
                                    JSON.stringify({
                                        data_reserva:
                                            data,

                                        horario_inicio:
                                            horaInicio,

                                        horario_fim:
                                            horaFim,

                                        modalidade:
                                            modalidade,

                                        tipo_reserva:
                                            tipoReservaSelect.value,

                                        recorrente:
                                            true,

                                        id_usuario:
                                            usuario.id_usuario,

                                        id_recorrencia:
                                            idGrupoRecorrencia
                                    })
                            }
                        );

                    const resultado =
                        await resposta.json();

                    if (
                        !resultado.sucesso
                    ) {

                        mostrarNotificacao(
                            'Erro ao criar reserva de ' +
                            data +
                            ': ' +
                            resultado.mensagem,
                            'erro'
                        );

                        return;
                    }
                }

                mostrarNotificacao(
                    'Agendamento recorrente criado com sucesso! (' +
                    datas.length +
                    ' reservas)',
                    'sucesso'
                );

                limparFormulario();

            } catch (erro) {

                console.error(
                    erro
                );

                mostrarNotificacao(
                    'Erro ao conectar com o servidor.',
                    'erro'
                );
            }

            return;
        }

        if (
            !validarReservaUnica()
        ) {
            return;
        }

        const inicio =
            horarioInicio.value;

        const horaFinal =
            horarioFim.value;

        try {

            const resposta =
                await fetch(
                    '/reservas',
                    {
                        method:
                            'POST',

                        headers: {
                            'Content-Type':
                                'application/json'
                        },

                        body:
                            JSON.stringify({
                                data_reserva:
                                    dataReserva.value,

                                horario_inicio:
                                    inicio,

                                horario_fim:
                                    horaFinal,

                                modalidade:
                                    modalidade,

                                tipo_reserva:
                                    tipoReservaSelect.value,

                                recorrente:
                                    false,

                                id_usuario:
                                    usuario.id_usuario
                            })
                    }
                );

            const resultado =
                await resposta.json();

            if (
                resultado.sucesso
            ) {

                mostrarNotificacao(
                    'Reserva criada com sucesso!',
                    'sucesso'
                );

                limparFormulario();

            } else {

                mostrarNotificacao(
                    resultado.mensagem,
                    'erro'
                );
            }

        } catch (erro) {

            console.error(
                erro
            );

            mostrarNotificacao(
                'Erro ao conectar com o servidor.',
                'erro'
            );
        }
    }
);

function salvarRascunho() {

    const rascunho = {

        atividade:
            atividade.value,

        atividadePersonalizada:
            atividadePersonalizada.value,

        dataReserva:
            dataReserva.value,

        horarioInicio:
            horarioInicio.value,

        horarioFim:
            horarioFim.value
    };

    localStorage.setItem(
        CHAVE_RASCUNHO_AGENDA,
        JSON.stringify(
            rascunho
        )
    );
}

function restaurarRascunho() {

    const salvo =
        localStorage.getItem(
            CHAVE_RASCUNHO_AGENDA
        );

    if (!salvo) {
        return;
    }

    try {

        const rascunho =
            JSON.parse(
                salvo
            );

        atividade.value =
            rascunho.atividade ||
            '';

        if (
            rascunho.atividade ===
            'Outro'
        ) {

            outraAtividade.style.display =
                'flex';

            atividadePersonalizada.value =
                rascunho.atividadePersonalizada ||
                '';
        }

        if (
            rascunho.dataReserva &&
            !dataEhPassada(
                rascunho.dataReserva
            )
        ) {

            dataReserva.value =
                rascunho.dataReserva;
        }

        horarioInicio.value =
            rascunho.horarioInicio ||
            '07:00';

        if (rascunho.horarioFim) {

            horarioFim.value =
                rascunho.horarioFim;

        } else {

            // Rascunho antigo (com "duração" em horas)
            const horasAntigas =
                Number(rascunho.duracao) || 1;

            horarioFim.value =
                converterMinutosEmHorario(
                    Math.min(
                        converterHorarioEmMinutos(
                            horarioInicio.value
                        ) +
                        horasAntigas * 60,
                        FECHAMENTO_MINUTOS
                    )
                );
        }

        guardarDuracaoPeloFim();

    } catch (erro) {

        console.error(
            'Erro ao restaurar rascunho:',
            erro
        );

        localStorage.removeItem(
            CHAVE_RASCUNHO_AGENDA
        );
    }
}

function aplicarDataDoCalendario() {

    const dataSelecionada =
        sessionStorage.getItem(
            CHAVE_DATA_CALENDARIO
        );

    sessionStorage.removeItem(
        CHAVE_DATA_CALENDARIO
    );

    if (
        !dataEhValidaParaAgenda(
            dataSelecionada
        )
    ) {

        return;
    }

    dataReserva.value =
        dataSelecionada;

    salvarRascunho();
}

[
    atividade,
    dataReserva,
    horarioInicio,
    horarioFim
].forEach(
    (campo) => {

        campo.addEventListener(
            'change',
            salvarRascunho
        );
    }
);

atividadePersonalizada.addEventListener(
    'input',
    salvarRascunho
);

restaurarRascunho();

aplicarDataDoCalendario();

// ---------- Horários que já passaram (reserva única) ----------
// Quando a data escolhida é hoje e o horário inicial já passou, ele é
// adiantado para os próximos 5 minutos (o final acompanha).
// O servidor também confere isso ao salvar.

function atualizarHorariosDisponiveis() {

    if (
        horarioInicio.value &&
        horarioJaPassou(
            dataReserva.value,
            horarioInicio.value
        )
    ) {

        const agora =
            new Date();

        const minutosAgora =
            agora.getHours() * 60 +
            agora.getMinutes();

        const proximoInicio =
            Math.max(
                Math.ceil(
                    (minutosAgora + 1) / 5
                ) * 5,
                ABERTURA_MINUTOS
            );

        if (
            proximoInicio <
            FECHAMENTO_MINUTOS
        ) {

            horarioInicio.value =
                converterMinutosEmHorario(
                    proximoInicio
                );

            ajustarFimPeloInicio();

            return;
        }
    }

    atualizarResumo();
}

dataReserva.addEventListener(
    'change',
    atualizarHorariosDisponiveis
);

// Se a página ficar aberta por horas, a lista acompanha o relógio.
setInterval(
    atualizarHorariosDisponiveis,
    60 * 1000
);

atualizarHorariosDisponiveis();


// ---------- Horário livre na reserva recorrente ----------
// Aceita qualquer minuto (ex.: 14:25), não só horas cheias.
// Os campos começam em 07:00 e 08:00, para o seletor do navegador
// não preencher sozinho com os minutos do relógio.

[
    horarioInicioRecorrente,
    horarioFimRecorrente
].forEach(
    (campo) => {

        campo.step = 60;

        campo.removeAttribute('min');
        campo.removeAttribute('max');
    }
);

if (!horarioInicioRecorrente.value) {
    horarioInicioRecorrente.value = '07:00';
}

if (!horarioFimRecorrente.value) {
    horarioFimRecorrente.value = '08:00';
}
