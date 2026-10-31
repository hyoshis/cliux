(function (root) {
  'use strict';

  const foundry = {
    id: 'microsoft-foundry',
    purpose: 'Foundry agent development, evaluation, and troubleshooting',
  };
  const deploy = { id: 'azure-deploy', purpose: 'Azure deployment workflow guidance' };
  const diagnostics = { id: 'azure-diagnostics', purpose: 'Azure troubleshooting workflow guidance' };

  const scenarios = [
    {
      id: 'foundry', number: '01', group: 'Tool setup', title: 'Install the Foundry extension',
      command: 'azd extension install azure.ai.agents',
      intent: 'I am adding Foundry capabilities to azd.',
      trigger: 'The extension has installed successfully. Offer its companion guidance once.',
      why: 'A related extension is a good relevance signal, but not consent to change an assistant.',
      project: false, skills: [foundry],
      before: ['azure.ai.agents and required extension dependencies installed (simulated).',
        'The extension is usable. Companion guidance is optional.'],
      continuation: 'Your Foundry extension remains usable. No assistant session starts automatically.',
      question: 'Add Foundry guidance to your coding assistant?',
    },
    {
      id: 'setup', number: '02', group: 'Tool setup', title: 'Set up an assistant for Azure',
      command: 'azd tool configure',
      proposedCommand: true,
      intent: 'I want to equip my coding assistant for Azure development.',
      trigger: 'The user explicitly opens assistant setup. A broader, reviewable package belongs here.',
      why: 'Borrow the intentional entry point of AWS, not a global install into every detected agent.',
      project: false, skills: [deploy, diagnostics],
      before: ['Explicit Azure assistant setup (proposed entry point; command naming is not final).',
        'Detected: GitHub Copilot CLI and Claude Code. Choose one target.'],
      continuation: 'Your assistant setup is saved in this simulation. Start a session when you are ready.',
      question: 'Choose the Azure capabilities to add.',
    },
    {
      id: 'project', number: '03', group: 'Project setup', title: 'Start a Foundry agent project',
      command: 'azd ai agent init',
      intent: 'I want to create a Foundry agent project.',
      trigger: 'After the project location is known, check for usable Foundry guidance.',
      why: 'An extension installed last month does not mean this assistant has the skill today.',
      project: true, skills: [foundry],
      before: ['Foundry extension requirement resolved separately (simulated).',
        'Project location: C:\\work\\agent-app',
        'Checking guidance visible to the selected assistant...'],
      continuation: 'Continue project initialization. The optional skill does not gate the CLI workflow.',
      question: 'Add Foundry guidance for this project?',
    },
    {
      id: 'clone', number: '04', group: 'Project setup', title: 'Join an existing project',
      command: 'azd up',
      intent: 'I cloned a team project and want to work on it.',
      trigger: 'After trusting the workspace, review declared recommendations; install only what is missing.',
      why: 'Project recommendations are data, not permission to download or execute code.',
      project: true, skills: [deploy, diagnostics],
      before: ['Trusted workspace: C:\\work\\team-app (simulated trust decision).',
        'The project recommends Azure deployment and troubleshooting guidance.',
        'No skills are downloaded merely because the repository was cloned.'],
      continuation: 'Continue azd up. Skill installation does not approve provisioning or deployment.',
      question: 'Add the missing guidance recommended by this project?',
    },
    {
      id: 'assisted', number: '05', group: 'AI assistance', title: 'Choose AI-assisted app setup',
      command: 'azd init',
      intent: 'I selected AI-assisted application setup.',
      trigger: 'After selecting AI assistance, before launching the assistant.',
      why: 'The meaningful signal is the assistance choice, not azd init by itself.',
      project: true, skills: [deploy, diagnostics],
      before: ['Selected: Set up with GitHub Copilot (Preview).',
        'Assistant runtime and sign-in are separate from this skill decision.',
        'Prepare relevant guidance before the assistant session starts.'],
      continuation: 'Continue the AI-assisted setup handoff. No cloud actions have been authorized.',
      question: 'Prepare Azure guidance for the assisted setup?',
    },
    {
      id: 'troubleshoot', number: '06', group: 'AI assistance', title: 'Ask for help after a failure',
      command: 'azd deploy',
      intent: 'My deployment failed. I explicitly want AI help.',
      trigger: 'Only after the user asks for AI help; never on the error alone.',
      why: 'A failure is a moment of urgency, not an opportunity to promote a toolkit.',
      project: true, skills: [diagnostics],
      before: ['Deployment failed: the container did not pass its startup probe (simulated).',
        'Original error and logs remain visible. No skill installation has been triggered.'],
      continuation: 'Continue the troubleshooting handoff. The deployment has not been retried or repaired.',
      question: 'Add Azure troubleshooting guidance before starting AI help?',
      entry: 'help',
    },
    {
      id: 'plain', number: '07', group: 'Guardrail', title: 'Initialize without AI assistance',
      command: 'azd init',
      intent: 'I only want to initialize my application.',
      trigger: 'No skill installation trigger.',
      why: 'Do not turn every Azure-related command into an assistant onboarding funnel.',
      project: true, skills: [],
      before: ['Selected: Initialize from a template without AI assistance.',
        'Project initialized (simulated).'],
      continuation: 'No assistant changes. Continue your normal azd workflow.',
    },
  ];

  const states = [
    { id: 'missing', label: 'Skills missing', description: 'First-time, relevant recommendation.' },
    { id: 'installed', label: 'Already usable', description: 'Reuse guidance visible to this assistant.' },
    { id: 'bundled', label: 'Included in the project', description: 'Recognized project-local skills count as installed.' },
    { id: 'declined', label: 'Previously declined', description: 'Same project, assistant, purpose, and capability set.' },
    { id: 'changed', label: 'New task after a decline', description: 'A materially different purpose; explain why this is a new recommendation.' },
    { id: 'outdated', label: 'Update available', description: 'Existing guidance is still usable; an update is optional.' },
    { id: 'conflict', label: 'Custom skill conflict', description: 'Preserve user-authored files; do not overwrite.' },
    { id: 'no-assistant', label: 'No supported assistant', description: 'A separate prerequisite, not another automatic install.' },
    { id: 'blocked', label: 'Blocked by organization policy', description: 'No policy bypass or alternate unapproved download.' },
    { id: 'offline', label: 'Offline / source unreachable', description: 'Keep the original workflow available.' },
    { id: 'ci', label: 'Non-interactive / CI', description: 'Return a plan, not an interactive prompt or an implicit install.' },
  ];

  function getScenario(id) {
    const scenario = scenarios.find((item) => item.id === id);
    if (!scenario) throw new Error(`Unknown scenario: ${id}`);
    return scenario;
  }

  function decide(scenarioId, stateId) {
    const scenario = getScenario(scenarioId);
    if (!states.some((state) => state.id === stateId)) throw new Error(`Unknown state: ${stateId}`);
    if (!scenario.skills.length) return { action: 'none', reason: 'No AI-assistance intent. No skill prompt.' };
    if (stateId === 'ci') return { action: 'plan', reason: 'Optional guidance cannot block a non-interactive CLI command.' };
    if (stateId === 'declined' && scenario.id === 'setup') {
      return { action: 'prompt', reason: 'You explicitly requested assistant setup. Review the plan before installing.' };
    }
    if (stateId === 'bundled' && !scenario.project) {
      return { action: 'reuse', reason: 'Usable guidance found in the selected assistant; no duplicate download.' };
    }
    const decisions = {
      installed: ['reuse', 'Already usable by this assistant. No duplicate download or prompt.'],
      bundled: ['reuse', 'Recognized project-local guidance is already usable. Nothing to install.'],
      declined: ['suppress', 'You declined this same recommendation. Do not ask again.'],
      conflict: ['conflict', 'A custom skill occupies the target. Preserve it; replacement needs a separate review.'],
      'no-assistant': ['prerequisite', 'No supported assistant detected. Do not install an assistant as a side effect.'],
      blocked: ['blocked', 'Organization policy blocks this source. Stop acquisition; do not try a bypass.'],
      offline: ['offline', 'The approved source is unreachable. Leave existing files unchanged.'],
      outdated: ['update', 'A compatible update is available. Current guidance remains usable.'],
      changed: ['prompt', 'New purpose: this recommendation differs from the one you declined.'],
      missing: ['prompt', 'Relevant guidance is missing. Review the plan before changing anything.'],
    };
    const [action, reason] = decisions[stateId];
    return { action, reason };
  }

  function buildPlan(scenarioId, assistant, scope, packageKind) {
    const scenario = getScenario(scenarioId);
    if (!['copilot', 'claude'].includes(assistant)) throw new Error('Choose a supported assistant.');
    if (!['project', 'user'].includes(scope)) throw new Error('Choose an installation scope.');
    if (!scenario.project && scope === 'project') throw new Error('This scenario has no project; choose user scope.');
    if (!['skills', 'plugin'].includes(packageKind)) throw new Error('Choose a supported package.');
    const host = assistant === 'copilot' ? 'GitHub Copilot CLI' : 'Claude Code';
    const directory = assistant === 'copilot' ? '.github\\skills' : '.claude\\skills';
    const globalDirectory = assistant === 'copilot' ? '%USERPROFILE%\\.copilot\\skills' : '%USERPROFILE%\\.claude\\skills';
    const plugin = packageKind === 'plugin';
    return {
      assistant, host, scope, packageKind,
      projectKey: scenario.project ? (scenario.id === 'project' ? 'agent-app' : 'team-app') : null,
      items: plugin ? ['Core Azure Skills plugin (full package)', 'Azure MCP Server configuration', 'Foundry MCP Server configuration']
        : scenario.skills.map((skill) => skill.id),
      skills: scenario.skills.map((skill) => skill.id),
      location: plugin
        ? `${host} native plugin manager; ${scope === 'project' ? 'repository scope (proposed azd adapter)' : 'user scope'}`
        : scope === 'project' ? `C:\\work\\${scenario.id === 'project' ? 'agent-app' : 'team-app'}\\${directory}` : globalDirectory,
      scopeLabel: scope === 'project' ? 'This project only' : 'Across your projects, for this assistant only',
      source: 'https://github.com/microsoft/azure-skills',
      permission: 'No Azure permissions granted. Authentication and action approval remain separate.',
      readiness: 'Host activation is checked after installation; a reload may be required.',
    };
  }

  function resolveInstallation(installations, scenarioId, assistant) {
    const scenario = getScenario(scenarioId);
    if (!scenario.skills.length) return undefined;
    const projectKey = scenario.project ? (scenario.id === 'project' ? 'agent-app' : 'team-app') : null;
    return installations.find((installation) => {
      const { plan } = installation;
      const visible = plan.assistant === assistant &&
        (plan.scope === 'user' || (projectKey !== null && plan.projectKey === projectKey));
      const capabilities = plan.packageKind === 'plugin'
        ? ['microsoft-foundry', 'azure-deploy', 'azure-diagnostics'] : plan.skills;
      return visible && scenario.skills.every((skill) => capabilities.includes(skill.id));
    });
  }

  const api = { scenarios, states, getScenario, decide, buildPlan, resolveInstallation };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.SkillLab = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
