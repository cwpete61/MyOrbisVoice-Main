export type HelpStep = {
  title: string
  body: string
  /** Optional copy-paste template that auto-fills from tenant business data.
   *  Placeholders supported: [CLIENT BUSINESS NAME], [CLIENT WEBSITE URL],
   *  [CLIENT EMAIL], [CLIENT PHONE NUMBER], [CLIENT ADDRESS], [CLIENT TWILIO NUMBER].
   *  Anything in [BRACKETS] not in that list stays as a placeholder for the user. */
  template?: {
    label: string
    content: string
  }
  /** Optional one-click destination — usually a deep link into Twilio Console. */
  link?: {
    label: string
    href: string
  }
  /** Optional screenshot slots. If a PNG exists at /help-screenshots/<filename>,
   *  the renderer shows the image. Otherwise it shows a labeled placeholder box
   *  describing what the screenshot should show. This lets articles ship before
   *  screenshots are captured.
   *
   *  When `capture` is set, `pnpm capture-screenshots` (apps/e2e/src/scripts/
   *  capture-screenshots.ts) drives Puppeteer through the steps and writes the
   *  PNG to apps/web/public/help-screenshots/<filename>. Without `capture`,
   *  the screenshot must be taken manually. */
  screenshots?: Array<{
    filename: string
    caption: string
    capture?: ScreenshotCapture
  }>
}

/** Instructions for the automated screenshot-capture script.
 *  Each entry tells Puppeteer how to navigate to and frame the target view. */
export type ScreenshotCapture = {
  /** Path or absolute URL. Path-only values resolve against the
   *  app base URL (default https://app.myorbisvoice.com). */
  url: string
  /** Optional CSS selector — if set, screenshots only that element's
   *  bounding box. If unset, screenshots the visible viewport. */
  selector?: string
  /** Setup steps to run before the screenshot (clicks, typing, waits). */
  setup?: Array<
    | { action: 'click'; selector: string }
    | { action: 'type'; selector: string; value: string }
    | { action: 'wait'; selector?: string; ms?: number }
  >
  /** Whether to capture the full scrollable page rather than the viewport.
   *  Default false (viewport only — what the user actually sees). */
  fullPage?: boolean
  /** Override viewport size for this capture. Default 1280×800. */
  viewport?: { width: number; height: number }
  /** Auth context. 'tenant' = login as the test tenant; 'admin' = login as
   *  the platform admin. Default 'tenant'. 'public' = no auth. */
  authAs?: 'tenant' | 'admin' | 'public'
}

export type HelpArticle = {
  id: string
  title: string
  summary: string
  steps: HelpStep[]
  tips?: string[]
  warnings?: string[]
}

export type HelpSection = {
  id: string
  label: string
  icon: string
  articles: HelpArticle[]
}

