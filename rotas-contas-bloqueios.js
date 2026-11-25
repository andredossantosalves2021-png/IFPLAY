// Rotas de contas (esqueci minha senha, gestão de usuários), bloqueios de
// horário e o lembrete por e-mail antes da reserva.
//
// Registrado no server.js com:
//   registrarRotasContasBloqueios(app, { supabase, obterUsuarioAutenticado, ... })

import bcrypt from 'bcryptjs'
import { randomBytes, createHash } from 'node:crypto'
import { enviarEmail, montarHtml, escaparHtml, urlDoSite, emailConfigurado } from './email.js'

const VALIDADE_LINK_MINUTOS = 60
const REGEX_DATA = /^\d{4}-\d{2}-\d{2}$/
const REGEX_HORA = /^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/
const TIPOS_USUARIO = ['ALUNO', 'PROFESSOR', 'ADMINISTRADOR']
const MENSAGEM_ESQUECI =
    'Se esse e-mail estiver cadastrado, enviamos um link para criar uma nova senha. ' +
    'Confira também a caixa de spam. O link vale por 1 hora.'

function hashToken(token) {
    return createHash('sha256').update(token).digest('hex')
}

function dataValida(data) {

    if (!REGEX_DATA.test(String(data))) return false

    const [ano, mes, dia] = String(data).split('-').map(Number)
    const teste = new Date(Date.UTC(ano, mes - 1, dia))

    return teste.getUTCFullYear() === ano && teste.getUTCMonth() === mes - 1 && teste.getUTCDate() === dia
}

function senhaValida(senha) {
    return typeof senha === 'string' && senha.length >= 6 && Buffer.byteLength(senha, 'utf8') <= 72
}

