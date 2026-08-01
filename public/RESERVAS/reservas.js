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

    reservas.forEach((reserva) => {

        const classeStatus =
            reserva.status === 'PENDENTE' ? 'pendente' : 'ativo';

        const nomeUsuario =
            reserva.usuario?.nome ?? 'Usuário';

        const item = document.createElement('div');
        item.className = 'reserva-item';

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

        }

        listaReservas.appendChild(item);

    });

}

async function atualizarStatus(idReserva, novoStatus) {

    try {

        const resposta =
            await fetch(`http://localhost:3333/reservas/${idReserva}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    novoStatus,
                    id_usuario_admin: usuario.id_usuario
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