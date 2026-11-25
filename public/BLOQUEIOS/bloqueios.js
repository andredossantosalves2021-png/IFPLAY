// Tela de bloqueios de horário (administrador).

const form = document.getElementById('formBloqueio');
const dataInicio = document.getElementById('dataInicio');
const dataFim = document.getElementById('dataFim');
const diaInteiro = document.getElementById('diaInteiro');
const horarioInicio = document.getElementById('horarioInicio');
const horarioFim = document.getElementById('horarioFim');
const motivo = document.getElementById('motivo');
const lista = document.getElementById('lista');
const botaoBloquear = form.querySelector('button[type="submit"]');

function hojeLocal() {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

dataInicio.min = hojeLocal();
dataFim.min = hojeLocal();

dataInicio.addEventListener('change', () => {
    dataFim.min = dataInicio.value || hojeLocal();
    if (!dataFim.value || dataFim.value < dataInicio.value) {
        dataFim.value = dataInicio.value;
    }
});

function atualizarCamposHorario() {
    document.querySelectorAll('.campo-horario').forEach((campo) => {
        campo.hidden = diaInteiro.checked;
    });
}

diaInteiro.addEventListener('change', atualizarCamposHorario);
atualizarCamposHorario();

function descreverPeriodo(b) {

    const datas = b.data_inicio === b.data_fim
        ? formatarData(b.data_inicio)
        : formatarData(b.data_inicio) + ' a ' + formatarData(b.data_fim);

    const horario = b.horario_inicio
        ? ', das ' + String(b.horario_inicio).slice(0, 5) + ' às ' + String(b.horario_fim).slice(0, 5)
        : ' (dia inteiro)';

    return datas + horario;
}

async function carregar() {

    const { ok, dados } = await chamarApi('/bloqueios');

    lista.innerHTML = '';

    if (!ok) {
        lista.appendChild(Object.assign(document.createElement('p'), {
            className: 'vazio',
            textContent: dados.mensagem || 'Não foi possível carregar os bloqueios.'
        }));
        return;
    }

    const bloqueios = dados.bloqueios || [];

    if (bloqueios.length === 0) {
        lista.appendChild(Object.assign(document.createElement('p'), {
            className: 'vazio',
            textContent: 'Nenhum bloqueio ativo. A quadra está livre para reservas.'
        }));
        return;
    }

    bloqueios.forEach((b) => {

        const item = document.createElement('div');
        item.className = 'item bloqueio';

        const info = document.createElement('div');
        info.className = 'item-info';

        const titulo = document.createElement('strong');
        titulo.textContent = descreverPeriodo(b);

        const texto = document.createElement('p');
        texto.textContent = 'Motivo: ' + b.motivo;

        info.appendChild(titulo);
        info.appendChild(texto);

        const acoes = document.createElement('div');
        acoes.className = 'item-acoes';

        const remover = document.createElement('button');
        remover.type = 'button';
        remover.className = 'botao botao-pequeno botao-secundario';
        remover.textContent = 'Remover bloqueio';

        remover.addEventListener('click', async () => {

            const certeza = await confirmar({
                titulo: 'Remover este bloqueio?',
                texto: 'O horário volta a aceitar reservas. As reservas que foram canceladas por causa dele continuam canceladas.',
                botao: 'Remover'
            });
            if (!certeza) return;

            const resposta = await chamarApi('/bloqueios/' + b.id_bloqueio, { method: 'DELETE' });
            mostrarAviso(resposta.ok ? 'Bloqueio removido.' : (resposta.dados.mensagem || 'Não foi possível remover.'), resposta.ok ? 'sucesso' : 'erro');
            carregar();
        });

        acoes.appendChild(remover);
        item.appendChild(info);
        item.appendChild(acoes);
        lista.appendChild(item);
    });
}

async function enviarBloqueio(confirmado) {

    return chamarApi('/bloqueios', {
        method: 'POST',
        body: JSON.stringify({
            data_inicio: dataInicio.value,
            data_fim: dataFim.value || dataInicio.value,
            dia_inteiro: diaInteiro.checked,
            horario_inicio: horarioInicio.value,
            horario_fim: horarioFim.value,
            motivo: motivo.value.trim(),
            confirmar: confirmado
        })
    });
}

form.addEventListener('submit', async (e) => {

    e.preventDefault();

    if (!dataFim.value) {
        dataFim.value = dataInicio.value;
    }

    botaoBloquear.disabled = true;

    try {

        let resposta = await enviarBloqueio(false);

        // Há reservas no período: mostra quais serão canceladas e pede confirmação
        if (resposta.ok && resposta.dados.precisa_confirmar) {

            const afetadas = resposta.dados.afetadas || [];

            const certeza = await confirmar({
                titulo: afetadas.length === 1
                    ? '1 reserva será cancelada'
                    : afetadas.length + ' reservas serão canceladas',
                texto: 'Quem reservou recebe um aviso com o motivo do bloqueio.',
                itens: afetadas.map((r) =>
                    formatarData(r.data) + ', ' + r.horario + ' · ' + r.modalidade + ' · ' + r.nome +
                    (r.status === 'PENDENTE' ? ' (pendente)' : '')
                ),
                botao: 'Bloquear e cancelar',
                perigo: true
            });

            if (!certeza) return;

            resposta = await enviarBloqueio(true);
        }

        if (!resposta.ok) {
            mostrarAviso(resposta.dados.mensagem || 'Não foi possível criar o bloqueio.', 'erro');
            return;
        }

        const canceladas = resposta.dados.reservas_canceladas || 0;

        mostrarAviso(
            canceladas > 0
                ? 'Horário bloqueado. ' + canceladas + (canceladas === 1 ? ' reserva cancelada.' : ' reservas canceladas.')
                : 'Horário bloqueado.',
            'sucesso'
        );

        motivo.value = '';
        carregar();

    } finally {
        botaoBloquear.disabled = false;
    }
});

carregar();
