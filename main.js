/*
whatsapp-web.js documentation:
- https://wwebjs.dev/
- https://docs.wwebjs.dev/index.html
*/
require('dotenv').config();
const { Client } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');

const client = new Client();

client.on('ready', () => {
    console.log('Client is ready!');
});

client.on('qr', qr => {
    qrcode.generate(qr, { small: true });
});

client.initialize();

const listaBrancaContatos = process.env.LISTA_BRANCA_CONTATOS.split(',');

client.on('message_create', async (msg) => {
    // --- 1. OTIMIZAÇÃO: FILTRO DE COMANDO NO TOPO ---
    // Pega o texto da mensagem (corpo ou legenda da foto)
    const comandoRecebido = msg.body || msg.caption;
    const textoLimpo = comandoRecebido ? comandoRecebido.trim().toLowerCase() : '';

    // Se NÃO for o comando do sticker ou NÃO tiver mídia, o bot para aqui mesmo.
    // Isso evita leituras desnecessárias de conversas normais no grupo.
    if (textoLimpo !== '!sticker' || !msg.hasMedia) {
        return;
    }

    // --- 2. SEGURANÇA: FILTRO DE PESSOAS ---
    // Em grupos, quem enviou está em 'msg.author'. No privado, está em 'msg.from'.
    const remetenteBruto = msg.from.endsWith('@g.us') ? msg.author : msg.from;

    // Extrai o ID limpo (trata variações de objetos da biblioteca)
    const autorId = typeof remetenteBruto === 'object' ? remetenteBruto._serialized : remetenteBruto;

    // Se a pessoa não estiver cadastrada na lista branca, o bot ignora o pedido
    if (!listaBrancaContatos.includes(autorId)) {
        console.log(`Comando bloqueado. Usuário não autorizado: ${autorId}`);
        return;
    }

    // --- 3. PROCESSAMENTO E ENVIO DA FIGURINHA ---
    try {
        // 1. CORREÇÃO DO ERRO r: r NO OBJETO DA MENSAGEM
        if (msg.id && !msg.id._serialized && msg.id.$1) {
            msg.id._serialized = msg.id.$1;
        }

        // 2. ROTEAMENTO SEGURO DE DESTINO (Resolve o bug do envio privado)
        let destinoEnvio;

        if (msg.fromMe) {
            // Se a mensagem foi enviada por VOCÊ no grupo, o destino real está em msg.to
            destinoEnvio = msg.to;
        } else {
            // Se a mensagem veio de outra pessoa, o destino real está em msg.from
            destinoEnvio = msg.from;
        }

        console.log('Baixando mídia...');
        const media = await msg.downloadMedia();
        if (!media) {
            console.log('Erro: Falha ao baixar o arquivo de mídia.');
            return;
        }

        console.log(`Enviando figurinha diretamente para o chat correto: ${destinoEnvio}`);

        // 3. ENVIA USANDO O ID REDIRECIONADO
        await client.sendMessage(destinoEnvio, media, { sendMediaAsSticker: true });
        console.log('Figurinha enviada com sucesso!');

    } catch (error) {
        console.error('Erro no processamento da figurinha:', error);
    }
});

// evento que escuta reações em mensagens (ex: quando alguém coloca um emoji)
// client.on('message_reaction', async (reaction) => {
//     try {
//         console.log('\n--- MENSAGEM FAVORITADA VIA REAÇÃO ---');

//             // 1. Captura quem enviou a mensagem original que recebeu a estrela
//             // Em grupos, usamos reaction.senderId (quem enviou a msg reagida)
//             const autorOriginalBruto = reaction.msgId.participant || reaction.msgId.remote;
            
//             // 2. Garante a extração limpa da string do identificador (@lid ou @c.us)
//             const numeroEmbaralhado = typeof autorOriginalBruto === 'object' 
//                 ? autorOriginalBruto._serialized 
//                 : autorOriginalBruto;

//             console.log(`Usuário original da mensagem: ${numeroEmbaralhado}`);
//             console.log(`Quem reagiu com a estrela: ${reaction.senderId}`);
//             console.log('---------------------------------------\n');
//     } catch (error) {
//         console.error('Erro ao ler reação da mensagem:', error);
//     }
// });

// client.on('message_create', async (msg) => {
//     console.log('===============');
//     console.log(msg.body);
//     console.log(msg.author);
//     console.log(msg.from);
//     console.log('===============');
// });