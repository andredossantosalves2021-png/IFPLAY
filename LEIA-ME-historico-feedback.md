# IFPlay — Histórico de reservas + Feedback dos alunos

Este pacote adiciona duas coisas ao site, sem alterar nenhuma tela ou rota que já funciona:

1. **Histórico de reservas** (só administrador): lista as reservas aprovadas que já aconteceram, com quem reservou, filtros e a avaliação que o aluno fez.
2. **Feedback depois da reserva** (alunos): um questionário rápido sobre o estado da quadra e dos materiais, que aparece quando a reserva termina.

## O que tem aqui

```
rotas-historico-feedback.js     -> vai na raiz do projeto, ao lado do server.js
sql/feedback.sql                -> rodar no Supabase (cria a tabela de avaliações)
public/HISTORICO/               -> tela do histórico (historico.html/.css/.js)
public/FEEDBACK/                -> questionário (feedback.html/.css/.js) + aviso.js
prints/                         -> como as telas ficaram
```

## Como instalar (esta branch já tem tudo no lugar)

Os arquivos, o `server.js` (2 linhas) e o `dashboard.html` (1 linha) já estão editados nesta branch. Falta só o banco:

**1. Banco (Supabase).** Abra **SQL Editor → New query**, cole o conteúdo de `sql/feedback.sql` e clique em **Run**. Pode rodar mais de uma vez sem problema. O script copia o tipo dos seus `id_reserva` e `id_usuario`, então funciona com id numérico ou uuid.

**2. Teste local.** `git checkout historico-feedback`, `npm run dev` e abra `localhost:3333`.

**3. Publicar.** Se estiver tudo certo, junte a branch na `main` (`git checkout main`, `git merge historico-feedback`, `git push`). O Render publica sozinho.

As rotas usam o login por cookie que o `server.js` já tem (`obterUsuarioAutenticado`): quem é o usuário vem da sessão, nunca de um id enviado pelo navegador.

### Como testar o aviso do aluno

Precisa de uma reserva **aprovada que já terminou**, de um aluno. No Supabase (Table Editor → `reserva`), crie ou edite uma com `status = APROVADA`, data de ontem e dono um aluno. Ao entrar no site com esse aluno, o aviso aparece.

### Se algo der errado

Tire as duas linhas do `server.js` (o `import` e a chamada `registrarRotasHistoricoFeedback`) e a linha do `dashboard.html`. O resto do site volta a ser exatamente o que era. As telas novas ficam sem uso e não afetam nada.

## A análise: vale a pena o feedback?

**Sim.** O slide do problema diz que, quando há dano ou vandalismo, ninguém sabe quem usou a quadra. O histórico sozinho responde "quem reservou". Mas só o feedback conta **em que estado a quadra estava**. Juntando os dois, o administrador consegue ver: "a quadra estava suja às 14h, e logo antes quem tinha reservado era fulano". Também dá dados reais para o que vocês observaram no segundo ano (rede de vôlei, tabelas, piso, lixo, mesas e cadeiras).

O risco é ninguém responder, ou responderem de qualquer jeito. Por isso o desenho foi pensado para ser rápido e difícil de errar.

## O que eu decidi e melhorei

- **A pergunta principal é "como você encontrou a quadra?"**, e não só "como foi?". Quem reclama do estado da quadra ao chegar aponta para quem usou antes. É isso que liga o feedback ao histórico.
- **Questionário curto, com toques:** 1 pergunta de estado, 6 itens (piso, rede de vôlei, tabelas, gols e redes, bolas e materiais, mesas e cadeiras), 1 pergunta "deixou organizada?" e um comentário opcional de até 300 letras. Todos os itens começam em "Não usei", então o aluno só mexe no que usou.
- **O campo de comentário pede detalhes quando há problema** (muda o texto de ajuda sozinho).
- **Prazo de 7 dias:** a avaliação só pode ser feita até 7 dias depois do fim da reserva. Isso evita uma fila enorme com reservas recorrentes e respostas de memória.
- **Só alunos avaliam** (professores e administradores não recebem o pedido). Para incluir professores, mude `TIPOS_COM_FEEDBACK` no topo do `rotas-historico-feedback.js`.
- **No histórico:** cada reserva mostra um selo (Tudo certo, Problema relatado ou Sem avaliação), os detalhes da avaliação e, quando há problema, a **reserva que aconteceu logo antes**. Ela aparece como contexto, com o aviso de que não indica quem causou o problema. Há filtros por nome ou RA, período, tipo e "só com problema relatado".
- **Aviso suave:** o pop-up aparece uma vez por reserva por sessão, e o botão do menu fica até o aluno responder. Não é bloqueante.
- **Não quebra se faltar o SQL:** se o passo 1 ainda não foi feito, o histórico mostra as reservas normalmente com um aviso, e os alunos não recebem pedido de avaliação.
- Segurança: o administrador é conferido no servidor, e o aluno só consegue avaliar as próprias reservas, aprovadas, já terminadas e uma única vez. Os textos digitados pelos alunos são mostrados com `textContent`, sem risco de executar código.

## O que o histórico mostra (e o que não mostra)

Ele mostra quem **reservou**, não quem estava de fato na quadra. Por isso o título é "Histórico de reservas". Na apresentação, vale falar "registro de quem reservou a quadra".

## Ideias que não fiz (para depois ou para falar na apresentação)

- Foto opcional junto do problema relatado.
- Avisar o administrador no sino de notificações quando chegar uma avaliação com problema.
- Marcar um problema como "resolvido" para acompanhar a manutenção.
- Um painel com os itens que mais aparecem com problema (rede, tabelas, piso).

## Como testei

- 60 verificações das rotas contra um banco simulado: permissões (aluno e professor não veem o histórico), filtros, busca, paginação, prazo, reserva de outra pessoa, envio duplicado, fuso horário de Brasília e o caso do SQL ainda não criado.
- O SQL rodou em um Postgres de teste com id numérico, uuid e inteiro, inclusive duas vezes seguidas.
- As telas foram abertas em um navegador de verdade: fluxo completo do administrador e do aluno, modo escuro, celular (390 px, sem rolagem horizontal) e o aviso dentro do dashboard.

O que eu **não** consegui testar foi o seu banco real do Supabase. Por isso o passo 1 e o teste local são importantes antes de publicar.
