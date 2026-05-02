export type HelpStep = {
  title: string
  body: string
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
          { title: 'Step 1 — Fill in Business DNA', body: 'Go to Business DNA in the sidebar. Complete at minimum: your business name, industry, primary service, operating hours, and one escalation condition. Publish the draft when ready.' },
          { title: 'Step 2 — Write your Master Prompt', body: 'Go to Prompts. Create a new prompt with scope "Master". Describe your agent\'s persona, tone, and primary goal in plain language. Publish it.' },
          { title: 'Step 3 — Enable at least one channel', body: 'Go to Channels. Enable the Widget channel. You don\'t need Twilio for this — it works over your browser.' },
          { title: 'Step 4 — Test in Agent Studio', body: 'Go to Agent Studio. Select the Widget tab. Pick a voice. Click "Start Test" and speak to your agent. Check that responses match your Business DNA.' },
          { title: 'Step 5 — Embed the widget', body: 'Go to Channels → Widget. Copy the embed snippet and paste it into the <head> of your website.' },
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
          { title: 'Conversations count', body: 'Shows the total number of voice sessions in the selected period — widget chats, inbound calls, and outbound call attempts combined. A session is created the moment a caller connects, even if the call is very short.' },
          { title: 'Completed vs Missed', body: '"Completed" means the conversation reached a natural close — the agent said goodbye or the caller hung up after a full exchange. "Missed" means the call connected but the agent could not answer (e.g. gateway was down) or the call dropped within the first 5 seconds.' },
          { title: 'Active agents', body: 'Shows how many of your 7 agent roles are currently enabled. An agent role must be enabled before the prompt stack includes its behavior.' },
          { title: 'Channel status indicators', body: 'Each enabled channel shows a green dot. A yellow dot means the channel is enabled but has a configuration issue (e.g. Twilio disconnected). Red means the channel is disabled.' },
          { title: 'Changing the date range', body: 'Use the period selector (top right of the stats area) to switch between Today, Last 7 Days, Last 30 Days, and This Month. All metrics update simultaneously.' },
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
          { title: 'Open the editor', body: 'Click Business DNA in the sidebar. You\'ll see a tabbed editor with sections: Identity, Services, Pricing, Hours, Rules, Escalation, Compliance, and Language.' },
          { title: 'Identity section', body: 'Fill in your business name, tagline, industry, and a short description of what your business does. This is read first by the agent and sets the context for every response.' },
          { title: 'Services section', body: 'List each service or product you offer. For each one, include: the name, a 1–2 sentence description, who it\'s for, and any key differentiator. Be specific — vague descriptions produce vague agent answers.' },
          { title: 'Pricing section', body: 'Add your pricing information. You can use ranges (e.g. "$500–$1,500 depending on scope") if exact prices vary. If pricing is quote-only, say so and include how to request a quote.' },
          { title: 'Hours section', body: 'Set your operating hours per day of week. Also set your timezone. The agent uses this to tell callers when you\'re open and to determine after-hours behavior.' },
          { title: 'Rules section', body: 'List any business rules the agent must follow. Examples: "Always ask for the caller\'s name before helping", "Never quote prices for enterprise contracts — always transfer to sales", "Only book appointments on Tuesdays and Thursdays".' },
          { title: 'Escalation section', body: 'Define the conditions under which the agent must transfer a caller to a human. Examples: angry caller, legal question, billing dispute, contract negotiation. Be explicit — the agent will only escalate on conditions you list here.' },
          { title: 'Language and compliance', body: 'List any words or phrases the agent must never say (prohibited language), any compliance disclaimers it must include, and whether it should use formal or casual language.' },
          { title: 'Save the draft', body: 'Click "Save Draft" at any time. The draft is not live — it\'s saved to your account but the active agent still uses the previously published version.' },
          { title: 'Publish', body: 'When you\'re satisfied with your draft, click "Publish". A confirmation dialog will appear. Once confirmed, this version becomes the active Business DNA immediately — all new conversations use it.' },
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
          { title: 'Creating a new prompt', body: 'Click the "+ New Prompt" button. Select a scope (Master, Widget, Inbound, Outbound, or Role). Give it a name you\'ll recognize (e.g. "Master — Booking Focus v2"). Write the content and save as a draft.' },
          { title: 'Only one prompt per scope can be active', body: 'You can have multiple drafts for each scope, but only one published (active) prompt per scope at any time. Publishing a new prompt automatically archives the previous one.' },
          { title: 'Viewing version history', body: 'Click on any prompt to open it. Use the "History" tab to see all previous versions with timestamps. You can view the full content of any historical version.' },
          { title: 'Reverting to a previous version', body: 'Open a previous version from the History tab. Click "Restore this version" to create a new draft pre-filled with that version\'s content. Review and republish when ready.' },
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
          { title: 'Open an agent role', body: 'Go to Agents in the sidebar. You\'ll see cards for each of the 7 roles. Click any card to expand its configuration.' },
          { title: 'Enable the role', body: 'Toggle the "Enabled" switch at the top of the card. Disabled roles are completely inactive — they don\'t affect conversations at all.' },
          { title: 'Bind a prompt', body: 'Use the "Role Prompt" dropdown to select a published prompt with matching scope. If you haven\'t created a role-specific prompt yet, the agent uses only the master prompt — which is fine for most use cases.' },
          { title: 'Set allowed actions', body: 'Check the actions this role is permitted to take. Example: the Appointment agent can be allowed to "Create appointment", "Check availability", and "Send confirmation". Actions not checked here will be refused even if the caller requests them.' },
          { title: 'Set handoff rules', body: 'Define when this agent should hand off to another agent or a human. Example: "Hand off to human if caller expresses frustration more than twice" or "Hand off to Sales agent if caller asks about pricing".' },
          { title: 'Save', body: 'Click Save. Changes take effect on the next new conversation — existing live sessions are not interrupted.' },
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
          { title: 'Select a channel tab', body: 'At the top of Agent Studio you\'ll see three tabs: Widget, Inbound, and Outbound. Select the channel you want to test. Each channel may behave differently based on its channel overlay prompt.' },
          { title: 'Widget tab — voice and avatar', body: 'The Widget tab lets you pick an avatar (the face shown in the chat widget) and a voice. Select a female or male avatar from the grid, then choose a voice from the dropdown. These settings are specific to the widget.' },
          { title: 'Inbound and Outbound tabs — voice only', body: 'Phone channels don\'t show an avatar, so these tabs show only the voice picker and the live test panel.' },
          { title: 'Starting a test', body: 'Click "Start Test". The system creates a temporary session using your current configuration. Wait for the agent to greet you — this is your signal that the connection is ready.' },
          { title: 'Speaking to the agent', body: 'Click "Speak" (the microphone button) to start talking. Speak naturally. When you stop speaking, click "Stop mic" — this signals the agent to respond immediately without waiting for a silence timeout.' },
          { title: 'Ending the test', body: 'Click "End" to close the test session. The session is not saved to your conversation history.' },
          { title: 'Saving voice and avatar settings', body: 'After you find a voice and avatar combination you\'re happy with, click "Save Settings" on the Widget tab. This applies those settings to the live widget.' },
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
          { title: 'Enable the Widget channel', body: 'Go to Channels in the sidebar. Click the Widget card. Toggle "Enable Widget" to on. The widget is now active — but not yet on your website.' },
          { title: 'Widget position', body: 'Choose whether the widget button appears in the bottom-right or bottom-left corner of your website. Most websites use bottom-right.' },
          { title: 'Widget color', body: 'Set the widget button color to match your brand. Use a hex code or pick from the presets. This only affects the trigger button — the chat panel uses the OrbisVoice theme.' },
          { title: 'Voice and avatar', body: 'Set the voice and avatar for the widget in Agent Studio (see Agent Studio section). The widget channel inherits whatever is saved there.' },
          { title: 'Copy the embed snippet', body: 'At the bottom of the Widget configuration, click "Copy Embed Code". You\'ll get a short <script> tag.' },
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
          { title: 'Enable Inbound channel', body: 'Go to Channels → Inbound. Toggle "Enable Inbound Receptionist" to on.' },
          { title: 'Set the inbound greeting', body: 'This is the first thing callers hear. Keep it short: "[Business name], [agent name] speaking, how can I help?" The agent then takes over the conversation.' },
          { title: 'After-hours behavior', body: 'Set what happens when a caller calls outside your business hours (set in Business DNA). Options: (1) The agent still answers but informs the caller of hours and takes a message. (2) The caller hears a voicemail-style recording. (3) Forward to another number.' },
          { title: 'Call forwarding / transfer', body: 'Set the phone number to forward to when the agent escalates a call to a human. This is the number a human staff member will receive on their phone when the agent decides to transfer.' },
          { title: 'Configure the Twilio webhook', body: 'In Twilio, set the voice webhook URL for your phone number to: https://api.myorbisvoice.com/api/webhooks/twilio/voice. This tells Twilio to send incoming calls to OrbisVoice.' },
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
          { title: 'Enable Outbound channel', body: 'Go to Channels → Outbound. Toggle "Enable Outbound Caller" to on.' },
          { title: 'Set caller ID', body: 'Choose which phone number appears on the recipient\'s phone when the agent calls them. This must be a Twilio number in your account.' },
          { title: 'Retry policy', body: 'Set how many times the agent should retry a number that doesn\'t answer or goes to voicemail. Recommended: 2 retries, 4 hours apart.' },
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
          { title: 'Start the connection', body: 'Go to Integrations in the sidebar. Click "Connect Google". You\'ll be redirected to Google\'s login page.' },
          { title: 'Authorize the permissions', body: 'Google will ask for two permissions: (1) View and manage your Google Calendar events. (2) Send email on your behalf. Both are required. Click "Allow".' },
          { title: 'Confirm the connection', body: 'You\'ll be redirected back to OrbisVoice. The Google card will show "Connected" with the email address of the connected account and the number of calendars found.' },
          { title: 'Select the booking calendar', body: 'In the Integrations panel, select which of your calendars the agent should use for bookings. If you have multiple calendars, choose the one for business appointments.' },
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
          { title: 'Find your credentials', body: 'In the Twilio Console, go to the main dashboard. You\'ll see your Account SID and Auth Token. Copy both.' },
          { title: 'Enter credentials in OrbisVoice', body: 'Go to Integrations → Twilio. Enter your Account SID and Auth Token in the fields provided. Click Save. The fields are write-only — once saved, the token is never displayed again.' },
          { title: 'Purchase a phone number', body: 'In Twilio\'s console, go to Phone Numbers → Buy a Number. Choose your country and a number type (Local or Toll-Free). Purchase the number.' },
          { title: 'Add the number in OrbisVoice', body: 'Go to Phone Numbers in the OrbisVoice sidebar. Click "Add Number". Enter the Twilio number in E.164 format (e.g. +14155551234). Assign it to the Inbound channel.' },
          { title: 'Set the webhook in Twilio', body: 'In Twilio, go to Phone Numbers → Manage → your number. Set the "A call comes in" webhook to: https://api.myorbisvoice.com/api/webhooks/twilio/voice — HTTP POST.' },
          { title: 'Test', body: 'Call your Twilio number. The agent should answer within 2–3 rings.' },
        ],
        warnings: [
          'Twilio trial accounts can only call verified numbers. Upgrade to a paid account before going live.',
          'Never share your Twilio Auth Token. It provides full access to your Twilio account.',
        ],
      },
      {
        id: 'integrations-twilio-approval',
        title: 'Twilio Carrier Approvals: 10DLC, A2P, CNAM & STIR/SHAKEN',
        summary: 'Outbound calls and SMS require carrier approval before they will deliver. Here is exactly what to register and how long each takes.',
        steps: [
          { title: 'Why approvals exist', body: 'US carriers (Verizon, AT&T, T-Mobile, etc.) and federal regulators require all business-grade voice and SMS senders to be verified. Without these registrations, your outbound calls show as "Spam Likely" and your SMS messages get filtered or rejected. Inbound calls do not require any of this — they work the moment you set the webhook URL above.' },
          { title: 'Inbound voice — no approval needed', body: 'Buy a Twilio number, set its voice webhook to the URL shown above, and inbound calls reach your AI agent immediately. Skip the rest of this article if you only need inbound.' },
          { title: 'Outbound voice — STIR/SHAKEN attestation', body: 'STIR/SHAKEN is a federally mandated caller-ID verification standard. Twilio handles the attestation automatically for numbers you purchased through them, so most users get this for free. Verify it is active in Twilio: Voice → Calling → Trust Hub. If your numbers were ported from another carrier, you may need to file the trust profile manually. Approval is typically same-day.' },
          { title: 'Outbound voice — CNAM registration (optional but recommended)', body: 'CNAM is the "Caller Name" string that displays on the recipient\'s phone instead of just the number. To set it, go to Twilio Console → Phone Numbers → your number → CNAM Lookup, and submit your business name. Approval takes 1–3 business days. Cost: ~$1.25/month per number. Without CNAM, your number shows up as "Wireless Caller" or just the digits.' },
          { title: 'SMS — 10DLC registration (REQUIRED for US SMS)', body: '10DLC ("10-Digit Long Code") is the framework US carriers require for any business sending SMS from a regular phone number. Without 10DLC, your SMS will be heavily filtered or rejected outright. Register in Twilio: Messaging → Regulatory Compliance → US A2P 10DLC.' },
          { title: '10DLC step 1 — Register your Brand', body: 'Provide your legal business name, EIN/Tax ID, business address, website, and primary contact. Twilio submits this to The Campaign Registry (TCR). Brand approval: typically 1–2 business days. Cost: $4 one-time registration fee.' },
          { title: '10DLC step 2 — Create a Campaign', body: 'A "campaign" describes how you will use SMS. Pick a use case (Customer Care, Marketing, 2FA, etc.), describe your message flow, and provide sample messages. Campaign approval: 1–4 weeks (this is the slow step — varies by carrier). Cost: ~$10/month per campaign + $0.0025–$0.005 per message depending on tier.' },
          { title: '10DLC step 3 — Assign your number(s) to the campaign', body: 'Once both Brand and Campaign are approved, link your phone number(s) to the campaign in Twilio Console → Messaging → Senders. SMS sending becomes operational immediately after assignment.' },
          { title: 'Toll-free SMS — alternative to 10DLC', body: 'If you have a toll-free number (1-8XX), you go through Toll-Free Verification instead of 10DLC. Submit at Messaging → Regulatory Compliance → Toll-Free Verification. Approval: typically 2–5 business days. Often faster than 10DLC, but rates per message are higher.' },
          { title: 'International SMS', body: 'Each country has its own approval flow (e.g. UK requires sender ID registration, India requires DLT registration). If you plan to send SMS internationally, contact Twilio support for country-specific requirements before purchasing numbers in that region.' },
          { title: 'How to check approval status in OrbisVoice', body: 'Currently approval status lives in your Twilio Console (not yet surfaced in OrbisVoice). Go to Messaging → Regulatory Compliance to see Brand/Campaign state. We will add a status indicator to the Phone Numbers page in a future release.' },
        ],
        tips: [
          'Start the 10DLC Brand registration the same day you buy your first Twilio number — the 1–4 week wait runs in parallel with everything else you set up.',
          'For testing while 10DLC is pending, register your own personal phone numbers as "verified caller IDs" in Twilio — Twilio lets you SMS verified numbers without 10DLC.',
          'Outbound voice typically works with no approval beyond what Twilio does automatically — only SMS has the long approval wait.',
        ],
        warnings: [
          'Sending SMS without 10DLC registration will result in messages being silently dropped by carriers. You will see "delivered" in Twilio logs but recipients will never receive the message.',
          'Do not exaggerate your SMS volume on the campaign registration — under-declaring is fine, over-declaring triggers expensive higher-tier rates.',
          'Brand registration uses your business EIN. Sole proprietors with no EIN must register as a sole-prop brand which has stricter throughput limits.',
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
          { title: 'Adding a contact manually', body: 'Go to Contacts. Click "+ Add Contact". Fill in the required fields: First Name, Last Name, Phone Number (in E.164 format: +14155551234). Add optional fields as needed. Click Save.' },
          { title: 'Importing contacts from CSV', body: 'Click "Import CSV". Download the template to see the required column format. Fill in your contacts in the template. Upload the file. OrbisVoice will preview the first 5 rows for you to confirm the mapping before importing.' },
          { title: 'Required CSV columns', body: 'The CSV must have at minimum: firstName, lastName, phoneE164. Optional columns: email, company, tags (comma-separated), notes.' },
          { title: 'Editing a contact', body: 'Click any contact row to open their detail view. Edit any field and click Save. Changes take effect immediately — if the contact is in an active campaign, the updated info is used on the next call attempt.' },
          { title: 'Deleting contacts', body: 'Select one or more contacts using the checkboxes. Click "Delete Selected". Deleted contacts are removed from all future campaign runs but their call history is preserved in Conversations.' },
          { title: 'Tags and filtering', body: 'Add tags to contacts to group them (e.g. "Lead", "Customer", "VIP"). Use the filter bar to show only contacts with specific tags. Tags make it easy to build targeted campaign contact lists.' },
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
          { title: 'Create a campaign', body: 'Go to Campaigns. Click "+ New Campaign". Give it a name (internal reference only). Select the goal type: Lead Follow-Up, Appointment Reminder, Promotional Offer, Re-engagement, or Custom.' },
          { title: 'Select contacts', body: 'Choose which contacts to include: All contacts, Contacts with a specific tag, or a manually selected list. The contact count will update as you adjust the filter.' },
          { title: 'Write the campaign brief', body: 'In the "Script Brief" field, describe what the agent should accomplish in plain English. Example: "Call the contact, introduce yourself as [Agent Name] from [Business], and let them know about our summer promotion — 20% off all services booked before August 31. Try to book an appointment."' },
          { title: 'Set the schedule', body: 'Choose when calls should be made: immediately, at a specific date/time, or daily during a window (e.g. weekdays 10am–5pm). Set the timezone.' },
          { title: 'Set the retry policy', body: 'Choose how many times to retry unanswered numbers and the wait time between retries. Recommended: 2 retries, 4 hours apart.' },
          { title: 'Review and launch', body: 'Review the summary: contact count, estimated call duration, and schedule. Click "Launch Campaign". The campaign status will change to "Running" when calls begin.' },
          { title: 'Monitoring a campaign', body: 'While the campaign is running, the Campaigns page shows real-time stats: calls attempted, answered, completed, and failed. Click any contact row to see the outcome of their individual call.' },
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
          { title: 'Finding a conversation', body: 'Go to Conversations. Use the search bar to find by contact name or phone number. Use the filters to narrow by channel, status, or date range. Records are sorted newest first by default.' },
          { title: 'Reading the summary', body: 'The summary is a 2–3 sentence AI-generated overview of what happened in the conversation. It\'s generated automatically after every call ends. Use it to quickly understand what was discussed without listening to the full recording.' },
          { title: 'Reading the transcript', body: 'Click a conversation to open its detail view. The Transcript tab shows the full word-for-word exchange, labeled by speaker (Agent / Caller). Timestamps are shown per turn.' },
          { title: 'Listening to the recording', body: 'If call recording is enabled in Twilio, an audio player appears in the conversation detail view. Click play to listen. The recording is stored securely and only accessible to your account.' },
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
          { title: 'Viewing your current plan', body: 'Go to Billing in the sidebar. Your current plan is shown at the top with your billing cycle, next payment date, and monthly cost.' },
          { title: 'What entitlements are', body: 'Entitlements are the capabilities your plan includes: number of channels you can enable, voice minutes per month, number of contacts, and which features are available (e.g. outbound calling, recording). Your active entitlements are listed in the Billing page.' },
          { title: 'Upgrading your plan', body: 'Scroll to the plan comparison table. Click "Upgrade" on any higher-tier plan. You\'ll be taken to the Stripe checkout page. Enter your payment details and complete the purchase. Your entitlements update immediately.' },
          { title: 'Accessing invoices', body: 'Click "Manage Billing" to open the Stripe customer portal. From there you can download past invoices, update your payment method, and manage your subscription.' },
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
          { title: 'Workspace display name', body: 'The workspace name appears in your dashboard header and in admin views. It does not affect the agent\'s behavior — the agent uses the name from Business DNA.' },
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
          { title: 'Changing your password', body: 'Go to Settings. Scroll to the Security section. Enter your current password, then your new password twice. Click "Update Password". You will remain logged in after the change.' },
          { title: 'Password requirements', body: 'Passwords must be at least 8 characters. Use a mix of letters, numbers, and symbols for a strong password. Do not reuse passwords from other services.' },
          { title: 'If you forget your password', body: 'On the login page, click "Forgot?" next to the password field. Enter your email address and click Send Reset Link. Check your email for a reset link (check spam if it doesn\'t arrive in 2 minutes). The link expires after 30 minutes.' },
          { title: 'Logging out', body: 'Click your name or the sign-out button at the bottom of the sidebar to log out. Your session is immediately revoked — you\'ll need to log in again to access the portal.' },
        ],
        warnings: ['Never share your login credentials with anyone. If a team member needs access, contact support to add them as a Team Member with their own login.'],
      },
    ],
  },
]
