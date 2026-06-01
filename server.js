import 'dotenv/config'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { createClient } from '@supabase/supabase-js'
import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'

const app = new Hono()

app.use('*', cors())

// Serve os arquivos da pasta public
app.use('/*', serveStatic({ root: './public' }))

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
)

app.post('/login', async (c) => {
  try {
    const body = await c.req.json()
    
    // CORRIGIDO: raFornecido tudo junto
    const raFornecido = String(body.ra).trim()
    const senhaFornecida = String(body.senha).trim()

    // Busca no Supabase garantindo que a coluna 'ra' seja igual ao texto digitado
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

    // Compara as senhas convertendo ambas para texto comum
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

// Mantém o servidor ativo ouvindo a porta 3333
serve({
  fetch: app.fetch,
  port: 3333
}, (info) => {
  console.log(`Servidor rodando em http://localhost:${info.port}`)
})