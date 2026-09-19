const usuario = JSON.parse(localStorage.getItem('usuario'));

if (!usuario) {
    window.location.replace('../index.html');
}

document.getElementById('boasVindas').textContent =
    `Bem-vindo, ${usuario.nome}!`;

const btnTema = document.getElementById('btnTema');
const iframe = document.getElementById('dashFrame');



(function () {
    const isDark = localStorage.getItem('tema') === 'true';

    document.documentElement.classList.toggle('dark-mode', isDark);

    const icone = btnTema?.querySelector('i');
    if (icone) {
        icone.className = isDark
            ? 'fa-solid fa-sun'
            : 'fa-solid fa-moon';
    }
})();



function aplicarTemaIframe(isDark) {
    try {
        const iframeDoc =
            iframe.contentDocument || iframe.contentWindow.document;

        iframeDoc.documentElement.classList.toggle('dark-mode', isDark);
    } catch (e) {
        console.log('Iframe ainda não carregado');
    }
}



btnTema.addEventListener('click', () => {
    const html = document.documentElement;

    const isDark = !html.classList.contains('dark-mode');

    html.classList.toggle('dark-mode', isDark);

    localStorage.setItem('tema', isDark ? 'true' : 'false');

    const icone = btnTema.querySelector('i');
    icone.className = isDark
        ? 'fa-solid fa-sun'
        : 'fa-solid fa-moon';

    aplicarTemaIframe(isDark);
});



iframe.addEventListener('load', () => {
    const isDark = localStorage.getItem('tema') === 'true';
    aplicarTemaIframe(isDark);
});



document.getElementById('btnSair').addEventListener('click', () => {
    if (confirm('Deseja realmente sair do sistema?')) {
        localStorage.clear();
        window.location.replace('../index.html');
    }
});