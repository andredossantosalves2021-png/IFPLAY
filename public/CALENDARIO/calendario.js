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

    // Desenha o calendário na hora, sem esperar a API responder.
    // Assim a tela nunca fica com conteúdo quebrado/desatualizado
    // enquanto o fetch ainda está em andamento.
    gerarCalendario(anoAtual, mesAtual);

    try {

        const resposta =
            await fetch('http://localhost:3333/reservas');

        const resultado =
            await resposta.json();

        if (!resultado.sucesso) {
            console.error(resultado.mensagem);
            return;
        }

        reservas = {};

        resultado.reservas.forEach(reserva => {

            const partes =
                reserva.data_reserva.split('-');

            const chave =
                `${partes[0]}-${Number(partes[1]) - 1}-${Number(partes[2])}`;

            if (!reservas[chave]) {
                reservas[chave] = [];
            }

            reservas[chave].push({
                esporte: reserva.modalidade,
                horario: `${reserva.horario_inicio} - ${reserva.horario_fim}`,
                usuario: reserva.usuario.nome,
                tipo: reserva.tipo_reserva
            });

        });

        gerarCalendario(anoAtual, mesAtual);

    } catch (erro) {
        console.error('Erro ao carregar reservas:', erro);
    }

}

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

    const hoje = new Date();

    for (let dia = 1; dia <= totalDias; dia++) {

        const celula = document.createElement('div');
        celula.className = 'day';

        const ehHoje =
            dia === hoje.getDate() &&
            mes === hoje.getMonth() &&
            ano === hoje.getFullYear();

        if (ehHoje) {
            celula.classList.add('hoje');
        }

        const numero = document.createElement('strong');
        numero.textContent = dia;
        celula.appendChild(numero);

        const chave = `${ano}-${mes}-${dia}`;
        const reservasDoDia = reservas[chave];

        if (reservasDoDia) {

            reservasDoDia.slice(0, 2).forEach(reserva => {
                const tag = document.createElement('div');
                const classeTipo = reserva.tipo === 'AULA' ? 'tag-aula'
                    : reserva.tipo === 'EVENTO' ? 'tag-evento'
                        : 'tag-jogo';
                tag.className = `reservation ${classeTipo}`;
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

function abrirDetalhes(dia, ano, mes, reservasDoDia) {

    const modalExistente = document.querySelector('.modal-overlay');
    if (modalExistente) modalExistente.remove();

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';

    const modal = document.createElement('div');
    modal.className = 'modal-detalhes';

    const titulo = document.createElement('h3');
    titulo.textContent = `${dia} de ${meses[mes]} de ${ano}`;
    modal.appendChild(titulo);

    if (reservasDoDia && reservasDoDia.length > 0) {

        reservasDoDia.forEach(reserva => {
            const item = document.createElement('div');
            const classeTipo = reserva.tipo === 'AULA' ? 'tag-aula'
                : reserva.tipo === 'EVENTO' ? 'tag-evento'
                    : 'tag-jogo';
            item.className = `reservation-item ${classeTipo}`;
            item.innerHTML = `
                <span style="font-size: 17px; color: #610303"> <strong> ${reserva.usuario}</strong> </span> <br>
                <strong>${reserva.esporte}</strong> <span class="tipo-label">${reserva.tipo}</span><br>
                ${reserva.horario}<br>
                
            `;
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

carregarReservas();