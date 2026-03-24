// === Agent Bridge (Discord Transport) ===
// Discord-specific transport layer for agent ↔ cascade interaction.
// Uses AgentSession for orchestration — transport-agnostic cascade lifecycle.
//
// Discord Commands (no @mention needed):
//   /help           — show available commands
//   /listws         — list workspaces under defaultWorkspaceRoot
//   /setws <name>   — set active workspace; creates new cascade if bridge active
//
// Regular messages (@mention required in guild):
//   Relayed to Antigravity cascade. Antigravity NOTIFY_USER → forwarded to Discord.

const fs = require('fs');
const path = require('path');
const discord = require('./discord-relay');
const telegram = require('./telegram-relay');
const { getSettings, getBridgeSettings, saveBridgeSettings } = require('./config');
const { exec } = require('child_process');
const sessionManager = require('./agent-session-manager');
const vercelHelper = require('./vercel-helper');

// ── State ────────────────────────────────────────────────────────────────────
const STATES = { IDLE: 'IDLE', ACTIVE: 'ACTIVE', TRANSITIONING: 'TRANSITIONING' };

let state = STATES.IDLE; // Aggregate state for compatibility
let isDiscordActive = false;
let isTelegramActive = false;

let softLimit = 500;
let workspaceName = 'AntigravityAuto';
let log = [];
let bridgeLsInst = null;
let session = null; // AgentSession instance — owns cascade lifecycle

// Active relays mapping for easier access
const relays = {
    discord: { active: false, module: discord, name: 'Discord' },
    telegram: { active: false, module: telegram, name: 'Telegram' },
};

