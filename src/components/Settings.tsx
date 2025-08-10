import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useTheme } from 'next-themes';
import { useUnits } from '@/contexts/UnitsContext';
import { Moon, Sun, Monitor, Gauge } from 'lucide-react';

const Settings: React.FC = () => {
  const { theme, setTheme } = useTheme();
  const { units, setUnits } = useUnits();

  const handleThemeChange = (value: string) => {
    setTheme(value);
  };

  const handleUnitsChange = (checked: boolean) => {
    setUnits(checked ? 'mph' : 'kmh');
  };

  const getThemeIcon = () => {
    switch (theme) {
      case 'dark':
        return <Moon className="h-4 w-4" />;
      case 'light':
        return <Sun className="h-4 w-4" />;
      default:
        return <Monitor className="h-4 w-4" />;
    }
  };

  return (
    <div className="container mx-auto p-4 space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">
          Customize your SpeedSnap experience
        </p>
      </div>

      <div className="grid gap-6">
        {/* Theme Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {getThemeIcon()}
              Appearance
            </CardTitle>
            <CardDescription>
              Choose your preferred theme for the application
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="theme-select">Theme</Label>
              <Select value={theme} onValueChange={handleThemeChange}>
                <SelectTrigger id="theme-select">
                  <SelectValue placeholder="Select theme" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="light">
                    <div className="flex items-center gap-2">
                      <Sun className="h-4 w-4" />
                      Light
                    </div>
                  </SelectItem>
                  <SelectItem value="dark">
                    <div className="flex items-center gap-2">
                      <Moon className="h-4 w-4" />
                      Dark
                    </div>
                  </SelectItem>
                  <SelectItem value="system">
                    <div className="flex items-center gap-2">
                      <Monitor className="h-4 w-4" />
                      System
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Units Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Gauge className="h-4 w-4" />
              Measurement Units
            </CardTitle>
            <CardDescription>
              Choose your preferred units for speed measurements
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="units-switch">Speed Units</Label>
                <div className="text-sm text-muted-foreground">
                  {units === 'mph' ? 'Miles per hour (mph)' : 'Kilometers per hour (km/h)'}
                </div>
              </div>
              <Switch
                id="units-switch"
                checked={units === 'mph'}
                onCheckedChange={handleUnitsChange}
              />
            </div>
          </CardContent>
        </Card>

        {/* About Section */}
        <Card>
          <CardHeader>
            <CardTitle>About SpeedSnap</CardTitle>
            <CardDescription>
              High-precision automotive performance measurement app
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-muted-foreground space-y-2">
              <p>
                SpeedSnap uses advanced sensor fusion and GPS tracking to provide
                accurate acceleration timing and speed measurements.
              </p>
              <p>
                Features include 0-60, quarter-mile timing, real-time speed tracking,
                and comprehensive performance analytics.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Settings;