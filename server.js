import 'dotenv/config'
import { Hono } from 'hono'
import { createClient } from '@supabase/supabase-js'
import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import bcrypt from 'bcryptjs'
import { randomBytes, createHash } from 'node:crypto'
import { setCookie, getCookie, deleteCookie } from 'hono/cookie'
import { registrarRotasHistoricoFeedback } from './rotas-historico-feedback.js'

const app = new Hono()

app.use('*', async (c, next) => {
    if (['POST', 'PATCH', 'PUT', 'DELETE'].includes(c.req.method)) {
        const origem = c.req.header('origin')
        const destino = new URL(c.req.url)

        if (origem) {
            let origemUrl

            try {
                origemUrl = new URL(origem)
            } catch {
                return c.json({ sucesso: false, mensagem: 'Origem inválida.' }, 403)
            }

            if (origemUrl.host !== destino.host || !['http:', 'https:'].includes(origemUrl.protocol)) {
                return c.json({ sucesso: false, mensagem: 'Origem não permitida.' }, 403)
            }
        }
    }

    await next()
})

app.use(
    '/*',
    serveStatic({
        root: './public'
    })
)

const supabaseAdmin = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY,
    {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    }
)

async function obterUsuarioAutenticado(c) {
    const token = getCookie(c, 'ifplay_sessao')

    if (!token || !/^[a-f0-9]{64}$/.test(token)) {
        return null
    }

    const tokenHash = createHash('sha256')
        .update(token)
        .digest('hex')

    const { data: sessao, error: erroSessao } = await supabaseAdmin
        .from('sessoes')
        .select('id_usuario, expira_em')
        .eq('token_hash', tokenHash)
        .gt('expira_em', new Date().toISOString())
        .maybeSingle()

    if (erroSessao || !sessao) {
        return null
    }

    const { data: usuario, error: erroUsuario } = await supabaseAdmin
        .from('usuario')
        .select('id_usuario, ra, nome, email, tipo_usuario, status_cadastro')
        .eq('id_usuario', sessao.id_usuario)
        .maybeSingle()

    if (erroUsuario || !usuario) {
        return null
    }

    if (usuario.status_cadastro !== 'APROVADO') {
        return null
    }

    return usuario
}

app.get('/minha-sessao', async (c) => {
    try {
        const usuario = await obterUsuarioAutenticado(c)

        if (!usuario) {
            return c.json({
                sucesso: false,
                mensagem: 'Sessão inválida ou expirada.'
            }, 401)
        }

        return c.json({
            sucesso: true,
            usuario: {
                id_usuario: usuario.id_usuario,
                nome: usuario.nome,
                tipo_usuario: usuario.tipo_usuario
            }
        })
    } catch (erro) {
        console.error('Erro ao validar sessão:', erro.message)

        return c.json({
            sucesso: false,
            mensagem: 'Erro ao verificar a sessão.'
        }, 500)
    }
})

app.post('/logout', async (c) => {
    try {
        const token = getCookie(c, 'ifplay_sessao')

        if (token && /^[a-f0-9]{64}$/.test(token)) {
            const tokenHash = createHash('sha256')
                .update(token)
                .digest('hex')

            const { error } = await supabaseAdmin
                .from('sessoes')
                .delete()
                .eq('token_hash', tokenHash)

            if (error) {
                console.error('Erro ao encerrar sessão:', error.message)
                return c.json({ sucesso: false, mensagem: 'Não foi possível encerrar a sessão.' }, 500)
            }
        }

        deleteCookie(c, 'ifplay_sessao', { path: '/' })
        return c.json({ sucesso: true })
    } catch (erro) {
        console.error(erro)
        return c.json({ sucesso: false, mensagem: 'Erro ao encerrar a sessão.' }, 500)
    }
})

app.post('/cadastro', async (c) => {

    try {

        const body = await c.req.json()
        const { ra, senha, nome, email, tipoCadastro } = body

        if (!senha || !nome || !email) {
            return c.json({ sucesso: false, mensagem: 'Preencha todos os campos.' }, 400)
        }

        const ehAluno = tipoCadastro !== 'PROFESSOR'

        if (ehAluno && !ra) {
            return c.json({ sucesso: false, mensagem: 'Digite seu RA.' }, 400)
        }

        const raLimpo = ehAluno ? String(ra).trim() : null

        if (ehAluno && !/^\d+$/.test(raLimpo)) {
            return c.json({ sucesso: false, mensagem: 'O RA deve conter apenas números.' }, 400)
        }

        const nomeLimpo = String(nome).trim()
        const emailLimpo = String(email).trim()

        if (senha.length < 6) {
            return c.json({ sucesso: false, mensagem: 'A senha precisa ter pelo menos 6 caracteres.' }, 400)
        }

        const senhaHash = await bcrypt.hash(senha, 10)

        const { data, error } = await supabaseAdmin
            .from('usuario')
            .insert([{
                ra: raLimpo,
                nome: nomeLimpo,
                email: emailLimpo,
                senha: senhaHash,
                tipo_usuario: ehAluno ? 'ALUNO' : 'PROFESSOR',
                status_cadastro: 'PENDENTE'
            }])
            .select('id_usuario')

        if (error) {

            console.error(error)

            if (error.code === '23505') {
                return c.json({ sucesso: false, mensagem: 'Esse RA ou e-mail já está cadastrado.' }, 409)
            }

            return c.json({ sucesso: false, mensagem: error.message }, 400)
        }

        return c.json({
            sucesso: true,
            mensagem: 'Cadastro enviado! Aguarde a aprovação de um administrador.'
        })

    } catch (erro) {
        console.error(erro)
        return c.json({ sucesso: false, mensagem: 'Erro interno do servidor.' }, 500)
    }

})