// ── Persist bridge state to settings.json ────────────────────────────────────
function saveBridgeState() {
    if (!session) return;
    saveBridgeSettings({
        currentWorkspace: workspaceName,
        lastCascadeId: session.cascadeId,
        lastStepCount: session.stepCount,
    });
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Starts a specific transport channel.
 */
async function startTransport(type, config = {}) {
    if (!relays[type]) throw new Error(`Unknown transport type: ${type}`);
    if (relays[type].active) throw new Error(`${relays[type].name} already active`);

    const bs = getBridgeSettings();
    softLimit = config.stepSoftLimit || bs.stepSoftLimit || 500;
    workspaceName = bs.currentWorkspace || config.workspaceName || 'AntigravityAuto';

    if (!session) {
        const { lsInstances } = require('./config');
        const matchInst = lsInstances.find(i => i.workspaceName.toLowerCase() === workspaceName.toLowerCase());
        if (matchInst) {
            bridgeLsInst = { port: matchInst.port, csrfToken: matchInst.csrfToken, useTls: matchInst.useTls };
            addLog('system', `Bound to LS instance: ${workspaceName} (port ${matchInst.port})`);
        }
    }

    const eventHook = (transportName, event, data) => {
        if (event === 'error') addLog('error', `${transportName}: ${data.message}`);
        if (event === 'ready') addLog('system', `${transportName} ready: ${data.tag || data.username}`);
        if (event === 'listening') addLog('system', `${transportName} active on ${data.channelId || data.chatId}`);
        if (event === 'log') addLog(data.type || 'system', data.message);
        if (event === 'update') addLog('system', `[${transportName}] Msg from @${data.from}: "${data.text}"`);
        if (event === 'reply') addLog('system', `[${transportName}] Reply processed: action=${data.action}`);
        if (event === 'command') addLog('system', `[${transportName}] Command: /${data.command} from @${data.from}`);
        if (event === 'ignored') addLog('system', `[${transportName}] Ignored: "${data.text || data.reason}"`);
    };

    if (type === 'discord') {
        const token = config.discordBotToken || bs.discordBotToken;
        const channelId = config.discordChannelId || bs.discordChannelId;
        const guildId = config.discordGuildId || bs.discordGuildId || '';
        if (!token || !channelId) throw new Error('Missing Discord token or channel ID');
        addLog('system', 'Initializing Discord bot...');
        await discord.init(token, channelId, guildId, (ev, data) => eventHook('Discord', ev, data));
        discord.startListening(handlePiReply, (cmd, args, rf) => handleCommand('Discord', cmd, args, rf));
        isDiscordActive = true;
        relays.discord.active = true;
    } else if (type === 'telegram') {
        const token = config.telegramBotToken || bs.telegramBotToken;
        const chatId = config.telegramChatId || bs.telegramChatId;
        if (!token || !chatId) throw new Error('Missing Telegram token or chat ID');
        addLog('system', 'Initializing Telegram bot...');

        let lastErr;
        for (let i = 1; i <= 5; i++) {
            try {
                if (i > 1) addLog('system', `Retrying Telegram init (attempt ${i}/5)...`);

                const startAt = Date.now();
                const initPromise = telegram.init(token, chatId, (ev, data) => eventHook('Telegram', ev, data));
                const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('init timeout (15s)')), 15000));

                await Promise.race([initPromise, timeoutPromise]);
                addLog('system', `Telegram bot initialized successfully in ${((Date.now() - startAt) / 1000).toFixed(1)}s`);
                lastErr = null;
                break;
            } catch (err) {
                lastErr = err;
                console.error(`  ❌ [Telegram] Attempt ${i} failed: ${err.message}`);
                // if (i < 5) {
                //     await telegram.stop().catch(() => { });
                //     await new Promise(r => setTimeout(r, 5000));
                // }
            }
        }
        if (lastErr) throw new Error(`Telegram failed after 5 attempts: ${lastErr.message}`);

        telegram.startListening(handlePiReply, (cmd, args, rf) => handleCommand('Telegram', cmd, args, rf));
        isTelegramActive = true;
        relays.telegram.active = true;
    }

    if (!session) {
        addLog('system', `Creating agent session for ${workspaceName}...`);
        const sessionOpts = {
            workspace: workspaceName,
            stepSoftLimit: softLimit,
            lsInst: bridgeLsInst,
            transport: type,
            persist: () => saveBridgeState(),
        };
        if (bs.lastCascadeId) sessionOpts.cascadeId = bs.lastCascadeId;
        session = sessionManager.createSession(sessionOpts);
        session.on('log', ({ type, message }) => addLog(type, message));
        session.on('cascade_transition', (info) => broadcastMessage(`🔄 Cascade transition: #${info.oldShort} → #${info.newShort}`));
        session.on('step_limit_warning', ({ stepCount: sc }) => broadcastMessage(`⚠️ Warning: ${sc} steps reached`));
        state = STATES.ACTIVE;
    } else {
        session.transport = Object.keys(relays).filter(k => relays[k].active).join('+');
    }

    addLog('system', `${relays[type].name} bridge started`);
    // DO NOT await broadcastMessage to avoid hanging the API response if the bot is slow
    broadcastMessage(`🤖 **${relays[type].name} Bridge Connected**\nWorkspace: \`${workspaceName}\`\nUse /start to start the bot.`).catch(() => { });

    return getStatus();
}

/**
 * Stops a specific transport channel.
 */
function stopTransport(type) {
    if (!relays[type] || !relays[type].active) return;
    relays[type].module.stop();
    relays[type].active = false;
    if (type === 'discord') isDiscordActive = false;
    if (type === 'telegram') isTelegramActive = false;
    addLog('system', `${relays[type].name} bridge stopped`);
    const remaining = Object.values(relays).filter(r => r.active);
    if (remaining.length === 0) {
        if (session) { sessionManager.destroySession(session.id); session = null; }
        state = STATES.IDLE;
    } else if (session) {
        session.transport = remaining.map(r => r.name.toLowerCase()).join('+');
    }
}

async function startBridge(config = {}) {
    if (config.discordBotToken || getBridgeSettings().discordBotToken) await startTransport('discord', config);
    if (config.telegramBotToken || getBridgeSettings().telegramBotToken) await startTransport('telegram', config);
    return getStatus();
}

/**
 * Sends a one-off test message to verify credentials.
 */
