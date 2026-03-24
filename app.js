// ===== State =====
const state = {
  apiKey: localStorage.getItem('claude_api_key') || '',
  model: localStorage.getItem('claude_model') || 'claude-opus-4-6',
  systemPrompt: localStorage.getItem('claude_system_prompt') || '',
  knowledgeText: localStorage.getItem('claude_knowledge') || '',
  conversations: JSON.parse(localStorage.getItem('claude_conversations') || '{}'),
  currentConvId: localStorage.getItem('claude_current_conv') || null,
  isStreaming: false,
};

// ===== DOM Refs =====
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const dom = {
  chatContainer: $('#chatContainer'),
  messages: $('#messages'),
  welcomeScreen: $('#welcomeScreen'),
  messageInput: $('#messageInput'),
  sendBtn: $('#sendBtn'),
  menuBtn: $('#menuBtn'),
  settingsBtn: $('#settingsBtn'),
  sidebar: $('#sidebar'),
  sidebarOverlay: $('#sidebarOverlay'),
  conversationList: $('#conversationList'),
  newChatBtn: $('#newChatBtn'),
  settingsModal: $('#settingsModal'),
  closeSettings: $('#closeSettings'),
  apiKeyInput: $('#apiKeyInput'),
  toggleApiKey: $('#toggleApiKey'),
  modelSelect: $('#modelSelect'),
  systemPrompt: $('#systemPrompt'),
  knowledgeText: $('#knowledgeText'),
  knowledgeToggle: $('#knowledgeToggle'),
  saveSettings: $('#saveSettings'),
  headerTitle: $('#headerTitle'),
  modelBadge: $('#modelBadge'),
};

// ===== Init =====
function init() {
  loadSettings();
  renderConversationList();
  if (state.currentConvId && state.conversations[state.currentConvId]) {
    loadConversation(state.currentConvId);
  }
  updateModelBadge();
  bindEvents();

  if (!state.apiKey) {
    setTimeout(() => openSettings(), 400);
  }
}

// ===== Settings =====
function loadSettings() {
  dom.apiKeyInput.value = state.apiKey;
  dom.modelSelect.value = state.model;
  dom.systemPrompt.value = state.systemPrompt;
  dom.knowledgeText.value = state.knowledgeText;
  // Set toggle based on current conversation
  const conv = state.currentConvId && state.conversations[state.currentConvId];
  dom.knowledgeToggle.checked = conv ? conv.useKnowledge !== false : true;
}

function saveSettingsToStorage() {
  state.apiKey = dom.apiKeyInput.value.trim();
  state.model = dom.modelSelect.value;
  state.systemPrompt = dom.systemPrompt.value.trim();
  state.knowledgeText = dom.knowledgeText.value.trim();

  localStorage.setItem('claude_api_key', state.apiKey);
  localStorage.setItem('claude_model', state.model);
  localStorage.setItem('claude_system_prompt', state.systemPrompt);
  localStorage.setItem('claude_knowledge', state.knowledgeText);

  // Save knowledge toggle per conversation
  if (state.currentConvId && state.conversations[state.currentConvId]) {
    state.conversations[state.currentConvId].useKnowledge = dom.knowledgeToggle.checked;
    saveConversations();
  }

  updateModelBadge();
  closeSettingsModal();
  showToast('設定を保存しました');
}

function updateModelBadge() {
  const name = state.model.includes('opus') ? 'Opus' : state.model.includes('haiku') ? 'Haiku' : 'Sonnet';
  dom.modelBadge.textContent = name;
}

function openSettings() {
  dom.settingsModal.classList.add('active');
  loadSettings();
}

function closeSettingsModal() {
  dom.settingsModal.classList.remove('active');
}

// ===== Sidebar =====
function openSidebar() {
  dom.sidebar.classList.add('open');
  dom.sidebarOverlay.classList.add('active');
}

function closeSidebar() {
  dom.sidebar.classList.remove('open');
  dom.sidebarOverlay.classList.remove('active');
}

