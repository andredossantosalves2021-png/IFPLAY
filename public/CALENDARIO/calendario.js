const meses = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

let dataAtual = new Date();
let anoAtual = dataAtual.getFullYear();
let mesAtual = dataAtual.getMonth();

// DADOS DE EXEMPLO — depois substituir por uma busca real no Supabase
// Formato da chave: 'ano-mes-dia' (mes começa em 0 = Janeiro)
const reservasExemplo = {
    '2026-4-2': [
        { esporte: 'Futebol', horario: '14:00' }
    ],
    '2026-4-10': [
        { esporte: 'Vôlei', horario: '09:00' },
        { esporte: 'Basquete', horario: '16:00' },
        { esporte: 'Futsal', horario: '18:00' }
    ]
};

const tituloMes = document.querySelector('.calendar-controls h2');
const grid = document.querySelector('.calendar-grid');
const btnAnterior = document.querySelector('.calendar-controls button:first-child');
const btnProximo = document.querySelector('.calendar-controls button:last-child');

function gerarCalendario(ano, mes) {
    grid.innerHTML = '';
    tituloMes.textContent = `${meses[mes]} ${ano}`;

    const primeiroDiaSemana = new Date(ano, mes, 1).getDay();
    const totalDias = new Date(ano, mes + 1, 0).getDate();

    for (let i = 0; i < primeiroDiaSemana; i++) {
        const vazio = document.createElement('div');
        vazio.className = 'day empty';
        grid.appendChild(vazio);
    }

    for (let dia = 1; dia <= totalDias; dia++) {
        const celula = document.createElement('div');
        celula.className = 'day';

        const numero = document.createElement('strong');
        numero.textContent = dia;
        celula.appendChild(numero);

        const chave = `${ano}-${mes}-${dia}`;
        const reservasDoDia = reservasExemplo[chave];

        if (reservasDoDia) {
            reservasDoDia.slice(0, 2).forEach(reserva => {
                const tag = document.createElement('div');
                tag.className = 'reservation';
                tag.textContent = `${reserva.esporte} • ${reserva.horario}`;
                celula.appendChild(tag);
            });

            if (reservasDoDia.length > 2) {
                const mais = document.createElement('div');
                mais.className = 'reservation-mais';
                mais.textContent = `+${reservasDoDia.length - 2} mais`;
                celula.appendChild(mais);
            }
        }

        celula.addEventListener('click', () => abrirDetalhes(dia, ano, mes, reservasDoDia));
        grid.appendChild(celula);
    }
}

function abrirDetalhes(dia, ano, mes, reservas) {
    const modalExistente = document.querySelector('.modal-overlay');
    if (modalExistente) modalExistente.remove();

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';

    const modal = document.createElement('div');
    modal.className = 'modal-detalhes';

    const titulo = document.createElement('h3');
    titulo.textContent = `${dia} de ${meses[mes]} de ${ano}`;
    modal.appendChild(titulo);

    if (reservas && reservas.length > 0) {
        reservas.forEach(reserva => {
            const item = document.createElement('div');
            item.className = 'reservation-item';
            item.textContent = `${reserva.esporte} • ${reserva.horario}`;
            modal.appendChild(item);
        });
    } else {
        const vazio = document.createElement('p');
        vazio.className = 'sem-reservas';
        vazio.textContent = 'Nenhuma reserva nesse dia.';
        modal.appendChild(vazio);
    }

    const btnFechar = document.createElement('button');
    btnFechar.className = 'btn-fechar-modal';
    btnFechar.textContent = 'Fechar';
    btnFechar.addEventListener('click', () => overlay.remove());
    modal.appendChild(btnFechar);

    overlay.appendChild(modal);
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) overlay.remove();
    });

    document.body.appendChild(overlay);
}

btnAnterior.addEventListener('click', () => {
    mesAtual--;
    if (mesAtual < 0) {
        mesAtual = 11;
        anoAtual--;
    }
    gerarCalendario(anoAtual, mesAtual);
});

btnProximo.addEventListener('click', () => {
    mesAtual++;
    if (mesAtual > 11) {
        mesAtual = 0;
        anoAtual++;
    }
    gerarCalendario(anoAtual, mesAtual);
});

gerarCalendario(anoAtual, mesAtual);