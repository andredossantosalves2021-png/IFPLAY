// Tela de usuários (administrador): cadastros pendentes e todos os usuários.
// Tudo que vem do banco é mostrado com textContent (nunca innerHTML).

const eu = JSON.parse(localStorage.getItem('usuario') || 'null');

const lista = document.getElementById('lista');
const painelTodos = document.getElementById('painelTodos');
const contadorPendentes = document.getElementById('contadorPendentes');
const busca = document.getElementById('busca');
const filtroTipo = document.getElementById('filtroTipo');
const filtroSituacao = document.getElementById('filtroSituacao');

const NOMES_TIPO = { ALUNO: 'Aluno', PROFESSOR: 'Professor', ADMINISTRADOR: 'Administrador' };
const NOMES_SITUACAO = { APROVADO: 'Ativa', DESATIVADO: 'Desativada', REJEITADO: 'Recusada', PENDENTE: 'Pendente' };

let usuarios = [];
let abaAtual = new URLSearchParams(window.location.search).get('aba') === 'todos' ? 'todos' : 'pendentes';

function criar(tag, classe, texto) {
    const el = document.createElement(tag);
    if (classe) el.className = classe;
    if (texto !== undefined) el.textContent = texto;
    return el;
}

function criarBotao(texto, classe, aoClicar) {
    const botao = criar('button', 'botao botao-pequeno ' + (classe || ''), texto);
    botao.type = 'button';
    botao.addEventListener('click', aoClicar);
    return botao;
}

function criarSelectTipo(valor) {
    const select = criar('select', 'select-pequeno');
    select.setAttribute('aria-label', 'Tipo de usuário');
    Object.keys(NOMES_TIPO).forEach((tipo) => {
        const opcao = criar('option', '', NOMES_TIPO[tipo]);
        opcao.value = tipo;
        select.appendChild(opcao);
    });
    select.value = valor;
    select.style.width = 'auto';
    return select;
}

function mostrarVazio(texto) {
    lista.innerHTML = '';
    lista.appendChild(criar('p', 'vazio', texto));
}

function trocarAba(aba) {

    abaAtual = aba;

    document.querySelectorAll('.aba').forEach((botao) => {
        const ativa = botao.dataset.aba === aba;
        botao.classList.toggle('ativa', ativa);
        botao.setAttribute('aria-selected', ativa ? 'true' : 'false');
    });

    painelTodos.hidden = aba !== 'todos';

    // Mantém a aba no endereço (o dashboard usa isso ao recarregar)
    const url = new URL(window.location.href);
    url.searchParams.set('aba', aba);
    history.replaceState(null, '', url.pathname + url.search);

    // Atualiza o endereço do dashboard (#usuarios / #usuarios-todos).
    // O endereço precisa ser montado a partir da página de cima: um "#..."
    // solto seria lido como relativo a esta tela, e não ao dashboard.
    try {
        const topo = window.top.location;
        if (window.top !== window && topo.pathname.toLowerCase() === '/dashboard/dashboard.html') {
            topo.replace(topo.pathname + topo.search + '#' + (aba === 'todos' ? 'usuarios-todos' : 'usuarios'));
        }
    } catch (e) { /* fora do dashboard: sem problema */ }

    renderizar();
}

async function carregar() {

    const { ok, dados } = await chamarApi('/usuarios');

    if (!ok) {
        mostrarVazio(dados.mensagem || 'Não foi possível carregar os usuários.');
        return;
    }

    usuarios = dados.usuarios || [];
    renderizar();
}