async function testTransport(type, config = {}) {
    if (!relays[type]) throw new Error(`Unknown transport type: ${type}`);
    const relay = relays[type];
    const bs = getBridgeSettings();

    // Use telegraf instance directly if not active
    if (type === 'telegram') {
        const token = config.telegramBotToken || bs.telegramBotToken;
        const chatId = config.telegramChatId || bs.telegramChatId;
        if (!token || !chatId) throw new Error('Missing Telegram token or chat ID');

        // If already active, use the existing one, otherwise init a temporary one
        if (relay.active) {
            await relay.module.sendMessage('🔔 **Telegram Bridge Test**: Connection working! (Active)');
        } else {
            // Telegraf init is fast
            const { Telegraf } = require('telegraf');
            const bot = new Telegraf(token);
            await bot.telegram.sendMessage(chatId, '🔔 **Telegram Bridge Test**: Connection working! (Temporary check)');
        }
    } else if (type === 'discord') {
        const token = config.discordBotToken || bs.discordBotToken;
        const channelId = config.discordChannelId || bs.discordChannelId;
        if (!token || !channelId) throw new Error('Missing Discord token or channel ID');
        if (relay.active) {
            await relay.module.sendMessage('🔔 **Discord Bridge Test**: Connection working!');
        } else {
            throw new Error('Discord test currently requires bridge to be started first');
        }
    }
    return { ok: true, message: 'Test message sent successfully' };
}

function stopBridge() {
    stopTransport('discord');
    stopTransport('telegram');
    return { ok: true };
}

function getStatus() {
    return {
        state,
        discordActive: relays.discord.active,
        telegramActive: relays.telegram.active,
        cascadeId: session?.cascadeId || null,
        cascadeIdShort: shortId(session?.cascadeId),
        stepCount: session?.stepCount || 0,
        softLimit,
        workspaceName,
        log: log.slice(-50),
    };
}

// ── Multi-Transport Helpers ──────────────────────────────────────────────────

async function broadcastMessage(text) {
    const activeOnes = Object.values(relays).filter(r => r.active);
    const jobs = activeOnes.map(r => {
        const msg = r.module.formatBridgeStatus ? r.module.formatBridgeStatus(text) : text;
        return r.module.sendMessage(msg).catch(e => addLog('error', `Broadcast failed (${r.name}): ${e.message}`));
    });
    return Promise.all(jobs);
}

// ── Transport Command Handler ───────────────────────────────────────────────────

