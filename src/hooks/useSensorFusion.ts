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
      // Initialize Capacitor Motion sensors for better mobile support with 200Hz sampling
      try {
        const motionListener = await Motion.addListener('accel', (event) => {
          accelerometerRef.current = {
            x: event.acceleration.x,
            y: event.acceleration.y,
            z: event.acceleration.z,
          };
          
          // Only check acceleration if START button was pressed AND we're waiting for acceleration
          if (waitingForAccelerationRef.current) {
            const { x, y, z } = accelerometerRef.current;
            const magnitude = Math.sqrt(x * x + y * y + z * z);
            console.log('🏃 Accelerometer reading:', { x, y, z, magnitude, threshold: accelerationThreshold });
            
            // Use lower threshold (0.15 m/s² for easier triggering)
            if (magnitude > accelerationThreshold) {
              console.log('🚀 Acceleration threshold exceeded! Triggering measurement start');
              // Trigger actual measurement start
              waitingForAccelerationRef.current = false;
              onAccelerationDetected();
              
              toast({
                title: "Measurement Started!",
                description: "Tracking your acceleration now",
              });
            }
          } else {
            console.log('🔍 Accelerometer active but not waiting for acceleration');
          }
        });
        
        return () => {
          motionListener.remove();
        };
      } catch (error) {
        // Fallback to browser motion events if Capacitor is not available
        if ('DeviceMotionEvent' in window) {
          const handleDeviceMotion = (event: DeviceMotionEvent) => {
            if (event.acceleration) {
              accelerometerRef.current = {
                x: event.acceleration.x || 0,
                y: event.acceleration.y || 0,
                z: event.acceleration.z || 0,
              };
              
              // Only check acceleration if START button was pressed AND we're waiting for acceleration
              if (waitingForAccelerationRef.current) {
                const { x, y, z } = accelerometerRef.current;
                const magnitude = Math.sqrt(x * x + y * y + z * z);
                
                // Use lower threshold (0.15 m/s² for easier triggering)
                if (magnitude > accelerationThreshold) {
                  // Trigger actual measurement start
                  waitingForAccelerationRef.current = false;
                  onAccelerationDetected();
                  
                  toast({
                    title: "Measurement Started!",
                    description: "Tracking your acceleration now",
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