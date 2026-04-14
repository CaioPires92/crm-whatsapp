import React from 'react';
import { Users, Construction, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function Agenda() {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col h-screen bg-slate-950 items-center justify-center p-4 text-center">
      {/* Background Decor */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl animate-pulse delay-1000" />
      </div>

      <div className="relative z-10 max-w-2xl w-full">
        {/* Icon Header */}
        <div className="flex justify-center mb-8">
          <div className="relative">
            <div className="absolute inset-0 bg-blue-500/20 rounded-3xl blur-xl animate-pulse" />
            <div className="relative bg-slate-900 border border-slate-800 p-6 rounded-3xl shadow-2xl">
              <Users className="w-16 h-16 text-blue-400" />
              <Construction className="absolute -bottom-2 -right-2 w-8 h-8 text-yellow-500 bg-slate-950 rounded-full p-1 border-2 border-slate-900" />
            </div>
          </div>
        </div>

        {/* Text Content */}
        <h1 className="text-4xl md:text-5xl font-bold text-white mb-6 tracking-tight">
          Agenda de <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400">Contatos</span>
        </h1>
        
        <p className="text-slate-400 text-lg md:text-xl mb-12 leading-relaxed">
          Estamos construindo uma gestão de contatos completa para você. 
          Em breve, você poderá gerenciar sua agenda do WhatsApp diretamente por aqui.
        </p>

        {/* Progress Bar Mock */}
        <div className="w-full bg-slate-900 h-2 rounded-full mb-12 overflow-hidden border border-slate-800/50">
          <div className="h-full bg-gradient-to-r from-blue-500 to-purple-500 w-3/4 animate-shimmer" />
        </div>

        {/* Action Button */}
        <button
          onClick={() => navigate('/conversas')}
          className="group flex items-center gap-2 mx-auto px-8 py-4 bg-white/5 hover:bg-white/10 text-white rounded-2xl transition-all duration-300 border border-white/10 hover:border-white/20 active:scale-95"
        >
          <ArrowLeft className="w-5 h-5 transition-transform group-hover:-translate-x-1" />
          <span>Voltar para as Conversas</span>
        </button>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        .animate-shimmer {
          animation: shimmer 2s infinite linear;
        }
      `}} />
    </div>
  );
}