app.get('/cadastros/pendentes', async (c) => {

    try {


        const usuarioAutenticado = await obterUsuarioAutenticado(c)

        if (!usuarioAutenticado) {
            return c.json({
                sucesso: false,
                mensagem: 'É necessário fazer login.'
            }, 401)
        }

        if (usuarioAutenticado.tipo_usuario !== 'ADMINISTRADOR') {
            return c.json({
                sucesso: false,
                mensagem: 'Apenas administradores podem ver os cadastros pendentes.'
            }, 403)
        }

        const { data, error } = await supabaseAdmin
            .from('usuario')
            .select('id_usuario, ra, nome, email')
            .eq('status_cadastro', 'PENDENTE')
            .order('id_usuario', { ascending: true })

        if (error) {
            console.error(error)
            return c.json({ sucesso: false, mensagem: error.message }, 400)
        }

        return c.json({ sucesso: true, cadastros: data })

    } catch (erro) {
        console.error(erro)
        return c.json({ sucesso: false, mensagem: 'Erro interno do servidor.' }, 500)
    }

})

app.patch('/cadastros/:id', async (c) => {

    try {

        const usuarioAutenticado = await obterUsuarioAutenticado(c)

        if (!usuarioAutenticado) {
            return c.json({
                sucesso: false,
                mensagem: 'É necessário fazer login.'
            }, 401)
        }

        if (usuarioAutenticado.tipo_usuario !== 'ADMINISTRADOR') {
            return c.json({
                sucesso: false,
                mensagem: 'Apenas administradores podem aprovar cadastros.'
            }, 403)
        }

        const id = c.req.param('id')
        const body = await c.req.json()
        const { novoStatus, tipoUsuario } = body

        if (!['APROVADO', 'REJEITADO'].includes(novoStatus)) {
            return c.json({ sucesso: false, mensagem: 'Status inválido.' }, 400)
        }

        const atualizacao = { status_cadastro: novoStatus }

        if (novoStatus === 'APROVADO') {

            if (!['ALUNO', 'PROFESSOR', 'ADMINISTRADOR'].includes(tipoUsuario)) {
                return c.json({ sucesso: false, mensagem: 'Selecione um tipo de usuário válido.' }, 400)
            }

            atualizacao.tipo_usuario = tipoUsuario

        }

        const { data, error } = await supabaseAdmin
            .from('usuario')
            .update(atualizacao)
            .eq('id_usuario', id)
            .select('id_usuario, ra, nome, email, tipo_usuario, status_cadastro')

        if (error) {
            console.error(error)
            return c.json({ sucesso: false, mensagem: error.message }, 400)
        }

        return c.json({ sucesso: true, usuario: data[0] })

    } catch (erro) {
        console.error(erro)
        return c.json({ sucesso: false, mensagem: 'Erro interno do servidor.' }, 500)
    }

})

