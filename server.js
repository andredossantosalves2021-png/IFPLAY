import 'dotenv/config'
import { Hono } from 'hono'
import { createClient } from '@supabase/supabase-js'
import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import bcrypt from 'bcryptjs'
import { randomBytes, createHash, randomUUID } from 'node:crypto'
import { setCookie, getCookie, deleteCookie } from 'hono/cookie'
import { registrarRotasHistoricoFeedback } from './rotas-historico-feedback.js'
import { registrarRotasContasBloqueios } from './rotas-contas-bloqueios.js'

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

// ---------- Páginas protegidas ----------
// Antes, as telas só conferiam o localStorage, que qualquer um edita no
// navegador. Agora o servidor só entrega as páginas .html internas para
// quem tem uma sessão válida (cookie), e as de administrador só para admin.
// Regra "negar por padrão": toda página .html é protegida, menos as públicas.

const PAGINAS_PUBLICAS = new Set([
    '/',
    '/index.html',
    '/cadastro/cadastro.html',
    '/redefinir/redefinir.html'
])

const PAGINAS_ADMIN = new Set([
    '/cadastros/cadastros.html',
    '/historico/historico.html',
    '/usuarios/usuarios.html',
    '/bloqueios/bloqueios.html'
])

function normalizarCaminho(caminho) {

    let texto

    try {
        texto = decodeURIComponent(caminho)
    } catch {
        texto = caminho
    }

    const partes = []

    for (const parte of texto.replace(/\\/g, '/').split('/')) {

        if (parte === '' || parte === '.') {
            continue
        }

        if (parte === '..') {
            partes.pop()
            continue
        }

        partes.push(parte)
    }

    return ('/' + partes.join('/')).toLowerCase()
}

function paginaSemPermissao(mensagem) {

    return (
        '<!DOCTYPE html><html lang="pt-br"><head><meta charset="UTF-8">' +
        '<meta name="viewport" content="width=device-width, initial-scale=1.0">' +
        '<title>IFPlay</title></head>' +
        '<body style="font-family:sans-serif;display:flex;align-items:center;' +
        'justify-content:center;height:100vh;margin:0;color:#374151">' +
        '<p>' + mensagem + '</p></body></html>'
    )
}

app.use('*', async (c, next) => {

    if (c.req.method !== 'GET' && c.req.method !== 'HEAD') {
        return next()
    }

    const caminho = normalizarCaminho(c.req.path)

    const ehPagina =
        caminho.endsWith('.html') ||
        caminho.endsWith('.htm')

    if (!ehPagina || PAGINAS_PUBLICAS.has(caminho)) {
        return next()
    }

    const usuario = await obterUsuarioAutenticado(c)

    if (!usuario) {

        // Dentro do iframe do dashboard, o próprio dashboard leva para o login
        return c.redirect('/index.html', 302)
    }

    if (
        PAGINAS_ADMIN.has(caminho) &&
        usuario.tipo_usuario !== 'ADMINISTRADOR'
    ) {
        return c.html(
            paginaSemPermissao('Esta página é só para administradores.'),
            403
        )
    }

    c.header('Cache-Control', 'no-store')

    return next()
})

