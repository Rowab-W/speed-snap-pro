import { useState } from 'react';
import SpeedSnap from '@/components/SpeedSnap';
import PerformanceSheet from '@/components/PerformanceSheet';
import Profile from '@/components/Profile';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

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

interface LatestResults {
  dataPoints: DataPoint[];
  times: TimingResults;
  maxSpeed: number;
  totalDistance: number;
  totalTime: number;
}

const Index = () => {
  const [latestResults, setLatestResults] = useState<LatestResults | undefined>(undefined);

  const handleMeasurementComplete = (results: LatestResults) => {
    setLatestResults(results);
  };
  return (
    <div className="min-h-screen bg-background">
      <Tabs defaultValue="measurement" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="measurement">Speed Test</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="profile">Profile</TabsTrigger>
        </TabsList>
        
        <TabsContent value="measurement" className="mt-0">
          <SpeedSnap onMeasurementComplete={handleMeasurementComplete} />
        </TabsContent>
        
        <TabsContent value="performance" className="mt-0">
          <PerformanceSheet latestResults={latestResults} />
        </TabsContent>
        
        <TabsContent value="profile" className="mt-0">
          <Profile />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Index;