app.post('/login', async (c) => {

    try {

        const body = await c.req.json()

        const identificador =
            String(body.identificador || '').trim()

        const senhaFornecida =
            String(body.senha || '')

        if (!identificador || !senhaFornecida) {
            return c.json({ sucesso: false, mensagem: 'Informe o RA ou e-mail e a senha.' }, 400)
        }

        const ehEmail =
            identificador.includes('@')

        const {
            data: usuario,
            error
        } = await supabaseAdmin
            .from('usuario')
            .select('*')
            .eq(
                ehEmail ? 'email' : 'ra',
                identificador
            )
            .maybeSingle()

        if (error) {

            console.error(
                'Erro no Supabase:',
                error.message
            )

            return c.json(
                {
                    sucesso: false,
                    mensagem:
                        'Erro ao consultar o banco'
                },
                500
            )
        }

        if (!usuario) {

            return c.json(
                {
                    sucesso: false,
                    mensagem:
                        'Usuário não encontrado'
                },
                404
            )
        }

        const senhaValida =
            await bcrypt.compare(
                senhaFornecida,
                usuario.senha
            )

        if (!senhaValida) {

            return c.json(
                {
                    sucesso: false,
                    mensagem:
                        'RA ou senha inválidos'
                },
                401
            )
        }

                if (usuario.status_cadastro === 'PENDENTE') {

            return c.json(
                {
                    sucesso: false,
                    mensagem: 'Seu cadastro ainda está aguardando aprovação de um administrador.'
                },
                403
            )
        }

        if (usuario.status_cadastro === 'REJEITADO') {

            return c.json(
                {
                    sucesso: false,
                    mensagem: 'Seu cadastro foi recusado. Procure a coordenação.'
                },
                403
            )
        }

const tokenSessao = randomBytes(32).toString('hex')

        const hashSessao = createHash('sha256')
            .update(tokenSessao)
            .digest('hex')

        const expiraEm = new Date(
            Date.now() + 24 * 60 * 60 * 1000
        ).toISOString()

        const { error: erroSessao } = await supabaseAdmin
            .from('sessoes')
            .insert({
                id_usuario: usuario.id_usuario,
                token_hash: hashSessao,
                expira_em: expiraEm
            })

        if (erroSessao) {
            console.error('Erro ao criar sessão:', erroSessao.message)

            return c.json({
                sucesso: false,
                mensagem: 'Não foi possível iniciar sua sessão.'
            }, 500)
        }

        setCookie(c, 'ifplay_sessao', tokenSessao, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'Lax',
            path: '/',
            maxAge: 24 * 60 * 60
        })

        return c.json({
            sucesso: true,

            usuario: {
                id_usuario:
                    usuario.id_usuario,

                ra:
                    usuario.ra,

                nome:
                    usuario.nome,

                email:
                    usuario.email,

                tipo_usuario:
                    usuario.tipo_usuario
            }
        })

    } catch (err) {

        return c.json(
            {
                sucesso: false,
                mensagem:
                    'Erro ao processar dados'
            },
            400
        )
    }
})

app.get('/reservas', async (c) => {

    try {
        
        const usuarioAutenticado = await obterUsuarioAutenticado(c)

        if (!usuarioAutenticado) {
            return c.json({
                sucesso: false,
                mensagem: 'É necessário fazer login.'
            }, 401)
        }

        const filtro =
            c.req.query('filtro') ||
            'geral'

        const idUsuario =
            usuarioAutenticado.id_usuario

        const agora =
            new Date()

        const hoje =
            agora.toLocaleDateString(
                'en-CA',
                {
                    timeZone:
                        'America/Sao_Paulo'
                }
            )

        const horaAtual =
            agora.toLocaleTimeString(
                'en-GB',
                {
                    timeZone:
                        'America/Sao_Paulo',

                    hour12:
                        false
                }
            )

        const filtroData =
            'data_reserva.gt.' +
            hoje +
            ',and(data_reserva.eq.' +
            hoje +
            ',horario_fim.gt.' +
            horaAtual +
            ')'

        let query =
            supabaseAdmin
                .from('reserva')
                .select(
                    '*, usuario ( nome )'
                )
                .or(filtroData)
                .order(
                    'data_reserva',
                    {
                        ascending: true
                    }
                )
                .order(
                    'horario_inicio',
                    {
                        ascending: true
                    }
                )

        if (filtro === 'minhas') {

            if (!idUsuario) {

                return c.json(
                    {
                        sucesso: false,
                        mensagem:
                            'id_usuario é obrigatório.'
                    },
                    400
                )
            }

            query =
                query.eq(
                    'id_usuario',
                    idUsuario
                )

        } else if (
            filtro === 'pendentes'
        ) {

            if (usuarioAutenticado.tipo_usuario !== 'ADMINISTRADOR') {
                return c.json({ sucesso: false, mensagem: 'Apenas administradores podem ver reservas pendentes.' }, 403)
            }

            query =
                query.eq(
                    'status',
                    'PENDENTE'
                )

        } else if (
            filtro === 'calendario'
        ) {

            query =
                query.in(
                    'status',
                    [
                        'APROVADA',
                        'PENDENTE'
                    ]
                )

        } else {

            query =
                query.eq(
                    'status',
                    'APROVADA'
                )
        }

        const {
            data,
            error
        } = await query

        if (error) {

            console.error(error)

            return c.json(
                {
                    sucesso: false,
                    mensagem:
                        error.message
                },
                400
            )
        }

        return c.json({
            sucesso: true,
            reservas: data
        })

    } catch (erro) {

        console.error(erro)

        return c.json(
            {
                sucesso: false,
                mensagem:
                    'Erro interno do servidor.'
            },
            500
        )
    }
})

