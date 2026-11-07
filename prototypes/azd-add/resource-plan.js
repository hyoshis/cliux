(() => {
  'use strict';

  const field = (key, label, defaultValue, rule = 'required') => ({ key, label, defaultValue, rule });
  const name = (value) => field('name', 'Name', value, 'name');
  const catalog = [
    { id: 'ai.openai', group: 'AI', label: 'Azure OpenAI model', fields: [name('chat-model'), field('model', 'Model', 'gpt-4.1')] },
    { id: 'ai.services-model', group: 'AI', label: 'Azure AI services model', fields: [name('ai-model'), field('model', 'Model', 'sample-model')] },
    { id: 'ai.search', group: 'AI', label: 'Azure AI Search', fields: [name('search')] },
    { id: 'database.cosmos', group: 'Database', label: 'Azure Cosmos DB', fields: [name('cosmos'), field('database', 'Database name', 'app-data')] },
    { id: 'database.sql', group: 'Database', label: 'Azure SQL Database', fields: [name('sql'), field('database', 'Database name', 'app-data')] },
    { id: 'database.postgresql', group: 'Database', label: 'Azure Database for PostgreSQL', fields: [name('postgres'), field('database', 'Database name', 'app-data')] },
    { id: 'host.container-apps', group: 'Host service', label: 'Azure Container Apps', fields: [name('container-app'), field('source', 'Existing source path', '.')] },
    { id: 'host.app-service', group: 'Host service', label: 'Azure App Service', fields: [name('web-app'), field('source', 'Existing source path', '.')] },
    { id: 'host.functions', group: 'Host service', label: 'Azure Functions', fields: [name('functions'), field('source', 'Existing source path', '.')] },
    { id: 'keyvault.secret', group: 'Key Vault', label: 'Secret', fields: [name('app-secret')] },
    { id: 'keyvault.key', group: 'Key Vault', label: 'Key', fields: [name('app-key')] },
    { id: 'keyvault.certificate', group: 'Key Vault', label: 'Certificate', fields: [name('app-certificate')] },
    { id: 'messaging.queue', group: 'Messaging', label: 'Azure Service Bus queue', fields: [name('orders')] },
    { id: 'messaging.topic', group: 'Messaging', label: 'Azure Service Bus topic', fields: [name('order-events')] },
    { id: 'messaging.event-hubs', group: 'Messaging', label: 'Azure Event Hubs', fields: [name('event-stream')] },
    { id: 'storage.blobs', group: 'Storage account', label: 'Blobs', fields: [field('container', 'Container name', 'container1', 'container')] }
  ];
  const existingHost = { id: 'existing.web', type: 'Azure Container Apps', name: 'web' };

  function resource(id) {
    const item = catalog.find((entry) => entry.id === id);
    if (!item) throw new RangeError(`Unknown resource: ${id}`);
    return item;
  }

  function createDraft() {
    return { selected: new Set(), parameters: {}, origins: {}, reasons: {}, goal: '', reuseHost: false, entry: 'manual', approved: false };
  }

  function ensureParameters(draft, item) {
    if (!Object.hasOwn(draft.parameters, item.id)) {
      draft.parameters[item.id] = Object.fromEntries(item.fields.map((spec) => [spec.key, spec.defaultValue]));
    }
  }

  function toggleResource(draft, id) {
    const item = resource(id);
    draft.approved = false;
    if (draft.selected.has(id)) {
      draft.selected.delete(id);
      return false;
    }
    ensureParameters(draft, item);
    draft.selected.add(id);
    draft.origins[id] = 'manual';
    draft.reasons[id] = 'Selected by you.';
    return true;
  }

  function updateField(draft, id, key, value) {
    const item = resource(id);
    if (!item.fields.some((spec) => spec.key === key)) throw new RangeError(`Unknown field: ${id}.${key}`);
    if (typeof value !== 'string') throw new TypeError('Field values must be strings.');
    ensureParameters(draft, item);
    draft.parameters[id][key] = value;
    draft.approved = false;
  }

  function validateField(spec, value) {
    if (!value.trim()) return `${spec.label} is required.`;
    if (spec.rule === 'container' &&
        (!/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(value) || value.includes('--'))) {
      return 'Use 3-63 lowercase letters or numbers, with single hyphens between letters or numbers.';
    }
    if (spec.rule === 'name' &&
        (!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(value) || value.includes('--'))) {
      return 'For this demo, use 1-63 lowercase letters or numbers, with single hyphens between them.';
    }
    return '';
  }

  function suggestResources(draft, goal) {
    const text = goal.trim().toLowerCase();
    const suggestions = new Map();
    const add = (id, reason) => suggestions.set(id, reason);
    if (/\b(chat|chatbot|llm|openai)\b|\bai model\b/.test(text)) {
      add('ai.openai', 'An OpenAI model handles the chat or language-model capability.');
    }
    if (/\buploads?\b|\bblob storage\b|\bstore files\b/.test(text)) {
      add('storage.blobs', 'Blob storage holds the uploaded files.');
    }
    if (/\bsearch\b/.test(text)) {
      add('ai.search', 'AI Search provides retrieval and indexing for your search feature.');
    }
    if (/\b(postgres|postgresql)\b/.test(text)) {
      add('database.postgresql', 'You explicitly requested PostgreSQL.');
    }
    if (/\bsql\b/.test(text)) {
      add('database.sql', 'You explicitly requested a SQL database.');
    }
    if (/\bcosmos\b|\bdocument database\b/.test(text)) {
      add('database.cosmos', 'Cosmos DB stores the document data you described.');
    } else if (/\bdatabase\b/.test(text) &&
               !suggestions.has('database.sql') && !suggestions.has('database.postgresql')) {
      add('database.cosmos', 'Demo assumption: document storage. Switch to SQL or PostgreSQL if your data is relational.');
    }
    if (/\bqueues?\b|\bmessage processing\b/.test(text)) {
      add('messaging.queue', 'A Service Bus queue buffers work for asynchronous processing.');
    }
    if (/\btopics?\b|\bpubsub\b/.test(text)) {
      add('messaging.topic', 'A Service Bus topic distributes messages to multiple subscribers.');
    }
    if (/\bevent hubs?\b|\bevent streaming\b/.test(text)) {
      add('messaging.event-hubs', 'Event Hubs handles the event stream you described.');
    }
    if (!suggestions.size) {
      return {
        ok: false,
        message: 'This keyword-based simulation supports chat, uploads, search, databases, and queues or event streaming. Try an example or select resources manually. Your draft is unchanged.'
      };
    }
    let added = 0;
    for (const [id, reason] of suggestions) {
      const item = resource(id);
      ensureParameters(draft, item);
      if (!draft.selected.has(id)) {
        draft.selected.add(id);
        draft.origins[id] = 'suggested';
        draft.reasons[id] = reason;
        added += 1;
      } else if (draft.origins[id] === 'suggested') {
        draft.reasons[id] = reason;
      }
    }
    draft.goal = goal.trim();
    draft.reuseHost = /\b(app|api|web|orders?|chat|chatbot)\b/.test(text);
    draft.entry = 'goal';
    draft.approved = false;
    return { ok: true, added, suggested: suggestions.size, reuseHost: draft.reuseHost };
  }

  function buildPlan(draft) {
    const unresolvedFields = [];
    const resources = catalog.filter((item) => draft.selected.has(item.id)).map((item) => {
      ensureParameters(draft, item);
      for (const spec of item.fields) {
        const message = validateField(spec, draft.parameters[item.id][spec.key]);
        if (message) unresolvedFields.push({ resourceId: item.id, field: spec.key, message });
      }
      return {
        id: item.id,
        group: item.group,
        type: item.label,
        parameters: { ...draft.parameters[item.id] },
        origin: draft.origins[item.id],
        reason: draft.reasons[item.id]
      };
    });
    if (!resources.length) unresolvedFields.push({ resourceId: null, field: 'resources', message: 'Select at least one resource.' });
    const status = unresolvedFields.length ? 'needs-input' : 'ready';
    return {
      schema: 'azd-add-prototype/v1',
      simulation: true,
      project: { name: 'my-azd-project', existingResources: [{ ...existingHost }] },
      goal: draft.goal || null,
      status,
      resources,
      reusedResources: draft.reuseHost ? [{ ...existingHost }] : [],
      unresolvedFields,
      approvalRequired: true,
      approved: draft.approved && status === 'ready',
      proposedEffects: { files: ['azure.yaml'], provisioning: false },
      execution: { performed: false, mode: 'browser-simulation' }
    };
  }

  function acceptPlan(draft) {
    const plan = buildPlan(draft);
    if (plan.status !== 'ready') return { ok: false, errors: plan.unresolvedFields };
    draft.approved = true;
    return { ok: true, plan: buildPlan(draft) };
  }

  globalThis.AzdAddPlan = Object.freeze({
    catalog: Object.freeze(catalog), createDraft, toggleResource, updateField, suggestResources, buildPlan, acceptPlan, validateField
  });
})();
