const fs = require('fs');
const path = require('path');

/**
 * Returns the Vercel CLI steps for deployment.
 */
function getVercelDeploySteps(token) {
    const tokenArg = token ? `--token=${token}` : '';
    return [
        { name: 'Pull (Production)', cmd: `vercel pull --yes --environment=production ${tokenArg}` },
        { name: 'Build (Production)', cmd: `vercel build --prod ${tokenArg}` },
        { name: 'Deploy (Production)', cmd: `vercel deploy --prebuilt --prod ${tokenArg}` }
    ];
}

/**
 * Fetches domain information for a Vercel project using the API.
 */
async function fetchVercelDomainInfo(workspacePath, vercelToken, logger, replyFn) {
    const projectConfigPath = path.join(workspacePath, '.vercel', 'project.json');
    if (!fs.existsSync(projectConfigPath)) return;

    try {
        const projectConfig = JSON.parse(fs.readFileSync(projectConfigPath, 'utf8'));
        const projectId = projectConfig.projectId;

        if (!projectId || !vercelToken) return;

        await replyFn(`⏳ **Vercel**: Fetching domain info for project \`${projectId}\`...`);
        const response = await fetch(`https://api.vercel.com/v9/projects/${projectId}/domains`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${vercelToken}`,
                'Content-Type': 'application/json',
            },
        });

        const data = await response.json();
        if (data.domains && data.domains.length > 0) {
            const firstDomain = data.domains[0];
            const name = firstDomain.name;
            await replyFn(`🌐 **Domain**: ${name} (extracted from Vercel API)`);
        } else {
            await replyFn(`⚠️ **Vercel**: No domains found for this project.`);
        }
    } catch (err) {
        if (logger) logger('error', `Failed to fetch domain info: ${err.message}`);
        await replyFn(`⚠️ **Vercel**: Could not fetch domain info: ${err.message}`);
    }
}

module.exports = {
    getVercelDeploySteps,
    fetchVercelDomainInfo
};
