import { Sparkles, Construction } from 'lucide-react';

export default function Campanhas() {
  return (
    <div className="h-full w-full flex flex-col items-center justify-center p-8 bg-zinc-950/50">
      <div className="relative group">
        <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-cyan-500 rounded-full blur opacity-25 group-hover:opacity-50 transition duration-1000 group-hover:duration-200"></div>
        <div className="relative p-6 bg-zinc-900 rounded-full border border-zinc-800">
          <Construction className="w-12 h-12 text-blue-400" />
        </div>
      </div>
      
      <div className="mt-8 text-center space-y-3">
        <h1 className="text-3xl font-bold tracking-tight text-white flex items-center justify-center gap-2">
          Campanhas <Sparkles className="w-6 h-6 text-yellow-500" />
        </h1>
        <p className="text-zinc-400 max-w-md mx-auto leading-relaxed">
          Estamos preparando uma ferramenta completa de automação de marketing para o hotel. 
          Em breve você poderá disparar mensagens em massa e segmentar leads aqui.
        </p>
      </div>

      <div className="mt-10 px-4 py-2 rounded-full border border-zinc-800 bg-zinc-900/50 text-xs font-medium text-zinc-500 flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></div>
        EM DESENVOLVIMENTO
      </div>
    </div>
  );
}