export const HELP_CONTENT: HelpSection[] = [
  {
    id: 'getting-started',
    label: 'Getting Started',
    icon: 'M8 2a6 6 0 1 1 0 12A6 6 0 0 1 8 2zm0 4v4m0 2.5v.5',
    articles: [
      {
        id: 'gs-overview',
        title: 'Platform Overview',
        summary: 'Understand how OrbisVoice works and what each part of the platform does.',
        steps: [
          { title: 'What is OrbisVoice?', body: 'OrbisVoice is a multi-channel AI voice automation platform. It puts an intelligent voice agent on your website widget, your phone line, and your outbound calling campaigns — all configured from one dashboard.' },
          { title: 'The three channels', body: 'Widget: a voice chat bubble on your website that visitors can speak to in real time. Inbound: your business phone number answered 24/7 by an AI agent. Outbound: automated calling campaigns that reach your contacts list with a script and goal.' },
          { title: 'How the agent gets its knowledge', body: 'Your agent\'s behavior is built from layers: (1) your Business DNA — your company facts, services, and rules; (2) your Master Prompt — the agent\'s personality and goals; (3) channel overlays — how the agent behaves specifically on widget vs phone; (4) session context — live data like time of day, caller details, and booking availability.' },
          { title: 'Typical setup order', body: 'Most customers follow this order: fill in Business DNA → write or refine the Master Prompt → configure Agents → enable and configure Channels → connect Google (for bookings) → connect Twilio (for phone) → test with Agent Studio → go live.' },
        ],
        tips: [
          'You don\'t have to complete everything at once. The widget works before you connect Twilio.',
          'Use Agent Studio to test your voice agent\'s responses before going live.',
        ],
      },
      {
        id: 'gs-first-steps',
        title: 'First-Time Setup Checklist',
        summary: 'The minimum steps needed before your first live call.',
        steps: [
          { title: 'Step 1 — Fill in Business DNA', body: 'Go to Business DNA in the sidebar. Complete at minimum: your business name, industry, primary service, operating hours, and one escalation condition. Publish the draft when ready.', screenshots: [{ filename: 'nav-business-dna.png', caption: 'Sidebar \'Business DNA\' link highlighted, in the Configure section' }] },
          { title: 'Step 2 — Write your Master Prompt', body: 'Go to Prompts. Create a new prompt with scope "Master". Describe your agent\'s persona, tone, and primary goal in plain language. Publish it.', screenshots: [{ filename: 'nav-prompts.png', caption: 'Sidebar \'Prompts\' link highlighted, in the Configure section' }] },
          { title: 'Step 3 — Enable at least one channel', body: 'Go to Channels. Enable the Widget channel. You don\'t need Twilio for this — it works over your browser.', screenshots: [{ filename: 'nav-channels.png', caption: 'Sidebar \'Channels\' link highlighted; channels page showing the Widget toggle in the off position', capture: { url: '/channels', authAs: 'tenant', viewport: { width: 1280, height: 800 } } }] },
          { title: 'Step 4 — Test in Agent Studio', body: 'Go to Agent Studio. Select the Widget tab. Pick a voice. Click "Start Test" and speak to your agent. Check that responses match your Business DNA.', screenshots: [{ filename: 'nav-agent-studio.png', caption: 'Sidebar \'Agent Studio\' link, plus the Agent Studio page with the \'Start Test\' button visible' }] },
          { title: 'Step 5 — Embed the widget', body: 'Go to Channels → Widget. Copy the embed snippet and paste it into the <head> of your website.', screenshots: [{ filename: 'channels-widget-embed-snippet.png', caption: 'Channels page with the Widget card expanded and the \'Copy Embed Code\' button visible' }] },
        ],
        tips: ['You can complete steps 1–4 and test fully without any external API keys.'],
        warnings: ['Do not paste the embed snippet before you have tested in Agent Studio — live visitors will hear an unconfigured agent.'],
      },
    ],
  },
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: 'M2 2h5v5H2zM9 2h5v5H9zM2 9h5v5H2zM9 9h5v5H9z',
    articles: [
      {
        id: 'dash-overview',
        title: 'Reading Your Dashboard',
        summary: 'What each metric on the dashboard means and how to use it.',
        steps: [
          { title: 'Conversations count', body: 'Shows the total number of voice sessions in the selected period — widget chats, inbound calls, and outbound call attempts combined. A session is created the moment a caller connects, even if the call is very short.', screenshots: [{ filename: 'dashboard-overview.png', caption: 'Full dashboard view showing the Conversations count, channel status, and active agents widgets' }] },
          { title: 'Completed vs Missed', body: '"Completed" means the conversation reached a natural close — the agent said goodbye or the caller hung up after a full exchange. "Missed" means the call connected but the agent could not answer (e.g. gateway was down) or the call dropped within the first 5 seconds.' },
          { title: 'Active agents', body: 'Shows how many of your 7 agent roles are currently enabled. An agent role must be enabled before the prompt stack includes its behavior.' },
          { title: 'Channel status indicators', body: 'Each enabled channel shows a green dot. A yellow dot means the channel is enabled but has a configuration issue (e.g. Twilio disconnected). Red means the channel is disabled.' },
          { title: 'Changing the date range', body: 'Use the period selector (top right of the stats area) to switch between Today, Last 7 Days, Last 30 Days, and This Month. All metrics update simultaneously.', screenshots: [{ filename: 'dashboard-period-selector.png', caption: 'Top-right of the dashboard stats area showing the period selector dropdown (Today / Last 7 / 30 / This Month)' }] },
        ],
        tips: ['Check the dashboard after every prompt change to see if conversation completion rates improve.'],
      },
    ],
  },
  {
    id: 'business-dna',
    label: 'Business DNA',
    icon: 'M8 2a6 6 0 1 1 0 12A6 6 0 0 1 8 2zm0 0v2m0 8v2M2 8h2m8 0h2',
    articles: [
      {
        id: 'dna-what',
        title: 'What Is Business DNA?',
        summary: 'Business DNA is the knowledge base your agent uses to answer questions about your business.',
        steps: [
          { title: 'Purpose of Business DNA', body: 'Business DNA is a structured document that tells your agent everything it needs to know about your business: who you are, what you sell, your prices, your hours, your policies, and when to escalate to a human. Without it, your agent will give generic answers.' },
          { title: 'How it feeds the agent', body: 'Every time a visitor starts a conversation, the current published Business DNA is injected into the agent\'s context. The agent reads it before the conversation begins, so your facts are always available.' },
          { title: 'Versioning', body: 'OrbisVoice keeps a full history of your Business DNA drafts. You can have one active version at a time. Old versions are preserved so you can review or revert.' },
        ],
      },
      {
        id: 'dna-editing',
        title: 'Writing and Publishing Business DNA',
        summary: 'Step-by-step guide to filling in your Business DNA and making it live.',
        steps: [
          { title: 'Open the editor', body: 'Click Business DNA in the sidebar. You\'ll see a tabbed editor with sections: Identity, Services, Pricing, Hours, Rules, Escalation, Compliance, and Language.', screenshots: [{ filename: 'dna-editor-tabs.png', caption: 'Business DNA editor with the section tabs along the top (Identity, Services, Pricing, Hours, Rules, Escalation, Compliance, Language)' }] },
          { title: 'Identity section', body: 'Fill in your business name, tagline, industry, and a short description of what your business does. This is read first by the agent and sets the context for every response.', screenshots: [{ filename: 'dna-identity-section.png', caption: 'DNA editor with Identity tab active, showing the business name, tagline, industry, and description fields' }] },
          { title: 'Services section', body: 'List each service or product you offer. For each one, include: the name, a 1–2 sentence description, who it\'s for, and any key differentiator. Be specific — vague descriptions produce vague agent answers.', screenshots: [{ filename: 'dna-services-section.png', caption: 'DNA editor Services tab with multiple service rows, each with name/description/who-it-is-for fields' }] },
          { title: 'Pricing section', body: 'Add your pricing information. You can use ranges (e.g. "$500–$1,500 depending on scope") if exact prices vary. If pricing is quote-only, say so and include how to request a quote.' },
          { title: 'Hours section', body: 'Set your operating hours per day of week. Also set your timezone. The agent uses this to tell callers when you\'re open and to determine after-hours behavior.', screenshots: [{ filename: 'dna-hours-section.png', caption: 'DNA editor Hours tab showing per-day-of-week hour rows and the timezone dropdown' }] },
          { title: 'Rules section', body: 'List any business rules the agent must follow. Examples: "Always ask for the caller\'s name before helping", "Never quote prices for enterprise contracts — always transfer to sales", "Only book appointments on Tuesdays and Thursdays".' },
          { title: 'Escalation section', body: 'Define the conditions under which the agent must transfer a caller to a human. Examples: angry caller, legal question, billing dispute, contract negotiation. Be explicit — the agent will only escalate on conditions you list here.' },
          { title: 'Language and compliance', body: 'List any words or phrases the agent must never say (prohibited language), any compliance disclaimers it must include, and whether it should use formal or casual language.' },
          { title: 'Save the draft', body: 'Click "Save Draft" at any time. The draft is not live — it\'s saved to your account but the active agent still uses the previously published version.', screenshots: [{ filename: 'dna-save-draft-button.png', caption: 'Bottom-right of the DNA editor showing the \'Save Draft\' button' }] },
          { title: 'Publish', body: 'When you\'re satisfied with your draft, click "Publish". A confirmation dialog will appear. Once confirmed, this version becomes the active Business DNA immediately — all new conversations use it.', screenshots: [{ filename: 'dna-publish-button.png', caption: 'Bottom-right of the DNA editor showing the teal \'Publish\' button next to \'Save Draft\'' }, { filename: 'dna-publish-confirm-dialog.png', caption: 'Modal dialog asking \'Publish this version of Business DNA?\' with confirm/cancel buttons' }] },
        ],
        tips: [
          'Write your services section as if explaining to a well-informed but new receptionist.',
          'The more specific your escalation conditions, the fewer unnecessary transfers you get.',
          'Test your agent in Agent Studio after every publish to verify the new information is reflected in responses.',
        ],
        warnings: [
          'Publishing immediately affects all active channels. If you\'re making major changes, test in Agent Studio first.',
          'Leaving the Services or Hours section empty will cause the agent to say it doesn\'t have that information.',
        ],
      },
    ],
  },
  {
    id: 'prompts',
    label: 'Prompts',
    icon: 'M4 6h8M4 10h5M2 3h12a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z',
    articles: [
      {
        id: 'prompts-overview',
        title: 'Understanding the Prompt System',
        summary: 'OrbisVoice uses a layered prompt system. Learn what each layer does and when to use each one.',
        steps: [
          { title: 'What is a prompt?', body: 'A prompt is a set of instructions written in plain English that tells the AI agent how to behave. It\'s different from Business DNA — DNA is facts about your business, prompts are instructions about behavior and personality.' },
          { title: 'Layer 1 — Platform prompt (hidden)', body: 'This is set by OrbisVoice and cannot be edited. It handles safety, format requirements, and baseline behavior. You never see or edit this layer.' },
          { title: 'Layer 2 — Master prompt (you write this)', body: 'This is the most important prompt you control. It sets the agent\'s name, personality, primary goal, communication style, and general behavior rules. Every conversation uses this layer regardless of channel.' },
          { title: 'Layer 3 — Channel overlay', body: 'Optional prompts that adjust behavior per channel. Example: your widget agent might be friendlier and more conversational, while your inbound phone agent is more efficient and direct. You create separate prompts with scope "Widget", "Inbound", or "Outbound".' },
          { title: 'Layer 4 — Role overlay', body: 'Optional prompts tied to specific agent roles (Appointment, Sales, etc.). These add role-specific behavior on top of the master prompt.' },
          { title: 'How layers combine', body: 'At the start of every conversation, the system assembles all active layers in order: Platform → Master → Channel → Role → Session context. The agent sees them all as one unified set of instructions.' },
        ],
        tips: ['Start with just a Master prompt. Add channel overlays only once you notice channel-specific behavior you want to adjust.'],
      },
      {
        id: 'prompts-writing',
        title: 'Writing an Effective Master Prompt',
        summary: 'What to include in your Master Prompt and how to phrase it for best results.',
        steps: [
          { title: 'Give the agent a name and role', body: 'Start with: "Your name is [Name]. You are a voice assistant for [Business Name]. Your primary role is [role]." Example: "Your name is Alex. You are a voice assistant for Bright Dental. Your primary role is to help callers book appointments and answer questions about our services."' },
          { title: 'Define the tone and style', body: 'Tell the agent how to speak. Example: "Speak in a warm, professional tone. Use short sentences — this is a voice conversation, not a written response. Never use bullet points or numbered lists in your speech. Avoid filler phrases like \'Certainly!\' or \'Absolutely!\'."' },
          { title: 'State the primary goal', body: 'Tell the agent what a successful conversation looks like. Example: "Your primary goal is to book a consultation appointment. Always try to move the conversation toward booking before ending the call."' },
          { title: 'Define what the agent cannot do', body: 'List explicit limits. Example: "Do not discuss competitor pricing. Do not make promises about outcomes or timelines. Do not give medical advice. If asked about anything outside dental services, politely redirect."' },
          { title: 'Set response length expectations', body: 'Voice responses should be short. Add: "Keep each response to 2–3 sentences maximum unless the caller asks a complex question. Ask one question at a time."' },
          { title: 'Define the greeting', body: 'Tell the agent how to open. Example: "When a conversation begins, greet the caller with: \'Hi, you\'ve reached Bright Dental. I\'m Alex, your virtual assistant. How can I help you today?\'"' },
          { title: 'Save and publish', body: 'Click Save Draft, review it, then click Publish. The prompt becomes active immediately for all new conversations.' },
        ],
        tips: [
          'Write the prompt in second person ("You are...") not third person ("The assistant is...").',
          'Read the prompt aloud — if it sounds awkward spoken, the agent\'s responses will too.',
          'Keep the master prompt under 500 words. Longer prompts can cause the agent to lose focus.',
        ],
        warnings: [
          'Never paste sensitive information (passwords, API keys, personal data) into a prompt.',
          'Publishing a new prompt immediately affects live conversations — always test in Agent Studio first.',
        ],
      },
      {
        id: 'prompts-manage',
        title: 'Managing Prompt Versions',
        summary: 'How to create, edit, publish, and revert prompts.',
        steps: [
          { title: 'Creating a new prompt', body: 'Click the "+ New Prompt" button. Select a scope (Master, Widget, Inbound, Outbound, or Role). Give it a name you\'ll recognize (e.g. "Master — Booking Focus v2"). Write the content and save as a draft.', screenshots: [{ filename: 'prompts-new-button.png', caption: 'Prompts page top-right with the \'+ New Prompt\' button' }, { filename: 'prompts-scope-dropdown.png', caption: 'Prompt creation modal with the Scope dropdown open showing Master/Widget/Inbound/Outbound/Role options' }] },
          { title: 'Only one prompt per scope can be active', body: 'You can have multiple drafts for each scope, but only one published (active) prompt per scope at any time. Publishing a new prompt automatically archives the previous one.' },
          { title: 'Viewing version history', body: 'Click on any prompt to open it. Use the "History" tab to see all previous versions with timestamps. You can view the full content of any historical version.', screenshots: [{ filename: 'prompts-history-tab.png', caption: 'Prompt detail view with the \'History\' tab selected, showing previous versions with timestamps' }] },
          { title: 'Reverting to a previous version', body: 'Open a previous version from the History tab. Click "Restore this version" to create a new draft pre-filled with that version\'s content. Review and republish when ready.', screenshots: [{ filename: 'prompts-restore-version-button.png', caption: 'A historical prompt version with the \'Restore this version\' button visible' }] },
        ],
      },
    ],
  },
  {
    id: 'agents',
    label: 'Agents',
    icon: 'M8 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm-5 6a5 5 0 0 1 10 0',
    articles: [
      {
        id: 'agents-roles',
        title: 'The 7 Agent Roles Explained',
        summary: 'What each role does and when to enable it.',
        steps: [
          { title: 'Orchestrator', body: 'The Orchestrator coordinates all other agents. It decides which specialist agent should handle a given part of the conversation. Enable this if you have multiple roles active — it improves handoff logic between them. If you only use one role, you don\'t need the Orchestrator.' },
          { title: 'Appointment Agent', body: 'Handles booking, rescheduling, and cancellation of appointments. Requires Google Calendar to be connected. Enable this if appointment booking is a goal of your agent.' },
          { title: 'Sales Agent', body: 'Focused on qualifying leads, presenting offers, and moving callers toward a purchase decision. Enable this if you want the agent to actively sell rather than just inform.' },
          { title: 'Customer Service Agent', body: 'Handles support requests, complaints, FAQs, and account questions. Best for businesses with a high volume of repeat callers asking the same questions.' },
          { title: 'Marketing Agent', body: 'Delivers promotional messages, captures lead information, and promotes offers. Useful for outbound campaigns where the goal is awareness or lead capture.' },
          { title: 'Assistant Agent', body: 'A general-purpose helper role. Good for businesses that need a flexible agent that can handle a variety of tasks without a specific sales or service focus.' },
          { title: 'Secretary Agent', body: 'Focused on administrative tasks: taking messages, providing information, routing callers, and managing schedules. Best for professional services like law firms or medical practices.' },
        ],
        tips: [
          'Start with one role that matches your primary use case. Add more only if conversations reveal gaps.',
          'The Appointment agent should always be enabled alongside any other role if booking is part of your service.',
        ],
      },
      {
        id: 'agents-configure',
        title: 'Configuring an Agent Role',
        summary: 'How to enable, configure, and bind a prompt to an agent role.',
        steps: [
          { title: 'Open an agent role', body: 'Go to Agents in the sidebar. You\'ll see cards for each of the 7 roles. Click any card to expand its configuration.', screenshots: [{ filename: 'agents-page-grid.png', caption: 'Agents page showing the 7 role cards (Orchestrator, Appointment, Sales, Customer Service, Marketing, Assistant, Secretary)' }] },
          { title: 'Enable the role', body: 'Toggle the "Enabled" switch at the top of the card. Disabled roles are completely inactive — they don\'t affect conversations at all.', screenshots: [{ filename: 'agents-enable-toggle.png', caption: 'Agent role card expanded with the \'Enabled\' toggle in the top-right' }] },
          { title: 'Bind a prompt', body: 'Use the "Role Prompt" dropdown to select a published prompt with matching scope. If you haven\'t created a role-specific prompt yet, the agent uses only the master prompt — which is fine for most use cases.', screenshots: [{ filename: 'agents-prompt-dropdown.png', caption: 'Agent role configuration showing the \'Role Prompt\' dropdown with available published prompts listed' }] },
          { title: 'Set allowed actions', body: 'Check the actions this role is permitted to take. Example: the Appointment agent can be allowed to "Create appointment", "Check availability", and "Send confirmation". Actions not checked here will be refused even if the caller requests them.' },
          { title: 'Set handoff rules', body: 'Define when this agent should hand off to another agent or a human. Example: "Hand off to human if caller expresses frustration more than twice" or "Hand off to Sales agent if caller asks about pricing".' },
          { title: 'Save', body: 'Click Save. Changes take effect on the next new conversation — existing live sessions are not interrupted.', screenshots: [{ filename: 'agents-save-button.png', caption: 'Bottom of agent role card showing the Save button' }] },
        ],
        warnings: ['Disabling the only active role will leave the agent with no role behavior — it will fall back to the master prompt only.'],
      },
    ],
  },
  {
    id: 'agent-studio',
    label: 'Agent Studio',
    icon: 'M8 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm4.5-7.5l1.5 1.5M3.5 11.5l1.5 1.5M12 8h2M2 8H0M8 2V0M8 14v2',
    articles: [
      {
        id: 'studio-overview',
        title: 'Testing Your Agent in Agent Studio',
        summary: 'How to use Agent Studio to test voice, avatar, and agent behavior before going live.',
        steps: [
          { title: 'What Agent Studio is for', body: 'Agent Studio lets you have a real voice conversation with your agent before any customer does. It uses your live Business DNA and published prompts — so what you hear here is exactly what a real visitor or caller would experience.' },
          { title: 'Select a channel tab', body: 'At the top of Agent Studio you\'ll see three tabs: Widget, Inbound, and Outbound. Select the channel you want to test. Each channel may behave differently based on its channel overlay prompt.', screenshots: [{ filename: 'studio-channel-tabs.png', caption: 'Agent Studio top with the three channel tabs (Widget / Inbound / Outbound), Widget tab active' }] },
          { title: 'Widget tab — voice and avatar', body: 'The Widget tab lets you pick an avatar (the face shown in the chat widget) and a voice. Select a female or male avatar from the grid, then choose a voice from the dropdown. These settings are specific to the widget.', screenshots: [{ filename: 'studio-avatar-grid.png', caption: 'Widget tab showing the female/male avatar selection grid' }, { filename: 'studio-voice-dropdown.png', caption: 'Widget tab voice picker dropdown open, listing the 7 voices (Zephyr, Despina, Aoede, Charon, Fenrir, Puck, Sulafat)' }] },
          { title: 'Inbound and Outbound tabs — voice only', body: 'Phone channels don\'t show an avatar, so these tabs show only the voice picker and the live test panel.' },
          { title: 'Starting a test', body: 'Click "Start Test". The system creates a temporary session using your current configuration. Wait for the agent to greet you — this is your signal that the connection is ready.', screenshots: [{ filename: 'studio-start-test-button.png', caption: 'Agent Studio with the \'Start Test\' button highlighted' }] },
          { title: 'Speaking to the agent', body: 'Click "Speak" (the microphone button) to start talking. Speak naturally. When you stop speaking, click "Stop mic" — this signals the agent to respond immediately without waiting for a silence timeout.', screenshots: [{ filename: 'studio-mic-controls.png', caption: 'Active test session showing Speak / Stop mic / End buttons with the live waveform indicator' }] },
          { title: 'Ending the test', body: 'Click "End" to close the test session. The session is not saved to your conversation history.' },
          { title: 'Saving voice and avatar settings', body: 'After you find a voice and avatar combination you\'re happy with, click "Save Settings" on the Widget tab. This applies those settings to the live widget.', screenshots: [{ filename: 'studio-save-settings-button.png', caption: 'Widget tab bottom showing the \'Save Settings\' button after a voice + avatar are selected' }] },
        ],
        tips: [
          'Test after every Business DNA publish or prompt change.',
          'Try asking edge-case questions that real customers might ask to see how the agent handles them.',
          'If the agent gives a wrong answer, fix it in Business DNA — not in the prompt.',
        ],
        warnings: ['Agent Studio sessions use a real Gemini Live connection. Each test consumes a small amount of your voice quota.'],
      },
      {
        id: 'studio-voices',
        title: 'Choosing the Right Voice',
        summary: 'Overview of the 7 available voices and how to pick the right one for your brand.',
        steps: [
          { title: 'Zephyr (Female)', body: 'Bright, clear, energetic. Best for: tech companies, modern retail, startups. Tone: confident and upbeat.' },
          { title: 'Despina (Female)', body: 'Smooth, polished, authoritative. Best for: professional services, finance, legal. Tone: composed and credible.' },
          { title: 'Aoede (Female)', body: 'Warm, breezy, approachable. Best for: wellness, hospitality, lifestyle brands. Tone: friendly and inviting.' },
          { title: 'Charon (Male)', body: 'Deep, authoritative, measured. Best for: enterprise, security, financial services. Tone: commanding and trustworthy.' },
          { title: 'Fenrir (Male — default)', body: 'Warm, approachable, natural. Best for: general business, customer service. Tone: friendly and professional.' },
          { title: 'Puck (Male)', body: 'Upbeat, conversational, casual. Best for: consumer brands, e-commerce, younger audiences. Tone: energetic and personable.' },
          { title: 'Sulafat (Neutral)', body: 'Warm, even, balanced. Best for: healthcare, education, non-profits. Tone: calm and inclusive.' },
          { title: 'How to choose', body: 'Pick the voice that matches your brand\'s written tone. If your website copy is formal and authoritative, choose Despina or Charon. If your brand is friendly and casual, choose Fenrir, Puck, or Aoede. When in doubt, test with a real colleague before going live.' },
        ],
      },
    ],
  },
  {
    id: 'channels',
    label: 'Channels',
    icon: 'M2 8a6 6 0 1 0 12 0A6 6 0 0 0 2 8zm6-2v4m-2-2h4',
    articles: [
      {
        id: 'channels-widget',
        title: 'Setting Up the Website Widget',
        summary: 'How to configure, customize, and embed the voice widget on your website.',
        steps: [
          { title: 'Enable the Widget channel', body: 'Go to Channels in the sidebar. Click the Widget card. Toggle "Enable Widget" to on. The widget is now active — but not yet on your website.', screenshots: [{ filename: 'channels-widget-enable-toggle.png', caption: 'Channels page Widget card with the \'Enable Widget\' toggle' }] },
          { title: 'Widget position', body: 'Choose whether the widget button appears in the bottom-right or bottom-left corner of your website. Most websites use bottom-right.', screenshots: [{ filename: 'channels-widget-position-dropdown.png', caption: 'Widget configuration showing the position dropdown (Bottom-Right / Bottom-Left)' }] },
          { title: 'Widget color', body: 'Set the widget button color to match your brand. Use a hex code or pick from the presets. This only affects the trigger button — the chat panel uses the OrbisVoice theme.', screenshots: [{ filename: 'channels-widget-color-picker.png', caption: 'Widget configuration showing the color picker / hex input field' }] },
          { title: 'Voice and avatar', body: 'Set the voice and avatar for the widget in Agent Studio (see Agent Studio section). The widget channel inherits whatever is saved there.' },
          { title: 'Copy the embed snippet', body: 'At the bottom of the Widget configuration, click "Copy Embed Code". You\'ll get a short <script> tag.', screenshots: [{ filename: 'channels-widget-copy-embed.png', caption: 'Widget configuration with the \'Copy Embed Code\' button at the bottom and the script tag preview' }] },
          { title: 'Paste into your website', body: 'Paste the script tag into the <head> section of every page where you want the widget to appear. Most website builders have a "Custom Code" or "Header Scripts" section in their settings. Common platforms: Wordpress → Appearance → Theme Editor → header.php. Webflow → Project Settings → Custom Code → Head Code. Squarespace → Settings → Advanced → Code Injection. Wix → Settings → Custom Code.' },
          { title: 'Verify the widget loads', body: 'Visit your website and look for the widget button in the corner. Click it to confirm the widget opens. Say "Hello" to check the agent responds.' },
        ],
        tips: [
          'Test the embed on a staging or preview version of your site before deploying to production.',
          'The widget loads asynchronously — it won\'t slow down your page load time.',
        ],
        warnings: ['If you change the widget settings after embedding, you don\'t need to re-embed — the snippet always loads the latest configuration.'],
      },
      {
        id: 'channels-inbound',
        title: 'Setting Up the Inbound Receptionist',
        summary: 'How to configure your AI phone receptionist to answer inbound calls.',
        steps: [
          { title: 'Prerequisites', body: 'Before enabling Inbound, you must: (1) connect Twilio in the Integrations section, (2) purchase or assign a phone number in Phone Numbers.' },
          { title: 'Enable Inbound channel', body: 'Go to Channels → Inbound. Toggle "Enable Inbound Receptionist" to on.', screenshots: [{ filename: 'channels-inbound-enable.png', caption: 'Channels page Inbound Receptionist card with the \'Enable\' toggle and webhook URL display' }] },
          { title: 'Set the inbound greeting', body: 'This is the first thing callers hear. Keep it short: "[Business name], [agent name] speaking, how can I help?" The agent then takes over the conversation.', screenshots: [{ filename: 'channels-inbound-greeting-field.png', caption: 'Inbound configuration with the greeting text field showing the greeting input' }] },
          { title: 'After-hours behavior', body: 'Set what happens when a caller calls outside your business hours (set in Business DNA). Options: (1) The agent still answers but informs the caller of hours and takes a message. (2) The caller hears a voicemail-style recording. (3) Forward to another number.', screenshots: [{ filename: 'channels-inbound-after-hours.png', caption: 'Inbound configuration showing the after-hours behavior options (agent answers / voicemail / forward)' }] },
          { title: 'Call forwarding / transfer', body: 'Set the phone number to forward to when the agent escalates a call to a human. This is the number a human staff member will receive on their phone when the agent decides to transfer.', screenshots: [{ filename: 'channels-inbound-forwarding-number.png', caption: 'Inbound configuration showing the forwarding-number field with E.164 format hint' }] },
          { title: 'Configure the Twilio webhook', body: 'In Twilio, set the voice webhook URL for your phone number to: https://api.myorbisvoice.com/api/webhooks/twilio/voice. This tells Twilio to send incoming calls to OrbisVoice.', screenshots: [{ filename: 'twilio-console-voice-webhook.png', caption: 'Twilio Console phone number configuration showing the \'A call comes in\' webhook URL field set to https://api.myorbisvoice.com/api/webhooks/twilio/voice' }] },
          { title: 'Test the inbound line', body: 'Call your Twilio phone number from a personal phone. You should hear the agent greet you within 2–3 seconds of the call connecting.' },
        ],
        warnings: [
          'The Twilio webhook URL must be set exactly — any typo means calls will not connect to the agent.',
          'Test the call transfer by asking to speak to a human. Confirm the call forwards correctly to your staff number.',
        ],
      },
      {
        id: 'channels-outbound',
        title: 'Setting Up the Outbound Caller',
        summary: 'How to configure your AI agent to make outbound calls as part of campaigns.',
        steps: [
          { title: 'Prerequisites', body: 'Outbound requires: (1) Twilio connected with outbound calling enabled, (2) at least one contact list in Contacts, (3) a Campaign created in Campaigns.' },
          { title: 'Enable Outbound channel', body: 'Go to Channels → Outbound. Toggle "Enable Outbound Caller" to on.', screenshots: [{ filename: 'channels-outbound-enable.png', caption: 'Channels page Outbound Caller card with the \'Enable\' toggle' }] },
          { title: 'Set caller ID', body: 'Choose which phone number appears on the recipient\'s phone when the agent calls them. This must be a Twilio number in your account.', screenshots: [{ filename: 'channels-outbound-caller-id.png', caption: 'Outbound configuration showing the caller-ID dropdown listing available Twilio numbers' }] },
          { title: 'Retry policy', body: 'Set how many times the agent should retry a number that doesn\'t answer or goes to voicemail. Recommended: 2 retries, 4 hours apart.', screenshots: [{ filename: 'channels-outbound-retry-policy.png', caption: 'Outbound configuration showing retry count and retry-interval fields' }] },
          { title: 'Voicemail detection', body: 'Enable voicemail detection. When a voicemail is detected, the agent can either: (1) hang up and mark as "left voicemail", (2) leave a pre-recorded voicemail message.' },
          { title: 'Creating and running a campaign', body: 'Go to Campaigns to create a calling campaign. See the Campaigns section of this help guide for full details.' },
        ],
      },
    ],
  },
  {
    id: 'integrations',
    label: 'Integrations',
    icon: 'M13 8a5 5 0 0 1-10 0M8 3v5m0 0-2-2m2 2 2-2',
    articles: [
      {
        id: 'integrations-google',
        title: 'Connecting Google (Calendar & Gmail)',
        summary: 'How to connect your Google account to enable appointment booking and email follow-ups.',
        steps: [
          { title: 'Why connect Google?', body: 'Connecting Google enables two things: (1) Calendar integration — the agent can check your real availability and book appointments directly into Google Calendar. (2) Gmail integration — the agent can send confirmation and follow-up emails from your connected mailbox.' },
          { title: 'Which Google account to connect', body: 'Connect the Google account that owns the calendar where appointments should be created. Ideally, use a dedicated business Google account (e.g. receptionist@yourbusiness.com) rather than a personal Gmail.' },
          { title: 'Start the connection', body: 'Go to Integrations in the sidebar. Click "Connect Google". You\'ll be redirected to Google\'s login page.', screenshots: [{ filename: 'integrations-google-connect-button.png', caption: 'Integrations page Google card showing the \'Connect Google\' button (NOT_CONNECTED state)' }] },
          { title: 'Authorize the permissions', body: 'Google will ask for two permissions: (1) View and manage your Google Calendar events. (2) Send email on your behalf. Both are required. Click "Allow".', screenshots: [{ filename: 'google-oauth-permissions-screen.png', caption: 'Google\'s OAuth consent screen showing the requested scopes (Calendar + Gmail)' }] },
          { title: 'Confirm the connection', body: 'You\'ll be redirected back to OrbisVoice. The Google card will show "Connected" with the email address of the connected account and the number of calendars found.', screenshots: [{ filename: 'integrations-google-connected-state.png', caption: 'Integrations page Google card now in the CONNECTED state, showing email + calendar count + last verified timestamp' }] },
          { title: 'Select the booking calendar', body: 'In the Integrations panel, select which of your calendars the agent should use for bookings. If you have multiple calendars, choose the one for business appointments.', screenshots: [{ filename: 'integrations-google-calendar-picker.png', caption: 'Google card showing the calendar dropdown listing available calendars' }] },
          { title: 'Test a booking', body: 'Go to Agent Studio and ask the agent to book an appointment. Check your Google Calendar to confirm the event was created.' },
        ],
        tips: [
          'If you manage multiple staff calendars, use a Google Workspace account with access to all calendars.',
          'The connection auto-refreshes — you only need to reconnect if you change your Google password or revoke access.',
        ],
        warnings: ['Do not connect a personal Gmail account shared with family. The agent will have access to send email from that address.'],
      },
      {
        id: 'integrations-twilio',
        title: 'Connecting Twilio',
        summary: 'How to connect Twilio to enable inbound and outbound phone calling.',
        steps: [
          { title: 'Create a Twilio account', body: 'If you don\'t have one, go to twilio.com and create an account. Verify your email and phone number. Add a payment method to upgrade from trial mode (trial numbers cannot make calls to unverified numbers).' },
          { title: 'Find your credentials', body: 'In the Twilio Console, go to the main dashboard. You\'ll see your Account SID and Auth Token. Copy both.', screenshots: [{ filename: 'twilio-console-account-credentials.png', caption: 'Twilio Console main dashboard showing where Account SID and Auth Token are displayed' }] },
          { title: 'Enter credentials in OrbisVoice', body: 'Go to Integrations → Twilio. Enter your Account SID and Auth Token in the fields provided. Click Save. The fields are write-only — once saved, the token is never displayed again.', screenshots: [{ filename: 'integrations-twilio-credentials-form.png', caption: 'OrbisVoice Integrations page Twilio card with Account SID / Auth Token / Phone Number input fields' }] },
          { title: 'Purchase a phone number', body: 'In Twilio\'s console, go to Phone Numbers → Buy a Number. Choose your country and a number type (Local or Toll-Free). Purchase the number.' },
          { title: 'Add the number in OrbisVoice', body: 'Go to Phone Numbers in the OrbisVoice sidebar. Click "Add Number". Enter the Twilio number in E.164 format (e.g. +14155551234). Assign it to the Inbound channel.', screenshots: [{ filename: 'phone-numbers-add-modal.png', caption: 'Phone Numbers page with the \'+ Add number\' modal open, showing the E.164 input field' }] },
          { title: 'Set the webhook in Twilio', body: 'In Twilio, go to Phone Numbers → Manage → your number. Set the "A call comes in" webhook to: https://api.myorbisvoice.com/api/webhooks/twilio/voice — HTTP POST.', screenshots: [{ filename: 'twilio-console-phone-number-config.png', caption: 'Twilio Console > Phone Numbers > Manage > active number, with the Voice webhook URL field' }] },
          { title: 'Test', body: 'Call your Twilio number. The agent should answer within 2–3 rings.' },
        ],
        warnings: [
          'Twilio trial accounts can only call verified numbers. Upgrade to a paid account before going live.',
          'Never share your Twilio Auth Token. It provides full access to your Twilio account.',
        ],
      },
      {
        id: 'integrations-twilio-approval',
        title: 'Twilio Carrier Approvals — Overview & Timeline',
        summary: 'Outbound calls and SMS require carrier approval before they will deliver. Read this overview first, then follow the linked detailed guides for each step.',
        steps: [
          { title: 'Why approvals exist', body: 'US carriers (Verizon, AT&T, T-Mobile) and federal regulators require all business voice and SMS senders to be verified. Without registration, outbound calls show as "Spam Likely" and SMS messages get silently dropped. Inbound calls do not require any of this — they work the moment you set the webhook URL.' },
          { title: 'The 6 phases of Twilio onboarding', body: 'Phase 1: Collect business info. Phase 2: Verify your website meets Twilio\'s requirements. Phase 3: Set up the Twilio account and Trust Hub. Phase 4: Submit A2P 10DLC Brand + Campaign for SMS, and Voice Integrity for outbound calls. Phase 5: Wait for approval (1–4 weeks). Phase 6: Connect approved numbers to OrbisVoice.' },
          { title: 'Realistic timeline', body: 'Inbound voice: same-day. Outbound voice (STIR/SHAKEN + CNAM): 1–5 days. SMS via 10DLC: Brand approval 1–2 days, Campaign approval 1–4 weeks (this is the slow step — driven by carrier review queues, not Twilio). Toll-free SMS: 2–5 days, faster than 10DLC but pricier per-message.' },
          { title: 'Cost overview', body: 'Brand registration: $4 one-time. Campaign: ~$10/month per campaign + $0.0025–$0.005 per SMS. Toll-free verification: free, but per-message cost is higher. CNAM caller-ID: ~$1.25/month per number. Voice Integrity is free.' },
          { title: 'What you need before starting', body: 'Read the next article ("Step 1: Business Information") to gather everything in advance. Trying to fill in Twilio forms while hunting for your EIN slows everyone down — collect the info first, paste it in once.', link: { label: 'Open: Step 1 — Business Information', href: '#integrations-twilio-business-info' } },
          { title: 'Quick path for inbound only', body: 'If you only need inbound calls (no outbound, no SMS), you can skip every approval. Buy a Twilio number, set its Voice webhook to https://api.myorbisvoice.com/api/webhooks/twilio/voice, connect to OrbisVoice. Done in 5 minutes. The rest of these articles only matter for outbound voice or SMS.' },
        ],
        tips: [
          'Start the 10DLC Brand registration the same day you buy your first Twilio number — the 1–4 week Campaign wait runs in parallel with everything else you set up.',
          'For testing while 10DLC is pending, register your own phone numbers as "verified caller IDs" in Twilio. Verified numbers can receive SMS without 10DLC.',
          'Outbound voice approval is much faster than SMS. If timeline matters, prioritize voice setup first.',
        ],
        warnings: [
          'Sending SMS without 10DLC registration → messages silently dropped by carriers. Twilio logs will show "delivered" but recipients never receive the text.',
          'Do not exaggerate SMS volume on campaign registration — under-declaring is fine, over-declaring triggers expensive higher-tier rates.',
          'Brand registration uses your business EIN. Sole proprietors with no EIN register as a sole-prop brand, which has stricter throughput limits.',
        ],
      },
      {
        id: 'integrations-twilio-business-info',
        title: 'Twilio Approval — Step 1: Business Information',
        summary: 'Collect this information before opening Twilio. Mismatches between what you submit and your public business records cause delays and rejections.',
        steps: [
          { title: 'Required information', body: 'You will need: Legal Business Name, DBA / Brand Name, EIN (Employer ID Number), Business Type (LLC, Corp, Sole Prop, etc.), Industry, Website URL, Business Address, Business Phone, Business Email, and an Authorized Representative (Name, Title, Email, Phone).' },
          { title: 'The "matching" rule (most important)', body: 'Twilio cross-references your submitted info against public records and IRS data. The Legal Business Name, EIN, address, and website MUST match what is on file with the IRS and your state business registration. A small mismatch (e.g. "Acme LLC" vs "Acme, LLC") can fail the review.' },
          { title: 'Where to find your EIN', body: 'On your IRS confirmation letter (CP 575), prior business tax returns, or your state business registration filing. If you cannot find it, the IRS Business & Specialty Tax Line (1-800-829-4933) will tell you over the phone after verifying your identity.' },
          { title: 'Authorized Representative', body: 'A real person at your business who can answer questions if Twilio or carriers follow up. Cannot be the SaaS provider (us). Use a real corporate email, not a personal Gmail. Use a real phone number that someone will actually answer.' },
          { title: 'Sole proprietors with no EIN', body: 'You can still register as a sole-prop brand using your SSN, but throughput limits are lower (~50 SMS/day at the lowest tier vs 4,500/day for full brands). For real volume, get an EIN — it is free at irs.gov/ein and takes 15 minutes.' },
          { title: 'After you have all the info', body: 'Move to Step 2 — Website Compliance. Twilio audits your website during review, so it must meet specific requirements before you submit.', link: { label: 'Open: Step 2 — Website Compliance', href: '#integrations-twilio-website' } },
        ],
        warnings: [
          'Mismatched business name between Twilio submission and IRS/state records is the #1 cause of rejection. Double-check the legal name exactly.',
          'Do not use a personal Gmail address as the business email. Carriers flag personal-domain submissions as suspicious.',
        ],
      },
      {
        id: 'integrations-twilio-website',
        title: 'Twilio Approval — Step 2: Website Compliance',
        summary: 'Twilio audits your website during 10DLC and Voice Integrity review. Your site must be live, secure, and contain specific elements before you submit.',
        steps: [
          { title: 'What Twilio looks for', body: 'During review, Twilio (and the carriers via TCR) actually visit your website. They check for: HTTPS (secure connection), a clear description of your business, contact information, a Privacy Policy with a specific SMS clause, Terms & Conditions with SMS terms, and — if you collect phone numbers — an opt-in consent checkbox.' },
          { title: 'Required pages', body: 'Home page (clear description of what you do). About page or business description. Contact page with visible phone, email, and address or service area. Privacy Policy. Terms & Conditions.' },
          { title: 'Required HTTPS', body: 'Your site must use https://, not http://. Most modern hosting (Wix, Squarespace, Webflow, Wordpress with SSL plugin) gives you this free. If your site is still on http://, fix this first — Twilio rejects http:// sites for Voice Integrity automatically.' },
          { title: 'SMS consent checkbox on every form that collects phone numbers', body: 'On contact forms, booking forms, signup forms — anywhere a customer types their mobile number — you need a checkbox with specific language. See the next article for the exact text to copy.', link: { label: 'Open: Step 3 — Copy-paste templates', href: '#integrations-twilio-templates' } },
          { title: 'Privacy Policy needs a specific SMS section', body: 'Your existing Privacy Policy is not enough — Twilio specifically requires language saying mobile information will not be shared with third parties or affiliates. Use the exact template in Step 3.' },
          { title: 'Terms & Conditions needs SMS terms', body: 'Same idea — you need a specific SMS Terms section saying message frequency, opt-out method, and that consent is not a condition of purchase.' },
          { title: 'For Voice Integrity (outbound calls)', body: 'Twilio also requires: a functioning HTTPS website, an EIN or DUNS number, a valid US business address, and an authorized representative with a valid US phone number. The website check is more lenient for voice than SMS, but still done.' },
        ],
        tips: [
          'If your site is on Wix, Squarespace, or Webflow, you can add Privacy Policy and Terms & Conditions pages from their built-in templates — most have a one-click "add legal page" feature.',
          'The SMS section in your Privacy Policy is what carriers reject most. Copy our template verbatim — do not paraphrase it.',
        ],
        warnings: [
          'Sites with no Privacy Policy will fail SMS approval immediately. Even a placeholder is required.',
          'Sites that don\'t mention mobile/SMS in the Privacy Policy will fail too. The privacy policy needs an explicit "we don\'t share mobile data" clause.',
        ],
      },
      {
        id: 'integrations-twilio-templates',
        title: 'Twilio Approval — Step 3: Copy-Paste Templates',
        summary: 'Ready-to-paste consent checkbox, Privacy Policy section, and Terms & Conditions section. We will auto-fill your business name and contact info into the templates.',
        steps: [
          { title: 'How these templates work', body: 'Each block below has placeholders like [CLIENT BUSINESS NAME] that we automatically fill in with your tenant settings. Click "Copy" on each block — the version you copy is fully filled in. Anything still in [BRACKETS] is something you need to fill in manually because we don\'t have it on file.' },
          {
            title: 'SMS consent checkbox',
            body: 'Add this checkbox to every form that collects phone numbers. Must be UNCHECKED by default, separate from any "I agree to Terms" checkbox.',
            template: {
              label: 'SMS consent checkbox',
              content: 'I agree to receive SMS text messages from [CLIENT BUSINESS NAME] about appointment scheduling, appointment reminders, service updates, customer support, and follow-up communications. Message frequency varies. Message and data rates may apply. Reply STOP to opt out. Reply HELP for help. Consent is not a condition of purchase. See our Privacy Policy and Terms & Conditions.',
            },
          },
          {
            title: 'Privacy Policy — SMS section',
            body: 'Add this section to your Privacy Policy. The exact language about not sharing mobile data is what Twilio looks for.',
            template: {
              label: 'Privacy Policy SMS section',
              content: 'SMS Communications\n\nWhen you provide your mobile phone number and opt in to SMS communications, [CLIENT BUSINESS NAME] may send you text messages related to appointment scheduling, appointment reminders, service updates, customer support, and follow-up communications.\n\nMessage frequency varies based on your interaction with our business. Message and data rates may apply. You may opt out at any time by replying STOP. For assistance, reply HELP or contact us at [CLIENT EMAIL] or [CLIENT PHONE NUMBER].\n\nNo mobile information will be shared with third parties or affiliates for marketing or promotional purposes. All text messaging originator opt-in data and consent information will not be shared with any third parties.',
            },
          },
          {
            title: 'Terms & Conditions — SMS section',
            body: 'Add this section to your Terms & Conditions.',
            template: {
              label: 'Terms & Conditions SMS section',
              content: 'SMS Terms & Conditions\n\nBy opting in to receive SMS messages from [CLIENT BUSINESS NAME], you agree to receive text messages related to appointment scheduling, appointment reminders, service updates, customer support, and follow-up communications.\n\nMessage frequency varies. Message and data rates may apply.\n\nYou may opt out at any time by replying STOP. After you reply STOP, we may send one final confirmation message to confirm that you have been unsubscribed. You may reply HELP for assistance or contact us at [CLIENT EMAIL] or [CLIENT PHONE NUMBER].\n\nConsent to receive SMS messages is not a condition of purchasing any goods or services. Wireless carriers are not liable for delayed or undelivered messages.',
            },
          },
          { title: 'After you update your website', body: 'Wait for the changes to deploy/publish. Visit your live URL and verify the checkbox appears on contact/booking forms, and the new SMS sections appear in your Privacy Policy and Terms pages. Then move to Step 4.', link: { label: 'Open: Step 4 — Twilio campaign forms', href: '#integrations-twilio-campaign-forms' } },
        ],
        tips: [
          'Do not pre-check the consent checkbox. Pre-checked = automatic rejection.',
          'Keep the SMS consent checkbox separate from the "I agree to Terms" checkbox. Two distinct boxes.',
          'The checkbox text must include the phrase "SMS" or "text messages" — Twilio searches for these exact words.',
        ],
        warnings: [
          'Do NOT add language about sharing mobile data with partners, affiliates, vendors, or marketing companies. Twilio\'s Messaging Policy prohibits transferring SMS consent to third parties — including this language is automatic rejection.',
        ],
      },
      {
        id: 'integrations-twilio-campaign-forms',
        title: 'Twilio Approval — Step 4: A2P Campaign Form Language',
        summary: 'Exact text to paste into the Twilio A2P 10DLC Campaign registration forms. Copy each block, paste into the matching field in Twilio.',
        steps: [
          { title: 'When you reach this step', body: 'You will be in Twilio Console → Messaging → Regulatory Compliance → US A2P 10DLC. After Brand approval (1–2 days), you create a Campaign. The Campaign asks for several text fields with strict requirements — single-word answers like "Marketing" cause rejection.' },
          {
            title: 'Campaign description (use case)',
            body: 'Paste this into the Campaign Description field. Twilio requires a thorough explanation, not a single word.',
            template: {
              label: 'Campaign description',
              content: 'This campaign sends SMS messages from [CLIENT BUSINESS NAME] to customers and prospects who have opted in through our website form, booking form, inbound SMS, phone call, or customer support interaction. Messages include appointment confirmations, appointment reminders, rescheduling notices, service updates, customer support follow-ups, and direct responses to customer inquiries. Messages are sent only to recipients who provide consent, and recipients can opt out at any time by replying STOP.',
            },
          },
          {
            title: 'Message Flow / Opt-in Description',
            body: 'Paste this into the Message Flow field. Must be 40–2049 characters and list ALL the ways someone can opt in.',
            template: {
              label: 'Message flow',
              content: 'End users opt in by visiting [CLIENT WEBSITE URL] and submitting a contact or booking form that asks for their mobile phone number. The form includes an unchecked SMS consent checkbox that states: "I agree to receive SMS text messages from [CLIENT BUSINESS NAME] about appointment scheduling, appointment reminders, service updates, customer support, and follow-up communications. Message frequency varies. Message and data rates may apply. Reply STOP to opt out. Reply HELP for help. Consent is not a condition of purchase." End users may also opt in by texting START to [CLIENT TWILIO NUMBER] or by requesting SMS follow-up during a phone call or customer support interaction. Privacy Policy and Terms & Conditions are linked on the form and in the website footer.',
            },
          },
          { title: 'Sample messages — overview', body: 'Twilio asks for 2–5 sample messages. Each must include your business name, use [BRACKETS] for variable content like dates, and end with HELP/STOP language. Use the four templates below as a starting set.' },
          {
            title: 'Sample message 1 — Appointment confirmation',
            body: 'Paste as the first sample message in your Twilio campaign.',
            template: {
              label: 'Sample 1 — Confirmation',
              content: '[CLIENT BUSINESS NAME]: Your appointment is confirmed for [DATE] at [TIME]. Reply C to confirm, R to reschedule, HELP for help, or STOP to opt out.',
            },
          },
          {
            title: 'Sample message 2 — Reminder',
            body: 'Paste as the second sample message.',
            template: {
              label: 'Sample 2 — Reminder',
              content: '[CLIENT BUSINESS NAME]: Reminder, your appointment is scheduled for tomorrow at [TIME]. Reply R to reschedule, HELP for help, or STOP to opt out.',
            },
          },
          {
            title: 'Sample message 3 — Customer service follow-up',
            body: 'Paste as the third sample message.',
            template: {
              label: 'Sample 3 — Follow-up',
              content: '[CLIENT BUSINESS NAME]: Thanks for contacting us. We received your request about [SERVICE]. A team member will follow up shortly. Reply HELP for help or STOP to opt out.',
            },
          },
          {
            title: 'Sample message 4 — Service update',
            body: 'Paste as the fourth sample message.',
            template: {
              label: 'Sample 4 — Service update',
              content: '[CLIENT BUSINESS NAME]: Your service request for [SERVICE] has been updated. Please call [CLIENT PHONE NUMBER] with questions. Reply HELP for help or STOP to opt out.',
            },
          },
          {
            title: 'Required keyword auto-responses',
            body: 'Twilio also asks for opt-in / opt-out / help responses. Paste each into the matching field.',
            template: {
              label: 'Opt-in (when user texts START)',
              content: '[CLIENT BUSINESS NAME]: You\'re subscribed to receive recurring appointment, support, and service update texts. Msg frequency varies. Msg & data rates may apply. Reply HELP for help or STOP to opt out.',
            },
          },
          {
            title: 'Opt-out response',
            body: 'Goes in the STOP keyword response field.',
            template: {
              label: 'Opt-out (STOP)',
              content: '[CLIENT BUSINESS NAME]: You have been unsubscribed and will no longer receive SMS messages from us. Reply START to resubscribe.',
            },
          },
          {
            title: 'HELP response',
            body: 'Goes in the HELP keyword response field.',
            template: {
              label: 'Help response',
              content: '[CLIENT BUSINESS NAME]: Help is available at [CLIENT PHONE NUMBER] or [CLIENT EMAIL]. Reply STOP to opt out.',
            },
          },
        ],
        tips: [
          'Sample messages must MATCH the campaign description. If you say "appointment reminders" in the description, the samples need to look like reminders.',
          'Use [BRACKETS] for any variable content (dates, times, service names) — Twilio specifically expects this format.',
          'Every sample needs your business name as the prefix. No exceptions.',
        ],
      },
      {
        id: 'integrations-twilio-voice-language',
        title: 'Twilio Approval — Voice Integrity Use Case Language',
        summary: 'Text to paste during Voice Integrity / SHAKEN/STIR / phone-number trust review. Outbound voice approval is faster than SMS but still requires this submission.',
        steps: [
          { title: 'Where you use this', body: 'Twilio Console → Trust Hub → Voice Integrity → Submit. Twilio asks for a "use case description" — paste the template below. This is a critical field — vague answers (like "business calls") get rejected.' },
          {
            title: 'Voice Integrity use case description',
            body: 'Paste into the use case / calling description field.',
            template: {
              label: 'Voice Integrity use case',
              content: '[CLIENT BUSINESS NAME] uses Twilio Programmable Voice to place and receive business calls for appointment scheduling, customer support, service follow-up, missed-call response, and customer-requested callbacks. Calls are made only for legitimate business purposes to customers, prospects, or contacts who requested communication or have an existing business relationship with [CLIENT BUSINESS NAME]. The phone numbers are owned and controlled by [CLIENT BUSINESS NAME] and are not used for deceptive calling, caller ID spoofing, third-party lead generation, or unrelated campaigns.',
            },
          },
          { title: 'If Twilio asks about the SaaS platform', body: 'They sometimes ask "what software is involved?" Use this answer — it positions YOU as the sender of record (correct), not OrbisVoice.', template: { label: 'SaaS platform disclosure', content: 'OrbisVoice provides the software used by [CLIENT BUSINESS NAME] to manage calls, SMS messages, appointment scheduling, and customer follow-up. [CLIENT BUSINESS NAME] is the sender of record and controls its own customer communications, phone numbers, opt-in records, and business messaging use case.' } },
          { title: 'Optional: CNAM (Caller Name) registration', body: 'After Voice Integrity approval, you can register CNAM at: Twilio Console → Phone Numbers → your number → CNAM Lookup. This makes your business name show on the recipient\'s caller ID instead of "Wireless Caller". ~$1.25/month per number, 1–3 day approval.' },
        ],
      },
      {
        id: 'integrations-twilio-prohibited',
        title: 'Twilio Approval — Words and Use Cases to Avoid',
        summary: 'Specific phrases and use cases that trigger automatic rejection. Avoid these in your Twilio submission forms.',
        steps: [
          { title: 'Phrases that cause rejection', body: 'Avoid: "Cold outreach", "Lead generation", "Purchased list", "Affiliate campaign", "Third-party marketing", "Mass texting", "Automated sales blasts", "Get rich quick". Even if you do generate leads or send marketing, these literal words flag your submission for stricter review or rejection.' },
          { title: 'Use cases that fail SHAFT screening', body: 'SHAFT = Sex, Hate, Alcohol, Firearms, Tobacco. Carriers reject SMS campaigns related to: Adult content, hate speech / discrimination, alcohol sales, firearms sales, tobacco / vape products, cannabis / CBD (even where legal), gambling, lottery, prize draws.' },
          { title: 'High-risk financial categories', body: 'These industries face stricter approval (often outright rejection): Debt relief, credit repair, payday loans, loan offers, high-risk financial services. Even if your SMS use case is legitimate within these industries, expect a longer review and possibly multiple rejections.' },
          { title: 'How to describe legitimate marketing', body: 'If you ARE doing marketing, describe it as: "Customer notifications", "Service updates", "Appointment communications", "Customer-initiated follow-up". Do not describe it as "marketing" if the actual use is service-oriented.' },
          { title: 'What to do if your use case is borderline', body: 'For SHAFT-adjacent industries (e.g. legal cannabis dispensary), Twilio offers special programs through their Compliance team — contact Twilio Sales BEFORE submitting a campaign. Submitting cold gets rejected; the Compliance team can guide you to the right product.' },
        ],
        warnings: [
          'Lying about your use case to get approval = account ban. Carriers monitor actual SMS content; if the messages don\'t match the description, your campaign gets revoked and the carriers may blacklist your business across all carriers.',
        ],
      },
      {
        id: 'integrations-twilio-console-links',
        title: 'Twilio Console — Direct Links to Every Step',
        summary: 'One-click destinations into Twilio for each step of the approval workflow. Avoid hunting through the Twilio dashboard menus.',
        steps: [
          { title: 'Twilio main login', body: 'Start here if you do not yet have a Twilio account, or to log in.', link: { label: 'Open Twilio Console →', href: 'https://console.twilio.com/' } },
          { title: 'Trust Hub — Business Profile (the foundation)', body: 'Required before A2P 10DLC and Voice Integrity. Submit your business info here first. Approval: 1–2 business days.', link: { label: 'Open Trust Hub →', href: 'https://console.twilio.com/us1/account/trust-hub/customer-profiles' }, screenshots: [{ filename: 'twilio-trust-hub-customer-profiles.png', caption: 'Twilio Console Trust Hub > Customer Profiles page with the \'Create new\' button visible' }] },
          { title: 'Phone Numbers — Buy a number', body: 'Purchase SMS-capable and/or voice-capable numbers. Local numbers (recommended for most): ~$1.15/month. Toll-free: ~$2/month.', link: { label: 'Open Phone Numbers →', href: 'https://console.twilio.com/us1/develop/phone-numbers/manage/search' } },
          { title: 'Messaging Services (required for A2P 10DLC)', body: 'Create a Messaging Service before registering an A2P Brand. Numbers must be assigned to a Messaging Service to send via 10DLC.', link: { label: 'Open Messaging Services →', href: 'https://console.twilio.com/us1/develop/sms/services' } },
          { title: 'A2P 10DLC — Brand registration', body: 'Step 1 of 10DLC. Register your business as a Brand with The Campaign Registry. Cost: $4 one-time. Approval: 1–2 days.', link: { label: 'Open A2P Brand registration →', href: 'https://console.twilio.com/us1/develop/sms/regulatory-compliance/a2p-10dlc/brands' }, screenshots: [{ filename: 'twilio-a2p-brand-registration.png', caption: 'Twilio Console A2P 10DLC Brands page with the brand registration form' }] },
          { title: 'A2P 10DLC — Campaign registration', body: 'Step 2 of 10DLC. Create a campaign describing your SMS use case. Cost: ~$10/month + per-message fees. Approval: 1–4 weeks.', link: { label: 'Open A2P Campaign registration →', href: 'https://console.twilio.com/us1/develop/sms/regulatory-compliance/a2p-10dlc/campaigns' }, screenshots: [{ filename: 'twilio-a2p-campaign-registration.png', caption: 'Twilio Console A2P 10DLC Campaigns page with the campaign creation form' }] },
          { title: 'Toll-free Verification (alternative to 10DLC)', body: 'If you have a toll-free number (1-8XX), submit Toll-Free Verification instead of 10DLC. Faster (2–5 days) but pricier per message.', link: { label: 'Open Toll-Free Verification →', href: 'https://console.twilio.com/us1/develop/sms/regulatory-compliance/toll-free-verification' } },
          { title: 'Voice Integrity (for outbound calls)', body: 'Submit your Trust Product for Voice Integrity to attest your outbound calls and reduce "Spam Likely" labels. Required for outbound calling at scale.', link: { label: 'Open Voice Integrity →', href: 'https://console.twilio.com/us1/develop/voice/manage/voice-integrity' } },
          { title: 'CNAM (Caller Name) registration', body: 'Optional. Sets your business name as the displayed caller ID on recipient phones. ~$1.25/month per number. 1–3 day approval.', link: { label: 'Open CNAM Lookup →', href: 'https://console.twilio.com/us1/develop/phone-numbers/manage/incoming' } },
          { title: 'Verified Caller IDs (for testing while 10DLC pends)', body: 'Add your own personal phone numbers as verified caller IDs. Verified numbers can receive SMS without 10DLC — useful for testing.', link: { label: 'Open Verified Caller IDs →', href: 'https://console.twilio.com/us1/develop/phone-numbers/manage/verified' } },
          { title: 'API Keys (for connecting to OrbisVoice)', body: 'After approvals are done, create an API Key to connect Twilio to OrbisVoice (better than using your main Auth Token).', link: { label: 'Open API Keys →', href: 'https://console.twilio.com/us1/account/keys-credentials/api-keys' } },
        ],
        tips: [
          'Bookmark Trust Hub and the A2P Campaign pages — you will visit them many times during the approval cycle.',
          'If a link above fails, Twilio occasionally rebuilds these pages. Search the Twilio Console for the section name and let us know so we can update.',
        ],
      },
      {
        id: 'integrations-twilio-checklist',
        title: 'Twilio Approval — Pre-Submission Checklist',
        summary: 'Verify all 21 items before submitting your A2P 10DLC Campaign. This checklist mirrors what Twilio and the carriers check during review.',
        steps: [
          { title: 'Why this checklist exists', body: 'Most rejection reasons fall into the same handful of issues. Going through this list before submitting catches them — saving you the 1–4 week wait that comes with a rejection-then-resubmit cycle.' },
          { title: 'Business identity', body: '☐ Business name on submission matches your EIN / state filing exactly\n☐ Authorized representative is a real person at your business\n☐ Business email uses a corporate domain, not personal Gmail / Yahoo / Outlook' },
          { title: 'Website fundamentals', body: '☐ Site is live (not under construction, not 404, not "coming soon")\n☐ Site uses https:// (secure)\n☐ Home page clearly explains what the business does\n☐ Contact page exists with visible phone, email, and address' },
          { title: 'Privacy and Terms pages', body: '☐ Privacy Policy is published and linked in footer\n☐ Privacy Policy includes the SMS Communications section (see Step 3 templates)\n☐ Privacy Policy says mobile data is NOT shared with third parties or affiliates\n☐ Terms & Conditions is published and linked in footer\n☐ Terms & Conditions includes SMS Terms section (see Step 3 templates)' },
          { title: 'SMS opt-in checkbox', body: '☐ Visible on every form that collects phone numbers\n☐ NOT pre-checked by default\n☐ Names your business by name\n☐ Includes the words "SMS" or "text messages"\n☐ Says "Message frequency varies"\n☐ Says "Message and data rates may apply"\n☐ Includes "Reply STOP" and "Reply HELP" language\n☐ Separate from any "I agree to Terms" checkbox' },
          { title: 'Twilio campaign forms', body: '☐ Campaign description is detailed (not single words like "marketing")\n☐ Sample messages all start with your business name\n☐ Sample messages match the campaign description\n☐ No prohibited phrases (cold outreach, purchased list, etc.)' },
          { title: 'Test BEFORE going live', body: '☐ Text START from your phone → confirm you receive the opt-in auto-response\n☐ Text STOP from your phone → confirm you receive the opt-out confirmation\n☐ Text HELP from your phone → confirm you receive the help response' },
        ],
        tips: [
          'Print this checklist (or take screenshots) and check items off as you complete them. The checklist UI for tracking this in OrbisVoice is on our roadmap but not built yet.',
        ],
      },
    ],
  },
  {
    id: 'appointments',
    label: 'Appointments',
    icon: 'M4 3h8a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zm3 4h2M7 10h2M4 6h8',
    articles: [
      {
        id: 'appointments-overview',
        title: 'How Appointment Booking Works',
        summary: 'End-to-end overview of how the agent books, reschedules, and cancels appointments.',
        steps: [
          { title: 'Prerequisites', body: 'Appointment booking requires: (1) Google Calendar connected in Integrations, (2) Appointment agent role enabled in Agents, (3) Business DNA filled with operating hours.' },
          { title: 'How the agent checks availability', body: 'When a caller asks to book, the agent queries your Google Calendar\'s free/busy data in real time. It finds the next available 30-minute slot within your business hours and proposes it to the caller.' },
          { title: 'Confirming the booking', body: 'The caller confirms the time. The agent creates a Google Calendar event with: the caller\'s name, phone number, reason for appointment, and a 15-minute reminder.' },
          { title: 'Rescheduling', body: 'Callers can ask to reschedule. The agent will look up their existing appointment (matched by phone number), propose new available times, and update the calendar event.' },
          { title: 'Cancellation', body: 'Callers can ask to cancel. The agent confirms the cancellation and deletes the calendar event.' },
          { title: 'Viewing appointments in OrbisVoice', body: 'Go to Appointments in the sidebar. You\'ll see all appointments booked through the agent with status (Scheduled, Completed, Cancelled). You can also cancel appointments manually from here.' },
        ],
        tips: ['Set your operating hours accurately in Business DNA — the agent will never propose slots outside those hours.'],
        warnings: ['If Google Calendar loses its connection, the agent will inform callers that booking is unavailable and offer to take a message instead.'],
      },
    ],
  },
  {
    id: 'contacts',
    label: 'Contacts',
    icon: 'M10 9a3 3 0 1 0-6 0M5 15a5 5 0 0 1 6 0M13 7a2 2 0 1 0-4 0M14 13a4 4 0 0 0-3-1',
    articles: [
      {
        id: 'contacts-manage',
        title: 'Managing Your Contact List',
        summary: 'How to add, import, and organize contacts for outbound campaigns.',
        steps: [
          { title: 'What contacts are used for', body: 'Contacts are the people your agent calls in outbound campaigns. Each contact has a name, phone number, and optional custom fields (email, company, tags, notes).' },
          { title: 'Adding a contact manually', body: 'Go to Contacts. Click "+ Add Contact". Fill in the required fields: First Name, Last Name, Phone Number (in E.164 format: +14155551234). Add optional fields as needed. Click Save.', screenshots: [{ filename: 'contacts-add-button.png', caption: 'Contacts page with the \'+ Add Contact\' button highlighted' }, { filename: 'contacts-add-form.png', caption: 'Contact creation modal with First Name / Last Name / Phone (E.164) / Email / Company / Tags / Notes fields' }] },
          { title: 'Importing contacts from CSV', body: 'Click "Import CSV". Download the template to see the required column format. Fill in your contacts in the template. Upload the file. OrbisVoice will preview the first 5 rows for you to confirm the mapping before importing.', screenshots: [{ filename: 'contacts-import-csv-button.png', caption: 'Contacts page with the \'Import CSV\' button' }, { filename: 'contacts-import-preview.png', caption: 'CSV import preview screen showing the first 5 rows mapped to the right columns' }] },
          { title: 'Required CSV columns', body: 'The CSV must have at minimum: firstName, lastName, phoneE164. Optional columns: email, company, tags (comma-separated), notes.' },
          { title: 'Editing a contact', body: 'Click any contact row to open their detail view. Edit any field and click Save. Changes take effect immediately — if the contact is in an active campaign, the updated info is used on the next call attempt.' },
          { title: 'Deleting contacts', body: 'Select one or more contacts using the checkboxes. Click "Delete Selected". Deleted contacts are removed from all future campaign runs but their call history is preserved in Conversations.' },
          { title: 'Tags and filtering', body: 'Add tags to contacts to group them (e.g. "Lead", "Customer", "VIP"). Use the filter bar to show only contacts with specific tags. Tags make it easy to build targeted campaign contact lists.', screenshots: [{ filename: 'contacts-tag-filter.png', caption: 'Contacts page filter bar showing tag chips and the search input' }] },
        ],
        tips: [
          'Always use E.164 format for phone numbers (+country code + number, no spaces or dashes).',
          'Tag contacts as they come in — retroactive tagging is tedious on large lists.',
        ],
        warnings: ['Importing duplicates will not be auto-merged. Check for duplicates before importing by sorting your CSV by phone number.'],
      },
    ],
  },
  {
    id: 'campaigns',
    label: 'Campaigns',
    icon: 'M3 5h10M3 8h7M3 11h4m6-4v6m0 0-2-2m2 2 2-2',
    articles: [
      {
        id: 'campaigns-create',
        title: 'Creating and Running a Campaign',
        summary: 'How to set up an outbound calling campaign from start to finish.',
        steps: [
          { title: 'What is a campaign?', body: 'A campaign is a scheduled batch of outbound calls. You define: who to call (a contact list or tag filter), what the agent should accomplish on each call (the script goal), and when to run the calls.' },
          { title: 'Create a campaign', body: 'Go to Campaigns. Click "+ New Campaign". Give it a name (internal reference only). Select the goal type: Lead Follow-Up, Appointment Reminder, Promotional Offer, Re-engagement, or Custom.', screenshots: [{ filename: 'campaigns-new-button.png', caption: 'Campaigns page with the \'+ New Campaign\' button' }, { filename: 'campaigns-goal-type-selector.png', caption: 'Campaign creation step showing goal type radio options (Lead Follow-Up / Appointment Reminder / Promotional / Re-engagement / Custom)' }] },
          { title: 'Select contacts', body: 'Choose which contacts to include: All contacts, Contacts with a specific tag, or a manually selected list. The contact count will update as you adjust the filter.', screenshots: [{ filename: 'campaigns-contact-filter.png', caption: 'Campaign creation showing contact selection: All / By Tag / Manual list, with the live count display' }] },
          { title: 'Write the campaign brief', body: 'In the "Script Brief" field, describe what the agent should accomplish in plain English. Example: "Call the contact, introduce yourself as [Agent Name] from [Business], and let them know about our summer promotion — 20% off all services booked before August 31. Try to book an appointment."', screenshots: [{ filename: 'campaigns-brief-textarea.png', caption: 'Campaign creation showing the \'Script Brief\' textarea with placeholder text' }] },
          { title: 'Set the schedule', body: 'Choose when calls should be made: immediately, at a specific date/time, or daily during a window (e.g. weekdays 10am–5pm). Set the timezone.', screenshots: [{ filename: 'campaigns-schedule-options.png', caption: 'Campaign scheduling section showing immediate/specific-time/daily-window options + timezone dropdown' }] },
          { title: 'Set the retry policy', body: 'Choose how many times to retry unanswered numbers and the wait time between retries. Recommended: 2 retries, 4 hours apart.' },
          { title: 'Review and launch', body: 'Review the summary: contact count, estimated call duration, and schedule. Click "Launch Campaign". The campaign status will change to "Running" when calls begin.', screenshots: [{ filename: 'campaigns-launch-button.png', caption: 'Campaign review page with summary stats and the \'Launch Campaign\' button' }] },
          { title: 'Monitoring a campaign', body: 'While the campaign is running, the Campaigns page shows real-time stats: calls attempted, answered, completed, and failed. Click any contact row to see the outcome of their individual call.', screenshots: [{ filename: 'campaigns-running-stats.png', caption: 'Active campaign view showing real-time call attempts / answered / completed / failed counts' }] },
          { title: 'Pausing and resuming', body: 'Click "Pause" to stop new calls from being initiated. The current call in progress will complete. Click "Resume" to continue from where it left off.' },
        ],
        tips: [
          'Keep the script brief short and focused — the agent performs better with a clear single goal.',
          'Schedule calls during normal business hours for your contacts\' time zone.',
          'Run a test campaign with 2–3 internal contacts first before calling your real list.',
        ],
        warnings: [
          'Ensure compliance with TCPA (US), GDPR (EU), or local regulations before making outbound calls. Only call contacts who have consented.',
          'Do not launch a campaign without testing the Outbound channel in Agent Studio first.',
        ],
      },
    ],
  },
  {
    id: 'conversations',
    label: 'Conversations',
    icon: 'M2 4h12a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1H5l-3 2V5a1 1 0 0 1 1-1zm3 3h6M5 9h4',
    articles: [
      {
        id: 'conversations-overview',
        title: 'Viewing and Understanding Conversations',
        summary: 'How to find, read, and act on conversation records.',
        steps: [
          { title: 'What is a conversation record?', body: 'Every call or widget session creates a conversation record. It contains: the date and time, channel type (Widget/Inbound/Outbound), duration, an AI-generated summary, a full transcript, and a recording link (if recording is enabled).' },
          { title: 'Finding a conversation', body: 'Go to Conversations. Use the search bar to find by contact name or phone number. Use the filters to narrow by channel, status, or date range. Records are sorted newest first by default.', screenshots: [{ filename: 'conversations-list-with-filters.png', caption: 'Conversations page showing the list, search bar, and channel/status/date filter controls' }] },
          { title: 'Reading the summary', body: 'The summary is a 2–3 sentence AI-generated overview of what happened in the conversation. It\'s generated automatically after every call ends. Use it to quickly understand what was discussed without listening to the full recording.' },
          { title: 'Reading the transcript', body: 'Click a conversation to open its detail view. The Transcript tab shows the full word-for-word exchange, labeled by speaker (Agent / Caller). Timestamps are shown per turn.', screenshots: [{ filename: 'conversations-detail-transcript.png', caption: 'Conversation detail view with the Transcript tab showing speaker-labeled exchange and timestamps' }] },
          { title: 'Listening to the recording', body: 'If call recording is enabled in Twilio, an audio player appears in the conversation detail view. Click play to listen. The recording is stored securely and only accessible to your account.', screenshots: [{ filename: 'conversations-detail-audio-player.png', caption: 'Conversation detail view showing the audio player with play/pause/scrubber controls' }] },
          { title: 'Outcome codes', body: 'Each conversation is tagged with an outcome: Completed (natural end), Missed (dropped), Transferred (sent to human), Booked (appointment created), or Failed (technical error). Use these to filter and analyze performance.' },
        ],
        tips: ['Read 5–10 conversation summaries per week to identify common questions or objections you should address in your Business DNA.'],
      },
    ],
  },
  {
    id: 'billing',
    label: 'Usage & Billing',
    icon: 'M1 5h14v6a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V5zm0-2a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2',
    articles: [
      {
        id: 'billing-plans',
        title: 'Plans, Entitlements, and Upgrades',
        summary: 'Understanding your plan, what each tier includes, and how to upgrade.',
        steps: [
          { title: 'Viewing your current plan', body: 'Go to Billing in the sidebar. Your current plan is shown at the top with your billing cycle, next payment date, and monthly cost.', screenshots: [{ filename: 'billing-current-plan-card.png', caption: 'Billing page top showing the current plan card with billing cycle, next payment date, and monthly cost' }] },
          { title: 'What entitlements are', body: 'Entitlements are the capabilities your plan includes: number of channels you can enable, voice minutes per month, number of contacts, and which features are available (e.g. outbound calling, recording). Your active entitlements are listed in the Billing page.' },
          { title: 'Upgrading your plan', body: 'Scroll to the plan comparison table. Click "Upgrade" on any higher-tier plan. You\'ll be taken to the Stripe checkout page. Enter your payment details and complete the purchase. Your entitlements update immediately.', screenshots: [{ filename: 'billing-plan-comparison.png', caption: 'Billing page plan comparison table with all 6 tiers and \'Upgrade\' buttons' }, { filename: 'stripe-checkout-page.png', caption: 'Stripe-hosted checkout page after clicking Upgrade — payment fields visible' }] },
          { title: 'Accessing invoices', body: 'Click "Manage Billing" to open the Stripe customer portal. From there you can download past invoices, update your payment method, and manage your subscription.', screenshots: [{ filename: 'billing-manage-billing-button.png', caption: 'Billing page showing the \'Manage Billing\' button that opens the Stripe customer portal' }] },
          { title: 'Cancellation', body: 'To cancel, open the Stripe customer portal and cancel your subscription. Your account remains active until the end of the current billing period.' },
        ],
        tips: ['If you need a channel that\'s locked, check the Billing page — the required plan tier is shown next to the locked feature.'],
      },
      {
        id: 'billing-usage',
        title: 'Understanding Your Usage',
        summary: 'How to read your voice minute usage and what counts against your quota.',
        steps: [
          { title: 'What counts as usage', body: 'Every second of an active voice session — widget, inbound call, or outbound call — counts against your monthly voice minute quota. The timer starts when the caller connects and ends when the session closes.' },
          { title: 'Viewing usage', body: 'Go to Usage in the sidebar. You\'ll see: minutes used this period, minutes remaining, calls by channel, and a monthly history chart.' },
          { title: 'Usage warnings', body: 'OrbisVoice will show a yellow warning when you reach 80% of your monthly limit and a red warning at 95%. These appear in the Usage page and on your dashboard.' },
          { title: 'What happens if you exceed your quota', body: 'New voice sessions will not connect until the next billing period or until you upgrade. Callers to your inbound number will hear a brief message that the service is temporarily unavailable.' },
          { title: 'Resetting', body: 'Your usage resets at the start of each billing cycle. The reset date is shown in the Usage page.' },
        ],
        warnings: ['Plan quota overages are not automatically charged — sessions stop. Upgrade before running large outbound campaigns.'],
      },
    ],
  },
  {
    id: 'settings',
    label: 'Settings',
    icon: 'M8 10a2 2 0 1 0 0-4 2 2 0 0 0 0 4zm4.3-1.3A4.5 4.5 0 0 0 12.5 8a4.5 4.5 0 0 0-.2-.7l1.5-1.2-1-1.7-1.8.6A4.5 4.5 0 0 0 9.7 4.2L9.5 2.5h-2l-.2 1.7A4.5 4.5 0 0 0 5.9 5l-1.8-.6-1 1.7 1.5 1.2A4.5 4.5 0 0 0 4.5 8a4.5 4.5 0 0 0 .1.7L3.1 9.9l1 1.7 1.8-.6a4.5 4.5 0 0 0 1.4.8l.2 1.7h2l.2-1.7a4.5 4.5 0 0 0 1.4-.8l1.8.6 1-1.7z',
    articles: [
      {
        id: 'settings-workspace',
        title: 'Workspace Settings',
        summary: 'How to configure your workspace name, timezone, notification email, and branding.',
        steps: [
          { title: 'Workspace display name', body: 'The workspace name appears in your dashboard header and in admin views. It does not affect the agent\'s behavior — the agent uses the name from Business DNA.', screenshots: [{ filename: 'settings-workspace-fields.png', caption: 'Settings page Workspace section with display name, timezone, and notification email fields' }] },
          { title: 'Timezone', body: 'Set your workspace timezone. This controls how dates and times are displayed across the portal (conversation timestamps, appointment times, usage reports). It does not affect Twilio call scheduling — that uses the timezone set in each Campaign.' },
          { title: 'Notification email', body: 'The email address where OrbisVoice sends account notifications: usage warnings, billing receipts, and integration alerts. This can be different from your login email.' },
          { title: 'Business contact details', body: 'Fill in your public business address and phone number. These are used in automated emails sent by the agent (appointment confirmations, follow-ups) as the sender\'s return address.' },
        ],
      },
      {
        id: 'settings-security',
        title: 'Account Security',
        summary: 'How to change your password and manage your login credentials.',
        steps: [
          { title: 'Changing your password', body: 'Go to Settings. Scroll to the Security section. Enter your current password, then your new password twice. Click "Update Password". You will remain logged in after the change.', screenshots: [{ filename: 'settings-security-password.png', caption: 'Settings page Security section with current password / new password / confirm fields and Update button' }] },
          { title: 'Password requirements', body: 'Passwords must be at least 8 characters. Use a mix of letters, numbers, and symbols for a strong password. Do not reuse passwords from other services.' },
          { title: 'If you forget your password', body: 'On the login page, click "Forgot?" next to the password field. Enter your email address and click Send Reset Link. Check your email for a reset link (check spam if it doesn\'t arrive in 2 minutes). The link expires after 30 minutes.' },
          { title: 'Logging out', body: 'Click your name or the sign-out button at the bottom of the sidebar to log out. Your session is immediately revoked — you\'ll need to log in again to access the portal.' },
        ],
        warnings: ['Never share your login credentials with anyone. If a team member needs access, contact support to add them as a Team Member with their own login.'],
      },
    ],
  },
]