async function handleCommand(transport, cmd, args, replyFn) {
    const settings = getSettings();
    const wsRoot = settings.defaultWorkspaceRoot || '';
    const { lsInstances } = require('./config');

    switch (cmd) {
        case 'help': {
            await replyFn([
                '📖 **Agent Bridge Commands**',
                '---',
                '/help              — Show this help',
                '/status            — Show current state & stats',
                '/listws            — List workspaces',
                '/setws <name>      — Switch/Open workspace',
                '/logs              — Show last 10 logs',
                '/accept, /reject   — Handle step approval',
                '/abort             — Stop current task',
                '---',
                '🚀 **Deploy**: Require `npm i -g vercel@latest`',
                `**Active workspace:** \`${workspaceName}\``,
                `**Cascade:** #${shortId(session?.cascadeId)} (${session?.stepCount || 0}/${softLimit} steps)`,
                `**State:** ${state}`,
            ].join('\n'));
            break;
        }

        case 'status': {
            await replyFn([
                `🤖 **Status: ${state}**`,
                `Workspace: \`${workspaceName}\``,
                `Cascade: #${shortId(session?.cascadeId)}`,
                `Steps: ${session?.stepCount || 0}/${softLimit}`,
                `Discord: ${relays.discord.active ? '🟢' : '🔴'} | Telegram: ${relays.telegram.active ? '🟢' : '🔴'}`,
            ].join('\n'));
            break;
        }

        case 'logs': {
            const lastLogs = log.slice(-10).map(l => `• \`${new Date(l.ts).toLocaleTimeString()}\` [${l.type}] ${String(l.message).substring(0, 100)}`);
            await replyFn(['📜 **Last 10 Logs**', ...lastLogs].join('\n'));
            break;
        }

        case 'accept':
        case 'reject':
        case 'abort': {
            if (!session) {
                await replyFn('❌ No active session to handle this command');
                break;
            }
            // Use the same Pi reply logic but with empty text and specific action
            await handlePiReply({
                reply: '',
                action: cmd,
                transport: transport.toLowerCase()
            });
            break;
        }

        case 'listws': {
            const lines = [];
            if (lsInstances.length > 0) {
                lines.push('**🟢 Running (Antigravity open):**');
                lsInstances.forEach(inst => {
                    const activeTag = inst.active ? ' ← LS active' : '';
                    const bridgeTag = inst.workspaceName === workspaceName ? ' 🤖' : '';
                    const bold = inst.active ? '**' : '';
                    lines.push(`${bold}• ${inst.workspaceName}${activeTag}${bridgeTag}${bold}`);
                });
            } else {
                lines.push('*No running Antigravity instances detected*');
            }
            try {
                if (wsRoot && fs.existsSync(wsRoot)) {
                    const running = new Set(lsInstances.map(i => i.workspaceName));
                    const fsWs = fs.readdirSync(wsRoot, { withFileTypes: true })
                        .filter(d => d.isDirectory() && !running.has(d.name))
                        .map(d => d.name).sort();
                    if (fsWs.length > 0) {
                        lines.push('\n**📁 Other folders (not running):**');
                        fsWs.forEach(w => lines.push(`• ${w}`));
                    }
                }
            } catch { /* ignore */ }
            lines.push(`\n*Use \`/setws <name>\` to switch. 🤖 = bridge workspace*`);
            await replyFn(lines.join('\n'));
            break;
        }

        case 'setws': {
            const newWs = args[0] || '';
            if (!newWs.trim()) {
                await replyFn(`❌ Usage: \`/setws <workspace_name>\`\nCurrent: \`${workspaceName}\``);
                break;
            }

            const matchIdx = lsInstances.findIndex(
                i => i.workspaceName.toLowerCase() === newWs.toLowerCase()
            );

            if (matchIdx >= 0) {
                const { cleanupAll } = require('./cleanup');
                cleanupAll();
                bridgeLsInst = { port: lsInstances[matchIdx].port, csrfToken: lsInstances[matchIdx].csrfToken, useTls: lsInstances[matchIdx].useTls };
                workspaceName = lsInstances[matchIdx].workspaceName;
                addLog('system', `Switched LS → ${workspaceName} (port: ${lsInstances[matchIdx].port})`);
                saveBridgeSettings({ currentWorkspace: workspaceName });

                if (session && (state === STATES.ACTIVE || state === STATES.TRANSITIONING)) {
                    await replyFn(`✅ Switched to \`${workspaceName}\` (port ${lsInstances[matchIdx].port})\n🔄 Starting new cascade...`);
                    await session.switchWorkspace(workspaceName, bridgeLsInst);
                } else {
                    await replyFn(`✅ Switched to \`${workspaceName}\` — ready`);
                }
                break;
            }

            // Not running — open in Antigravity IDE
            await replyFn(`⏳ Opening \`${newWs}\` in Antigravity... (waiting up to 30s)`);
            addLog('system', `Opening workspace: ${newWs}`);

            const { PORT } = require('./config');
            const authKey = process.env.AUTH_KEY || '';
            const headers = { 'Content-Type': 'application/json' };
            if (authKey) headers['X-Auth-Key'] = authKey;

            let createResult;
            try {
                const res = await fetch(`http://localhost:${PORT}/api/workspaces/create`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ name: newWs }),
                    signal: AbortSignal.timeout(35000),
                });
                createResult = await res.json();
            } catch (e) {
                await replyFn(`❌ Failed to open workspace: ${e.message}`);
                break;
            }

            if (createResult.error) {
                await replyFn(`❌ ${createResult.error}`);
                break;
            }

            const newIdx = lsInstances.findIndex(
                i => i.workspaceName.toLowerCase() === newWs.toLowerCase()
            );
            if (newIdx >= 0) {
                bridgeLsInst = { port: lsInstances[newIdx].port, csrfToken: lsInstances[newIdx].csrfToken, useTls: lsInstances[newIdx].useTls };
                workspaceName = lsInstances[newIdx].workspaceName;
            } else if (createResult.workspace?.workspaceName) {
                const fallbackIdx = lsInstances.findIndex(
                    i => i.workspaceName.toLowerCase() === createResult.workspace.workspaceName.toLowerCase()
                );
                if (fallbackIdx >= 0) {
                    bridgeLsInst = { port: lsInstances[fallbackIdx].port, csrfToken: lsInstances[fallbackIdx].csrfToken, useTls: lsInstances[fallbackIdx].useTls };
                }
                workspaceName = createResult.workspace.workspaceName;
            } else {
                workspaceName = newWs;
            }

            saveBridgeSettings({ currentWorkspace: workspaceName });
            addLog('system', `Workspace opened: ${workspaceName}`);

            if (session && (state === STATES.ACTIVE || state === STATES.TRANSITIONING)) {
                await replyFn(`✅ \`${workspaceName}\` opened — starting new cascade...`);
                await session.switchWorkspace(workspaceName, bridgeLsInst);
            } else {
                await replyFn(`✅ \`${workspaceName}\` is ready`);
            }
            break;
        }

        case 'createws': {
            const newWsName = args[0] || '';
            if (!newWsName.trim()) {
                await replyFn(`❌ Usage: \`/createws <workspace_name>\``);
                break;
            }

            await replyFn(`⏳ Creating \`${newWsName}\` and opening in Antigravity... (waiting up to 30s)`);
            addLog('system', `Creating workspace: ${newWsName}`);

            const { PORT: CREATE_PORT } = require('./config');
            const { lsInstances: lsInst2 } = require('./config');
            const createAuthKey = process.env.AUTH_KEY || '';
            const createHeaders = { 'Content-Type': 'application/json' };
            if (createAuthKey) createHeaders['X-Auth-Key'] = createAuthKey;

            let result;
            try {
                const res = await fetch(`http://localhost:${CREATE_PORT}/api/workspaces/create`, {
                    method: 'POST',
                    headers: createHeaders,
                    body: JSON.stringify({ name: newWsName }),
                    signal: AbortSignal.timeout(35000),
                });
                result = await res.json();
            } catch (e) {
                await replyFn(`❌ Failed: ${e.message}`);
                break;
            }

            if (result.error) {
                await replyFn(`❌ ${result.error}`);
                break;
            }

            if (result.alreadyOpen) {
                await replyFn(`ℹ️ Workspace \`${newWsName}\` already open — use \`/setws ${newWsName}\` to switch`);
                break;
            }

            const newIdx2 = lsInst2.findIndex(i => i.workspaceName.toLowerCase() === newWsName.toLowerCase());
            if (newIdx2 >= 0) {
                bridgeLsInst = { port: lsInst2[newIdx2].port, csrfToken: lsInst2[newIdx2].csrfToken, useTls: lsInst2[newIdx2].useTls };
                workspaceName = lsInst2[newIdx2].workspaceName;
            } else if (result.workspace?.workspaceName) {
                const fallbackIdx2 = lsInst2.findIndex(
                    i => i.workspaceName.toLowerCase() === result.workspace.workspaceName.toLowerCase()
                );
                if (fallbackIdx2 >= 0) {
                    bridgeLsInst = { port: lsInst2[fallbackIdx2].port, csrfToken: lsInst2[fallbackIdx2].csrfToken, useTls: lsInst2[fallbackIdx2].useTls };
                }
                workspaceName = result.workspace.workspaceName;
            } else {
                workspaceName = newWsName;
            }

            saveBridgeSettings({ currentWorkspace: workspaceName });
            addLog('system', `Workspace created + opened: ${workspaceName}`);

            if (session && (state === STATES.ACTIVE || state === STATES.TRANSITIONING)) {
                await replyFn(`✅ \`${workspaceName}\` created — starting new cascade...`);
                await session.switchWorkspace(workspaceName, bridgeLsInst);
            } else {
                await replyFn(`✅ \`${workspaceName}\` created and ready`);
            }
            break;
        }

        case 'git_commit': {
            const lsInstance = await getActiveLsInstance(isSendReply = true);
            const msg = args.join(' ') || 'Update from Agent Bridge';
            await replyFn(`⏳ **Git**: Committing changes with message: \`${msg}\`...`);
            const cmdStr = `git add . && git commit -m "${msg.replace(/"/g, '\\"')}"`;
            await executeAndReply(cmdStr, replyFn, lsInstance);
            await replyFn(`\n\nPush is ready`);
            break;
        }

        case 'git_push': {
            const lsInstance = await getActiveLsInstance();
            await replyFn('⏳ **Git**: Pushing to remote...');
            await executeAndReply('git push', replyFn, lsInstance);
            break;
        }

        case 'vercel_deploy': {
            const lsInstance = await getActiveLsInstance();
            if (!lsInstance) {
                await replyFn(`❌ No active LS instance found`);
                break;
            }

            const vercelToken = process.env.VERCEL_TOKEN;
            const steps = vercelHelper.getVercelDeploySteps(vercelToken);

            let lastOutput = '';
            for (const step of steps) {
                await replyFn(`⏳ **Vercel**: ${step.name} starting...`);
                const result = await execute(step.cmd, lsInstance);
                lastOutput = result.output;

                if (result.error) {
                    let errorMsg = `❌ **Vercel ${step.name} Failed**\n\`\`\`\n${result.output || result.error.message}\n\`\`\``;
                    if (step.cmd.includes('vercel') && (result.error.message.includes('not found') || result.error.message.includes('not recognized'))) {
                        errorMsg += '\n\n💡 **Tip**: Ensure Vercel CLI is installed: `npm i -g vercel@latest`';
                    }
                    await replyFn(errorMsg);
                    return; // Stop execution on error
                }
                
                await replyFn(`✅ **Vercel ${step.name} Success**\n\`\`\`\n${result.output || 'No output'}\n\`\`\``);
            }

            // Fetch and show domain info
            const workspacePath = uriToFsPath(lsInstance.workspaceFolderUri);
            await vercelHelper.fetchVercelDomainInfo(workspacePath, vercelToken, addLog, replyFn);

            // Optional: Extract preview URL and show final success
            const urlMatch = lastOutput.match(/https:\/\/[a-zA-Z0-9-]+\.vercel\.app/);
            if (urlMatch) {
                await replyFn(`🚀 **Deployment Live!**\nURL: ${urlMatch[0]}`);
            }
            break;
        }

        default:
            await replyFn(`❓ Unknown command \`/${cmd}\`. Type \`/help\` for available commands.`);
    }

    async function getActiveLsInstance() {
        let lsInstance = lsInstances.find(ins => ins.workspaceName === workspaceName);
        if (!lsInstance) {
            lsInstance = lsInstances.find(ins => ins.active);
        }
        return lsInstance;
    }

    async function executeAndReply(command, reply, lsInstance) {
        const result = await execute(command, lsInstance);
        if (result.error) {
            let errorMsg = `❌ **Command Failed**\n\`\`\`\n${result.output || result.error.message}\n\`\`\``;
            if (command.startsWith('vercel') && (result.error.message.includes('not found') || result.error.message.includes('not recognized'))) {
                errorMsg += '\n\n💡 **Tip**: Ensure Vercel CLI is installed: `npm i -g vercel@latest`';
            }
            await reply(errorMsg);
        } else {
            await reply(`✅ **Success**\n\`\`\`\n${result.output || 'Done (no output)'}\n\`\`\``);
        }
    }

    async function execute(command, lsInstance) {
        if (!lsInstance) return { error: new Error('No active LS instance'), output: '' };
        const cwd = uriToFsPath(lsInstance.workspaceFolderUri);
        if (!fs.existsSync(cwd)) return { error: new Error(`Path not found: ${cwd}`), output: '' };

        return new Promise((resolve) => {
            exec(command, { cwd }, (error, stdout, stderr) => {
                const output = ((stdout || '') + (stderr || '')).trim().substring(0, 1800);
                resolve({ error, output });
            });
        });
    }
}

