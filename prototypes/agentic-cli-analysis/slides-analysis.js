/* Deck: AI CLI Competitive Analysis */
window.SLIDES = [

{
  section: "Intro", title: "Title", sub: "Competitive Analysis",
  html: `
  <div class="title-slide">
    <div class="kicker">Competitive analysis &middot; ${new Date().getFullYear()}</div>
    <h1>AI CLI<br>Competitive Analysis</h1>
    <p class="subtitle">How today's leading AI CLIs differ — in concept and in the micro-decisions of UX.</p>
    <div class="title-terminal">
      <div class="term">
        <div class="term-bar"><span class="dot r"></span><span class="dot y"></span><span class="dot g"></span><span class="term-title">~/analysis/ai-cli</span></div>
        <div class="term-body"><span class="prompt">$</span> <span class="cmd">compare copilot claude codex gemini aider</span>
<span class="out">Analyzing UX, concept &amp; trust models…</span>
<span class="ok">✓ 6 products</span>  <span class="ok">✓ UX matrix</span>  <span class="ok">✓ case studies</span><span class="cursor"></span></div>
      </div>
    </div>
    <div class="byline">6 products &middot; navigate with → or Space &middot; see also: the Design Guideline deck</div>
  </div>`
},

{
  section: "Analysis", title: "The landscape", sub: "The players",
  html: `
  <div class="kicker">The landscape</div>
  <h2>Six tools, three philosophies</h2>
  <div class="cols cols-3 tight">
    <div class="card"><div class="prod-head"><div class="prod-logo logo-copilot">Co</div><div><b>GitHub Copilot CLI</b><div class="dim mono" style="font-size:.72rem;">GitHub / Microsoft</div></div></div><p>Integrated, guardrailed, GitHub-native assistant.</p></div>
    <div class="card"><div class="prod-head"><div class="prod-logo logo-claude">Cl</div><div><b>Claude Code</b><div class="dim mono" style="font-size:.72rem;">Anthropic</div></div></div><p>Autonomous, terminal-first agentic coder.</p></div>
    <div class="card"><div class="prod-head"><div class="prod-logo logo-codex">Cx</div><div><b>Codex CLI</b><div class="dim mono" style="font-size:.72rem;">OpenAI</div></div></div><p>Lean, open-source, keyboard-driven agent.</p></div>
    <div class="card"><div class="prod-head"><div class="prod-logo logo-gemini">Ge</div><div><b>Gemini CLI</b><div class="dim mono" style="font-size:.72rem;">Google</div></div></div><p>Open-source, huge context, generous free tier.</p></div>
    <div class="card"><div class="prod-head"><div class="prod-logo logo-aider">Ai</div><div><b>Aider</b><div class="dim mono" style="font-size:.72rem;">Open source</div></div></div><p>Git-native pair programmer, model-agnostic.</p></div>
    <div class="card"><div class="prod-head"><div class="prod-logo logo-cursor">Cu</div><div><b>Cursor CLI / others</b><div class="dim mono" style="font-size:.72rem;">Cursor, Warp…</div></div></div><p>IDE &amp; shell hybrids bringing agents everywhere.</p></div>
  </div>
  <div class="callout"><p>Three postures recur: <span class="accent">guardrailed &amp; integrated</span> (Copilot), <span class="accent-3">autonomous &amp; rich</span> (Claude), and <span class="accent-2">lean &amp; controllable</span> (Codex / Gemini / Aider).</p></div>
  <div class="footer-note">Note: this space moves fast; specifics reflect general behavior as of ${new Date().getFullYear()} and vary by version &amp; config.</div>`
},

{
  section: "Analysis", title: "GitHub Copilot CLI", sub: "Profile",
  html: `
  <div class="prod-head"><div class="prod-logo logo-copilot" style="width:44px;height:44px;">Co</div><div><div class="kicker" style="margin:0;">Product profile</div><h2 style="margin:.1rem 0 0;">GitHub Copilot CLI</h2></div></div>
  <div class="cols cols-2" style="margin-top:1.2rem;">
    <div>
      <h3 class="accent">Concept</h3>
      <p style="margin-bottom:1rem;">A <b>guardrailed teammate</b> that lives where your code &amp; PRs already are. Optimizes for trust, safety, and enterprise fit over raw autonomy.</p>
      <h3 class="accent-2">UX signature</h3>
      <ul class="clean">
        <li><b>Cautious by default</b> — confirms before running commands and edits.</li>
        <li><b>Deep GitHub context</b> — issues, PRs, repos, MCP tooling.</li>
        <li><b>Guided, higher-touch</b> — more color, prompts, and hand-holding.</li>
        <li><b>Double Ctrl-C to cancel</b> — deliberate friction to prevent accidental exits.</li>
      </ul>
    </div>
    <div>
      <ul class="clean" style="margin-bottom:1rem;">
        <li class="plus"><b>Strengths:</b> safety rails, GitHub integration, approachable for new agent users, enterprise governance.</li>
        <li class="minus"><b>Costs:</b> more friction; confirmation steps &amp; the two-tap cancel can slow power users.</li>
      </ul>
      <div class="term">
        <div class="term-bar"><span class="dot r"></span><span class="dot y"></span><span class="dot g"></span><span class="term-title">copilot</span></div>
        <div class="term-body"><span class="cyan">● Copilot</span> wants to run:
  <span class="cmd">npm test</span>
<span class="out">Allow?</span> <span class="ok">[y]</span> <span class="out">once</span>  <span class="warnc">[a]</span> <span class="out">always</span>  <span class="err">[n]</span>
<span class="dim">^C</span> <span class="out">(press again to exit)</span></div>
      </div>
    </div>
  </div>`
},

{
  section: "Analysis", title: "Claude Code", sub: "Profile",
  html: `
  <div class="prod-head"><div class="prod-logo logo-claude" style="width:44px;height:44px;">Cl</div><div><div class="kicker" style="margin:0;">Product profile</div><h2 style="margin:.1rem 0 0;">Claude Code</h2></div></div>
  <div class="cols cols-2" style="margin-top:1.2rem;">
    <div>
      <h3 class="accent">Concept</h3>
      <p style="margin-bottom:1rem;">An <b>autonomous senior engineer</b> in your terminal. Give a high-level goal; it plans and executes multi-file, multi-step work with a human-in-the-loop when risk rises.</p>
      <h3 class="accent-2">UX signature</h3>
      <ul class="clean">
        <li><b>Richest TUI</b> — plans, colored diffs, to-do lists, permission modes.</li>
        <li><b>Tunable autonomy</b> — from ask-each-step to "accept edits" to plan mode.</li>
        <li><b>Esc to interrupt / steer</b> — mid-run redirection is a core interaction.</li>
        <li><b>Strong agent identity</b> — <span class="mono">CLAUDE.md</span>, subagents, hooks, MCP.</li>
      </ul>
    </div>
    <div>
      <ul class="clean" style="margin-bottom:1rem;">
        <li class="plus"><b>Strengths:</b> best-in-class autonomy &amp; large-refactor capability, expressive control surface, mature extensibility.</li>
        <li class="minus"><b>Costs:</b> more on-screen furniture; the power &amp; option surface has a learning curve; can feel "busy" to minimalists.</li>
      </ul>
      <div class="term">
        <div class="term-bar"><span class="dot r"></span><span class="dot y"></span><span class="dot g"></span><span class="term-title">claude</span></div>
        <div class="term-body"><span class="purple">✻ Thinking…</span> <span class="dim">(esc to interrupt)</span>
<span class="ok">⏺ Update</span> <span class="cmd">auth.ts</span>
  <span class="ok">+ 12</span>  <span class="err">- 3</span>
<span class="out">Do you want to make this edit?</span>
 <span class="ok">❯ Yes</span>  <span class="warnc">Yes, and don't ask</span>  <span class="err">No</span></div>
      </div>
    </div>
  </div>`
},

{
  section: "Analysis", title: "Codex CLI", sub: "Profile",
  html: `
  <div class="prod-head"><div class="prod-logo logo-codex" style="width:44px;height:44px;">Cx</div><div><div class="kicker" style="margin:0;">Product profile</div><h2 style="margin:.1rem 0 0;">OpenAI Codex CLI</h2></div></div>
  <div class="cols cols-2" style="margin-top:1.2rem;">
    <div>
      <h3 class="accent">Concept</h3>
      <p style="margin-bottom:1rem;">A <b>lean, open-source, keyboard-driven agent</b> (Rust). Prioritizes speed, control, and sandboxed safety with minimal ceremony — built for developers who want to stay in flow.</p>
      <h3 class="accent-2">UX signature</h3>
      <ul class="clean">
        <li><b>Minimal &amp; fast</b> — sparse color, low chrome, terminal-purist feel.</li>
        <li><b>Single Ctrl-C cancels</b> — instant stop, matching shell muscle memory.</li>
        <li><b>Configurable approval modes</b> — suggest → auto-edit → full-auto in a sandbox.</li>
        <li><b>Advanced-dev ergonomics</b> — feels like a native Unix tool, not an app.</li>
      </ul>
    </div>
    <div>
      <ul class="clean" style="margin-bottom:1rem;">
        <li class="plus"><b>Strengths:</b> snappy, low-friction control, open source &amp; hackable, sandbox safety, clean for experts.</li>
        <li class="minus"><b>Costs:</b> sparser hand-holding &amp; less visual guidance can be intimidating for newcomers.</li>
      </ul>
      <div class="term">
        <div class="term-bar"><span class="dot r"></span><span class="dot y"></span><span class="dot g"></span><span class="term-title">codex</span></div>
        <div class="term-body"><span class="prompt">›</span> <span class="cmd">refactor the parser</span>
<span class="out">edited</span> parser.rs <span class="dim">(+40 -18)</span>
<span class="out">running</span> cargo test… <span class="ok">ok</span>
<span class="dim">^C</span> <span class="out">stopped.</span></div>
      </div>
    </div>
  </div>`
},

{
  section: "Analysis", title: "Gemini / Aider / others", sub: "Profile",
  html: `
  <div class="kicker">Product profile</div>
  <h2>The challengers</h2>
  <div class="cols cols-3">
    <div class="card">
      <div class="prod-head"><div class="prod-logo logo-gemini">Ge</div><b>Gemini CLI</b></div>
      <ul class="clean">
        <li><b>Concept:</b> open-source, massive context window, generous free tier.</li>
        <li>Single Ctrl-C to cancel; ReAct-style loop; MCP support.</li>
        <li class="plus">Great value &amp; context for large repos.</li>
        <li class="minus">Younger ecosystem; polish still catching up.</li>
      </ul>
    </div>
    <div class="card">
      <div class="prod-head"><div class="prod-logo logo-aider">Ai</div><b>Aider</b></div>
      <ul class="clean">
        <li><b>Concept:</b> git-native pair programmer, model-agnostic.</li>
        <li>Auto-commits each change; diff-centric; scriptable.</li>
        <li class="plus">Transparent git history; BYO-model.</li>
        <li class="minus">Less "autonomous agent", more guided edits.</li>
      </ul>
    </div>
    <div class="card">
      <div class="prod-head"><div class="prod-logo logo-cursor">Cu</div><b>Cursor CLI / Warp</b></div>
      <ul class="clean">
        <li><b>Concept:</b> IDE/shell hybrids extending agents beyond the editor.</li>
        <li>Blend GUI affordances with terminal workflows.</li>
        <li class="plus">Familiar to IDE users; rich UI.</li>
        <li class="minus">Heavier; less "pure terminal".</li>
      </ul>
    </div>
  </div>`
},

{
  section: "Analysis", title: "UX matrix", sub: "Head-to-head",
  html: `
  <div class="kicker">Head-to-head</div>
  <h2>The UX comparison matrix</h2>
  <table class="tbl">
    <thead><tr><th>Trait</th><th>Copilot CLI</th><th>Claude Code</th><th>Codex CLI</th><th>Gemini CLI</th></tr></thead>
    <tbody>
      <tr><td>Posture</td><td>Guardrailed</td><td>Autonomous</td><td>Lean / control</td><td>Open / value</td></tr>
      <tr><td>Cancel</td><td><span class="pill mid">Ctrl-C ×2</span></td><td><span class="pill good">Esc / Ctrl-C</span></td><td><span class="pill good">Ctrl-C ×1</span></td><td><span class="pill good">Ctrl-C ×1</span></td></tr>
      <tr><td>Visual density</td><td>Higher color</td><td>Rich TUI</td><td>Minimal</td><td>Medium</td></tr>
      <tr><td>Default autonomy</td><td>Low (asks)</td><td>Med–High</td><td>Configurable</td><td>Medium</td></tr>
      <tr><td>Approval model</td><td>Per-action</td><td>Tiered modes</td><td>3 sandbox modes</td><td>Per-action</td></tr>
      <tr><td>Best-fit user</td><td>Teams / new</td><td>Power / big tasks</td><td>Experts / flow</td><td>Value / large ctx</td></tr>
      <tr><td>Ecosystem</td><td>GitHub-native</td><td>Deep (MCP, hooks)</td><td>Open source</td><td>Open source</td></tr>
    </tbody>
  </table>
  <div class="footer-note">Behavior varies by version &amp; configuration; treat as directional, not absolute.</div>`
},

{
  section: "Analysis", title: "Case study: cancel", sub: "A small but visible difference",
  html: `
  <div class="kicker">Micro-UX case study</div>
  <h2>Cancel works differently across AI CLIs</h2>
  <div class="cols cols-2">
    <div>
      <div class="term" style="margin-bottom:1rem;">
        <div class="term-bar"><span class="dot r"></span><span class="dot y"></span><span class="dot g"></span><span class="term-title">copilot — ×2</span></div>
        <div class="term-body"><span class="dim">^C</span> <span class="warnc">Press Ctrl+C again to exit</span>
<span class="dim">^C</span> <span class="err">exited.</span></div>
      </div>
      <div class="term">
        <div class="term-bar"><span class="dot r"></span><span class="dot y"></span><span class="dot g"></span><span class="term-title">codex — ×1</span></div>
        <div class="term-body"><span class="dim">^C</span> <span class="out">stopped.</span></div>
      </div>
    </div>
    <div>
      <p style="margin-bottom:1rem;">Same gesture, opposite bet:</p>
      <ul class="clean">
        <li><b class="accent">Copilot's double-tap</b> optimizes for <b>safety</b> — never lose a session by fat-fingering. Great for newcomers; friction for veterans.</li>
        <li><b class="accent-2">Codex's single-tap</b> optimizes for <b>flow &amp; muscle memory</b> — Ctrl-C means stop, like every other Unix tool. Great for experts; riskier for the careless.</li>
      </ul>
      <div class="callout"><p class="q">The difference is small but noticeable: one interaction protects against accidental exits, while the other prioritizes immediate cancellation.</p></div>
    </div>
  </div>`
},

{
  section: "Analysis", title: "Color & density", sub: "Spectrum",
  html: `
  <div class="kicker">Visual language</div>
  <h2>The color &amp; density spectrum</h2>
  <p class="lead" style="margin-bottom:1.6rem;">Less color &amp; chrome signals "for experts"; more signals "approachable". Neither is right — it's a positioning choice.</p>
  <div style="display:flex; align-items:center; gap:0; margin:1rem 0 1.4rem; font-family:var(--mono); font-size:.8rem;">
    <div style="flex:1; text-align:center;"><div class="accent-2">Minimal</div><div class="dim">expert-leaning</div></div>
    <div style="flex:3; height:8px; border-radius:6px; background:linear-gradient(90deg,#7ee787,#5ac8fa,#d2a8ff);"></div>
    <div style="flex:1; text-align:center;"><div class="accent-3">Rich</div><div class="dim">approachable</div></div>
  </div>
  <div class="cols cols-2 tight">
    <div class="card"><h3 class="accent-2">Codex &middot; sparse</h3><p>Low color, low chrome, Unix-native feel. Rewards fluency; assumes you know what you're doing.</p></div>
    <div class="card"><h3 class="accent">Gemini / Aider &middot; middle</h3><p>Purposeful color on diffs &amp; state, moderate structure. A balanced default.</p></div>
    <div class="card"><h3 class="accent-3">Claude &middot; rich TUI</h3><p>Plans, diffs, to-dos, spinners. Maximum legibility of the agent's mind; more on screen.</p></div>
    <div class="card"><h3 style="color:#2ea043;">Copilot &middot; guided</h3><p>Color + explicit prompts to build trust; leans approachable and safe.</p></div>
  </div>`
},

{
  section: "Analysis", title: "Concept differences", sub: "Beyond UX",
  html: `
  <div class="kicker">Beyond the surface</div>
  <h2>It's a concept difference, not just a skin</h2>
  <div class="cols cols-3">
    <div class="card hl"><h3 class="accent">Trust model</h3><p><b>Copilot:</b> trust via guardrails &amp; confirmation.<br><b>Claude:</b> trust via visibility + tunable autonomy.<br><b>Codex:</b> trust via sandboxing + user control.</p></div>
    <div class="card hl"><h3 class="accent-2">Unit of work</h3><p><b>Copilot:</b> assisted tasks in your GitHub flow.<br><b>Claude:</b> whole features / large refactors.<br><b>Codex:</b> fast, controllable edit loops.</p></div>
    <div class="card hl"><h3 class="accent-3">Where value lives</h3><p><b>Copilot:</b> integration &amp; governance.<br><b>Claude:</b> capability &amp; extensibility.<br><b>Codex:</b> speed, openness, control.</p></div>
  </div>
  <div class="callout"><p>Every UX micro-decision — cancel keys, color, prompts, autonomy defaults — is <span class="accent">downstream of the trust model</span>. Read the surface, infer the philosophy.</p></div>`
},

{
  section: "Analysis", title: "Who should use what", sub: "Fit guide",
  html: `
  <div class="kicker">Fit guide</div>
  <h2>Pick by user, not by hype</h2>
  <table class="tbl">
    <thead><tr><th>If you are…</th><th>You'll likely prefer…</th><th>Because…</th></tr></thead>
    <tbody>
      <tr><td class="prod">New to agents / on a team</td><td>GitHub Copilot CLI</td><td>Guardrails, GitHub context, and confirmations lower the risk of surprises.</td></tr>
      <tr><td class="prod">Doing large refactors / features</td><td>Claude Code</td><td>Strongest autonomy, richest control surface, deep extensibility.</td></tr>
      <tr><td class="prod">A terminal purist / power dev</td><td>Codex CLI</td><td>Minimal, fast, single-key cancel, open &amp; sandboxed.</td></tr>
      <tr><td class="prod">Cost-sensitive / huge codebase</td><td>Gemini CLI</td><td>Big context window and a generous free tier.</td></tr>
      <tr><td class="prod">Git-workflow devotee</td><td>Aider</td><td>Every change is a reviewable commit; bring your own model.</td></tr>
    </tbody>
  </table>
  <div class="footer-note">Most teams end up using more than one — the tools are increasingly interoperable via MCP.</div>`
},

{
  section: "Analysis", title: "Takeaways", sub: "What we learned",
  html: `
  <div class="kicker">Takeaways</div>
  <h2>Five things the market teaches us</h2>
  <div class="principles">
    <div class="principle"><div class="n">1</div><div><div class="b">Dual audience is the job</div><div class="s">Every winner serves human + agent from one core.</div></div></div>
    <div class="principle"><div class="n">2</div><div><div class="b">Micro-UX encodes philosophy</div><div class="s">Cancel keys &amp; color reveal the trust model.</div></div></div>
    <div class="principle"><div class="n">3</div><div><div class="b">Autonomy is a dial, not a default</div><div class="s">Let users choose ask ⇄ auto per context.</div></div></div>
    <div class="principle"><div class="n">4</div><div><div class="b">Restraint scales with expertise</div><div class="s">Less chrome reads as respect for power users.</div></div></div>
    <div class="principle"><div class="n">5</div><div><div class="b">Interoperability wins</div><div class="s">MCP &amp; stable contracts beat walled gardens.</div></div></div>
  </div>
  <div class="callout"><p>The best pattern <span class="accent">now</span>: an <b>agent-native core</b> with a <b>human-first, restrained, interruptible face</b> — and an autonomy dial the user controls.</p></div>`
},

{
  section: "Outro", title: "Close", sub: "End",
  html: `
  <div class="title-slide">
    <div class="kicker">Fin</div>
    <h1>Read the surface,<br><span class="accent">infer the philosophy.</span></h1>
    <p class="subtitle">Copilot bets on safety, Claude on capability, Codex on control. There's no universal winner — only the right fit for a given user and task.</p>
    <div class="title-terminal">
      <div class="term">
        <div class="term-bar"><span class="dot r"></span><span class="dot y"></span><span class="dot g"></span><span class="term-title">~/analysis/ai-cli</span></div>
        <div class="term-body"><span class="prompt">$</span> <span class="cmd">verdict --by user</span>
<span class="ok">✓ copilot=safe</span>  <span class="ok">✓ claude=capable</span>  <span class="ok">✓ codex=control</span><span class="cursor"></span></div>
      </div>
    </div>
    <div class="byline">Press O for overview &middot; see also: the Design Guideline deck</div>
  </div>`
}

];
