/*
whatsapp-web.js documentation:
- https://wwebjs.dev/
- https://docs.wwebjs.dev/index.html
*/

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

const listaBrancaContatos = [
    '5513997862006@c.us',
    '147188680233206@lid',
    '12949410308211@lid',
    '7086779932822@lid'
];

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
        console.log(`Comando aceito de ${autorId}! Iniciando criação...`);

        // Correção do erro "r: r" do WhatsApp Web
        if (msg.id && !msg.id._serialized && msg.id.$1) { 
            msg.id._serialized = msg.id.$1; 
        }

        const media = await msg.downloadMedia();
        if (!media) {
            console.log('Erro: Falha ao baixar o arquivo de mídia.');
            return;
        }

        // --- CORREÇÃO DE ENVIO PARA GRUPOS ---
        // Garante que o ID do grupo seja extraído corretamente sem caracteres ocultos
        const destinoEnvio = msg.from.endsWith('@g.us') ? msg.from : msg.to;

        console.log(`Enviando figurinha para o destino: ${destinoEnvio}`);
        
        // Envia explicitamente para o ID correto da conversa
        await client.sendMessage(destinoEnvio, media, { sendMediaAsSticker: true });
        console.log('Figurinha enviada com sucesso!');

    } catch (error) {
        console.error('Erro no processamento da figurinha:', error);
    }
});
