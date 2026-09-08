import makeWASocket, {
    DisconnectReason,
    useMultiFileAuthState,
    downloadMediaMessage,
    normalizeMessageContent, // Remove encapsulamentos da mensagem para acessar diretamente a mídia
    jidNormalizedUser // padroniza formatos equivalentes de JID
} from '@whiskeysockets/baileys'

import { Sticker, StickerTypes } from 'wa-sticker-formatter'
import qrcode from 'qrcode-terminal'
import dotenv from 'dotenv'

dotenv.config()

const MODO_ACESSO = (process.env.MODO_ACESSO || 'restrito').trim().toLowerCase()
const MODO_RESTRITO = MODO_ACESSO !== 'aberto'

async function connectToWhatsApp() {

    const { state, saveCreds } =
        await useMultiFileAuthState('auth_info_baileys')

    const sock = makeWASocket({
        auth: state,
        markOnlineOnConnect: false
    })

    // QR Code e estado da conexão
    let conexaoAberta = false
    sock.ev.on('connection.update', async (update) => { 
        const { connection, lastDisconnect, qr } = update

        // Mostra QR Code no terminal
        if (qr) {
            qrcode.generate(qr, { small: true })
        }

        if (connection === 'close') {
            conexaoAberta = false
            const shouldReconnect =
                lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut

            console.log(
                'Conexão fechada por', lastDisconnect?.error,
                ', Reconectando: ', shouldReconnect)

            if (shouldReconnect) {
                connectToWhatsApp()
            } else {
                console.log('Deslogado. Apague a pasta auth_info_baileys e reescaneie o QR Code para se reconcetar')
            }

        } else if (connection === 'open') {
            conexaoAberta = true
            console.log('Conexão estabelecida')
            console.log('Modo de acesso:', MODO_RESTRITO ? 'restrito' : 'aberto')

            try {
                await sock.sendPresenceUpdate('unavailable')
                console.log('Status definido como Offline.')
            } catch (err) {
                console.error('Erro ao definir status offline:', err)
            }
        }
    })

    // Salva as credenciais sempre que forem atualizadas
    sock.ev.on('creds.update', saveCreds)

    // Recebimento de mensagens
    sock.ev.on('messages.upsert', async ({ messages, type }) => {
        if (!conexaoAberta || type !== 'notify') return

        const contatosPermitidos = new Set(
            (process.env.CONTATOS_PERMITIDOS || '')
                .split(',')
                .map(jid => jid.trim())
                .filter(Boolean)
                .map(jidNormalizedUser)
        )

        for (const msg of messages) {
            if (!msg.message) continue

            const remoteJid = msg.key.remoteJid
            if (!remoteJid) continue

            const content = normalizeMessageContent(msg.message) || msg.message

            const isGroup = remoteJid.endsWith('@g.us')

            const possibleSenderJids = isGroup
                ? [msg.key.participant, msg.key.participantAlt]
                : [remoteJid, msg.key.remoteJidAlt]

            const normalizedSenderJids = possibleSenderJids
                .filter(Boolean)
                .map(jidNormalizedUser)

            const senderJidPrincipal = normalizedSenderJids[0]

            const textCommand = (
                content.conversation ||
                content.extendedTextMessage?.text ||
                content.imageMessage?.caption ||
                content.videoMessage?.caption ||
                ''
            ).trim().toLowerCase()

            if (textCommand === '!jid') {
                if (!senderJidPrincipal) continue

                const resposta = [
                    'Seu JID:',
                    senderJidPrincipal
                ].join('\n')

                await sock.sendMessage(remoteJid, { text: resposta }, { quoted: msg })

                // Força o offline após responder o comando !jid
                await sock.sendPresenceUpdate('unavailable')
                continue
            }

            const imageMessage = content.imageMessage
            const videoMessage = content.videoMessage

            const isImage = Boolean(imageMessage)
            const isGif = Boolean(videoMessage?.gifPlayback)

            if (!isImage && !isGif) continue

            const caption = imageMessage?.caption || videoMessage?.caption

            if (caption?.trim().toLowerCase() !== '!sticker') continue

            if (MODO_RESTRITO && contatosPermitidos.size === 0) {
                console.warn('MODO_ACESSO=restrito, mas CONTATOS_PERMITIDOS está vazio. Ignorando comando !sticker.')
                continue
            }

            const senderJid = MODO_RESTRITO
                ? normalizedSenderJids.find(jid => contatosPermitidos.has(jid))
                : normalizedSenderJids[0]

            if (!senderJid) continue

            console.log('========================================')
            console.log('Comando !sticker recebido')
            console.log('Remetente:', senderJid)
            console.log('Chat:', remoteJid)
            console.log('Tipo:', isImage ? 'imagem' : 'GIF')
            console.log('========================================')

            // Baixar mídia e enviar figurinha
            try {
                const buffer = await downloadMediaMessage(msg, 'buffer', {})

                const sticker = new Sticker(buffer, {
                    pack: 'YURI ALBERTO',
                    author: 'Baileys',
                    type: StickerTypes.FULL,
                    quality: 70
                })

                const stickerBuffer = await sticker.toBuffer()

                await sock.sendMessage(remoteJid, {
                    sticker: stickerBuffer
                })

                console.log('Figurinha enviada para', remoteJid)

                // Força o offline após enviar a figurinha
                await sock.sendPresenceUpdate('unavailable')

            } catch (err) {
                console.error('Erro ao criar figurinha:', err)
            }
        }
    })
}

connectToWhatsApp()
