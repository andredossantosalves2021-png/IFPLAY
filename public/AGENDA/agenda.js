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

// SALVAR RESERVA

formReserva.addEventListener(
    'submit',
    async (e) => {

        e.preventDefault();

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

        const modalidade =
            atividade.value === 'Outro'
                ? document.getElementById('atividadePersonalizada').value
                : atividade.value;

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
                            'JOGO_LIVRE',

                        recorrente:
                            checkbox.checked,

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

    }
);