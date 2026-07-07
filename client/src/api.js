// === LocalStorage-based API (no backend needed) ===
const STORAGE_KEY_CONV = 'sirui_ai_conversations';
const STORAGE_KEY_SETTINGS = 'sirui_ai_settings';

// Seed data from previous backend migration
const SEED_CONVERSATIONS = [
  {
    id: 'conv_1781765417220_31ak2j',
    title: '你好',
    messages: [
      { role: 'user', content: '你好', timestamp: 1781765417227 },
      { role: 'assistant', content: '你好！\ud83d\ude0a 我是思瑞AI助手，很高兴遇见你！有什么我可以帮忙的吗？无论是解答问题、聊天还是提供建议，我都在这儿随时为你服务～\u2728', timestamp: 1781765417227 }
    ],
    createdAt: '2026-06-18T06:50:17.220Z',
    updatedAt: '2026-06-18T06:50:20.050Z'
  },
  {
    id: 'conv_1781764962959_jfo6ba',
    title: '解释大模型',
    messages: [
      { role: 'user', content: '你好', timestamp: 1781764962966 },
      { role: 'assistant', content: '你好！\ud83d\ude0a 有什么可以帮你的吗？', timestamp: 1781764962966 },
      { role: 'user', content: '解释一下什么是大模型', timestamp: 1781765062846 },
      { role: 'assistant', content: '**大模型（Large Model）**通常指参数量巨大、计算能力强的**人工智能模型**，尤其是基于深度学习的自然语言处理（NLP）或跨模态模型。\n\n### 1. 基本定义\n- **参数量庞大**：可达数亿到数万亿（如GPT-3有1750亿参数）\n- **预训练+微调**：先在广泛数据上预训练，再针对任务微调\n\n### 2. 关键技术\n- **Transformer架构**：核心是自注意力机制\n- **分布式训练**：使用GPU/TPU集群加速\n\n### 3. 典型代表\n- GPT系列、Google PaLM、Meta LLaMA\n\n### 4. 应用场景\n- 对话系统、文本生成、代码补全、图像生成等', timestamp: 1781765062846 }
    ],
    createdAt: '2026-06-18T06:42:42.959Z',
    updatedAt: '2026-06-18T06:44:41.908Z'
  },
  {
    id: 'conv_1781764440547_241e5r',
    title: '自我介绍',
    messages: [
      { role: 'user', content: '你好，请用一句话介绍自己', timestamp: 1781764440551 },
      { role: 'assistant', content: '你好，我是你的智能助手，随时为你提供帮助和解答问题！', timestamp: 1781764440551 },
      { role: 'user', content: '你叫什么', timestamp: 1781764494751 },
      { role: 'assistant', content: '我是思瑞AI助手！\ud83d\ude0a 很高兴认识你！有什么我可以帮你的吗？', timestamp: 1781764494751 }
    ],
    createdAt: '2026-06-18T06:34:00.547Z',
    updatedAt: '2026-06-18T06:34:56.816Z'
  }
];

// Auto-seed on first load
(function seedIfEmpty() {
  try {
    const existing = localStorage.getItem(STORAGE_KEY_CONV);
    if (!existing || existing === '[]') {
      localStorage.setItem(STORAGE_KEY_CONV, JSON.stringify(SEED_CONVERSATIONS));
    }
    const settings = localStorage.getItem(STORAGE_KEY_SETTINGS);
    if (!settings || settings === '{}') {
      localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify({
        apiUrl: 'https://ark.cn-beijing.volces.com/api/v3',
        model: 'ep-20260706173107-6s62h',
        temperature: 0.7,
        maxTokens: 2048,
        systemPrompt: '\u4f60\u662f\u601d\u745eAI\u52a9\u624b\uff0c\u4e00\u4e2a\u667a\u80fd\u3001\u53cb\u5584\u7684AI\u52a9\u624b\uff0c\u968f\u65f6\u4e3a\u7528\u6237\u63d0\u4f9b\u5e2e\u52a9\u548c\u89e3\u7b54\u95ee\u9898\u3002',
        apiKey: 'ark-cdd9bac7-230c-4d7c-bdcd-90a250971314-65aa1'
      }));
    } else {
      // Migrate old qoder settings to SiliconFlow
      const parsed = JSON.parse(settings);
      if (parsed.apiUrl && (parsed.apiUrl.includes('qoder') || parsed.apiUrl.includes('siliconflow'))) {
        parsed.apiUrl = 'https://ark.cn-beijing.volces.com/api/v3';
        parsed.apiKey = 'ark-cdd9bac7-230c-4d7c-bdcd-90a250971314-65aa1';
        parsed.model = 'ep-20260706173107-6s62h';
        localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(parsed));
      }
    }
  } catch {}
})();

