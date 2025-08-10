import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { User, Settings, Trophy, Timer } from 'lucide-react';

const Profile = () => {
  return (
    <div className="p-4 space-y-6">
      <Card>
        <CardHeader className="text-center">
          <div className="mx-auto w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mb-4">
            <User className="w-10 h-10 text-primary" />
          </div>
          <CardTitle>Speed Tester</CardTitle>
          <CardDescription>Performance enthusiast</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 text-center">
            <div className="space-y-2">
              <Timer className="w-6 h-6 mx-auto text-muted-foreground" />
              <div className="text-2xl font-bold">0</div>
              <div className="text-sm text-muted-foreground">Tests Run</div>
            </div>
            <div className="space-y-2">
              <Trophy className="w-6 h-6 mx-auto text-muted-foreground" />
              <div className="text-2xl font-bold">0</div>
              <div className="text-sm text-muted-foreground">Best Time</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="w-5 h-5" />
            Achievements
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm">First Test</span>
              <Badge variant="secondary">Locked</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Speed Demon</span>
              <Badge variant="secondary">Locked</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Consistency Master</span>
              <Badge variant="secondary">Locked</Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            Settings
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm">Units</span>
              <Badge variant="outline">km/h</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Acceleration Threshold</span>
              <Badge variant="outline">0.3 m/s²</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">GPS Precision</span>
              <Badge variant="outline">High</Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Profile;