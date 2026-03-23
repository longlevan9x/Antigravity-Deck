'use client';

import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
    Save, Check, ChevronDown, ChevronUp, Play, Square,
    Eye, EyeOff, Loader2, AlertCircle, Settings2, Bot, Send, Sparkles,
} from 'lucide-react';
import { wsService } from '@/lib/ws-service';
import { SESSION_STATE_CONFIG } from '@/lib/agent-utils';
import {
    fetchAgentApiSettings, saveAgentApiSettings as saveApiSettings,
    fetchBridgeSettings, saveBridgeSettings as saveBridgeSettingsApi,
    fetchBridgeStatus, startBridge, stopBridge,
} from '@/lib/agent-api';
import type { AgentApiSettings, BridgeSettings, BridgeStatus } from '@/lib/agent-api';

// ── Defaults ────────────────────────────────────────────────────────────

const DEFAULT_API_SETTINGS: AgentApiSettings = {
    enabled: true, maxConcurrentSessions: 5,
    sessionTimeoutMs: 1800000, defaultStepSoftLimit: 500,
};

const DEFAULT_BRIDGE: BridgeSettings = {
    discordBotToken: '', discordChannelId: '', discordGuildId: '',
    discordAutoStart: false,
    telegramBotToken: '', telegramChatId: '',
    telegramAutoStart: false,
    stepSoftLimit: 500, allowedBotIds: [], autoStart: false,
};

