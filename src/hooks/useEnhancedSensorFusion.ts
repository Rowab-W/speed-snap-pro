import { useEffect, useState, useRef, useCallback } from 'react';
import { ExtendedKalmanFilter } from '../utils/ExtendedKalmanFilter';
import { LaunchDetector } from '../utils/LaunchDetector';
import { IMUFilters } from '../utils/ButterworthFilter';
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

  // Refs for sensor fusion state
  const ekfRef = useRef<ExtendedKalmanFilter | null>(null);
  const geoWatchRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const lastTimestampRef = useRef<number | null>(null);
  const baselineAccelRef = useRef<number>(9.81);
  const calibrationSamplesRef = useRef<number[]>([]);
  const waitingForAccelerationRef = useRef<boolean>(false);
  const launchDetectorRef = useRef<LaunchDetector | null>(null);
  
  // Grok's simplified sensor fusion state
  const prevTimestampRef = useRef<number>(0);
  const imuVelocityRef = useRef<number>(0); // Integrated from accel (m/s)
  const kalmanGainRef = useRef<number>(0.3); // Tune: higher trusts IMU more
  const lastGpsSpeedRef = useRef<number>(0);
  const fusedSpeedRef = useRef<number>(0);

  useEffect(() => {
    waitingForAccelerationRef.current = waitingForAcceleration;
  }, [waitingForAcceleration]);

  // Initialize Kalman Filter and Launch Detector
  const initializeKalmanFilter = useCallback(() => {
    ekfRef.current = new ExtendedKalmanFilter();
    launchDetectorRef.current = new LaunchDetector({
      horizontalAccelThreshold: accelerationThreshold,
      speedThreshold: 3.0, // km/h
      sustainedDurationMs: 300,
      enableFiltering: true
    });
    console.log('🔬 Enhanced Kalman Filter and Launch Detector initialized');
  }, [accelerationThreshold]);

  // Grok's simplified sensor fusion implementation
  const fuseData = useCallback((gpsSpeedMs: number, imuAccelMs2: number, deltaTime: number) => {
    // Convert GPS speed from m/s to internal calculation (keep as m/s for precision)
    const gpsSpeed = gpsSpeedMs;
    
    // Integrate IMU acceleration to velocity (after gravity removal and filtering)
    // Simplified assumption: use horizontal acceleration magnitude
    imuVelocityRef.current += imuAccelMs2 * deltaTime;
    
    // Apply Kalman-style fusion
    const predictionError = gpsSpeed - imuVelocityRef.current;
    const newFusedSpeed = imuVelocityRef.current + kalmanGainRef.current * predictionError;
    
    console.log('Fusion:', { 
      gpsSpeed: gpsSpeed.toFixed(2), 
      imuVelocity: imuVelocityRef.current.toFixed(2), 
      predictionError: predictionError.toFixed(2), 
      newFusedSpeed: newFusedSpeed.toFixed(2),
      kalmanGain: kalmanGainRef.current 
    });
    
    // Correct IMU drift by updating velocity estimate
    imuVelocityRef.current = newFusedSpeed;
    fusedSpeedRef.current = newFusedSpeed;
    
    // Convert back to km/h for display and set state
    const fusedSpeedKmh = Math.max(0, newFusedSpeed * 3.6);
    setFusedSpeed(fusedSpeedKmh);
    
    console.log('🔗 Sensor fusion:', {
      gpsKmh: (gpsSpeed * 3.6).toFixed(1),
      imuMs: imuVelocityRef.current.toFixed(2),
      fusedKmh: fusedSpeedKmh.toFixed(1),
      gain: kalmanGainRef.current,
      deltaT: deltaTime.toFixed(3)
    });
    
    return fusedSpeedKmh;
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
    
    const gpsOptions = {
      enableHighAccuracy: true,
      maximumAge: 0,
      timeout: 5000
    };

    const handleGpsSuccess = (position: GeolocationPosition) => {
      const gpsSpeedMs = position.coords.speed || 0; // m/s
      const gpsSpeedKmh = gpsSpeedMs * 3.6; // Convert to km/h
      const accuracy = position.coords.accuracy || 0;
      
      console.log('GPS Update:', { 
        speedMs: gpsSpeedMs, 
        speedKmh: gpsSpeedKmh.toFixed(1),
        accuracy: accuracy, 
        timestamp: position.timestamp 
      });
      
      // Ignore GPS readings with poor accuracy (> 10 meters)
      if (accuracy > 10) {
        console.warn('GPS accuracy too low:', accuracy, 'meters - ignoring reading');
        return;
      }
      
      lastGpsSpeedRef.current = gpsSpeedMs;
      
      // GPS-ONLY MODE: Use GPS speed directly without fusion
      setFusedSpeed(gpsSpeedKmh);
      fusedSpeedRef.current = gpsSpeedMs;
      
      // Update sensor data with GPS speed
      setSensorData(prev => ({
        speed: gpsSpeedKmh,
        acceleration: prev?.acceleration || { x: 0, y: 0, z: 0 },
        rotationRate: prev?.rotationRate || { alpha: 0, beta: 0, gamma: 0 },
        timestamp: position.timestamp,
      }));
      
      // Call speed update callback
      if (onSpeedUpdate) {
        onSpeedUpdate(gpsSpeedKmh);
      }
      
      // Add data point for chart
      if (onDataPointAdded && startTimeRef.current) {
        const elapsedTime = (position.timestamp - startTimeRef.current) / 1000;
        onDataPointAdded({ time: elapsedTime, speed: gpsSpeedKmh });
      }
      
      console.log('📍 GPS-ONLY speed update:', gpsSpeedKmh.toFixed(1), 'km/h');
      setGpsStatus('✅ GPS Ready');
    };

    const handleGpsError = (error: GeolocationPositionError) => {
      console.error('GPS Error:', error.message);
      
      // Provide user feedback for specific error types
      if (error.code === 3) { // TIMEOUT
        console.warn('GPS timeout - Move outdoors for better GPS signal');
        toast({
          title: "GPS Timeout",
          description: "Move outdoors for better GPS signal",
          variant: "destructive",
        });
      } else if (error.code === 2) { // POSITION_UNAVAILABLE
        console.warn('GPS position unavailable - Move outdoors for better GPS signal');
        toast({
          title: "GPS Unavailable", 
          description: "Move outdoors for better GPS signal",
          variant: "destructive",
        });
      } else if (error.code === 1) { // PERMISSION_DENIED
        console.error('GPS permission denied - Please enable location services');
        toast({
          title: "GPS Permission Denied",
          description: "Please enable location services",
          variant: "destructive",
        });
      }
      setGpsStatus('❌ No GPS');
    };

    geoWatchRef.current = navigator.geolocation.watchPosition(
      handleGpsSuccess,
      handleGpsError,
      gpsOptions
    );
  }, [isRunning, onSpeedUpdate, onDataPointAdded, sensorData]);

  // Enhanced IMU sensor initialization - DISABLED FOR TESTING
  const initializeSensors = useCallback(async () => {
    console.log('🚀 IMU sensors DISABLED - using GPS-only mode for testing');
    // IMU initialization disabled to test GPS-only speed measurement
  }, []);

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
    launchDetectorRef.current?.reset();
    IMUFilters.accelerationLowPass.reset();
    IMUFilters.accelerationHighPass.reset();
    IMUFilters.gyroscopeLowPass.reset();
    
    // Reset Grok's sensor fusion state
    prevTimestampRef.current = 0;
    imuVelocityRef.current = 0;
    fusedSpeedRef.current = 0;
    lastGpsSpeedRef.current = 0;
    
    console.log('🔄 Enhanced sensor fusion and filters reset');
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