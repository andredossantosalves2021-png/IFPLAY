// aviso.js — roda dentro do dashboard (uma linha no dashboard.html).
//
// Faz duas coisas, sem mexer no dashboard.js:
//  - Administrador: mostra o botão "Histórico" no menu.
//  - Aluno: quando uma reserva termina, mostra um aviso pedindo a avaliação
//    e um botão "Avaliar quadra" no menu enquanto houver algo pendente.

(function () {

    let usuario = null;

    try {
        usuario = JSON.parse(localStorage.getItem('usuario') || 'null');
    } catch (e) {
        usuario = null;
    }

    if (!usuario) return;

    const barra = document.querySelector('.action-bar');
    const quadro = document.getElementById('dashFrame');

    if (!barra || !quadro) return;

    // ---------- Estilo do aviso ----------

    const estilo = document.createElement('style');

    estilo.textContent = `
        .ifp-contador {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            min-width: 20px;
            height: 20px;
            padding: 0 6px;
            border-radius: 10px;
            background: #dc2626;
            color: #fff;
            font-size: 11px;
            font-weight: 700;
        }
        .ifp-fundo {
            position: fixed;
            inset: 0;
            z-index: 1100;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 16px;
            background: rgba(0, 0, 0, 0.55);
        }
        .ifp-fundo[hidden] { display: none; }
        .ifp-caixa {
            width: 100%;
            max-width: 420px;
            padding: 28px;
            border-radius: 18px;
            background: #fff;
            text-align: center;
            box-shadow: 0 15px 40px rgba(0, 0, 0, 0.25);
            font-family: "Poppins", Arial, sans-serif;
        }
        .ifp-icone {
            width: 56px;
            height: 56px;
            margin: 0 auto 14px;
            border-radius: 50%;
            background: #d1fae5;
            color: #047857;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 26px;
            font-weight: 700;
        }
        .ifp-caixa h2 {
            margin: 0 0 8px;
            color: #111827;
            font-size: 21px;
        }
        .ifp-caixa p {
            margin: 0 0 22px;
            color: #6b7280;
            font-size: 15px;
            line-height: 1.5;
        }
        .ifp-botoes {
            display: flex;
            gap: 12px;
        }
        .ifp-botoes button {
            flex: 1;
            padding: 11px 16px;
            border: none;
            border-radius: 10px;
            font-family: inherit;
            font-size: 15px;
            font-weight: 600;
            cursor: pointer;
        }
        .ifp-sim { background: #10b981; color: #fff; }
        .ifp-sim:hover { background: #059669; }
        .ifp-depois { background: #e5e7eb; color: #374151; }
        .ifp-depois:hover { background: #d1d5db; }
        html.dark-mode .ifp-caixa { background: #0f172a; }
        html.dark-mode .ifp-caixa h2 { color: #f8fafc; }
        html.dark-mode .ifp-caixa p { color: #94a3b8; }
        html.dark-mode .ifp-icone { background: rgba(16, 185, 129, 0.2); color: #6ee7b7; }
        html.dark-mode .ifp-depois { background: #334155; color: #f8fafc; }
        html.dark-mode .ifp-depois:hover { background: #475569; }
        @media (max-width: 480px) {
            .ifp-botoes { flex-direction: column; }
        }
    `;

    document.head.appendChild(estilo);

    // ---------- Apoio ----------

    function abrirNoQuadro(endereco) {
        quadro.src = endereco;
    }

    function garantirLink(id, texto, endereco) {

        let link = document.getElementById(id);

        if (!link) {
            link = document.createElement('a');
            link.id = id;
            link.className = 'btn-action';
            link.href = endereco;
            link.target = 'frame';
            link.textContent = texto;
            barra.appendChild(link);
        }

        link.style.display = '';

        return link;
    }

    // ---------- Administrador: botão Histórico ----------

    if (usuario.tipo_usuario === 'ADMINISTRADOR') {
        garantirLink('linkHistorico', 'Histórico', '../HISTORICO/historico.html');
        return;
    }

    // ---------- Aluno: avaliação depois da reserva ----------

    if (usuario.tipo_usuario !== 'ALUNO') return;

    const CHAVE_AVISADAS = 'ifplay_feedback_avisadas';

    function lerAvisadas() {
        try {
            return JSON.parse(sessionStorage.getItem(CHAVE_AVISADAS) || '[]');
        } catch (e) {
            return [];
        }
    }

    function guardarAvisada(id) {
        try {
            const lista = lerAvisadas();
            lista.push(String(id));
            sessionStorage.setItem(CHAVE_AVISADAS, JSON.stringify(lista));
        } catch (e) { /* sem sessionStorage: o aviso pode repetir, sem problema */ }
    }

    // Janela do aviso (montada uma vez, reaproveitada)
    const fundo = document.createElement('div');
    fundo.className = 'ifp-fundo';
    fundo.hidden = true;
    fundo.setAttribute('role', 'dialog');
    fundo.setAttribute('aria-modal', 'true');

    const caixa = document.createElement('div');
    caixa.className = 'ifp-caixa';

    const icone = document.createElement('div');
    icone.className = 'ifp-icone';
    icone.textContent = '★';

    const titulo = document.createElement('h2');
    titulo.textContent = 'Como estava a quadra?';

    const texto = document.createElement('p');

    const botoes = document.createElement('div');
    botoes.className = 'ifp-botoes';

    const botaoDepois = document.createElement('button');
    botaoDepois.type = 'button';
    botaoDepois.className = 'ifp-depois';
    botaoDepois.textContent = 'Depois';

    const botaoSim = document.createElement('button');
    botaoSim.type = 'button';
    botaoSim.className = 'ifp-sim';
    botaoSim.textContent = 'Avaliar agora';

    botoes.appendChild(botaoDepois);
    botoes.appendChild(botaoSim);

    caixa.appendChild(icone);
    caixa.appendChild(titulo);
    caixa.appendChild(texto);
    caixa.appendChild(botoes);
    fundo.appendChild(caixa);
    document.body.appendChild(fundo);

    let reservaDoAviso = null;

    function fecharAviso() {
        if (reservaDoAviso) guardarAvisada(reservaDoAviso.id_reserva);
        fundo.hidden = true;
    }

    botaoDepois.addEventListener('click', fecharAviso);

    fundo.addEventListener('click', function (e) {
        if (e.target === fundo) fecharAviso();
    });

    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && !fundo.hidden) fecharAviso();
    });

    botaoSim.addEventListener('click', function () {
        const reserva = reservaDoAviso;
        fecharAviso();
        abrirNoQuadro(
            '../FEEDBACK/feedback.html' +
            (reserva ? '?reserva=' + encodeURIComponent(reserva.id_reserva) : '')
        );
    });

    function dataCurta(dataISO) {
        const partes = String(dataISO).slice(0, 10).split('-');
        return partes[2] + '/' + partes[1];
    }

    function hora(h) {
        return String(h).slice(0, 5);
    }

    function mostrarAviso(reserva, total) {

        reservaDoAviso = reserva;

        let frase =
            'Sua reserva de ' + (reserva.modalidade || 'quadra') + ' (' +
            dataCurta(reserva.data_reserva) + ', ' +
            hora(reserva.horario_inicio) + ' às ' + hora(reserva.horario_fim) +
            ') terminou. Conta em menos de 1 minuto como foi: isso ajuda a cuidar da quadra.';

        if (total > 1) {
            frase += ' Você tem mais ' + (total - 1) + ' para avaliar.';
        }

        texto.textContent = frase;
        fundo.hidden = false;
        botaoSim.focus();
    }

    // Botão no menu, com contador
    let linkAvaliar = null;
    let contadorAvaliar = null;

    function atualizarMenu(total) {

        if (total === 0) {
            if (linkAvaliar) linkAvaliar.style.display = 'none';
            return;
        }

        if (!linkAvaliar) {
            linkAvaliar = garantirLink('linkFeedback', 'Avaliar quadra', '../FEEDBACK/feedback.html');
            contadorAvaliar = document.createElement('span');
            contadorAvaliar.className = 'ifp-contador';
            linkAvaliar.appendChild(contadorAvaliar);
        }

        linkAvaliar.style.display = '';
        contadorAvaliar.textContent = total;
    }

    async function verificar(permitirAviso) {

        try {

            const resposta = await fetch(
                '/feedbacks/pendentes'
            );

            const resultado = await resposta.json();

            if (!resultado.sucesso) return;

            const pendentes = resultado.pendentes;

            atualizarMenu(pendentes.length);

            if (!permitirAviso || pendentes.length === 0 || !fundo.hidden) return;

            const avisadas = lerAvisadas();

            const nova = pendentes.find(function (p) {
                return avisadas.indexOf(String(p.id_reserva)) === -1;
            });

            if (nova) mostrarAviso(nova, pendentes.length);

        } catch (e) {
            console.error('Aviso de avaliação:', e);
        }
    }

    // O formulário avisa quando uma avaliação é enviada.
    window.addEventListener('message', function (e) {
        if (e.origin === window.location.origin && e.data && e.data.tipo === 'ifplay-feedback-enviado') {
            verificar(false);
        }
    });

    verificar(true);

    // Confere de novo a cada 5 minutos (uma reserva pode terminar com o site aberto).
    setInterval(function () { verificar(true); }, 5 * 60 * 1000);

})();
