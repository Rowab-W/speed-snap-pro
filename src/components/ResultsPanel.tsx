import React from 'react';
import { Card } from '@/components/ui/card';

interface TimingResults {
  '0-100': number | null;
  '0-200': number | null;
  '0-250': number | null;
  '0-300': number | null;
  quarterMile: number | null;
  halfMile: number | null;
}

interface ResultsPanelProps {
  times: TimingResults;
  hasResults: boolean;
}

export const ResultsPanel: React.FC<ResultsPanelProps> = ({ times, hasResults }) => {
  if (!hasResults) return null;

  return (
    <Card className="p-6 space-y-4">
      <h3 className="text-lg font-semibold text-center">Results</h3>
      <div className="grid grid-cols-2 gap-3">
        {times['0-100'] && (
          <div className="text-center p-3 bg-muted rounded-lg">
            <div className="text-sm text-muted-foreground">0-100 km/h</div>
            <div className="text-lg font-bold text-primary">{times['0-100'].toFixed(2)}s</div>
          </div>
        )}
        {times['0-200'] && (
          <div className="text-center p-3 bg-muted rounded-lg">
            <div className="text-sm text-muted-foreground">0-200 km/h</div>
            <div className="text-lg font-bold text-accent">{times['0-200'].toFixed(2)}s</div>
          </div>
        )}
        {times['0-250'] && (
          <div className="text-center p-3 bg-muted rounded-lg">
            <div className="text-sm text-muted-foreground">0-250 km/h</div>
            <div className="text-lg font-bold text-warning">{times['0-250'].toFixed(2)}s</div>
          </div>
        )}
        {times['0-300'] && (
          <div className="text-center p-3 bg-muted rounded-lg">
            <div className="text-sm text-muted-foreground">0-300 km/h</div>
            <div className="text-lg font-bold text-success">{times['0-300'].toFixed(2)}s</div>
          </div>
        )}
        {times.quarterMile && (
          <div className="text-center p-3 bg-muted rounded-lg">
            <div className="text-sm text-muted-foreground">1/4 Mile</div>
            <div className="text-lg font-bold text-primary">{times.quarterMile.toFixed(2)}s</div>
          </div>
        )}
        {times.halfMile && (
          <div className="text-center p-3 bg-muted rounded-lg">
            <div className="text-sm text-muted-foreground">1/2 Mile</div>
            <div className="text-lg font-bold text-accent">{times.halfMile.toFixed(2)}s</div>
          </div>
        )}
      </div>
    </Card>
  );
};