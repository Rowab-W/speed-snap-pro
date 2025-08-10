import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { User, Settings, Trophy, Timer, MessageSquare, HelpCircle, Send, Bell, Smartphone, Globe, Moon, Sun, Monitor } from 'lucide-react';
import { useUnits } from '@/contexts/UnitsContext';
import { useTheme } from 'next-themes';

const Profile = () => {
  const { units, setUnits } = useUnits();
  const { theme, setTheme } = useTheme();

  const getThemeIcon = () => {
    switch (theme) {
      case 'dark':
        return <Moon className="w-4 h-4" />;
      case 'light':
        return <Sun className="w-4 h-4" />;
      default:
        return <Monitor className="w-4 h-4" />;
    }
  };
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
          <div className="space-y-4">
            <div className="space-y-3">
              <h4 className="text-sm font-medium">Measurement Settings</h4>
              <div className="flex items-center justify-between">
                <span className="text-sm">Units</span>
                <Select value={units} onValueChange={(value: 'kmh' | 'mph') => setUnits(value)}>
                  <SelectTrigger className="w-20">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="kmh">km/h</SelectItem>
                    <SelectItem value="mph">mph</SelectItem>
                  </SelectContent>
                </Select>
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
            
            <div className="space-y-3">
              <h4 className="text-sm font-medium">App Settings</h4>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {getThemeIcon()}
                  <span className="text-sm">Theme</span>
                </div>
                <Select value={theme} onValueChange={setTheme}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="light">
                      <div className="flex items-center gap-2">
                        <Sun className="w-4 h-4" />
                        Light
                      </div>
                    </SelectItem>
                    <SelectItem value="dark">
                      <div className="flex items-center gap-2">
                        <Moon className="w-4 h-4" />
                        Dark
                      </div>
                    </SelectItem>
                    <SelectItem value="system">
                      <div className="flex items-center gap-2">
                        <Monitor className="w-4 h-4" />
                        System
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Bell className="w-4 h-4" />
                  <span className="text-sm">Notifications</span>
                </div>
                <Switch />
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Smartphone className="w-4 h-4" />
                  <span className="text-sm">Vibration Feedback</span>
                </div>
                <Switch />
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Globe className="w-4 h-4" />
                  <span className="text-sm">Share Data</span>
                </div>
                <Switch />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5" />
            Feedback
          </CardTitle>
          <CardDescription>
            Help us improve the app by sharing your thoughts
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Textarea 
              placeholder="Tell us what you think about the app, report bugs, or suggest new features..."
              className="min-h-[100px]"
            />
            <Button className="w-full">
              <Send className="w-4 h-4 mr-2" />
              Send Feedback
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HelpCircle className="w-5 h-5" />
            FAQ
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="accuracy">
              <AccordionTrigger>How accurate are the speed measurements?</AccordionTrigger>
              <AccordionContent>
                The app uses GPS and accelerometer data fusion to provide accurate speed measurements. 
                Accuracy depends on GPS signal quality and device capabilities. For best results, use the app outdoors with clear sky view.
              </AccordionContent>
            </AccordionItem>
            
            <AccordionItem value="threshold">
              <AccordionTrigger>What is the acceleration threshold?</AccordionTrigger>
              <AccordionContent>
                The acceleration threshold (currently set to 0.3 m/s²) determines when the measurement starts. 
                When the app detects acceleration above this threshold after pressing START, it begins recording your speed.
              </AccordionContent>
            </AccordionItem>
            
            <AccordionItem value="permissions">
              <AccordionTrigger>Why does the app need GPS and motion permissions?</AccordionTrigger>
              <AccordionContent>
                GPS permission is required to measure your speed and location accurately. 
                Motion sensor permission allows the app to detect when you start accelerating to automatically begin measurements.
              </AccordionContent>
            </AccordionItem>
            
            <AccordionItem value="battery">
              <AccordionTrigger>Does the app drain battery quickly?</AccordionTrigger>
              <AccordionContent>
                The app is optimized for minimal battery usage. GPS and sensors are only active during measurements. 
                Remember to stop measurements when finished to conserve battery.
              </AccordionContent>
            </AccordionItem>
            
            <AccordionItem value="support">
              <AccordionTrigger>How can I get support?</AccordionTrigger>
              <AccordionContent>
                You can send feedback through the Feedback section above, or contact our support team. 
                We typically respond within 24 hours.
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardContent>
      </Card>
    </div>
  );
};

export default Profile;