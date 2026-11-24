// Histórico de reservas (só administrador)

const usuario = JSON.parse(localStorage.getItem('usuario') || 'null');

if (!usuario) {
    window.location.href = '/index.html';
}

if (!usuario || usuario.tipo_usuario !== 'ADMINISTRADOR') {
    document.body.innerHTML =
        '<p style="padding:40px;text-align:center;font-family:Arial,sans-serif;">' +
        'Acesso restrito a administradores.</p>';
    throw new Error('Acesso negado');
}

if (localStorage.getItem('tema') === 'true') {
    document.documentElement.classList.add('dark-mode');
}

// ---------- Textos ----------

const TIPO_RESERVA = {
    JOGO_LIVRE: 'Jogo livre',
    AULA: 'Aula',
    EVENTO: 'Evento'
};

const TIPO_USUARIO = {
    ALUNO: 'Aluno',
    PROFESSOR: 'Professor/Servidor',
    ADMINISTRADOR: 'Administrador'
};

const SELO = {
    OK: 'Tudo certo',
    PROBLEMA: 'Problema relatado',
    SEM_RESPOSTA: 'Sem avaliação'
};

const ESTADO_QUADRA = {
    LIMPA: 'Limpa e organizada',
    ACEITAVEL: 'Aceitável',
    SUJA: 'Suja ou desorganizada'
};

const NOME_ITEM = {
    piso: 'Piso da quadra',
    rede_volei: 'Rede de vôlei',
    tabelas_basquete: 'Tabelas de basquete',
    gols_redes: 'Gols e redes',
    bolas_materiais: 'Bolas e materiais',
    mesas_cadeiras: 'Mesas e cadeiras'
};

const NIVEL_ITEM = {
    OK: 'Bom',
    PROBLEMA: 'Com problema',
    NAO_USEI: 'Não usou'
};

// ---------- Elementos ----------

const formulario = document.getElementById('filtros');
const campoBusca = document.getElementById('busca');
const campoDe = document.getElementById('de');
const campoAte = document.getElementById('ate');
const campoTipo = document.getElementById('tipo');
const campoProblemas = document.getElementById('somenteProblemas');
const botaoLimpar = document.getElementById('btnLimpar');
const botaoMais = document.getElementById('btnMais');
const lista = document.getElementById('lista');
const resumo = document.getElementById('resumo');

let paginaAtual = 1;
let carregando = false;

// ---------- Funções de apoio ----------

// Cria um elemento com texto seguro (nunca interpreta HTML).
function criar(tag, classe, texto) {
    const el = document.createElement(tag);
    if (classe) el.className = classe;
    if (texto !== undefined && texto !== null) el.textContent = texto;
    return el;
}

function formatarData(dataISO) {
    if (!dataISO) return '';
    const [ano, mes, dia] = String(dataISO).slice(0, 10).split('-');
    return dia + '/' + mes + '/' + ano;
}

function formatarHora(hora) {
    return hora ? String(hora).slice(0, 5) : '';
}

function limparLista() {
    lista.innerHTML = '';
}

function mostrarMensagem(texto, classe) {
    limparLista();
    lista.appendChild(criar('p', classe, texto));
}

// ---------- Montagem de cada reserva ----------

function montarDetalhes(reserva) {

    const caixa = criar('div', 'detalhes');
    caixa.hidden = true;

    const feedback = reserva.feedback;

    if (!feedback) {
        caixa.appendChild(criar('p', null, 'O aluno ainda não respondeu a avaliação desta reserva.'));
        return caixa;
    }

    caixa.appendChild(criar('h3', null, 'Como encontrou a quadra'));
    caixa.appendChild(criar('p', null, ESTADO_QUADRA[feedback.estado_ao_chegar] || feedback.estado_ao_chegar));

    caixa.appendChild(criar('h3', null, 'Deixou a quadra organizada?'));
    caixa.appendChild(criar('p', null, feedback.deixou_organizada ? 'Sim' : 'Não'));

    caixa.appendChild(criar('h3', null, 'Estrutura e materiais'));

    const itens = criar('ul', 'itens-lista');

    Object.keys(NOME_ITEM).forEach(function (chave) {
        const nivel = (feedback.itens && feedback.itens[chave]) || 'NAO_USEI';
        const li = criar('li');
        li.appendChild(criar('span', null, NOME_ITEM[chave]));
        li.appendChild(criar('span', 'chip chip-' + nivel, NIVEL_ITEM[nivel] || nivel));
        itens.appendChild(li);
    });

    caixa.appendChild(itens);

    if (feedback.observacao) {
        caixa.appendChild(criar('h3', null, 'Comentário do aluno'));
        caixa.appendChild(criar('p', 'observacao', feedback.observacao));
    }

    if (reserva.reserva_anterior) {

        const anterior = reserva.reserva_anterior;

        caixa.appendChild(criar('h3', null, 'Reserva logo antes desta'));
        caixa.appendChild(criar(
            'p',
            'anterior',
            (anterior.nome || 'Nome não encontrado') + ' — ' +
            formatarData(anterior.data_reserva) + ', ' +
            formatarHora(anterior.horario_inicio) + ' às ' +
            formatarHora(anterior.horario_fim) +
            '. É só um contexto: não indica quem causou o problema.'
        ));
    }

    return caixa;
}

