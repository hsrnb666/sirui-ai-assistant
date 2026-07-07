import { useState, useEffect, useCallback, useRef } from 'react';
import Sidebar from './components/Sidebar';
import ChatArea from './components/ChatArea';
import SettingsModal from './components/SettingsModal';
import * as api from './api';

const DEFAULT_SETTINGS = {
  apiKey: 'ark-cdd9bac7-230c-4d7c-bdcd-90a250971314-65aa1',
  apiUrl: 'https://ark.cn-beijing.volces.com/api/v3',
  model: 'ep-20260706173107-6s62h',
  temperature: 0.7,
  maxTokens: 2048,
  systemPrompt: '你是思瑞AI助手，一个智能、友善的AI助手，随时为用户提供帮助和解答问题。'
};

const SITE_PASSWORD = '041224';

export default function App() {
  const [authenticated, setAuthenticated] = useState(() => localStorage.getItem('sirui_ai_auth') === 'true');
  const [pwdInput, setPwdInput] = useState('');
  const [pwdError, setPwdError] = useState(false);
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'dark');
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [showSettings, setShowSettings] = useState(false);
  const [conversations, setConversations] = useState([]);
  const [activeConvId, setActiveConvId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const abortRef = useRef(null);
  const skipLoadRef = useRef(false);

  // Theme effect
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  // Load settings
  useEffect(() => {
    api.fetchSettings().then(s => {
      if (s && Object.keys(s).length > 0) setSettings(prev => ({ ...prev, ...s }));
    }).catch(() => {});
  }, []);

  // Load conversations
  const loadConversations = useCallback(async () => {
    try {
      const list = await api.fetchConversations();
      setConversations(list);
    } catch (e) { console.error(e); }
  }, []);

  useEffect(() => { loadConversations(); }, [loadConversations]);

  // Load active conversation
  useEffect(() => {
    if (!activeConvId) { setMessages([]); return; }
    if (skipLoadRef.current) { skipLoadRef.current = false; return; }
    api.fetchConversation(activeConvId).then(conv => {
      setMessages(conv.messages || []);
    }).catch(() => {});
  }, [activeConvId]);

  // New conversation
  const handleNewChat = useCallback(async () => {
    const conv = await api.createConversation({ title: '新对话' });
    setConversations(prev => [conv, ...prev]);
    setActiveConvId(conv.id);
    setMessages([]);
    setSidebarOpen(false);
  }, []);

  // Delete conversation
  const handleDeleteChat = useCallback(async (id) => {
    await api.deleteConversation(id);
    setConversations(prev => prev.filter(c => c.id !== id));
    if (activeConvId === id) { setActiveConvId(null); setMessages([]); }
  }, [activeConvId]);

  // Rename conversation
  const handleRenameChat = useCallback(async (id, title) => {
    await api.updateConversation(id, { title });
    setConversations(prev => prev.map(c => c.id === id ? { ...c, title } : c));
  }, []);

  // Send message
  const handleSend = useCallback(async (content, editIndex = -1) => {
    if (!content.trim() || isStreaming) return;

    let convId = activeConvId;
    let currentMessages = [...messages];

    // Create conversation if none
    if (!convId) {
      const title = content.slice(0, 30) + (content.length > 30 ? '...' : '');
      const conv = await api.createConversation({ title });
      convId = conv.id;
      setConversations(prev => [conv, ...prev]);
      skipLoadRef.current = true;
      setActiveConvId(convId);
    }

    // Handle edit: remove messages after editIndex
    if (editIndex >= 0) {
      currentMessages = currentMessages.slice(0, editIndex);
    }

    const userMsg = { role: 'user', content, timestamp: Date.now() };
    const newMessages = [...currentMessages, userMsg];
    setMessages(newMessages);
    setIsStreaming(true);

    // Prepare API messages
    const apiMessages = [
      { role: 'system', content: settings.systemPrompt || DEFAULT_SETTINGS.systemPrompt },
      ...newMessages.map(m => ({ role: m.role, content: m.content }))
    ];

    // Add assistant placeholder
    const assistantMsg = { role: 'assistant', content: '', timestamp: Date.now(), streaming: true };
    setMessages([...newMessages, assistantMsg]);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const fullContent = await api.streamChat(
        apiMessages, settings,
        (chunk, full) => {
          setMessages(prev => {
            const updated = [...prev];
            updated[updated.length - 1] = { ...updated[updated.length - 1], content: full };
            return updated;
          });
        },
        (full) => {
          // Done
          setMessages(prev => {
            const updated = [...prev];
            updated[updated.length - 1] = { ...updated[updated.length - 1], content: full, streaming: false };
            // Save to server
            const allMsgs = updated.map(m => ({ role: m.role, content: m.content, timestamp: m.timestamp }));
            api.updateConversation(convId, { messages: allMsgs }).catch(() => {});
            return updated;
          });
          setIsStreaming(false);
          loadConversations();
        },
        (error) => {
          setMessages(prev => {
            const updated = [...prev];
            updated[updated.length - 1] = {
              ...updated[updated.length - 1],
              content: `❌ 错误: ${error}`,
              streaming: false,
              error: true
            };
            return updated;
          });
          setIsStreaming(false);
        },
        controller.signal
      );
    } catch (e) {
      if (e.name !== 'AbortError') {
        setMessages(prev => {
          const updated = [...prev];
          updated[updated.length - 1] = { ...updated[updated.length - 1], content: `❌ 请求失败: ${e.message}`, streaming: false, error: true };
          return updated;
        });
      }
      setIsStreaming(false);
    }
  }, [activeConvId, messages, settings, isStreaming, loadConversations]);

  // Stop streaming
  const handleStop = useCallback(() => {
    if (abortRef.current) abortRef.current.abort();
    setIsStreaming(false);
    setMessages(prev => prev.map(m => m.streaming ? { ...m, streaming: false } : m));
  }, []);

  // Regenerate last response
  const handleRegenerate = useCallback(() => {
    if (messages.length < 2) return;
    const lastUserIdx = messages.map(m => m.role).lastIndexOf('user');
    if (lastUserIdx === -1) return;
    const userContent = messages[lastUserIdx].content;
    handleSend(userContent, lastUserIdx);
  }, [messages, handleSend]);

  // Save settings
  const handleSaveSettings = useCallback(async (newSettings) => {
    setSettings(newSettings);
    await api.saveSettings(newSettings);
    setShowSettings(false);
  }, []);

  // Export conversation
  const handleExport = useCallback((format) => {
    if (!activeConvId) return;
    const conv = conversations.find(c => c.id === activeConvId);
    if (!conv) return;
    api.exportConversation({ ...conv, messages }, format);
  }, [activeConvId, conversations, messages]);

  const handlePasswordSubmit = (e) => {
    e.preventDefault();
    if (pwdInput === SITE_PASSWORD) {
      localStorage.setItem('sirui_ai_auth', 'true');
      setAuthenticated(true);
      setPwdError(false);
    } else {
      setPwdError(true);
      setPwdInput('');
    }
  };

  if (!authenticated) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        height: '100vh', background: '#0a0e1a', position: 'relative', overflow: 'hidden'
      }}>
        {/* Animated grid background */}
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: 'linear-gradient(rgba(0,212,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(0,212,255,0.04) 1px, transparent 1px)',
          backgroundSize: '40px 40px'
        }} />
        {/* Radial glow */}
        <div style={{
          position: 'absolute', top: '30%', left: '50%', transform: 'translate(-50%, -50%)',
          width: '600px', height: '600px', borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(0,212,255,0.08) 0%, transparent 70%)',
          pointerEvents: 'none'
        }} />
        <form onSubmit={handlePasswordSubmit} style={{
          background: 'rgba(15, 22, 40, 0.85)', backdropFilter: 'blur(24px)',
          borderRadius: '20px', padding: '44px 40px',
          border: '1px solid rgba(0,212,255,0.15)',
          boxShadow: '0 0 40px rgba(0,212,255,0.1), 0 20px 60px rgba(0,0,0,0.5)',
          width: '360px', textAlign: 'center', position: 'relative', zIndex: 1
        }}>
          {/* Top accent line */}
          <div style={{
            position: 'absolute', top: 0, left: '15%', width: '70%', height: '2px',
            background: 'linear-gradient(90deg, transparent, #00d4ff, #7c5cfc, transparent)',
            borderRadius: '2px'
          }} />
          <div style={{
            fontSize: '52px', marginBottom: '16px',
            filter: 'drop-shadow(0 0 20px rgba(0,212,255,0.4))'
          }}>&#x1F916;</div>
          <h2 style={{
            margin: '0 0 6px', fontSize: '24px', fontWeight: 700,
            background: 'linear-gradient(135deg, #00d4ff, #7c5cfc)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            letterSpacing: '2px'
          }}>思瑞AI助手</h2>
          <p style={{ color: '#7a8bb5', marginBottom: '28px', fontSize: '13px', letterSpacing: '1px' }}>
            &#x1F512; 请输入访问密码
          </p>
          <input
            type="password"
            value={pwdInput}
            onChange={e => { setPwdInput(e.target.value); setPwdError(false); }}
            placeholder="请输入密码"
            autoFocus
            style={{
              width: '100%', padding: '13px 16px', borderRadius: '10px',
              border: pwdError ? '1px solid #ff4757' : '1px solid rgba(0,212,255,0.2)',
              fontSize: '18px', outline: 'none', boxSizing: 'border-box',
              marginBottom: pwdError ? '8px' : '22px',
              background: 'rgba(10, 14, 26, 0.8)', color: '#e0e8f5',
              letterSpacing: '4px', textAlign: 'center',
              boxShadow: pwdError ? '0 0 12px rgba(255,71,87,0.2)' : 'none',
              transition: 'all 0.3s'
            }}
          />
          {pwdError && <p style={{ color: '#ff4757', fontSize: '12px', margin: '0 0 18px', letterSpacing: '0.5px' }}>&#x26A0; 密码错误，请重新输入</p>}
          <button type="submit" style={{
            width: '100%', padding: '13px', borderRadius: '10px', border: 'none',
            background: 'linear-gradient(135deg, #00d4ff, #7c5cfc)', color: '#fff',
            fontSize: '14px', fontWeight: 700, cursor: 'pointer',
            letterSpacing: '2px'
          }}>进入</button>
        </form>
      </div>
    );
  }

  return (
    <div className="app">
      <Sidebar
        conversations={conversations}
        activeId={activeConvId}
        onSelect={(id) => { setActiveConvId(id); setSidebarOpen(false); }}
        onNew={handleNewChat}
        onDelete={handleDeleteChat}
        onRename={handleRenameChat}
        onSettings={() => setShowSettings(true)}
        onExport={handleExport}
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
        theme={theme}
        onToggleTheme={() => setTheme(t => t === 'light' ? 'dark' : 'light')}
      />
      <ChatArea
        messages={messages}
        isStreaming={isStreaming}
        onSend={handleSend}
        onStop={handleStop}
        onRegenerate={handleRegenerate}
        onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
        settings={settings}
        sidebarOpen={sidebarOpen}
      />
      {showSettings && (
        <SettingsModal
          settings={settings}
          onSave={handleSaveSettings}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  );
}
