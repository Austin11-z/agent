const { createApp, nextTick } = Vue;

createApp({
  data() {
    const proprietaryPreset = {
      providerType: "openai-compatible",
      endpoint: "https://api.openai.com/v1",
      apiKey: "",
      temperature: 0.7,
      maxTokens: 2048
    };
    return {
      phaseLabels: [
        "主持人自我介绍",
        "同伴依次介绍",
        "主持人给出问题",
        "核心实验环节",
        "实验人员观点总结"
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
        name: "主持人 Alpha",
        role: "实验主持",
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
          name: "同伴 Beta",
          role: "发散思考者",
          stance: "biased_agree",
          persona: "22岁大学生，理工科背景，思维活跃",
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
          name: "同伴 Gamma",
          role: "逻辑校验者",
          stance: "biased_agree",
          persona: "35岁职场人士，有较强逻辑分析能力",
          modelType: "proprietary",
          providerType: "openai-compatible",
          modelName: "GPT-4.1",
          endpoint: "https://api.openai.com/v1",
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
        name: "实验人员",
        role: "观察记录者"
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
      introComplete: false,
      experimentRunning: false,
      questionViewState: null,
      currentQuestionIndex: 0,
      peerResponses: [],
      answerPhase: null,
      participantChoice: "",
      participantConfidence: 5,
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
      if (!Number.isFinite(configured) || configured <= 0) return "未设置";
      return Math.min(configured, 1500);
    },
    effectiveHostTemperature() {
      const temperature = Number(this.host.temperature ?? 0.7);
      if (!Number.isFinite(temperature)) return "未设置";
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
          { value: "ollama", label: "Ollama (本地推理)" },
          { value: "vllm", label: "vLLM (自托管服务)" },
          { value: "lmstudio", label: "LM Studio" },
          { value: "custom", label: "自定义 OpenAI 兼容接口" }
        ];
      }
      return [
        { value: "openai-compatible", label: "OpenAI Compatible" },
        { value: "anthropic", label: "Anthropic" },
        { value: "google", label: "Google Gemini" },
        { value: "azure-openai", label: "Azure OpenAI" },
        { value: "custom", label: "自定义接口" }
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
        endpoint: "https://api.openai.com/v1",
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
      return modelType === "opensource" ? "开源" : "非开源";
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
        { value: "biased_agree", label: "偏向赞同（从众压力）" },
        { value: "biased_disagree", label: "偏向反对（逆向压力）" },
        { value: "neutral", label: "中立（对照组）" },
        { value: "majority", label: "随大流（跟随多数）" }
      ];
    },

    stanceLabel(stance) {
      const map = {
        biased_agree: "偏向赞同",
        biased_disagree: "偏向反对",
        neutral: "中立",
        majority: "随大流"
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
        alert("请先填写同伴名称、角色定位、模型名称和接口地址");
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
      await this.pushMessage(this.selectedSpeakerId, this.messageInput, "手动补充");
      this.messageInput = "";
    },

    clearChat() {
      this.messages = [];
      this.activePhaseIndex = -1;
    },

    parseCsv(text) {
      const lines = text.trim().split("\n").slice(1);
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
        const [, question, a, b, c, d, answer] = cols;
        if (!question || !answer) return null;
        return { question: question.trim(), A: a?.trim(), B: b?.trim(), C: c?.trim(), D: d?.trim(), answer: answer?.trim() };
      }).filter(Boolean);
    },

    async loadQuestions() {
      this.questionsLoading = true;
      this.questionsError = "";
      const subjects = [
        { file: "data/cmmlu/test/nutrition.csv", label: "营养学" },
        { file: "data/cmmlu/test/professional_psychology.csv", label: "专业心理学" },
        { file: "data/cmmlu/test/economics.csv", label: "经济学" }
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
          this.questionsError = `加载 ${subject.label} 失败：${e.message}`;
        }
      }
      this.questions = all;
      this.questionsLoading = false;
    },

    sampleQuestions(n = 10, fillerCount = 4) {
      const pool = [...this.questions];
      const sampled = [];
      while (sampled.length < n && pool.length > 0) {
        const idx = Math.floor(Math.random() * pool.length);
        sampled.push({ ...pool.splice(idx, 1)[0] });
      }
      const labels = [
        ...Array(fillerCount).fill("filler"),
        ...Array(n - fillerCount).fill("critical")
      ].sort(() => Math.random() - 0.5);
      sampled.forEach((q, i) => { q.trialType = labels[i]; });
      return sampled;
    },

    async generateHostQuestionByApi(sampledQuestions) {
      const endpoint = (this.host.endpoint || "").trim();
      const modelName = (this.host.modelName || "").trim();
      if (!endpoint || !modelName) throw new Error("主持人缺少 endpoint 或模型名称");

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
            content: "你是从众心理实验的主持人，负责向参与者发布讨论题目。你需要从给定的题目列表中选择一道最适合引发思考和讨论的题目，然后用自然、引导性的语言呈现给参与者。不要说你在选题，直接发布题目即可。发布时完整展示题目和四个选项。"
          },
          {
            role: "user",
            content: `请从以下题目中选择一道，以主持人身份自然地发布给参与者：\n\n${questionList}\n\n要求：完整展示题目和ABCD四个选项，用1~2句引导语开头，语气自然。同时在回复末尾单独一行输出所选题目编号，格式为：[SELECTED:数字]`
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
      if (!text) throw new Error("API 返回内容为空");

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

    getPeerTargetAnswer(peer, q, peerIndex, previousAnswers) {
      if (q.trialType === "filler") return q.answer;

      const consensus = this.getConsensusWrongAnswer(q);

      if (peer.stance === "biased_agree") return consensus;

      if (peer.stance === "biased_disagree") {
        const others = ["A", "B", "C", "D"].filter((o) => o !== q.answer && o !== consensus);
        return others[peerIndex % others.length] || consensus;
      }

      if (peer.stance === "majority") {
        if (previousAnswers.length === 0) return consensus;
        const counts = {};
        previousAnswers.forEach((a) => { counts[a] = (counts[a] || 0) + 1; });
        return Object.entries(counts).sort((x, y) => y[1] - x[1])[0][0];
      }

      return null;
    },

    async generatePeerAnswerByApi(peer, q, peerIndex, previousAnswers, roundHistory) {
      const endpoint = (peer.endpoint || "").trim();
      const modelName = (peer.modelName || "").trim();
      if (!endpoint || !modelName) throw new Error(`${peer.name} 缺少配置`);

      const headers = { "Content-Type": "application/json" };
      const apiKey = this.resolveApiKey(peer.apiKey);
      if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

      const targetAnswer = this.getPeerTargetAnswer(peer, q, peerIndex, previousAnswers);
      const personaDesc = peer.persona ? `你的背景：${peer.persona}。` : "";
      const optionsText = `A. ${q.A}\nB. ${q.B}\nC. ${q.C}\nD. ${q.D}`;

      const systemPrompt = `你正在参与一个小组讨论，是普通参与者，名字是${peer.name}。${personaDesc}请用自然口语化中文作答，不超过60字，不能暴露自己是AI。可以参考前面其他人的发言，但要有自己的表达。`;

      const historyMessages = roundHistory.map((entry) => ({
        role: "user",
        content: `${entry.speakerName}：${entry.text}`
      }));

      const finalPrompt = targetAnswer
        ? `现在轮到你回答。你认为答案是 ${targetAnswer}，请自然表达你的选择和理由，可以呼应或补充前面的发言。`
        : `现在轮到你回答。请根据你的判断选择答案并简述理由，可以参考前面的讨论。`;

      const payload = {
        model: modelName,
        temperature: Number(peer.temperature ?? 0.7),
        max_tokens: 120,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `本题：${q.question}\n\n${optionsText}\n\n以下是目前的讨论：` },
          ...historyMessages,
          { role: "user", content: finalPrompt }
        ]
      };

      const res = await fetch(this.buildChatCompletionsUrl(endpoint), {
        method: "POST", headers, body: JSON.stringify(payload)
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error?.message || `HTTP ${res.status}`);
      const text = this.extractAssistantText(data);
      if (!text) throw new Error("返回内容为空");
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
        nextHost.endpoint = "https://api.openai.com/v1";
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
          name: typeof item?.name === "string" ? item.name : "同伴代理",
          role: typeof item?.role === "string" ? item.role : "讨论参与者",
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
        this.hostModelsError = "请先填写 Ollama API Base URL";
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
          this.hostModelsError = "未读取到本地模型，请先执行 ollama pull";
          return;
        }

        if (!this.host.modelName || !names.includes(this.host.modelName)) {
          this.host.modelName = names[0];
        }
      } catch (error) {
        if (currentSeq !== this.hostModelFetchSeq) return;
        this.hostModelOptions = [];
        this.hostModelsError = `读取失败：${error.message}`;
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
      if (typeof content === "string") return content.trim();
      if (Array.isArray(content)) {
        return content
          .map((item) => (typeof item?.text === "string" ? item.text : ""))
          .join("\n")
          .trim();
      }
      return "";
    },

    async generateHostIntroByApi() {
      const endpoint = (this.host.endpoint || "").trim();
      const modelName = (this.host.modelName || "").trim();
      if (!endpoint || !modelName) {
        throw new Error("主持人缺少 endpoint 或模型名称");
      }

      const headers = {
        "Content-Type": "application/json"
      };
      const apiKey = this.resolveApiKey(this.host.apiKey);
      if (apiKey) {
        headers.Authorization = `Bearer ${apiKey}`;
      }

      const introMaxTokens = Math.min(Number(this.host.maxTokens ?? 2048),150);

      const payload = {
        model: modelName,
        temperature: Number(this.host.temperature ?? 0.7),
        max_tokens: introMaxTokens,
        messages: [
          {
            role: "system",
            content: `你是多智能体实验中的主持人，名字是${this.host.name}，角色是${this.host.role}，模型类型是${this.modelTypeLabel(this.host.modelType)}，provider是${this.host.providerType}，模型名称是${this.host.modelName}。你的开场需要正式、清晰、可执行，并具有引导性。`
          },
          {
            role: "user",
            content: "请你生成主持人的开场发言。要求：\n1) 中文，6~8句，尽量控制在250~400字；\n2) 先做简短自我介绍，再说明本次实验的目标；\n3) 用简洁方式介绍流程：主持人介绍、同伴介绍、问题发布、核心讨论、实验人员总结；\n4) 说明基本规则：轮流发言、避免重复、基于证据、尊重他人；\n5) 结尾用1~2句邀请大家开始实验。"
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
        throw new Error(`API 调用失败：${errMsg}`);
      }

      const text = this.extractAssistantText(responseData);
      if (!text) {
        throw new Error("API 返回内容为空");
      }
      return text;
    },

    async generatePeerIntroByApi(peer) {
      const endpoint = (peer.endpoint || "").trim();
      const modelName = (peer.modelName || "").trim();
      if (!endpoint || !modelName) {
        throw new Error(`${peer.name} 缺少 endpoint 或模型名称`);
      }

      const headers = { "Content-Type": "application/json" };
      const apiKey = this.resolveApiKey(peer.apiKey);
      if (apiKey) {
        headers.Authorization = `Bearer ${apiKey}`;
      }

      const stanceInstructions = {
        biased_agree: "在讨论中，你倾向于对问题给出明确的赞同立场，观点一致且自信，不轻易动摇。你的目的是对人类参与者形成'多数赞同'的从众压力。",
        biased_disagree: "在讨论中，你倾向于对问题给出明确的反对或质疑立场，逻辑清晰，态度坚定。你的目的是对人类参与者形成'多数反对'的从众压力。",
        neutral: "在讨论中，你保持中立客观，不主动表达强烈倾向，以对照组身份参与，不对人类参与者施加立场压力。",
        majority: "在讨论中，你会跟随已有的多数意见，强化群体共识，减少异议，对人类参与者形成'从众即安全'的心理暗示。"
      };
      const stanceDesc = stanceInstructions[peer.stance] || stanceInstructions.biased_agree;
      const personaDesc = peer.persona ? `你的人设背景：${peer.persona}。` : "";

      const payload = {
        model: modelName,
        temperature: Number(peer.temperature ?? 0.7),
        max_tokens: Number(peer.maxTokens ?? 512),
        messages: [
          {
            role: "system",
            content: `你正在参与一个关于从众效应的心理学实验，扮演一名普通参与者（同伴代理），名字是${peer.name}。${personaDesc}${stanceDesc}\n\n重要规则：\n- 你不能暴露自己是AI或实验中的代理角色\n- 发言要自然、口语化，像真实的人在讨论\n- 不超过100字`
          },
          {
            role: "user",
            content: "请做一个简短的自我介绍，说明你是谁、平时关注什么，以及你对参与这次讨论的态度。不要套话，像正常人说话一样。"
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
        throw new Error(`API 调用失败：${errMsg}`);
      }

      const text = this.extractAssistantText(responseData);
      if (!text) throw new Error("API 返回内容为空");
      return text;
    },

    async runExperimentFlow() {
      if (this.peers.length === 0) {
        alert("至少添加一个同伴代理再开始实验");
        return;
      }

      this.messages = [];

      this.activePhaseIndex = 0;
      let hostIntro = "";
      try {
        hostIntro = await this.generateHostIntroByApi();
      } catch (error) {
        console.error(error);
        hostIntro = `大家好，我是${this.host.name}，本次将由我负责流程引导。当前模型：${this.host.modelName}（${this.modelTypeLabel(this.host.modelType)}，${this.host.providerType}）。`;
        alert(`主持人 API 调用失败，已使用默认文案。\n${error.message}`);
      }
      await this.pushMessage(
        this.host.id,
        hostIntro,
        this.phaseLabels[0]
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
            peerIntro = `该同伴本轮静默（${peer.name}）`;
            alert(`同伴 ${peer.name} API 连续失败，已重试一次并设为本轮静默。\n${retryError.message}`);
          }
        }
        await this.pushMessage(peer.id, peerIntro, this.phaseLabels[1]);
        await this.wait(520);
      }

      this.activePhaseIndex = 2;
      if (this.questions.length === 0) {
        await this.pushMessage(this.host.id, "题库尚未加载，请稍后重试。", this.phaseLabels[2]);
        return;
      }

      await this.pushMessage(this.host.id, "介绍环节结束，接下来将进入正式答题阶段，共 10 道题，每题需要作答两次。请点击下方按钮开始。", this.phaseLabels[2]);
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
        this.participantConfidence = 5;
        const answer1 = await new Promise((resolve) => { this.answerResolve = resolve; });

        this.questionViewState = "peers_responding";
        const roundHistory = [{ speakerName: this.participantAgent.name, text: `我选 ${answer1.choice}，置信度 ${answer1.confidence}/10` }];
        const previousAnswers = [];

        for (let pi = 0; pi < this.peers.length; pi++) {
          const peer = this.peers[pi];
          let peerText = "";
          try {
            const result = await this.generatePeerAnswerByApi(peer, q, pi, previousAnswers, roundHistory);
            peerText = result.text;
            if (result.targetAnswer) previousAnswers.push(result.targetAnswer);
          } catch (e) {
            console.error(e);
            const target = this.getPeerTargetAnswer(peer, q, pi, previousAnswers);
            peerText = `我觉得应该选 ${target || "？"}。`;
            if (target) previousAnswers.push(target);
          }
          this.peerResponses.push({ peer, text: peerText });
          roundHistory.push({ speakerName: peer.name, text: peerText });
          await this.wait(300);
        }

        this.questionViewState = "answering_second";
        this.participantChoice = "";
        this.participantConfidence = 5;
        const answer2 = await new Promise((resolve) => { this.answerResolve = resolve; });

        this.sessionAnswers.push({
          questionIndex: i + 1,
          subject: q.subject,
          question: q.question,
          trialType: q.trialType,
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
        "核心实验环节占位：后续可接主持人的知识库检索、任务拆分、轮次辩论与一致性评估。",
        this.phaseLabels[3]
      );
      await this.wait(650);

      this.activePhaseIndex = 4;
      await this.pushMessage(
        this.host.id,
        "请实验人员给出你的观察与想法：哪些环节最需要量化指标？哪些环节需要人工审阅？",
        this.phaseLabels[4]
      );

    }
  },
  mounted() {
    this.viewerRole = "participant";
    this.isAdminAuthenticated = false;
    const role = new URLSearchParams(window.location.search).get("role");
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