// ===== Conversations =====
function createNewConversation() {
  const id = 'conv_' + Date.now();
  state.conversations[id] = {
    title: '新しい会話',
    messages: [],
    useKnowledge: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  state.currentConvId = id;
  saveConversations();
  renderConversationList();
  clearChat();
  closeSidebar();
  dom.messageInput.focus();
  return id;
}

function loadConversation(id) {
  if (!state.conversations[id]) return;
  state.currentConvId = id;
  localStorage.setItem('claude_current_conv', id);

  clearChat();
  const conv = state.conversations[id];
  if (conv.messages.length > 0) {
    dom.welcomeScreen.classList.add('hidden');
    conv.messages.forEach(msg => {
      appendMessage(msg.role, msg.content, false);
    });
    scrollToBottom();
  }
  dom.headerTitle.textContent = conv.title;
  renderConversationList();
}

function deleteConversation(id, e) {
  e.stopPropagation();
  delete state.conversations[id];
  if (state.currentConvId === id) {
    state.currentConvId = null;
    localStorage.removeItem('claude_current_conv');
    clearChat();
    dom.welcomeScreen.classList.remove('hidden');
    dom.headerTitle.textContent = 'Claude Chat';
  }
  saveConversations();
  renderConversationList();
}

function saveConversations() {
  localStorage.setItem('claude_conversations', JSON.stringify(state.conversations));
  localStorage.setItem('claude_current_conv', state.currentConvId);
}

function renderConversationList() {
  const ids = Object.keys(state.conversations).sort((a, b) => {
    return new Date(state.conversations[b].updatedAt) - new Date(state.conversations[a].updatedAt);
  });

  dom.conversationList.innerHTML = ids.map(id => {
    const conv = state.conversations[id];
    const date = new Date(conv.updatedAt);
    const dateStr = formatDate(date);
    const isActive = id === state.currentConvId;
    return `
      <div class="conv-item ${isActive ? 'active' : ''}" data-id="${id}">
        <div class="conv-item-info">
          <div class="conv-item-title">${escapeHtml(conv.title)}</div>
          <div class="conv-item-date">${dateStr}</div>
        </div>
        <button class="conv-item-delete" data-delete-id="${id}" aria-label="Delete">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
        </button>
      </div>
    `;
  }).join('');

  // Bind click events
  dom.conversationList.querySelectorAll('.conv-item').forEach(el => {
    el.addEventListener('click', () => {
      loadConversation(el.dataset.id);
      closeSidebar();
    });
  });

  dom.conversationList.querySelectorAll('.conv-item-delete').forEach(el => {
    el.addEventListener('click', (e) => deleteConversation(el.dataset.deleteId, e));
  });
}

// ===== Chat =====
function clearChat() {
  dom.messages.innerHTML = '';
  dom.welcomeScreen.classList.remove('hidden');
}

function appendMessage(role, content, animate = true) {
  dom.welcomeScreen.classList.add('hidden');

  const el = document.createElement('div');
  el.className = `message ${role}`;
  if (!animate) el.style.animation = 'none';

  if (role === 'assistant') {
    el.innerHTML = `<div class="msg-content">${renderMarkdown(content)}</div>`;
    // Add copy buttons to code blocks
    el.querySelectorAll('pre').forEach(addCopyButton);
  } else if (role === 'error') {
    el.textContent = content;
  } else {
    el.textContent = content;
  }

  dom.messages.appendChild(el);
  return el;
}

function createStreamingMessage() {
  dom.welcomeScreen.classList.add('hidden');
  const el = document.createElement('div');
  el.className = 'message assistant';
  el.innerHTML = '<div class="msg-content streaming-cursor"></div>';
  dom.messages.appendChild(el);
  return el;
}

function updateStreamingMessage(el, fullText) {
  const contentEl = el.querySelector('.msg-content');
  contentEl.innerHTML = renderMarkdown(fullText);
  contentEl.classList.add('streaming-cursor');
  scrollToBottom();
}

function finalizeStreamingMessage(el, fullText) {
  const contentEl = el.querySelector('.msg-content');
  contentEl.innerHTML = renderMarkdown(fullText);
  contentEl.classList.remove('streaming-cursor');
  el.querySelectorAll('pre').forEach(addCopyButton);
}

function showThinking() {
  const el = document.createElement('div');
  el.className = 'thinking';
  el.id = 'thinkingIndicator';
  el.innerHTML = '<span></span><span></span><span></span>';
  dom.messages.appendChild(el);
  scrollToBottom();
}

function hideThinking() {
  const el = $('#thinkingIndicator');
  if (el) el.remove();
}

async function sendMessage() {
  const text = dom.messageInput.value.trim();
  if (!text || state.isStreaming) return;

  if (!state.apiKey) {
    openSettings();
    return;
  }

  // Ensure conversation exists
  if (!state.currentConvId || !state.conversations[state.currentConvId]) {
    createNewConversation();
  }

  const conv = state.conversations[state.currentConvId];

  // Add user message
  conv.messages.push({ role: 'user', content: text });
  appendMessage('user', text);
  scrollToBottom();

  // Update title from first message
  if (conv.messages.length === 1) {
    conv.title = text.slice(0, 40) + (text.length > 40 ? '...' : '');
    dom.headerTitle.textContent = conv.title;
    renderConversationList();
  }

  dom.messageInput.value = '';
  dom.messageInput.style.height = 'auto';
  dom.sendBtn.disabled = true;

  // Build messages for API
  const apiMessages = conv.messages.map(m => ({
    role: m.role,
    content: m.content,
  }));

  state.isStreaming = true;
  showThinking();

  try {
    const response = await callClaudeAPI(apiMessages);
    hideThinking();

    if (response.stream) {
      const streamEl = createStreamingMessage();
      let fullText = '';

      for await (const chunk of response.stream) {
        fullText += chunk;
        updateStreamingMessage(streamEl, fullText);
      }

      finalizeStreamingMessage(streamEl, fullText);
      conv.messages.push({ role: 'assistant', content: fullText });
    } else {
      appendMessage('assistant', response.text);
      conv.messages.push({ role: 'assistant', content: response.text });
    }

    conv.updatedAt = new Date().toISOString();
    saveConversations();
    renderConversationList();
    scrollToBottom();
  } catch (err) {
    hideThinking();
    const errMsg = err.message || 'Unknown error';
    appendMessage('error', `エラー: ${errMsg}`);
    console.error('API Error:', err);
  } finally {
    state.isStreaming = false;
  }
}

// ===== Claude API =====
async function callClaudeAPI(messages) {
  const headers = {
    'Content-Type': 'application/json',
    'x-api-key': state.apiKey,
    'anthropic-version': '2023-06-01',
    'anthropic-dangerous-direct-browser-access': 'true',
  };

  const body = {
    model: state.model,
    max_tokens: 8192,
    messages: messages,
    stream: true,
  };

  // Build system prompt with optional knowledge
  const conv = state.currentConvId && state.conversations[state.currentConvId];
  const useKnowledge = conv ? conv.useKnowledge !== false : true;
  let systemParts = [];
  if (state.systemPrompt) systemParts.push(state.systemPrompt);
  if (useKnowledge && state.knowledgeText) systemParts.push(state.knowledgeText);
  if (systemParts.length > 0) {
    body.system = systemParts.join('\n\n---\n\n');
  }

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: headers,
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    let errBody;
    try {
      errBody = await response.json();
    } catch {
      errBody = { error: { message: response.statusText } };
    }
    const msg = errBody?.error?.message || `HTTP ${response.status}`;
    throw new Error(msg);
  }

  // Parse SSE stream
  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  const stream = (async function* () {
    let buffer = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') return;

          try {
            const parsed = JSON.parse(data);
            if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
              yield parsed.delta.text;
            }
          } catch {
            // ignore parse errors on partial chunks
          }
        }
      }
    }
  })();

  return { stream };
}

