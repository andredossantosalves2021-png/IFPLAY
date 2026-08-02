const usuario =
    JSON.parse(localStorage.getItem('usuario'));

if (!usuario) {
    window.location.href = '../LOGIN/index.html';
}

const listaReservas =
    document.getElementById('listaReservas');

const botoesFiltro =
    document.querySelectorAll('.filtro-btn');

const btnPendentes =
    document.getElementById('btnPendentes');

let filtroAtual = 'geral';

if (localStorage.getItem('tema') === 'true') {
    document.documentElement.classList.add('dark-mode');
}

if (usuario.tipo_usuario === 'ADMINISTRADOR') {
    btnPendentes.style.display = 'inline-block';
}

async function carregarReservas() {

    try {

        let url =
            `http://localhost:3333/reservas?filtro=${filtroAtual}`;

        if (filtroAtual === 'minhas') {
            url += `&id_usuario=${usuario.id_usuario}`;
        }

        const resposta = await fetch(url);
        const resultado = await resposta.json();

        if (!resultado.sucesso) {
            listaReservas.innerHTML = `<p>${resultado.mensagem}</p>`;
            return;
        }

        renderizarReservas(resultado.reservas);

    } catch (erro) {
        console.error(erro);
        listaReservas.innerHTML = '<p>Erro ao carregar reservas.</p>';
    }

}

function renderizarReservas(reservas) {

    listaReservas.innerHTML = '';

    if (reservas.length === 0) {
        listaReservas.innerHTML = '<p>Nenhuma reserva encontrada.</p>';
        return;
    }

    const grupos = {};
    const individuais = [];

    reservas.forEach((reserva) => {

        if (reserva.id_recorrencia) {

            if (!grupos[reserva.id_recorrencia]) {
                grupos[reserva.id_recorrencia] = [];
            }

            grupos[reserva.id_recorrencia].push(reserva);

        } else {

            individuais.push(reserva);

        }

    });

    Object.values(grupos).forEach((ocorrencias) => {
        listaReservas.appendChild(criarCardGrupo(ocorrencias));
    });

    individuais.forEach((reserva) => {
        listaReservas.appendChild(criarCardIndividual(reserva));
    });

}

function criarCardIndividual(reserva) {

    const classeStatus =
        reserva.status === 'PENDENTE' ? 'pendente' : 'ativo';

    const classeBorda =
        reserva.status === 'PENDENTE' ? 'borda-pendente' : 'borda-aprovada';

    const nomeUsuario =
        reserva.usuario?.nome ?? 'Usuário';

    const item = document.createElement('div');
    item.className = `reserva-item ${classeBorda}`;

    item.innerHTML = `
        <span class="badge ${classeStatus}">${reserva.status}</span>
        <strong>${reserva.modalidade}</strong>
        <p>Data: ${reserva.data_reserva}</p>
        <p>Horário: ${reserva.horario_inicio} às ${reserva.horario_fim}</p>
        <p>Reservado por: ${nomeUsuario}</p>
    `;

    if (filtroAtual === 'pendentes' && usuario.tipo_usuario === 'ADMINISTRADOR') {

        const acoes = document.createElement('div');
        acoes.className = 'acoes-admin';

        const btnAprovar = document.createElement('button');
        btnAprovar.className = 'btn-aprovar';
        btnAprovar.textContent = 'Aprovar';
        btnAprovar.addEventListener('click', () =>
            atualizarStatus(reserva.id_reserva, 'APROVADA'));

        const btnCancelar = document.createElement('button');
        btnCancelar.className = 'btn-cancelar';
        btnCancelar.textContent = 'Cancelar';
        btnCancelar.addEventListener('click', () =>
            atualizarStatus(reserva.id_reserva, 'CANCELADA'));

        acoes.appendChild(btnAprovar);
        acoes.appendChild(btnCancelar);
        item.appendChild(acoes);

    } else if (filtroAtual === 'minhas') {

        const acoes = document.createElement('div');
        acoes.className = 'acoes-admin';

        const btnCancelar = document.createElement('button');
        btnCancelar.className = 'btn-cancelar';
        btnCancelar.textContent = 'Cancelar Reserva';
        btnCancelar.addEventListener('click', () => {
            if (confirm('Tem certeza que deseja cancelar essa reserva?')) {
                atualizarStatus(reserva.id_reserva, 'CANCELADA');
            }
        });

        acoes.appendChild(btnCancelar);
        item.appendChild(acoes);

    }

    return item;

}