app.patch('/reservas/:id', async (c) => {

    try {

        const usuarioAutenticado = await obterUsuarioAutenticado(c)

        if (!usuarioAutenticado) {

            return c.json(
                {
                    sucesso: false,
                    mensagem:
                        'É necessário fazer login.'
                },
                401
            )
        }

        const id =
            c.req.param('id')

        const body =
            await c.req.json()

        const {
            novoStatus
        } = body

        const motivoCancelamento =
            typeof body.motivo === 'string'
                ? body.motivo.trim().slice(0, 300)
                : ''

        if (
            ![
                'APROVADA',
                'CANCELADA'
            ].includes(novoStatus)
        ) {

            return c.json(
                {
                    sucesso: false,
                    mensagem:
                        'Status inválido.'
                },
                400
            )
        }

        const {
            data: reserva,
            error: erroReserva
        } = await supabaseAdmin
            .from('reserva')
            .select('id_usuario, status, data_reserva, horario_inicio, horario_fim, modalidade')
            .eq('id_reserva', id)
            .maybeSingle()

        if (
            erroReserva ||
            !reserva
        ) {

            return c.json(
                {
                    sucesso: false,
                    mensagem:
                        'Reserva não encontrada.'
                },
                404
            )
        }

        const ehAdmin =
            usuarioAutenticado.tipo_usuario ===
            'ADMINISTRADOR'

        const ehDono =
            Number(
                reserva.id_usuario
            ) ===
            Number(
                usuarioAutenticado.id_usuario
            )

        if (
            novoStatus ===
            'APROVADA' &&
            !ehAdmin
        ) {

            return c.json(
                {
                    sucesso: false,
                    mensagem:
                        'Apenas administradores podem aprovar.'
                },
                403
            )
        }

        if (
            novoStatus ===
            'CANCELADA' &&
            !ehAdmin &&
            !ehDono
        ) {

            return c.json(
                {
                    sucesso: false,
                    mensagem:
                        'Você só pode cancelar suas próprias reservas.'
                },
                403
            )
        }

        // Administrador cancelando a reserva de outra pessoa: precisa explicar o motivo
        const adminCancelandoDeOutro =
            novoStatus === 'CANCELADA' &&
            ehAdmin &&
            !ehDono

        if (
            adminCancelandoDeOutro &&
            motivoCancelamento.length < 3
        ) {

            return c.json(
                {
                    sucesso: false,
                    mensagem:
                        'Explique o motivo do cancelamento.'
                },
                400
            )
        }

        const {
            data,
            error
        } = await supabaseAdmin
            .from('reserva')
            .update({
                status:
                    novoStatus
            })
            .eq(
                'id_reserva',
                id
            )
            .select()

        if (error) {

            console.error(error)

            return c.json(
                {
                    sucesso: false,
                    mensagem:
                        error.message
                },
                400
            )
        }

        // Avisa o dono da reserva (só na primeira vez que ela é cancelada)
        if (
            adminCancelandoDeOutro &&
            reserva.status !== 'CANCELADA'
        ) {

            const mensagemAviso =
                'Sua reserva de ' +
                (reserva.modalidade || 'quadra') +
                ' do dia ' +
                formatarDataBrasileira(
                    reserva.data_reserva
                ) +
                ', das ' +
                formatarHorario(
                    reserva.horario_inicio
                ) +
                ' às ' +
                formatarHorario(
                    reserva.horario_fim
                ) +
                ', foi cancelada por um administrador. Motivo: ' +
                motivoCancelamento

            const {
                error: erroAviso
            } = await supabaseAdmin
                .from('notificacao')
                .insert([{
                    mensagem:
                        mensagemAviso,
                    tipo:
                        'RESERVA_CANCELADA',
                    lida:
                        false,
                    id_usuario:
                        reserva.id_usuario
                }])

            if (erroAviso) {

                console.error(
                    'Erro ao criar notificação de cancelamento:',
                    erroAviso
                )
            }
        }

        return c.json({
            sucesso: true,
            reserva: data[0]
        })

    } catch (erro) {

        console.error(erro)

        return c.json(
            {
                sucesso: false,
                mensagem:
                    'Erro interno do servidor.'
            },
            500
        )
    }
})

function horarioParaMinutos(horario) {

    const partes =
        String(horario).split(':')

    const horas =
        Number(partes[0])

    const minutos =
        Number(partes[1])

    return (
        horas * 60 +
        minutos
    )
}

function formatarDataBrasileira(data) {

    const partes =
        String(data).split('-')

    if (partes.length !== 3) {
        return data
    }

    return (
        partes[2] +
        '/' +
        partes[1] +
        '/' +
        partes[0]
    )
}

function formatarHorario(horario) {

    return String(horario)
        .slice(0, 5)
}

