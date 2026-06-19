const usuario =
    JSON.parse(
        localStorage.getItem('usuario')
    );

if (!usuario) {
    window.location.href =
        '../LOGIN/index.html';
}



const atividade =
    document.getElementById(
        'atividade'
    );

const outraAtividade =
    document.getElementById(
        'outraAtividade'
    );

atividade.addEventListener(
    'change',
    () => {

        if (atividade.value === 'Outro') {
            outraAtividade.style.display = 'flex';
        } else {
            outraAtividade.style.display = 'none';
        }
    }
);



const dataReserva =
    document.getElementById(
        'dataReserva'
    );

const hoje =
    new Date();

const anoAtual =
    hoje.getFullYear();

dataReserva.min =
    `${anoAtual}-01-01`;

dataReserva.max =
    `${anoAtual + 1}-12-31`;



const nomeInput =
    document.getElementById(
        'nome'
    );

const ocupacaoSelect =
    document.getElementById(
        'ocupacao'
    );

nomeInput.value =
    usuario.nome;

ocupacaoSelect.value =
    usuario.tipo_usuario;



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

if (
    usuario.tipo_usuario === 'ALUNO'
) {

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



if (localStorage.getItem('tema') === 'true') {
    document.documentElement.classList.add('dark-mode');
}



const horarioInicio =
    document.getElementById(
        'horarioInicio'
    );

const duracao =
    document.getElementById(
        'duracao'
    );

const resumoReserva =
    document.getElementById(
        'resumoReserva'
    );




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
        document.createElement(
            'option'
        );

    option.value =
        horario;

    option.textContent =
        horario;

    horarioInicio.appendChild(
        option
    );
}




function atualizarResumo() {

    const inicio =
        horarioInicio.value;

    const horas =
        Number(
            duracao.value
        );

    const horaInicial =
        Number(
            inicio.split(':')[0]
        );

    let horaFinal =
        horaInicial + horas;

    if (
        horaFinal > 23
    ) {
        horaFinal = 23;
    }

    const final =
        String(
            horaFinal
        ).padStart(
            2,
            '0'
        ) + ':00';

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
