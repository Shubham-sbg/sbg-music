import React, { useEffect, useRef } from 'react';
import { audioEngine } from '../utils/audioEngine';

interface AudioVisualizerProps {
  isPlaying: boolean;
  barCount?: number;
  className?: string;
  color?: string;
}

export const AudioVisualizer: React.FC<AudioVisualizerProps> = ({
  isPlaying,
  barCount = 16,
  className = 'h-6 flex items-end gap-0.5',
  color = '#f59e0b',
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animFrameId = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let phase = 0;

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const data = audioEngine.getVisualizerData();

      const width = canvas.width;
      const height = canvas.height;
      const barWidth = (width / barCount) - 1.5;

      for (let i = 0; i < barCount; i++) {
        let value = 0;
        if (isPlaying) {
          const freqIndex = Math.floor((i / barCount) * data.length);
          const raw = data[freqIndex] || 0;
          // Combine frequency data with a soft organic wave oscillation
          const wave = Math.sin(phase + i * 0.4) * 0.2 + 0.8;
          value = Math.max(0.12, (raw / 255) * wave);
        } else {
          value = 0.08;
        }

        const barHeight = Math.max(3, value * height);
        const x = i * (barWidth + 1.5);
        const y = height - barHeight;

        // Gradient for bars
        const grad = ctx.createLinearGradient(0, height, 0, 0);
        grad.addColorStop(0, color);
        grad.addColorStop(1, '#fbbf24');

        ctx.fillStyle = isPlaying ? grad : 'rgba(255, 255, 255, 0.2)';
        ctx.beginPath();
        ctx.roundRect(x, y, barWidth, barHeight, [2, 2, 0, 0]);
        ctx.fill();
      }

      phase += 0.15;
      animFrameId.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      if (animFrameId.current) {
        cancelAnimationFrame(animFrameId.current);
      }
    };
  }, [isPlaying, barCount, color]);

  return (
    <canvas
      ref={canvasRef}
      width={barCount * 4}
      height={28}
      className={className}
      aria-hidden="true"
    />
  );
};
