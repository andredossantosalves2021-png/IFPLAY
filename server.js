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

app.post('/login', async (c) => {

    try {

        const body = await c.req.json()

        const raFornecido =
            String(body.ra).trim()

        const senhaFornecida =
            String(body.senha).trim()

        const {
            data: usuario,
            error
        } = await supabase
            .from('usuario')
            .select('*')
            .eq('ra', raFornecido)
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
            data: reservasDoDia,
            error: erroConflito
        } = await supabase
            .from('reserva')
            .select(
                'id_reserva, horario_inicio, horario_fim, status'
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

        const existeConflito =
            reservasDoDia.some(
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

        if (existeConflito) {

            return c.json(
                {
                    sucesso: false,
                    mensagem:
                        'Este horário já possui uma reserva. Escolha outro período.'
                },
                409
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

        const status =
            criador.tipo_usuario ===
            'ALUNO'
                ? 'PENDENTE'
                : 'APROVADA'

        const {
            data,
            error
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

        if (error) {

            console.error(error)

            if (
                error.code ===
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