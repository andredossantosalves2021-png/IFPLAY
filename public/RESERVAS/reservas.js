const listaReservas =
    document.getElementById('listaReservas');

if (localStorage.getItem('tema') === 'true') {
    document.documentElement.classList.add('dark-mode');
}

async function carregarReservas() {

    try {

        const resposta =
            await fetch('http://localhost:3333/reservas');

        const resultado =
            await resposta.json();

        if (!resultado.sucesso) {
            listaReservas.innerHTML = `<p>${resultado.mensagem}</p>`;
            return;
        }

        renderizarReservas(resultado.reservas);

    } catch (erro) {

        console.error(erro);

        listaReservas.innerHTML =
            '<p>Erro ao carregar reservas.</p>';

    }

}

function renderizarReservas(reservas) {

    if (reservas.length === 0) {
        listaReservas.innerHTML =
            '<p>Nenhuma reserva ativa no momento.</p>';
        return;
    }

    listaReservas.innerHTML =
        reservas.map((reserva) => {

            const classeStatus =
                reserva.status === 'PENDENTE'
                    ? 'pendente'
                    : 'ativo';

            const nomeUsuario =
                reserva.usuario?.nome ?? 'Usuário';

            return `
                <div class="reserva-item">
                    <span class="badge ${classeStatus}">${reserva.status}</span>
                    <strong>${reserva.modalidade}</strong>
                    <p>Data: ${reserva.data_reserva}</p>
                    <p>Horário: ${reserva.horario_inicio} às ${reserva.horario_fim}</p>
                    <p>Reservado por: ${nomeUsuario}</p>
                </div>
            `;

        }).join('');

}

carregarReservas();

setInterval(carregarReservas, 60000);
