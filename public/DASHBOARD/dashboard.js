const usuario = JSON.parse(
    localStorage.getItem('usuario')
);

if (!usuario) {
    window.location.replace('../index.html');
}

document.getElementById('boasVindas').textContent =
    `Bem-vindo, ${usuario.nome}!`;


if (usuario.tipo_usuario === 'ADMINISTRADOR') {
    document.getElementById('linkCadastros').style.display = '';
}


const btnReclamacoes = document.getElementById('btnReclamacoes');


if (btnReclamacoes) {
    btnReclamacoes.style.display = 'inline-block';
}



const btnTema =
    document.getElementById('btnTema');

const iframe =
    document.getElementById('dashFrame');

const btnSair =
    document.getElementById('btnSair');

const modalSair =
    document.getElementById('modalSair');

const btnCancelarSaida =
    document.getElementById('btnCancelarSaida');

const btnConfirmarSaida =
    document.getElementById('btnConfirmarSaida');




(function () {
    const isDark =
        localStorage.getItem('tema') === 'true';

    document.documentElement.classList.toggle(
        'dark-mode',
        isDark
    );

    const icone =
        btnTema?.querySelector('i');

    if (icone) {
        icone.className = isDark
            ? 'fa-solid fa-sun'
            : 'fa-solid fa-moon';
    }
})();



function aplicarTemaIframe(isDark) {
    try {
        const iframeDoc =
            iframe.contentDocument ||
            iframe.contentWindow.document;

        iframeDoc.documentElement.classList.toggle(
            'dark-mode',
            isDark
        );

    } catch (e) {
        console.log(
            'Iframe ainda não carregado'
        );
    }
}



btnTema.addEventListener('click', () => {
    const html =
        document.documentElement;

    const isDark =
        !html.classList.contains(
            'dark-mode'
        );

    html.classList.toggle(
        'dark-mode',
        isDark
    );

    localStorage.setItem(
        'tema',
        isDark ? 'true' : 'false'
    );

    const icone =
        btnTema.querySelector('i');

    icone.className = isDark
        ? 'fa-solid fa-sun'
        : 'fa-solid fa-moon';

    aplicarTemaIframe(isDark);
});



iframe.addEventListener('load', () => {
    const isDark =
        localStorage.getItem('tema') === 'true';

    aplicarTemaIframe(isDark);
});





function abrirModalSaida() {
    modalSair.classList.add('ativo');

    modalSair.setAttribute(
        'aria-hidden',
        'false'
    );
}



function fecharModalSaida() {
    modalSair.classList.remove('ativo');

    modalSair.setAttribute(
        'aria-hidden',
        'true'
    );
}



btnSair.addEventListener('click', () => {
    abrirModalSaida();
});



btnCancelarSaida.addEventListener(
    'click',
    () => {
        fecharModalSaida();
    }
);



btnConfirmarSaida.addEventListener(
    'click',
    () => {

        localStorage.clear();

        window.location.replace(
            '../index.html'
        );
    }
);



modalSair.addEventListener(
    'click',
    (evento) => {

        if (
            evento.target === modalSair
        ) {
            fecharModalSaida();
        }
    }
);




document.addEventListener(
    'keydown',
    (evento) => {

        if (
            evento.key === 'Escape' &&
            modalSair.classList.contains(
                'ativo'
            )
        ) {
            fecharModalSaida();
        }
    }
);  