app.use(
    '/*',
    serveStatic({
        root: './public'
    })
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

        if (
            typeof senha !== 'string' ||
            typeof nome !== 'string' ||
            typeof email !== 'string' ||
            (ra != null && typeof ra !== 'string' && typeof ra !== 'number')
        ) {
            return c.json({ sucesso: false, mensagem: 'Dados inválidos.' }, 400)
        }

        const ehAluno = tipoCadastro !== 'PROFESSOR'

        if (ehAluno && !ra) {
            return c.json({ sucesso: false, mensagem: 'Digite seu RA.' }, 400)
        }

        const raLimpo = ehAluno ? String(ra).trim() : null

        if (ehAluno && !/^\d{1,20}$/.test(raLimpo)) {
            return c.json({ sucesso: false, mensagem: 'O RA deve conter apenas números.' }, 400)
        }

        // Nome: só letras (com acento), espaços, apóstrofo, ponto e hífen.
        // Isso também impede que alguém cadastre HTML/JavaScript no lugar do nome.
        const nomeLimpo = nome.trim().replace(/\s+/g, ' ')
        const emailLimpo = email.trim().toLowerCase()

        if (!/^[\p{L}][\p{L}\p{M} '.-]{1,99}$/u.test(nomeLimpo)) {
            return c.json({ sucesso: false, mensagem: 'Digite um nome válido (só letras e espaços).' }, 400)
        }

        if (
            emailLimpo.length > 254 ||
            !/^[^\s@<>"'`]+@[^\s@<>"'`]+\.[^\s@<>"'`]+$/.test(emailLimpo)
        ) {
            return c.json({ sucesso: false, mensagem: 'Digite um e-mail válido.' }, 400)
        }

        if (senha.length < 6) {
            return c.json({ sucesso: false, mensagem: 'A senha precisa ter pelo menos 6 caracteres.' }, 400)
        }

        if (Buffer.byteLength(senha, 'utf8') > 72) {
            return c.json({ sucesso: false, mensagem: 'A senha pode ter no máximo 72 caracteres.' }, 400)
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

        await notificarAdministradores(
            'Novo cadastro de ' +
            (ehAluno ? 'aluno' : 'professor') +
            ' aguardando aprovação: ' +
            nomeLimpo +
            (ehAluno ? ' (RA ' + raLimpo + ')' : '') +
            '. Veja na tela de Cadastros.',
            'CADASTRO_PENDENTE'
        )

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

        // Esta rota só decide cadastros novos (pendentes). Mudanças em contas
        // já existentes passam pela tela de Usuários, que tem as próprias regras.
        const { data: cadastro } = await supabaseAdmin
            .from('usuario')
            .select('id_usuario, status_cadastro')
            .eq('id_usuario', id)
            .maybeSingle()

        if (!cadastro) {
            return c.json({ sucesso: false, mensagem: 'Cadastro não encontrado.' }, 404)
        }

        if (cadastro.status_cadastro !== 'PENDENTE') {
            return c.json({ sucesso: false, mensagem: 'Este cadastro já foi analisado.' }, 409)
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

// ---------- Limite de tentativas de login ----------
// Fica na memória do servidor (zera se o Render reiniciar), o que já basta
// para impedir alguém de testar milhares de senhas seguidas.
const JANELA_TENTATIVAS_MS = 15 * 60 * 1000
const MAX_FALHAS_POR_CONTA = 5
const MAX_FALHAS_POR_IP = 30
const falhasLogin = new Map()

function obterIpCliente(c) {

    // No Render, o último endereço do X-Forwarded-For é o que o próprio
    // Render adicionou (o do cliente); os anteriores podem ser inventados.
    const encaminhado = c.req.header('x-forwarded-for')

    if (encaminhado) {
        const partes = encaminhado.split(',').map((p) => p.trim()).filter(Boolean)
        if (partes.length > 0) return partes[partes.length - 1]
    }

    return 'local'
}

function contarFalhas(chave) {

    const registro = falhasLogin.get(chave)

    if (!registro || Date.now() - registro.inicio > JANELA_TENTATIVAS_MS) {
        falhasLogin.delete(chave)
        return 0
    }

    return registro.quantidade
}

function registrarFalha(chave) {

    const atual = contarFalhas(chave)

    if (atual === 0) {
        falhasLogin.set(chave, { quantidade: 1, inicio: Date.now() })
    } else {
        falhasLogin.get(chave).quantidade = atual + 1
    }
}

setInterval(() => {
    for (const [chave, registro] of falhasLogin) {
        if (Date.now() - registro.inicio > JANELA_TENTATIVAS_MS) {
            falhasLogin.delete(chave)
        }
    }
}, 5 * 60 * 1000).unref()

// Hash de mentira para comparar quando o usuário não existe: assim a resposta
// demora o mesmo tempo e não dá para descobrir quais RAs/e-mails existem.
const HASH_FALSO = bcrypt.hashSync('senha-que-ninguem-usa-' + randomBytes(8).toString('hex'), 10)

const MENSAGEM_LOGIN_INVALIDO = 'RA/e-mail ou senha inválidos.'

app.post('/login', async (c) => {

    try {

        const body = await c.req.json()

        const identificadorBruto =
            String(body.identificador || '').trim()

        const senhaFornecida =
            String(body.senha || '')

        if (!identificadorBruto || !senhaFornecida) {
            return c.json({ sucesso: false, mensagem: 'Informe o RA ou e-mail e a senha.' }, 400)
        }

        const ehEmail =
            identificadorBruto.includes('@')

        const identificador =
            ehEmail
                ? identificadorBruto.toLowerCase()
                : identificadorBruto

        const chaveConta = 'conta:' + identificador
        const chaveIp = 'ip:' + obterIpCliente(c)

        if (
            contarFalhas(chaveConta) >= MAX_FALHAS_POR_CONTA ||
            contarFalhas(chaveIp) >= MAX_FALHAS_POR_IP
        ) {
            return c.json({
                sucesso: false,
                mensagem: 'Muitas tentativas erradas. Espere 15 minutos e tente de novo.'
            }, 429)
        }

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

        const senhaValida =
            await bcrypt.compare(
                senhaFornecida,
                usuario ? usuario.senha : HASH_FALSO
            )

        // Mesma mensagem para "não existe" e "senha errada"
        if (!usuario || !senhaValida) {

            registrarFalha(chaveConta)
            registrarFalha(chaveIp)

            return c.json(
                {
                    sucesso: false,
                    mensagem:
                        MENSAGEM_LOGIN_INVALIDO
                },
                401
            )
        }

        falhasLogin.delete(chaveConta)

                if (usuario.status_cadastro === 'PENDENTE') {

            return c.json(
                {
                    sucesso: false,
                    mensagem: 'Seu cadastro ainda está aguardando aprovação de um administrador.'
                },
                403
            )
        }

        if (usuario.status_cadastro === 'DESATIVADO') {

            return c.json(
                {
                    sucesso: false,
                    mensagem: 'Sua conta foi desativada. Procure a coordenação.'
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

        // Aproveita o login para apagar sessões vencidas (de qualquer pessoa)
        const { error: erroLimpeza } = await supabaseAdmin
            .from('sessoes')
            .delete()
            .lt('expira_em', new Date().toISOString())

        if (erroLimpeza) {
            console.error('Erro ao limpar sessões vencidas:', erroLimpeza.message)
        }

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
                    '*, usuario!fk_reserva_usuario ( nome )'
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

        // Só reservas pendentes podem ser aprovadas (uma cancelada não "volta"
        // sem passar de novo pela checagem de conflito)
        if (
            novoStatus === 'APROVADA' &&
            reserva.status !== 'PENDENTE'
        ) {

            return c.json(
                {
                    sucesso: false,
                    mensagem:
                        reserva.status === 'APROVADA'
                            ? 'Esta reserva já foi aprovada.'
                            : 'Esta reserva foi cancelada e não pode ser aprovada.'
                },
                409
            )
        }

        if (
            novoStatus === 'CANCELADA' &&
            reserva.status === 'CANCELADA'
        ) {

            return c.json({
                sucesso: true,
                reserva: reserva
            })
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
                    novoStatus,

                atualizado_por:
                    usuarioAutenticado.id_usuario,

                atualizado_em:
                    new Date().toISOString(),

                motivo_cancelamento:
                    novoStatus === 'CANCELADA'
                        ? (
                            adminCancelandoDeOutro
                                ? motivoCancelamento
                                : 'Cancelada por quem fez a reserva.'
                        )
                        : null
            })
            .eq(
                'id_reserva',
                id
            )
            // Só muda se ninguém mudou antes (dois admins ao mesmo tempo)
            .eq(
                'status',
                reserva.status
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

        if (!data || data.length === 0) {

            return c.json(
                {
                    sucesso: false,
                    mensagem:
                        'Outra pessoa alterou esta reserva agora há pouco. Atualize a página.'
                },
                409
            )
        }

        // Avisa o dono da reserva quando um administrador cancela
        if (
            adminCancelandoDeOutro
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

        // Avisa o dono quando a reserva pendente é aprovada (só uma vez)
        if (
            novoStatus === 'APROVADA' &&
            reserva.status === 'PENDENTE' &&
            !ehDono
        ) {

            const mensagemAprovada =
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
                ', foi aprovada. Bom jogo!'

            const {
                error: erroAprovada
            } = await supabaseAdmin
                .from('notificacao')
                .insert([{
                    mensagem:
                        mensagemAprovada,
                    tipo:
                        'RESERVA_APROVADA',
                    lida:
                        false,
                    id_usuario:
                        reserva.id_usuario
                }])

            if (erroAprovada) {

                console.error(
                    'Erro ao criar notificação de aprovação:',
                    erroAprovada
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

// Manda a mesma notificação para todos os administradores.
// Se falhar, só registra o erro: a ação principal (reserva, reclamação,
// cadastro) já foi salva e não deve ser desfeita por causa do aviso.
async function notificarAdministradores(mensagem, tipo) {

    try {

        const {
            data: admins,
            error: erroAdmins
        } = await supabaseAdmin
            .from('usuario')
            .select('id_usuario')
            .eq('tipo_usuario', 'ADMINISTRADOR')

        if (erroAdmins) {
            console.error('Erro ao buscar administradores:', erroAdmins)
            return
        }

        if (!admins || admins.length === 0) {
            return
        }

        const { error: erroAviso } = await supabaseAdmin
            .from('notificacao')
            .insert(admins.map((admin) => ({
                mensagem: mensagem,
                tipo: tipo,
                lida: false,
                id_usuario: admin.id_usuario
            })))

        if (erroAviso) {
            console.error('Erro ao avisar administradores (' + tipo + '):', erroAviso)
        }

    } catch (erro) {
        console.error('Erro ao avisar administradores (' + tipo + '):', erro)
    }
}

// Limites de qualquer reserva (única ou recorrente)
const HORARIO_ABERTURA_MINUTOS = 7 * 60
const HORARIO_FECHAMENTO_MINUTOS = 21 * 60
const DURACAO_MAXIMA_MINUTOS = 4 * 60

// ---------- Criação de reservas (única e recorrente) ----------
// As duas telas usam a mesma função, então as regras são as mesmas:
// horário de funcionamento, limite de 4h, conflitos e prioridade de
// professor/administrador sobre aluno. Tudo é conferido ANTES de gravar,
// e todas as datas entram num único INSERT: ou cria tudo, ou nada.

const TIPOS_RESERVA = ['JOGO_LIVRE', 'AULA', 'EVENTO']
const REGEX_DATA = /^\d{4}-\d{2}-\d{2}$/
const REGEX_HORA = /^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/
const MAX_DATAS_RECORRENTES = 16
const MOTIVO_PRIORIDADE = 'Cancelada pela prioridade de uma reserva de professor ou administrador.'

function agoraEmBrasilia() {

    const agora = new Date()

    return {
        hoje: agora.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }),
        hora: agora.toLocaleTimeString('en-GB', {
            timeZone: 'America/Sao_Paulo',
            hour: '2-digit',
            minute: '2-digit',
            hourCycle: 'h23'
        })
    }
}

function dataEhValida(data) {

    if (!REGEX_DATA.test(String(data))) {
        return false
    }

    const [ano, mes, dia] = String(data).split('-').map(Number)
    const teste = new Date(Date.UTC(ano, mes - 1, dia))

    return (
        teste.getUTCFullYear() === ano &&
        teste.getUTCMonth() === mes - 1 &&
        teste.getUTCDate() === dia
    )
}

// Limite de reservas por aluno: no máximo 3 por semana (segunda a domingo),
// contando pendentes e aprovadas.
const LIMITE_RESERVAS_SEMANA_ALUNO = 3

function semanaDaData(data) {

    const [ano, mes, dia] = String(data).split('-').map(Number)
    const base = new Date(Date.UTC(ano, mes - 1, dia))
    const diasDesdeSegunda = (base.getUTCDay() + 6) % 7

    const segunda = new Date(base)
    segunda.setUTCDate(base.getUTCDate() - diasDesdeSegunda)

    const domingo = new Date(segunda)
    domingo.setUTCDate(segunda.getUTCDate() + 6)

    const paraTexto = (d) => d.toISOString().slice(0, 10)

    return { inicio: paraTexto(segunda), fim: paraTexto(domingo) }
}

// Procura um bloqueio que pegue alguma das datas no horário pedido
async function encontrarBloqueio(datas, inicioMinutos, fimMinutos) {

    const ordenadas = [...datas].sort()

    const { data: bloqueios, error } = await supabaseAdmin
        .from('bloqueio')
        .select('id_bloqueio, data_inicio, data_fim, horario_inicio, horario_fim, motivo')
        .lte('data_inicio', ordenadas[ordenadas.length - 1])
        .gte('data_fim', ordenadas[0])

    if (error) {
        console.error('Erro ao buscar bloqueios:', error)
        return { erro: true }
    }

    for (const data of ordenadas) {
        for (const b of bloqueios || []) {

            const pegaData = String(b.data_inicio) <= data && String(b.data_fim) >= data

            const pegaHorario =
                !b.horario_inicio ||
                (horarioParaMinutos(b.horario_inicio) < fimMinutos &&
                 horarioParaMinutos(b.horario_fim) > inicioMinutos)

            if (pegaData && pegaHorario) {
                return { encontrado: b, data }
            }
        }
    }

    return { encontrado: null }
}

function listaDeDatas(datas) {
    return datas.map(formatarDataBrasileira).join(', ')
}

function resposta(status, corpo) {
    return { status, corpo }
}

async function criarReservas(usuarioAutenticado, datas, dados) {

    const { horario_inicio, horario_fim } = dados
    const modalidade = typeof dados.modalidade === 'string' ? dados.modalidade.trim() : ''
    const tipoReserva = TIPOS_RESERVA.includes(dados.tipo_reserva) ? dados.tipo_reserva : 'JOGO_LIVRE'
    const recorrente = datas.length > 1 || Boolean(dados.recorrente)

    if (datas.length === 0 || !horario_inicio || !horario_fim || !modalidade) {
        return resposta(400, { sucesso: false, mensagem: 'Preencha todos os campos.' })
    }

    if (modalidade.length > 60) {
        return resposta(400, { sucesso: false, mensagem: 'O nome da atividade pode ter no máximo 60 caracteres.' })
    }

    if (
        !datas.every(dataEhValida) ||
        !REGEX_HORA.test(String(horario_inicio)) ||
        !REGEX_HORA.test(String(horario_fim)) ||
        horarioParaMinutos(horario_inicio) >= horarioParaMinutos(horario_fim)
    ) {
        return resposta(400, { sucesso: false, mensagem: 'Data ou horário inválido.' })
    }

    const novoInicio = horarioParaMinutos(horario_inicio)
    const novoFim = horarioParaMinutos(horario_fim)

    if (novoInicio < HORARIO_ABERTURA_MINUTOS || novoFim > HORARIO_FECHAMENTO_MINUTOS) {
        return resposta(400, { sucesso: false, mensagem: 'A quadra pode ser reservada das 07:00 às 21:00.' })
    }

    if (novoFim - novoInicio > DURACAO_MAXIMA_MINUTOS) {
        return resposta(400, { sucesso: false, mensagem: 'A reserva pode durar no máximo 4 horas.' })
    }

    const { hoje, hora } = agoraEmBrasilia()

    const datasNoPassado = datas.filter((data) =>
        data < hoje ||
        (data === hoje && novoInicio < horarioParaMinutos(hora))
    )

    if (datasNoPassado.length > 0) {
        return resposta(400, {
            sucesso: false,
            mensagem: datas.length === 1
                ? 'Não é possível reservar um horário que já passou.'
                : 'Estas datas já passaram nesse horário: ' + listaDeDatas(datasNoPassado) + '. Nada foi criado.'
        })
    }

    const possuiPrioridade =
        usuarioAutenticado.tipo_usuario === 'PROFESSOR' ||
        usuarioAutenticado.tipo_usuario === 'ADMINISTRADOR'

    // Horários bloqueados pelo administrador valem para todo mundo
    const bloqueio = await encontrarBloqueio(datas, novoInicio, novoFim)

    if (bloqueio.erro) {
        return resposta(500, { sucesso: false, mensagem: 'Não foi possível verificar os bloqueios de horário.' })
    }

    if (bloqueio.encontrado) {
        return resposta(409, {
            sucesso: false,
            mensagem:
                'A quadra está bloqueada em ' + formatarDataBrasileira(bloqueio.data) +
                (bloqueio.encontrado.horario_inicio
                    ? ', das ' + formatarHorario(bloqueio.encontrado.horario_inicio) + ' às ' + formatarHorario(bloqueio.encontrado.horario_fim)
                    : ' (dia inteiro)') +
                ': ' + bloqueio.encontrado.motivo +
                (datas.length > 1 ? '. Nada foi criado.' : '')
        })
    }

    if (usuarioAutenticado.tipo_usuario === 'ALUNO') {

        for (const data of datas) {

            const semana = semanaDaData(data)

            const { count, error: erroLimite } = await supabaseAdmin
                .from('reserva')
                .select('id_reserva', { count: 'exact', head: true })
                .eq('id_usuario', usuarioAutenticado.id_usuario)
                .in('status', ['PENDENTE', 'APROVADA'])
                .gte('data_reserva', semana.inicio)
                .lte('data_reserva', semana.fim)

            if (erroLimite) {
                console.error('Erro ao conferir limite semanal:', erroLimite)
                return resposta(500, { sucesso: false, mensagem: 'Não foi possível conferir o seu limite de reservas.' })
            }

            if ((count || 0) >= LIMITE_RESERVAS_SEMANA_ALUNO) {
                return resposta(409, {
                    sucesso: false,
                    mensagem:
                        'Você já tem ' + LIMITE_RESERVAS_SEMANA_ALUNO + ' reservas na semana de ' +
                        formatarDataBrasileira(semana.inicio) + ' a ' + formatarDataBrasileira(semana.fim) +
                        ' (contando as pendentes). Cancele uma ou escolha outra semana.'
                })
            }
        }
    }

    const { data: reservasDasDatas, error: erroConflito } = await supabaseAdmin
        .from('reserva')
        .select('id_reserva, data_reserva, horario_inicio, horario_fim, status, modalidade, id_usuario, usuario!fk_reserva_usuario(tipo_usuario)')
        .in('data_reserva', datas)
        .neq('status', 'CANCELADA')

    if (erroConflito) {
        console.error('Erro ao verificar conflito:', erroConflito)
        return resposta(500, { sucesso: false, mensagem: 'Não foi possível verificar a disponibilidade do horário.' })
    }

    const conflitantes = (reservasDasDatas || []).filter((existente) =>
        datas.includes(String(existente.data_reserva)) &&
        horarioParaMinutos(existente.horario_inicio) < novoFim &&
        horarioParaMinutos(existente.horario_fim) > novoInicio
    )

    const conflitosQueBloqueiam = possuiPrioridade
        ? conflitantes.filter((r) => !r.usuario || r.usuario.tipo_usuario !== 'ALUNO')
        : conflitantes

    if (conflitosQueBloqueiam.length > 0) {

        const datasBloqueadas = [...new Set(conflitosQueBloqueiam.map((r) => String(r.data_reserva)))].sort()

        let mensagem

        if (datas.length > 1) {
            mensagem = 'Já existe reserva nesse horário em: ' + listaDeDatas(datasBloqueadas) + '. Nada foi criado.'
        } else if (possuiPrioridade) {
            mensagem = 'Este horário já possui uma reserva de professor ou administrador.'
        } else {
            mensagem = 'Este horário já possui uma reserva. Escolha outro período.'
        }

        return resposta(409, { sucesso: false, mensagem, datas_com_conflito: datasBloqueadas })
    }

    // Reservas de aluno que vão ceder lugar à reserva prioritária
    const reservasDeAlunos = possuiPrioridade ? conflitantes : []
    const agoraIso = new Date().toISOString()

    if (reservasDeAlunos.length > 0) {

        const { error: erroCancelamento } = await supabaseAdmin
            .from('reserva')
            .update({
                status: 'CANCELADA',
                motivo_cancelamento: MOTIVO_PRIORIDADE,
                atualizado_por: usuarioAutenticado.id_usuario,
                atualizado_em: agoraIso
            })
            .in('id_reserva', reservasDeAlunos.map((r) => r.id_reserva))

        if (erroCancelamento) {
            console.error('Erro ao cancelar reservas dos alunos:', erroCancelamento)
            return resposta(500, { sucesso: false, mensagem: 'Não foi possível aplicar a prioridade da reserva.' })
        }
    }

    const status = usuarioAutenticado.tipo_usuario === 'ALUNO' ? 'PENDENTE' : 'APROVADA'
    const idRecorrencia = recorrente ? randomUUID() : null

    const { data: novasReservas, error: erroNovaReserva } = await supabaseAdmin
        .from('reserva')
        .insert(datas.map((data) => ({
            data_reserva: data,
            horario_inicio,
            horario_fim,
            modalidade,
            status,
            tipo_reserva: tipoReserva,
            recorrente,
            id_usuario: usuarioAutenticado.id_usuario,
            id_recorrencia: idRecorrencia
        })))
        .select()

    if (erroNovaReserva) {

        console.error(erroNovaReserva)

        // Devolve as reservas dos alunos ao que eram antes
        for (const original of reservasDeAlunos) {

            const { error: erroRestauracao } = await supabaseAdmin
                .from('reserva')
                .update({
                    status: original.status,
                    motivo_cancelamento: null,
                    atualizado_por: null,
                    atualizado_em: null
                })
                .eq('id_reserva', original.id_reserva)

            if (erroRestauracao) {
                console.error('Erro ao restaurar reserva:', original.id_reserva, erroRestauracao)
            }
        }

        // 23505 = índice único; 23P01 = restrição de sobreposição do banco
        if (erroNovaReserva.code === '23505' || erroNovaReserva.code === '23P01') {
            return resposta(409, {
                sucesso: false,
                mensagem: datas.length > 1
                    ? 'Alguém reservou um desses horários agora há pouco. Nada foi criado; tente de novo.'
                    : 'Este horário já possui uma reserva. Escolha outro período.'
            })
        }

        return resposta(400, { sucesso: false, mensagem: 'Não foi possível criar a reserva.' })
    }

    // Cada aluno recebe o aviso com o horário da reserva DELE
    if (reservasDeAlunos.length > 0) {

        const avisos = reservasDeAlunos.map((reserva) => ({
            mensagem:
                'Sua reserva de ' +
                (reserva.modalidade || 'quadra') +
                ' do dia ' +
                formatarDataBrasileira(reserva.data_reserva) +
                ', das ' +
                formatarHorario(reserva.horario_inicio) +
                ' às ' +
                formatarHorario(reserva.horario_fim) +
                ', foi cancelada devido à prioridade de uma reserva institucional.',
            tipo: 'RESERVA_CANCELADA',
            lida: false,
            id_usuario: reserva.id_usuario
        }))

        const { error: erroNotificacao } = await supabaseAdmin
            .from('notificacao')
            .insert(avisos)

        if (erroNotificacao) {
            console.error('Erro ao criar notificações:', erroNotificacao)
        }
    }

    // Reserva de aluno chega como pendente: avisa os administradores
    if (status === 'PENDENTE') {

        await notificarAdministradores(
            (usuarioAutenticado.nome || 'Um aluno') +
            ' pediu uma reserva de ' +
            modalidade +
            (datas.length === 1
                ? ' para o dia ' + formatarDataBrasileira(datas[0])
                : ' para os dias ' + listaDeDatas(datas)) +
            ', das ' +
            formatarHorario(horario_inicio) +
            ' às ' +
            formatarHorario(horario_fim) +
            '. Aprove ou recuse na tela de Reservas.',
            'RESERVA_PENDENTE'
        )
    }

    return resposta(200, {
        sucesso: true,
        reserva: novasReservas[0],
        reservas: novasReservas
    })
}

app.post('/reservas', async (c) => {

    try {

        const usuarioAutenticado = await obterUsuarioAutenticado(c)

        if (!usuarioAutenticado) {
            return c.json({ sucesso: false, mensagem: 'É necessário fazer login.' }, 401)
        }

        const body = await c.req.json()

        const { status, corpo } = await criarReservas(
            usuarioAutenticado,
            body.data_reserva ? [String(body.data_reserva)] : [],
            { ...body, recorrente: false }
        )

        return c.json(corpo, status)

    } catch (erro) {
        console.error(erro)
        return c.json({ sucesso: false, mensagem: 'Erro interno do servidor.' }, 500)
    }
})

// Reserva recorrente: todas as datas de uma vez (só professor e administrador)
app.post('/reservas/recorrente', async (c) => {

    try {

        const usuarioAutenticado = await obterUsuarioAutenticado(c)

        if (!usuarioAutenticado) {
            return c.json({ sucesso: false, mensagem: 'É necessário fazer login.' }, 401)
        }

        if (usuarioAutenticado.tipo_usuario === 'ALUNO') {
            return c.json({ sucesso: false, mensagem: 'Apenas professores e administradores podem criar reservas recorrentes.' }, 403)
        }

        const body = await c.req.json()

        const datas = Array.isArray(body.datas)
            ? [...new Set(body.datas.map(String))].sort()
            : []

        if (datas.length === 0 || datas.length > MAX_DATAS_RECORRENTES) {
            return c.json({ sucesso: false, mensagem: 'Escolha entre 1 e 16 semanas.' }, 400)
        }

        const { status, corpo } = await criarReservas(
            usuarioAutenticado,
            datas,
            { ...body, recorrente: true }
        )

        return c.json(corpo, status)

    } catch (erro) {
        console.error(erro)
        return c.json({ sucesso: false, mensagem: 'Erro interno do servidor.' }, 500)
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

// Marca várias notificações como lidas de uma vez.
// Fica antes de '/notificacoes/:id' para "lidas" não ser lido como um id.
app.patch('/notificacoes/lidas', async (c) => {

    try {

        const usuarioAutenticado = await obterUsuarioAutenticado(c)

        if (!usuarioAutenticado) {
            return c.json({ sucesso: false, mensagem: 'É necessário fazer login.' }, 401)
        }

        let body = {}

        try {
            body = await c.req.json()
        } catch {
            body = {}
        }

        const ids = Array.isArray(body.ids)
            ? [...new Set(body.ids.map(Number))]
            : []

        if (
            ids.length === 0 ||
            ids.length > 500 ||
            !ids.every((id) => Number.isInteger(id) && id > 0)
        ) {
            return c.json({ sucesso: false, mensagem: 'Lista de notificações inválida.' }, 400)
        }

        // O filtro por id_usuario garante que só as notificações da própria
        // pessoa são alteradas, mesmo que venham ids de outra pessoa.
        const { data, error } = await supabaseAdmin
            .from('notificacao')
            .update({ lida: true })
            .in('id_notificacao', ids)
            .eq('id_usuario', usuarioAutenticado.id_usuario)
            .select('id_notificacao')

        if (error) {
            console.error(error)
            return c.json({ sucesso: false, mensagem: 'Não foi possível atualizar as notificações.' }, 400)
        }

        return c.json({
            sucesso: true,
            ids: (data || []).map((n) => n.id_notificacao)
        })

    } catch (erro) {
        console.error(erro)
        return c.json({ sucesso: false, mensagem: 'Erro interno do servidor.' }, 500)
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

        const descricaoCurta =
            descricao.trim().length > 120
                ? descricao.trim().slice(0, 117) + '...'
                : descricao.trim()

        await notificarAdministradores(
            (usuarioAutenticado.nome || 'Um usuário') +
            ' enviou uma reclamação: "' +
            descricaoCurta +
            '". Veja na tela de Reclamações.',
            'RECLAMACAO_NOVA'
        )

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

registrarRotasContasBloqueios(app, {
    supabase: supabaseAdmin,
    obterUsuarioAutenticado,
    contarFalhas,
    registrarFalha,
    obterIpCliente,
    agoraEmBrasilia,
    horarioParaMinutos,
    formatarDataBrasileira,
    formatarHorario
})

// ---------- Pendentes que passaram do horário ----------
// Uma reserva pendente que terminou sem ser analisada é cancelada sozinha,
// libera o histórico do admin e o aluno recebe um aviso.
async function expirarPendentesVencidas() {

    try {

        const { hoje, hora } = agoraEmBrasilia()

        const { data: pendentes, error } = await supabaseAdmin
            .from('reserva')
            .select('id_reserva, data_reserva, horario_inicio, horario_fim, modalidade, id_usuario')
            .eq('status', 'PENDENTE')
            .lte('data_reserva', hoje)

        if (error) {
            console.error('Erro ao buscar pendentes vencidas:', error)
            return
        }

        const vencidas = (pendentes || []).filter((r) =>
            String(r.data_reserva) < hoje ||
            horarioParaMinutos(r.horario_fim) <= horarioParaMinutos(hora)
        )

        if (vencidas.length === 0) {
            return
        }

        const { data: canceladas, error: erroUpdate } = await supabaseAdmin
            .from('reserva')
            .update({
                status: 'CANCELADA',
                motivo_cancelamento: 'Não foi analisada por um administrador antes do horário.',
                atualizado_em: new Date().toISOString()
            })
            .in('id_reserva', vencidas.map((r) => r.id_reserva))
            .eq('status', 'PENDENTE')
            .select('id_reserva')

        if (erroUpdate) {
            console.error('Erro ao cancelar pendentes vencidas:', erroUpdate)
            return
        }

        const idsCancelados = new Set((canceladas || []).map((r) => r.id_reserva))

        const avisos = vencidas
            .filter((r) => idsCancelados.has(r.id_reserva))
            .map((r) => ({
                mensagem:
                    'Sua reserva de ' +
                    (r.modalidade || 'quadra') +
                    ' do dia ' +
                    formatarDataBrasileira(r.data_reserva) +
                    ', das ' +
                    formatarHorario(r.horario_inicio) +
                    ' às ' +
                    formatarHorario(r.horario_fim) +
                    ', não foi analisada a tempo e foi cancelada.',
                tipo: 'RESERVA_CANCELADA',
                lida: false,
                id_usuario: r.id_usuario
            }))

        if (avisos.length > 0) {

            const { error: erroAviso } = await supabaseAdmin
                .from('notificacao')
                .insert(avisos)

            if (erroAviso) {
                console.error('Erro ao avisar pendentes vencidas:', erroAviso)
            }
        }

    } catch (erro) {
        console.error('Erro ao expirar pendentes:', erro)
    }
}

setTimeout(expirarPendentesVencidas, 30 * 1000)
setInterval(expirarPendentesVencidas, 10 * 60 * 1000)

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