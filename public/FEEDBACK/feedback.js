// Questionário que o aluno responde depois que a reserva termina

const usuario = JSON.parse(localStorage.getItem('usuario') || 'null');

if (!usuario) {
    window.location.href = '/index.html';
    throw new Error('Sem login');
}

if (localStorage.getItem('tema') === 'true') {
    document.documentElement.classList.add('dark-mode');
}

// ---------- Perguntas (mesmas chaves que o servidor aceita) ----------

const ESTADOS = [
    { valor: 'LIMPA', texto: 'Limpa e organizada', classe: '' },
    { valor: 'ACEITAVEL', texto: 'Aceitável', classe: '' },
    { valor: 'SUJA', texto: 'Suja ou desorganizada', classe: 'ruim' }
];

const ITENS = [
    { chave: 'piso', texto: 'Piso da quadra' },
    { chave: 'rede_volei', texto: 'Rede de vôlei' },
    { chave: 'tabelas_basquete', texto: 'Tabelas de basquete' },
    { chave: 'gols_redes', texto: 'Gols e redes' },
    { chave: 'bolas_materiais', texto: 'Bolas e materiais' },
    { chave: 'mesas_cadeiras', texto: 'Mesas e cadeiras' }
];

const NIVEIS = [
    { valor: 'OK', texto: 'Bom', classe: 'ok' },
    { valor: 'PROBLEMA', texto: 'Com problema', classe: 'problema' },
    { valor: 'NAO_USEI', texto: 'Não usei', classe: 'nao' }
];

const TIPO_RESERVA = {
    JOGO_LIVRE: 'Jogo livre',
    AULA: 'Aula',
    EVENTO: 'Evento'
};

// ---------- Elementos ----------

const el = (id) => document.getElementById(id);

const telaCarregando = el('carregando');
const telaVazio = el('vazio');
const formulario = el('formFeedback');
const telaAgradecimento = el('agradecimento');
const resumoReserva = el('resumoReserva');
const campoObservacao = el('observacao');
const contador = el('contador');
const erroForm = el('erroForm');
const botaoEnviar = el('btnEnviar');

let pendentes = [];
let reservaAtual = null;

// ---------- Apoio ----------

function criar(tag, classe, texto) {
    const e = document.createElement(tag);
    if (classe) e.className = classe;
    if (texto !== undefined && texto !== null) e.textContent = texto;
    return e;
}

function formatarData(dataISO) {
    const [ano, mes, dia] = String(dataISO).slice(0, 10).split('-');
    return dia + '/' + mes + '/' + ano;
}

function formatarHora(hora) {
    return String(hora).slice(0, 5);
}

function mostrarSo(tela) {
    [telaCarregando, telaVazio, formulario, telaAgradecimento].forEach(function (t) {
        t.hidden = t !== tela;
    });
}