// ===== Markdown Rendering (lightweight) =====
function renderMarkdown(text) {
  if (!text) return '';

  let html = escapeHtml(text);

  // Code blocks with language
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => {
    const langLabel = lang || 'code';
    return `<pre><div class="code-header"><span>${langLabel}</span></div><code>${code.replace(/^\n/, '')}</code></pre>`;
  });

  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

  // Bold
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

  // Italic
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');

  // Strikethrough
  html = html.replace(/~~(.+?)~~/g, '<del>$1</del>');

  // Headers
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');

  // Horizontal rule
  html = html.replace(/^---$/gm, '<hr>');

  // Blockquote
  html = html.replace(/^&gt; (.+)$/gm, '<blockquote>$1</blockquote>');

  // Unordered list
  html = html.replace(/^[*-] (.+)$/gm, '<li>$1</li>');
  html = html.replace(/((?:<li>.*<\/li>\n?)+)/g, '<ul>$1</ul>');

  // Ordered list
  html = html.replace(/^\d+\. (.+)$/gm, '<li>$1</li>');

  // Links
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');

  // Paragraphs: split by double newlines
  html = html.replace(/\n\n+/g, '</p><p>');
  // Single newlines to <br> (but not inside pre/code)
  html = html.replace(/(?<!<\/?\w[^>]*)\n(?!<)/g, '<br>');

  html = '<p>' + html + '</p>';

  // Clean up empty paragraphs
  html = html.replace(/<p>\s*<\/p>/g, '');
  // Don't wrap block elements in p
  html = html.replace(/<p>(<(?:pre|h[1-3]|ul|ol|blockquote|hr)[^]*?<\/(?:pre|h[1-3]|ul|ol|blockquote)>|<hr>)<\/p>/g, '$1');

  return html;
}

