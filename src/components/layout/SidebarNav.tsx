import React, { useState, useEffect, useRef } from 'react';
import { NavLink } from 'react-router-dom';
import { 
  Users, 
  Settings as SettingsIcon, 
  LogOut, 
  MessageSquare,
  LayoutDashboard
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function SidebarNav() {
  const { signOut, user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  
  const [width, setWidth] = useState(() => {
    const saved = localStorage.getItem('sidebar-width');
    return saved ? parseInt(saved) : 240;
  });
  
  const isResizing = useRef(false);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing.current) return;
      const newWidth = Math.min(Math.max(e.clientX, 180), 320);
      setWidth(newWidth);
    };

    const handleMouseUp = () => {
      if (isResizing.current) {
        isResizing.current = false;
        localStorage.setItem('sidebar-width', width.toString());
        document.body.style.cursor = 'default';
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [width]);

  const navItems = [
    { to: '/kanban', icon: LayoutDashboard, label: 'Kanban' },
    { to: '/contatos', icon: Users, label: 'Contatos' },
    { to: '/settings', icon: SettingsIcon, label: 'Configurações' },
  ];

  return (
    <aside 
      className="h-full bg-[#0a0a0a] border-r border-[#1f1f1f] flex flex-col relative shrink-0 transition-[width]"
      style={{ width: `${width}px` }}
    >
      <div className="p-6 flex items-center gap-3">
        <div className="w-8 h-8 bg-white/10 rounded-lg flex items-center justify-center">
          <MessageSquare className="w-5 h-5 text-white" />
        </div>
        <span className="font-bold text-white tracking-tight">Quanta CRM</span>
      </div>

      <nav className="flex-1 px-3 space-y-1">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) => cn(
              "flex items-center gap-3 px-3 py-2 rounded-lg transition-colors group",
              isActive 
                ? "bg-white/10 text-white" 
                : "text-zinc-500 hover:bg-white/5 hover:text-zinc-300"
            )}
          >
            <item.icon className="w-5 h-5" />
            <span className="text-sm font-medium">{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="p-4 border-t border-[#1f1f1f] space-y-4">
        <button
          onClick={toggleTheme}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-zinc-500 hover:bg-white/5 hover:text-zinc-300 transition-colors text-sm"
        >
          <div className="w-5 h-5 flex items-center justify-center">
            {theme === 'dark' ? '🌙' : '☀️'}
          </div>
          <span>Tema {theme === 'dark' ? 'Escuro' : 'Claro'}</span>
        </button>

        <div className="flex items-center gap-3 px-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-purple-500 to-blue-500 flex items-center justify-center text-white font-bold text-xs ring-2 ring-white/10">
            {user?.email?.substring(0, 2).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">{user?.email}</p>
            <button 
              onClick={signOut}
              className="text-xs text-zinc-500 hover:text-red-400 transition-colors flex items-center gap-1"
            >
              <LogOut className="w-3 h-3" />
              Sair
            </button>
          </div>
        </div>
      </div>

      <div 
        className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-white/20 transition-colors group"
        onMouseDown={() => {
          isResizing.current = true;
          document.body.style.cursor = 'col-resize';
        }}
      >
        <div className="absolute top-1/2 right-0 transform -translate-y-1/2 w-1.5 h-12 bg-white/5 group-hover:bg-white/10 rounded-l-full" />
      </div>
    </aside>
  );
}