function mostrarErro(texto) {
    erroForm.textContent = texto;
    erroForm.hidden = false;
    erroForm.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function limparErro() {
    erroForm.hidden = true;
    document.querySelectorAll('.pergunta.com-erro').forEach(function (p) {
        p.classList.remove('com-erro');
    });
}

// Cria um botão de escolha (radio escondido + texto estilizado).
function criarOpcao(nome, valor, texto, classeOpcao, classeExtra, marcado) {
    const rotulo = criar('label', classeOpcao + (classeExtra ? ' ' + classeExtra : ''));

    const radio = document.createElement('input');
    radio.type = 'radio';
    radio.name = nome;
    radio.value = valor;
    radio.checked = Boolean(marcado);

    rotulo.appendChild(radio);
    rotulo.appendChild(criar('span', null, texto));

    return rotulo;
}

function valorMarcado(nome) {
    const marcado = formulario.querySelector('input[name="' + nome + '"]:checked');
    return marcado ? marcado.value : null;
}

// ---------- Montagem do questionário ----------

function montarQuestionario() {

    const opcoesEstado = el('opcoesEstado');
    opcoesEstado.innerHTML = '';

    ESTADOS.forEach(function (estado) {
        opcoesEstado.appendChild(
            criarOpcao('estado', estado.valor, estado.texto, 'opcao', estado.classe, false)
        );
    });

    const listaItens = el('listaItens');
    listaItens.innerHTML = '';

    ITENS.forEach(function (item) {

        const linha = criar('div', 'item-linha');
        linha.appendChild(criar('span', 'item-nome', item.texto));

        const niveis = criar('div', 'niveis');

        NIVEIS.forEach(function (nivel) {
            niveis.appendChild(
                criarOpcao(
                    'item_' + item.chave,
                    nivel.valor,
                    nivel.texto,
                    'nivel',
                    nivel.classe,
                    nivel.valor === 'NAO_USEI'
                )
            );
        });

        linha.appendChild(niveis);
        listaItens.appendChild(linha);
    });

    const opcoesOrganizada = el('opcoesOrganizada');
    opcoesOrganizada.innerHTML = '';

    opcoesOrganizada.appendChild(criarOpcao('organizada', 'SIM', 'Sim', 'opcao', '', false));
    opcoesOrganizada.appendChild(criarOpcao('organizada', 'NAO', 'Não', 'opcao', 'ruim', false));
}

function abrirReserva(reserva) {

    reservaAtual = reserva;

    formulario.reset();
    contador.textContent = '0 / 300';
    limparErro();
    montarQuestionario();
    atualizarDicaComentario();

    resumoReserva.textContent =
        (reserva.modalidade || 'Quadra') + ' · ' +
        (TIPO_RESERVA[reserva.tipo_reserva] || 'Reserva') + ' · ' +
        formatarData(reserva.data_reserva) + ' · ' +
        formatarHora(reserva.horario_inicio) + ' às ' + formatarHora(reserva.horario_fim);

    mostrarSo(formulario);
    window.scrollTo(0, 0);
}

// Se alguma resposta indica problema, o campo de comentário pede detalhes.
function atualizarDicaComentario() {

    const temProblema =
        valorMarcado('estado') === 'SUJA' ||
        valorMarcado('organizada') === 'NAO' ||
        ITENS.some(function (i) { return valorMarcado('item_' + i.chave) === 'PROBLEMA'; });

    campoObservacao.placeholder = temProblema
        ? 'Conte o que aconteceu (ex.: rede rasgada, lixo no chão).'
        : 'Ex.: a quadra estava ótima.';
}

// ---------- Envio ----------

function lerResposta() {

    const estado = valorMarcado('estado');
    const organizada = valorMarcado('organizada');

    const itens = {};
    ITENS.forEach(function (i) {
        itens[i.chave] = valorMarcado('item_' + i.chave) || 'NAO_USEI';
    });

    return {
        id_reserva: reservaAtual.id_reserva,
        estado_ao_chegar: estado,
        itens: itens,
        deixou_organizada: organizada === null ? null : organizada === 'SIM',
        observacao: campoObservacao.value.trim()
    };
}

async function enviar(evento) {

    evento.preventDefault();
    limparErro();

    const resposta = lerResposta();

    if (!resposta.estado_ao_chegar) {
        el('perguntaEstado').classList.add('com-erro');
        mostrarErro('Responda a pergunta 1: como você encontrou a quadra?');
        return;
    }

    if (resposta.deixou_organizada === null) {
        el('perguntaOrganizada').classList.add('com-erro');
        mostrarErro('Responda a pergunta 3: você deixou a quadra organizada?');
        return;
    }

    botaoEnviar.disabled = true;
    botaoEnviar.textContent = 'Enviando...';

    try {

        const requisicao = await fetch('/feedbacks', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(resposta)
        });

        const resultado = await requisicao.json();

        // 409 = já tinha sido avaliada (por exemplo, em outra aba): trata como feito.
        if (!resultado.sucesso && requisicao.status !== 409) {
            mostrarErro(resultado.mensagem || 'Não foi possível enviar. Tente de novo.');
            return;
        }

        pendentes = pendentes.filter(function (p) {
            return String(p.id_reserva) !== String(reservaAtual.id_reserva);
        });

        // Avisa o dashboard para atualizar o contador de avaliações.
        try {
            window.parent.postMessage({ tipo: 'ifplay-feedback-enviado' }, window.location.origin);
        } catch (e) { /* sem dashboard em volta: tudo bem */ }

        mostrarAgradecimento();

    } catch (erro) {

        console.error(erro);
        mostrarErro('Erro de conexão. Tente de novo.');

    } finally {

        botaoEnviar.disabled = false;
        botaoEnviar.textContent = 'Enviar avaliação';
    }
}

function mostrarAgradecimento() {

    const botaoProxima = el('btnProxima');

    if (pendentes.length > 0) {
        botaoProxima.hidden = false;
        botaoProxima.textContent =
            pendentes.length === 1
                ? 'Avaliar a próxima reserva (falta 1)'
                : 'Avaliar a próxima reserva (faltam ' + pendentes.length + ')';
    } else {
        botaoProxima.hidden = true;
    }

    mostrarSo(telaAgradecimento);
    window.scrollTo(0, 0);
}

// ---------- Início ----------

async function iniciar() {

    try {

        const requisicao = await fetch(
            '/feedbacks/pendentes'
        );

        const resultado = await requisicao.json();

        if (!resultado.sucesso) {
            mostrarSo(telaCarregando);
            telaCarregando.textContent = resultado.mensagem || 'Erro ao carregar.';
            return;
        }

        pendentes = resultado.pendentes;

        if (pendentes.length === 0) {
            mostrarSo(telaVazio);
            return;
        }

        // ?reserva=ID abre direto aquela reserva; senão, a mais recente.
        const pedida = new URLSearchParams(window.location.search).get('reserva');

        const escolhida =
            pendentes.find(function (p) { return String(p.id_reserva) === pedida; }) ||
            pendentes[0];

        abrirReserva(escolhida);

    } catch (erro) {

        console.error(erro);
        telaCarregando.hidden = false;
        telaCarregando.textContent = 'Erro ao carregar. Tente de novo.';
    }
}

formulario.addEventListener('submit', enviar);

formulario.addEventListener('change', function () {
    limparErro();
    atualizarDicaComentario();
});

campoObservacao.addEventListener('input', function () {
    contador.textContent = campoObservacao.value.length + ' / 300';
});

el('btnDepois').addEventListener('click', function () {
    window.location.href = '../CALENDARIO/calendario.html';
});

el('btnProxima').addEventListener('click', function () {
    abrirReserva(pendentes[0]);
});

iniciar();
