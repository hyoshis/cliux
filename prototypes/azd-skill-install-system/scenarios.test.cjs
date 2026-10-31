'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { scenarios, states, decide, buildPlan, resolveInstallation } = require('./scenarios.js');

test('ordinary initialization never acquires skills, regardless of environment state', () => {
  for (const state of states) assert.equal(decide('plain', state.id).action, 'none');
});

test('usable and recognized project-bundled skills are reused without a prompt', () => {
  for (const scenario of scenarios.filter((item) => item.skills.length)) {
    assert.equal(decide(scenario.id, 'installed').action, 'reuse');
    assert.equal(decide(scenario.id, 'bundled').action, 'reuse');
  }
});

test('a same-context decline suppresses, while a changed task can explain a fresh offer', () => {
  assert.equal(decide('troubleshoot', 'declined').action, 'suppress');
  assert.equal(decide('troubleshoot', 'changed').action, 'prompt');
  assert.match(decide('troubleshoot', 'changed').reason, /differs/);
});

test('explicit assistant setup can reopen a decline but cannot override policy or automation gates', () => {
  assert.equal(decide('setup', 'declined').action, 'prompt');
  assert.equal(decide('setup', 'blocked').action, 'blocked');
  assert.equal(decide('setup', 'ci').action, 'plan');
});

test('automation, policy, unavailable source and custom conflicts never become install prompts', () => {
  for (const [state, expected] of [['ci', 'plan'], ['blocked', 'blocked'], ['offline', 'offline'],
    ['conflict', 'conflict'], ['no-assistant', 'prerequisite']]) {
    assert.equal(decide('assisted', state).action, expected);
  }
});

test('a targeted skill plan changes only the chosen assistant and scope', () => {
  const plan = buildPlan('project', 'claude', 'project', 'skills');
  assert.deepEqual(plan.items, ['microsoft-foundry']);
  assert.match(plan.location, /C:\\work\\agent-app\\\.claude\\skills$/);
  assert.equal(plan.host, 'Claude Code');
  assert.match(plan.permission, /No Azure permissions/);
  assert.throws(() => buildPlan('setup', 'copilot', 'project', 'skills'), /no project/);
});

test('the plugin path discloses the full package and both MCP configurations, not a fictional subset', () => {
  const plan = buildPlan('assisted', 'copilot', 'project', 'plugin');
  assert.equal(plan.items.length, 3);
  assert.match(plan.items[0], /full package/);
  assert.match(plan.items[2], /Foundry MCP/);
  assert.match(plan.location, /proposed azd adapter/);
});

test('installation discovery reuses global guidance but isolates hosts and local projects', () => {
  const local = { plan: buildPlan('project', 'copilot', 'project', 'skills'), loaded: false };
  assert.equal(resolveInstallation([local], 'project', 'copilot'), local);
  assert.equal(resolveInstallation([local], 'project', 'claude'), undefined);
  assert.equal(resolveInstallation([local], 'foundry', 'copilot'), undefined);
  assert.equal(resolveInstallation([local], 'clone', 'copilot'), undefined);
  const global = { plan: buildPlan('foundry', 'copilot', 'user', 'skills'), loaded: true };
  assert.equal(resolveInstallation([global], 'project', 'copilot'), global);
  assert.equal(resolveInstallation([global], 'clone', 'copilot'), undefined);
  const plugin = { plan: buildPlan('setup', 'copilot', 'user', 'plugin'), loaded: true };
  assert.equal(resolveInstallation([plugin], 'clone', 'copilot'), plugin);
  assert.equal(resolveInstallation([plugin], 'project', 'copilot'), plugin);
  assert.equal(resolveInstallation([plugin], 'plain', 'copilot'), undefined);
});

test('all supported states resolve for every scenario; invalid inputs surface explicitly', () => {
  for (const scenario of scenarios) {
    for (const state of states) assert.ok(decide(scenario.id, state.id).reason);
  }
  assert.throws(() => decide('unknown', 'missing'), /Unknown scenario/);
  assert.throws(() => decide('foundry', 'unknown'), /Unknown state/);
  assert.throws(() => buildPlan('project', 'all', 'project', 'skills'), /supported assistant/);
  assert.throws(() => buildPlan('project', 'copilot', 'anywhere', 'skills'), /installation scope/);
});