function renderizar() {

    const pendentes = usuarios.filter((u) => u.status_cadastro === 'PENDENTE');

    contadorPendentes.textContent = String(pendentes.length);
    contadorPendentes.hidden = pendentes.length === 0;

    lista.innerHTML = '';

    if (abaAtual === 'pendentes') {

        if (pendentes.length === 0) {
            mostrarVazio('Nenhum cadastro esperando aprovação.');
            return;
        }

        pendentes.forEach((u) => lista.appendChild(itemPendente(u)));
        return;
    }

    const termo = busca.value.trim().toLowerCase();

    const visiveis = usuarios.filter((u) =>
        u.status_cadastro !== 'PENDENTE' &&
        (!filtroTipo.value || u.tipo_usuario === filtroTipo.value) &&
        (!filtroSituacao.value || u.status_cadastro === filtroSituacao.value) &&
        (!termo ||
            String(u.nome).toLowerCase().includes(termo) ||
            String(u.ra || '').includes(termo) ||
            String(u.email).toLowerCase().includes(termo))
    );

    if (visiveis.length === 0) {
        mostrarVazio('Nenhum usuário encontrado com esses filtros.');
        return;
    }

    visiveis.forEach((u) => lista.appendChild(itemUsuario(u)));
}

function infoUsuario(u, extras) {

    const info = criar('div', 'item-info');
    const nome = criar('strong', '', u.nome);

    (extras || []).forEach((selo) => nome.appendChild(selo));

    info.appendChild(nome);
    info.appendChild(criar('p', '', u.ra ? 'RA: ' + u.ra : 'Sem RA (professor/servidor)'));
    info.appendChild(criar('p', '', 'E-mail: ' + u.email));

    return info;
}

function itemPendente(u) {

    const item = criar('div', 'item pendente');
    item.appendChild(infoUsuario(u));

    const acoes = criar('div', 'item-acoes');
    const select = criarSelectTipo(u.ra ? 'ALUNO' : 'PROFESSOR');

    acoes.appendChild(criar('span', 'rotulo', 'Aprovar como'));
    acoes.appendChild(select);

    acoes.appendChild(criarBotao('Aprovar', '', async () => {

        const tipo = select.value;

        if (tipo === 'ADMINISTRADOR') {
            const certeza = await confirmar({
                titulo: 'Aprovar como administrador?',
                texto: u.nome + ' poderá aprovar reservas, ver o histórico e gerenciar usuários.',
                botao: 'Aprovar como administrador'
            });
            if (!certeza) return;
        }

        const { ok, dados } = await chamarApi('/cadastros/' + u.id_usuario, {
            method: 'PATCH',
            body: JSON.stringify({ novoStatus: 'APROVADO', tipoUsuario: tipo })
        });

        mostrarAviso(ok ? u.nome + ' foi aprovado(a).' : (dados.mensagem || 'Não foi possível aprovar.'), ok ? 'sucesso' : 'erro');
        if (ok) carregar();
    }));

    acoes.appendChild(criarBotao('Recusar', 'botao-perigo', async () => {

        const certeza = await confirmar({
            titulo: 'Recusar cadastro?',
            texto: u.nome + ' não conseguirá entrar no IFPlay.',
            botao: 'Recusar',
            perigo: true
        });
        if (!certeza) return;

        const { ok, dados } = await chamarApi('/cadastros/' + u.id_usuario, {
            method: 'PATCH',
            body: JSON.stringify({ novoStatus: 'REJEITADO' })
        });

        mostrarAviso(ok ? 'Cadastro recusado.' : (dados.mensagem || 'Não foi possível recusar.'), ok ? 'sucesso' : 'erro');
        if (ok) carregar();
    }));

    item.appendChild(acoes);
    return item;
}

