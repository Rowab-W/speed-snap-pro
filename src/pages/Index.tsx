import SpeedSnap from '@/components/SpeedSnap';
import PerformanceSheet from '@/components/PerformanceSheet';
import Profile from '@/components/Profile';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <Tabs defaultValue="measurement" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="measurement">Speed Test</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="profile">Profile</TabsTrigger>
        </TabsList>
        
        <TabsContent value="measurement" className="mt-0">
          <SpeedSnap />
        </TabsContent>
        
        <TabsContent value="performance" className="mt-0">
          <PerformanceSheet />
        </TabsContent>
        
        <TabsContent value="profile" className="mt-0">
          <Profile />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Index;
