import SpeedSnap from '@/components/SpeedSnap';
import PerformanceSheet from '@/components/PerformanceSheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <Tabs defaultValue="measurement" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="measurement">Speed Test</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
        </TabsList>
        
        <TabsContent value="measurement" className="mt-0">
          <SpeedSnap />
        </TabsContent>
        
        <TabsContent value="performance" className="mt-0">
          <PerformanceSheet />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Index;
