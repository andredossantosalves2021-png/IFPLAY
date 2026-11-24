// rotas-historico-feedback.js
//
// Rotas novas do IFPlay: histórico de reservas (só administrador) e
// feedback do aluno depois que a reserva termina.
//
// Como usar no server.js (depois de criar o `supabase`):
//
//   import { registrarRotasHistoricoFeedback } from './rotas-historico-feedback.js'
//   registrarRotasHistoricoFeedback(app, supabaseAdmin, obterUsuarioAutenticado)
//
// Quem está logado vem sempre do cookie de sessão (obterUsuarioAutenticado),
// nunca de um id enviado pelo navegador.
//
// Este arquivo não altera nenhuma rota existente.

// ---------- Configurações (pode ajustar) ----------

// Quantos dias depois do fim da reserva o aluno ainda pode avaliar.
const JANELA_FEEDBACK_DIAS = 7

// Quem recebe o pedido de avaliação. Para incluir professores: ['ALUNO', 'PROFESSOR']
const TIPOS_COM_FEEDBACK = ['ALUNO']

// ---------- Valores aceitos ----------

const TIPOS_RESERVA = ['JOGO_LIVRE', 'AULA', 'EVENTO']
const ESTADOS_QUADRA = ['LIMPA', 'ACEITAVEL', 'SUJA']
const NIVEIS_ITEM = ['OK', 'PROBLEMA', 'NAO_USEI']
const ITENS = [
    'piso',
    'rede_volei',
    'tabelas_basquete',
    'gols_redes',
    'bolas_materiais',
    'mesas_cadeiras'
]

const NOMES_ITENS = {
    piso: 'piso',
    rede_volei: 'rede de vôlei',
    tabelas_basquete: 'tabelas de basquete',
    gols_redes: 'gols e redes',
    bolas_materiais: 'bolas e materiais',
    mesas_cadeiras: 'mesas e cadeiras'
}

const NOMES_ESTADOS = {
    LIMPA: 'limpa',
    ACEITAVEL: 'aceitável',
    SUJA: 'suja ou desorganizada'
}

const DATA_REGEX = /^\d{4}-\d{2}-\d{2}$/

// ---------- Funções auxiliares ----------

// Data e hora de agora em Brasília. O Render roda em UTC, então não dá
// para usar new Date() direto.
function agoraSaoPaulo() {
    const agora = new Date()

    const data = agora.toLocaleDateString('en-CA', {
        timeZone: 'America/Sao_Paulo'
    })

    const hora = agora.toLocaleTimeString('en-GB', {
        timeZone: 'America/Sao_Paulo',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hourCycle: 'h23'
    })

    return { data, hora }
}

function subtrairDias(dataISO, dias) {
    const d = new Date(dataISO + 'T00:00:00Z')
    d.setUTCDate(d.getUTCDate() - dias)
    return d.toISOString().slice(0, 10)
}

// Filtro do Supabase: reservas que já terminaram.
function filtroFinalizada(agora) {
    return (
        'data_reserva.lt.' + agora.data +
        ',and(data_reserva.eq.' + agora.data +
        ',horario_fim.lte.' + agora.hora + ')'
    )
}

