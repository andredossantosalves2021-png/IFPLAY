import 'dotenv/config'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { createClient } from '@supabase/supabase-js'
import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import bcrypt from 'bcryptjs'

const app = new Hono()

app.use('*', cors())

app.use(
    '/*',
    serveStatic({
        root: './public'
    })
)

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_KEY
)

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

        const { data, error } = await supabase
            .from('usuario')
            .insert([{
                ra: raLimpo,
                nome: nomeLimpo,
                email: emailLimpo,
                senha: senhaHash,
                tipo_usuario: ehAluno ? 'ALUNO' : 'PROFESSOR',
                status_cadastro: 'PENDENTE'
            }])
            .select()

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

        const idUsuarioAdmin = c.req.query('id_usuario_admin')

        if (!idUsuarioAdmin) {
            return c.json({ sucesso: false, mensagem: 'id_usuario_admin é obrigatório.' }, 400)
        }

        const { data: admin, error: erroAdmin } = await supabase
            .from('usuario')
            .select('tipo_usuario')
            .eq('id_usuario', idUsuarioAdmin)
            .maybeSingle()

        if (erroAdmin || !admin || admin.tipo_usuario !== 'ADMINISTRADOR') {
            return c.json({ sucesso: false, mensagem: 'Apenas administradores podem ver os cadastros pendentes.' }, 403)
        }

        const { data, error } = await supabase
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

        const id = c.req.param('id')
        const body = await c.req.json()
        const { novoStatus, id_usuario_admin, tipoUsuario } = body

        if (!['APROVADO', 'REJEITADO'].includes(novoStatus)) {
            return c.json({ sucesso: false, mensagem: 'Status inválido.' }, 400)
        }

        const { data: admin, error: erroAdmin } = await supabase
            .from('usuario')
            .select('tipo_usuario')
            .eq('id_usuario', id_usuario_admin)
            .maybeSingle()

        if (erroAdmin || !admin || admin.tipo_usuario !== 'ADMINISTRADOR') {
            return c.json({ sucesso: false, mensagem: 'Apenas administradores podem aprovar cadastros.' }, 403)
        }

        const atualizacao = { status_cadastro: novoStatus }

        if (novoStatus === 'APROVADO') {

            if (!['ALUNO', 'PROFESSOR', 'ADMINISTRADOR'].includes(tipoUsuario)) {
                return c.json({ sucesso: false, mensagem: 'Selecione um tipo de usuário válido.' }, 400)
            }

            atualizacao.tipo_usuario = tipoUsuario

        }

        const { data, error } = await supabase
            .from('usuario')
            .update(atualizacao)
            .eq('id_usuario', id)
            .select()

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
            String(body.identificador).trim()

        const senhaFornecida =
            String(body.senha).trim()

        const ehEmail =
            identificador.includes('@')

        const {
            data: usuario,
            error
        } = await supabase
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

        const filtro =
            c.req.query('filtro') ||
            'geral'

        const idUsuario =
            c.req.query('id_usuario')

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
            supabase
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

        const id =
            c.req.param('id')

        const body =
            await c.req.json()

        const {
            novoStatus,
            id_usuario_acao
        } = body

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
        } = await supabase
            .from('reserva')
            .select('id_usuario')
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

        const {
            data: usuarioAcao,
            error: erroUsuario
        } = await supabase
            .from('usuario')
            .select('tipo_usuario')
            .eq(
                'id_usuario',
                id_usuario_acao
            )
            .maybeSingle()

        if (
            erroUsuario ||
            !usuarioAcao
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

        const ehAdmin =
            usuarioAcao.tipo_usuario ===
            'ADMINISTRADOR'

        const ehDono =
            Number(
                reserva.id_usuario
            ) ===
            Number(
                id_usuario_acao
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

        const {
            data,
            error
        } = await supabase
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

        const body =
            await c.req.json()

        const {
            data_reserva,
            horario_inicio,
            horario_fim,
            modalidade,
            tipo_reserva,
            recorrente,
            id_usuario,
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

        const {
            data: criador,
            error: erroCriador
        } = await supabase
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
        } = await supabase
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
            } = await supabase
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
        } = await supabase
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
                    } = await supabase
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
            } = await supabase
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

        const idUsuario =
            c.req.query('id_usuario')

        if (!idUsuario) {

            return c.json(
                {
                    sucesso: false,
                    mensagem:
                        'ID do usuário é obrigatório.'
                },
                400
            )
        }

        const {
            data: usuario,
            error: erroUsuario
        } = await supabase
            .from('usuario')
            .select('id_usuario')
            .eq(
                'id_usuario',
                idUsuario
            )
            .maybeSingle()

        if (
            erroUsuario ||
            !usuario
        ) {

            return c.json(
                {
                    sucesso: false,
                    mensagem:
                        'Usuário não encontrado.'
                },
                404
            )
        }

        const {
            data,
            error
        } = await supabase
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

        const body =
            await c.req.json()

        const idUsuario =
            body.id_usuario

        if (!idUsuario) {

            return c.json(
                {
                    sucesso: false,
                    mensagem:
                        'ID do usuário é obrigatório.'
                },
                400
            )
        }

        const {
            data: notificacao,
            error: erroNotificacao
        } = await supabase
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
        } = await supabase
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

        const body =
            await c.req.parseBody()

        const {
            descricao,
            id_usuario
        } = body

        const foto =
            body.foto

        if (
            !descricao ||
            !id_usuario
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

        let imagemUrl =
            null

        if (
            foto &&
            foto instanceof File &&
            foto.size > 0
        ) {

            const nomeArquivo =
                String(Date.now()) +
                '_' +
                foto.name

            const buffer =
                await foto.arrayBuffer()

            const {
                error: erroUpload
            } = await supabase
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
            } = supabase
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
        } = await supabase
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

        const idUsuario =
            c.req.query('id_usuario')

        if (!idUsuario) {

            return c.json(
                {
                    sucesso: false,
                    mensagem:
                        'ID do usuário é obrigatório.'
                },
                400
            )
        }

        const {
            data: usuario,
            error: erroUsuario
        } = await supabase
            .from('usuario')
            .select('tipo_usuario')
            .eq(
                'id_usuario',
                idUsuario
            )
            .maybeSingle()

        if (
            erroUsuario ||
            !usuario
        ) {

            return c.json(
                {
                    sucesso: false,
                    mensagem:
                        'Usuário não encontrado.'
                },
                404
            )
        }

        let consulta =
            supabase
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
            usuario.tipo_usuario ===
                'ALUNO' ||
            usuario.tipo_usuario ===
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

        const idUsuario =
            c.req.query('id_usuario')

        if (!idUsuario) {

            return c.json(
                {
                    sucesso: false,
                    mensagem:
                        'ID do usuário é obrigatório.'
                },
                400
            )
        }

        const {
            data: reclamacao,
            error: erroReclamacao
        } = await supabase
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
        } = await supabase
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

        const {
            resposta,
            id_usuario_admin
        } = body

        if (!resposta) {

            return c.json(
                {
                    sucesso: false,
                    mensagem:
                        'Escreva uma resposta.'
                },
                400
            )
        }

        const {
            data: admin,
            error: erroAdmin
        } = await supabase
            .from('usuario')
            .select('tipo_usuario')
            .eq(
                'id_usuario',
                id_usuario_admin
            )
            .maybeSingle()

        if (
            erroAdmin ||
            !admin ||
            admin.tipo_usuario !==
            'ADMINISTRADOR'
        ) {

            return c.json(
                {
                    sucesso: false,
                    mensagem:
                        'Apenas administradores podem responder.'
                },
                403
            )
        }

        const {
            data,
            error
        } = await supabase
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

serve(
    {
        fetch:
            app.fetch,

        port:
            3333
    },

    function (info) {

        console.log(
            'Servidor rodando em http://localhost:' +
            info.port
        )
    }
)