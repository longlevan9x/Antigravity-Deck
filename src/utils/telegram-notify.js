const fs = require('fs');
const path = require('path');
const https = require('https');

/**
 * Sends a Telegram notification with a QR code and login details.
 * @param {string} qrUrl The URL to be encoded in the QR code and linked in the message.
 * @param {string} authKey The authentication key for the dashboard.
 * @param {function} log Logging function (tag, msg).
 */
function sendTelegramNotification(qrUrl, authKey, log = console.log) {
    try {
        const bridgeSettingsFile = path.join(__dirname, '..', '..', 'bridge.settings.json');
        if (fs.existsSync(bridgeSettingsFile)) {
            const bs = JSON.parse(fs.readFileSync(bridgeSettingsFile, 'utf8') || '{}');
            const tgToken = bs.telegramBotToken;
            const tgChatId = bs.telegramChatId;

            if (tgToken && tgChatId) {
                log('*', 'Sending tunnel URL & QR to Telegram...');
                const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(qrUrl)}`;
                const tgMsg = `🚀 *Antigravity Deck is ONLINE!*\n\n🔗 [Open Dashboard](${qrUrl})\n🔑 Key: \`${authKey}\`\n\n_Scan the QR code above to login automatically._\n\nBot is starting...`;

                const body = JSON.stringify({
                    chat_id: tgChatId,
                    photo: qrImageUrl,
                    caption: tgMsg,
                    parse_mode: 'Markdown' 
                });
                
                const req = https.request(`https://api.telegram.org/bot${tgToken}/sendPhoto`, {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json', 
                        'Content-Length': Buffer.byteLength(body) 
                    }
                }, (res) => {
                    let resData = '';
                    res.on('data', d => resData += d);
                    res.on('end', () => {
                        if (res.statusCode === 200) log('*', '✅ Telegram notification sent!');
                        else log('*', `⚠️ Telegram notify failed (status ${res.statusCode}): ${resData}`);
                    });
                });
                
                req.on('error', (e) => log('*', `⚠️ Telegram notify error: ${e.message}`));
                req.write(body);
                req.end();
            }
        }
    } catch (e) {
        log('*', `⚠️ Telegram notify setup error: ${e.message}`);
    }
}

module.exports = { sendTelegramNotification };
