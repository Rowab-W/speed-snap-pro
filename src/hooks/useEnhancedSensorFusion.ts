import { useEffect, useState, useRef, useCallback } from 'react';
import { ExtendedKalmanFilter } from '../utils/ExtendedKalmanFilter';
import { Motion } from '@capacitor/motion';
import { toast } from '@/hooks/use-toast';

interface SensorData {
  speed: number; // km/h
  acceleration: { x: number; y: number; z: number }; // m/s²
  rotationRate: { alpha: number; beta: number; gamma: number }; // deg/s
  timestamp: number;
}

interface UseEnhancedSensorFusionProps {
  onAccelerationDetected: () => void;
  waitingForAcceleration: boolean;
  accelerationThreshold: number;
  isRunning: boolean;
  onSpeedUpdate: (speed: number) => void;
  onDataPointAdded: (dataPoint: { time: number; speed: number }) => void;
}

export const useEnhancedSensorFusion = ({ 
  onAccelerationDetected, 
  waitingForAcceleration,
  accelerationThreshold = 0.3,
  isRunning,
  onSpeedUpdate,
  onDataPointAdded
}: UseEnhancedSensorFusionProps) => {
  const [sensorData, setSensorData] = useState<SensorData | null>(null);
  const [fusedSpeed, setFusedSpeed] = useState(0);
  const [gpsStatus, setGpsStatus] = useState<string>('Initializing...');

  const ekfRef = useRef<ExtendedKalmanFilter | null>(null);
  const geoWatchRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const lastTimestampRef = useRef<number | null>(null);
  const baselineAccelRef = useRef<number>(9.81);
  const calibrationSamplesRef = useRef<number[]>([]);
  const waitingForAccelerationRef = useRef<boolean>(false);

  useEffect(() => {
    waitingForAccelerationRef.current = waitingForAcceleration;
  }, [waitingForAcceleration]);

  // Initialize Kalman Filter
  const initializeKalmanFilter = useCallback(() => {
    ekfRef.current = new ExtendedKalmanFilter();
    console.log('🔬 Enhanced Kalman Filter initialized for improved sensor fusion');
  }, []);

  // Auto-calibration for IMU drift compensation
  const calibrateBaseline = useCallback(() => {
    if (calibrationSamplesRef.current.length >= 50) {
      const avgMagnitude = calibrationSamplesRef.current.reduce((a, b) => a + b, 0) / calibrationSamplesRef.current.length;
      baselineAccelRef.current = avgMagnitude;
      console.log('🎯 Enhanced IMU baseline calibrated to:', avgMagnitude.toFixed(3), 'm/s²');
      calibrationSamplesRef.current = [];
    }
  }, []);

  // Enhanced GPS tracking with continuous updates
  const initializeGPS = useCallback(() => {
    if (geoWatchRef.current) {
      navigator.geolocation.clearWatch(geoWatchRef.current);
    }

    setGpsStatus('Requesting GPS permission...');
    
    // Use watchPosition for continuous high-accuracy updates
    geoWatchRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const gpsSpeed = pos.coords.speed ? pos.coords.speed * 3.6 : 0; // m/s to km/h
        const timestamp = Date.now();
        
        if (isRunning && startTimeRef.current) {
          const elapsedTime = (timestamp - startTimeRef.current) / 1000;
          
          // Fuse GPS speed with sensor data if Kalman filter is available
          if (ekfRef.current && sensorData) {
            const accelMagnitude = Math.sqrt(
              sensorData.acceleration.x ** 2 + 
              sensorData.acceleration.y ** 2 + 
              sensorData.acceleration.z ** 2
            );
            
            const dt = lastTimestampRef.current ? (timestamp - lastTimestampRef.current) / 1000 : 0.1;
            ekfRef.current.predict(dt);
            const filteredSpeed = ekfRef.current.update([gpsSpeed, accelMagnitude]);
            
            setFusedSpeed(filteredSpeed);
            onSpeedUpdate(filteredSpeed);
            onDataPointAdded({ time: elapsedTime, speed: filteredSpeed });
          } else {
            setFusedSpeed(gpsSpeed);
            onSpeedUpdate(gpsSpeed);
            onDataPointAdded({ time: elapsedTime, speed: gpsSpeed });
          }
          
          lastTimestampRef.current = timestamp;
        }
        
        setGpsStatus(`GPS: ±${pos.coords.accuracy?.toFixed(1)}m`);
      },
      (err) => {
        console.error('GPS error:', err);
        setGpsStatus('GPS Error');
        toast({
          title: "GPS Error",
          description: "Failed to get GPS data. Please check permissions.",
          variant: "destructive",
        });
      },
      { 
        enableHighAccuracy: true, 
        maximumAge: 0, 
        timeout: 5000 
      }
    );
  }, [isRunning, onSpeedUpdate, onDataPointAdded, sensorData]);

  // Enhanced IMU sensor initialization
  const initializeSensors = useCallback(async () => {
    try {
      console.log('🚀 Initializing enhanced motion sensors...');
      
      // Try Capacitor Motion for native mobile support
      try {
        Motion.addListener('accel', (event) => {
          const { x, y, z } = event.acceleration;
          const magnitude = Math.sqrt(x * x + y * y + z * z);
          
          // Continuous calibration during stationary periods
          if (magnitude > 8.5 && magnitude < 10.5) {
            calibrationSamplesRef.current.push(magnitude);
            if (calibrationSamplesRef.current.length > 100) {
              calibrationSamplesRef.current.shift();
            }
            calibrateBaseline();
          }
          
          // Update sensor data
          setSensorData(prev => ({
            speed: fusedSpeed,
            acceleration: { x, y, z },
            rotationRate: prev?.rotationRate || { alpha: 0, beta: 0, gamma: 0 },
            timestamp: Date.now(),
          }));
          
          // Detect acceleration events
          if (waitingForAccelerationRef.current) {
            const netAcceleration = Math.abs(magnitude - baselineAccelRef.current);
            if (netAcceleration > accelerationThreshold) {
              console.log('🏃 Enhanced acceleration detected:', netAcceleration.toFixed(3), 'm/s²');
              onAccelerationDetected();
            }
          }
        });
        
        console.log('✅ Capacitor Motion sensors initialized');
      } catch (capacitorError) {
        console.log('📱 Capacitor Motion not available, falling back to browser APIs');
        
        // Fallback to browser DeviceMotionEvent
        const handleDeviceMotion = (event: DeviceMotionEvent) => {
          if (!event.accelerationIncludingGravity) return;
          
          const { x = 0, y = 0, z = 0 } = event.accelerationIncludingGravity;
          const magnitude = Math.sqrt(x * x + y * y + z * z);
          
          // Continuous calibration
          if (magnitude > 8.5 && magnitude < 10.5) {
            calibrationSamplesRef.current.push(magnitude);
            if (calibrationSamplesRef.current.length > 100) {
              calibrationSamplesRef.current.shift();
            }
            calibrateBaseline();
          }
          
          // Update sensor data with rotation rate
          setSensorData({
            speed: fusedSpeed,
            acceleration: { x, y, z },
            rotationRate: event.rotationRate || { alpha: 0, beta: 0, gamma: 0 },
            timestamp: Date.now(),
          });
          
          // Detect acceleration events
          if (waitingForAccelerationRef.current) {
            const netAcceleration = Math.abs(magnitude - baselineAccelRef.current);
            if (netAcceleration > accelerationThreshold) {
              console.log('🏃 Enhanced acceleration detected (browser):', netAcceleration.toFixed(3), 'm/s²');
              onAccelerationDetected();
            }
          }
        };
        
        window.addEventListener('devicemotion', handleDeviceMotion);
        console.log('✅ Browser DeviceMotion sensors initialized');
      }
      
    } catch (error) {
      console.error('❌ Enhanced sensor initialization failed:', error);
      toast({
        title: "Sensor Error",
        description: "Failed to initialize motion sensors. Some features may not work.",
        variant: "destructive",
      });
    }
  }, [accelerationThreshold, onAccelerationDetected, calibrateBaseline, fusedSpeed]);

  // Start tracking
  const startTracking = useCallback(() => {
    startTimeRef.current = Date.now();
    lastTimestampRef.current = null;
    initializeGPS();
    console.log('🎬 Enhanced sensor fusion tracking started');
  }, [initializeGPS]);

  // Stop tracking
  const stopTracking = useCallback(() => {
    if (geoWatchRef.current) {
      navigator.geolocation.clearWatch(geoWatchRef.current);
      geoWatchRef.current = null;
    }
    console.log('⏹️ Enhanced sensor fusion tracking stopped');
  }, []);

  // Reset tracking
  const resetTracking = useCallback(() => {
    stopTracking();
    setSensorData(null);
    setFusedSpeed(0);
    startTimeRef.current = null;
    lastTimestampRef.current = null;
    ekfRef.current?.reset();
    console.log('🔄 Enhanced sensor fusion reset');
  }, [stopTracking]);

  // Update Kalman filter
  const updateKalmanFilter = useCallback((speedKmh: number, accelMagnitude: number, dt: number): number => {
    if (!ekfRef.current) return speedKmh;
    
    ekfRef.current.predict(dt);
    return ekfRef.current.update([speedKmh, accelMagnitude]);
  }, []);

  // Get current accelerometer data
  const getAccelerometerData = useCallback(() => {
    return sensorData?.acceleration || { x: 0, y: 0, z: 0 };
  }, [sensorData]);

  // GPS permission request function
  const requestGPSPermission = useCallback(async (): Promise<boolean> => {
    try {
      console.log('🔐 Requesting GPS permission...');
      
      if (!navigator.geolocation) {
        toast({
          title: "GPS Not Supported",
          description: "Your device doesn't support GPS tracking.",
          variant: "destructive",
        });
        return false;
      }

      if (!window.isSecureContext) {
        toast({
          title: "Secure Connection Required",
          description: "GPS requires HTTPS connection for security.",
          variant: "destructive",
        });
        return false;
      }

      // Test GPS access with timeout
      const testPosition = await new Promise<GeolocationPosition>((resolve, reject) => {
        console.log('📍 Attempting to get current position with high precision...');
        navigator.geolocation.getCurrentPosition(
          resolve,
          reject,
          { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
      });

      console.log('✅ GPS permission granted, accuracy:', testPosition.coords.accuracy);
      setGpsStatus('GPS Ready');
      return true;
    } catch (error: any) {
      console.error('❌ GPS permission error:', error);
      
      if (error.code === 1) { // PERMISSION_DENIED
        toast({
          title: "GPS Permission Denied",
          description: "Please enable location access in your browser settings.",
          variant: "destructive",
        });
      } else if (error.code === 2) { // POSITION_UNAVAILABLE
        toast({
          title: "GPS Unavailable",
          description: "Unable to determine your location. Please check GPS settings.",
          variant: "destructive",
        });
      } else if (error.code === 3) { // TIMEOUT
        toast({
          title: "GPS Timeout",
          description: "Location request timed out. Please try again.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "GPS Error",
          description: "An unexpected error occurred while accessing GPS.",
          variant: "destructive",
        });
      }
      
      setGpsStatus('GPS Error');
      return false;
    }
  }, []);

  return {
    sensorData,
    fusedSpeed,
    gpsStatus,
    requestGPSPermission,
    initializeSensors,
    initializeKalmanFilter,
    startTracking,
    stopTracking,
    resetTracking,
    updateKalmanFilter,
    getAccelerometerData
  };
};