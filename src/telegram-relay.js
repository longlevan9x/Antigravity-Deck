const { Telegraf } = require('telegraf');

let bot = null;
let chatId = null;
let eventHook = null;
let handlePiReply = null;
let handleCommand = null;

async function init(token, tid, hook) {
    if (bot) return;
    chatId = tid;
    eventHook = hook;
    console.log(`  🤖 [Telegram] Initializing with Chat ID: ${chatId}`);
    bot = new Telegraf(token);

    bot.start((ctx) => {
        if (ctx.chat.id.toString() !== chatId.toString()) {
            ctx.reply("⚠️ Bạn không có quyền truy cập vào Bot này.");
            eventHook('ignored', { from: ctx.from.username, text: '/start (wrong chat)' });
            return;
        }
        ctx.reply("🤖 Antigravity Deck Telegram Relay ACTIVE\nType /help for commands");
        eventHook('ready', { username: bot.botInfo?.username });
    });

    bot.command('help', (ctx) => handleCommandWrap(ctx, 'help'));
    bot.command('listws', (ctx) => handleCommandWrap(ctx, 'listws'));
    bot.command('setws', (ctx) => handleCommandWrap(ctx, 'setws', ctx.message.text.split(' ').slice(1)));
    bot.command('createws', (ctx) => handleCommandWrap(ctx, 'createws', ctx.message.text.split(' ').slice(1)));
    bot.command('status', (ctx) => handleCommandWrap(ctx, 'status'));
    bot.command('logs', (ctx) => handleCommandWrap(ctx, 'logs'));
    bot.command('accept', (ctx) => handleCommandWrap(ctx, 'accept'));
    bot.command('reject', (ctx) => handleCommandWrap(ctx, 'reject'));
    bot.command('abort', (ctx) => handleCommandWrap(ctx, 'abort'));

    // Handle generic text messages
    bot.on('text', async (ctx) => {
        eventHook('log', { type: 'system', message: `[Telegram] Start Received message from ${ctx.from.username}: ${ctx.message.text}` });
        if (ctx.chat.id.toString() !== chatId.toString()) return;
        if (ctx.message.text.startsWith('/')) return; // Commands handled above

        eventHook('log', { type: 'system', message: `[Telegram] Before handlePiReply ${ctx.from.username}: ${ctx.message.text}` });
        eventHook('update', { from: ctx.from.username, text: ctx.message.text });

        if (handlePiReply) {
            await handlePiReply({
                reply: ctx.message.text,
                action: 'user_chat',
                authorId: ctx.from.id,
                authorName: ctx.from.username,
                transport: 'telegram'
            });
        }
        eventHook('log', { type: 'system', message: `[Telegram] After handlePiReply ${ctx.from.username}: ${ctx.message.text}` });
    });

    bot.catch((err, ctx) => {
        console.error(`  ❌ [Telegram] Bot Error: ${err.message}`);
        eventHook('error', { message: `Telegram Error: ${err.message}` });
    });

    console.log('  🤖 [Telegram] Launching bot...');
    await bot.launch();
    console.log('  🤖 [Telegram] Bot is now LISTENING');
    eventHook('listening', { chatId });
}

async function handleCommandWrap(ctx, cmd, args = []) {
    eventHook('log', { type: 'system', message: `[Telegram] Start handleCommandWrap ${ctx.from.username}: ${ctx.message.text}` });
    if (ctx.chat.id.toString() !== chatId.toString()) return;
    eventHook('command', { command: cmd, from: ctx.from.username });

    if (handleCommand) {
        await handleCommand(cmd, args, (text) => ctx.reply(text, { parse_mode: 'Markdown' }));
    }
}

function startListening(piReplyFn, cmdFn) {
    handlePiReply = piReplyFn;
    handleCommand = cmdFn;
}

async function sendMessage(text) {
    if (!bot || !chatId) return;
    return bot.telegram.sendMessage(chatId, text, { parse_mode: 'Markdown' });
}

async function sendResponse({ workspaceName, cascadeIdShort, stepCount, softLimit, content, mentionUserName }) {
    if (!bot || !chatId) return;

    const header = `🤖 **${workspaceName}** (#${cascadeIdShort}) [${stepCount}/${softLimit}]\n`;
    const fullMsg = header + formatCode(content);

    return bot.telegram.sendMessage(chatId, fullMsg, { parse_mode: 'Markdown' });
}

function sendTyping() {
    if (!bot || !chatId) return;
    bot.telegram.sendChatAction(chatId, 'typing').catch(() => { });
}

async function stop() {
    if (bot) {
        bot.stop('SIGINT');
        bot = null;
    }
}

// Helpers
function formatCode(text) {
    // Escape markdown where needed or ensure code blocks are correct
    return text;
}

function formatBridgeStatus(text) {
    return text; // No special formatting needed for Telegram yet
}

module.exports = {
    init, startListening, sendMessage, sendResponse, sendTyping, stop, formatBridgeStatus
};