export function AgentConfigPanel() {
    // ── Agent API Settings ──────────────────────────────────────────────
    const [api, setApi] = useState<AgentApiSettings>(DEFAULT_API_SETTINGS);
    const [apiOriginal, setApiOriginal] = useState<AgentApiSettings>(DEFAULT_API_SETTINGS);
    const [apiSaving, setApiSaving] = useState(false);
    const [apiMsg, setApiMsg] = useState('');
    const [apiOpen, setApiOpen] = useState(true);

    // ── Discord Bridge Settings ─────────────────────────────────────────
    // ── Bridge Settings ────────────────────────────────────────────────
    const [bridge, setBridge] = useState<BridgeSettings>(DEFAULT_BRIDGE);
    const [bridgeOriginal, setBridgeOriginal] = useState<BridgeSettings>(DEFAULT_BRIDGE);
    const [bridgeStatus, setBridgeStatus] = useState<BridgeStatus | null>(null);
    
    // Discord UI States
    const [discordSaving, setDiscordSaving] = useState(false);
    const [discordMsg, setDiscordMsg] = useState('');
    const [discordLoading, setDiscordLoading] = useState(false);
    const [bridgeOpen, setBridgeOpen] = useState(false);
    const [showToken, setShowToken] = useState(false);

    // Telegram UI States
    const [telegramSaving, setTelegramSaving] = useState(false);
    const [telegramMsg, setTelegramMsg] = useState('');
    const [telegramLoading, setTelegramLoading] = useState(false);
    const [tgOpen, setTgOpen] = useState(false);
    const [showTgToken, setShowTgToken] = useState(false);

    // ── Load on mount ───────────────────────────────────────────────────
    useEffect(() => {
        fetchAgentApiSettings()
            .then(d => { setApi(d); setApiOriginal(d); })
            .catch(() => {});

        fetchBridgeSettings()
            .then(d => { const s = { ...DEFAULT_BRIDGE, ...d }; setBridge(s); setBridgeOriginal(s); })
            .catch(() => {});

        fetchBridgeStatus()
            .then(setBridgeStatus)
            .catch(() => {});

        if (!wsService) return;
        return wsService.on('bridge_status', (data) => {
            setBridgeStatus(data as unknown as BridgeStatus);
        });
    }, []);

    // ── API settings save ───────────────────────────────────────────────
    const hasApiChanges = JSON.stringify(api) !== JSON.stringify(apiOriginal);
    const handleSaveApi = async () => {
        setApiSaving(true); setApiMsg('');
        try {
            const updated = await saveApiSettings(api);
            setApi(updated); setApiOriginal(updated);
            setApiMsg('saved'); setTimeout(() => setApiMsg(''), 2000);
        } catch { setApiMsg('error'); }
        finally { setApiSaving(false); }
    };

    // ── Discord Handlers ────────────────────────────────────────────────
    const hasDiscordChanges = (
        bridge.discordBotToken !== bridgeOriginal.discordBotToken ||
        bridge.discordChannelId !== bridgeOriginal.discordChannelId ||
        bridge.discordGuildId !== bridgeOriginal.discordGuildId ||
        bridge.discordAutoStart !== bridgeOriginal.discordAutoStart ||
        bridge.stepSoftLimit !== bridgeOriginal.stepSoftLimit
    );

    const handleSaveDiscord = async () => {
        setDiscordSaving(true); setDiscordMsg('');
        try {
            const updated = await saveBridgeSettingsApi({
                discordBotToken: bridge.discordBotToken,
                discordChannelId: bridge.discordChannelId,
                discordGuildId: bridge.discordGuildId,
                discordAutoStart: bridge.discordAutoStart,
                stepSoftLimit: bridge.stepSoftLimit,
            });
            setBridgeOriginal(prev => ({ ...prev, ...updated }));
            setDiscordMsg('saved'); setTimeout(() => setDiscordMsg(''), 2000);
        } catch { setDiscordMsg('error'); }
        finally { setDiscordSaving(false); }
    };

    const handleStartDiscord = async () => {
        setDiscordLoading(true);
        try {
            const data = await import('@/lib/agent-api').then(m => m.startDiscord({
                discordBotToken: bridge.discordBotToken,
                discordChannelId: bridge.discordChannelId,
                discordGuildId: bridge.discordGuildId,
            }));
            setBridgeStatus(data);
        } catch { /* error handled by WS */ }
        finally { setDiscordLoading(false); }
    };

    const handleStopDiscord = async () => {
        setDiscordLoading(true);
        try {
            await import('@/lib/agent-api').then(m => m.stopDiscord());
            setBridgeStatus(await fetchBridgeStatus());
        } finally { setDiscordLoading(false); }
    };

    // ── Telegram Handlers ───────────────────────────────────────────────
    const hasTelegramChanges = (
        bridge.telegramBotToken !== bridgeOriginal.telegramBotToken ||
        bridge.telegramChatId !== bridgeOriginal.telegramChatId ||
        bridge.telegramAutoStart !== bridgeOriginal.telegramAutoStart
    );

    const handleSaveTelegram = async () => {
        setTelegramSaving(true); setTelegramMsg('');
        try {
            const updated = await saveBridgeSettingsApi({
                ...bridgeOriginal,
                telegramBotToken: bridge.telegramBotToken,
                telegramChatId: bridge.telegramChatId,
                telegramAutoStart: bridge.telegramAutoStart,
            });
            setBridgeOriginal(prev => ({ ...prev, ...updated }));
            setTelegramMsg('saved'); setTimeout(() => setTelegramMsg(''), 2000);
        } catch { setTelegramMsg('error'); }
        finally { setTelegramSaving(false); }
    };

    const handleStartTelegram = async () => {
        setTelegramLoading(true);
        try {
            const data = await import('@/lib/agent-api').then(m => m.startTelegram({
                telegramBotToken: bridge.telegramBotToken,
                telegramChatId: bridge.telegramChatId,
            }));
            setBridgeStatus(data);
        } catch { /* error handled by WS */ }
        finally { setTelegramLoading(false); }
    };

    const handleStopTelegram = async () => {
        setTelegramLoading(true);
        try {
            await import('@/lib/agent-api').then(m => m.stopTelegram());
            setBridgeStatus(await fetchBridgeStatus());
        } finally { setTelegramLoading(false); }
    };

    const handleTestTelegram = async () => {
        setTelegramLoading(true); setTelegramMsg('');
        try {
            const res = await import('@/lib/agent-api').then(m => m.testTransport('telegram', {
                telegramBotToken: bridge.telegramBotToken,
                telegramChatId: bridge.telegramChatId,
            }));
            if (res.ok) {
                setTelegramMsg('test_ok');
                setTimeout(() => setTelegramMsg(''), 3000);
            }
        } catch (e: any) { setTelegramMsg('error'); }
        finally { setTelegramLoading(false); }
    };

    const handleTestDiscord = async () => {
        setDiscordLoading(true); setDiscordMsg('');
        try {
            const res = await import('@/lib/agent-api').then(m => m.testTransport('discord', {
                discordBotToken: bridge.discordBotToken,
                discordChannelId: bridge.discordChannelId,
            }));
            if (res.ok) {
                setDiscordMsg('test_ok');
                setTimeout(() => setDiscordMsg(''), 3000);
            }
        } catch (e: any) { setDiscordMsg('error'); }
        finally { setDiscordLoading(false); }
    };

    const bridgeState = bridgeStatus?.state || 'IDLE';
    const discActive = bridgeStatus?.discordActive ?? false;
    const tgActive = bridgeStatus?.telegramActive ?? false;

    const stateConf = SESSION_STATE_CONFIG[bridgeState as keyof typeof SESSION_STATE_CONFIG] || SESSION_STATE_CONFIG.IDLE;
    const timeoutMinutes = Math.round(api.sessionTimeoutMs / 60000);

    return (
        <div className="p-3 pb-90 space-y-3 overflow-y-auto max-h-screen">
            {/* ── Section 1: Agent API Settings ── */}
            <Card className="bg-muted/5 border-border/20">
                <CardHeader className="p-3 pb-0 cursor-pointer" onClick={() => setApiOpen(!apiOpen)}>
                    <div className="flex items-center justify-between">
                        <CardTitle className="text-xs flex items-center gap-1.5">
                            <Settings2 className="h-3.5 w-3.5" /> Agent API
                        </CardTitle>
                        {apiOpen ? <ChevronUp className="h-3 w-3 text-muted-foreground/40" /> : <ChevronDown className="h-3 w-3 text-muted-foreground/40" />}
                    </div>
                </CardHeader>
                {apiOpen && (
                    <CardContent className="p-3 pt-2 space-y-3">
                        <div className="flex items-center justify-between">
                            <Label className="text-[10px] text-muted-foreground/70">Enable Agent API</Label>
                            <Switch checked={api.enabled} onCheckedChange={v => setApi(a => ({ ...a, enabled: v }))} className="scale-75" />
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                            <div className="space-y-1">
                                <Label className="text-[10px] text-muted-foreground/70">Max Sessions</Label>
                                <Input type="number" value={api.maxConcurrentSessions} min={1} max={20}
                                    onChange={e => setApi(a => ({ ...a, maxConcurrentSessions: parseInt(e.target.value) || 1 }))}
                                    className="font-mono text-[11px] h-8" />
                            </div>
                            <div className="space-y-1">
                                <Label className="text-[10px] text-muted-foreground/70">Timeout (min)</Label>
                                <Input type="number" value={timeoutMinutes} min={1} max={1440}
                                    onChange={e => setApi(a => ({ ...a, sessionTimeoutMs: (parseInt(e.target.value) || 1) * 60000 }))}
                                    className="font-mono text-[11px] h-8" />
                            </div>
                            <div className="space-y-1">
                                <Label className="text-[10px] text-muted-foreground/70">Step Limit</Label>
                                <Input type="number" value={api.defaultStepSoftLimit} min={10} max={10000}
                                    onChange={e => setApi(a => ({ ...a, defaultStepSoftLimit: parseInt(e.target.value) || 10 }))}
                                    className="font-mono text-[11px] h-8" />
                            </div>
                        </div>

                        <div className="flex items-center justify-end gap-2">
                            {apiMsg && (
                                <span className={cn('text-[10px] font-medium', apiMsg === 'saved' ? 'text-emerald-400' : 'text-red-400')}>
                                    {apiMsg === 'saved' ? <><Check className="h-3 w-3 inline mr-0.5" />Saved</> : 'Error'}
                                </span>
                            )}
                            <Button size="sm" variant="outline" onClick={handleSaveApi}
                                disabled={apiSaving || !hasApiChanges} className="h-7 text-[10px] gap-1 px-2.5">
                                <Save className="w-3 h-3" /> {apiSaving ? 'Saving…' : 'Save'}
                            </Button>
                        </div>
                    </CardContent>
                )}
            </Card>

            {/* ── Section 2: Discord Bridge ── */}
            <Card className="bg-muted/5 border-border/20">
                <CardHeader className="p-3 pb-0 cursor-pointer" onClick={() => setBridgeOpen(!bridgeOpen)}>
                    <div className="flex items-center justify-between">
                        <CardTitle className="text-xs flex items-center gap-1.5">
                            <Bot className="h-3.5 w-3.5" /> Discord Bridge
                            <span className={cn('w-1.5 h-1.5 rounded-full ml-1', discActive ? 'bg-emerald-400' : 'bg-muted-foreground/20')} />
                        </CardTitle>
                        <div className="flex items-center gap-1.5">
                            <span className={cn('text-[9px]', discActive ? 'text-emerald-400' : 'text-muted-foreground/40')}>
                                {discActive ? 'Active' : 'Idle'}
                            </span>
                            {bridgeOpen ? <ChevronUp className="h-3 w-3 text-muted-foreground/40" /> : <ChevronDown className="h-3 w-3 text-muted-foreground/40" />}
                        </div>
                    </div>
                </CardHeader>
                {bridgeOpen && (
                    <CardContent className="p-3 pt-2 space-y-3">
                        <div className="space-y-1">
                            <Label className="text-[10px] text-muted-foreground/70">Discord Bot Token</Label>
                            <div className="relative">
                                <Input type={showToken ? 'text' : 'password'} value={bridge.discordBotToken}
                                    onChange={e => setBridge(b => ({ ...b, discordBotToken: e.target.value }))}
                                    placeholder="MTQ3OTUw..." className="font-mono text-[11px] h-8 pr-8" />
                                <button type="button" onClick={() => setShowToken(!showToken)}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground/40 hover:text-foreground/60 transition-colors">
                                    {showToken ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                                </button>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <div className="space-y-1">
                                <Label className="text-[10px] text-muted-foreground/70">Channel ID</Label>
                                <Input value={bridge.discordChannelId}
                                    onChange={e => setBridge(b => ({ ...b, discordChannelId: e.target.value }))}
                                    placeholder="1479..." className="font-mono text-[11px] h-8" />
                            </div>
                            <div className="space-y-1">
                                <Label className="text-[10px] text-muted-foreground/70">Guild ID</Label>
                                <Input value={bridge.discordGuildId}
                                    onChange={e => setBridge(b => ({ ...b, discordGuildId: e.target.value }))}
                                    placeholder="1479..." className="font-mono text-[11px] h-8" />
                            </div>
                        </div>

                        <div className="flex items-center justify-between pt-1">
                            <div className="flex items-center gap-2">
                                <Switch checked={bridge.discordAutoStart} onCheckedChange={v => setBridge(b => ({ ...b, discordAutoStart: v }))} className="scale-75 origin-left" />
                                <span className="text-[10px] text-muted-foreground/60">Auto-start</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                {discordMsg && (
                                    <span className={cn('text-[10px] font-medium', 
                                        discordMsg === 'saved' || discordMsg === 'test_ok' ? 'text-emerald-400' : 'text-red-400')}>
                                        {discordMsg === 'saved' ? 'Saved' : discordMsg === 'test_ok' ? 'Test OK' : 'Error'}
                                    </span>
                                )}
                                <Button size="sm" variant="ghost" onClick={handleTestDiscord}
                                    disabled={discordLoading || !bridge.discordBotToken || !bridge.discordChannelId} className="h-7 text-[10px] gap-1 px-2.5 text-muted-foreground hover:text-foreground">
                                    <Sparkles className="w-3 h-3" /> Test
                                </Button>
                                <Button size="sm" variant="outline" onClick={handleSaveDiscord}
                                    disabled={discordSaving || !hasDiscordChanges} className="h-7 text-[10px] gap-1 px-2">
                                    <Save className="w-3 h-3" /> Save
                                </Button>
                                {!discActive ? (
                                    <Button size="sm" onClick={handleStartDiscord}
                                        disabled={discordLoading || !bridge.discordBotToken || !bridge.discordChannelId} className="h-7 text-[10px] gap-1 px-2">
                                        <Play className="w-3 h-3" /> Start
                                    </Button>
                                ) : (
                                    <Button size="sm" variant="destructive" onClick={handleStopDiscord}
                                        disabled={discordLoading} className="h-7 text-[10px] gap-1 px-2">
                                        <Square className="w-3 h-3" /> Stop
                                    </Button>
                                )}
                            </div>
                        </div>
                    </CardContent>
                )}
            </Card>

            {/* ── Section 3: Telegram Bridge ── */}
            <Card className="bg-muted/5 border-border/20">
                <CardHeader className="p-3 pb-0 cursor-pointer" onClick={() => setTgOpen(!tgOpen)}>
                    <div className="flex items-center justify-between">
                        <CardTitle className="text-xs flex items-center gap-1.5">
                            <Send className="h-3.5 w-3.5" /> Telegram Bridge
                            <span className={cn('w-1.5 h-1.5 rounded-full ml-1', tgActive ? 'bg-emerald-400' : 'bg-muted-foreground/20')} />
                        </CardTitle>
                        <div className="flex items-center gap-1.5">
                            <span className={cn('text-[9px]', tgActive ? 'text-emerald-400' : 'text-muted-foreground/40')}>
                                {tgActive ? 'Active' : 'Idle'}
                            </span>
                            {tgOpen ? <ChevronUp className="h-3 w-3 text-muted-foreground/40" /> : <ChevronDown className="h-3 w-3 text-muted-foreground/40" />}
                        </div>
                    </div>
                </CardHeader>
                {tgOpen && (
                    <CardContent className="p-3 pt-2 space-y-3">
                        <div className="space-y-1">
                            <Label className="text-[10px] text-muted-foreground/70">Telegram Bot Token</Label>
                            <div className="relative">
                                <Input type={showTgToken ? 'text' : 'password'} value={bridge.telegramBotToken}
                                    onChange={e => setBridge(b => ({ ...b, telegramBotToken: e.target.value }))}
                                    placeholder="714850..." className="font-mono text-[11px] h-8 pr-8" />
                                <button type="button" onClick={() => setShowTgToken(!showTgToken)}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground/40 hover:text-foreground/60 transition-colors">
                                    {showTgToken ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                                </button>
                            </div>
                        </div>
                        <div className="space-y-1">
                            <Label className="text-[10px] text-muted-foreground/70">Chat ID</Label>
                            <Input value={bridge.telegramChatId}
                                onChange={e => setBridge(b => ({ ...b, telegramChatId: e.target.value }))}
                                placeholder="123456789" className="font-mono text-[11px] h-8" />
                        </div>

                        <div className="flex items-center justify-between pt-1">
                            <div className="flex items-center gap-2">
                                <Switch checked={bridge.telegramAutoStart} onCheckedChange={v => setBridge(b => ({ ...b, telegramAutoStart: v }))} className="scale-75 origin-left" />
                                <span className="text-[10px] text-muted-foreground/60">Auto-start</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                {telegramMsg && (
                                <span className={cn('text-[10px] font-medium', 
                                    telegramMsg === 'saved' || telegramMsg === 'test_ok' ? 'text-emerald-400' : 'text-red-400')}>
                                    {telegramMsg === 'saved' ? 'Saved' : telegramMsg === 'test_ok' ? 'Test OK' : 'Error'}
                                </span>
                            )}
                            <Button size="sm" variant="ghost" onClick={handleTestTelegram}
                                disabled={telegramLoading || !bridge.telegramBotToken || !bridge.telegramChatId} className="h-7 text-[10px] gap-1 px-2.5 text-muted-foreground hover:text-foreground">
                                <Sparkles className="w-3 h-3" /> Test
                            </Button>
                            <Button size="sm" variant="outline" onClick={handleSaveTelegram}
                                disabled={telegramSaving || !hasTelegramChanges} className="h-7 text-[10px] gap-1 px-2">
                                <Save className="w-3 h-3" /> Save
                            </Button>
                            {!tgActive ? (
                                <Button size="sm" onClick={handleStartTelegram}
                                    disabled={telegramLoading || !bridge.telegramBotToken || !bridge.telegramChatId} className="h-7 text-[10px] gap-1 px-2">
                                    <Play className="w-3 h-3" /> Start
                                </Button>
                            ) : (
                                <Button size="sm" variant="destructive" onClick={handleStopTelegram}
                                    disabled={telegramLoading} className="h-7 text-[10px] gap-1 px-2">
                                    <Square className="w-3 h-3" /> Stop
                                </Button>
                            )}
                        </div>
                    </div>
                </CardContent>
            )}
        </Card>
        </div>
    );
}