function montarItem(reserva) {

    const item = criar('article', 'item avaliacao-' + reserva.avaliacao);

    const topo = criar('div', 'item-topo');

    const data = criar('div', 'item-data');
    data.appendChild(criar('strong', null, formatarData(reserva.data_reserva)));
    data.appendChild(criar(
        'span',
        null,
        formatarHora(reserva.horario_inicio) + ' – ' + formatarHora(reserva.horario_fim)
    ));
    topo.appendChild(data);

    topo.appendChild(criar('span', 'selo selo-' + reserva.avaliacao, SELO[reserva.avaliacao]));
    item.appendChild(topo);

    const quem = criar('p', 'item-quem', reserva.usuario ? reserva.usuario.nome : 'Usuário removido');

    if (reserva.usuario) {
        const extra = [];
        if (reserva.usuario.ra) extra.push('RA ' + reserva.usuario.ra);
        extra.push(TIPO_USUARIO[reserva.usuario.tipo_usuario] || reserva.usuario.tipo_usuario);
        quem.appendChild(criar('small', null, extra.join(' · ')));
    }

    item.appendChild(quem);

    item.appendChild(criar(
        'p',
        'item-tipo',
        (reserva.modalidade || '') + ' · ' + (TIPO_RESERVA[reserva.tipo_reserva] || reserva.tipo_reserva || '')
    ));

    const detalhes = montarDetalhes(reserva);

    const botao = criar('button', 'btn-detalhes', 'Ver avaliação ▾');
    botao.type = 'button';
    botao.setAttribute('aria-expanded', 'false');

    botao.addEventListener('click', function () {
        const abrir = detalhes.hidden;
        detalhes.hidden = !abrir;
        botao.setAttribute('aria-expanded', String(abrir));
        botao.textContent = abrir ? 'Ocultar avaliação ▴' : 'Ver avaliação ▾';
    });

    item.appendChild(botao);
    item.appendChild(detalhes);

    return item;
}

// ---------- Busca no servidor ----------

function montarUrl(pagina) {

    const params = new URLSearchParams();

    params.set('pagina', pagina);
    params.set('limite', 20);

    if (campoBusca.value.trim()) params.set('busca', campoBusca.value.trim());
    if (campoDe.value) params.set('de', campoDe.value);
    if (campoAte.value) params.set('ate', campoAte.value);
    if (campoTipo.value) params.set('tipo', campoTipo.value);
    if (campoProblemas.checked) params.set('somente_problemas', '1');

    return '/historico?' + params.toString();
}

async function carregar(pagina) {

    if (carregando) return;
    carregando = true;

    botaoMais.disabled = true;

    if (pagina === 1) {
        resumo.textContent = 'Carregando...';
    }

    try {

        const resposta = await fetch(montarUrl(pagina));
        const resultado = await resposta.json();

        if (!resultado.sucesso) {
            resumo.textContent = '';
            botaoMais.hidden = true;
            mostrarMensagem(resultado.mensagem || 'Erro ao carregar o histórico.', 'erro');
            return;
        }

        if (pagina === 1) {
            limparLista();

            if (resultado.feedback_indisponivel) {
                lista.appendChild(criar(
                    'p',
                    'aviso-tabela',
                    'As avaliações ainda não estão ativas (falta rodar o arquivo sql/feedback.sql no Supabase). O histórico abaixo mostra só as reservas.'
                ));
            }
        }

        paginaAtual = pagina;

        resultado.reservas.forEach(function (reserva) {
            lista.appendChild(montarItem(reserva));
        });

        if (resultado.total === 0) {
            resumo.textContent = '';
            mostrarMensagem('Nenhuma reserva encontrada com esses filtros.', 'vazio');
            botaoMais.hidden = true;
            return;
        }

        const mostrando = Math.min(paginaAtual * resultado.limite, resultado.total);

        resumo.textContent =
            'Mostrando ' + mostrando + ' de ' + resultado.total +
            (resultado.total === 1 ? ' reserva.' : ' reservas.');

        botaoMais.hidden = !resultado.tem_mais;

    } catch (erro) {

        console.error(erro);
        resumo.textContent = '';
        botaoMais.hidden = true;
        mostrarMensagem('Erro ao carregar o histórico. Tente de novo.', 'erro');

    } finally {

        carregando = false;
        botaoMais.disabled = false;
    }
}

// ---------- Eventos ----------

formulario.addEventListener('submit', function (evento) {
    evento.preventDefault();
    carregar(1);
});

botaoLimpar.addEventListener('click', function () {
    formulario.reset();
    carregar(1);
});

botaoMais.addEventListener('click', function () {
    carregar(paginaAtual + 1);
});

carregar(1);