app.post('/reservas', async (c) => {

    try {

        const usuarioAutenticado = await obterUsuarioAutenticado(c)

        if (!usuarioAutenticado) {

            return c.json(
                {
                    sucesso: false,
                    mensagem:
                        'É necessário fazer login.'
                },
                401
            )
        }

        const id_usuario =
            usuarioAutenticado.id_usuario

        const body =
            await c.req.json()

        const {
            data_reserva,
            horario_inicio,
            horario_fim,
            modalidade,
            tipo_reserva,
            recorrente,
            id_recorrencia
        } = body

        if (
            !data_reserva ||
            !horario_inicio ||
            !horario_fim ||
            !modalidade ||
            !id_usuario
        ) {

            return c.json(
                {
                    sucesso: false,
                    mensagem:
                        'Preencha todos os campos.'
                },
                400
            )
        }

        if (
            !/^\d{4}-\d{2}-\d{2}$/.test(String(data_reserva)) ||
            !/^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(String(horario_inicio)) ||
            !/^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(String(horario_fim)) ||
            horarioParaMinutos(horario_inicio) >= horarioParaMinutos(horario_fim)
        ) {
            return c.json({ sucesso: false, mensagem: 'Data ou horário inválido.' }, 400)
        }

        const agoraBrasilia = new Date()

        const hojeBrasilia = agoraBrasilia.toLocaleDateString('en-CA', {
            timeZone: 'America/Sao_Paulo'
        })

        const horaBrasilia = agoraBrasilia.toLocaleTimeString('en-GB', {
            timeZone: 'America/Sao_Paulo',
            hour: '2-digit',
            minute: '2-digit',
            hourCycle: 'h23'
        })

        if (
            String(data_reserva) < hojeBrasilia ||
            (
                String(data_reserva) === hojeBrasilia &&
                horarioParaMinutos(horario_inicio) < horarioParaMinutos(horaBrasilia)
            )
        ) {
            return c.json({ sucesso: false, mensagem: 'Não é possível reservar um horário que já passou.' }, 400)
        }

        const {
            data: criador,
            error: erroCriador
        } = await supabaseAdmin
            .from('usuario')
            .select('tipo_usuario')
            .eq(
                'id_usuario',
                id_usuario
            )
            .maybeSingle()

        if (
            erroCriador ||
            !criador
        ) {

            return c.json(
                {
                    sucesso: false,
                    mensagem:
                        'Usuário inválido.'
                },
                400
            )
        }

        const {
            data: reservasDoDia,
            error: erroConflito
        } = await supabaseAdmin
            .from('reserva')
            .select(
                'id_reserva, horario_inicio, horario_fim, status, id_usuario, usuario(tipo_usuario)'
            )
            .eq(
                'data_reserva',
                data_reserva
            )
            .neq(
                'status',
                'CANCELADA'
            )

        if (erroConflito) {

            console.error(
                'Erro ao verificar conflito:',
                erroConflito
            )

            return c.json(
                {
                    sucesso: false,
                    mensagem:
                        'Não foi possível verificar a disponibilidade do horário.'
                },
                500
            )
        }

        const novoInicio =
            horarioParaMinutos(
                horario_inicio
            )

        const novoFim =
            horarioParaMinutos(
                horario_fim
            )

        const reservasConflitantes =
            reservasDoDia.filter(
                function (reservaExistente) {

                    const inicioExistente =
                        horarioParaMinutos(
                            reservaExistente.horario_inicio
                        )

                    const fimExistente =
                        horarioParaMinutos(
                            reservaExistente.horario_fim
                        )

                    return (
                        inicioExistente <
                            novoFim &&
                        fimExistente >
                            novoInicio
                    )
                }
            )

        const possuiPrioridade =
            criador.tipo_usuario ===
                'PROFESSOR' ||
            criador.tipo_usuario ===
                'ADMINISTRADOR'

        if (
            reservasConflitantes.length >
            0
        ) {

            if (!possuiPrioridade) {

                return c.json(
                    {
                        sucesso: false,
                        mensagem:
                            'Este horário já possui uma reserva. Escolha outro período.'
                    },
                    409
                )
            }

            const existeConflitoPrioritario =
                reservasConflitantes.some(
                    function (
                        reservaExistente
                    ) {

                        return (
                            !reservaExistente.usuario ||
                            reservaExistente.usuario.tipo_usuario !==
                                'ALUNO'
                        )
                    }
                )

            if (
                existeConflitoPrioritario
            ) {

                return c.json(
                    {
                        sucesso: false,
                        mensagem:
                            'Este horário já possui uma reserva de professor ou administrador.'
                    },
                    409
                )
            }
        }

        const status =
            criador.tipo_usuario ===
            'ALUNO'
                ? 'PENDENTE'
                : 'APROVADA'

        const reservasParaRestaurar =
            reservasConflitantes.map(
                function (reserva) {

                    return {
                        id_reserva:
                            reserva.id_reserva,

                        status:
                            reserva.status,

                        id_usuario:
                            reserva.id_usuario
                    }
                }
            )

        if (
            possuiPrioridade &&
            reservasParaRestaurar.length >
                0
        ) {

            const idsReservasAlunos =
                reservasParaRestaurar.map(
                    function (reserva) {
                        return reserva.id_reserva
                    }
                )

            const {
                error: erroCancelamento
            } = await supabaseAdmin
                .from('reserva')
                .update({
                    status:
                        'CANCELADA'
                })
                .in(
                    'id_reserva',
                    idsReservasAlunos
                )

            if (erroCancelamento) {

                console.error(
                    'Erro ao cancelar reservas dos alunos:',
                    erroCancelamento
                )

                return c.json(
                    {
                        sucesso: false,
                        mensagem:
                            'Não foi possível aplicar a prioridade da reserva.'
                    },
                    500
                )
            }
        }

        const {
            data: novaReserva,
            error: erroNovaReserva
        } = await supabaseAdmin
            .from('reserva')
            .insert([
                {
                    data_reserva:
                        data_reserva,

                    horario_inicio:
                        horario_inicio,

                    horario_fim:
                        horario_fim,

                    modalidade:
                        modalidade,

                    status:
                        status,

                    tipo_reserva:
                        tipo_reserva,

                    recorrente:
                        recorrente,

                    id_usuario:
                        id_usuario,

                    id_recorrencia:
                        id_recorrencia ||
                        null
                }
            ])
            .select()
            .maybeSingle()

        if (erroNovaReserva) {

            console.error(
                erroNovaReserva
            )

            if (
                reservasParaRestaurar.length >
                0
            ) {

                for (
                    const reservaOriginal
                    of reservasParaRestaurar
                ) {

                    const {
                        error:
                            erroRestauracao
                    } = await supabaseAdmin
                        .from('reserva')
                        .update({
                            status:
                                reservaOriginal.status
                        })
                        .eq(
                            'id_reserva',
                            reservaOriginal.id_reserva
                        )

                    if (erroRestauracao) {

                        console.error(
                            'Erro ao restaurar reserva:',
                            reservaOriginal.id_reserva,
                            erroRestauracao
                        )
                    }
                }
            }

            if (
                erroNovaReserva.code ===
                '23505'
            ) {

                return c.json(
                    {
                        sucesso: false,
                        mensagem:
                            'Este horário já possui uma reserva. Escolha outro período.'
                    },
                    409
                )
            }

            return c.json(
                {
                    sucesso: false,
                    mensagem:
                        erroNovaReserva.message
                },
                400
            )
        }

        if (
            possuiPrioridade &&
            reservasParaRestaurar.length >
                0
        ) {

            const usuariosNotificados =
                [
                    ...new Set(
                        reservasParaRestaurar.map(
                            function (
                                reserva
                            ) {

                                return Number(
                                    reserva.id_usuario
                                )
                            }
                        )
                    )
                ]

            const mensagem =
                'Sua reserva de ' +
                formatarDataBrasileira(
                    data_reserva
                ) +
                ', das ' +
                formatarHorario(
                    horario_inicio
                ) +
                ' às ' +
                formatarHorario(
                    horario_fim
                ) +
                ', foi cancelada devido à prioridade de uma reserva institucional.'

            const notificacoes =
                usuariosNotificados.map(
                    function (
                        idUsuarioAluno
                    ) {

                        return {
                            mensagem:
                                mensagem,

                            tipo:
                                'RESERVA_CANCELADA',

                            lida:
                                false,

                            id_usuario:
                                idUsuarioAluno
                        }
                    }
                )

            const {
                error: erroNotificacao
            } = await supabaseAdmin
                .from('notificacao')
                .insert(
                    notificacoes
                )

            if (erroNotificacao) {

                console.error(
                    'Erro ao criar notificações:',
                    erroNotificacao
                )
            }
        }

        return c.json({
            sucesso: true,
            reserva:
                novaReserva
        })

    } catch (erro) {

        console.error(erro)

        return c.json(
            {
                sucesso: false,
                mensagem:
                    'Erro interno do servidor.'
            },
            500
        )
    }
})

