import React from 'react';
import { Line } from 'react-chartjs-2';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Clock, Route } from 'lucide-react';
import { useUnits } from '@/contexts/UnitsContext';
import { Button } from '@/components/ui/button';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

interface DataPoint {
  time: number;
  speed: number;
}

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

interface PerformanceReportProps {
  dataPoints: DataPoint[];
  times: TimingResults;
  maxSpeed: number;
  totalDistance: number;
  totalTime: number;
  onBack: () => void;
}

export const PerformanceReport: React.FC<PerformanceReportProps> = ({ 
  dataPoints, 
  times, 
  maxSpeed, 
  totalDistance, 
  totalTime,
  onBack 
}) => {
  const { getTargets, getSpeedUnit } = useUnits();
  const targets = getTargets();

  // Prepare chart data
  const chartData = {
    labels: dataPoints.map(point => point.time.toFixed(1)),
    datasets: [
      {
        label: `Speed (${getSpeedUnit()})`,
        data: dataPoints.map(point => point.speed),
        borderColor: '#3b82f6',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        borderWidth: 2,
        fill: true,
        tension: 0.1,
        pointRadius: 0,
        pointHoverRadius: 4,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        mode: 'index' as const,
        intersect: false,
        callbacks: {
          label: (context: any) => `${context.parsed.y.toFixed(1)} ${getSpeedUnit()}`,
          title: (contexts: any) => `${contexts[0].label}s`,
        },
      },
    },
    scales: {
      x: {
        title: {
          display: true,
          text: 'Time (s)',
        },
        grid: {
          color: 'rgba(0, 0, 0, 0.1)',
        },
      },
      y: {
        title: {
          display: true,
          text: `Speed (${getSpeedUnit()})`,
        },
        grid: {
          color: 'rgba(0, 0, 0, 0.1)',
        },
        beginAtZero: true,
      },
    },
    interaction: {
      mode: 'nearest' as const,
      axis: 'x' as const,
      intersect: false,
    },
  };

  // Filter and format timing results for display
  const validResults = targets.labels
    .map((label, index) => ({
      label,
      speed: targets.speeds[index],
      time: times[label as keyof TimingResults]
    }))
    .filter(result => result.time !== null)
    .sort((a, b) => a.speed - b.speed);

  return (
    <div className="p-4 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div>
          <h2 className="text-xl font-semibold">Performance Report</h2>
          <p className="text-sm text-muted-foreground">
            {new Date().toLocaleDateString()} at {new Date().toLocaleTimeString()}
          </p>
        </div>
        <Badge variant="outline" className="ml-auto">Valid Test</Badge>
      </div>

      {/* Speed Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            Speed vs Time
            <div className="flex items-center gap-1 ml-auto">
              <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
              <span className="text-sm text-muted-foreground">Speed ({getSpeedUnit()})</span>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <Line data={chartData} options={chartOptions} />
          </div>
        </CardContent>
      </Card>

      {/* Summary Statistics */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6 text-center">
            <Route className="w-6 h-6 mx-auto mb-2 text-muted-foreground" />
            <div className="text-2xl font-bold">{totalDistance.toFixed(0)}m</div>
            <div className="text-sm text-muted-foreground">Distance</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6 text-center">
            <Clock className="w-6 h-6 mx-auto mb-2 text-muted-foreground" />
            <div className="text-2xl font-bold">{totalTime.toFixed(2)}s</div>
            <div className="text-sm text-muted-foreground">Total Time</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6 text-center">
            <div className="w-6 h-6 mx-auto mb-2 bg-primary rounded-full flex items-center justify-center">
              <span className="text-xs text-primary-foreground font-bold">MAX</span>
            </div>
            <div className="text-2xl font-bold">{maxSpeed.toFixed(1)}</div>
            <div className="text-sm text-muted-foreground">Top Speed ({getSpeedUnit()})</div>
          </CardContent>
        </Card>
      </div>

      {/* Timing Results */}
      {validResults.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Speed Milestones</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3">
              {validResults.map((result, index) => (
                <div key={result.label} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                    <span className="text-sm font-medium">{result.label} {getSpeedUnit()}</span>
                  </div>
                  <span className="text-sm font-bold">{result.time!.toFixed(2)}s</span>
                </div>
              ))}
            </div>
            
            {/* Quarter and Half Mile if available */}
            {(times.quarterMile || times.halfMile) && (
              <div className="mt-4 pt-4 border-t">
                <div className="text-sm font-medium mb-3">Distance Milestones</div>
                <div className="grid grid-cols-2 gap-3">
                  {times.quarterMile && (
                    <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 bg-orange-500 rounded-full"></div>
                        <span className="text-sm font-medium">1/4 Mile</span>
                      </div>
                      <span className="text-sm font-bold">{times.quarterMile.toFixed(2)}s</span>
                    </div>
                  )}
                  {times.halfMile && (
                    <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 bg-orange-500 rounded-full"></div>
                        <span className="text-sm font-medium">1/2 Mile</span>
                      </div>
                      <span className="text-sm font-bold">{times.halfMile.toFixed(2)}s</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};