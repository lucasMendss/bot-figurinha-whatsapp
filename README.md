# Bot de figurinhas do Whatsapp

Um bot simples para WhatsApp que transforma imagens e GIFs em figurinhas usando o comando !sticker. Ele funciona em conversas individuais e grupos, possui controle de contatos autorizados e mantém a conexão salva para facilitar o uso contínuo.

## Instalação e utilização

### Requisitos

- Node.js versão 20.9.0 ou superior

### Para instalar o bot, rode:

``` bash
git clone https://github.com/lucasMendss/bot-figurinha-whatsapp.git 

cd bot-figurinha-whatsapp/

npm install

npm start
```

Após o último comando, irá aparecer no terminal o QR Code de conexão do Whatsapp. Aponte a câmera do seu celular para o código para conectar o bot a seu Whatsapp.

## Modos de uso (restrito ou aberto)

Você pode escolher se o bot responderá a comandos apenas de contatos que você permitir ou se ele aceitará o comando !sticker de qualquer pessoa.

- `MODO_ACESSO=restrito`: somente JIDs listados em `CONTATOS_PERMITIDOS` podem usar `!sticker`. Seu próprio JID também precisa estar listado.
- `MODO_ACESSO=aberto`: qualquer contato pode usar `!sticker`.

Exemplo de `.env` para modo restrito:

```env
MODO_ACESSO=restrito
CONTATOS_PERMITIDOS=5511999999999@lid,5511888888888@s.whatsapp.net
```

Exemplo de `.env` para modo aberto:

```env
MODO_ACESSO=aberto
```

## Como descobrir o JID de um contato (comando `!jid`)

1. Inicie o bot com `npm start`.
2. Peça para o contato enviar `!jid` no chat privado com o bot, ou num grupo que tenha vocês dois.
3. O bot responderá com o JID do remetente.
4. Copie esse valor e adicione em `CONTATOS_PERMITIDOS` no seu `.env`.

Exemplo:

```env
MODO_ACESSO=restrito
CONTATOS_PERMITIDOS=5511999999999@s.whatsapp.net,5511888888888@lid
```

Descubra seu próprio JID enviando `!jid` em um chat também.

## Execução do bot no celular com Termux

A versão principal deste bot é focada em execução para PC. Mas, se você tiver um celular sobrando, pode usar ele como servidor do bot. Para rodar o bot no celular, use o app Termux. No terminal do app, rode os comandos abaixo:

```bash
pkg update && pkg upgrade

pkg install nodejs-lts clang make python pkg-config libvips

git clone https://github.com/lucasMendss/bot-figurinha-whatsapp.git

cd ~/bot-figurinha-whatsapp
```

Execute este se você quer modo restrito:

```bash
echo -e "MODO_ACESSO=restrito\nCONTATOS_PERMITIDOS=jidSeuContato1,jidSeuContato2,..." > .env
```

Ou este se quer modo aberto:

```bash
echo -e "MODO_ACESSO=aberto" > .env
```

E por fim:

```bash
npm install --cpu=wasm32 sharp@0.35.3 @img/sharp-wasm32 --save-exact

npm install
npm start
```
