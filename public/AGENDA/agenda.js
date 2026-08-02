const usuario =
    JSON.parse(
        localStorage.getItem('usuario')
    );

if (!usuario) {
    window.location.href =
        '../LOGIN/index.html';
}

// MODO ESCURO

if (localStorage.getItem('tema') === 'true') {
    document.documentElement.classList.add('dark-mode');
}

// ELEMENTOS DA PÁGINA

const atividade =
    document.getElementById('atividade');

const outraAtividade =
    document.getElementById('outraAtividade');

const dataReserva =
    document.getElementById('dataReserva');

const nomeInput =
    document.getElementById('nome');

const ocupacaoSelect =
    document.getElementById('ocupacao');

const checkbox =
    document.getElementById('agendamentoRecorrente');

const agendamentoUnico =
    document.getElementById('agendamentoUnico');

const camposRecorrentes =
    document.getElementById('camposRecorrentes');

const botao =
    document.querySelector('.submit-btn');

const horarioInicio =
    document.getElementById('horarioInicio');

const duracao =
    document.getElementById('duracao');

const resumoReserva =
    document.getElementById('resumoReserva');

const formReserva =
    document.getElementById('formReserva');

const diaSemanaSelect =
    document.getElementById('diaSemana');

const quantidadeSemanasInput =
    document.getElementById('quantidadeSemanas');

const horarioInicioRecorrente =
    document.getElementById('horarioInicioRecorrente');

const horarioFimRecorrente =
    document.getElementById('horarioFimRecorrente');

const tipoReservaSelect =
    document.getElementById('tipoReserva');

const dataInicioRecorrente =
    document.getElementById('dataInicioRecorrente');

// DADOS DO USUÁRIO

nomeInput.value =
    usuario.nome;

ocupacaoSelect.value =
    usuario.tipo_usuario;

// CAMPO "OUTRO"


atividade.addEventListener(
    'change',
    () => {

        if (atividade.value === 'Outro') {

            outraAtividade.style.display =
                'flex';

        } else {

            outraAtividade.style.display =
                'none';

        }

    }
);

// LIMITE DE DATA

const hoje =
    new Date();

const anoAtual =
    hoje.getFullYear();

dataReserva.min =
    `${anoAtual}-01-01`;

dataReserva.max =
    `${anoAtual + 1}-12-31`;

dataReserva.min = `${anoAtual}-01-01`;
dataReserva.max = `${anoAtual + 1}-12-31`;

dataInicioRecorrente.min = `${anoAtual}-01-01`;
dataInicioRecorrente.max = `${anoAtual + 1}-12-31`;

// RESERVA RECORRENTE

if (usuario.tipo_usuario === 'ALUNO') {

    checkbox.parentElement.style.display =
        'none';

    camposRecorrentes.style.display =
        'none';

}

