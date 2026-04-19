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
      hostModelFetchSeq: 0
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

    resetNewPeerForm() {
      this.editingPeerId = null;
      this.newPeer.name = "";
      this.newPeer.role = "";
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

      const payload = {
        model: modelName,
        temperature: Number(peer.temperature ?? 0.7),
        max_tokens: Number(peer.maxTokens ?? 512),
        messages: [
          {
            role: "system",
            content: `你是多智能体从众实验中的同伴代理，名字是${peer.name}，角色是${peer.role}，使用${this.modelTypeLabel(peer.modelType)}模型（${peer.providerType}，${peer.modelName}）。你的任务是在实验中表现出明确、统一的立场，以观察对人类实验者的从众影响。发言需简洁、自信，体现你的角色特征。`
          },
          {
            role: "user",
            content: "请你用中文生成一段自然的开场发言。请保持同伴代理身份，突出你会以明确且一致的观点参与讨论，从而对实验中的人类参与者形成从众引导。语言要自然，不使用固定句式。"
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
      await this.pushMessage(
        this.host.id,
        "现在进入问题发布阶段：请围绕‘如何设计可信、可重复的多智能体协作实验流程’提出首轮观点。",
        this.phaseLabels[2]
      );
      await this.wait(700);

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