function escapeHtml(str) {
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
  return str.replace(/[&<>"']/g, c => map[c]);
}

function addCopyButton(preEl) {
  const existingHeader = preEl.querySelector('.code-header');
  if (existingHeader) {
    const btn = document.createElement('button');
    btn.className = 'btn-copy';
    btn.textContent = 'コピー';
    btn.addEventListener('click', () => {
      const code = preEl.querySelector('code')?.textContent || '';
      navigator.clipboard.writeText(code).then(() => {
        btn.textContent = 'コピー済み';
        setTimeout(() => btn.textContent = 'コピー', 1500);
      });
    });
    existingHeader.appendChild(btn);
  }
}

// ===== Utils =====
function scrollToBottom() {
  requestAnimationFrame(() => {
    dom.chatContainer.scrollTop = dom.chatContainer.scrollHeight;
  });
}

function formatDate(date) {
  const now = new Date();
  const diff = now - date;
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (mins < 1) return 'たった今';
  if (mins < 60) return `${mins}分前`;
  if (hours < 24) return `${hours}時間前`;
  if (days < 7) return `${days}日前`;
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

function showToast(message) {
  let toast = $('.toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.className = 'toast';
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2000);
}

// ===== Auto-resize textarea =====
function autoResize(textarea) {
  textarea.style.height = 'auto';
  textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
}

// ===== Event Binding =====
function bindEvents() {
  // Send message
  dom.sendBtn.addEventListener('click', sendMessage);

  // Auto-resize + enable/disable send
  dom.messageInput.addEventListener('input', () => {
    autoResize(dom.messageInput);
    dom.sendBtn.disabled = !dom.messageInput.value.trim() || state.isStreaming;
  });

  // Sidebar
  dom.menuBtn.addEventListener('click', openSidebar);
  dom.sidebarOverlay.addEventListener('click', closeSidebar);
  dom.newChatBtn.addEventListener('click', createNewConversation);

  // Settings
  dom.settingsBtn.addEventListener('click', openSettings);
  dom.closeSettings.addEventListener('click', closeSettingsModal);
  dom.settingsModal.addEventListener('click', (e) => {
    if (e.target === dom.settingsModal) closeSettingsModal();
  });
  dom.saveSettings.addEventListener('click', saveSettingsToStorage);

  // Toggle API key visibility
  dom.toggleApiKey.addEventListener('click', () => {
    const input = dom.apiKeyInput;
    input.type = input.type === 'password' ? 'text' : 'password';
  });

  // Prevent zoom on double-tap (iOS)
  let lastTouchEnd = 0;
  document.addEventListener('touchend', (e) => {
    const now = Date.now();
    if (now - lastTouchEnd <= 300) e.preventDefault();
    lastTouchEnd = now;
  }, false);
}

// ===== PWA registration =====
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

// ===== Start =====
document.addEventListener('DOMContentLoaded', init);