export function registrarRotasContasBloqueios(app, deps) {

    const {
        supabase,
        obterUsuarioAutenticado,
        contarFalhas,
        registrarFalha,
        obterIpCliente,
        agoraEmBrasilia,
        horarioParaMinutos,
        formatarDataBrasileira,
        formatarHorario
    } = deps

    async function exigirAdmin(c) {

        const usuario = await obterUsuarioAutenticado(c)

        if (!usuario) {
            return { resposta: c.json({ sucesso: false, mensagem: 'É necessário fazer login.' }, 401) }
        }

        if (usuario.tipo_usuario !== 'ADMINISTRADOR') {
            return { resposta: c.json({ sucesso: false, mensagem: 'Apenas administradores.' }, 403) }
        }

        return { usuario }
    }

    // ---------- Saúde (para o cron-job.org manter o Render acordado) ----------

    app.get('/saude', (c) => c.json({ ok: true }))

    // ---------- Redefinição de senha ----------

    async function enviarLinkRedefinicao(usuario, pedidoPeloAdmin) {

        // Um link por vez: apaga os anteriores ainda não usados
        await supabase
            .from('redefinicao_senha')
            .delete()
            .eq('id_usuario', usuario.id_usuario)
            .is('usado_em', null)

        const token = randomBytes(32).toString('hex')

        const { error } = await supabase
            .from('redefinicao_senha')
            .insert({
                id_usuario: usuario.id_usuario,
                token_hash: hashToken(token),
                expira_em: new Date(Date.now() + VALIDADE_LINK_MINUTOS * 60 * 1000).toISOString()
            })

        if (error) {
            console.error('Erro ao criar link de redefinição:', error)
            return { ok: false }
        }

        // O token vai depois do # para não aparecer nos registros do servidor
        const link = urlDoSite() + '/REDEFINIR/redefinir.html#token=' + token

        const resultado = await enviarEmail({
            para: usuario.email,
            nome: usuario.nome,
            assunto: 'IFPlay: crie uma nova senha',
            html: montarHtml({
                titulo: 'Criar uma nova senha',
                paragrafos: [
                    'Olá, ' + escaparHtml(usuario.nome) + '!',
                    pedidoPeloAdmin
                        ? 'Um administrador do IFPlay pediu a redefinição da sua senha.'
                        : 'Recebemos um pedido para redefinir a sua senha do IFPlay.',
                    'O link abaixo vale por 1 hora e só pode ser usado uma vez.'
                ],
                botao: { texto: 'Criar nova senha', url: link }
            }) + '<p style="font-family:Arial,sans-serif;font-size:12px;color:#6b7280;text-align:center">' +
                'Se você não pediu isso, ignore este e-mail: sua senha continua a mesma.</p>',
            texto:
                'Olá, ' + usuario.nome + '!\n\nPara criar uma nova senha do IFPlay, abra o link (vale por 1 hora):\n' +
                link + '\n\nSe você não pediu isso, ignore este e-mail.'
        })

        return { ok: true, enviado: resultado.enviado, simulado: Boolean(resultado.simulado) }
    }

    app.post('/esqueci-senha', async (c) => {

        try {

            const body = await c.req.json().catch(() => ({}))
            const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''

            if (!email || email.length > 254 || !email.includes('@')) {
                return c.json({ sucesso: false, mensagem: 'Digite o e-mail da sua conta.' }, 400)
            }

            // Limite: 3 pedidos por e-mail e 10 por endereço de internet a cada 15 min
            const chaveEmail = 'esqueci:' + email
            const chaveIp = 'esqueci-ip:' + obterIpCliente(c)

            if (contarFalhas(chaveEmail) >= 3 || contarFalhas(chaveIp) >= 10) {
                return c.json({ sucesso: false, mensagem: 'Muitos pedidos seguidos. Espere 15 minutos e tente de novo.' }, 429)
            }

            registrarFalha(chaveEmail)
            registrarFalha(chaveIp)

            const { data: usuario } = await supabase
                .from('usuario')
                .select('id_usuario, nome, email, status_cadastro')
                .eq('email', email)
                .maybeSingle()

            // Mesma resposta exista ou não a conta (não revela quem está cadastrado)
            if (usuario && usuario.status_cadastro === 'APROVADO') {
                await enviarLinkRedefinicao(usuario, false)
            }

            return c.json({ sucesso: true, mensagem: MENSAGEM_ESQUECI })

        } catch (erro) {
            console.error(erro)
            return c.json({ sucesso: false, mensagem: 'Erro interno do servidor.' }, 500)
        }
    })

    app.post('/redefinir-senha', async (c) => {

        try {

            const body = await c.req.json().catch(() => ({}))
            const token = typeof body.token === 'string' ? body.token : ''

            if (!/^[a-f0-9]{64}$/.test(token)) {
                return c.json({ sucesso: false, mensagem: 'Link inválido. Peça um novo.' }, 400)
            }

            if (!senhaValida(body.senha)) {
                return c.json({ sucesso: false, mensagem: 'A senha precisa ter entre 6 e 72 caracteres.' }, 400)
            }

            const { data: pedido } = await supabase
                .from('redefinicao_senha')
                .select('id_redefinicao, id_usuario, expira_em, usado_em')
                .eq('token_hash', hashToken(token))
                .maybeSingle()

            if (!pedido || pedido.usado_em || new Date(pedido.expira_em) < new Date()) {
                return c.json({ sucesso: false, mensagem: 'Este link expirou ou já foi usado. Peça um novo.' }, 400)
            }

            // Marca como usado primeiro (o filtro usado_em = null impede uso duplo)
            const { data: marcado } = await supabase
                .from('redefinicao_senha')
                .update({ usado_em: new Date().toISOString() })
                .eq('id_redefinicao', pedido.id_redefinicao)
                .is('usado_em', null)
                .select('id_redefinicao')

            if (!marcado || marcado.length === 0) {
                return c.json({ sucesso: false, mensagem: 'Este link já foi usado. Peça um novo.' }, 400)
            }

            const { error: erroSenha } = await supabase
                .from('usuario')
                .update({ senha: await bcrypt.hash(body.senha, 10) })
                .eq('id_usuario', pedido.id_usuario)

            if (erroSenha) {
                console.error('Erro ao salvar nova senha:', erroSenha)
                return c.json({ sucesso: false, mensagem: 'Não foi possível salvar a nova senha.' }, 500)
            }

            // Encerra as sessões abertas: quem tinha a senha antiga sai
            await supabase.from('sessoes').delete().eq('id_usuario', pedido.id_usuario)

            return c.json({ sucesso: true, mensagem: 'Senha alterada! Entre com a nova senha.' })

        } catch (erro) {
            console.error(erro)
            return c.json({ sucesso: false, mensagem: 'Erro interno do servidor.' }, 500)
        }
    })

    // ---------- Gestão de usuários (admin) ----------

    app.get('/usuarios', async (c) => {

        try {

            const { resposta } = await exigirAdmin(c)
            if (resposta) return resposta

            const { data, error } = await supabase
                .from('usuario')
                .select('id_usuario, nome, ra, email, tipo_usuario, status_cadastro')
                .order('nome', { ascending: true })

            if (error) {
                console.error(error)
                return c.json({ sucesso: false, mensagem: 'Não foi possível carregar os usuários.' }, 400)
            }

            return c.json({ sucesso: true, usuarios: data, email_configurado: emailConfigurado() })

        } catch (erro) {
            console.error(erro)
            return c.json({ sucesso: false, mensagem: 'Erro interno do servidor.' }, 500)
        }
    })

    app.patch('/usuarios/:id', async (c) => {

        try {

            const { usuario: admin, resposta } = await exigirAdmin(c)
            if (resposta) return resposta

            const id = Number(c.req.param('id'))
            const body = await c.req.json().catch(() => ({}))

            if (!Number.isInteger(id) || id <= 0) {
                return c.json({ sucesso: false, mensagem: 'Usuário inválido.' }, 400)
            }

            const atualizacao = {}

            if (body.tipo_usuario !== undefined) {
                if (!TIPOS_USUARIO.includes(body.tipo_usuario)) {
                    return c.json({ sucesso: false, mensagem: 'Tipo de usuário inválido.' }, 400)
                }
                atualizacao.tipo_usuario = body.tipo_usuario
            }

            if (body.status_cadastro !== undefined) {
                if (!['APROVADO', 'DESATIVADO'].includes(body.status_cadastro)) {
                    return c.json({ sucesso: false, mensagem: 'Situação inválida.' }, 400)
                }
                atualizacao.status_cadastro = body.status_cadastro
            }

            if (Object.keys(atualizacao).length === 0) {
                return c.json({ sucesso: false, mensagem: 'Nada para alterar.' }, 400)
            }

            // Um administrador não muda a função nem desativa outro administrador
            const { data: alvo } = await supabase
                .from('usuario')
                .select('id_usuario, tipo_usuario')
                .eq('id_usuario', id)
                .maybeSingle()

            if (!alvo) {
                return c.json({ sucesso: false, mensagem: 'Usuário não encontrado.' }, 404)
            }

            if (
                alvo.tipo_usuario === 'ADMINISTRADOR' &&
                id !== Number(admin.id_usuario) &&
                ((atualizacao.tipo_usuario && atualizacao.tipo_usuario !== 'ADMINISTRADOR') ||
                 atualizacao.status_cadastro === 'DESATIVADO')
            ) {
                return c.json({ sucesso: false, mensagem: 'Um administrador não pode mudar a função nem desativar outro administrador.' }, 403)
            }

            // Evita que o admin tire o próprio acesso sem querer
            if (
                id === Number(admin.id_usuario) &&
                (atualizacao.status_cadastro === 'DESATIVADO' ||
                 (atualizacao.tipo_usuario && atualizacao.tipo_usuario !== 'ADMINISTRADOR'))
            ) {
                return c.json({ sucesso: false, mensagem: 'Você não pode desativar nem tirar o seu próprio acesso de administrador.' }, 400)
            }

            const { data, error } = await supabase
                .from('usuario')
                .update(atualizacao)
                .eq('id_usuario', id)
                .select('id_usuario, nome, ra, email, tipo_usuario, status_cadastro')

            if (error) {
                console.error(error)
                return c.json({ sucesso: false, mensagem: 'Não foi possível atualizar o usuário.' }, 400)
            }

            if (!data || data.length === 0) {
                return c.json({ sucesso: false, mensagem: 'Usuário não encontrado.' }, 404)
            }

            // Desativou: derruba as sessões abertas dessa pessoa
            if (atualizacao.status_cadastro === 'DESATIVADO') {
                await supabase.from('sessoes').delete().eq('id_usuario', id)
            }

            return c.json({ sucesso: true, usuario: data[0] })

        } catch (erro) {
            console.error(erro)
            return c.json({ sucesso: false, mensagem: 'Erro interno do servidor.' }, 500)
        }
    })

    app.post('/usuarios/:id/redefinir-senha', async (c) => {

        try {

            const { resposta } = await exigirAdmin(c)
            if (resposta) return resposta

            const id = Number(c.req.param('id'))

            const { data: usuario } = await supabase
                .from('usuario')
                .select('id_usuario, nome, email, status_cadastro')
                .eq('id_usuario', id)
                .maybeSingle()

            if (!usuario) {
                return c.json({ sucesso: false, mensagem: 'Usuário não encontrado.' }, 404)
            }

            if (usuario.status_cadastro !== 'APROVADO') {
                return c.json({ sucesso: false, mensagem: 'Só é possível redefinir a senha de contas ativas.' }, 400)
            }

            const resultado = await enviarLinkRedefinicao(usuario, true)

            if (!resultado.ok) {
                return c.json({ sucesso: false, mensagem: 'Não foi possível criar o link.' }, 500)
            }

            if (resultado.simulado) {
                return c.json({
                    sucesso: true,
                    mensagem: 'O envio de e-mail ainda não está configurado no servidor. O link apareceu no terminal do servidor.'
                })
            }

            if (!resultado.enviado) {
                return c.json({ sucesso: false, mensagem: 'O serviço de e-mail recusou o envio. Tente de novo mais tarde.' }, 502)
            }

            return c.json({ sucesso: true, mensagem: 'Link enviado para ' + usuario.email + '.' })

        } catch (erro) {
            console.error(erro)
            return c.json({ sucesso: false, mensagem: 'Erro interno do servidor.' }, 500)
        }
    })

    // ---------- Bloqueios de horário ----------

    app.get('/bloqueios', async (c) => {

        try {

            const usuario = await obterUsuarioAutenticado(c)

            if (!usuario) {
                return c.json({ sucesso: false, mensagem: 'É necessário fazer login.' }, 401)
            }

            const { hoje } = agoraEmBrasilia()

            const { data, error } = await supabase
                .from('bloqueio')
                .select('id_bloqueio, data_inicio, data_fim, horario_inicio, horario_fim, motivo')
                .gte('data_fim', hoje)
                .order('data_inicio', { ascending: true })

            if (error) {
                console.error(error)
                return c.json({ sucesso: false, mensagem: 'Não foi possível carregar os bloqueios.' }, 400)
            }

            return c.json({ sucesso: true, bloqueios: data })

        } catch (erro) {
            console.error(erro)
            return c.json({ sucesso: false, mensagem: 'Erro interno do servidor.' }, 500)
        }
    })

    app.post('/bloqueios', async (c) => {

        try {

            const { usuario: admin, resposta } = await exigirAdmin(c)
            if (resposta) return resposta

            const body = await c.req.json().catch(() => ({}))
            const { data_inicio, data_fim } = body
            const diaInteiro = Boolean(body.dia_inteiro)
            const horarioInicio = diaInteiro ? null : body.horario_inicio
            const horarioFim = diaInteiro ? null : body.horario_fim
            const motivo = typeof body.motivo === 'string' ? body.motivo.trim() : ''

            if (!dataValida(data_inicio) || !dataValida(data_fim) || data_fim < data_inicio) {
                return c.json({ sucesso: false, mensagem: 'Confira as datas: a data final não pode ser antes da inicial.' }, 400)
            }

            const { hoje, hora } = agoraEmBrasilia()

            if (data_fim < hoje) {
                return c.json({ sucesso: false, mensagem: 'Não é possível bloquear datas que já passaram.' }, 400)
            }

            const diasDeBloqueio = (new Date(data_fim) - new Date(data_inicio)) / 86400000

            if (diasDeBloqueio > 366) {
                return c.json({ sucesso: false, mensagem: 'Um bloqueio pode durar no máximo 1 ano.' }, 400)
            }

            if (!diaInteiro) {
                if (
                    !REGEX_HORA.test(String(horarioInicio)) ||
                    !REGEX_HORA.test(String(horarioFim)) ||
                    horarioParaMinutos(horarioInicio) >= horarioParaMinutos(horarioFim)
                ) {
                    return c.json({ sucesso: false, mensagem: 'Confira os horários: o final precisa ser depois do inicial.' }, 400)
                }
            }

            if (motivo.length < 3 || motivo.length > 200) {
                return c.json({ sucesso: false, mensagem: 'Explique o motivo do bloqueio (de 3 a 200 letras).' }, 400)
            }

            // Reservas que caem dentro do bloqueio (e ainda não terminaram)
            const { data: candidatas, error: erroReservas } = await supabase
                .from('reserva')
                .select('id_reserva, data_reserva, horario_inicio, horario_fim, modalidade, status, id_usuario, usuario!fk_reserva_usuario(nome)')
                .neq('status', 'CANCELADA')
                .gte('data_reserva', data_inicio < hoje ? hoje : data_inicio)
                .lte('data_reserva', data_fim)

            if (erroReservas) {
                console.error(erroReservas)
                return c.json({ sucesso: false, mensagem: 'Não foi possível verificar as reservas afetadas.' }, 500)
            }

            const afetadas = (candidatas || []).filter((r) => {

                const jaTerminou =
                    String(r.data_reserva) === hoje &&
                    horarioParaMinutos(r.horario_fim) <= horarioParaMinutos(hora)

                const pegaHorario =
                    diaInteiro ||
                    (horarioParaMinutos(r.horario_inicio) < horarioParaMinutos(horarioFim) &&
                     horarioParaMinutos(r.horario_fim) > horarioParaMinutos(horarioInicio))

                return !jaTerminou && pegaHorario
            })

            // Primeiro passo: mostra o que será cancelado e espera confirmação
            if (afetadas.length > 0 && body.confirmar !== true) {
                return c.json({
                    sucesso: true,
                    precisa_confirmar: true,
                    afetadas: afetadas.map((r) => ({
                        id_reserva: r.id_reserva,
                        data: r.data_reserva,
                        horario: formatarHorario(r.horario_inicio) + ' às ' + formatarHorario(r.horario_fim),
                        modalidade: r.modalidade,
                        nome: r.usuario ? r.usuario.nome : 'Usuário',
                        status: r.status
                    }))
                })
            }

            const { data: criado, error: erroBloqueio } = await supabase
                .from('bloqueio')
                .insert({
                    data_inicio,
                    data_fim,
                    horario_inicio: horarioInicio,
                    horario_fim: horarioFim,
                    motivo,
                    criado_por: admin.id_usuario
                })
                .select()

            if (erroBloqueio) {
                console.error(erroBloqueio)
                return c.json({ sucesso: false, mensagem: 'Não foi possível criar o bloqueio.' }, 400)
            }

            let canceladas = 0

            if (afetadas.length > 0) {

                const { data: atualizadas, error: erroCancelar } = await supabase
                    .from('reserva')
                    .update({
                        status: 'CANCELADA',
                        motivo_cancelamento: 'Horário bloqueado: ' + motivo,
                        atualizado_por: admin.id_usuario,
                        atualizado_em: new Date().toISOString()
                    })
                    .in('id_reserva', afetadas.map((r) => r.id_reserva))
                    .neq('status', 'CANCELADA')
                    .select('id_reserva')

                if (erroCancelar) {
                    console.error('Erro ao cancelar reservas do bloqueio:', erroCancelar)
                }

                const ids = new Set((atualizadas || []).map((r) => r.id_reserva))
                canceladas = ids.size

                const avisos = afetadas
                    .filter((r) => ids.has(r.id_reserva) && Number(r.id_usuario) !== Number(admin.id_usuario))
                    .map((r) => ({
                        mensagem:
                            'Sua reserva de ' + (r.modalidade || 'quadra') +
                            ' do dia ' + formatarDataBrasileira(r.data_reserva) +
                            ', das ' + formatarHorario(r.horario_inicio) + ' às ' + formatarHorario(r.horario_fim) +
                            ', foi cancelada porque a quadra foi bloqueada. Motivo: ' + motivo,
                        tipo: 'RESERVA_CANCELADA',
                        lida: false,
                        id_usuario: r.id_usuario
                    }))

                if (avisos.length > 0) {
                    const { error: erroAviso } = await supabase.from('notificacao').insert(avisos)
                    if (erroAviso) console.error('Erro ao avisar sobre bloqueio:', erroAviso)
                }
            }

            return c.json({ sucesso: true, bloqueio: criado[0], reservas_canceladas: canceladas })

        } catch (erro) {
            console.error(erro)
            return c.json({ sucesso: false, mensagem: 'Erro interno do servidor.' }, 500)
        }
    })

    app.delete('/bloqueios/:id', async (c) => {

        try {

            const { resposta } = await exigirAdmin(c)
            if (resposta) return resposta

            const { data, error } = await supabase
                .from('bloqueio')
                .delete()
                .eq('id_bloqueio', Number(c.req.param('id')))
                .select('id_bloqueio')

            if (error) {
                console.error(error)
                return c.json({ sucesso: false, mensagem: 'Não foi possível remover o bloqueio.' }, 400)
            }

            if (!data || data.length === 0) {
                return c.json({ sucesso: false, mensagem: 'Bloqueio não encontrado.' }, 404)
            }

            // As reservas canceladas pelo bloqueio continuam canceladas
            return c.json({ sucesso: true })

        } catch (erro) {
            console.error(erro)
            return c.json({ sucesso: false, mensagem: 'Erro interno do servidor.' }, 500)
        }
    })

    // ---------- Lembrete 1 hora antes ----------
    // Roda a cada 5 minutos enquanto o servidor está acordado. No plano
    // gratuito do Render, o cron-job.org acessando /saude mantém acordado.

    async function enviarLembretes() {

        try {

            const { hoje, hora } = agoraEmBrasilia()
            const agoraMin = horarioParaMinutos(hora)

            const { data: reservas, error } = await supabase
                .from('reserva')
                .select('id_reserva, data_reserva, horario_inicio, horario_fim, modalidade, criado_em, id_usuario, usuario!fk_reserva_usuario(nome, email)')
                .eq('status', 'APROVADA')
                .eq('data_reserva', hoje)
                .is('lembrete_enviado_em', null)

            if (error) {
                console.error('Erro ao buscar reservas para lembrete:', error)
                return
            }

            const quinzeMinAtras = Date.now() - 15 * 60 * 1000

            const proximas = (reservas || []).filter((r) => {

                const faltam = horarioParaMinutos(r.horario_inicio) - agoraMin
                const recemCriada = r.criado_em && new Date(r.criado_em).getTime() > quinzeMinAtras

                return faltam > 0 && faltam <= 60 && !recemCriada
            })

            if (proximas.length === 0) return

            // Marca antes de enviar: se dois processos rodarem juntos, só um envia
            const { data: marcadas, error: erroMarcar } = await supabase
                .from('reserva')
                .update({ lembrete_enviado_em: new Date().toISOString() })
                .in('id_reserva', proximas.map((r) => r.id_reserva))
                .is('lembrete_enviado_em', null)
                .select('id_reserva')

            if (erroMarcar) {
                console.error('Erro ao marcar lembretes:', erroMarcar)
                return
            }

            const ids = new Set((marcadas || []).map((r) => r.id_reserva))
            const paraAvisar = proximas.filter((r) => ids.has(r.id_reserva))

            if (paraAvisar.length === 0) return

            const textoReserva = (r) =>
                (r.modalidade || 'quadra') + ' hoje, das ' +
                formatarHorario(r.horario_inicio) + ' às ' + formatarHorario(r.horario_fim)

            const { error: erroSino } = await supabase
                .from('notificacao')
                .insert(paraAvisar.map((r) => ({
                    mensagem: 'Lembrete: sua reserva de ' + textoReserva(r) + ' começa em breve.',
                    tipo: 'RESERVA_LEMBRETE',
                    lida: false,
                    id_usuario: r.id_usuario
                })))

            if (erroSino) console.error('Erro ao criar notificação de lembrete:', erroSino)

            for (const r of paraAvisar) {

                if (!r.usuario || !r.usuario.email) continue

                await enviarEmail({
                    para: r.usuario.email,
                    nome: r.usuario.nome,
                    assunto: 'Lembrete: sua reserva começa às ' + formatarHorario(r.horario_inicio),
                    html: montarHtml({
                        titulo: 'Sua reserva começa em breve',
                        paragrafos: [
                            'Olá, ' + escaparHtml(r.usuario.nome) + '!',
                            'Lembrete da sua reserva de <strong>' + escaparHtml(textoReserva(r)) + '</strong>.',
                            'Se não for mais usar a quadra, cancele no IFPlay para liberar o horário para outra pessoa.'
                        ],
                        botao: { texto: 'Abrir minhas reservas', url: urlDoSite() + '/DASHBOARD/dashboard.html#reservas' }
                    }),
                    texto:
                        'Olá, ' + r.usuario.nome + '!\n\nLembrete da sua reserva de ' + textoReserva(r) + '.\n' +
                        'Se não for mais usar a quadra, cancele no IFPlay: ' + urlDoSite() + '/DASHBOARD/dashboard.html#reservas'
                })
            }

        } catch (erro) {
            console.error('Erro ao enviar lembretes:', erro)
        }
    }

    setTimeout(enviarLembretes, 20 * 1000)
    setInterval(enviarLembretes, 5 * 60 * 1000)
}
