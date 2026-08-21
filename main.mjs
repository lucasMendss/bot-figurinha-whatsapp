import makeWASocket, {
    DisconnectReason,
    useMultiFileAuthState,
    downloadMediaMessage
} from '@whiskeysockets/baileys';

import { Sticker, StickerTypes } from 'wa-sticker-formatter'
import qrcode from 'qrcode-terminal';
import dotenv from 'dotenv';

dotenv.config();

async function conectarWhatsApp() {

    const { state, saveCreds } =
        await useMultiFileAuthState('auth_info_baileys');

    const sock = makeWASocket({
        auth: state,
        shouldSyncHistoryMessage: () => false
    });

    // QR CODE E ESTADO DA CONEXÃO
    sock.ev.on('connection.update', (update) => {

        const { connection, lastDisconnect, qr } = update;

        // Mostra QR Code no terminal
        if (qr) {
            qrcode.generate(qr, { small: true });
        }

        // Conexão fechada
        if (connection === 'close') {

            const statusCode =
                lastDisconnect?.error?.output?.statusCode;

            const shouldReconnect =
                statusCode !== DisconnectReason.loggedOut;

            console.log(
                'Conexão fechada.', 'Reconectando:', shouldReconnect
            );

            if (shouldReconnect) {
                conectarWhatsApp();
            }

        }

        // Conexão estabelecida
        else if (connection === 'open') {
            console.log('Client is ready!');
        }
    });

    // Salva as credenciais sempre que forem atualizadas
    sock.ev.on('creds.update', saveCreds);

    // RECEBIMENTO DE MENSAGENS
    sock.ev.on('messages.upsert', async ({ messages, type }) => {
        for (const msg of messages) {
            if (!msg.message) continue

            const remoteJid = msg.key.remoteJid
            const isGroup = remoteJid.endsWith('@g.us')
            const senderJid = isGroup ? msg.key.participant : remoteJid

            const contatosPermitidos = (process.env.CONTATOS_PERMITIDOS || '')
                .split(',')
                .map(jid => jid.trim())
                .filter(Boolean)

            if (!contatosPermitidos.includes(senderJid)) continue

            const messageType = Object.keys(msg.message)[0]
            const isImage = messageType === 'imageMessage'
            const isGif = messageType === 'videoMessage' && msg.message.videoMessage?.gifPlayback

            if (!isImage && !isGif) continue

            const caption = isImage
                ? msg.message.imageMessage?.caption
                : msg.message.videoMessage?.caption

            if (caption?.trim() !== '!sticker') continue

            try {
                const buffer = await downloadMediaMessage(msg, 'buffer', {})

                const sticker = new Sticker(buffer, {
                    pack: 'Meu Bot',
                    author: 'Baileys',
                    type: StickerTypes.FULL,
                    quality: 70
                })

                const stickerBuffer = await sticker.toBuffer()

                console.log("========================================")
                console.log("enviando para " + remoteJid);
                console.log("participante do grupo: " + msg.key.participant);
                console.log("========================================")
                await sock.sendMessage(remoteJid, { sticker: stickerBuffer })
            } catch (err) {
                console.error('Erro ao criar figurinha:', err)
            }
        }
    })
}

conectarWhatsApp();