app.get('/notificacoes', async (c) => {

    try {

        const usuarioAutenticado = await obterUsuarioAutenticado(c)

        if (!usuarioAutenticado) {
            return c.json({ sucesso: false, mensagem: 'É necessário fazer login.' }, 401)
        }

        const idUsuario = usuarioAutenticado.id_usuario

        const {
            data,
            error
        } = await supabaseAdmin
            .from('notificacao')
            .select(
                'id_notificacao, mensagem, tipo, lida, data_envio, id_usuario'
            )
            .eq(
                'id_usuario',
                idUsuario
            )
            .order(
                'data_envio',
                {
                    ascending:
                        false
                }
            )

        if (error) {

            console.error(error)

            return c.json(
                {
                    sucesso: false,
                    mensagem:
                        'Não foi possível carregar as notificações.'
                },
                400
            )
        }

        return c.json({
            sucesso: true,
            notificacoes:
                data
        })

    } catch (erro) {

        console.error(erro)

        return c.json(
            {
                sucesso: false,
                mensagem:
                    'Erro interno do servidor.'
            },
            500
        )
    }
})

app.patch('/notificacoes/:id', async (c) => {

    try {

        const id =
            c.req.param('id')

        const usuarioAutenticado = await obterUsuarioAutenticado(c)

        if (!usuarioAutenticado) {
            return c.json({ sucesso: false, mensagem: 'É necessário fazer login.' }, 401)
        }

        const idUsuario = usuarioAutenticado.id_usuario

        const {
            data: notificacao,
            error: erroNotificacao
        } = await supabaseAdmin
            .from('notificacao')
            .select(
                'id_notificacao, id_usuario, lida'
            )
            .eq(
                'id_notificacao',
                id
            )
            .maybeSingle()

        if (
            erroNotificacao ||
            !notificacao
        ) {

            return c.json(
                {
                    sucesso: false,
                    mensagem:
                        'Notificação não encontrada.'
                },
                404
            )
        }

        const ehDono =
            Number(
                notificacao.id_usuario
            ) ===
            Number(
                idUsuario
            )

        if (!ehDono) {

            return c.json(
                {
                    sucesso: false,
                    mensagem:
                        'Você não pode alterar esta notificação.'
                },
                403
            )
        }

        if (notificacao.lida) {

            return c.json({
                sucesso: true,
                notificacao:
                    notificacao
            })
        }

        const {
            data,
            error
        } = await supabaseAdmin
            .from('notificacao')
            .update({
                lida:
                    true
            })
            .eq(
                'id_notificacao',
                id
            )
            .eq(
                'id_usuario',
                idUsuario
            )
            .select(
                'id_notificacao, mensagem, tipo, lida, data_envio, id_usuario'
            )
            .maybeSingle()

        if (error) {

            console.error(error)

            return c.json(
                {
                    sucesso: false,
                    mensagem:
                        'Não foi possível atualizar a notificação.'
                },
                400
            )
        }

        if (!data) {

            return c.json(
                {
                    sucesso: false,
                    mensagem:
                        'A notificação não foi atualizada.'
                },
                409
            )
        }

        return c.json({
            sucesso: true,
            notificacao:
                data
        })

    } catch (erro) {

        console.error(erro)

        return c.json(
            {
                sucesso: false,
                mensagem:
                    'Erro interno do servidor.'
            },
            500
        )
    }
})

