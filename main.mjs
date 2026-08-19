import makeWASocket, {
    DisconnectReason,
    useMultiFileAuthState,
    downloadMediaMessage
} from '@whiskeysockets/baileys';

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
        //shouldSyncHistoryMessage: () => false
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
    sock.ev.on('messages.upsert', async ({ messages, type }) => {

        // if (type !== 'notify') {
        //     return;
        // }

        // for (const msg of messages) {

        //     if (!msg.message) {
        //         continue;
        //     }

        //     const remoteJid = msg.key.remoteJid;

        //     const autorId = remoteJid?.endsWith('@g.us')
        //         ? msg.key.participant
        //         : remoteJid;

        //     console.log('\n==============================');
        //     console.log('NOVA MENSAGEM');
        //     console.log('==============================');

        //     console.log('fromMe:', msg.key.fromMe);
        //     console.log('remoteJid:', remoteJid);
        //     console.log('participant:', msg.key.participant);
        //     console.log('autorId:', autorId);

        //     console.log(
        //         'tipos:',
        //         Object.keys(msg.message)
        //     );

        //     const texto =
        //         msg.message.conversation ||
        //         msg.message.extendedTextMessage?.text ||
        //         msg.message.imageMessage?.caption ||
        //         msg.message.videoMessage?.caption ||
        //         '';

        //     console.log('texto:', texto);

        //     const textoLimpo =
        //         texto.trim().toLowerCase();

        //     if (textoLimpo !== '!sticker') {
        //         continue;
        //     }

        //     const temImagem =
        //         !!msg.message.imageMessage;

        //     const temVideo =
        //         !!msg.message.videoMessage;

        //     if (!temImagem && !temVideo) {
        //         console.log(
        //             'É !sticker, mas não existe mídia.'
        //         );
        //         continue;
        //     }

        //     console.log(
        //         '>>> !STICKER DETECTADO'
        //     );

        //     // Por enquanto, NÃO aplique a lista branca.
        //     // Primeiro vamos confirmar que a conversão funciona.
        // }

        // -- 

        // Só queremos mensagens novas
        if (type !== 'notify') {
            return;
        }

        // O evento pode trazer várias mensagens
        for (const msg of messages) {
            try {

                // Ignora mensagens enviadas pelo próprio bot
                if (msg.key.fromMe) {
                    continue;
                }

                // Informações básicas da mensagem
                const remoteJid = msg.key.remoteJid;
                if (!remoteJid) {
                    continue;
                }

                // 5. IDENTIFICAR O CONTEÚDO
                const messageContent = msg.message;
                if (!messageContent) {
                    continue;
                }

                // Texto normal
                let textoRecebido =
                    messageContent.conversation ||
                    messageContent.extendedTextMessage?.text ||
                    '';

                // Legenda de imagem
                const legenda =
                    messageContent.imageMessage?.caption || '';

                // Legenda de vídeo
                const legendaVideo =
                    messageContent.videoMessage?.caption || '';

                // Usa a legenda caso exista
                if (!textoRecebido) {
                    textoRecebido =
                        legenda ||
                        legendaVideo ||
                        '';
                }

                const textoLimpo =
                    textoRecebido.trim().toLowerCase();

                // 6. VERIFICAR SE É !STICKER
                if (textoLimpo !== '!sticker') {
                    continue;
                }

                // 7. VERIFICAR SE EXISTE MÍDIA
                const temImagem =
                    !!messageContent.imageMessage;

                const temVideo =
                    !!messageContent.videoMessage;

                const temDocumento =
                    !!messageContent.documentMessage;

                const temMedia =
                    temImagem ||
                    temVideo ||
                    temDocumento;

                if (!temMedia) {
                    console.log(
                        'Comando !sticker recebido sem mídia.'
                    );
                    continue;
                }

                // 8. IDENTIFICAR QUEM ENVIOU
                let autorId;

                if (remoteJid.endsWith('@g.us')) {
                    // Mensagem de grupo
                    autorId =
                        msg.key.participant;

                } else {
                    // Conversa privada
                    autorId =
                        remoteJid;
                }

                if (!autorId) {
                    console.log(
                        'Não foi possível identificar o autor.'
                    );
                    continue;
                }

                // 9. LISTA BRANCA
                if (!listaBrancaContatos.includes(autorId)) {

                    console.log(
                        `Processo interrompido. ` +
                        `Usuário não autorizado: ${autorId}`
                    );
                    continue;
                }

                // 10. BAIXAR MÍDIA
                console.log('Baixando mídia...');

                const mediaBuffer =
                    await downloadMediaMessage(
                        msg,
                        'buffer',
                        {}
                    );

                if (!mediaBuffer) {

                    console.log(
                        'Erro: Falha ao baixar o arquivo de mídia.'
                    );
                    continue;
                }

                // 11. ENVIAR FIGURINHA
                console.log(
                    `Enviando figurinha para: ${remoteJid}`
                );

                await sock.sendMessage(
                    remoteJid,
                    {
                        sticker: mediaBuffer
                    }
                );

                console.log(
                    'Figurinha enviada com sucesso!'
                );

            } catch (error) {

                console.error(
                    'Erro no processamento da figurinha:',
                    error
                );
            }
        }
    });
}

// 12. INICIAR BOT
conectarWhatsApp();