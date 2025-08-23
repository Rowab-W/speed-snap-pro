import { useRef, useEffect, useCallback } from 'react';
import { ExtendedKalmanFilter } from '../utils/ExtendedKalmanFilter';
import { Motion } from '@capacitor/motion';
import { toast } from '@/hooks/use-toast';

interface AccelerometerData {
  x: number;
  y: number;
  z: number;
}

interface UseSensorFusionProps {
  onAccelerationDetected: () => void;
  waitingForAcceleration: boolean;
  accelerationThreshold: number;
}

export const useSensorFusion = ({ 
  onAccelerationDetected, 
  waitingForAcceleration,
  accelerationThreshold = 0.5 
}: UseSensorFusionProps) => {
  const ekfRef = useRef<ExtendedKalmanFilter | null>(null);
  const accelerometerRef = useRef<AccelerometerData>({ x: 0, y: 0, z: 0 });
  const waitingForAccelerationRef = useRef<boolean>(false);

  // Initialize sensors and permissions
  useEffect(() => {
    waitingForAccelerationRef.current = waitingForAcceleration;
  }, [waitingForAcceleration]);

  const initializeSensors = useCallback(async () => {
    try {
      // Try LinearAccelerometer first (excludes gravity)
      if ('LinearAccelerometer' in window) {
        try {
          const linearAccel = new (window as any).LinearAccelerometer({ frequency: 50 });
          linearAccel.addEventListener('reading', () => {
            accelerometerRef.current = {
              x: linearAccel.x || 0,
              y: linearAccel.y || 0,
              z: linearAccel.z || 0,
            };
            
            // Only check acceleration if START button was pressed AND we're waiting for acceleration
            if (waitingForAccelerationRef.current) {
              const { x, y, z } = accelerometerRef.current;
              const magnitude = Math.sqrt(x * x + y * y + z * z);
              console.log('🏃 LinearAccelerometer reading:', { x, y, z, magnitude, threshold: accelerationThreshold });
              
              // Higher threshold for LinearAccelerometer since gravity is removed
              if (magnitude > 2.5) {
                console.log('🚀 Linear acceleration threshold exceeded! Triggering measurement start');
                waitingForAccelerationRef.current = false;
                onAccelerationDetected();
                
                toast({
                  title: "Measurement Started!",
                  description: "Linear acceleration detected",
                });
              }
            }
          });
          
          linearAccel.start();
          console.log('✅ LinearAccelerometer initialized (gravity excluded)');
          
          return () => {
            linearAccel.stop();
          };
        } catch (error) {
          console.log('❌ LinearAccelerometer failed, falling back to regular accelerometer');
          // Fall through to Capacitor Motion
        }
      }

      // Fallback to Capacitor Motion or regular accelerometer
      try {
        const motionListener = await Motion.addListener('accel', (event) => {
          // Subtract gravity approximation from Z-axis for regular accelerometer
          accelerometerRef.current = {
            x: event.acceleration.x,
            y: event.acceleration.y,
            z: event.acceleration.z - 9.8, // Remove gravity
          };
          
          // Only check acceleration if START button was pressed AND we're waiting for acceleration
          if (waitingForAccelerationRef.current) {
            const { x, y, z } = accelerometerRef.current;
            const magnitude = Math.sqrt(x * x + y * y + z * z);
            console.log('🏃 Capacitor accelerometer reading (gravity removed):', { x, y, z, magnitude, threshold: accelerationThreshold });
            
            // Higher threshold since we're removing gravity
            if (magnitude > 2.5) {
              console.log('🚀 Acceleration threshold exceeded! Triggering measurement start');
              waitingForAccelerationRef.current = false;
              onAccelerationDetected();
              
              toast({
                title: "Measurement Started!",
                description: "Motion detected via accelerometer",
              });
            }
          }
        });
        
        return () => {
          motionListener.remove();
        };
      } catch (error) {
        // Fallback to browser DeviceMotionEvent if Capacitor is not available
        if ('DeviceMotionEvent' in window) {
          const handleDeviceMotion = (event: DeviceMotionEvent) => {
            if (event.acceleration) {
              // Subtract gravity approximation from Z-axis for browser accelerometer
              accelerometerRef.current = {
                x: event.acceleration.x || 0,
                y: event.acceleration.y || 0,
                z: (event.acceleration.z || 0) - 9.8, // Remove gravity
              };
              
              // Only check acceleration if START button was pressed AND we're waiting for acceleration
              if (waitingForAccelerationRef.current) {
                const { x, y, z } = accelerometerRef.current;
                const magnitude = Math.sqrt(x * x + y * y + z * z);
                console.log('🏃 Browser accelerometer reading (gravity removed):', { x, y, z, magnitude });
                
                // Higher threshold since gravity is removed
                if (magnitude > 2.5) {
                  waitingForAccelerationRef.current = false;
                  onAccelerationDetected();
                  
                  toast({
                    title: "Measurement Started!",
                    description: "Motion detected via browser",
                  });
                }
              }
            }
          };

          window.addEventListener('devicemotion', handleDeviceMotion);
          
          return () => {
            window.removeEventListener('devicemotion', handleDeviceMotion);
          };
        }
      }
    } catch (error) {
      console.error('Error initializing sensors:', error);
      toast({
        title: "Sensor Error",
        description: "Motion sensors not available",
        variant: "destructive",
      });
    }
  }, [onAccelerationDetected, accelerationThreshold]);

  const initializeKalmanFilter = useCallback(() => {
    ekfRef.current = new ExtendedKalmanFilter();
  }, []);

  const updateKalmanFilter = useCallback((speedKmh: number, accelMagnitude: number, dt: number) => {
    if (!ekfRef.current) return speedKmh;
    
    ekfRef.current.predict(dt);
    return ekfRef.current.update([speedKmh, accelMagnitude]);
  }, []);

  const getAccelerometerData = useCallback(() => {
    return accelerometerRef.current;
  }, []);

  const resetSensorFusion = useCallback(() => {
    waitingForAccelerationRef.current = false;
    ekfRef.current = new ExtendedKalmanFilter();
  }, []);

  return {
    initializeSensors,
    initializeKalmanFilter,
    updateKalmanFilter,
    getAccelerometerData,
    resetSensorFusion,
    waitingForAccelerationRef
  };
};