function criarCardGrupo(ocorrencias) {

    const diasSemana = [
        'Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira',
        'Quinta-feira', 'Sexta-feira', 'Sábado'
    ];

    const primeira = ocorrencias[0];

    const [ano, mes, dia] = primeira.data_reserva.split('-').map(Number);
    const nomeDiaSemana = diasSemana[new Date(ano, mes - 1, dia).getDay()];

    const ativas =
        ocorrencias.filter((o) => o.status !== 'CANCELADA').length;

    const card = document.createElement('div');
    card.className = 'reserva-grupo';

    card.innerHTML = `
        <span class="tag-recorrente">RECORRENTE</span>
        <strong>${primeira.modalidade} (${primeira.tipo_reserva})</strong>
        <p>Toda ${nomeDiaSemana}, ${primeira.horario_inicio} às ${primeira.horario_fim}</p>
        <p>${ativas} de ${ocorrencias.length} ocorrências ativas</p>
        <p><em>Clique para ver os detalhes</em></p>
    `;

    card.addEventListener('click', () => abrirDetalhesGrupo(ocorrencias));

    return card;

}

function abrirDetalhesGrupo(ocorrencias) {

    const modalExistente = document.querySelector('.modal-overlay');
    if (modalExistente) modalExistente.remove();

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';

    const modal = document.createElement('div');
    modal.className = 'modal-detalhes';

    const titulo = document.createElement('h3');
    titulo.textContent = `${ocorrencias[0].modalidade} — Agendamento Recorrente`;
    modal.appendChild(titulo);

    const podeCancel =
        filtroAtual === 'minhas' || usuario.tipo_usuario === 'ADMINISTRADOR';

    ocorrencias
        .slice()
        .sort((a, b) => a.data_reserva.localeCompare(b.data_reserva))
        .forEach((ocorrencia) => {

            const classeOcorrencia =
                ocorrencia.status === 'CANCELADA' ? 'cancelada' :
                ocorrencia.status === 'APROVADA' ? 'aprovada' : '';

            const item = document.createElement('div');
            item.className = `ocorrencia-item ${classeOcorrencia}`;

            item.innerHTML = `
                <strong>${ocorrencia.data_reserva}</strong> - ${ocorrencia.status}<br>
                ${ocorrencia.horario_inicio} às ${ocorrencia.horario_fim}
            `;

            if (podeCancel && ocorrencia.status !== 'CANCELADA') {

                const btnCancelar = document.createElement('button');
                btnCancelar.className = 'btn-cancelar';
                btnCancelar.style.marginTop = '8px';
                btnCancelar.textContent = 'Cancelar esta data';
                btnCancelar.addEventListener('click', async () => {
                    if (confirm(`Cancelar a reserva de ${ocorrencia.data_reserva}?`)) {
                        overlay.remove();
                        await atualizarStatus(ocorrencia.id_reserva, 'CANCELADA');
                    }
                });

                item.appendChild(btnCancelar);

            }

            modal.appendChild(item);

        });

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

async function atualizarStatus(idReserva, novoStatus) {

    try {

        const resposta =
            await fetch(`http://localhost:3333/reservas/${idReserva}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    novoStatus,
                    id_usuario_acao: usuario.id_usuario
                })
            });

        const resultado = await resposta.json();

        if (!resultado.sucesso) {
            alert(resultado.mensagem);
            return;
        }

        carregarReservas();

    } catch (erro) {
        console.error(erro);
        alert('Erro ao atualizar a reserva.');
    }

}

botoesFiltro.forEach((botao) => {
    botao.addEventListener('click', () => {

        botoesFiltro.forEach((b) => b.classList.remove('ativo'));
        botao.classList.add('ativo');

        filtroAtual = botao.dataset.filtro;
        carregarReservas();

    });
});

carregarReservas();

setInterval(carregarReservas, 60000);