checkbox.addEventListener(
    'change',
    () => {

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
);

// HORÁRIOS

for (
    let hora = 7;
    hora <= 17;
    hora++
) {

    const horario =
        String(hora)
            .padStart(2, '0') +
        ':00';

    const option =
        document.createElement('option');

    option.value =
        horario;

    option.textContent =
        horario;

    horarioInicio.appendChild(option);

}

// RESUMO DA RESERVA

function atualizarResumo() {

    const inicio =
        horarioInicio.value;

    const horas =
        Number(duracao.value);

    const horaInicial =
        Number(
            inicio.split(':')[0]
        );

    let horaFinal =
        horaInicial + horas;

    if (horaFinal > 23) {

        horaFinal = 23;

    }

    const final =
        String(horaFinal)
            .padStart(2, '0') +
        ':00';

    resumoReserva.textContent =
        `${inicio} às ${final}`;

}

horarioInicio.addEventListener(
    'change',
    atualizarResumo
);

duracao.addEventListener(
    'change',
    atualizarResumo
);

atualizarResumo();

// RESERVA RECORRENTE

function calcularDatasRecorrentes(diaSemana, quantidadeSemanas, dataInicioStr) {

    const datas = [];

    const [ano, mes, dia] = dataInicioStr.split('-').map(Number);
    const dataBase = new Date(ano, mes - 1, dia);

    const diaBase = dataBase.getDay();

    let diferenca = diaSemana - diaBase;
    if (diferenca < 0) diferenca += 7;

    const primeiraData = new Date(dataBase);
    primeiraData.setDate(dataBase.getDate() + diferenca);

    for (let i = 0; i < quantidadeSemanas; i++) {

        const data = new Date(primeiraData);
        data.setDate(primeiraData.getDate() + (i * 7));

        const anoStr = data.getFullYear();
        const mesStr = String(data.getMonth() + 1).padStart(2, '0');
        const diaStr = String(data.getDate()).padStart(2, '0');

        datas.push(`${anoStr}-${mesStr}-${diaStr}`);

    }

    return datas;

}

// SALVAR RESERVA

formReserva.addEventListener('submit', async (e) => {

    e.preventDefault();

    const modalidade =
        atividade.value === 'Outro'
            ? document.getElementById('atividadePersonalizada').value
            : atividade.value;

    if (checkbox.checked) {

        const diaSemana =
            Number(diaSemanaSelect.value);

        const quantidadeSemanas =
            Number(quantidadeSemanasInput.value);

        const horaInicio =
            horarioInicioRecorrente.value;

        const horaFim =
            horarioFimRecorrente.value;

        if (!dataInicioRecorrente.value) {
            alert('Escolha a data de início.');
            return;
        }

        if (!horaInicio || !horaFim) {
            alert('Preencha o horário inicial e final.');
            return;
        }

        if (horaFim <= horaInicio) {
            alert('O horário final precisa ser depois do horário inicial.');
            return;
        }

        if (!quantidadeSemanas || quantidadeSemanas < 1 || quantidadeSemanas > 16) {
            alert('Escolha entre 1 e 16 semanas.');
            return;
        }

        const datas =
            calcularDatasRecorrentes(diaSemana, quantidadeSemanas, dataInicioRecorrente.value);

        try {

            const idGrupoRecorrencia = crypto.randomUUID();

            for (const data of datas) {

                const resposta = await fetch('http://localhost:3333/reservas', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        data_reserva: data,
                        horario_inicio: horaInicio,
                        horario_fim: horaFim,
                        modalidade,
                        tipo_reserva: tipoReservaSelect.value,
                        recorrente: true,
                        id_usuario: usuario.id_usuario,
                        id_recorrencia: idGrupoRecorrencia
                    })
                });

                const resultado = await resposta.json();

                if (!resultado.sucesso) {
                    alert(`Erro ao criar reserva de ${data}: ${resultado.mensagem}`);
                    return;
                }

            }

            alert(`Agendamento recorrente criado com sucesso! (${datas.length} reservas)`);

            formReserva.reset();
            nomeInput.value = usuario.nome;
            ocupacaoSelect.value = usuario.tipo_usuario;
            outraAtividade.style.display = 'none';
            localStorage.removeItem(CHAVE_RASCUNHO_AGENDA);

        } catch (erro) {
            console.error(erro);
            alert('Erro ao conectar com o servidor.');
        }

        return;

    }

    const inicio =
        horarioInicio.value;

    const horas =
        Number(duracao.value);

    const horaFinal =
        String(
            Number(
                inicio.split(':')[0]
            ) + horas
        ).padStart(2, '0') + ':00';

    try {

        const resposta =
            await fetch('http://localhost:3333/reservas', {

                method: 'POST',

                headers: {
                    'Content-Type':
                        'application/json'
                },

                body: JSON.stringify({

                    data_reserva:
                        dataReserva.value,

                    horario_inicio:
                        inicio,

                    horario_fim:
                        horaFinal,

                    modalidade,

                    tipo_reserva:
                        tipoReservaSelect.value,

                    recorrente:
                        false,

                    id_usuario:
                        usuario.id_usuario

                })

            });

        const resultado =
            await resposta.json();

        if (resultado.sucesso) {

            alert(
                'Reserva criada com sucesso!'
            );

            formReserva.reset();

            nomeInput.value =
                usuario.nome;

            ocupacaoSelect.value =
                usuario.tipo_usuario;

            outraAtividade.style.display =
                'none';

            atualizarResumo();

            localStorage.removeItem(CHAVE_RASCUNHO_AGENDA);

        } else {

            alert(
                resultado.mensagem
            );

        }

    } catch (erro) {

        console.error(erro);

        alert(
            'Erro ao conectar com o servidor.'
        );

    }

});

const CHAVE_RASCUNHO_AGENDA = 'rascunho_agenda';

function salvarRascunho() {

    const rascunho = {
        atividade: atividade.value,
        atividadePersonalizada: document.getElementById('atividadePersonalizada').value,
        dataReserva: dataReserva.value,
        horarioInicio: horarioInicio.value,
        duracao: duracao.value
    };

    localStorage.setItem(CHAVE_RASCUNHO_AGENDA, JSON.stringify(rascunho));

}

function restaurarRascunho() {

    const salvo = localStorage.getItem(CHAVE_RASCUNHO_AGENDA);

    if (!salvo) return;

    const rascunho = JSON.parse(salvo);

    atividade.value = rascunho.atividade || '';

    if (rascunho.atividade === 'Outro') {
        outraAtividade.style.display = 'flex';
        document.getElementById('atividadePersonalizada').value =
            rascunho.atividadePersonalizada || '';
    }

    dataReserva.value = rascunho.dataReserva || '';
    horarioInicio.value = rascunho.horarioInicio || '';
    duracao.value = rascunho.duracao || '1';

    atualizarResumo();

}

[atividade, dataReserva, horarioInicio, duracao].forEach((campo) => {
    campo.addEventListener('change', salvarRascunho);
});

document.getElementById('atividadePersonalizada')
    .addEventListener('input', salvarRascunho);

restaurarRascunho();
