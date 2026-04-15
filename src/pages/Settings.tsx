import React, { useState, useEffect } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { Sun, Moon, Bell, Shield, Paintbrush, Globe, Key, Database, Check, AlertCircle } from 'lucide-react';
import { saveEvolutionConfig, isEvolutionConfigured } from '../lib/evolution';

export default function Settings() {
  const { theme, toggleTheme } = useTheme();
  const [url, setUrl] = useState('');
  const [instance, setInstance] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved' | 'error'>('idle');

  // Load current config from localStorage or env
  useEffect(() => {
    const decode = (v: string) => { try { return atob(v); } catch { return v; } };
    const storedUrl = localStorage.getItem('evolution_url');
    const storedInstance = localStorage.getItem('evolution_instance');
    const storedApiKey = localStorage.getItem('evolution_apikey');

    setUrl(storedUrl ? decode(storedUrl) : (import.meta.env.VITE_EVOLUTION_URL || ''));
    setInstance(storedInstance ? decode(storedInstance) : (import.meta.env.VITE_EVOLUTION_INSTANCE || ''));
    setApiKey(storedApiKey ? decode(storedApiKey) : (import.meta.env.VITE_EVOLUTION_API_KEY || ''));
  }, []);

  const handleSaveEvolution = () => {
    try {
      saveEvolutionConfig(url, instance, apiKey);
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch (err) {
      setSaveStatus('error');
    }
  };

  return (
    <div className="h-full flex flex-col bg-[#0a0a0a] p-8 max-w-4xl mx-auto w-full overflow-y-auto">
      <header className="mb-10">
        <h1 className="text-2xl font-bold text-white tracking-tight">Configurações</h1>
        <p className="text-zinc-500 text-sm">Gerencie as preferências da sua interface e segurança.</p>
      </header>

      <div className="space-y-6 pb-10">
        <section className="bg-white/5 border border-white/5 rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-purple-500/10 rounded-lg">
              <Paintbrush className="w-5 h-5 text-purple-400" />
            </div>
            <h2 className="font-semibold text-white">Aparência</h2>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-white">Modo de Exibição</p>
              <p className="text-xs text-zinc-500">Alterne entre o tema claro e escuro.</p>
            </div>
            <button
              onClick={toggleTheme}
              className="flex items-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 px-4 py-2 rounded-xl text-sm text-white transition-all active:scale-[0.98]"
            >
              {theme === 'dark' ? (
                <><Moon className="w-4 h-4" /> Escuro</>
              ) : (
                <><Sun className="w-4 h-4" /> Claro</>
              )}
            </button>
          </div>
        </section>

        <section className="bg-white/5 border border-white/5 rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-green-500/10 rounded-lg">
              <Shield className="w-5 h-5 text-green-400" />
            </div>
            <h2 className="font-semibold text-white">Conexão WhatsApp (Evolution API)</h2>
          </div>
          
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-semibold text-zinc-400 uppercase tracking-widest ml-1">URL da API</label>
                <div className="relative">
                  <Globe className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                  <input
                    type="text"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl pl-12 pr-4 py-3 text-sm text-white placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-white/10 transition-all"
                    placeholder="https://api.seudomain.com"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold text-zinc-400 uppercase tracking-widest ml-1">Instância</label>
                <div className="relative">
                  <Database className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                  <input
                    type="text"
                    value={instance}
                    onChange={(e) => setInstance(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl pl-12 pr-4 py-3 text-sm text-white placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-white/10 transition-all"
                    placeholder="ex: atendimento"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-zinc-400 uppercase tracking-widest ml-1">API Key (Global/Instância)</label>
              <div className="relative">
                <Key className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl pl-12 pr-4 py-3 text-sm text-white placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-white/10 transition-all"
                  placeholder="Sua chave secreta"
                />
              </div>
            </div>

            <div className="pt-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                {isEvolutionConfigured() ? (
                  <span className="flex items-center gap-1.5 text-[10px] font-bold text-green-500 bg-green-500/10 px-2 py-1 rounded-full uppercase tracking-tighter">
                    <Check className="w-3 h-3" /> Conectado
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 text-[10px] font-bold text-yellow-500 bg-yellow-500/10 px-2 py-1 rounded-full uppercase tracking-tighter">
                    <AlertCircle className="w-3 h-3" /> Configuração pendente
                  </span>
                )}
              </div>
              
              <button
                onClick={handleSaveEvolution}
                className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all active:scale-[0.98] ${
                  saveStatus === 'saved' 
                  ? 'bg-green-500 text-white' 
                  : 'bg-white text-black hover:bg-zinc-200'
                }`}
              >
                {saveStatus === 'saved' ? 'Configurações Salvas!' : 'Salvar Alterações'}
              </button>
            </div>
          </div>
        </section>

        <section className="bg-white/5 border border-white/5 rounded-2xl p-6 opacity-60">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-blue-500/10 rounded-lg">
              <Bell className="w-5 h-5 text-blue-400" />
            </div>
            <h2 className="font-semibold text-white">Notificações</h2>
          </div>
          <p className="text-xs text-zinc-500 italic">Disponível em futuras atualizações.</p>
        </section>
      </div>
      
      <footer className="mt-auto pt-10 text-center">
        <p className="text-[10px] text-zinc-700 uppercase tracking-widest font-bold">Quanta CRM — Versão 1.0.0 (BETA)</p>
      </footer>
    </div>
  );
}
