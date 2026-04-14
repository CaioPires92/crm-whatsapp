import { useTheme } from '../contexts/ThemeContext';
import { Sun, Moon, Bell, Shield, Paintbrush } from 'lucide-react';

export default function Settings() {
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="h-full flex flex-col bg-[#0a0a0a] p-8 max-w-4xl mx-auto w-full">
      <header className="mb-10">
        <h1 className="text-2xl font-bold text-white tracking-tight">Configurações</h1>
        <p className="text-zinc-500 text-sm">Gerencie as preferências da sua interface e segurança.</p>
      </header>

      <div className="space-y-6">
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

        <section className="bg-white/5 border border-white/5 rounded-2xl p-6 opacity-60">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-blue-500/10 rounded-lg">
              <Bell className="w-5 h-5 text-blue-400" />
            </div>
            <h2 className="font-semibold text-white">Notificações</h2>
          </div>
          <p className="text-xs text-zinc-500 italic">Disponível em futuras atualizações.</p>
        </section>

        <section className="bg-white/5 border border-white/5 rounded-2xl p-6 opacity-60">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-green-500/10 rounded-lg">
              <Shield className="w-5 h-5 text-green-400" />
            </div>
            <h2 className="font-semibold text-white">Segurança & Autenticação</h2>
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
