// Funções comuns das telas de administrador (Usuários e Bloqueios).

(function () {

    if (localStorage.getItem('tema') === 'true') {
        document.documentElement.classList.add('dark-mode');
    }

    let tempoAviso;

    window.mostrarAviso = function (mensagem, tipo) {

        let aviso = document.getElementById('avisoTela');

        if (!aviso) {
            aviso = document.createElement('div');
            aviso.id = 'avisoTela';
            aviso.setAttribute('role', 'status');
            document.body.appendChild(aviso);
        }

        clearTimeout(tempoAviso);

        aviso.className = 'aviso ' + (tipo || 'sucesso');
        aviso.textContent = mensagem;

        requestAnimationFrame(() => aviso.classList.add('visivel'));

        tempoAviso = setTimeout(() => aviso.classList.remove('visivel'), 4500);
    };

    // Janela de confirmação. "itens" (opcional) vira uma lista de texto.
    window.confirmar = function ({ titulo, texto, itens, botao, perigo }) {

        return new Promise((resolve) => {

            const fundo = document.createElement('div');
            fundo.className = 'janela-fundo aberta';

            const janela = document.createElement('div');
            janela.className = 'janela';
            janela.setAttribute('role', 'dialog');
            janela.setAttribute('aria-modal', 'true');

            const h3 = document.createElement('h3');
            h3.textContent = titulo;
            janela.appendChild(h3);

            if (texto) {
                const p = document.createElement('p');
                p.textContent = texto;
                janela.appendChild(p);
            }

            if (itens && itens.length) {
                const ul = document.createElement('ul');
                itens.forEach((linha) => {
                    const li = document.createElement('li');
                    li.textContent = linha;
                    ul.appendChild(li);
                });
                janela.appendChild(ul);
            }

            const acoes = document.createElement('div');
            acoes.className = 'janela-acoes';

            const cancelar = document.createElement('button');
            cancelar.type = 'button';
            cancelar.className = 'botao botao-secundario';
            cancelar.textContent = 'Voltar';

            const ok = document.createElement('button');
            ok.type = 'button';
            ok.className = 'botao' + (perigo ? ' botao-perigo' : '');
            ok.textContent = botao || 'Confirmar';

            acoes.appendChild(cancelar);
            acoes.appendChild(ok);
            janela.appendChild(acoes);
            fundo.appendChild(janela);
            document.body.appendChild(fundo);

            function fechar(resposta) {
                document.removeEventListener('keydown', aoTeclar);
                fundo.remove();
                resolve(resposta);
            }

            function aoTeclar(e) {
                if (e.key === 'Escape') fechar(false);
            }

            cancelar.addEventListener('click', () => fechar(false));
            ok.addEventListener('click', () => fechar(true));
            fundo.addEventListener('click', (e) => { if (e.target === fundo) fechar(false); });
            document.addEventListener('keydown', aoTeclar);

            ok.focus();
        });
    };

    window.formatarData = function (data) {
        const partes = String(data).split('-');
        return partes.length === 3 ? partes[2] + '/' + partes[1] + '/' + partes[0] : data;
    };

    window.chamarApi = async function (url, opcoes) {

        const resposta = await fetch(url, {
            ...opcoes,
            headers: { 'Content-Type': 'application/json', ...(opcoes && opcoes.headers) }
        });

        let dados = {};

        try {
            dados = await resposta.json();
        } catch (e) {
            dados = {};
        }

        if (resposta.status === 401) {
            window.top.location.replace('/index.html');
        }

        return { ok: resposta.ok && dados.sucesso !== false, status: resposta.status, dados };
    };
})();
