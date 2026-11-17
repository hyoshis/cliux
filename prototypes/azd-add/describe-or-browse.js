(() => {
  'use strict';

  // ---------- Simulated project and catalog ----------
  const PROJECT = 'my-azd-project';
  const SPIN = ['|', '/', '-', '\\'];
  const RULE_SELECT = '─'.repeat(35);
  const RULE_MULTI = '─'.repeat(39);
  const THINK_MS = 1100;
  const WINDOW = 7;

  const SERVICES = [
    { name: 'api', label: 'Container App', path: 'src/api', lines: ['type: host.containerapp', 'port: 8000'], uses: [] },
    { name: 'web', label: 'Container App', path: 'src/web', lines: ['type: host.containerapp', 'port: 80'], uses: ['api'] }
  ];
  const DIRS = { '.': 'python', src: 'python', 'src/api': 'python', 'src/web': 'js', 'src/worker': 'python', 'src/admin': 'js' };
  const RUNTIMES = { python: ['python', '3.13'], js: ['node', '22-lts'] };
  const OPENAI_MODELS = [
    ['gpt-4.1-mini', '2025-04-14', 'Chat (GPT)'],
    ['gpt-4.1', '2025-04-14', 'Chat (GPT)'],
    ['gpt-4o', '2024-11-20', 'Chat (GPT)'],
    ['text-embedding-3-small', '1', 'Embeddings (Document search)'],
    ['text-embedding-3-large', '1', 'Embeddings (Document search)']
  ];
  const FOUNDRY_MODELS = [
    ['Phi-4', '7', 'Microsoft'],
    ['Llama-3.3-70B-Instruct', '9', 'Meta'],
    ['Mistral-Large-2411', '2', 'Mistral AI'],
    ['DeepSeek-R1', '1', 'DeepSeek']
  ];
  const STOP = new Set(('a an the and or but with without to for of in on at by from into onto over my our your their this that ' +
    'these those which who whose can could would should will want wants need needs needed i we you it its is are be been some me us ' +
    'let lets also plus using use uses new build building make making add adding store stores storing stored save saves saving keep ' +
    'keeps data feature features support supports like so then have has get gets give gives thing things them they where when how what ' +
    'do does done just please azure app apps application applications api web').split(' '));

  const DB_HELP = 'Name of the database that the app connects to. This database will be created after running azd provision or azd up.';
  const DESCRIBE_HELP = 'Describe a feature in plain words, like "a chat app that stores uploaded files". azd suggests resources, and you can change them before anything is added.';
  const LIST_HELP = 'Space selects or clears a resource. Type to filter by name or by need, like uploads or cache.';
  const BROWSE_HELP = 'Space selects a resource. Type to filter by name or category. In Browse all, → opens a category and ← closes it.';
  const SEARCH_HELP = 'Type a resource like redis, or describe what your app needs, like "chat with file uploads". Matching resources are selected. Press Down to change the selection.';

  // ---------- Validation and smart defaults ----------
  function labelError(value) {
    if (!value) return 'This field is required';
    if (value.length < 2) return 'name must be 2 characters or more';
    if (value.length > 63) return 'name must be 63 characters or less';
    if (!/^[a-z0-9-]+$/.test(value)) return 'name must contain only lowercase letters, numbers, and hyphens';
    if (!/^[a-z]/.test(value)) return 'name must start with a letter';
    if (value.endsWith('-')) return 'name cannot end with a hyphen';
    if (value.includes('--')) return 'name cannot contain consecutive hyphens';
    return '';
  }
  function containerError(value) {
    if (!value) return 'This field is required';
    if (value.length < 3) return 'name must be 3 characters or more';
    if (value.includes('--')) return 'name cannot contain consecutive hyphens';
    if (value.toLowerCase() !== value) return 'name must be all lower case';
    return labelError(value);
  }
  const nameCheck = (value, ctx) => labelError(value) || (ctx.taken.has(value) ? `resource with name '${value}' already exists` : '');
  const normPath = (value) => value.trim().replace(/^\.\/+/, '').replace(/\/+$/, '') || '.';
  const pathCheck = (value) => (Object.hasOwn(DIRS, normPath(value)) ? '' : `'${value}' is not a valid directory`);
  const baseName = (path) => (path === '.' ? PROJECT : path.split('/').pop());
  const envName = (name) => name.toUpperCase().replace(/-/g, '_');
  const modelInfo = (list, name) => list.find(([model]) => model === name) || list[0];
  const hasWord = (ctx, ...prefixes) => ctx.words.some((word) => prefixes.some((prefix) => word.startsWith(prefix)));

  function unique(base, taken) {
    if (!taken.has(base)) return base;
    let index = 2;
    while (taken.has(`${base}-${index}`)) index += 1;
    return `${base}-${index}`;
  }
  function containerDefault(ctx) {
    for (const tag of ['uploads', 'images', 'documents']) if (ctx.tags.includes(tag)) return tag;
    return 'files';
  }
  function queueDefault(ctx) {
    if (hasWord(ctx, 'order')) return 'orders';
    if (hasWord(ctx, 'email', 'mail')) return 'emails';
    if (hasWord(ctx, 'image', 'photo', 'resize', 'thumbnail')) return 'image-jobs';
    return 'jobs';
  }
  function hubDefault(ctx) {
    if (hasWord(ctx, 'telemetry', 'iot', 'device', 'sensor')) return 'telemetry';
    if (hasWord(ctx, 'click')) return 'clicks';
    return 'events';
  }
  function foundryDefault(ctx) {
    const hit = FOUNDRY_MODELS.find(([name]) => ctx.tags.some((tag) => tag.length > 2 && name.toLowerCase().startsWith(tag)));
    return hit ? hit[0] : 'Phi-4';
  }
  function hostPath(ctx, fallback) {
    const usedPaths = ctx.s.selection.filter((id) => id !== ctx.id && isHost(id)).map((id) => (ctx.s.values[id] || {}).path);
    return [fallback, 'src/worker', 'src/admin'].find((path) => !usedPaths.includes(path)) || fallback;
  }

  const usedBy = { key: 'usedBy', kind: 'services' };
  const dbName = (type) => ({
    key: 'name', kind: 'text', message: `Input the name of the app database (${type})`, help: DB_HELP,
    def: (ctx) => unique('app-db', ctx.taken), check: nameCheck
  });
  const hostFields = (fallback) => [
    { key: 'path', kind: 'text', message: 'Where is your app code project located?', def: (ctx) => hostPath(ctx, fallback), check: pathCheck },
    { key: 'name', kind: 'text', message: 'Enter a name for this service:', def: (ctx, v) => unique(baseName(v.path), ctx.taken), check: nameCheck },
    { key: 'uses', kind: 'uses' }
  ];
  const dbEnv = (prefix) => () => ['DATABASE', 'HOST', 'PASSWORD', 'PORT', 'URL', 'USERNAME'].map((name) => `${prefix}_${name}`);

  // Types and env var names follow azd (pkg/project/resources.go, internal/scaffold/resource_meta.go).
  const catalog = [
    {
      id: 'ai.openai.model', group: 'AI', label: 'Azure OpenAI model', desc: 'Chat, text generation and embeddings',
      aliases: ['azure openai', 'open ai', 'openai', 'gpt'],
      intents: [
        { tag: 'chat', reason: 'Generates the chat replies', words: ['chat', 'chatbot', 'bot', 'assistant', 'copilot', 'conversation', 'conversational'] },
        { tag: 'embeddings', reason: 'Creates embeddings for vector search', words: ['embedding', 'embeddings', 'vector', 'vectors'] },
        { tag: 'rag', reason: 'Answers questions over your data', words: ['rag', 'grounded', 'grounding'] },
        { tag: 'text', reason: 'Generates text with a GPT model', words: ['ai', 'llm', 'llms', 'genai', 'summarize', 'summarise', 'summary', 'summaries', 'generate', 'generative', 'translate', 'translation', 'classify'] }
      ],
      fields: [
        {
          key: 'model', kind: 'select', message: 'Select the model',
          choices: () => OPENAI_MODELS.map(([name, version, kind]) => ({ value: name, label: name, desc: `${version.padEnd(12)}${kind}` })),
          def: (ctx) => (ctx.tags.includes('embeddings') && !ctx.tags.some((tag) => ['chat', 'text', 'rag'].includes(tag)) ? 'text-embedding-3-small' : 'gpt-4.1-mini')
        },
        { key: 'name', kind: 'text', message: 'Provide a name for this model', def: (ctx, v) => unique(v.model.startsWith('text-embedding') ? 'embeddings' : 'chat', ctx.taken), check: nameCheck },
        usedBy
      ],
      yaml: (v) => ['type: ai.openai.model', 'model:', `  name: ${v.model}`, `  version: "${modelInfo(OPENAI_MODELS, v.model)[1]}"`],
      env: () => ['AZURE_OPENAI_ENDPOINT'],
      detail: (v) => v.model,
      flags: (v) => `--model ${v.model} --name ${v.name}`
    },
    {
      id: 'ai.project', group: 'AI', label: 'Azure AI services model', desc: 'Foundry models like Phi, Llama and Mistral', fixedKey: 'ai-project',
      aliases: ['ai foundry', 'ai services', 'foundry', 'phi', 'llama', 'mistral', 'deepseek'],
      intents: [{ tag: 'open-model', reason: 'Runs an open model', words: ['opensource', 'oss', 'slm'] }],
      fields: [
        { key: 'model', kind: 'select', message: 'Which model do you want to use?', choices: () => FOUNDRY_MODELS.map(([name, , format]) => ({ value: name, label: name, desc: format })), def: foundryDefault },
        usedBy
      ],
      yaml: (v) => {
        const [name, version, format] = modelInfo(FOUNDRY_MODELS, v.model);
        return ['type: ai.project', 'models:', `  - name: ${name}`, `    version: "${version}"`, `    format: ${format}`, '    sku:', '      name: GlobalStandard', '      capacity: 1'];
      },
      env: () => ['AZURE_AI_PROJECT_ENDPOINT'],
      detail: (v) => v.model,
      flags: (v) => `--model ${v.model}`
    },
    {
      id: 'ai.search', group: 'AI', label: 'Azure AI Search', desc: 'Search and retrieval over your data', fixedKey: 'search',
      aliases: ['azure ai search', 'ai search', 'azure search', 'cognitive search'],
      intents: [
        { tag: 'search', reason: 'Indexes and searches your data', words: ['search', 'searchable', 'retrieval', 'retrieve', 'index', 'indexing', 'semantic', 'knowledge'] },
        { tag: 'rag', reason: 'Finds the data that grounds answers', words: ['rag', 'grounded', 'grounding'] }
      ],
      fields: [usedBy],
      yaml: () => ['type: ai.search'],
      env: () => ['AZURE_AI_SEARCH_ENDPOINT']
    },
    {
      id: 'db.cosmos', group: 'Database', label: 'Cosmos DB', desc: 'NoSQL JSON documents at any scale',
      aliases: ['cosmos db', 'cosmosdb', 'cosmos', 'nosql', 'documentdb'],
      intents: [{ tag: 'json', reason: 'Stores JSON documents', words: ['json', 'schemaless', 'catalog', 'profiles'] }],
      fields: [dbName('CosmosDB'), usedBy],
      yaml: () => ['type: db.cosmos'],
      env: () => ['AZURE_COSMOS_ENDPOINT'],
      flags: (v) => `--name ${v.name}`
    },
    {
      id: 'db.mongo', group: 'Database', label: 'MongoDB', desc: 'MongoDB-compatible document database',
      aliases: ['mongodb', 'mongo'], intents: [],
      fields: [dbName('MongoDB'), usedBy],
      yaml: () => ['type: db.mongo'],
      env: () => ['MONGODB_URL'],
      flags: (v) => `--name ${v.name}`
    },
    {
      id: 'db.mysql', group: 'Database', label: 'MySQL', desc: 'Relational database on MySQL',
      aliases: ['mysql', 'mariadb'], intents: [],
      fields: [dbName('MySQL'), usedBy],
      yaml: () => ['type: db.mysql'],
      env: dbEnv('MYSQL'),
      flags: (v) => `--name ${v.name}`
    },
    {
      id: 'db.postgres', group: 'Database', label: 'PostgreSQL', desc: 'Relational database on PostgreSQL',
      aliases: ['postgresql', 'postgres', 'psql'],
      intents: [{ tag: 'relational', reason: 'Stores your app data in tables', words: ['database', 'databases', 'db', 'sql', 'relational', 'tables', 'records', 'transactions', 'orders', 'inventory'] }],
      fields: [dbName('PostgreSQL'), usedBy],
      yaml: () => ['type: db.postgres'],
      env: dbEnv('POSTGRES'),
      flags: (v) => `--name ${v.name}`
    },
    {
      id: 'db.redis', group: 'Database', label: 'Redis', desc: 'Cache, sessions and fast key-value data', fixedKey: 'redis',
      aliases: ['redis'],
      intents: [{ tag: 'cache', reason: 'Caches data and sessions', words: ['cache', 'caching', 'cached', 'session', 'sessions', 'leaderboard', 'leaderboards', 'ratelimit', 'throttle', 'throttling'] }],
      fields: [usedBy],
      yaml: () => ['type: db.redis'],
      env: () => ['REDIS_ENDPOINT', 'REDIS_HOST', 'REDIS_PASSWORD', 'REDIS_PORT', 'REDIS_URL']
    },
    {
      id: 'host.containerapp', group: 'Host service', label: 'Container App', desc: 'Run a new service or API in a container',
      aliases: ['container apps', 'container app', 'containerapp', 'aca'],
      intents: [{ tag: 'host', reason: 'Runs the new service in a container', words: ['container', 'containers', 'docker', 'dockerfile', 'microservice', 'microservices', 'worker', 'workers'] }],
      fields: hostFields('src/worker'),
      yaml: (v, s) => ['type: host.containerapp', 'port: 80', ...usesYaml(s, 'host.containerapp')],
      env: (v) => [`${envName(v.name)}_BASE_URL`],
      detail: (v) => v.path,
      flags: (v) => `--path ${v.path} --name ${v.name}`
    },
    {
      id: 'host.appservice', group: 'Host service', label: 'App Service', desc: 'Host a Python or Node.js web app',
      aliases: ['app service', 'appservice'],
      intents: [{ tag: 'site', reason: 'Hosts the new web app', words: ['website', 'websites', 'django', 'flask', 'fastapi', 'express'] }],
      fields: hostFields('src/admin'),
      yaml: (v, s) => {
        const [stack, version] = RUNTIMES[DIRS[v.path]];
        return ['type: host.appservice', 'port: 80', 'runtime:', `  stack: ${stack}`, `  version: "${version}"`, ...usesYaml(s, 'host.appservice')];
      },
      env: (v) => [`${envName(v.name)}_BASE_URL`],
      detail: (v) => v.path,
      flags: (v) => `--path ${v.path} --name ${v.name}`
    },
    {
      id: 'keyvault', group: 'Key Vault', label: 'Key Vault', desc: 'Secrets, keys and certificates', fixedKey: 'vault',
      aliases: ['key vault', 'keyvault', 'vault'],
      intents: [{ tag: 'secrets', reason: 'Keeps secrets and keys out of your code', words: ['secret', 'secrets', 'password', 'passwords', 'credential', 'credentials', 'certificate', 'certificates', 'apikey', 'apikeys', 'keys', 'tokens'] }],
      fields: [usedBy],
      yaml: () => ['type: keyvault'],
      env: () => ['AZURE_KEY_VAULT_ENDPOINT', 'AZURE_KEY_VAULT_NAME']
    },
    {
      id: 'messaging.eventhubs', group: 'Messaging', label: 'Event Hubs', desc: 'Stream events and telemetry, Kafka compatible', fixedKey: 'event-hubs',
      aliases: ['event hubs', 'event hub', 'eventhubs', 'eventhub', 'kafka'],
      intents: [{ tag: 'stream', reason: 'Ingests the event stream', words: ['stream', 'streams', 'streaming', 'telemetry', 'iot', 'events', 'clickstream', 'ingest', 'ingestion'] }],
      fields: [
        { key: 'hub', kind: 'text', message: 'Input the event hub name:', help: 'Name of the event hub that the app connects to. Also known as a Kafka topic.', def: hubDefault, check: (value) => labelError(value) },
        usedBy
      ],
      yaml: (v) => ['type: messaging.eventhubs', 'hubs:', `  - ${v.hub}`],
      env: () => ['AZURE_EVENT_HUBS_HOST', 'AZURE_EVENT_HUBS_NAME'],
      detail: (v) => `hub ${v.hub}`,
      flags: (v) => `--hub ${v.hub}`
    },
    {
      id: 'messaging.servicebus', group: 'Messaging', label: 'Service Bus', desc: 'Queues for background work', fixedKey: 'service-bus',
      aliases: ['service bus', 'servicebus'],
      intents: [{ tag: 'queue', reason: 'Queues the background work', words: ['queue', 'queues', 'queued', 'background', 'job', 'jobs', 'tasks', 'messaging', 'async', 'asynchronous', 'pubsub'] }],
      fields: [
        { key: 'queue', kind: 'text', message: 'Input the queue name:', help: 'Name of the queue that the app connects to.', def: queueDefault, check: (value) => labelError(value) },
        usedBy
      ],
      yaml: (v) => ['type: messaging.servicebus', 'queues:', `  - ${v.queue}`],
      env: () => ['AZURE_SERVICE_BUS_HOST', 'AZURE_SERVICE_BUS_NAME'],
      detail: (v) => `queue ${v.queue}`,
      flags: (v) => `--queue ${v.queue}`
    },
    {
      id: 'storage', group: 'Storage account', label: 'Blob storage', desc: 'Files, images and uploads', fixedKey: 'storage',
      aliases: ['blob storage', 'storage account', 'blobs', 'blob', 'storage'],
      intents: [
        { tag: 'uploads', reason: 'Stores the uploaded files', words: ['upload', 'uploads', 'uploaded', 'uploading'] },
        { tag: 'images', reason: 'Stores images and media', words: ['image', 'images', 'photo', 'photos', 'picture', 'pictures', 'video', 'videos', 'media', 'avatar', 'avatars'] },
        { tag: 'documents', reason: 'Stores the documents', words: ['pdf', 'pdfs', 'document', 'documents', 'docs'] },
        { tag: 'files', reason: 'Stores files', words: ['file', 'files', 'attachment', 'attachments', 'backup', 'backups', 'assets'] }
      ],
      fields: [
        { key: 'container', kind: 'text', message: 'Input a blob container name to be created:', help: 'A blob container organizes a set of blobs, similar to a directory in a file system.', def: containerDefault, check: (value) => containerError(value) },
        usedBy
      ],
      yaml: (v) => ['type: storage', 'containers:', `  - ${v.container}`],
      env: () => ['AZURE_STORAGE_ACCOUNT_NAME', 'AZURE_STORAGE_BLOB_ENDPOINT'],
      detail: (v) => `container ${v.container}`,
      flags: (v) => `--container ${v.container}`
    }
  ];
  const byId = Object.fromEntries(catalog.map((item) => [item.id, item]));
  const isHost = (id) => id.startsWith('host.');
  const LABEL_WIDTH = Math.max(...catalog.map((item) => item.label.length)) + ' (suggested)'.length;

  // ---------- Matching: resource names and plain-language needs (simulated, keyword based) ----------
  const phraseAliases = catalog
    .flatMap((item) => item.aliases.filter((alias) => alias.includes(' ')).map((alias) => ({ item, alias })))
    .sort((a, b) => b.alias.length - a.alias.length);

  function wordMatch(token, word) {
    if (token === word) return true;
    if (token.length >= 3 && word.startsWith(token)) return true;
    return word.length >= 4 && token.startsWith(word);
  }

  function analyze(text) {
    let rest = ` ${text.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()} `;
    const found = new Map();
    const tags = new Set();
    const words = [];
    const note = (item, kind, reason, tag, pos) => {
      const previous = found.get(item.id);
      if (!previous) found.set(item.id, { id: item.id, kind, reason, pos });
      else if (kind === 'name' && previous.kind !== 'name') found.set(item.id, { id: item.id, kind, reason, pos: Math.min(previous.pos, pos) });
      if (tag) tags.add(tag);
    };
    for (const { item, alias } of phraseAliases) {
      const at = rest.indexOf(` ${alias} `);
      if (at < 0) continue;
      note(item, 'name', item.desc, alias.split(' ').pop(), at);
      rest = `${rest.slice(0, at)}${' '.repeat(alias.length + 2)}${rest.slice(at + alias.length + 2)}`;
    }
    const pattern = /[a-z0-9]+/g;
    let match;
    while ((match = pattern.exec(rest))) {
      const token = match[0];
      if (STOP.has(token)) continue;
      words.push(token);
      for (const item of catalog) {
        const alias = item.aliases.find((entry) => !entry.includes(' ') && wordMatch(token, entry));
        if (alias) {
          note(item, 'name', item.desc, alias, match.index);
          continue;
        }
        const group = item.intents.find((entry) => entry.words.some((word) => wordMatch(token, word)));
        if (group) note(item, 'intent', group.reason, group.tag, match.index);
      }
    }
    return { items: [...found.values()].sort((a, b) => a.pos - b.pos), tags: [...tags], words };
  }

  // ---------- Project helpers ----------
  function keyOf(s, id) {
    const item = byId[id];
    if (item.fixedKey) return item.fixedKey;
    const values = s.values[id];
    return values && values.name ? values.name : '';
  }
  function takenFor(s, id) {
    const taken = new Set(SERVICES.map((svc) => svc.name));
    for (const other of s.selection) {
      if (other === id) continue;
      const key = keyOf(s, other);
      if (key) taken.add(key);
    }
    return taken;
  }
  const sortForDetails = (ids) => [...ids.filter((id) => !isHost(id)), ...ids.filter(isHost)];
  const orderFor = (s) => [...s.suggested, ...catalog.map((item) => item.id).filter((id) => !s.suggested.includes(id))];
  function validUses(s, id) {
    const values = s.values[id] || {};
    return (values.uses || []).filter((use) => SERVICES.some((svc) => svc.name === use) ||
      s.selection.some((other) => other !== id && keyOf(s, other) === use));
  }
  function usesYaml(s, id) {
    const uses = validUses(s, id);
    return uses.length ? ['uses:', ...uses.map((use) => `  - ${use}`)] : [];
  }
  function connections(s) {
    const links = [];
    for (const id of sortForDetails(s.selection)) {
      const values = s.values[id] || {};
      const key = keyOf(s, id);
      if (isHost(id)) {
        for (const use of validUses(s, id)) {
          const target = s.selection.find((other) => keyOf(s, other) === use);
          links.push({ from: key, to: use, vars: target ? byId[target].env(s.values[target]) : [`${envName(use)}_BASE_URL`] });
        }
      } else {
        for (const svc of values.usedBy || []) links.push({ from: svc, to: key, vars: byId[id].env(values) });
      }
    }
    return links;
  }
  function unconnected(s) {
    return s.selection.filter((id) => !isHost(id) && !((s.values[id] || {}).usedBy || []).length &&
      !s.selection.some((host) => isHost(host) && validUses(s, host).includes(keyOf(s, id)))).map((id) => keyOf(s, id));
  }

  // ---------- Terminal segments (azd output helpers mapped to CSS classes) ----------
  const seg = (text, cls = '') => ({ t: text, c: cls });
  const T = (text) => seg(text);
  const HI = (text) => seg(text, 'hi');
  const B = (text) => seg(text, 'b');
  const G = (text) => seg(text, 'gray');
  const OK = (text) => seg(text, 'ok');
  const WARN = (text) => seg(text, 'warn');
  const HINT = (text) => seg(text, 'hint');
  const CARET = seg('', 'caret');

  function formatMessage(message) {
    const trimmed = message.replace(/\s+$/, '');
    return /[?:.!;]$/.test(trimmed) ? `${trimmed} ` : `${trimmed}: `;
  }
  const head = (message) => [HI('? '), B(formatMessage(message))];
  const shell = (command) => [HI('> '), OK(`developer:~/${PROJECT}`), T(command ? `$ ${command}` : '$ ')];
  const hintLine = (text, indent = '') => [seg(`${indent}Hint:`, 'hint b'), HINT(` ${text}`)];
  const filterLine = (filter) => [T('  Filter: '), ...(filter ? [T(filter), CARET] : [CARET, G('Type to filter list')])];
  function keys(pairs) {
    const out = [];
    pairs.forEach(([key, label], index) => {
      if (index) out.push(G(' • '));
      out.push(HI(key), G(` ${label}`));
    });
    return out;
  }
  function labelSegs(label, { suffix = '', filter = '', active = false, width = 0 }) {
    const base = active ? 'hi' : '';
    const at = filter.trim() ? label.toLowerCase().indexOf(filter.trim().toLowerCase()) : -1;
    const out = at < 0 ? [seg(label, base)] : [
      seg(label.slice(0, at), base),
      seg(label.slice(at, at + filter.trim().length), `${base} u`),
      seg(label.slice(at + filter.trim().length), base)
    ];
    if (suffix) out.push(seg(suffix, active ? 'hi' : 'gray'));
    const pad = width - label.length - suffix.length;
    if (pad > 0) out.push(T(' '.repeat(pad)));
    return out;
  }
  function checkRow({ label, suffix = '', desc = '', checked, active, filter = '', width }) {
    return [
      T('  '), active ? HI('>') : T(' '), T(' '),
      active ? HI('[') : T('['), checked ? OK('✓') : T(' '), active ? HI(']') : T(']'), T(' '),
      ...labelSegs(label, { suffix, filter, active, width }),
      ...(desc ? [G(`   ${desc}`)] : [])
    ];
  }
  function windowRows(count, index, rowFn, size = WINDOW) {
    let start = index - Math.floor(size / 2);
    let end = start + size;
    if (start < 0) {
      start = 0;
      end = Math.min(count, size);
    } else if (end > count) {
      end = count;
      start = Math.max(0, count - size);
    }
    const rows = [];
    if (start > 0) rows.push([T('    ...')]);
    for (let i = start; i < end; i += 1) rows.push(rowFn(i, i === index));
    if (end < count) rows.push([T('    ...')]);
    return rows;
  }

  // ---------- Widgets (plain data so Esc can restore snapshots) ----------
  const selectWidget = (message, choices, opts = {}) => ({
    type: 'select', message, choices, index: opts.index || 0, filter: '', filterable: opts.filterable !== false,
    help: opts.help || '', showHelp: false, purpose: opts.purpose, res: opts.res || null, key: opts.key || null
  });
  const textWidget = (message, value, opts = {}) => ({
    type: 'text', message, value, def: value, placeholder: opts.placeholder || '', help: opts.help || '', showHelp: false,
    error: '', purpose: opts.purpose, res: opts.res || null, key: opts.key || null
  });
  const checkWidget = (message, choices, checked, opts = {}) => ({
    type: 'checks', message, choices, checked: [...checked], index: 0, help: opts.help || '', showHelp: false,
    purpose: opts.purpose, res: opts.res || null, key: opts.key || null
  });
  const checklistWidget = (s, opts = {}) => ({
    type: 'checklist', order: orderFor(s), checked: [...(opts.checked || [])], index: 0, filter: '',
    describeRow: Boolean(opts.describeRow), mode: 'list', describe: '', context: opts.context || '',
    contextWarn: Boolean(opts.contextWarn), showHelp: false, error: '', frame: 0
  });
  const browseWidget = (checked = []) => ({
    type: 'browse', filter: '', showAll: true, expanded: [], closed: [], checked: [...checked], index: 0, showHelp: false, error: ''
  });
  const searchWidget = (s) => ({ type: 'search', query: '', zone: 'input', index: 0, manualOn: [...s.selection], manualOff: [], pinned: [...s.selection], showHelp: false, error: '' });

  // ---------- Flow ----------
  function fresh(concept) {
    const s = {
      concept, transcript: [shell('azd add')], widget: null, selection: [], suggested: [], reasons: {}, values: {},
      tags: [], words: [], query: '', detailOrder: [], steps: [], stepIndex: 0, history: []
    };
    s.widget = startWidget(s);
    return s;
  }
  function startWidget(s) {
    if (s.concept === 'a') {
      return selectWidget('How would you like to find resources?', [
        { value: 'describe', label: 'Describe what you need', desc: 'Get suggestions from a short description' },
        { value: 'browse', label: 'Browse all resources', desc: `Pick from all ${catalog.length} resource types` }
      ], { filterable: false, purpose: 'path' });
    }
    if (s.concept === 'b') return searchWidget(s);
    return checklistWidget(s, { describeRow: true });
  }
  const reselectWidget = (s) => (s.concept === 'b' ? searchWidget(s)
    : s.concept === 'a' && s.path === 'browse' ? browseWidget(s.selection)
    : checklistWidget(s, { describeRow: s.concept === 'c', checked: s.selection }));

  function commit(s) {
    const { history, ...rest } = s;
    history.push(JSON.stringify(rest));
  }
  function back(s) {
    const previous = s.history.pop();
    if (previous) Object.assign(s, JSON.parse(previous));
  }
  function setValue(s, id, key, value) {
    s.values[id] = s.values[id] || {};
    s.values[id][key] = value;
  }

  function applySuggestions(s, text) {
    const result = analyze(text);
    s.tags = result.tags;
    s.words = result.words;
    s.query = text;
    s.suggested = result.items.map((item) => item.id);
    s.reasons = Object.fromEntries(result.items.map((item) => [item.id, { kind: item.kind, text: item.reason }]));
    return result.items.length;
  }
  const suggestContext = (count, text) => (count
    ? { context: `Suggested for "${text}". Space to change, Enter to continue.`, contextWarn: false }
    : { context: `No suggestions for "${text}". Select resources below.`, contextWarn: true });

  function think(s, text) {
    const widget = { type: 'thinking', text: 'Finding resources...', frame: 0 };
    s.widget = widget;
    setTimeout(() => {
      if (s.widget !== widget) return;
      const count = applySuggestions(s, text);
      s.widget = checklistWidget(s, { checked: s.suggested, ...suggestContext(count, text) });
      if (current() === s) render();
    }, THINK_MS);
  }
  function thinkInline(s, w) {
    const text = w.describe.trim();
    w.mode = 'thinking';
    setTimeout(() => {
      if (w.mode !== 'thinking') return;
      const count = applySuggestions(s, text);
      w.checked = [...new Set([...w.checked, ...s.suggested])];
      w.order = orderFor(s);
      Object.assign(w, suggestContext(count, text), { mode: 'list', describe: '', filter: '', index: count && w.describeRow ? 1 : 0 });
      if (current() === s) render();
    }, THINK_MS);
  }

  function completePick(s, ids) {
    commit(s);
    s.transcript.push([...head('What would you like to add?'), HI(ids.map((id) => byId[id].label).join(', '))]);
    const previous = s.selection;
    s.selection = [...ids];
    Object.keys(s.values).forEach((id) => {
      if (!ids.includes(id)) delete s.values[id];
    });
    const added = ids.filter((id) => !previous.includes(id));
    s.detailOrder = [...s.detailOrder.filter((id) => ids.includes(id)), ...sortForDetails(added)];
    if (added.length) beginDetails(s, added);
    else startReview(s);
  }

  function beginDetails(s, ids) {
    const ordered = sortForDetails(ids);
    s.steps = [];
    ordered.forEach((id) => byId[id].fields.forEach((field, i) => {
      s.steps.push({ id, key: field.key, first: i === 0, n: s.detailOrder.indexOf(id) + 1, of: s.detailOrder.length });
    }));
    s.stepIndex = 0;
    nextStep(s);
  }
  function nextStep(s) {
    const step = s.steps[s.stepIndex];
    if (!step) {
      startReview(s);
      return;
    }
    if (step.first) s.transcript.push([B(`${byId[step.id].label} (${step.n} of ${step.of})`)]);
    s.values[step.id] = s.values[step.id] || {};
    s.widget = fieldWidget(s, step);
  }
  function usesChoices(s, id) {
    const batch = s.selection.filter((other) => other !== id && !isHost(other))
      .map((other) => ({ value: keyOf(s, other), label: keyOf(s, other), desc: byId[other].label, batch: true }));
    const hosts = id === 'host.containerapp' ? SERVICES.map((svc) => ({ value: svc.name, label: svc.name, desc: `${svc.label} in ${svc.path}`, batch: false })) : [];
    return [...batch, ...hosts];
  }
  function fieldWidget(s, step) {
    const item = byId[step.id];
    const field = item.fields.find((entry) => entry.key === step.key);
    const v = s.values[step.id];
    const ctx = { s, id: step.id, tags: s.tags, words: s.words, taken: takenFor(s, step.id) };
    const has = Object.hasOwn(v, field.key);
    const base = { purpose: 'field', res: step.id, key: field.key };
    if (field.kind === 'text') return textWidget(field.message, has ? v[field.key] : field.def(ctx, v), { ...base, help: field.help });
    if (field.kind === 'select') {
      const choices = field.choices();
      const value = has ? v[field.key] : field.def(ctx, v);
      return selectWidget(field.message, choices, { ...base, filterable: false, index: Math.max(0, choices.findIndex((choice) => choice.value === value)) });
    }
    if (field.kind === 'services') {
      const name = keyOf(s, step.id);
      const choices = SERVICES.map((svc) => ({ value: svc.name, label: svc.name, desc: `${svc.label} in ${svc.path}` }));
      return checkWidget(`Select the services that use ${name}`, choices, has ? v.usedBy : ['api'],
        { ...base, help: `Each selected service gets ${item.env(v).join(', ')} so your code can connect to ${name}.` });
    }
    const choices = usesChoices(s, step.id);
    const checked = has ? v.uses.filter((use) => choices.some((choice) => choice.value === use)) : choices.filter((choice) => choice.batch).map((choice) => choice.value);
    return checkWidget(`Select the resources that ${v.name} uses`, choices, checked,
      { ...base, help: `${v.name} gets the connection variables of each selected resource.` });
  }

  function completeSelect(s, w, choice) {
    commit(s);
    s.transcript.push([...head(w.message), HI(choice.label)]);
    if (w.purpose === 'path') {
      s.path = choice.value;
      if (choice.value === 'describe') {
        s.widget = textWidget('Describe what you need', '', { purpose: 'describe', placeholder: 'For example: a chat app that stores uploaded files', help: DESCRIBE_HELP });
      } else {
        s.suggested = [];
        s.reasons = {};
        s.widget = browseWidget();
      }
      return;
    }
    if (w.purpose === 'change') {
      chooseChange(s, choice.value);
      return;
    }
    setValue(s, w.res, w.key, choice.value);
    s.stepIndex += 1;
    nextStep(s);
  }
  function textError(s, w, value) {
    if (w.purpose === 'describe') return value ? '' : 'This field is required';
    const field = byId[w.res].fields.find((entry) => entry.key === w.key);
    return field.check(value, { s, id: w.res, taken: takenFor(s, w.res) });
  }
  function completeText(s, w) {
    const value = w.value.trim();
    const error = textError(s, w, value);
    if (error) {
      w.error = error;
      w.showHelp = false;
      return;
    }
    commit(s);
    s.transcript.push([...head(w.message), HI(value)]);
    if (w.purpose === 'describe') {
      think(s, value);
      return;
    }
    const stored = w.key === 'path' ? normPath(value) : value;
    setValue(s, w.res, w.key, stored);
    if (w.key === 'path' && w.res === 'host.appservice') {
      const [stack, version] = RUNTIMES[DIRS[stored]];
      s.transcript.push([T('azd will use '), HI(`${stack} ${version}`), T(' to host this project on '), HI('Azure App Service'), T('.')]);
    }
    s.stepIndex += 1;
    nextStep(s);
  }
  function completeChecks(s, w) {
    const values = w.choices.filter((choice) => w.checked.includes(choice.value)).map((choice) => choice.value);
    commit(s);
    s.transcript.push([...head(w.message), values.length ? HI(values.join(', ')) : G('None')]);
    setValue(s, w.res, w.key, values);
    s.stepIndex += 1;
    nextStep(s);
  }

  // ---------- Review, confirm and finish ----------
  function diffLines(s) {
    const blocks = [];
    for (const svc of SERVICES) {
      const added = s.selection.filter((id) => !isHost(id) && ((s.values[id] || {}).usedBy || []).includes(svc.name)).map((id) => keyOf(s, id));
      if (!added.length) continue;
      const lines = [[T(`   ${svc.name}:`)], ...svc.lines.map((text) => [T(`     ${text}`)])];
      if (svc.uses.length) lines.push([T('     uses:')], ...svc.uses.map((use) => [T(`       - ${use}`)]));
      else lines.push([OK('+    uses:')]);
      added.forEach((use) => lines.push([OK(`+      - ${use}`)]));
      blocks.push({ key: svc.name, lines });
    }
    for (const id of s.selection) {
      const key = keyOf(s, id);
      blocks.push({ key, lines: [[OK(`+  ${key}:`)], ...byId[id].yaml(s.values[id], s).map((text) => [OK(`+    ${text}`)])] });
    }
    return blocks.sort((a, b) => a.key.localeCompare(b.key)).flatMap((block) => block.lines);
  }
  function reviewLines(s) {
    const rows = sortForDetails(s.selection).map((id) => {
      const v = s.values[id];
      const link = isHost(id) ? `uses ${validUses(s, id).join(', ') || 'no resources yet'}` : `used by ${(v.usedBy || []).join(', ') || 'no service yet'}`;
      return { key: keyOf(s, id), label: byId[id].label, detail: byId[id].detail ? byId[id].detail(v) : '', link };
    });
    const keyWidth = Math.max(...rows.map((row) => row.key.length)) + 3;
    const labelWidth = Math.max(...rows.map((row) => row.label.length)) + 3;
    const detailWidth = Math.max(...rows.map((row) => row.detail.length));
    const lines = [[B('Resources')]];
    rows.forEach((row) => lines.push([OK('+  '), B(row.key.padEnd(keyWidth)), T(row.label.padEnd(labelWidth)),
      ...(detailWidth ? [T(row.detail.padEnd(detailWidth + 3))] : []), G(row.link)]));
    lines.push([B('Variables')]);
    const links = connections(s);
    const fromWidth = Math.max(0, ...links.map((link) => link.from.length));
    const toWidth = Math.max(0, ...links.map((link) => link.to.length)) + 3;
    links.forEach((link) => lines.push([T(`   ${link.from.padEnd(fromWidth)} -> `), B(link.to.padEnd(toWidth)), OK(`+ ${link.vars.join(', ')}`)]));
    unconnected(s).forEach((key) => lines.push([WARN(`   ${key} is not used by any service yet, so no app gets its variables`)]));
    lines.push([T('Previewing changes to '), HI('azure.yaml'), T(':')], ...diffLines(s));
    lines.push([G('This updates azure.yaml only. Nothing is created in Azure until you run azd provision.')]);
    return lines;
  }
  function startReview(s) {
    s.transcript.push(...reviewLines(s));
    s.widget = { type: 'confirm', message: 'Accept changes to azure.yaml?', value: true, error: false };
  }
  function completeConfirm(s, w) {
    commit(s);
    s.transcript.push([...head(w.message), HI(w.value ? 'Yes' : 'No')]);
    if (w.value) finish(s);
    else {
      const choices = sortForDetails(s.selection).map((id) => ({ value: `edit:${id}`, label: `Change ${keyOf(s, id)}`, desc: byId[id].label }));
      choices.push({ value: 'resources', label: 'Add or remove resources', desc: '' }, { value: 'exit', label: 'Exit without changes', desc: '' });
      s.widget = selectWidget('What would you like to do?', choices, { filterable: false, purpose: 'change' });
    }
  }
  function chooseChange(s, value) {
    if (value.startsWith('edit:')) beginDetails(s, [value.slice(5)]);
    else if (value === 'resources') s.widget = reselectWidget(s);
    else {
      s.transcript.push([T('No changes were made to azure.yaml.')]);
      s.widget = { type: 'done' };
    }
  }
  function commands(s) {
    return sortForDetails(s.selection).map((id) => {
      const v = s.values[id];
      const parts = ['azd add', id];
      if (byId[id].flags) parts.push(byId[id].flags(v));
      if (isHost(id)) {
        const uses = validUses(s, id);
        if (uses.length) parts.push(`--uses ${uses.join(',')}`);
      } else if ((v.usedBy || []).length) parts.push(`--used-by ${v.usedBy.join(',')}`);
      parts.push('--no-prompt');
      return parts.join(' ');
    });
  }
  function finish(s) {
    s.transcript.push([OK('SUCCESS: azure.yaml updated.')]);
    s.transcript.push([T("Run '"), HI('azd infra gen'), T("' to re-generate the infrastructure, then run '"), HI('azd provision'), T("' to provision these changes anytime later.")]);
    if (s.selection.includes('keyvault')) s.transcript.push([T("Run '"), HI('azd env set-secret <name>'), T("' to add a secret to the key vault.")]);
    s.transcript.push([T('To add these resources without prompts, run:')]);
    commands(s).forEach((command) => s.transcript.push([T('  '), HI(command)]));
    s.widget = { type: 'done' };
  }

  // ---------- Rendering ----------
  const filteredChoices = (w) => (w.filterable && w.filter.trim()
    ? w.choices.filter((choice) => `${choice.label} ${choice.desc}`.toLowerCase().includes(w.filter.trim().toLowerCase()))
    : w.choices);

  function renderSelect(w) {
    const items = filteredChoices(w);
    const active = items[w.index];
    const lines = [[...head(w.message), ...(active ? [HI(active.label)] : [])]];
    if (w.filterable) lines.push(filterLine(w.filter));
    const width = Math.max(...w.choices.map((choice) => choice.label.length));
    lines.push(...windowRows(items.length, w.index, (i, on) => [
      T('  '), on ? HI('>') : T(' '), T(' '), ...labelSegs(items[i].label, { filter: w.filter, active: on, width }),
      ...(items[i].desc ? [G(`   ${items[i].desc}`)] : [])
    ]));
    if (!items.length) lines.push([WARN('  No options found matching the filter')]);
    if (w.showHelp && w.help) lines.push(hintLine(w.help, '  '));
    lines.push([G(RULE_SELECT)], [G(w.help ? 'Use arrows to move, type ? for hint' : 'Use arrows to move')]);
    return lines;
  }

  function renderText(w) {
    const line = [...head(w.message)];
    if (w.help) line.push(HI('[Type ? for hint] '));
    if (w.value) line.push(w.value === w.def ? HI(w.value) : T(w.value), CARET);
    else line.push(CARET, ...(w.placeholder ? [G(w.placeholder)] : []));
    const lines = [line];
    if (w.error) lines.push([WARN(w.error)]);
    if (w.showHelp && w.help) lines.push(hintLine(w.help));
    return lines;
  }

  function renderChecks(w) {
    const selected = w.choices.filter((choice) => w.checked.includes(choice.value)).map((choice) => choice.label);
    const lines = [[...head(w.message), HI(selected.join(', '))]];
    const width = Math.max(0, ...w.choices.map((choice) => choice.label.length));
    w.choices.forEach((choice, i) => lines.push(checkRow({ label: choice.label, desc: choice.desc, checked: w.checked.includes(choice.value), active: i === w.index, width })));
    if (!w.choices.length) lines.push([G('  No resources to choose from yet')]);
    if (w.showHelp && w.help) lines.push(hintLine(w.help, '  '));
    lines.push([G(RULE_MULTI)], keys([['↑↓', 'Move'], ['Space', 'Select'], ['Enter', 'Confirm'], ...(w.help ? [['?', 'Help']] : [])]));
    return lines;
  }

  function filterHits(filter) {
    const text = filter.trim().toLowerCase();
    if (!text) return null;
    const hits = new Set(analyze(text).items.map((item) => item.id));
    catalog.forEach((item) => {
      if (`${item.label} ${item.group} ${item.desc} ${item.id}`.toLowerCase().includes(text)) hits.add(item.id);
    });
    return hits;
  }
  function checklistRows(w) {
    const hits = filterHits(w.filter);
    const rows = w.describeRow ? [{ kind: 'describe' }] : [];
    w.order.filter((id) => !hits || hits.has(id)).forEach((id) => rows.push({ kind: 'res', id }));
    return rows;
  }
  const orderedChecked = (w) => w.order.filter((id) => w.checked.includes(id));
  function rowText(s, id, hit) {
    const reason = hit || (s.suggested.includes(id) ? s.reasons[id] : null);
    if (!reason) return { suffix: '', desc: byId[id].desc };
    return { suffix: reason.kind === 'intent' ? ' (suggested)' : '', desc: reason.text || reason.reason };
  }

  function renderChecklist(s, w) {
    const lines = [[...head('What would you like to add?'), HI(orderedChecked(w).map((id) => byId[id].label).join(', '))]];
    if (w.mode === 'describe') {
      lines.push([T('  Describe what you need: '), ...(w.describe ? [T(w.describe), CARET] : [CARET, G('For example: a chat app that stores uploaded files')])]);
      if (w.error) lines.push([WARN(`  ${w.error}`)]);
      lines.push([G(RULE_MULTI)], keys([['Enter', 'Get suggestions'], ['Esc', 'Back to the list']]));
      return lines;
    }
    if (w.mode === 'thinking') {
      lines.push([T('  '), HINT(SPIN[w.frame % SPIN.length]), T(' Finding resources...')]);
      return lines;
    }
    if (w.context) lines.push([w.contextWarn ? WARN(`  ${w.context}`) : G(`  ${w.context}`)]);
    lines.push(filterLine(w.filter));
    const rows = checklistRows(w);
    const matches = rows.filter((row) => row.kind === 'res').length;
    lines.push(...windowRows(rows.length, w.index, (i, on) => {
      const row = rows[i];
      if (row.kind === 'describe') {
        const label = (w.filter.trim() && !matches ? `Describe "${w.filter.trim()}"...` : 'Describe what you need...').padEnd(LABEL_WIDTH + 4);
        return [T('  '), on ? HI('>') : T(' '), T(' '), on ? HI(label) : T(label), G('   Get suggestions from a short description')];
      }
      const text = rowText(s, row.id);
      return checkRow({ label: byId[row.id].label, ...text, checked: w.checked.includes(row.id), active: on, filter: w.filter, width: LABEL_WIDTH });
    }));
    if (!matches) lines.push([WARN('  No options found matching the filter')]);
    if (w.error) lines.push([WARN(`  ${w.error}`)]);
    if (w.showHelp) lines.push(hintLine(LIST_HELP, '  '));
    lines.push([G(RULE_MULTI)], keys([['↑↓', 'Move'], ['←→', 'None/All'], ['Space', 'Select'], ['Enter', 'Confirm'], ['?', 'Help']]));
    return lines;
  }

  function searchView(w) {
    const result = analyze(w.query);
    const hits = new Map(result.items.map((item) => [item.id, item]));
    const soft = result.items.map((item) => item.id);
    const checked = new Set([...soft, ...w.manualOn].filter((id) => !w.manualOff.includes(id)));
    const kept = w.pinned.filter((id) => !hits.has(id));
    const order = [...soft, ...kept, ...catalog.map((item) => item.id).filter((id) => !hits.has(id) && !kept.includes(id))];
    return { result, hits, checked, order };
  }
  function renderSearch(s, w) {
    const view = searchView(w);
    const prompt = [...head('What would you like to add?')];
    if (w.zone === 'input') prompt.push(...(w.query ? [T(w.query), CARET] : [CARET, G('Type a resource or describe what you need')]));
    else prompt.push(T(w.query));
    const lines = [prompt];
    if (w.error) lines.push([WARN(`  ${w.error}`)]);
    else if (w.query.trim() && !view.hits.size) lines.push([G(`  No matches for "${w.query.trim()}" yet. Keep typing, or press ↓ to browse.`)]);
    lines.push(...windowRows(view.order.length, w.zone === 'list' ? w.index : -1, (i, on) => {
      const id = view.order[i];
      const text = rowText(s, id, view.hits.get(id) || { kind: 'none', text: byId[id].desc });
      return checkRow({ label: byId[id].label, ...text, checked: view.checked.has(id), active: on, width: LABEL_WIDTH });
    }));
    if (w.showHelp) lines.push(hintLine(SEARCH_HELP, '  '));
    lines.push([G(RULE_MULTI)], w.zone === 'input'
      ? keys([['↓', 'Browse'], ['Enter', 'Confirm'], ['?', 'Help']])
      : keys([['↑↓', 'Move'], ['Space', 'Select'], ['Enter', 'Confirm'], ['?', 'Help']]));
    return lines;
  }

  // Design A browse: quick picks first, then a collapsible category tree (from ideas.html, idea 1).
  const QUICK_PICKS = ['ai.openai.model', 'ai.search', 'db.cosmos', 'db.postgres', 'messaging.servicebus', 'storage'];
  const BROWSE_WIDTH = Math.max(...catalog.map((item) => item.label.length));
  const groupOpen = (w, group) => (w.filter.trim() ? !w.closed.includes(group) : w.expanded.includes(group));
  function browseRows(w) {
    const query = w.filter.trim().toLowerCase();
    const visible = catalog.filter((item) => (query
      ? `${item.group} ${item.label} ${item.desc} ${item.id}`.toLowerCase().includes(query)
      : w.showAll || QUICK_PICKS.includes(item.id) || w.checked.includes(item.id)));
    if (!w.showAll) return [...visible.map((item) => ({ kind: 'res', id: item.id })), { kind: 'action', action: 'browse' }];
    const groups = [...new Set(visible.map((item) => item.group))];
    const rows = [];
    groups.forEach((group) => {
      const items = visible.filter((item) => item.group === group);
      rows.push({ kind: 'group', group, count: items.length, selected: items.filter((item) => w.checked.includes(item.id)).length });
      if (groupOpen(w, group)) items.forEach((item) => rows.push({ kind: 'res', id: item.id, nested: true }));
    });
    if (groups.length) rows.push({ kind: 'action', action: groups.every((group) => groupOpen(w, group)) ? 'collapse' : 'expand', groups });
    return rows;
  }
  const BROWSE_ACTIONS = { browse: `Browse all ${catalog.length} resource types`, expand: 'Expand all categories', collapse: 'Collapse all categories' };

  function renderBrowse(w) {
    const checked = catalog.filter((item) => w.checked.includes(item.id)).map((item) => item.label);
    const lines = [[...head('What would you like to add?'), HI(checked.join(', '))]];
    lines.push(filterLine(w.filter));
    const rows = browseRows(w);
    const cursor = (on) => [T('  '), on ? HI('>') : T(' '), T(' ')];
    lines.push(...windowRows(rows.length, w.index, (i, on) => {
      const row = rows[i];
      if (row.kind === 'res') {
        const line = checkRow({ label: byId[row.id].label, desc: byId[row.id].desc, checked: w.checked.includes(row.id), active: on, filter: w.filter, width: BROWSE_WIDTH - (row.nested ? 2 : 0) });
        return row.nested ? [T('  '), ...line] : line;
      }
      if (row.kind === 'group') {
        const open = groupOpen(w, row.group);
        return [...cursor(on), seg(open ? '[-]' : '[+]', on ? 'hi' : ''), T(' '), ...labelSegs(row.group, { filter: w.filter, active: on }),
          G(` (${row.count})${row.selected ? ` · ${row.selected} selected` : ''}`)];
      }
      return [...cursor(on), seg(BROWSE_ACTIONS[row.action], on ? 'hi u' : 'gray u')];
    }, rows.length));
    if (rows.every((row) => row.kind === 'action')) lines.push([WARN('  No matches. Clear the filter; your selections are kept.')]);
    if (w.error) lines.push([WARN(`  ${w.error}`)]);
    if (w.showHelp) lines.push(hintLine(BROWSE_HELP, '  '));
    lines.push([G(RULE_MULTI)], keys([['↑↓', 'Move'], ...(w.showAll ? [['←→', 'Close/Open']] : []), ['Space', 'Select'], ['Enter', 'Confirm'], ['?', 'Help']]));
    return lines;
  }

  function renderConfirm(w) {
    const line = [...head(w.message), HI('[Y/n]'), T(' ')];
    if (w.value !== null) line.push(HI(w.value ? 'Yes' : 'No'));
    line.push(CARET);
    return w.error ? [line, [WARN('Enter a valid value')]] : [line];
  }

  function renderWidget(s, w) {
    switch (w.type) {
      case 'select': return renderSelect(w);
      case 'text': return renderText(w);
      case 'checks': return renderChecks(w);
      case 'checklist': return renderChecklist(s, w);
      case 'browse': return renderBrowse(w);
      case 'search': return renderSearch(s, w);
      case 'confirm': return renderConfirm(w);
      case 'thinking': return [[HINT(SPIN[w.frame % SPIN.length]), T(` ${w.text}`)]];
      default: return [[...shell(''), CARET]];
    }
  }

  // ---------- Keyboard ----------
  const printable = (key) => key.length === 1;
  const move = (index, delta, count) => (count ? (index + delta + count) % count : 0);
  const toggle = (list, value) => (list.includes(value) ? list.splice(list.indexOf(value), 1) : list.push(value));
  function fixChecklistIndex(w) {
    const rows = checklistRows(w);
    if (w.filter.trim()) {
      w.index = w.describeRow && rows.length > 1 ? 1 : 0;
      return;
    }
    const firstChecked = rows.findIndex((row) => row.kind === 'res' && w.checked.includes(row.id));
    w.index = Math.max(0, firstChecked);
  }

  const handlers = {
    select(s, w, key) {
      const items = filteredChoices(w);
      if (key === 'ArrowDown' || key === 'ArrowUp') w.index = move(w.index, key === 'ArrowDown' ? 1 : -1, items.length);
      else if (key === 'Enter') {
        if (items[w.index]) completeSelect(s, w, items[w.index]);
      } else if (key === 'Escape') {
        if (w.filter) {
          w.filter = '';
          w.index = 0;
        } else back(s);
      } else if (key === '?' && w.help) w.showHelp = !w.showHelp;
      else if (!w.filterable) return key === ' ';
      else if (key === 'Backspace') {
        w.filter = w.filter.slice(0, -1);
        w.index = 0;
      } else if (printable(key)) {
        w.filter += key;
        w.index = 0;
      } else return false;
      return true;
    },
    text(s, w, key) {
      if (key === 'Enter') completeText(s, w);
      else if (key === 'Escape') back(s);
      else if (key === '?' && w.help) w.showHelp = !w.showHelp;
      else if (key === 'Backspace') {
        w.value = w.value.slice(0, -1);
        w.error = '';
      } else if (printable(key)) {
        w.value += key;
        w.error = '';
      } else return key === 'ArrowUp' || key === 'ArrowDown';
      return true;
    },
    checks(s, w, key) {
      if (key === 'ArrowDown' || key === 'ArrowUp') w.index = move(w.index, key === 'ArrowDown' ? 1 : -1, w.choices.length);
      else if (key === ' ') {
        if (w.choices[w.index]) toggle(w.checked, w.choices[w.index].value);
      } else if (key === 'Enter') completeChecks(s, w);
      else if (key === 'Escape') back(s);
      else if (key === '?' && w.help) w.showHelp = !w.showHelp;
      else return false;
      return true;
    },
    checklist(s, w, key) {
      if (w.mode === 'thinking') return true;
      if (w.mode === 'describe') {
        if (key === 'Enter') {
          if (w.describe.trim()) thinkInline(s, w);
          else w.error = 'Describe what you need, or press Esc to go back to the list.';
        } else if (key === 'Escape') {
          w.mode = 'list';
          w.error = '';
        } else if (key === 'Backspace') w.describe = w.describe.slice(0, -1);
        else if (printable(key)) {
          w.describe += key;
          w.error = '';
        } else return key.startsWith('Arrow');
        return true;
      }
      const rows = checklistRows(w);
      const row = rows[w.index];
      const openDescribe = () => Object.assign(w, { mode: 'describe', describe: w.filter.trim(), filter: '', error: '', index: 0 });
      w.error = '';
      if (key === 'ArrowDown' || key === 'ArrowUp') w.index = move(w.index, key === 'ArrowDown' ? 1 : -1, rows.length);
      else if (key === ' ') {
        if (row && row.kind === 'describe') openDescribe();
        else if (row) toggle(w.checked, row.id);
      } else if (key === 'Enter') {
        if (row && row.kind === 'describe') openDescribe();
        else {
          if (!w.checked.length && row) w.checked.push(row.id);
          if (w.checked.length) completePick(s, orderedChecked(w));
          else w.error = 'At least one option must be selected';
        }
      } else if (key === 'ArrowRight') w.checked = catalog.map((item) => item.id);
      else if (key === 'ArrowLeft') w.checked = [];
      else if (key === 'Escape') {
        if (w.filter) {
          w.filter = '';
          w.index = 0;
        } else back(s);
      } else if (key === '?') w.showHelp = !w.showHelp;
      else if (key === 'Backspace') {
        w.filter = w.filter.slice(0, -1);
        fixChecklistIndex(w);
      } else if (printable(key)) {
        w.filter += key;
        fixChecklistIndex(w);
      } else return false;
      return true;
    },
    browse(s, w, key) {
      const rows = browseRows(w);
      const row = rows[w.index];
      const setOpen = (group, open) => {
        const list = w.filter.trim() ? w.closed : w.expanded;
        const add = w.filter.trim() ? !open : open;
        if (add && !list.includes(group)) list.push(group);
        if (!add && list.includes(group)) list.splice(list.indexOf(group), 1);
      };
      const runAction = (action) => {
        if (action.action === 'browse') Object.assign(w, { showAll: true, filter: '', index: 0 });
        else {
          const all = action.action === 'expand';
          if (w.filter.trim()) w.closed = all ? [] : [...action.groups];
          else w.expanded = all ? [...action.groups] : [];
          w.index = 0;
        }
      };
      w.error = '';
      if (key === '?') w.showHelp = !w.showHelp;
      else if (key === 'ArrowDown' || key === 'ArrowUp') w.index = move(w.index, key === 'ArrowDown' ? 1 : -1, rows.length);
      else if (key === 'ArrowRight' && w.showAll && row) {
        if (row.kind === 'group') {
          if (!groupOpen(w, row.group)) setOpen(row.group, true);
          else if (rows[w.index + 1] && rows[w.index + 1].kind === 'res') w.index += 1;
        }
      } else if (key === 'ArrowLeft' && w.showAll && row) {
        if (row.kind === 'group') setOpen(row.group, false);
        else if (row.kind === 'res') w.index = rows.findIndex((other) => other.kind === 'group' && other.group === byId[row.id].group);
      } else if (key === ' ') {
        if (row && row.kind === 'res') toggle(w.checked, row.id);
        else if (row && row.kind === 'group') setOpen(row.group, !groupOpen(w, row.group));
        else if (row) runAction(row);
      } else if (key === 'Enter') {
        if (row && row.kind === 'action') runAction(row);
        else if (w.checked.length) completePick(s, catalog.map((item) => item.id).filter((id) => w.checked.includes(id)));
        else if (row && row.kind === 'res') completePick(s, [row.id]);
        else if (row && row.kind === 'group') setOpen(row.group, true);
        else w.error = 'Select at least one resource with Space to continue.';
      } else if (key === 'Escape') {
        if (w.filter) Object.assign(w, { filter: '', closed: [], index: 0 });
        else back(s);
      } else if (key === 'Backspace') Object.assign(w, { filter: w.filter.slice(0, -1), closed: [], index: 0 });
      else if (printable(key)) Object.assign(w, { filter: w.filter + key, closed: [], index: 0 });
      else return false;
      return true;
    },
    search(s, w, key) {
      const view = searchView(w);
      const pick = (ids) => {
        if (w.query.trim()) applySuggestions(s, w.query.trim());
        completePick(s, ids);
      };
      if (key === '?') {
        w.showHelp = !w.showHelp;
        return true;
      }
      if (w.zone === 'input') {
        if (key === 'ArrowDown') Object.assign(w, { zone: 'list', index: 0, error: '' });
        else if (key === 'Enter') {
          const ids = view.order.filter((id) => view.checked.has(id));
          if (ids.length) pick(ids);
          else if (!w.query.trim()) Object.assign(w, { zone: 'list', index: 0 });
          else w.error = `No resources match "${w.query.trim()}". Try other words, or press ↓ to browse.`;
        } else if (key === 'Escape') {
          if (w.query) Object.assign(w, { query: '', error: '' });
          else back(s);
        } else if (key === 'Backspace') Object.assign(w, { query: w.query.slice(0, -1), error: '' });
        else if (printable(key)) Object.assign(w, { query: w.query + key, error: '' });
        else return key === 'ArrowUp';
        return true;
      }
      const id = view.order[w.index];
      if (key === 'ArrowDown') w.index = move(w.index, 1, view.order.length);
      else if (key === 'ArrowUp') {
        if (w.index === 0) w.zone = 'input';
        else w.index -= 1;
      } else if (key === ' ') {
        if (view.checked.has(id)) {
          w.manualOn = w.manualOn.filter((other) => other !== id);
          if (!w.manualOff.includes(id)) w.manualOff.push(id);
        } else {
          w.manualOff = w.manualOff.filter((other) => other !== id);
          w.manualOn.push(id);
        }
      } else if (key === 'Enter') {
        let ids = view.order.filter((other) => view.checked.has(other));
        if (!ids.length) {
          w.manualOn.push(id);
          ids = [id];
        }
        pick(ids);
      } else if (key === 'Escape') w.zone = 'input';
      else if (key === 'Backspace') Object.assign(w, { zone: 'input', query: w.query.slice(0, -1) });
      else if (printable(key)) Object.assign(w, { zone: 'input', query: w.query + key, error: '' });
      else return false;
      return true;
    },
    confirm(s, w, key) {
      if (key === 'Enter') {
        if (w.value === null) w.error = true;
        else completeConfirm(s, w);
      } else if (key === 'Escape') back(s);
      else if (key === 'Backspace') Object.assign(w, { value: true, error: false });
      else if (printable(key)) {
        const answer = key.toLowerCase();
        w.value = answer === 'y' ? true : answer === 'n' ? false : null;
        w.error = w.value === null;
      } else return false;
      return true;
    },
    thinking: () => true,
    done(s, w, key) {
      if (key !== 'Escape') return false;
      back(s);
      return true;
    }
  };

  function inputOf(w) {
    if (!w) return null;
    if (w.type === 'text') return { get: () => w.value, set: (value) => Object.assign(w, { value, error: '' }) };
    if (w.type === 'select' && w.filterable) return { get: () => w.filter, set: (value) => Object.assign(w, { filter: value, index: 0 }) };
    if (w.type === 'search') return { get: () => w.query, set: (value) => Object.assign(w, { query: value, zone: 'input', error: '' }) };
    if (w.type === 'browse') return { get: () => w.filter, set: (value) => Object.assign(w, { filter: value, closed: [], index: 0, error: '' }) };
    if (w.type === 'checklist' && w.mode === 'describe') return { get: () => w.describe, set: (value) => Object.assign(w, { describe: value, error: '' }) };
    if (w.type === 'checklist' && w.mode === 'list') {
      return { get: () => w.filter, set: (value) => {
        w.filter = value;
        fixChecklistIndex(w);
      } };
    }
    return null;
  }

  // ---------- Page wiring ----------
  const terminal = document.getElementById('terminal');
  const screen = document.getElementById('screen');
  const live = document.getElementById('live');
  const restart = document.getElementById('restart');
  const conceptButtons = [...document.querySelectorAll('[data-concept]')];
  const concepts = conceptButtons.map((button) => button.dataset.concept);
  const states = {};
  const requested = new URLSearchParams(location.search).get('concept');
  let concept = concepts.includes(requested) ? requested : 'a';
  let spinTimer = null;
  const current = () => states[concept] || (states[concept] = fresh(concept));

  function toLine(segs) {
    const div = document.createElement('div');
    div.className = 'tl';
    for (const part of segs) {
      if (!part.t && part.c !== 'caret') continue;
      const span = document.createElement('span');
      if (part.c) span.className = part.c.split(' ').map((name) => `t-${name}`).join(' ');
      span.textContent = part.c === 'caret' ? '\u00a0' : part.t;
      div.append(span);
    }
    if (!div.childNodes.length) div.textContent = '\u00a0';
    return div;
  }
  function spoken(s) {
    const w = s.widget;
    const lineText = (segs) => segs.map((part) => part.t).join('').trim();
    const lines = renderWidget(s, w).map(lineText).filter(Boolean);
    const active = lines.find((text) => text.startsWith('>'));
    return [lines[0], active].filter(Boolean).join('. ');
  }
  function syncSpinner(s) {
    const w = s.widget;
    const spinning = w.type === 'thinking' || (w.type === 'checklist' && w.mode === 'thinking');
    if (spinning && !spinTimer) {
      spinTimer = setInterval(() => {
        current().widget.frame = (current().widget.frame || 0) + 1;
        render();
      }, 250);
    } else if (!spinning && spinTimer) {
      clearInterval(spinTimer);
      spinTimer = null;
    }
  }
  function render() {
    const s = current();
    screen.replaceChildren(...[...s.transcript, ...renderWidget(s, s.widget)].map(toLine));
    screen.scrollTop = screen.scrollHeight;
    const text = spoken(s);
    if (live.textContent !== text) live.textContent = text;
    syncSpinner(s);
  }

  function onKey(event) {
    if (event.isComposing) return;
    const s = current();
    const w = s.widget;
    if (event.key === 'PageUp' || event.key === 'PageDown') {
      event.preventDefault();
      screen.scrollBy({ top: (event.key === 'PageUp' ? -1 : 1) * screen.clientHeight * 0.8 });
      return;
    }
    if (event.ctrlKey && !event.altKey && !event.metaKey && (event.key === 'u' || event.key === 'Backspace')) {
      const input = inputOf(w);
      if (!input) return;
      event.preventDefault();
      input.set(event.key === 'u' ? '' : input.get().replace(/\S+\s*$/, ''));
      render();
      return;
    }
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (handlers[w.type](s, w, event.key)) {
      event.preventDefault();
      render();
      if (terminal.getBoundingClientRect().bottom > innerHeight) terminal.scrollIntoView({ block: 'nearest' });
    }
  }

  function switchConcept(next, focusTerminal) {
    concept = next;
    conceptButtons.forEach((button) => {
      const on = button.dataset.concept === next;
      button.setAttribute('aria-checked', String(on));
      button.tabIndex = on ? 0 : -1;
    });
    const url = new URL(location.href);
    url.searchParams.set('concept', next);
    history.replaceState(null, '', url);
    const existing = next === 'existing';
    terminal.hidden = existing;
    document.getElementById('dob-note').hidden = existing;
    document.getElementById('existing-panel').hidden = !existing;
    if (existing) {
      if (focusTerminal) {
        const target = document.getElementById('resource-filter') || document.getElementById('container-name')
          || document.getElementById('resource-options') || document.getElementById('back-button');
        target.focus({ preventScroll: true });
      }
      return;
    }
    render();
    if (focusTerminal) terminal.focus({ preventScroll: true });
  }

  document.addEventListener('keydown', (event) => {
    if (concept === 'existing') return;
    const target = document.activeElement;
    if (target !== terminal && target !== document.body && target !== null) return;
    if (target !== terminal) terminal.focus({ preventScroll: true });
    onKey(event);
  });
  terminal.addEventListener('paste', (event) => {
    const input = inputOf(current().widget);
    const text = event.clipboardData ? event.clipboardData.getData('text') : '';
    if (!input || !text) return;
    event.preventDefault();
    input.set(input.get() + text.replace(/\s+/g, ' '));
    render();
  });
  conceptButtons.forEach((button) => button.addEventListener('click', () => switchConcept(button.dataset.concept, true)));
  document.querySelector('.concepts').addEventListener('keydown', (event) => {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
    event.preventDefault();
    const next = concepts[move(concepts.indexOf(concept), ['ArrowRight', 'ArrowDown'].includes(event.key) ? 1 : -1, concepts.length)];
    switchConcept(next, false);
    conceptButtons[concepts.indexOf(next)].focus();
  });
  restart.addEventListener('click', () => {
    states[concept] = fresh(concept);
    render();
    terminal.focus({ preventScroll: true });
  });

  switchConcept(concept, false);
  if (concept !== 'existing') terminal.focus({ preventScroll: true });
})();
