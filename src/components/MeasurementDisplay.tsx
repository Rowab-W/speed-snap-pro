import React from 'react';
import { Card } from '@/components/ui/card';
import { Gauge } from 'lucide-react';
import { useUnits } from '@/contexts/UnitsContext';

interface MeasurementDisplayProps {
  speed: number;
  elapsedTime: number;
  status: string;
  isRunning: boolean;
  targetHit?: boolean;
}

export const MeasurementDisplay: React.FC<MeasurementDisplayProps> = ({
  speed,
  elapsedTime,
  status,
  isRunning,
  targetHit = false
}) => {
  const { convertSpeed, getSpeedUnit } = useUnits();
  const displaySpeed = convertSpeed(speed);
  return (
    <Card className="p-6 text-center space-y-4 racing-glow">
      <div className="space-y-2">
        <div className={`text-6xl font-bold speed-gradient ${isRunning ? 'pulse-racing' : ''} ${targetHit ? 'target-pop' : ''}`}>
          {Math.round(displaySpeed)} {getSpeedUnit()}
        </div>
        <div className="text-2xl text-accent font-mono">
          {elapsedTime.toFixed(2)} s
        </div>
      </div>

      <div className="flex items-center justify-center gap-2">
        <Gauge className="w-4 h-4 text-muted-foreground" />
        <span className="text-sm text-muted-foreground">{status}</span>
      </div>
    </Card>
  );
};