// Tira caracteres que quebrariam o filtro .or() do Supabase.
function limparBusca(texto) {
    return String(texto || '')
        .replace(/[,()%*\\"'`;]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 60)
}

function tabelaFeedbackAusente(error) {
    return Boolean(error) && (
        error.code === '42P01' ||
        error.code === 'PGRST205' ||
        /feedback_reserva/i.test(error.message || '')
    )
}

// Confere a sessão (cookie) e se quem está logado é administrador.
async function exigirAdmin(obterUsuarioAutenticado, c) {

    const usuario = await obterUsuarioAutenticado(c)

    if (!usuario) {
        return { ok: false, status: 401, mensagem: 'É necessário fazer login.' }
    }

    if (usuario.tipo_usuario !== 'ADMINISTRADOR') {
        return {
            ok: false,
            status: 403,
            mensagem: 'Apenas administradores podem ver o histórico.'
        }
    }

    return { ok: true, usuario }
}

// Reserva aprovada que aconteceu logo antes desta (serve de contexto
// para o administrador quando alguém relata um problema).
async function buscarReservaAnterior(supabase, reserva) {

    const { data, error } = await supabase
        .from('reserva')
        .select('data_reserva, horario_inicio, horario_fim, usuario ( nome )')
        .eq('status', 'APROVADA')
        .or(
            'data_reserva.lt.' + reserva.data_reserva +
            ',and(data_reserva.eq.' + reserva.data_reserva +
            ',horario_fim.lte.' + reserva.horario_inicio + ')'
        )
        .order('data_reserva', { ascending: false })
        .order('horario_fim', { ascending: false })
        .limit(1)

    if (error || !data || data.length === 0) {
        return null
    }

    const anterior = data[0]

    return {
        nome: anterior.usuario ? anterior.usuario.nome : null,
        data_reserva: anterior.data_reserva,
        horario_inicio: anterior.horario_inicio,
        horario_fim: anterior.horario_fim
    }
}

// Avisa todos os administradores (pelo sino) quando chega uma avaliação com
// problema. Se der erro, a avaliação já está salva e só o aviso deixa de sair.
async function avisarAdministradores(supabase, dados) {

    try {

        const { data: admins, error: erroAdmins } = await supabase
            .from('usuario')
            .select('id_usuario')
            .eq('tipo_usuario', 'ADMINISTRADOR')
            .eq('status_cadastro', 'APROVADO')

        if (erroAdmins || !admins || admins.length === 0) {
            if (erroAdmins) console.error('Aviso de avaliação: erro ao buscar administradores:', erroAdmins)
            return
        }

        const itensComProblema = Object.keys(dados.itens)
            .filter((chave) => dados.itens[chave] === 'PROBLEMA')
            .map((chave) => NOMES_ITENS[chave] || chave)

        const [ano, mes, dia] = String(dados.reserva.data_reserva).slice(0, 10).split('-')

        let mensagem =
            'Avaliação com problema: ' + dados.nome +
            ' avaliou a reserva de ' + (dados.reserva.modalidade || 'quadra') +
            ' do dia ' + dia + '/' + mes + '/' + ano +
            ' (' + String(dados.reserva.horario_inicio).slice(0, 5) +
            ' às ' + String(dados.reserva.horario_fim).slice(0, 5) + ').' +
            ' Quadra ao chegar: ' + (NOMES_ESTADOS[dados.estado] || dados.estado) + '.'

        if (itensComProblema.length > 0) {
            mensagem += ' Com problema: ' + itensComProblema.join(', ') + '.'
        }

        if (dados.organizada === false) {
            mensagem += ' Não foi deixada organizada.'
        }

        if (dados.observacao) {
            const trecho = dados.observacao.length > 120
                ? dados.observacao.slice(0, 120) + '...'
                : dados.observacao
            mensagem += ' Comentário: "' + trecho + '".'
        }

        mensagem += ' Veja no Histórico.'

        const { error } = await supabase
            .from('notificacao')
            .insert(admins.map((a) => ({
                mensagem: mensagem,
                tipo: 'FEEDBACK_PROBLEMA',
                lida: false,
                id_usuario: a.id_usuario
            })))

        if (error) {
            console.error('Aviso de avaliação: erro ao criar notificação:', error)
        }

    } catch (erro) {
        console.error('Aviso de avaliação:', erro)
    }
}

// ---------- Rotas ----------

export function registrarRotasHistoricoFeedback(app, supabase, obterUsuarioAutenticado) {

    // ===== Histórico de reservas (só administrador) =====
    app.get('/historico', async (c) => {

        try {

            const q = (nome) => c.req.query(nome)

            const adm = await exigirAdmin(obterUsuarioAutenticado, c)

            if (!adm.ok) {
                return c.json({ sucesso: false, mensagem: adm.mensagem }, adm.status)
            }

            const agora = agoraSaoPaulo()

            const limite = Math.min(Math.max(parseInt(q('limite'), 10) || 20, 1), 100)
            const pagina = Math.max(parseInt(q('pagina'), 10) || 1, 1)
            const inicio = (pagina - 1) * limite

            const de = DATA_REGEX.test(q('de') || '') ? q('de') : null
            const ate = DATA_REGEX.test(q('ate') || '') ? q('ate') : null
            const tipo = TIPOS_RESERVA.includes(q('tipo')) ? q('tipo') : null
            const busca = limparBusca(q('busca'))
            const somenteProblemas = q('somente_problemas') === '1'

            const vazio = {
                sucesso: true,
                reservas: [],
                total: 0,
                pagina: pagina,
                limite: limite,
                tem_mais: false
            }

            // Busca por nome (ou RA, se for só número)
            let idsUsuarios = null

            if (busca) {

                const filtroUsuario = /^\d+$/.test(busca)
                    ? 'nome.ilike.%' + busca + '%,ra.eq.' + busca
                    : 'nome.ilike.%' + busca + '%'

                const { data: usuarios, error: erroUsuarios } = await supabase
                    .from('usuario')
                    .select('id_usuario')
                    .or(filtroUsuario)
                    .limit(100)

                if (erroUsuarios) {
                    console.error(erroUsuarios)
                    return c.json({ sucesso: false, mensagem: erroUsuarios.message }, 400)
                }

                idsUsuarios = usuarios.map((u) => u.id_usuario)

                if (idsUsuarios.length === 0) {
                    return c.json(vazio)
                }
            }

            // Só reservas com problema relatado
            let idsComProblema = null

            if (somenteProblemas) {

                const { data: problemas, error: erroProblemas } = await supabase
                    .from('feedback_reserva')
                    .select('id_reserva')
                    .eq('tem_problema', true)
                    .order('criado_em', { ascending: false })
                    .limit(100)

                if (erroProblemas) {
                    console.error(erroProblemas)

                    return c.json({
                        sucesso: false,
                        mensagem: tabelaFeedbackAusente(erroProblemas)
                            ? 'A tabela de feedback ainda não foi criada. Rode o arquivo sql/feedback.sql no Supabase.'
                            : erroProblemas.message
                    }, 400)
                }

                idsComProblema = problemas.map((p) => p.id_reserva)

                if (idsComProblema.length === 0) {
                    return c.json(vazio)
                }
            }

            let query = supabase
                .from('reserva')
                .select(
                    '*, usuario ( nome, ra, tipo_usuario )',
                    { count: 'exact' }
                )
                .eq('status', 'APROVADA')
                .or(filtroFinalizada(agora))

            if (de) query = query.gte('data_reserva', de)
            if (ate) query = query.lte('data_reserva', ate)
            if (tipo) query = query.eq('tipo_reserva', tipo)
            if (idsUsuarios) query = query.in('id_usuario', idsUsuarios)
            if (idsComProblema) query = query.in('id_reserva', idsComProblema)

            query = query
                .order('data_reserva', { ascending: false })
                .order('horario_inicio', { ascending: false })
                .range(inicio, inicio + limite - 1)

            const { data: reservas, error, count } = await query

            if (error) {
                console.error(error)
                return c.json({ sucesso: false, mensagem: error.message }, 400)
            }

            // Avaliações dessas reservas
            const mapaFeedback = new Map()
            let feedbackIndisponivel = false

            if (reservas.length > 0) {

                const { data: feedbacks, error: erroFeedback } = await supabase
                    .from('feedback_reserva')
                    .select('*')
                    .in('id_reserva', reservas.map((r) => r.id_reserva))

                if (erroFeedback) {
                    // O histórico continua funcionando mesmo sem a tabela de feedback.
                    console.error(erroFeedback)
                    feedbackIndisponivel = true
                } else {
                    feedbacks.forEach((f) => mapaFeedback.set(String(f.id_reserva), f))
                }
            }

            const resultado = await Promise.all(
                reservas.map(async (r) => {

                    const feedback = mapaFeedback.get(String(r.id_reserva)) || null

                    let avaliacao = 'SEM_RESPOSTA'

                    if (feedback) {
                        avaliacao = feedback.tem_problema ? 'PROBLEMA' : 'OK'
                    }

                    const reservaAnterior =
                        avaliacao === 'PROBLEMA'
                            ? await buscarReservaAnterior(supabase, r)
                            : null

                    return {
                        id_reserva: r.id_reserva,
                        data_reserva: r.data_reserva,
                        horario_inicio: r.horario_inicio,
                        horario_fim: r.horario_fim,
                        modalidade: r.modalidade,
                        tipo_reserva: r.tipo_reserva,
                        recorrente: r.recorrente,
                        usuario: r.usuario
                            ? {
                                nome: r.usuario.nome,
                                ra: r.usuario.ra,
                                tipo_usuario: r.usuario.tipo_usuario
                            }
                            : null,
                        avaliacao: avaliacao,
                        feedback: feedback
                            ? {
                                estado_ao_chegar: feedback.estado_ao_chegar,
                                itens: feedback.itens,
                                deixou_organizada: feedback.deixou_organizada,
                                observacao: feedback.observacao,
                                criado_em: feedback.criado_em
                            }
                            : null,
                        reserva_anterior: reservaAnterior
                    }
                })
            )

            const total = typeof count === 'number' ? count : resultado.length

            return c.json({
                sucesso: true,
                reservas: resultado,
                total: total,
                pagina: pagina,
                limite: limite,
                tem_mais: inicio + resultado.length < total,
                feedback_indisponivel: feedbackIndisponivel
            })

        } catch (erro) {

            console.error(erro)

            return c.json({ sucesso: false, mensagem: 'Erro interno do servidor.' }, 500)
        }
    })

    // ===== Avaliações que o usuário ainda precisa responder =====
    app.get('/feedbacks/pendentes', async (c) => {

        try {

            const usuario = await obterUsuarioAutenticado(c)

            if (!usuario) {
                return c.json({ sucesso: false, mensagem: 'É necessário fazer login.' }, 401)
            }

            const idUsuario = usuario.id_usuario

            // Quem não avalia recebe uma lista vazia (não é erro).
            if (!TIPOS_COM_FEEDBACK.includes(usuario.tipo_usuario)) {
                return c.json({ sucesso: true, pendentes: [] })
            }

            const agora = agoraSaoPaulo()
            const desde = subtrairDias(agora.data, JANELA_FEEDBACK_DIAS)

            const { data: reservas, error } = await supabase
                .from('reserva')
                .select('id_reserva, data_reserva, horario_inicio, horario_fim, modalidade, tipo_reserva')
                .eq('id_usuario', idUsuario)
                .eq('status', 'APROVADA')
                .gte('data_reserva', desde)
                .or(filtroFinalizada(agora))
                .order('data_reserva', { ascending: false })
                .order('horario_fim', { ascending: false })
                .limit(20)

            if (error) {
                console.error(error)
                return c.json({ sucesso: false, mensagem: error.message }, 400)
            }

            if (reservas.length === 0) {
                return c.json({ sucesso: true, pendentes: [] })
            }

            const { data: respondidas, error: erroFeedback } = await supabase
                .from('feedback_reserva')
                .select('id_reserva')
                .in('id_reserva', reservas.map((r) => r.id_reserva))

            if (erroFeedback) {
                // Sem a tabela, não incomoda o aluno com pedidos de avaliação.
                console.error(erroFeedback)
                return c.json({ sucesso: true, pendentes: [] })
            }

            const jaRespondidas = new Set(respondidas.map((f) => String(f.id_reserva)))

            return c.json({
                sucesso: true,
                pendentes: reservas.filter((r) => !jaRespondidas.has(String(r.id_reserva)))
            })

        } catch (erro) {

            console.error(erro)

            return c.json({ sucesso: false, mensagem: 'Erro interno do servidor.' }, 500)
        }
    })

    // ===== Enviar a avaliação =====
    app.post('/feedbacks', async (c) => {

        try {

            const body = await c.req.json()

            const usuario = await obterUsuarioAutenticado(c)

            if (!usuario) {
                return c.json({ sucesso: false, mensagem: 'É necessário fazer login.' }, 401)
            }

            const id_usuario = usuario.id_usuario

            const {
                id_reserva,
                estado_ao_chegar,
                itens,
                deixou_organizada,
                observacao
            } = body

            if (!id_reserva) {
                return c.json({ sucesso: false, mensagem: 'Reserva não informada.' }, 400)
            }

            if (!ESTADOS_QUADRA.includes(estado_ao_chegar)) {
                return c.json({
                    sucesso: false,
                    mensagem: 'Diga como você encontrou a quadra.'
                }, 400)
            }

            if (typeof deixou_organizada !== 'boolean') {
                return c.json({
                    sucesso: false,
                    mensagem: 'Diga se você deixou a quadra organizada.'
                }, 400)
            }

            // Respostas por item: o que não vier fica como "não usei".
            const itensFinal = {}

            for (const chave of ITENS) {

                const valor = itens ? itens[chave] : undefined

                if (valor === undefined || valor === null) {
                    itensFinal[chave] = 'NAO_USEI'
                    continue
                }

                if (!NIVEIS_ITEM.includes(valor)) {
                    return c.json({ sucesso: false, mensagem: 'Resposta inválida em um dos itens.' }, 400)
                }

                itensFinal[chave] = valor
            }

            const observacaoLimpa =
                typeof observacao === 'string'
                    ? observacao.trim().slice(0, 300)
                    : ''

            const { data: reserva, error: erroReserva } = await supabase
                .from('reserva')
                .select('id_reserva, id_usuario, status, data_reserva, horario_inicio, horario_fim, modalidade')
                .eq('id_reserva', id_reserva)
                .maybeSingle()

            if (erroReserva || !reserva) {
                return c.json({ sucesso: false, mensagem: 'Reserva não encontrada.' }, 404)
            }

            if (String(reserva.id_usuario) !== String(id_usuario)) {
                return c.json({
                    sucesso: false,
                    mensagem: 'Você só pode avaliar as suas próprias reservas.'
                }, 403)
            }

            if (reserva.status !== 'APROVADA') {
                return c.json({
                    sucesso: false,
                    mensagem: 'Só reservas aprovadas podem ser avaliadas.'
                }, 400)
            }

            const agora = agoraSaoPaulo()

            const terminou =
                reserva.data_reserva < agora.data ||
                (reserva.data_reserva === agora.data && reserva.horario_fim <= agora.hora)

            if (!terminou) {
                return c.json({
                    sucesso: false,
                    mensagem: 'A reserva ainda não terminou.'
                }, 400)
            }

            if (reserva.data_reserva < subtrairDias(agora.data, JANELA_FEEDBACK_DIAS)) {
                return c.json({
                    sucesso: false,
                    mensagem: 'O prazo para avaliar esta reserva já passou.'
                }, 400)
            }

            const temProblema =
                estado_ao_chegar === 'SUJA' ||
                deixou_organizada === false ||
                Object.values(itensFinal).includes('PROBLEMA')

            const { error } = await supabase
                .from('feedback_reserva')
                .insert([{
                    id_reserva: reserva.id_reserva,
                    id_usuario: id_usuario,
                    estado_ao_chegar: estado_ao_chegar,
                    itens: itensFinal,
                    deixou_organizada: deixou_organizada,
                    observacao: observacaoLimpa || null,
                    tem_problema: temProblema
                }])

            if (error) {

                console.error(error)

                if (error.code === '23505') {
                    return c.json({
                        sucesso: false,
                        mensagem: 'Esta reserva já foi avaliada.'
                    }, 409)
                }

                if (tabelaFeedbackAusente(error)) {
                    return c.json({
                        sucesso: false,
                        mensagem: 'A avaliação ainda não está disponível. Avise o administrador.'
                    }, 503)
                }

                return c.json({ sucesso: false, mensagem: error.message }, 400)
            }

            if (temProblema) {
                await avisarAdministradores(supabase, {
                    nome: usuario.nome,
                    reserva: reserva,
                    estado: estado_ao_chegar,
                    itens: itensFinal,
                    organizada: deixou_organizada,
                    observacao: observacaoLimpa
                })
            }

            return c.json({
                sucesso: true,
                mensagem: 'Obrigado pela avaliação!'
            })

        } catch (erro) {

            console.error(erro)

            return c.json({ sucesso: false, mensagem: 'Erro interno do servidor.' }, 500)
        }
    })
}