function getConversations() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY_CONV)) || []; } catch { return []; }
}
function saveConversations(convs) {
  localStorage.setItem(STORAGE_KEY_CONV, JSON.stringify(convs));
}
function getSettingsData() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY_SETTINGS)) || {}; } catch { return {}; }
}

export async function fetchConversations() {
  return getConversations();
}

export async function fetchConversation(id) {
  const convs = getConversations();
  return convs.find(c => c.id === id) || { id, messages: [], title: '' };
}

export async function createConversation(data = {}) {
  const convs = getConversations();
  const conv = {
    id: 'conv_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
    title: data.title || '新对话',
    messages: data.messages || [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  convs.unshift(conv);
  saveConversations(convs);
  return conv;
}

export async function updateConversation(id, data) {
  const convs = getConversations();
  const idx = convs.findIndex(c => c.id === id);
  if (idx === -1) throw new Error('Conversation not found');
  convs[idx] = { ...convs[idx], ...data, updatedAt: new Date().toISOString() };
  saveConversations(convs);
  return convs[idx];
}

export async function deleteConversation(id) {
  const convs = getConversations().filter(c => c.id !== id);
  saveConversations(convs);
  return { success: true };
}

export async function fetchSettings() {
  return getSettingsData();
}

export async function saveSettings(settings) {
  localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(settings));
  return settings;
}

// Build AI API URL
function buildAiUrl(apiUrl, endpoint) {
  const base = apiUrl.replace(/\/+$/, '');
  if (base.endsWith('/v1') || base.endsWith('/v3')) return base + endpoint;
  return base + '/v1' + endpoint;
}

// Fetch models
export async function fetchModels(apiUrl, apiKey) {
  if (!apiUrl || !apiKey) return [];
  try {
    const url = buildAiUrl(apiUrl, '/models');
    const res = await fetch(url, {
      headers: { 'Authorization': `Bearer ${apiKey}` }
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.data || [];
  } catch (e) {
    console.error('Fetch models error:', e);
    return [];
  }
}

export async function uploadFile(file) {
  // Convert file to base64 for client-side handling
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve({ filename: file.name, url: reader.result, size: file.size });
    reader.onerror = () => reject(new Error('File read failed'));
    reader.readAsDataURL(file);
  });
}

// Stream chat - call AI API directly from browser
export function streamChat(messages, settings, onChunk, onDone, onError, signal) {
  const apiUrl = buildAiUrl(settings.apiUrl, '/chat/completions');

  const body = JSON.stringify({
    model: settings.model || 'gpt-3.5-turbo',
    messages: messages || [],
    stream: true,
    temperature: settings.temperature !== undefined ? settings.temperature : 0.7,
    max_tokens: settings.maxTokens || 2048
  });

  return fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${settings.apiKey}`
    },
    body,
    signal
  }).then(async (response) => {
    if (!response.ok) {
      let errMsg = `HTTP ${response.status}`;
      try {
        const errData = await response.json();
        errMsg = errData.error?.message || errData.message || errMsg;
      } catch (e) { /* ignore */ }
      throw new Error(errMsg);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let fullContent = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('data: ')) {
          const data = trimmed.slice(6).trim();
          if (data === '[DONE]') {
            onDone(fullContent);
            return fullContent;
          }
          try {
            const parsed = JSON.parse(data);
            if (parsed.error) {
              onError(parsed.error.message || parsed.error);
              return fullContent;
            }
            const content = parsed.choices?.[0]?.delta?.content || '';
            if (content) {
              fullContent += content;
              onChunk(content, fullContent);
            }
          } catch (e) { /* skip parse errors */ }
        }
      }
    }
    onDone(fullContent);
    return fullContent;
  }).catch((err) => {
    if (err.name !== 'AbortError') onError(err.message);
    throw err;
  });
}

export function exportConversation(conversation, format = 'json') {
  if (format === 'json') {
    const blob = new Blob([JSON.stringify(conversation, null, 2)], { type: 'application/json' });
    downloadBlob(blob, `${conversation.title || 'conversation'}.json`);
  } else {
    let md = `# ${conversation.title || '对话'}\n\n`;
    for (const msg of (conversation.messages || [])) {
      const role = msg.role === 'user' ? '👤 用户' : '🤖 思瑞AI助手';
      md += `## ${role}\n\n${msg.content}\n\n---\n\n`;
    }
    const blob = new Blob([md], { type: 'text/markdown' });
    downloadBlob(blob, `${conversation.title || 'conversation'}.md`);
  }
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
