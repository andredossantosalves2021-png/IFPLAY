import 'dotenv/config'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { createClient } from '@supabase/supabase-js'
import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'

const app = new Hono()

app.use('*', cors())


app.use('/*', serveStatic({ root: './public' }))

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
)

app.post('/login', async (c) => {
  try {
    const body = await c.req.json()
    

    const raFornecido = String(body.ra).trim()
    const senhaFornecida = String(body.senha).trim()


    const { data: usuario, error } = await supabase
      .from('usuario')
      .select('*')
      .eq('ra', raFornecido)
      .maybeSingle()

    if (error) {
      console.error('Erro no Supabase:', error.message)
      return c.json({ sucesso: false, mensagem: 'Erro ao consultar o banco' }, 500)
    }

    if (!usuario) {
      return c.json({ sucesso: false, mensagem: 'Usuário não encontrado' }, 404)
    }


    if (String(usuario.senha).trim() !== senhaFornecida) {
      return c.json({ sucesso: false, mensagem: 'RA ou senha inválidos' }, 401)
    }

    return c.json({
      sucesso: true,
      usuario: {
        id_usuario: usuario.id_usuario,
        ra: usuario.ra,
        nome: usuario.nome,
        email: usuario.email,
        tipo_usuario: usuario.tipo_usuario
      }
    })

  } catch (err) {
    return c.json({ sucesso: false, mensagem: 'Erro ao processar dados' }, 400)
  }
})


app.post('/reservas', async (c) => {

    try {

        const body = await c.req.json();

        const {
            data_reserva,
            horario_inicio,
            horario_fim,
            modalidade,
            tipo_reserva,
            recorrente,
            id_usuario
        } = body;

        if (
            !data_reserva ||
            !horario_inicio ||
            !horario_fim ||
            !modalidade ||
            !id_usuario
        ) {

            return c.json({
                sucesso: false,
                mensagem: 'Preencha todos os campos.'
            }, 400);

        }

        const { data, error } =
            await supabase
                .from('reserva')
                .insert([{
                    data_reserva,
                    horario_inicio,
                    horario_fim,
                    modalidade,
                    status: 'PENDENTE',
                    tipo_reserva,
                    recorrente,
                    id_usuario
                }])
                .select();

        if (error) {

            console.error(error);

            return c.json({
                sucesso: false,
                mensagem: error.message
            }, 400);

        }

        return c.json({
            sucesso: true,
            reserva: data[0]
        });

    } catch (erro) {

        console.error(erro);

        return c.json({
            sucesso: false,
            mensagem: 'Erro interno do servidor.'
        }, 500);

    }

});

serve({
  fetch: app.fetch,
  port: 3333
}, (info) => {
  console.log(`Servidor rodando em http://localhost:${info.port}`)
})

app.get('/reservas', async (c) => {

    try {

        const agora = new Date();
        const hoje = agora.toLocaleDateString('en-CA', {
          timeZone: 'America/Sao_Paulo'
        });
        const horaAtual = agora.toLocaleTimeString('en-GB', {
            timeZone: 'America/Sao_Paulo',
            hour12: false
        });

        const { data, error } = await supabase
            .from('reserva')
            .select('*, usuario(nome)')
            .or(`data_reserva.gt.${hoje},and(data_reserva.eq.${hoje},horario_fim.gt.${horaAtual})`)
            .neq('status', 'CANCELADA')
            .order('data_reserva', { ascending: true })
            .order('horario_inicio', { ascending: true });


        if (error) {
            console.error(error);
            return c.json({ sucesso: false, mensagem: error.message }, 400);
        }

        return c.json({ sucesso: true, reservas: data });

    } catch (erro) {
        console.error(erro);
        return c.json({ sucesso: false, mensagem: 'Erro interno do servidor.' }, 500);
    }

});
