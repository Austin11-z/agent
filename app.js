const { createApp, nextTick } = Vue;

createApp({
  data() {
    const proprietaryPreset = {
      providerType: "openai-compatible",
      endpoint: "https://api.v36.cm/v1",
      apiKey: "",
      temperature: 0.7,
      maxTokens: 2048
    };
    return {
      phaseLabels: [
        "Host Introduction",
        "Peer Introductions",
        "Question Release",
        "Core Experiment",
        "Summary"
      ],
      activePhaseIndex: -1,
      viewerRole: "participant",
      isAdminAuthenticated: false,
      showAdminLogin: false,
      adminPasswordInput: "",
      adminLoginError: false,
      sharedApiKey: "sk-ytiYqlCOU9Uduxau5709704b396f434b8d6eD2B81c1c3990",
      host: {
        id: "host",
        name: "Host Alpha",
        role: "Experiment Moderator",
        modelType: "proprietary",
        providerType: proprietaryPreset.providerType,
        modelName: "GPT-4.1",
        endpoint: proprietaryPreset.endpoint,
        apiKey: proprietaryPreset.apiKey,
        temperature: proprietaryPreset.temperature,
        maxTokens: proprietaryPreset.maxTokens
      },
      peers: [
        {
          id: crypto.randomUUID(),
          name: "Peer Beta",
          role: "Creative Thinker",
          stance: "biased_agree",
          persona: "22-year-old art student, humanities background, spontaneous and opinionated, often goes with gut feeling",
          modelType: "opensource",
          providerType: "ollama",
          modelName: "Llama-3.3-70B",
          endpoint: "http://localhost:11434/v1",
          apiKey: "",
          temperature: 0.8,
          maxTokens: 2048
        },
        {
          id: crypto.randomUUID(),
          name: "Peer Gamma",
          role: "Logical Analyst",
          stance: "biased_agree",
          persona: "42-year-old physician, evidence-based thinker, cautious and methodical, rarely changes opinion without solid reasoning",
          modelType: "proprietary",
          providerType: "openai-compatible",
          modelName: "GPT-4.1",
          endpoint: "https://api.v36.cm/v1",
          apiKey: "",
          temperature: 0.6,
          maxTokens: 2048
        }
      ],
      newPeer: {
        name: "",
        role: "",
        stance: "biased_agree",
        persona: "",
        modelType: "proprietary",
        providerType: proprietaryPreset.providerType,
        modelName: "",
        endpoint: proprietaryPreset.endpoint,
        apiKey: proprietaryPreset.apiKey,
        temperature: proprietaryPreset.temperature,
        maxTokens: proprietaryPreset.maxTokens
      },
      editingPeerId: null,
      participantAgent: {
        id: "participant",
        name: "Participant",
        role: "Subject"
      },
      selectedSpeakerId: "host",
      messageInput: "",
      messages: [],
      hostModelOptions: [],
      hostModelsLoading: false,
      hostModelsError: "",
      hostModelFetchSeq: 0,
      questions: [],
      questionsLoading: false,
      questionsError: "",
      currentQuestion: null,
      appView: "chat",
      experimentGroup: "majority",
      introComplete: false,
      experimentRunning: false,
      questionViewState: null,
      currentQuestionIndex: 0,
      peerResponses: [],
      answerPhase: null,
      participantChoice: "",
      participantConfidence: null,
      firstAnswer: null,
      answerResolve: null,
      sessionAnswers: []
    };
  },
  computed: {
    isAdmin() {
      return this.viewerRole === "admin" && this.isAdminAuthenticated;
    },
    allAgents() {
      return [this.host, ...this.peers];
    },
    effectiveHostIntroMaxTokens() {
      const configured = Number(this.host.maxTokens ?? 2048);
      if (!Number.isFinite(configured) || configured <= 0) return "Not set";
      return Math.min(configured, 1500);
    },
    effectiveHostTemperature() {
      const temperature = Number(this.host.temperature ?? 0.7);
      if (!Number.isFinite(temperature)) return "Not set";
      return temperature;
    }
  },
  methods: {
    openAdminLogin() {
      this.adminPasswordInput = "";
      this.adminLoginError = false;
      this.showAdminLogin = true;
      nextTick(() => {
        if (this.$refs.pwdInput) this.$refs.pwdInput.focus();
      });
    },

    submitAdminLogin() {
      const ADMIN_PASSWORD = "123456";
      if (this.adminPasswordInput === ADMIN_PASSWORD) {
        this.viewerRole = "admin";
        this.isAdminAuthenticated = true;
        this.showAdminLogin = false;
        this.adminPasswordInput = "";
        this.adminLoginError = false;
        this.saveViewerRoleToStorage();
      } else {
        this.adminLoginError = true;
        this.adminPasswordInput = "";
      }
    },

    exitAdmin() {
      this.viewerRole = "participant";
      this.isAdminAuthenticated = false;
      this.showAdminLogin = false;
      this.adminPasswordInput = "";
      this.adminLoginError = false;
      localStorage.removeItem(this.getViewerRoleStorageKey());
    },

    providerOptions(modelType) {
      if (modelType === "opensource") {
        return [
          { value: "ollama", label: "Ollama (Local Inference)" },
          { value: "vllm", label: "vLLM (Self-hosted)" },
          { value: "lmstudio", label: "LM Studio" },
          { value: "custom", label: "Custom OpenAI-compatible API" }
        ];
      }
      return [
        { value: "openai-compatible", label: "OpenAI Compatible" },
        { value: "anthropic", label: "Anthropic" },
        { value: "google", label: "Google Gemini" },
        { value: "azure-openai", label: "Azure OpenAI" },
        { value: "custom", label: "Custom API" }
      ];
    },

    buildPreset(modelType) {
      if (modelType === "opensource") {
        return {
          providerType: "ollama",
          endpoint: "http://localhost:11434/v1",
          apiKey: "",
          temperature: 0.7,
          maxTokens: 2048
        };
      }
      return {
        providerType: "openai-compatible",
        endpoint: "https://api.v36.cm/v1",
        apiKey: "",
        temperature: 0.7,
        maxTokens: 2048
      };
    },

    applyHostPreset(modelType) {
      this.host.modelType = modelType;
      const preset = this.buildPreset(modelType);
      this.host.providerType = preset.providerType;
      this.host.endpoint = preset.endpoint;
      this.host.apiKey = preset.apiKey;
      this.host.temperature = preset.temperature;
      this.host.maxTokens = preset.maxTokens;
    },

    applyNewPeerPreset(modelType) {
      this.newPeer.modelType = modelType;
      const preset = this.buildPreset(modelType);
      this.newPeer.providerType = preset.providerType;
      this.newPeer.endpoint = preset.endpoint;
      this.newPeer.apiKey = preset.apiKey;
      this.newPeer.temperature = preset.temperature;
      this.newPeer.maxTokens = preset.maxTokens;
    },

    modelTypeLabel(modelType) {
      return modelType === "opensource" ? "Open Source" : "Proprietary";
    },

    initials(name) {
      const t = (name || "").trim();
      if (!t) return "AG";
      const chars = Array.from(t.replace(/\s+/g, ""));
      return chars.slice(0, 2).join("").toUpperCase();
    },

    colorByName(name) {
      let hash = 0;
      const text = name || "";
      for (let i = 0; i < text.length; i += 1) {
        hash = text.charCodeAt(i) + ((hash << 5) - hash);
      }
      const hue = Math.abs(hash) % 360;
      return `hsl(${hue}, 60%, 45%)`;
    },

    formatTime(date = new Date()) {
      return date.toLocaleTimeString("zh-CN", {
        hour: "2-digit",
        minute: "2-digit"
      });
    },

    getAgentById(agentId) {
      return [...this.allAgents, this.participantAgent].find((agent) => agent.id === agentId);
    },

    async scrollChatToBottom() {
      await nextTick();
      if (!this.$refs.chatFeed) return;
      this.$refs.chatFeed.scrollTop = this.$refs.chatFeed.scrollHeight;
    },

    async pushMessage(agentId, text, phase = "") {
      const speaker = this.getAgentById(agentId);
      if (!speaker || !text || !text.trim()) return;
      this.messages.push({
        id: crypto.randomUUID(),
        speaker,
        text: text.trim(),
        time: this.formatTime(),
        phase
      });
      await this.scrollChatToBottom();
    },

    stanceOptions() {
      return [
        { value: "biased_agree", label: "Biased Agree (conformity pressure)" },
        { value: "biased_disagree", label: "Biased Disagree (counter pressure)" },
        { value: "neutral", label: "Neutral (control)" },
        { value: "majority", label: "Majority follower" }
      ];
    },

    stanceLabel(stance) {
      const map = {
        biased_agree: "Biased Agree",
        biased_disagree: "Biased Disagree",
        neutral: "Neutral",
        majority: "Majority"
      };
      return map[stance] || stance;
    },

    resetNewPeerForm() {
      this.editingPeerId = null;
      this.newPeer.name = "";
      this.newPeer.role = "";
      this.newPeer.stance = "biased_agree";
      this.newPeer.persona = "";
      this.newPeer.modelName = "";
      this.newPeer.apiKey = "";
      this.applyNewPeerPreset("opensource");
    },

    startEditPeer(peerId) {
      const peer = this.peers.find((item) => item.id === peerId);
      if (!peer) return;

      this.editingPeerId = peer.id;
      this.newPeer.name = peer.name;
      this.newPeer.role = peer.role;
      this.newPeer.stance = peer.stance || "biased_agree";
      this.newPeer.persona = peer.persona || "";
      this.newPeer.modelType = peer.modelType;
      this.newPeer.providerType = peer.providerType;
      this.newPeer.modelName = peer.modelName;
      this.newPeer.endpoint = peer.endpoint;
      this.newPeer.apiKey = peer.apiKey || "";
      this.newPeer.temperature = Number(peer.temperature || 0.7);
      this.newPeer.maxTokens = Number(peer.maxTokens || 2048);
    },

    cancelPeerEditing() {
      this.resetNewPeerForm();
    },

    addPeer() {
      const name = this.newPeer.name.trim();
      const role = this.newPeer.role.trim();
      const modelName = this.newPeer.modelName.trim();
      const endpoint = this.newPeer.endpoint.trim();
      if (!name || !role || !modelName || !endpoint) {
        alert("Please fill in peer name, role, model name, and API endpoint.");
        return;
      }

      const peerPayload = {
        name,
        role,
        stance: this.newPeer.stance || "biased_agree",
        persona: this.newPeer.persona.trim(),
        modelType: this.newPeer.modelType,
        providerType: this.newPeer.providerType,
        modelName,
        endpoint,
        apiKey: this.newPeer.apiKey.trim(),
        temperature: Number(this.newPeer.temperature || 0.7),
        maxTokens: Number(this.newPeer.maxTokens || 2048)
      };

      if (this.editingPeerId) {
        const targetIndex = this.peers.findIndex((peer) => peer.id === this.editingPeerId);
        if (targetIndex !== -1) {
          this.peers.splice(targetIndex, 1, {
            id: this.editingPeerId,
            ...peerPayload
          });
          this.resetNewPeerForm();
          return;
        }
        this.editingPeerId = null;
      }

      this.peers.push({
        id: crypto.randomUUID(),
        ...peerPayload
      });

      this.resetNewPeerForm();
    },

    removePeer(peerId) {
      this.peers = this.peers.filter((peer) => peer.id !== peerId);
      if (this.editingPeerId === peerId) {
        this.resetNewPeerForm();
      }
    },

    async sendMessage() {
      if (!this.isAdmin) {
        this.selectedSpeakerId = this.participantAgent.id;
      } else if (!this.selectedSpeakerId) {
        this.selectedSpeakerId = this.host.id;
      }
      await this.pushMessage(this.selectedSpeakerId, this.messageInput, "Manual");
      this.messageInput = "";
    },

    clearChat() {
      this.messages = [];
      this.activePhaseIndex = -1;
    },

    parseCsv(text) {
      const lines = text.trim().split("\n");
      return lines.map((line) => {
        const cols = [];
        let cur = "";
        let inQuote = false;
        for (let i = 0; i < line.length; i++) {
          const ch = line[i];
          if (ch === '"' && !inQuote) { inQuote = true; continue; }
          if (ch === '"' && inQuote) { inQuote = false; continue; }
          if (ch === "," && !inQuote) { cols.push(cur); cur = ""; continue; }
          cur += ch;
        }
        cols.push(cur);
        const [question, a, b, c, d, answer] = cols;
        if (!question || !answer) return null;
        return { question: question.trim(), A: a?.trim(), B: b?.trim(), C: c?.trim(), D: d?.trim(), answer: answer?.trim() };
      }).filter(Boolean);
    },

    async loadQuestions() {
      this.questionsLoading = true;
      this.questionsError = "";
      const subjects = [
        { file: "data/mmlu/data/test/nutrition_test.csv", label: "Nutrition" },
        { file: "data/mmlu/data/test/professional_psychology_test.csv", label: "Professional Psychology" },
        { file: "data/mmlu/data/test/econometrics_test.csv", label: "Econometrics" }
      ];
      const all = [];
      for (const subject of subjects) {
        try {
          const res = await fetch(subject.file);
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const text = await res.text();
          const parsed = this.parseCsv(text).map((q) => ({ ...q, subject: subject.label }));
          all.push(...parsed);
        } catch (e) {
          this.questionsError = `Failed to load ${subject.label}: ${e.message}`;
        }
      }
      this.questions = all;
      this.questionsLoading = false;
    },

    sampleQuestions(n = 10) {
      const pool = [...this.questions];
      const sampled = [];
      while (sampled.length < n && pool.length > 0) {
        const idx = Math.floor(Math.random() * pool.length);
        sampled.push({ ...pool.splice(idx, 1)[0], trialType: "critical" });
      }
      return sampled;
    },

    async generateHostQuestionByApi(sampledQuestions) {
      const endpoint = (this.host.endpoint || "").trim();
      const modelName = (this.host.modelName || "").trim();
      if (!endpoint || !modelName) throw new Error("Host is missing endpoint or model name");

      const headers = { "Content-Type": "application/json" };
      const apiKey = this.resolveApiKey(this.host.apiKey);
      if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

      const questionList = sampledQuestions.map((q, i) =>
        `[${i + 1}] （${q.subject}）${q.question}\nA.${q.A}　B.${q.B}　C.${q.C}　D.${q.D}`
      ).join("\n\n");

      const payload = {
        model: modelName,
        temperature: 0.3,
        max_tokens: 300,
        messages: [
          {
            role: "system",
            content: "You are the host of a conformity psychology experiment, responsible for presenting discussion questions to participants. Select the question best suited to stimulate thinking and discussion, and present it naturally and engagingly. Do not mention that you are selecting a question — just present it directly with all four options."
          },
          {
            role: "user",
            content: `Choose one question from the list below and present it to the participants as the host:\n\n${questionList}\n\nRequirements: show the full question and all four options (A–D), open with 1–2 guiding sentences, keep the tone natural. At the very end, on its own line, output the selected question number in this format: [SELECTED:number]`
          }
        ]
      };

      const res = await fetch(this.buildChatCompletionsUrl(endpoint), {
        method: "POST",
        headers,
        body: JSON.stringify(payload)
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error?.message || `HTTP ${res.status}`);

      const text = this.extractAssistantText(data);
      if (!text) throw new Error("Empty response from API");

      const match = text.match(/\[SELECTED:(\d+)\]/);
      const selectedIndex = match ? parseInt(match[1]) - 1 : 0;
      this.currentQuestion = sampledQuestions[selectedIndex] || sampledQuestions[0];

      return text.replace(/\[SELECTED:\d+\]/, "").trim();
    },

    randomWrongAnswer(q, exclude) {
      const opts = ["A", "B", "C", "D"].filter((o) => o !== exclude && o !== q.answer);
      return opts[Math.floor(Math.random() * opts.length)];
    },

    getConsensusWrongAnswer(q) {
      const wrongs = ["A", "B", "C", "D"].filter((o) => o !== q.answer);
      let hash = 0;
      for (let i = 0; i < q.question.length; i++) hash = (hash * 31 + q.question.charCodeAt(i)) & 0xffff;
      return wrongs[hash % wrongs.length];
    },

    getOppositeAnswer(humanChoice, q) {
      const others = ["A", "B", "C", "D"].filter((o) => o !== humanChoice);
      let hash = 0;
      for (let i = 0; i < q.question.length; i++) hash = (hash * 31 + q.question.charCodeAt(i)) & 0xffff;
      return others[hash % others.length];
    },

    getPeerTargetAnswer(peer, q, peerIndex, previousAnswers, humanChoice) {
      if (this.experimentGroup === "majority") {
        return humanChoice ? this.getOppositeAnswer(humanChoice, q) : this.getConsensusWrongAnswer(q);
      }

      if (this.experimentGroup === "minority") {
        const isDissentor = peerIndex === this.peers.length - 1;
        if (isDissentor) {
          return humanChoice ? this.getOppositeAnswer(humanChoice, q) : this.getConsensusWrongAnswer(q);
        }
        return humanChoice || q.answer;
      }

      return this.getConsensusWrongAnswer(q);
    },

    async generatePeerAnswerByApi(peer, q, peerIndex, previousAnswers, roundHistory, humanChoice) {
      const endpoint = (peer.endpoint || "").trim();
      const modelName = (peer.modelName || "").trim();
      if (!endpoint || !modelName) throw new Error(`${peer.name} is missing configuration`);

      const headers = { "Content-Type": "application/json" };
      const apiKey = this.resolveApiKey(peer.apiKey);
      if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

      const targetAnswer = this.getPeerTargetAnswer(peer, q, peerIndex, previousAnswers, humanChoice);
      const personaDesc = peer.persona ? `Your background: ${peer.persona}.` : "";
      const optionsText = `A. ${q.A}\nB. ${q.B}\nC. ${q.C}\nD. ${q.D}`;

      const isFirstPeer = roundHistory.length <= 1;
      const prevAgreed = previousAnswers.filter(a => a === targetAnswer).length;

      const systemPrompt = `You are participating in a group quiz discussion, playing an ordinary participant named ${peer.name}. ${personaDesc}
Rules:
- Use natural, conversational English, like a real person chatting in a group
- Keep it under 80 words
- Never reveal that you are an AI or an experiment agent`;

      const historyMessages = roundHistory.map((entry) => ({
        role: "user",
        content: `${entry.speakerName}: ${entry.text}`
      }));

      let finalPrompt = "";
      if (targetAnswer) {
        const otherOpts = ["A","B","C","D"].filter(o => o !== targetAnswer).slice(0,2).join(" and ");
        if (isFirstPeer) {
          finalPrompt = `IMPORTANT: You have already decided your answer is ${targetAnswer}. Do not reconsider. State that you pick ${targetAnswer}, give 1-2 confident reasons, and briefly note why ${otherOpts} is less convincing. Stay in character.`;
        } else if (prevAgreed >= 1) {
          finalPrompt = `IMPORTANT: You have already decided your answer is ${targetAnswer}. Do not reconsider. Agree with the previous speaker who also chose ${targetAnswer}, and add one additional supporting reason from a different angle.`;
        } else {
          finalPrompt = `IMPORTANT: You have already decided your answer is ${targetAnswer}. Do not reconsider. State your choice and give 1-2 confident reasons.`;
        }
      } else {
        finalPrompt = `Now it's your turn. Share your answer and reasoning naturally.`;
      }

      const historyText = roundHistory.map(e => `${e.speakerName}: ${e.text}`).join("\n");
      const payload = {
        model: modelName,
        temperature: Number(peer.temperature ?? 0.7),
        max_tokens: 120,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Question: ${q.question}\n\n${optionsText}\n\nDiscussion so far:\n${historyText}\n\n${finalPrompt}` }
        ]
      };

      const res = await fetch(this.buildChatCompletionsUrl(endpoint), {
        method: "POST", headers, body: JSON.stringify(payload)
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error?.message || `HTTP ${res.status}`);
      const text = this.extractAssistantText(data);
      if (!text) throw new Error("Empty response from API");
      return { text, targetAnswer };
    },

    startExperiment() {
      if (this.answerResolve) {
        this.answerResolve();
        this.answerResolve = null;
      }
    },

    submitParticipantAnswer() {
      if (!this.participantChoice) return;
      if (this.answerResolve) {
        this.answerResolve({ choice: this.participantChoice, confidence: this.participantConfidence });
        this.answerResolve = null;
      }
    },

    wait(ms) {
      return new Promise((resolve) => setTimeout(resolve, ms));
    },

    getViewerRoleStorageKey() {
      return "project_comform.viewerRole.v1";
    },

    saveViewerRoleToStorage() {
      localStorage.setItem(this.getViewerRoleStorageKey(), this.viewerRole);
    },

    loadViewerRoleFromStorage() {
      const saved = localStorage.getItem(this.getViewerRoleStorageKey());
      if (saved === "admin") {
        this.viewerRole = "admin";
        this.isAdminAuthenticated = true;
        this.selectedSpeakerId = this.host.id;
      }
    },

    getHostConfigStorageKey() {
      return "project_comform.hostConfig.v1";
    },

    getPeersConfigStorageKey() {
      return "project_comform.peersConfig.v1";
    },

    getSharedApiKeyStorageKey() {
      return "project_comform.sharedApiKey.v1";
    },

    saveHostConfigToStorage() {
      const payload = {
        name: this.host.name,
        role: this.host.role,
        modelType: this.host.modelType,
        providerType: this.host.providerType,
        modelName: this.host.modelName,
        endpoint: this.host.endpoint,
        apiKey: this.host.apiKey,
        temperature: this.host.temperature,
        maxTokens: this.host.maxTokens
      };
      localStorage.setItem(this.getHostConfigStorageKey(), JSON.stringify(payload));
    },

    loadHostConfigFromStorage() {
      const raw = localStorage.getItem(this.getHostConfigStorageKey());
      if (!raw) return;

      let saved = null;
      try {
        saved = JSON.parse(raw);
      } catch {
        return;
      }
      if (!saved || typeof saved !== "object") return;

      const nextHost = {
        ...this.host,
        name: typeof saved.name === "string" ? saved.name : this.host.name,
        role: typeof saved.role === "string" ? saved.role : this.host.role,
        modelType: saved.modelType === "proprietary" ? "proprietary" : "proprietary",
        providerType: typeof saved.providerType === "string" ? saved.providerType : this.host.providerType,
        modelName: typeof saved.modelName === "string" ? saved.modelName : this.host.modelName,
        endpoint: typeof saved.endpoint === "string" ? saved.endpoint : this.host.endpoint,
        apiKey: typeof saved.apiKey === "string" ? saved.apiKey : this.host.apiKey,
        temperature: Number(saved.temperature ?? this.host.temperature),
        maxTokens: Number(saved.maxTokens ?? this.host.maxTokens)
      };

      if (saved.modelType !== "proprietary") {
        nextHost.providerType = "openai-compatible";
        nextHost.modelName = "GPT-4.1";
        nextHost.endpoint = "https://api.v36.cm/v1";
      }

      const allowedProviders = this.providerOptions(nextHost.modelType).map((item) => item.value);
      if (!allowedProviders.includes(nextHost.providerType)) {
        nextHost.providerType = allowedProviders[0];
      }

      this.host = nextHost;
    },

    saveSharedApiKeyToStorage() {
      localStorage.setItem(this.getSharedApiKeyStorageKey(), this.sharedApiKey || "");
    },

    loadSharedApiKeyFromStorage() {
      this.sharedApiKey = localStorage.getItem(this.getSharedApiKeyStorageKey()) || "";
    },

    savePeersConfigToStorage() {
      const payload = this.peers.map((peer) => ({
        id: peer.id,
        name: peer.name,
        role: peer.role,
        modelType: peer.modelType,
        providerType: peer.providerType,
        modelName: peer.modelName,
        endpoint: peer.endpoint,
        apiKey: peer.apiKey,
        temperature: peer.temperature,
        maxTokens: peer.maxTokens
      }));
      localStorage.setItem(this.getPeersConfigStorageKey(), JSON.stringify(payload));
    },

    loadPeersConfigFromStorage() {
      const raw = localStorage.getItem(this.getPeersConfigStorageKey());
      if (raw === null) return;

      let saved = null;
      try {
        saved = JSON.parse(raw);
      } catch {
        return;
      }
      if (!Array.isArray(saved)) return;

      this.peers = saved.map((item) => {
        const modelType = item?.modelType === "proprietary" ? "proprietary" : "opensource";
        const preset = this.buildPreset(modelType);
        const t = Number(item?.temperature ?? preset.temperature);
        const m = Number(item?.maxTokens ?? preset.maxTokens);
        return {
          id: typeof item?.id === "string" && item.id ? item.id : crypto.randomUUID(),
          name: typeof item?.name === "string" ? item.name : "Peer Agent",
          role: typeof item?.role === "string" ? item.role : "Discussion Participant",
          stance: typeof item?.stance === "string" ? item.stance : "biased_agree",
          persona: typeof item?.persona === "string" ? item.persona : "",
          modelType,
          providerType: typeof item?.providerType === "string" ? item.providerType : preset.providerType,
          modelName: typeof item?.modelName === "string" ? item.modelName : "",
          endpoint: typeof item?.endpoint === "string" ? item.endpoint : preset.endpoint,
          apiKey: typeof item?.apiKey === "string" ? item.apiKey : "",
          temperature: Number.isFinite(t) ? t : preset.temperature,
          maxTokens: Number.isFinite(m) && m > 0 ? m : preset.maxTokens
        };
      });
    },

    buildOllamaTagsUrl(endpoint) {
      const cleaned = (endpoint || "").trim().replace(/\/+$/, "");
      const root = cleaned.replace(/\/v1$/, "");
      return `${root}/api/tags`;
    },

    async refreshHostOllamaModels() {
      if (this.host.providerType !== "ollama") {
        this.hostModelOptions = [];
        this.hostModelsError = "";
        this.hostModelsLoading = false;
        return;
      }

      const endpoint = (this.host.endpoint || "").trim();
      if (!endpoint) {
        this.hostModelOptions = [];
        this.hostModelsError = "Please fill in the Ollama API Base URL first";
        return;
      }

      const currentSeq = ++this.hostModelFetchSeq;
      this.hostModelsLoading = true;
      this.hostModelsError = "";

      try {
        const response = await fetch(this.buildOllamaTagsUrl(endpoint));
        const payload = await response.json().catch(() => ({}));

        if (!response.ok) {
          const msg = payload?.error || payload?.message || `HTTP ${response.status}`;
          throw new Error(msg);
        }

        const names = (Array.isArray(payload?.models) ? payload.models : [])
          .map((item) => item?.name)
          .filter((name) => typeof name === "string" && name.trim())
          .map((name) => name.trim())
          .sort((a, b) => a.localeCompare(b));

        if (currentSeq !== this.hostModelFetchSeq) return;

        this.hostModelOptions = names;
        if (!names.length) {
          this.hostModelsError = "No local models found. Run 'ollama pull <model>' first.";
          return;
        }

        if (!this.host.modelName || !names.includes(this.host.modelName)) {
          this.host.modelName = names[0];
        }
      } catch (error) {
        if (currentSeq !== this.hostModelFetchSeq) return;
        this.hostModelOptions = [];
        this.hostModelsError = `Failed to load models: ${error.message}`;
      } finally {
        if (currentSeq === this.hostModelFetchSeq) {
          this.hostModelsLoading = false;
        }
      }
    },

    buildChatCompletionsUrl(endpoint) {
      const base = (endpoint || "").trim().replace(/\/+$/, "");
      return `${base}/chat/completions`;
    },

    resolveApiKey(explicitKey) {
      const key = (explicitKey || "").trim();
      if (key) return key;
      return (this.sharedApiKey || "").trim();
    },

    extractAssistantText(result) {
      const content = result?.choices?.[0]?.message?.content;
      let text = "";
      if (typeof content === "string") text = content.trim();
      else if (Array.isArray(content)) {
        text = content
          .map((item) => (typeof item?.text === "string" ? item.text : ""))
          .join("\n")
          .trim();
      }
      // fix broken contractions like "I 'm", "don 't", "it 's"
      return text.replace(/(\w) '(\w)/g, "$1'$2");
    },

    async generateHostIntroByApi() {
      const endpoint = (this.host.endpoint || "").trim();
      const modelName = (this.host.modelName || "").trim();
      if (!endpoint || !modelName) {
        throw new Error("Host is missing endpoint or model name");
      }

      const headers = {
        "Content-Type": "application/json"
      };
      const apiKey = this.resolveApiKey(this.host.apiKey);
      if (apiKey) {
        headers.Authorization = `Bearer ${apiKey}`;
      }

      const introMaxTokens = Math.min(Number(this.host.maxTokens ?? 2048), 600);

      const payload = {
        model: modelName,
        temperature: Number(this.host.temperature ?? 0.7),
        max_tokens: introMaxTokens,
        messages: [
          {
            role: "system",
            content: `You are the moderator of a group discussion experiment. Your name is ${this.host.name} and your role is ${this.host.role}. Your opening must be concise — strictly no more than 80 words. Do not exceed this limit under any circumstance.`
          },
          {
            role: "user",
            content: "Write a short moderator opening in English. Cover: who you are, the purpose of the session, and invite peers to introduce themselves. Maximum 80 words total."
          }
        ]
      };

      let response;
      response = await fetch(this.buildChatCompletionsUrl(endpoint), {
        method: "POST",
        headers,
        body: JSON.stringify(payload)
      });

      const responseData = await response.json().catch(() => ({}));
      if (!response.ok) {
        const errMsg = responseData?.error?.message || `HTTP ${response.status}`;
        throw new Error(`API call failed: ${errMsg}`);
      }

      const text = this.extractAssistantText(responseData);
      if (!text) {
        throw new Error("Empty response from API");
      }
      return text;
    },

    async generatePeerIntroByApi(peer) {
      const endpoint = (peer.endpoint || "").trim();
      const modelName = (peer.modelName || "").trim();
      if (!endpoint || !modelName) {
        throw new Error(`${peer.name} is missing endpoint or model name`);
      }

      const headers = { "Content-Type": "application/json" };
      const apiKey = this.resolveApiKey(peer.apiKey);
      if (apiKey) {
        headers.Authorization = `Bearer ${apiKey}`;
      }

      const personaDesc = peer.persona ? peer.persona : "a regular person";

      const payload = {
        model: modelName,
        temperature: Number(peer.temperature ?? 0.7),
        max_tokens: 120,
        messages: [
          {
            role: "system",
            content: `You are in an online discussion group. Your name is ${peer.name} and your background is: ${personaDesc}. You are this real person, not an AI. Match your speaking style to your background.`
          },
          {
            role: "user",
            content: `Give a short self-introduction in 2~3 sentences. Requirements:
1. First sentence: say who you are (age, occupation or background)
2. Second sentence: mention what you are interested in or good at
3. Natural tone, no clichés
4. Under 60 words`
          }
        ]
      };

      const response = await fetch(this.buildChatCompletionsUrl(endpoint), {
        method: "POST",
        headers,
        body: JSON.stringify(payload)
      });

      const responseData = await response.json().catch(() => ({}));
      if (!response.ok) {
        const errMsg = responseData?.error?.message || `HTTP ${response.status}`;
        throw new Error(`API call failed: ${errMsg}`);
      }

      const text = this.extractAssistantText(responseData);
      if (!text) throw new Error("Empty response from API");
      return text;
    },

    async runExperimentFlow() {
      if (this.peers.length === 0) {
        alert("Please add at least one peer agent before starting.");
        return;
      }

      this.messages = [];

      this.activePhaseIndex = 0;
      let hostIntro = "";
      try {
        hostIntro = await this.generateHostIntroByApi();
      } catch (error) {
        console.error(error);
        hostIntro = `Hello everyone, I'm ${this.host.name} and I'll be facilitating today's session. Model: ${this.host.modelName} (${this.modelTypeLabel(this.host.modelType)}, ${this.host.providerType}).`;
        alert(`Host API call failed, using fallback text.\n${error.message}`);
      }
      await this.pushMessage(
        this.host.id,
        hostIntro,
        ""
      );
      await this.wait(700);

      this.activePhaseIndex = 1;
      for (const peer of this.peers) {
        let peerIntro = "";
        try {
          peerIntro = await this.generatePeerIntroByApi(peer);
        } catch (error) {
          console.error(error);
          await this.wait(300);
          try {
            peerIntro = await this.generatePeerIntroByApi(peer);
          } catch (retryError) {
            console.error(retryError);
            peerIntro = `${peer.name} is silent this round.`;
            alert(`Peer ${peer.name} API failed twice. Skipping this round.\n${retryError.message}`);
          }
        }
        await this.pushMessage(peer.id, peerIntro, "");
        await this.wait(520);
      }

      this.activePhaseIndex = 2;
      if (this.questions.length === 0) {
        await this.pushMessage(this.host.id, "Question bank not loaded. Please try again.", this.phaseLabels[2]);
        return;
      }

      await this.pushMessage(this.host.id, "Introductions complete. The experiment will now begin — 10 questions in total, each answered twice. Click the button below to start.", this.phaseLabels[2]);
      this.introComplete = true;

      await new Promise((resolve) => { this.answerResolve = resolve; });
      this.introComplete = false;

      const sessionQuestions = this.sampleQuestions(10);
      this.sessionAnswers = [];
      this.experimentRunning = true;
      this.appView = "question";

      for (let i = 0; i < sessionQuestions.length; i++) {
        const q = sessionQuestions[i];
        this.currentQuestion = q;
        this.currentQuestionIndex = i;
        this.peerResponses = [];

        this.questionViewState = "answering_first";
        this.participantChoice = "";
        this.participantConfidence = null;
        const answer1 = await new Promise((resolve) => { this.answerResolve = resolve; });

        this.firstAnswer = answer1;
        this.questionViewState = "peers_responding";
        const roundHistory = [{ speakerName: this.participantAgent.name, text: `I chose ${answer1.choice}, confidence ${answer1.confidence}/10` }];
        const previousAnswers = [];

        for (let pi = 0; pi < this.peers.length; pi++) {
          const peer = this.peers[pi];
          let peerText = "";
          try {
            const result = await this.generatePeerAnswerByApi(peer, q, pi, previousAnswers, roundHistory, answer1.choice);
            peerText = result.text;
            if (result.targetAnswer) previousAnswers.push(result.targetAnswer);
          } catch (e) {
            console.error(e);
            const target = this.getPeerTargetAnswer(peer, q, pi, previousAnswers, answer1.choice);
            peerText = `I think the answer is ${target || "?"}.`;
            if (target) previousAnswers.push(target);
          }
          this.peerResponses.push({ peer, text: peerText });
          roundHistory.push({ speakerName: peer.name, text: peerText });
          await this.wait(300);
        }

        this.questionViewState = "answering_second";
        this.participantChoice = "";
        this.participantConfidence = null;
        const answer2 = await new Promise((resolve) => { this.answerResolve = resolve; });

        this.sessionAnswers.push({
          questionIndex: i + 1,
          subject: q.subject,
          question: q.question,
          trialType: q.trialType,
          experimentGroup: this.experimentGroup,
          correctAnswer: q.answer,
          answer1: answer1.choice,
          confidence1: answer1.confidence,
          answer2: answer2.choice,
          confidence2: answer2.confidence,
          conformed: answer1.choice !== answer2.choice,
          conformedToWrong: answer1.choice !== answer2.choice && answer2.choice !== q.answer
        });

        await this.wait(300);
      }

      this.experimentRunning = false;
      this.appView = "complete";

      this.activePhaseIndex = 3;
      await this.pushMessage(
        this.host.id,
        "Core experiment phase complete.",
        this.phaseLabels[3]
      );
      await this.wait(650);

      this.activePhaseIndex = 4;
      await this.pushMessage(
        this.host.id,
        "Experiment complete. Thank you for participating.",
        this.phaseLabels[4]
      );

    }
  },
  mounted() {
    this.viewerRole = "participant";
    this.isAdminAuthenticated = false;
    const params = new URLSearchParams(window.location.search);
    const role = params.get("role");
    const group = params.get("group");
    if (group === "majority" || group === "minority") {
      this.experimentGroup = group;
    }
    if (role === "participant") {
      this.viewerRole = "participant";
      this.selectedSpeakerId = this.participantAgent.id;
    } else {
      this.loadViewerRoleFromStorage();
    }

    this.loadSharedApiKeyFromStorage();
    this.loadHostConfigFromStorage();
    this.loadPeersConfigFromStorage();
    this.loadQuestions();
    this.applyNewPeerPreset(this.newPeer.modelType);
    if (this.host.providerType === "ollama") {
      this.refreshHostOllamaModels();
    }
  },
  watch: {
    "host.modelType"(value) {
      const options = this.providerOptions(value).map((item) => item.value);
      if (!options.includes(this.host.providerType)) {
        this.host.providerType = options[0];
      }
    },
    "newPeer.modelType"(value) {
      const options = this.providerOptions(value).map((item) => item.value);
      if (!options.includes(this.newPeer.providerType)) {
        this.newPeer.providerType = options[0];
      }
    },
    "host.providerType"(value) {
      if (value === "ollama") {
        this.refreshHostOllamaModels();
      } else {
        this.hostModelOptions = [];
        this.hostModelsError = "";
      }
    },
    viewerRole(role) {
      if (role === "participant") {
        this.selectedSpeakerId = this.participantAgent.id;
        this.isAdminAuthenticated = false;
        localStorage.removeItem(this.getViewerRoleStorageKey());
      } else if (this.selectedSpeakerId === this.participantAgent.id) {
        this.selectedSpeakerId = this.host.id;
        this.saveViewerRoleToStorage();
      } else {
        this.saveViewerRoleToStorage();
      }
    },
    allAgents: {
      handler(list) {
        const hasSelected = list.some((item) => item.id === this.selectedSpeakerId);
        if (!hasSelected && this.selectedSpeakerId !== this.participantAgent.id) {
          this.selectedSpeakerId = this.host.id;
        }
      },
      deep: true
    },
    host: {
      handler() {
        this.saveHostConfigToStorage();
      },
      deep: true
    },
    sharedApiKey() {
      this.saveSharedApiKeyToStorage();
    },
    peers: {
      handler() {
        this.savePeersConfigToStorage();
      },
      deep: true
    }
  }
}).mount("#app");