app.post('/reclamacoes', async (c) => {

    try {

        const usuarioAutenticado = await obterUsuarioAutenticado(c)

        if (!usuarioAutenticado) {
            return c.json({ sucesso: false, mensagem: 'É necessário fazer login.' }, 401)
        }

        const body =
            await c.req.parseBody()

        const { descricao } = body
        const id_usuario = usuarioAutenticado.id_usuario

        const foto =
            body.foto

        if (
            !descricao ||
            !String(descricao).trim()
        ) {

            return c.json(
                {
                    sucesso: false,
                    mensagem:
                        'Preencha a descrição.'
                },
                400
            )
        }

        if (typeof descricao !== 'string' || descricao.trim().length > 5000) {
            return c.json({ sucesso: false, mensagem: 'Descrição inválida ou muito longa.' }, 400)
        }

        let imagemUrl =
            null

        if (
            foto &&
            foto instanceof File &&
            foto.size > 0
        ) {

            const tiposPermitidos = {
                'image/jpeg': 'jpg',
                'image/png': 'png',
                'image/webp': 'webp'
            }

            if (!tiposPermitidos[foto.type] || foto.size > 5 * 1024 * 1024) {
                return c.json({ sucesso: false, mensagem: 'Envie uma imagem JPG, PNG ou WebP de até 5 MB.' }, 400)
            }

            const nomeArquivo =
                randomBytes(16).toString('hex') +
                '.' +
                tiposPermitidos[foto.type]

            const buffer =
                await foto.arrayBuffer()

            const {
                error: erroUpload
            } = await supabaseAdmin
                .storage
                .from('reclamacoes')
                .upload(
                    nomeArquivo,
                    buffer,
                    {
                        contentType:
                            foto.type
                    }
                )

            if (erroUpload) {

                console.error(
                    erroUpload
                )

                return c.json(
                    {
                        sucesso: false,
                        mensagem:
                            'Erro ao enviar a imagem.'
                    },
                    400
                )
            }

            const {
                data: urlData
            } = supabaseAdmin
                .storage
                .from('reclamacoes')
                .getPublicUrl(
                    nomeArquivo
                )

            imagemUrl =
                urlData.publicUrl
        }

        const {
            data,
            error
        } = await supabaseAdmin
            .from('reclamacao')
            .insert([
                {
                    descricao:
                        descricao,

                    id_usuario:
                        id_usuario,

                    status:
                        'PENDENTE',

                    imagem_anexo:
                        imagemUrl
                }
            ])
            .select()

        if (error) {

            console.error(error)

            return c.json(
                {
                    sucesso: false,
                    mensagem:
                        error.message
                },
                400
            )
        }

        return c.json({
            sucesso: true,
            reclamacao:
                data[0]
        })

    } catch (erro) {

        console.error(erro)

        return c.json(
            {
                sucesso: false,
                mensagem:
                    'Erro interno do servidor.'
            },
            500
        )
    }
})

