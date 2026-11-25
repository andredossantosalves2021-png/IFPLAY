// Botão de olho nos campos de senha (login e cadastro).
// Alterna entre mostrar e esconder a senha sem tirar o cursor do campo,
// então dá para conferir o que foi digitado e continuar digitando.

document.querySelectorAll('.botao-ver-senha').forEach((botao) => {

    const campo = document.getElementById(botao.dataset.alvo);
    const icone = botao.querySelector('i');

    if (!campo) {
        return;
    }

    // Não deixa o clique roubar o foco do campo
    botao.addEventListener('mousedown', (evento) => {
        evento.preventDefault();
    });

    botao.addEventListener('click', () => {

        const mostrar = campo.type === 'password';

        campo.type = mostrar ? 'text' : 'password';

        botao.setAttribute('aria-pressed', mostrar ? 'true' : 'false');
        botao.setAttribute('aria-label', mostrar ? 'Esconder senha' : 'Mostrar senha');
        botao.title = mostrar ? 'Esconder senha' : 'Mostrar senha';

        if (icone) {
            icone.className = mostrar ? 'bx bx-hide' : 'bx bx-show';
        }

        // Mantém o cursor no fim do texto
        if (document.activeElement === campo) {
            const fim = campo.value.length;
            campo.setSelectionRange(fim, fim);
        }
    });
});