function itemUsuario(u) {

    const souEu = eu && Number(eu.id_usuario) === Number(u.id_usuario);
    const ativo = u.status_cadastro === 'APROVADO';

    const selos = [];
    if (souEu) selos.push(criar('span', 'selo selo-voce', 'Você'));
    if (!ativo) selos.push(criar('span', 'selo selo-desativado', NOMES_SITUACAO[u.status_cadastro] || u.status_cadastro));

    const item = criar('div', 'item' + (ativo ? '' : ' desativado'));
    item.appendChild(infoUsuario(u, selos));

    const acoes = criar('div', 'item-acoes');

    // Administradores (você ou outro) não têm a função alterada por aqui:
    // aparece só o nome da função, sem a lista.
    const ehAdmin = u.tipo_usuario === 'ADMINISTRADOR';

    if (ehAdmin) {

        const funcao = criar('span', 'selo', 'Administrador');
        funcao.title = souEu
            ? 'Você não pode mudar a sua própria função'
            : 'Um administrador não pode mudar a função de outro administrador';

        acoes.appendChild(funcao);
    }

    const select = criarSelectTipo(u.tipo_usuario);
    select.title = 'Mudar tipo';

    select.addEventListener('change', async () => {

        const novo = select.value;

        const certeza = await confirmar({
            titulo: 'Mudar o tipo de ' + u.nome + '?',
            texto: 'De ' + NOMES_TIPO[u.tipo_usuario] + ' para ' + NOMES_TIPO[novo] + '.',
            botao: 'Mudar para ' + NOMES_TIPO[novo]
        });

        if (!certeza) {
            select.value = u.tipo_usuario;
            return;
        }

        const { ok, dados } = await chamarApi('/usuarios/' + u.id_usuario, {
            method: 'PATCH',
            body: JSON.stringify({ tipo_usuario: novo })
        });

        mostrarAviso(ok ? 'Tipo alterado.' : (dados.mensagem || 'Não foi possível alterar.'), ok ? 'sucesso' : 'erro');
        carregar();
    });

    if (!ehAdmin) {
        acoes.appendChild(select);
    }

    if (ativo) {
        acoes.appendChild(criarBotao('Enviar link de nova senha', 'botao-secundario', async () => {

            const certeza = await confirmar({
                titulo: 'Enviar link de nova senha?',
                texto: 'Um e-mail com um link (válido por 1 hora) será enviado para ' + u.email + '. A senha atual continua valendo até a pessoa criar a nova.',
                botao: 'Enviar e-mail'
            });
            if (!certeza) return;

            const { ok, dados } = await chamarApi('/usuarios/' + u.id_usuario + '/redefinir-senha', { method: 'POST' });
            mostrarAviso(dados.mensagem || (ok ? 'Link enviado.' : 'Não foi possível enviar.'), ok ? 'sucesso' : 'erro');
        }));
    }

    // Desativar: nunca a si mesmo nem outro administrador ativo
    if (!souEu && !(ehAdmin && ativo) && (ativo || u.status_cadastro === 'DESATIVADO')) {

        acoes.appendChild(criarBotao(ativo ? 'Desativar' : 'Reativar', ativo ? 'botao-perigo' : '', async () => {

            const certeza = await confirmar(ativo
                ? {
                    titulo: 'Desativar a conta de ' + u.nome + '?',
                    texto: 'A pessoa sai na hora e não consegue mais entrar. As reservas dela continuam como estão. Dá para reativar depois.',
                    botao: 'Desativar',
                    perigo: true
                }
                : {
                    titulo: 'Reativar a conta de ' + u.nome + '?',
                    texto: 'A pessoa volta a conseguir entrar com a senha que já tinha.',
                    botao: 'Reativar'
                });
            if (!certeza) return;

            const { ok, dados } = await chamarApi('/usuarios/' + u.id_usuario, {
                method: 'PATCH',
                body: JSON.stringify({ status_cadastro: ativo ? 'DESATIVADO' : 'APROVADO' })
            });

            mostrarAviso(ok ? (ativo ? 'Conta desativada.' : 'Conta reativada.') : (dados.mensagem || 'Não foi possível alterar.'), ok ? 'sucesso' : 'erro');
            carregar();
        }));
    }

    item.appendChild(acoes);
    return item;
}

document.querySelectorAll('.aba').forEach((botao) => {
    botao.addEventListener('click', () => trocarAba(botao.dataset.aba));
});

[busca, filtroTipo, filtroSituacao].forEach((campo) => {
    campo.addEventListener('input', renderizar);
});

trocarAba(abaAtual);
carregar();
