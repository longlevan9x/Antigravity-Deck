const { Telegraf, Markup } = require('telegraf');

function getMainMenu() {
    return Markup.inlineKeyboard([
        [Markup.button.callback('📊 Status', 'status'), Markup.button.callback('📜 Logs', 'logs')],
        [Markup.button.callback('📂 List Workspaces', 'listws'), Markup.button.callback('✅ Accept', 'accept')],
        [Markup.button.callback('❌ Reject', 'reject'), Markup.button.callback('🛑 Abort', 'abort')],
        [Markup.button.callback('📝 Git Commit', 'git_commit'), Markup.button.callback('🚀 Git Push', 'git_push')],
        [Markup.button.callback('🌐 URL & QR', 'url'), Markup.button.callback('📖 Help', 'help')]
    ]);
}

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
        ctx.reply("🤖 **Antigravity Deck Telegram Relay ACTIVE**\nSử dụng các nút bên dưới hoặc gõ `/` để xem menu lệnh.", {
            parse_mode: 'Markdown',
            ...getMainMenu()
        });
        eventHook('ready', { username: bot.botInfo?.username });
    });

    // Register commands for the Telegram menu button
    bot.telegram.setMyCommands([
        { command: 'start', description: 'Bắt đầu & Hiện menu' },
        { command: 'status', description: 'Kiểm tra trạng thái' },
        { command: 'listws', description: 'Danh sách workspace' },
        { command: 'git_commit', description: 'Git Commit thay đổi' },
        { command: 'git_push', description: 'Git Push thay đổi' },
        { command: 'url', description: 'Lấy URL & QR Code' },
        // { command: 'vercel_deploy', description: 'Deploy lên Vercel' },
        { command: 'logs', description: 'Xem log gần đây' },
        { command: 'help', description: 'Hướng dẫn sử dụng' }
    ]).catch(err => console.error('  ❌ [Telegram] Failed to set commands:', err.message));

    // Command handlers
    bot.command('help', (ctx) => handleCommandWrap(ctx, 'help'));
    bot.command('listws', (ctx) => handleCommandWrap(ctx, 'listws'));
    bot.command('setws', (ctx) => handleCommandWrap(ctx, 'setws', ctx.message.text.split(' ').slice(1)));
    bot.command('createws', (ctx) => handleCommandWrap(ctx, 'createws', ctx.message.text.split(' ').slice(1)));
    bot.command('status', (ctx) => handleCommandWrap(ctx, 'status'));
    bot.command('logs', (ctx) => handleCommandWrap(ctx, 'logs'));
    bot.command('accept', (ctx) => handleCommandWrap(ctx, 'accept'));
    bot.command('reject', (ctx) => handleCommandWrap(ctx, 'reject'));
    bot.command('abort', (ctx) => handleCommandWrap(ctx, 'abort'));
    bot.command('git_commit', (ctx) => handleCommandWrap(ctx, 'git_commit', ctx.message.text.split(' ').slice(1)));
    bot.command('git_push', (ctx) => handleCommandWrap(ctx, 'git_push'));
    bot.command('url', (ctx) => handleUrlCommand(ctx));
    // bot.command('vercel_deploy', (ctx) => handleCommandWrap(ctx, 'vercel_deploy'));

    // Action handlers (for inline buttons)
    bot.action('status', (ctx) => handleCommandWrap(ctx, 'status'));
    bot.action('logs', (ctx) => handleCommandWrap(ctx, 'logs'));
    bot.action('listws', (ctx) => handleCommandWrap(ctx, 'listws'));
    bot.action('accept', (ctx) => handleCommandWrap(ctx, 'accept'));
    bot.action('reject', (ctx) => handleCommandWrap(ctx, 'reject'));
    bot.action('abort', (ctx) => handleCommandWrap(ctx, 'abort'));
    bot.action('git_commit', (ctx) => handleCommandWrap(ctx, 'git_commit'));
    bot.action('git_push', (ctx) => handleCommandWrap(ctx, 'git_push'));
    bot.action('url', (ctx) => handleUrlCommand(ctx));
    // bot.action('vercel_deploy', (ctx) => handleCommandWrap(ctx, 'vercel_deploy'));
    bot.action('help', (ctx) => handleCommandWrap(ctx, 'help'));

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
    eventHook('log', { type: 'system', message: `[Telegram] Start handleCommandWrap ${ctx.from.username}` });
    if (ctx.chat.id.toString() !== chatId.toString()) return;
    eventHook('command', { command: cmd, from: ctx.from.username });

    if (handleCommand) {
        await handleCommand(cmd, args, (text) => ctx.reply(text, { parse_mode: 'Markdown' }));
    }
}

async function handleUrlCommand(ctx) {
    if (ctx.chat.id.toString() !== chatId.toString()) return;
    
    try {
        const fs = require('fs');
        const path = require('path');
        const infoFile = path.join(__dirname, '..', '.tunnel-info.txt');
        
        if (!fs.existsSync(infoFile)) {
            return ctx.reply("⚠️ Không tìm thấy thông tin tunnel. Có thể bạn đang chạy ở chế độ local hoặc tunnel chưa khởi động xong.");
        }
        
        const content = fs.readFileSync(infoFile, 'utf8');
        const lines = content.split('\n');
        const info = {};
        lines.forEach(line => {
            const [key, ...val] = line.split(': ');
            if (key && val.length) info[key.trim()] = val.join(': ').trim();
        });
        
        const qrUrl = info['QR URL'];
        const authKey = info['Auth Key'];
        const feUrl = info['Frontend'];
        
        if (!qrUrl || qrUrl === 'N/A') {
            return ctx.reply(`🚀 *Antigravity Deck*\n\n🔗 [Open Dashboard](${feUrl})\n🔑 Key: \`${authKey}\``, { parse_mode: 'Markdown' });
        }
        
        const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(qrUrl)}`;
        const tgMsg = `🚀 *Antigravity Deck is ONLINE!*\n\n🔗 [Open Dashboard](${qrUrl})\n🔑 Key: \`${authKey}\`\n\n_Quét mã QR bên trên để tự động đăng nhập._`;
        
        await ctx.replyWithPhoto(qrImageUrl, {
            caption: tgMsg,
            parse_mode: 'Markdown'
        });
    } catch (err) {
        console.error('  ❌ [Telegram] Failed to send URL info:', err.message);
        ctx.reply(`⚠️ Lỗi khi lấy thông tin: ${err.message}`);
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
