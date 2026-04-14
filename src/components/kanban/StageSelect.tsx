import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Check } from 'lucide-react';
import { STAGES, type KanbanStage } from '../../types/kanban';

interface StageSelectProps {
  value: KanbanStage;
  onChange: (newValue: KanbanStage) => void;
}

export default function StageSelect({ value, onChange }: StageSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  // Update position when opening
  const updatePosition = () => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setCoords({
        top: rect.top,
        left: rect.left,
        width: rect.width
      });
    }
  };

  useEffect(() => {
    const handleScroll = (e: Event) => {
      const portal = document.getElementById('stage-select-portal');
      if (portal && portal.contains(e.target as Node)) return;
      updatePosition();
    };

    const handleResize = () => updatePosition();

    if (isOpen) {
      updatePosition();
      window.addEventListener('scroll', handleScroll, true);
      window.addEventListener('resize', handleResize);
    }
    
    return () => {
      window.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('resize', handleResize);
    };
  }, [isOpen]);

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        // Only close if we didn't click inside the portal
        const portal = document.getElementById('stage-select-portal');
        if (portal && portal.contains(event.target as Node)) return;
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleSelect = (stage: KanbanStage) => {
    onChange(stage);
    setIsOpen(false);
  };

  return (
    <div className="relative min-w-0" ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1 text-[10px] text-zinc-400 hover:text-white transition-colors outline-none truncate max-w-[140px] group"
      >
        <span className="truncate">{value}</span>
        <ChevronDown className={`w-2.5 h-2.5 text-zinc-500 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''} group-hover:text-white`} />
      </button>

      {isOpen && createPortal(
        <div id="stage-select-portal" className="fixed inset-0 z-[9999] pointer-events-none">
          <AnimatePresence>
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ duration: 0.15, ease: "easeOut" }}
              style={{
                top: coords.top - 10,
                left: coords.left,
                transform: 'translateY(-100%)',
                width: '180px'
              }}
              className="absolute pointer-events-auto py-1 bg-[#1c2128] border border-[#444c56] rounded-lg shadow-[0_12px_32px_rgba(0,0,0,0.6)] backdrop-blur-xl z-[10000] overflow-hidden"
            >
              <div className="max-h-64 overflow-y-auto no-scrollbar">
                {STAGES.map((stage) => (
                  <button
                    key={stage}
                    onClick={() => handleSelect(stage)}
                    className={`w-full flex items-center justify-between px-3 py-2.5 text-[11px] transition-all hover:bg-white/10 text-left ${
                      value === stage ? 'text-white bg-white/5 font-semibold' : 'text-zinc-400'
                    }`}
                  >
                    <span className="truncate">{stage}</span>
                    {value === stage && <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}
                  </button>
                ))}
              </div>
              
              <div className="h-[2px] bg-gradient-to-r from-transparent via-blue-500/40 to-transparent shadow-[0_0_8px_rgba(59,130,246,0.3)]" />
            </motion.div>
          </AnimatePresence>
        </div>,
        document.body
      )}
    </div>
  );
}
