import makeWASocket, {
    DisconnectReason,
    useMultiFileAuthState,
    downloadMediaMessage
} from '@whiskeysockets/baileys';

import { Sticker, StickerTypes } from 'wa-sticker-formatter'
import qrcode from 'qrcode-terminal';
import dotenv from 'dotenv';

dotenv.config();

// 1. CONFIGURAÇÃO
const listaBrancaContatos =
    process.env.LISTA_BRANCA_CONTATOS
        ? process.env.LISTA_BRANCA_CONTATOS.split(',')
        : [];


// 2. CONEXÃO COM O WHATSAPP
async function conectarWhatsApp() {

    const { state, saveCreds } =
        await useMultiFileAuthState('auth_info_baileys');

    const sock = makeWASocket({
        auth: state,
        shouldSyncHistoryMessage: () => false
    });

    // 3. QR CODE E ESTADO DA CONEXÃO
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

    // 4. RECEBIMENTO DE MENSAGENS

    // sock.ev.on('messages.upsert', async (event) => {
    //     if (event.type !== 'notify') return
    //     for (const m of event.messages) {
    //         if (m.key.fromMe) continue
    //         console.log(JSON.stringify(m, undefined, 2))

    //         console.log('received from', m.key.remoteJid)
    //     }
    // })

    // EVENTO DE REAÇÕES PARA IDENTIFICAR JID
    // sock.ev.on('messages.reaction', (reactions) => {
    //     for (const reaction of reactions) {
    //         const remoteJid = reaction.key.remoteJid;
    //         const isGroup = remoteJid.endsWith('@g.us');

    //         // 1) JID da pessoa dona da mensagem original (nunca o ID do grupo)
    //         const originalJid = isGroup
    //             ? reaction.key.participant
    //             : reaction.key.remoteJid;

    //         // 2) JID de quem reagiu (nunca o ID do grupo)
    //         const reactorJid = isGroup
    //             ? reaction.reaction.key?.participant
    //             : reaction.reaction.key?.remoteJid;

    //         // 3) emoji ou "removida"
    //         const emoji = reaction.reaction.text || 'removida';

    //         console.log('--- Nova reação ---');
    //         console.log('JID da mensagem original:', originalJid);
    //         console.log('JID de quem reagiu:', reactorJid);
    //         console.log('Emoji:', emoji);
    //     }
    // });

    sock.ev.on('messages.upsert', async ({ messages, type }) => {
        for (const msg of messages) {
            if (!msg.message) continue

            const remoteJid = msg.key.remoteJid
            const isGroup = remoteJid.endsWith('@g.us')
            const senderJid = isGroup ? msg.key.participant : remoteJid

            // lista branca vinda do .env, separada por vírgula
            const listaBranca = (process.env.LISTA_BRANCA_CONTATOS || '')
                .split(',')
                .map(jid => jid.trim())
                .filter(Boolean)

            if (!listaBranca.includes(senderJid)) continue

            console.log('--- upsert de contato autorizado recebido ---')
            console.log('type:', type)
            console.log('key:', msg.key)
            console.log('message existe?', !!msg.message)
            console.log('messageStubType:', msg.messageStubType)

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

                await sock.sendMessage(remoteJid, { sticker: stickerBuffer })
            } catch (err) {
                console.error('Erro ao criar figurinha:', err)
            }
        }
    })

}

// 12. INICIAR BOT
conectarWhatsApp();