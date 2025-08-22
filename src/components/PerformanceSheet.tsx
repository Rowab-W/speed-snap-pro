import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatDistanceToNow } from 'date-fns';
import { PerformanceReport } from './PerformanceReport';
import { BarChart3 } from 'lucide-react';

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

interface PerformanceRecord {
  id: string;
  max_speed: number;
  max_acceleration: number;
  measurement_duration: number;
  recorded_at: string;
}

interface PerformanceSheetProps {
  latestResults?: {
    dataPoints: DataPoint[];
    times: TimingResults;
    maxSpeed: number;
    totalDistance: number;
    totalTime: number;
  };
}

const PerformanceSheet: React.FC<PerformanceSheetProps> = ({ latestResults }) => {
  const [records, setRecords] = useState<PerformanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [showReport, setShowReport] = useState(false);

  useEffect(() => {
    fetchPerformanceRecords();
  }, []);

  const fetchPerformanceRecords = async () => {
    try {
      const { data, error } = await supabase
        .from('performance_records')
        .select('*')
        .order('recorded_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      setRecords(data || []);
    } catch (error) {
      console.error('Error fetching performance records:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDuration = (milliseconds: number) => {
    const seconds = Math.round(milliseconds / 1000);
    return `${seconds}s`;
  };

  // Show detailed report if requested
  if (showReport && latestResults) {
    return (
      <PerformanceReport
        dataPoints={latestResults.dataPoints}
        times={latestResults.times}
        maxSpeed={latestResults.maxSpeed}
        totalDistance={latestResults.totalDistance}
        totalTime={latestResults.totalTime}
        onBack={() => setShowReport(false)}
      />
    );
  }

  if (loading) {
    return (
      <div className="p-6 text-center">
        <div className="text-muted-foreground">Loading performance history...</div>
      </div>
    );
  }

  if (records.length === 0) {
    return (
      <div className="p-6 text-center">
        <div className="text-muted-foreground">No performance records yet.</div>
        <div className="text-sm text-muted-foreground mt-2">
          Complete a measurement to see your results here.
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-lg font-semibold">Performance History</div>
        {latestResults && (
          <Button onClick={() => setShowReport(true)} size="sm">
            <BarChart3 className="w-4 h-4 mr-2" />
            View Latest Report
          </Button>
        )}
      </div>
      
      <div className="grid gap-3">
        {records.map((record, index) => (
          <Card key={record.id} className="relative">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">
                  Run #{records.length - index}
                </CardTitle>
                <Badge variant="outline" className="text-xs">
                  {formatDistanceToNow(new Date(record.recorded_at), { addSuffix: true })}
                </Badge>
              </div>
            </CardHeader>
            
            <CardContent className="pt-0">
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div className="text-center">
                  <div className="text-muted-foreground text-xs">Max Speed</div>
                  <div className="font-semibold text-primary">
                    {record.max_speed.toFixed(1)} km/h
                  </div>
                </div>
                
                <div className="text-center">
                  <div className="text-muted-foreground text-xs">Max Acceleration</div>
                  <div className="font-semibold text-primary">
                    {record.max_acceleration.toFixed(2)} m/s²
                  </div>
                </div>
                
                <div className="text-center">
                  <div className="text-muted-foreground text-xs">Duration</div>
                  <div className="font-semibold text-primary">
                    {formatDuration(record.measurement_duration)}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default PerformanceSheet;