// Helper: convert workspaceFolderUri to filesystem path
function uriToFsPath(uri) {
    if (!uri) return null;
    try {
        const url = new URL(uri);
        let p = decodeURIComponent(url.pathname);
        if (process.platform === 'win32' && /^\/[a-zA-Z]:/.test(p)) p = p.substring(1);
        return p;
    } catch { return null; }
}

// ── Handle Pi's reply from Discord ───────────────────────────────────────────
// Now delegates to AgentSession for all cascade orchestration.

async function handlePiReply({ reply, action, authorId, authorName, transport }) {
    if (state !== STATES.ACTIVE && state !== STATES.TRANSITIONING) return;
    if (!session) return;

    // Busy gate — handled by session, but give feedback to active transport
    if (session.isBusy) {
        addLog('system', 'Bridge busy — waiting for response relay. Message blocked.');
        const msg = `⚠️ Agent đang xử lý, hãy chờ response rồi gửi lại message nhé`;
        if (transport === 'discord') discord.sendMessage(discord.formatBridgeStatus(msg)).catch(() => { });
        else if (transport === 'telegram') telegram.sendMessage(msg).catch(() => { });
        return;
    }

    addLog('from_pi', (authorName ? `${authorName}: ` : '') + reply.substring(0, 200));

    // Show "typing..."
    const activeModules = Object.values(relays).filter(r => r.active).map(r => r.module);
    activeModules.forEach(r => { if (r.sendTyping) r.sendTyping(); });
    const typingInterval = setInterval(() => {
        activeModules.forEach(r => { if (r.sendTyping) r.sendTyping(); });
    }, 8000);

    // Delegate to AgentSession — blocking call
    const result = await session.sendMessage(reply, {
        action: action || null,
        authorName: authorName || null,
    });

    clearInterval(typingInterval);

    if (result.text) {
        // Broadcast response to ALL active transports
        const jobs = activeModules.map(async (r) => {
            try {
                await r.sendResponse({
                    workspaceName,
                    cascadeIdShort: shortId(session.cascadeId),
                    stepCount: result.stepCount,
                    softLimit,
                    content: result.text,
                    mentionUserId: authorId,
                    mentionUserName: authorName,
                });
            } catch (e) {
                addLog('error', `Send to relay failed: ${e.message}`);
            }
        });
        await Promise.all(jobs);
    } else if (result.busy) {
        const msg = `⚠️ Agent đang xử lý, hãy chờ response rồi gửi lại message nhé`;
        broadcastMessage(msg).catch(() => { });
    } else {
        addLog('system', 'Response extraction failed or timeout');
    }

    if (state === STATES.TRANSITIONING) {
        state = STATES.ACTIVE;
    }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function shortId(id) {
    return id ? id.substring(0, 8) : '--------';
}

function addLog(type, message) {
    log.push({ type, message, ts: Date.now() });
    if (log.length > 200) log = log.slice(-200);
    const line = `[Bridge/${type}] ${String(message).substring(0, 120)}`;
    console.log(line);
    try {
        const logPath = path.join(__dirname, '..', 'bridge.log');
        fs.appendFileSync(logPath, `${new Date().toISOString()} ${line}\n`);
    } catch { /* ignore write errors */ }
    try {
        const { broadcastAll } = require('./ws');
        broadcastAll({ type: 'bridge_status', ...getStatus() });
    } catch { /* ws not ready yet */ }
}

// ── Exports ───────────────────────────────────────────────────────────────────

module.exports = {
    startTransport, stopTransport, startBridge, stopBridge, getStatus, testTransport,
    STATES,
    get state() { return state; },
    get isDiscordActive() { return isDiscordActive; },
    get isTelegramActive() { return isTelegramActive; },
    get activeCascadeId() { return session?.cascadeId || null; },
    get stepCount() { return session?.stepCount || 0; },
};