app.get('/reclamacoes', async (c) => {

    try {

        const usuarioAutenticado = await obterUsuarioAutenticado(c)

        if (!usuarioAutenticado) {
            return c.json({ sucesso: false, mensagem: 'É necessário fazer login.' }, 401)
        }

        const idUsuario = usuarioAutenticado.id_usuario

        let consulta =
            supabaseAdmin
                .from('reclamacao')
                .select(
                    '*, usuario(nome)'
                )
                .order(
                    'data_envio',
                    {
                        ascending:
                            false
                    }
                )

        if (
            usuarioAutenticado.tipo_usuario ===
                'ALUNO' ||
            usuarioAutenticado.tipo_usuario ===
                'PROFESSOR'
        ) {

            consulta =
                consulta.eq(
                    'id_usuario',
                    idUsuario
                )
        }

        const {
            data,
            error
        } = await consulta

        if (error) {

            console.error(error)

            return c.json(
                {
                    sucesso: false,
                    mensagem:
                        error.message
                },
                400
            )
        }

        return c.json({
            sucesso: true,
            reclamacoes: data
        })

    } catch (erro) {

        console.error(erro)

        return c.json(
            {
                sucesso: false,
                mensagem:
                    'Erro interno do servidor.'
            },
            500
        )
    }
})

app.delete('/reclamacoes/:id', async (c) => {

    try {

        const id =
            c.req.param('id')

        const usuarioAutenticado = await obterUsuarioAutenticado(c)

        if (!usuarioAutenticado) {
            return c.json({ sucesso: false, mensagem: 'É necessário fazer login.' }, 401)
        }

        const idUsuario = usuarioAutenticado.id_usuario

        const {
            data: reclamacao,
            error: erroReclamacao
        } = await supabaseAdmin
            .from('reclamacao')
            .select(
                'id_reclamacao, id_usuario, status'
            )
            .eq(
                'id_reclamacao',
                id
            )
            .maybeSingle()

        if (
            erroReclamacao ||
            !reclamacao
        ) {

            return c.json(
                {
                    sucesso: false,
                    mensagem:
                        'Reclamação não encontrada.'
                },
                404
            )
        }

        const ehAutor =
            Number(
                reclamacao.id_usuario
            ) ===
            Number(
                idUsuario
            )

        if (!ehAutor) {

            return c.json(
                {
                    sucesso: false,
                    mensagem:
                        'Você só pode excluir suas próprias reclamações.'
                },
                403
            )
        }

        if (
            reclamacao.status !==
            'PENDENTE'
        ) {

            return c.json(
                {
                    sucesso: false,
                    mensagem:
                        'Apenas reclamações pendentes podem ser excluídas.'
                },
                403
            )
        }

        const {
            data: reclamacaoExcluida,
            error: erroExclusao
        } = await supabaseAdmin
            .from('reclamacao')
            .delete()
            .eq(
                'id_reclamacao',
                id
            )
            .eq(
                'id_usuario',
                idUsuario
            )
            .eq(
                'status',
                'PENDENTE'
            )
            .select(
                'id_reclamacao'
            )
            .maybeSingle()

        if (erroExclusao) {

            console.error(
                erroExclusao
            )

            return c.json(
                {
                    sucesso: false,
                    mensagem:
                        'Não foi possível excluir a reclamação.'
                },
                400
            )
        }

        if (!reclamacaoExcluida) {

            return c.json(
                {
                    sucesso: false,
                    mensagem:
                        'A reclamação não foi excluída. Atualize a página e tente novamente.'
                },
                409
            )
        }

        return c.json({
            sucesso: true,
            mensagem:
                'Reclamação excluída com sucesso.'
        })

    } catch (erro) {

        console.error(erro)

        return c.json(
            {
                sucesso: false,
                mensagem:
                    'Erro interno do servidor.'
            },
            500
        )
    }
})

app.patch('/reclamacoes/:id', async (c) => {

    try {

        const id =
            c.req.param('id')

        const body =
            await c.req.json()

        const { resposta } = body

        if (typeof resposta !== 'string' || !resposta.trim() || resposta.length > 5000) {
            return c.json({ sucesso: false, mensagem: 'Escreva uma resposta válida.' }, 400)
        }

        const usuarioAutenticado = await obterUsuarioAutenticado(c)

        if (!usuarioAutenticado) {
            return c.json({ sucesso: false, mensagem: 'É necessário fazer login.' }, 401)
        }

        if (usuarioAutenticado.tipo_usuario !== 'ADMINISTRADOR') {
            return c.json({ sucesso: false, mensagem: 'Apenas administradores podem responder.' }, 403)
        }

        const {
            data,
            error
        } = await supabaseAdmin
            .from('reclamacao')
            .update({
                resposta:
                    resposta,

                status:
                    'RESOLVIDA'
            })
            .eq(
                'id_reclamacao',
                id
            )
            .select()

        if (error) {

            console.error(error)

            return c.json(
                {
                    sucesso: false,
                    mensagem:
                        error.message
                },
                400
            )
        }

        return c.json({
            sucesso: true,
            reclamacao:
                data[0]
        })

    } catch (erro) {

        console.error(erro)

        return c.json(
            {
                sucesso: false,
                mensagem:
                    'Erro interno do servidor.'
            },
            500
        )
    }
})

registrarRotasHistoricoFeedback(app, supabaseAdmin, obterUsuarioAutenticado)

serve(
    {
        fetch:
            app.fetch,

        port:
            Number(process.env.PORT) || 3333
    },

    function (info) {

        console.log(
            'Servidor rodando em http://localhost:' +
            info.port
        )
    }
)