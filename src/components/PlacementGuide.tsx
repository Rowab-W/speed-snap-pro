import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, CheckCircle, Smartphone, Car } from 'lucide-react';

interface PlacementGuideProps {
  isVisible: boolean;
  onClose: () => void;
}

export const PlacementGuide = ({ isVisible, onClose }: PlacementGuideProps) => {
  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Smartphone className="h-6 w-6 text-primary" />
                Optimal Phone Placement Guide
              </CardTitle>
              <CardDescription>
                Follow these tips for Dragy-level accuracy
              </CardDescription>
            </div>
            <button 
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground"
            >
              ✕
            </button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Best Practices */}
          <div>
            <h3 className="font-semibold text-sm flex items-center gap-2 mb-3">
              <CheckCircle className="h-4 w-4 text-green-500" />
              Best Practices
            </h3>
            <div className="grid gap-3">
              <div className="flex items-start gap-3 p-3 bg-green-50 dark:bg-green-950/20 rounded-lg">
                <Car className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium text-sm">Dashboard Mount</p>
                  <p className="text-xs text-muted-foreground">
                    Secure phone on dashboard with screen facing up toward sky
                  </p>
                </div>
                <Badge variant="secondary" className="ml-auto">Recommended</Badge>
              </div>
              
              <div className="flex items-start gap-3 p-3 bg-green-50 dark:bg-green-950/20 rounded-lg">
                <div className="h-5 w-5 bg-green-600 rounded-full mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium text-sm">Clear Sky View</p>
                  <p className="text-xs text-muted-foreground">
                    Ensure unobstructed view to satellites (no roof, trees, tunnels)
                  </p>
                </div>
              </div>
              
              <div className="flex items-start gap-3 p-3 bg-green-50 dark:bg-green-950/20 rounded-lg">
                <div className="h-5 w-5 bg-green-600 rounded-full mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium text-sm">Stable Mounting</p>
                  <p className="text-xs text-muted-foreground">
                    Use mount or place in secure location to minimize vibration
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Avoid These */}
          <div>
            <h3 className="font-semibold text-sm flex items-center gap-2 mb-3">
              <AlertTriangle className="h-4 w-4 text-red-500" />
              Avoid These Locations
            </h3>
            <div className="grid gap-2">
              <div className="flex items-center gap-3 p-2 bg-red-50 dark:bg-red-950/20 rounded-lg">
                <div className="h-2 w-2 bg-red-500 rounded-full" />
                <span className="text-sm">Near metal objects (can block GPS signals)</span>
              </div>
              <div className="flex items-center gap-3 p-2 bg-red-50 dark:bg-red-950/20 rounded-lg">
                <div className="h-2 w-2 bg-red-500 rounded-full" />
                <span className="text-sm">In cup holders or pockets (unstable)</span>
              </div>
              <div className="flex items-center gap-3 p-2 bg-red-50 dark:bg-red-950/20 rounded-lg">
                <div className="h-2 w-2 bg-red-500 rounded-full" />
                <span className="text-sm">Under windshield with metallic tint</span>
              </div>
              <div className="flex items-center gap-3 p-2 bg-red-50 dark:bg-red-950/20 rounded-lg">
                <div className="h-2 w-2 bg-red-500 rounded-full" />
                <span className="text-sm">Inside glove compartment or enclosed spaces</span>
              </div>
            </div>
          </div>

          {/* Pro Tips */}
          <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
            <h3 className="font-semibold text-sm mb-2">Pro Tips for Racing Accuracy</h3>
            <ul className="text-xs text-muted-foreground space-y-1">
              <li>• Wait for GPS accuracy below 10m before starting measurement</li>
              <li>• Perform a brief warmup to allow GPS and sensors to stabilize</li>
              <li>• Keep phone in airplane mode with only GPS enabled for best performance</li>
              <li>• For drag racing: Start measurement before entering staging area</li>
            </ul>
          </div>

          <button 
            onClick={onClose}
            className="w-full bg-primary text-primary-foreground py-2 px-4 rounded-lg font-medium"
          >
            Got it, let's measure!
          </button>
        </CardContent>
      </Card>
    </div>
  );
};