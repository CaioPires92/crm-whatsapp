import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { 
  Save, 
  RotateCcw, 
  ChevronLeft, 
  ChevronRight, 
  Calendar as CalendarIcon,
  AlertCircle,
  Loader2,
  Lock,
  Unlock,
  Package
} from 'lucide-react';
import { format, addDays, startOfToday, isSameDay, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { clsx } from 'clsx';

interface InventoryItem {
  id?: number;
  room_type: string;
  date: string;
  available_count: number;
  min_nights: number;
  base_price: number;
  is_closed: boolean;
}

const ROOM_TYPES = [
  "Apto Terreo",
  "Apto Superior",
  "Chale",
  "Apto Anexo"
];

export default function Disponibilidade() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inventory, setInventory] = useState<Record<string, InventoryItem>>({});
  const [modifiedKeys, setModifiedKeys] = useState<Set<string>>(new Set());

  // Gerar os próximos 30 dias a partir de hoje
  const today = startOfToday();
  const days = Array.from({ length: 30 }, (_, i) => addDays(today, i));

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const startDate = format(days[0], 'yyyy-MM-dd');
      const endDate = format(days[days.length - 1], 'yyyy-MM-dd');

      // 1. Buscar inventário existente
      const { data: invData, error: invError } = await supabase
        .from('room_inventory')
        .select('*')
        .gte('date', startDate)
        .lte('date', endDate);

      if (invError) throw invError;

      // 2. Buscar tarifas base como fallback (opcional, mas bom para preencher o grid)
      const { data: rateData, error: rateError } = await supabase
        .from('room_rates')
        .select('*')
        .eq('active', true);

      if (rateError) throw rateError;

      // Mapear dados existentes para o estado
      const newInventory: Record<string, InventoryItem> = {};
      
      // Inicializar todo o grid com valores padrão ou das tarifas
      ROOM_TYPES.forEach(rt => {
        const baseRate = rateData?.find(r => r.room_type === rt) || { base_price: 0, min_nights: 1 };
        
        days.forEach(day => {
          const dateStr = format(day, 'yyyy-MM-dd');
          const key = `${rt}_${dateStr}`;
          newInventory[key] = {
            room_type: rt,
            date: dateStr,
            available_count: 5, // Valor padrão de exemplo
            min_nights: baseRate.min_nights || 1,
            base_price: Number(baseRate.base_price) || 0,
            is_closed: false
          };
        });
      });

      // Sobrescrever com o que está no banco (room_inventory)
      invData?.forEach(item => {
        const key = `${item.room_type}_${item.date}`;
        newInventory[key] = {
          ...newInventory[key],
          ...item,
          base_price: Number(item.base_price) || newInventory[key].base_price
        };
      });

      setInventory(newInventory);
    } catch (err: any) {
      console.error('Erro ao carregar dados:', err);
      setError(err.message || 'Falha ao carregar disponibilidade');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = (rt: string, date: string, field: keyof InventoryItem, value: any) => {
    const key = `${rt}_${date}`;
    setInventory(prev => ({
      ...prev,
      [key]: {
        ...prev[key],
        [field]: value
      }
    }));
    setModifiedKeys(prev => new Set(prev).add(key));
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const itemsToSave = Array.from(modifiedKeys).map(key => inventory[key]);

      const { error: saveError } = await supabase
        .from('room_inventory')
        .upsert(itemsToSave, { onConflict: 'room_type,date' });

      if (saveError) throw saveError;

      setModifiedKeys(new Set());
      alert('Alterações salvas com sucesso!');
    } catch (err: any) {
      console.error('Erro ao salvar:', err);
      alert('Erro ao salvar: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-zinc-950">
        <div className="text-center">
          <Loader2 className="w-10 h-10 text-blue-500 animate-spin mx-auto mb-4" />
          <p className="text-zinc-400 animate-pulse">Carregando mapa de disponibilidade...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-zinc-950 text-zinc-100 p-6 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <CalendarIcon className="text-blue-500" />
            Disponibilidade e Tarifas 
            <span className="text-sm font-normal text-zinc-500 ml-2">Próximos 30 dias</span>
          </h1>
          <p className="text-zinc-500 text-sm mt-1">Gerencie vagas, preços e restrições diretamente no mapa.</p>
        </div>
        
        <div className="flex items-center gap-3">
          {modifiedKeys.size > 0 && (
            <button 
              onClick={() => fetchData()}
              className="flex items-center gap-2 px-4 py-2 text-zinc-400 hover:text-white transition-colors text-sm"
              disabled={saving}
            >
              <RotateCcw className="w-4 h-4" />
              Descartar
            </button>
          )}
          <button 
            onClick={handleSave}
            disabled={saving || modifiedKeys.size === 0}
            className={clsx(
              "flex items-center gap-2 px-6 py-2 rounded-xl font-bold transition-all shadow-lg",
              modifiedKeys.size > 0 
                ? "bg-blue-600 hover:bg-blue-500 text-white shadow-blue-900/20" 
                : "bg-zinc-800 text-zinc-500 cursor-not-allowed"
            )}
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? 'Salvando...' : 'Salvar Alterações'}
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-3 text-red-400">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Main Grid View */}
      <div className="flex-1 overflow-auto no-scrollbar border border-zinc-900 rounded-2xl bg-zinc-900/30 backdrop-blur-sm">
        <table className="w-full border-collapse">
          <thead className="sticky top-0 z-20">
            <tr className="bg-zinc-900/90 backdrop-blur-md">
              <th className="p-4 text-left font-bold text-zinc-400 text-xs uppercase tracking-wider border-b border-zinc-800 sticky left-0 bg-zinc-900 z-30 min-w-[200px]">
                Acomodação
              </th>
              {days.map(day => (
                <th key={day.toISOString()} className={clsx(
                  "p-4 text-center border-b border-zinc-800 min-w-[120px]",
                  format(day, 'eeeeee') === 'sáb' || format(day, 'eeeeee') === 'dom' ? "bg-zinc-800/30" : ""
                )}>
                  <div className="text-xs uppercase font-bold text-zinc-500">{format(day, 'EEE', { locale: ptBR })}</div>
                  <div className="text-lg font-black text-zinc-100">{format(day, 'dd')}</div>
                  <div className="text-[10px] text-zinc-600">{format(day, 'MMM', { locale: ptBR })}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ROOM_TYPES.map(rt => (
              <tr key={rt} className="group hover:bg-zinc-800/10 transition-colors">
                <td className="p-4 border-b border-zinc-900 sticky left-0 bg-zinc-950/80 backdrop-blur-md z-10 font-bold text-sm shadow-xl">
                  <div className="flex items-center gap-2">
                    <Package className="w-4 h-4 text-blue-500" />
                    {rt}
                  </div>
                </td>
                {days.map(day => {
                  const dateStr = format(day, 'yyyy-MM-dd');
                  const key = `${rt}_${dateStr}`;
                  const item = inventory[key];
                  if (!item) return <td key={key} className="p-4 border-b border-zinc-900"></td>;

                  return (
                    <td key={key} className={clsx(
                      "p-3 border-b border-zinc-900 border-r border-zinc-900/50 transition-all",
                      item.is_closed ? "bg-red-500/5" : "hover:bg-zinc-800/40",
                      format(day, 'eeeeee') === 'sáb' || format(day, 'eeeeee') === 'dom' ? "bg-zinc-800/10" : ""
                    )}>
                      <div className="space-y-3">
                        {/* Vagas */}
                        <div className="flex flex-col">
                          <label className="text-[9px] uppercase text-zinc-600 font-bold mb-1">Vagas</label>
                          <input 
                            type="number" 
                            min="0"
                            value={item.available_count}
                            onChange={(e) => handleUpdate(rt, dateStr, 'available_count', parseInt(e.target.value) || 0)}
                            className={clsx(
                              "bg-zinc-800/50 border border-zinc-700/50 rounded-lg p-1.5 text-xs text-center focus:outline-none focus:border-blue-500 transition-colors w-full font-bold",
                              item.available_count === 0 ? "text-red-400 bg-red-400/5 border-red-400/20" : "text-zinc-100"
                            )}
                          />
                        </div>

                        {/* Preço */}
                        <div className="flex flex-col">
                          <label className="text-[9px] uppercase text-zinc-600 font-bold mb-1">Preço (R$)</label>
                          <input 
                            type="number" 
                            value={item.base_price}
                            onChange={(e) => handleUpdate(rt, dateStr, 'base_price', parseFloat(e.target.value) || 0)}
                            className="bg-zinc-800/50 border border-zinc-700/50 rounded-lg p-1.5 text-xs text-center focus:outline-none focus:border-blue-500 transition-colors w-full"
                          />
                        </div>

                        {/* Min Diarias */}
                        <div className="flex flex-col">
                          <label className="text-[9px] uppercase text-zinc-600 font-bold mb-1">Min Estadia</label>
                          <select 
                            value={item.min_nights}
                            onChange={(e) => handleUpdate(rt, dateStr, 'min_nights', parseInt(e.target.value))}
                            className="bg-zinc-800/50 border border-zinc-700/50 rounded-lg p-1.5 text-[10px] text-center focus:outline-none focus:border-blue-500 transition-colors w-full font-medium"
                          >
                            {[1, 2, 3, 4, 5, 6, 7].map(n => <option key={n} value={n}>{n} Noite{n > 1 ? 's' : ''}</option>)}
                          </select>
                        </div>

                        {/* Status Bloqueio */}
                        <button 
                          onClick={() => handleUpdate(rt, dateStr, 'is_closed', !item.is_closed)}
                          className={clsx(
                            "w-full py-1 text-[9px] uppercase font-black rounded-lg transition-all border flex items-center justify-center gap-1",
                            item.is_closed 
                              ? "bg-red-500/20 border-red-500/30 text-red-500" 
                              : "bg-emerald-500/10 border-emerald-500/20 text-emerald-500 hover:bg-emerald-500/20"
                          )}
                        >
                          {item.is_closed ? <Lock className="w-2.5 h-2.5" /> : <Unlock className="w-2.5 h-2.5" />}
                          {item.is_closed ? 'Bloqueado' : 'Aberto'}
                        </button>
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Footer Info */}
      <div className="mt-4 flex items-center gap-6 text-[11px] text-zinc-600">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-red-500/20 border border-red-500/30 rounded" />
          <span>Venda Fechada / Esgotado</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-zinc-800/30 border border-zinc-800/50 rounded" />
          <span>Finais de Semana</span>
        </div>
        <div className="ml-auto italic">
          * Valores em vermelho indicam falta de estoque ou bloqueio manual.
        </div>
      </div>
    </div>
  );
}
