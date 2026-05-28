import express from 'express'
import mysql from 'mysql2'
import cors from 'cors'

const app = express()

app.use(cors())
app.use(express.json())
app.use(express.static('public'))

const conexao = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'ifplay'
})

conexao.connect((erro) => {
    if (erro) {
        console.log('Erro ao conectar no banco')
    } else {
        console.log('Banco conectado')
    }
})

app.post('/login', (req, res) => {

    const { ra, senha } = req.body

    const sql = `
        SELECT * FROM usuario
        WHERE ra = ? AND senha = ?
    `

    conexao.query(sql, [ra, senha], (erro, resultado) => {

        if (erro) {
            return res.status(500).json({
                sucesso: false,
                mensagem: 'Erro no servidor'
            })
        }

        if (resultado.length > 0) {

            res.json({
                sucesso: true,
                usuario: resultado[0]
            })

        } else {

            res.json({
                sucesso: false,
                mensagem: 'RA ou senha inválidos'
            })

        }

    })

})

app.listen(3333, () => {
    console.log('Servidor rodando na porta 3333')
})