// === Agent Bridge Routes ===
// /api/agent-bridge/*

// Module scope — bridge and BridgeSettingsSchema declared here (not inside setupRoutes closure)
const { z } = require('zod');
const bridge = require('../agent-bridge');

const BridgeSettingsSchema = z.object({
    telegramBotToken: z.string().max(200).optional(),
    telegramChatId: z.string().max(100).optional(),
    telegramAutoStart: z.boolean().optional(),
    discordBotToken: z.string().max(200).optional(),
    discordChannelId: z.string().max(100).optional(),
    discordGuildId: z.string().max(100).optional(),
    discordAutoStart: z.boolean().optional(),
    stepSoftLimit: z.number().int().min(0).max(10000).optional(),
    allowedBotIds: z.array(z.string()).optional(),
    autoStart: z.boolean().optional(),
    currentWorkspace: z.string().optional(),
    lastCascadeId: z.string().optional(),
    lastStepCount: z.number().optional(),
    lastRelayedStepIndex: z.number().optional(),
}).passthrough();

module.exports = function setupAgentBridgeRoutes(app) {
    app.post('/api/agent-bridge/start', async (req, res) => {
        console.log('  🤖 [API] POST /api/agent-bridge/start');
        try {
            const status = await bridge.startBridge(req.body || {});
            res.json({ ok: true, ...status });
        } catch (e) {
            console.error('  ❌ [API] /start error:', e);
            res.status(400).json({ ok: false, error: e.message });
        }
    });

    app.post('/api/agent-bridge/start-discord', async (req, res) => {
        console.log('  🤖 [API] POST /api/agent-bridge/start-discord');
        try {
            const status = await bridge.startTransport('discord', req.body || {});
            res.json({ ok: true, ...status });
        } catch (e) {
            res.status(400).json({ ok: false, error: e.message });
        }
    });

    app.post('/api/agent-bridge/start-telegram', async (req, res) => {
        console.log('  🤖 [API] POST /api/agent-bridge/start-telegram');
        try {
            const status = await bridge.startTransport('telegram', req.body || {});
            res.json({ ok: true, ...status });
        } catch (e) {
            console.error('  ❌ [API] /start-telegram error:', e);
            res.status(500).json({ ok: false, error: e.message || 'Internal Server Error' });
        }
    });

    app.post('/api/agent-bridge/stop', (req, res) => {
        console.log('  🤖 [API] POST /api/agent-bridge/stop');
        bridge.stopBridge();
        res.json({ ok: true });
    });

    app.post('/api/agent-bridge/stop-discord', (req, res) => {
        console.log('  🤖 [API] POST /api/agent-bridge/stop-discord');
        bridge.stopTransport('discord');
        res.json({ ok: true });
    });

    app.post('/api/agent-bridge/stop-telegram', (req, res) => {
        console.log('  🤖 [API] POST /api/agent-bridge/stop-telegram');
        bridge.stopTransport('telegram');
        res.json({ ok: true });
    });

    app.post('/api/agent-bridge/test-transport', async (req, res) => {
        const { type, config } = req.body || {};
        try {
            const result = await bridge.testTransport(type, config || {});
            res.json(result);
        } catch (e) {
            res.status(400).json({ ok: false, error: e.message });
        }
    });

    app.get('/api/agent-bridge/status', (req, res) => {
        res.json(bridge.getStatus());
    });

    // Bridge-specific settings (bridge.settings.json)
    app.get('/api/agent-bridge/settings', (req, res) => {
        const { getBridgeSettings } = require('../config');
        res.json(getBridgeSettings());
    });

    app.post('/api/agent-bridge/settings', (req, res) => {
        try {
            const validated = BridgeSettingsSchema.parse(req.body);
            const { saveBridgeSettings } = require('../config');
            const updated = saveBridgeSettings(validated);
            res.json(updated);
        } catch (error) {
            if (error instanceof z.ZodError) {
                return res.status(400).json({ error: 'Invalid settings', details: error.issues });
            }
            throw error;
        }
    });
};
