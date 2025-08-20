import React from 'react';
import { Card } from '@/components/ui/card';
import { useUnits } from '@/contexts/UnitsContext';

interface TimingResults {
  '0-20': number | null;
  '0-30': number | null;
  '0-40': number | null;
  '0-60': number | null;
  '0-80': number | null;
  '0-100': number | null;
  '0-120': number | null;
  '0-130': number | null;
  '0-200': number | null;
  '0-250': number | null;
  quarterMile: number | null;
  halfMile: number | null;
}

interface ResultsPanelProps {
  times: TimingResults;
  hasResults: boolean;
  isRunning?: boolean;
  hitTargetLabel?: string | null;
  maxSpeed?: number;
}

export const ResultsPanel: React.FC<ResultsPanelProps> = ({ times, hasResults, isRunning = false, hitTargetLabel = null, maxSpeed = 0 }) => {
  const { getTargets, getSpeedUnit } = useUnits();
  const targets = getTargets();

  return (
    <Card className="p-6 space-y-4">
      <h3 className="text-lg font-semibold text-center">
        {isRunning ? "Live Results" : "Results"}
      </h3>
      <div className="grid grid-cols-2 gap-3">
        {targets.labels.map((label, index) => {
          const key = label as keyof TimingResults;
          const speed = targets.speeds[index];
          const isHighlighted = hitTargetLabel === key;
          return (
            <div 
              key={label} 
              className={`text-center p-3 bg-muted rounded-lg transition-all duration-300 ${
                isHighlighted ? 'target-hit-highlight' : ''
              }`}
            >
              <div className="text-sm text-muted-foreground">{label} {getSpeedUnit()}</div>
              <div className={`text-lg font-bold ${times[key] ? 'text-primary' : 'text-muted-foreground'}`}>
                {times[key] ? `${times[key]!.toFixed(2)}s` : '--'}
              </div>
            </div>
          );
        })}
        
        <div className={`text-center p-3 bg-muted rounded-lg transition-all duration-300 ${
          hitTargetLabel === 'quarterMile' ? 'target-hit-highlight' : ''
        }`}>
          <div className="text-sm text-muted-foreground">1/4 Mile</div>
          <div className={`text-lg font-bold ${times.quarterMile ? 'text-primary' : 'text-muted-foreground'}`}>
            {times.quarterMile ? `${times.quarterMile.toFixed(2)}s` : '--'}
          </div>
        </div>
        
        <div className={`text-center p-3 bg-muted rounded-lg transition-all duration-300 ${
          hitTargetLabel === 'halfMile' ? 'target-hit-highlight' : ''
        }`}>
          <div className="text-sm text-muted-foreground">1/2 Mile</div>
          <div className={`text-lg font-bold ${times.halfMile ? 'text-primary' : 'text-muted-foreground'}`}>
            {times.halfMile ? `${times.halfMile.toFixed(2)}s` : '--'}
          </div>
        </div>
        
        <div className="text-center p-3 bg-muted rounded-lg">
          <div className="text-sm text-muted-foreground">Top Speed</div>
          <div className={`text-lg font-bold ${maxSpeed > 0 ? 'text-primary' : 'text-muted-foreground'}`}>
            {maxSpeed > 0 ? `${maxSpeed.toFixed(1)} ${getSpeedUnit()}` : '--'}
          </div>
        </div>
      </div>
    </Card>
  );
};