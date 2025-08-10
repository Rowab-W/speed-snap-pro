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
  accelerationThreshold = 0.3 // Dragy-like sensitivity
}: UseSensorFusionProps) => {
  const ekfRef = useRef<ExtendedKalmanFilter | null>(null);
  const accelerometerRef = useRef<AccelerometerData>({ x: 0, y: 0, z: 0 });
  const waitingForAccelerationRef = useRef<boolean>(false);
  const baselineAccelRef = useRef<number>(9.81); // Gravity baseline for calibration
  const calibrationSamplesRef = useRef<number[]>([]);

  useEffect(() => {
    waitingForAccelerationRef.current = waitingForAcceleration;
  }, [waitingForAcceleration]);

  // Auto-calibration for IMU drift compensation
  const calibrateBaseline = useCallback(() => {
    if (calibrationSamplesRef.current.length >= 50) {
      // Calculate stable baseline from recent stationary readings
      const avgMagnitude = calibrationSamplesRef.current.reduce((a, b) => a + b, 0) / calibrationSamplesRef.current.length;
      baselineAccelRef.current = avgMagnitude;
      console.log('🎯 IMU baseline calibrated to:', avgMagnitude.toFixed(3), 'm/s²');
      calibrationSamplesRef.current = []; // Reset for next calibration
    }
  }, []);

  const initializeSensors = useCallback(async () => {
    try {
      console.log('🚀 Initializing Dragy-style motion sensors...');
      
      // Try Capacitor Motion for native mobile support with high frequency
      try {
        // Request device motion permissions for iOS
        if (typeof (DeviceMotionEvent as any).requestPermission === 'function') {
          const permission = await (DeviceMotionEvent as any).requestPermission();
          if (permission !== 'granted') {
            throw new Error('Motion permission denied');
          }
        }

        const motionListener = await Motion.addListener('accel', (event) => {
          const rawAccel = {
            x: event.acceleration.x,
            y: event.acceleration.y,
            z: event.acceleration.z,
          };
          
          accelerometerRef.current = rawAccel;
          const magnitude = Math.sqrt(rawAccel.x * rawAccel.x + rawAccel.y * rawAccel.y + rawAccel.z * rawAccel.z);
          
          // Continuous calibration when stationary
          if (!waitingForAccelerationRef.current && magnitude < baselineAccelRef.current + 0.2) {
            calibrationSamplesRef.current.push(magnitude);
            if (calibrationSamplesRef.current.length > 100) {
              calibrationSamplesRef.current.shift(); // Keep rolling window
            }
            if (calibrationSamplesRef.current.length === 50) {
              calibrateBaseline();
            }
          }
          
          // Enhanced acceleration detection with baseline compensation
          if (waitingForAccelerationRef.current) {
            const netAccel = Math.abs(magnitude - baselineAccelRef.current);
            console.log('🏃 IMU reading:', {
              raw: magnitude.toFixed(3),
              baseline: baselineAccelRef.current.toFixed(3),
              net: netAccel.toFixed(3),
              threshold: accelerationThreshold
            });
            
            if (netAccel > accelerationThreshold) {
              console.log('🚀 Acceleration threshold exceeded! Net accel:', netAccel.toFixed(3), 'm/s²');
              waitingForAccelerationRef.current = false;
              onAccelerationDetected();
              
              toast({
                title: "Launch Detected!",
                description: `Acceleration: ${netAccel.toFixed(1)} m/s²`,
              });
            }
          }
        });
        
        console.log('✅ Capacitor Motion sensors initialized');
        
        return () => {
          motionListener.remove();
        };
      } catch (capacitorError) {
        console.log('⚠️ Capacitor Motion not available, falling back to browser API');
        
        // Enhanced browser DeviceMotionEvent fallback
        if ('DeviceMotionEvent' in window) {
          // Request permission for iOS Safari
          if (typeof (DeviceMotionEvent as any).requestPermission === 'function') {
            const permission = await (DeviceMotionEvent as any).requestPermission();
            if (permission !== 'granted') {
              throw new Error('Motion permission denied by user');
            }
          }

          const handleDeviceMotion = (event: DeviceMotionEvent) => {
            if (event.acceleration) {
              const rawAccel = {
                x: event.acceleration.x || 0,
                y: event.acceleration.y || 0,
                z: event.acceleration.z || 0,
              };
              
              accelerometerRef.current = rawAccel;
              const magnitude = Math.sqrt(rawAccel.x * rawAccel.x + rawAccel.y * rawAccel.y + rawAccel.z * rawAccel.z);
              
              // Calibration for browser motion events
              if (!waitingForAccelerationRef.current && magnitude < baselineAccelRef.current + 0.2) {
                calibrationSamplesRef.current.push(magnitude);
                if (calibrationSamplesRef.current.length > 100) {
                  calibrationSamplesRef.current.shift();
                }
                if (calibrationSamplesRef.current.length === 50) {
                  calibrateBaseline();
                }
              }
              
              if (waitingForAccelerationRef.current) {
                const netAccel = Math.abs(magnitude - baselineAccelRef.current);
                console.log('🏃 Browser IMU:', {
                  raw: magnitude.toFixed(3),
                  baseline: baselineAccelRef.current.toFixed(3),
                  net: netAccel.toFixed(3),
                  threshold: accelerationThreshold
                });
                
                if (netAccel > accelerationThreshold) {
                  console.log('🚀 Browser acceleration detected! Net:', netAccel.toFixed(3), 'm/s²');
                  waitingForAccelerationRef.current = false;
                  onAccelerationDetected();
                  
                  toast({
                    title: "Launch Detected!",
                    description: `Acceleration: ${netAccel.toFixed(1)} m/s²`,
                  });
                }
              }
            }
          };

          window.addEventListener('devicemotion', handleDeviceMotion);
          console.log('✅ Browser motion sensors initialized');
          
          return () => {
            window.removeEventListener('devicemotion', handleDeviceMotion);
          };
        } else {
          throw new Error('No motion sensors available');
        }
      }
    } catch (error) {
      console.error('❌ Sensor initialization failed:', error);
      toast({
        title: "Sensor Error",
        description: "Motion sensors unavailable. GPS-only mode enabled.",
        variant: "destructive",
      });
    }
  }, [onAccelerationDetected, accelerationThreshold, calibrateBaseline]);

  const initializeKalmanFilter = useCallback(() => {
    ekfRef.current = new ExtendedKalmanFilter();
    console.log('🔬 Enhanced Kalman Filter initialized for sensor fusion');
  }, []);

  const updateKalmanFilter = useCallback((speedKmh: number, accelMagnitude: number, dt: number) => {
    if (!ekfRef.current) return speedKmh;
    
    // Enhanced Kalman filtering with drift compensation
    ekfRef.current.predict(dt);
    const fusedSpeed = ekfRef.current.update([speedKmh, accelMagnitude - baselineAccelRef.current]);
    
    // Additional smoothing for Dragy-like stability
    return Math.max(0, fusedSpeed);
  }, []);

  const getAccelerometerData = useCallback(() => {
    return accelerometerRef.current;
  }, []);

  const resetSensorFusion = useCallback(() => {
    waitingForAccelerationRef.current = false;
    ekfRef.current = new ExtendedKalmanFilter();
    calibrationSamplesRef.current = [];
    baselineAccelRef.current = 9.81; // Reset to standard gravity
    console.log('🔄 Sensor fusion reset and recalibrated');
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