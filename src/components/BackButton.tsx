import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';

interface BackButtonProps {
  fallbackPath?: string;
  label?: string;
}

export default function BackButton({ fallbackPath, label }: BackButtonProps) {
  const navigate = useNavigate();

  const handleClick = () => {
    if (fallbackPath && window.history.length <= 2) {
      navigate(fallbackPath);
    } else {
      navigate(-1);
    }
  };

  return (
    <button
      onClick={handleClick}
      className="group flex items-center gap-2 text-white/60 hover:text-white transition-colors mb-4 md:mb-6"
    >
      <div className="p-1.5 md:p-2 bg-white/5 group-hover:bg-white/10 rounded-full transition-colors">
        <ChevronLeft size={20} />
      </div>
      <span className="font-medium text-sm">{label || 'Back'}</span>
    </button>
  );
}
