import React, { useState, useEffect, useRef } from 'react';
import { NavLink } from 'react-router-dom';
import { 
  Users, 
  Settings as SettingsIcon, 
  LogOut, 
  MessageSquare,
  LayoutDashboard,
  ChevronRight,
  ChevronLeft,
  Megaphone
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
  const collapsedWidth = 72;
  const defaultExpandedWidth = 240;
  
  const [width, setWidth] = useState(() => {
    const saved = localStorage.getItem('sidebar-width');
    return saved ? parseInt(saved, 10) : defaultExpandedWidth;
  });
  const [collapsed, setCollapsed] = useState(() => {
    const saved = localStorage.getItem('sidebar-collapsed');
    return saved ? saved === 'true' : true;
  });
  
  const isResizing = useRef(false);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing.current || collapsed) return;
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

  useEffect(() => {
    localStorage.setItem('sidebar-collapsed', String(collapsed));
  }, [collapsed]);

  const navItems = [
    { to: '/kanban', icon: LayoutDashboard, label: 'Kanban' },
    { to: '/contatos', icon: Users, label: 'Contatos' },
    { to: '/campanhas', icon: Megaphone, label: 'Campanhas' },
    { to: '/settings', icon: SettingsIcon, label: 'Configurações' },
  ];

  return (
    <aside 
      className="h-full bg-[#0a0a0a] border-r border-[#1f1f1f] flex flex-col relative shrink-0 transition-[width]"
      style={{ width: `${collapsed ? collapsedWidth : width}px` }}
    >
      <button
        type="button"
        onClick={() => setCollapsed((current) => !current)}
        className="absolute -right-3 top-6 z-20 flex h-7 w-7 items-center justify-center rounded-full border border-[#2b2b2b] bg-[#151515] text-zinc-400 shadow-lg transition-colors hover:text-white"
        aria-label={collapsed ? 'Expandir menu lateral' : 'Recolher menu lateral'}
      >
        {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
      </button>

      <div className={cn("flex items-center gap-3", collapsed ? "px-4 py-6 justify-center" : "p-6")}>
        <div className="w-8 h-8 bg-white/10 rounded-lg flex items-center justify-center shrink-0">
          <MessageSquare className="w-5 h-5 text-white" />
        </div>
        {!collapsed && <span className="font-bold text-white tracking-tight">Quanta CRM</span>}
      </div>

      <nav className={cn("flex-1 space-y-1", collapsed ? "px-2" : "px-3")}>
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) => cn(
              "flex items-center rounded-lg transition-colors group",
              collapsed ? "justify-center px-2 py-3" : "gap-3 px-3 py-2",
              isActive 
                ? "bg-white/10 text-white" 
                : "text-zinc-500 hover:bg-white/5 hover:text-zinc-300"
            )}
            title={collapsed ? item.label : undefined}
          >
            <item.icon className="w-5 h-5" />
            {!collapsed && <span className="text-sm font-medium">{item.label}</span>}
          </NavLink>
        ))}
      </nav>

      <div className={cn("border-t border-[#1f1f1f] space-y-4", collapsed ? "p-2" : "p-4")}>
        <button
          onClick={toggleTheme}
          className={cn(
            "w-full rounded-lg text-zinc-500 hover:bg-white/5 hover:text-zinc-300 transition-colors text-sm",
            collapsed ? "flex justify-center px-2 py-3" : "flex items-center gap-3 px-3 py-2"
          )}
          title={collapsed ? `Tema ${theme === 'dark' ? 'Escuro' : 'Claro'}` : undefined}
        >
          <div className="w-5 h-5 flex items-center justify-center shrink-0">
            {theme === 'dark' ? '🌙' : '☀️'}
          </div>
          {!collapsed && <span>Tema {theme === 'dark' ? 'Escuro' : 'Claro'}</span>}
        </button>

        <div className={cn("flex items-center", collapsed ? "justify-center px-1" : "gap-3 px-3")}>
          <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-purple-500 to-blue-500 flex items-center justify-center text-white font-bold text-xs ring-2 ring-white/10">
            {user?.email?.substring(0, 2).toUpperCase()}
          </div>
          {!collapsed && (
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
          )}
        </div>

        {collapsed && (
          <button
            onClick={signOut}
            className="w-full flex justify-center rounded-lg px-2 py-3 text-zinc-500 hover:bg-white/5 hover:text-red-400 transition-colors"
            title="Sair"
          >
            <LogOut className="w-4 h-4" />
          </button>
        )}
      </div>

      {!collapsed && (
        <div 
          className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-white/20 transition-colors group"
          onMouseDown={() => {
            isResizing.current = true;
            document.body.style.cursor = 'col-resize';
          }}
        >
          <div className="absolute top-1/2 right-0 transform -translate-y-1/2 w-1.5 h-12 bg-white/5 group-hover:bg-white/10 rounded-l-full" />
        </div>
      )}
    </aside>
  );
}
