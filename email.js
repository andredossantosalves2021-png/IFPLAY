// Envio de e-mail pelo Brevo (API HTTP).
// O plano gratuito do Render bloqueia SMTP (portas 25, 465 e 587), por isso
// o envio é feito por HTTPS. Variáveis de ambiente:
//   BREVO_API_KEY    chave da API do Brevo
//   EMAIL_REMETENTE  e-mail confirmado no Brevo como remetente
//   APP_URL          endereço público do site (para os links nos e-mails)
// Sem BREVO_API_KEY o e-mail não é enviado: ele aparece no terminal do
// servidor, o que basta para testar localmente.

const NOME_REMETENTE = 'IFPlay'

export function emailConfigurado() {
    return Boolean(process.env.BREVO_API_KEY && process.env.EMAIL_REMETENTE)
}

export function urlDoSite() {
    return (process.env.APP_URL || 'http://localhost:3333').replace(/\/+$/, '')
}

export function escaparHtml(texto) {
    return String(texto ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
}

// Moldura simples, com as cores do IFPlay, para todos os e-mails
export function montarHtml({ titulo, paragrafos, botao }) {

    const corpo = paragrafos
        .map((p) => '<p style="margin:0 0 14px;line-height:1.5">' + p + '</p>')
        .join('')

    const htmlBotao = botao
        ? '<p style="margin:22px 0"><a href="' + escaparHtml(botao.url) + '" ' +
          'style="background:#008550;color:#ffffff;text-decoration:none;padding:12px 22px;' +
          'border-radius:24px;font-weight:bold;display:inline-block">' + escaparHtml(botao.texto) + '</a></p>' +
          '<p style="margin:0 0 14px;font-size:12px;color:#6b7280">Se o botão não funcionar, copie este endereço: ' +
          escaparHtml(botao.url) + '</p>'
        : ''

    return (
        '<div style="font-family:Arial,sans-serif;background:#e8f1f2;padding:24px">' +
        '<div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:14px;padding:26px;color:#1f2937">' +
        '<h2 style="margin:0 0 18px;color:#047857">' + escaparHtml(titulo) + '</h2>' +
        corpo + htmlBotao +
        '<p style="margin:24px 0 0;font-size:12px;color:#9ca3af">IFPlay · reservas da quadra do IF</p>' +
        '</div></div>'
    )
}

export async function enviarEmail({ para, nome, assunto, html, texto }) {

    if (!para) {
        return { enviado: false, motivo: 'sem destinatário' }
    }

    if (!emailConfigurado()) {
        console.log(
            '\n[e-mail NÃO enviado: BREVO_API_KEY/EMAIL_REMETENTE não configurados]\n' +
            'Para: ' + para + '\nAssunto: ' + assunto + '\n' + (texto || '') + '\n'
        )
        return { enviado: false, simulado: true }
    }

    try {

        const resposta = await fetch('https://api.brevo.com/v3/smtp/email', {
            method: 'POST',
            headers: {
                'api-key': process.env.BREVO_API_KEY,
                'content-type': 'application/json',
                accept: 'application/json'
            },
            body: JSON.stringify({
                sender: { name: NOME_REMETENTE, email: process.env.EMAIL_REMETENTE },
                to: [{ email: para, name: nome || para }],
                subject: assunto,
                htmlContent: html,
                textContent: texto
            }),
            signal: AbortSignal.timeout(10000)
        })

        if (!resposta.ok) {
            const detalhe = await resposta.text().catch(() => '')
            console.error('Brevo recusou o e-mail (' + resposta.status + '):', detalhe.slice(0, 300))
            return { enviado: false, motivo: 'brevo ' + resposta.status }
        }

        return { enviado: true }

    } catch (erro) {
        console.error('Erro ao enviar e-mail:', erro.message)
        return { enviado: false, motivo: erro.message }
    }
}
