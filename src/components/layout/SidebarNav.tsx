import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { 
  Users, 
  LayoutDashboard, 
  Settings, 
  LogOut, 
  ChevronLeft, 
  ChevronRight,
  Kanban,
  Megaphone,
  Sparkles,
  MessageSquare
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

const navItems = [
  { to: '/kanban', icon: Kanban, label: 'Kanban' },
  { to: '/conversas', icon: MessageSquare, label: 'Conversas' },
  { to: '/contatos', icon: Users, label: 'Contatos' },
  { to: '/campanhas', icon: Megaphone, label: 'Campanhas' },
  { to: '/settings', icon: Settings, label: 'Configurações' },
];

export default function SidebarNav() {
  const [collapsed, setCollapsed] = useState(false);
  const { signOut, user } = useAuth();

  const cn = (...inputs: any[]) => twMerge(clsx(inputs));

  return (
    <aside 
      className={cn(
        "h-screen bg-zinc-950 border-r border-zinc-800 flex flex-col transition-all duration-300 ease-in-out relative z-50",
        collapsed ? "w-20" : "w-64"
      )}
    >
      {/* Header / Logo */}
      <div className="p-6 flex items-center gap-3 overflow-hidden">
        <div className="min-w-[32px] h-8 w-8 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0 shadow-lg shadow-blue-900/20">
          <Sparkles className="w-5 h-5 text-white" />
        </div>
        {!collapsed && (
          <span className="font-bold text-xl tracking-tight text-white whitespace-nowrap">
            Quanta <span className="text-blue-500">CRM</span>
          </span>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 space-y-1 mt-4">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) => cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group relative",
              isActive 
                ? "bg-blue-600/10 text-blue-400 font-medium" 
                : "text-zinc-500 hover:text-zinc-100 hover:bg-zinc-900"
            )}
          >
            <item.icon className={cn("w-5 h-5 flex-shrink-0 transition-transform group-hover:scale-110")} />
            {!collapsed && (
              <span className="whitespace-nowrap truncate">{item.label}</span>
            )}
            {/* Tooltip for collapsed mode */}
            {collapsed && (
              <div className="absolute left-full ml-4 px-2 py-1 bg-zinc-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-[100] border border-zinc-700">
                {item.label}
              </div>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Footer / User Profile */}
      <div className="p-4 border-t border-zinc-900 space-y-4">
        {!collapsed && (
          <div className="px-2 py-3 bg-zinc-900/50 rounded-2xl border border-zinc-800/50 mb-2 overflow-hidden">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center text-xs font-bold text-zinc-400 border border-zinc-700 uppercase">
                {user?.email?.charAt(0) || 'U'}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-zinc-300 truncate">Usuário Logado</p>
                <p className="text-[10px] text-zinc-500 truncate">{user?.email}</p>
              </div>
            </div>
          </div>
        )}

        <button
          onClick={() => signOut()}
          className={cn(
            "w-full flex items-center gap-3 px-3 py-2.5 text-zinc-500 hover:text-red-400 hover:bg-red-500/5 rounded-xl transition-all group",
            collapsed ? "justify-center" : ""
          )}
        >
          <LogOut className="w-5 h-5 flex-shrink-0 group-hover:-translate-x-1 transition-transform" />
          {!collapsed && <span className="font-medium">Sair</span>}
        </button>
      </div>

      {/* Toggle Button */}
      <button 
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3 top-20 bg-zinc-900 border border-zinc-800 text-zinc-500 rounded-full p-1 hover:text-white hover:bg-zinc-800 transition-colors shadow-xl"
      >
        {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
      </button>
    </aside>
  );
}
