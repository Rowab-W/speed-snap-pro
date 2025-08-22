import { useState, useRef, useCallback } from 'react';
import { toast } from '@/hooks/use-toast';
import { SavitzkyGolayFilter, OutlierDetector } from '../utils/DataProcessing';

// Calculate distance between two GPS coordinates (Haversine formula)
const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371000; // Earth's radius in meters
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
};

interface DataPoint {
  time: number;
  speed: number;
}

interface UseGPSTrackingProps {
  isRunning: boolean;
  startTime: number | null;
  updateKalmanFilter: (speedKmh: number, accelMagnitude: number, dt: number) => number;
  getAccelerometerData: () => { x: number; y: number; z: number };
  onSpeedUpdate: (speed: number) => void;
  onDataPointAdded: (dataPoint: DataPoint) => void;
  onDistanceUpdate: (distance: number) => void;
  onGpsAccuracyUpdate?: (accuracy: number) => void;
}

export const useGPSTracking = ({
  isRunning,
  startTime,
  updateKalmanFilter,
  getAccelerometerData,
  onSpeedUpdate,
  onDataPointAdded,
  onDistanceUpdate,
  onGpsAccuracyUpdate
}: UseGPSTrackingProps) => {
  const [gpsStatus, setGpsStatus] = useState<string>('Requesting permissions...');
  const watchIdRef = useRef<number | null>(null);
  const lastTimestampRef = useRef<number | null>(null);
  const lastPositionRef = useRef<{ latitude: number; longitude: number } | null>(null);
  const dataPointsRef = useRef<DataPoint[]>([]);
  
  // Data processing filters with enhanced parameters for precision
  const savitzkyGolay = useRef(new SavitzkyGolayFilter());
  const outlierDetector = useRef(new OutlierDetector(2.5)); // Stricter outlier detection

  const requestGPSPermission = useCallback(async (): Promise<boolean> => {
    try {
      console.log('🔐 Requesting GPS permission...');
      
      if (!navigator.geolocation) {
        console.error('❌ Geolocation not supported in this browser');
        setGpsStatus('Geolocation not supported in this browser');
        toast({
          title: "GPS Error",
          description: "Your browser doesn't support GPS location",
          variant: "destructive",
        });
        return false;
      }

      // Check if we're in a secure context (HTTPS)
      if (!window.isSecureContext && location.hostname !== 'localhost') {
        console.error('❌ GPS requires HTTPS connection');
        setGpsStatus('GPS requires secure connection (HTTPS)');
        toast({
          title: "GPS Error", 
          description: "GPS requires a secure HTTPS connection",
          variant: "destructive",
        });
        return false;
      }

      // Enhanced GPS permission request with Dragy-like precision settings
      console.log('📍 Attempting to get current position with high precision...');
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 20000, // Longer timeout for better accuracy
          maximumAge: 0    // Force fresh reading
        });
      });

      console.log('✅ GPS permission granted, initial position:', position);
      setGpsStatus(`GPS ready (accuracy: ${position.coords.accuracy?.toFixed(0)}m)`);
      
      // Show placement guide for optimal performance
      toast({
        title: "GPS Ready!",
        description: "For best results: Place phone on dashboard, sky-facing, and away from metal",
      });
      
      return true;
    } catch (error: any) {
      console.error('❌ GPS permission error:', error);
      let errorMessage = 'GPS permission denied or unavailable';
      let toastMessage = "Please allow location access to use SpeedSnap";
      
      if (error.code === 1) {
        errorMessage = 'GPS permission denied by user';
        toastMessage = "Location access was denied. Please enable it in your browser settings.";
      } else if (error.code === 2) {
        errorMessage = 'GPS position unavailable';
        toastMessage = "GPS position unavailable. Please ensure GPS is enabled and you're outdoors.";
      } else if (error.code === 3) {
        errorMessage = 'GPS request timeout';
        toastMessage = "GPS request timed out. Please try again outdoors with clear sky view.";
      }
      
      setGpsStatus(errorMessage);
      toast({
        title: "GPS Error",
        description: toastMessage,
        variant: "destructive",
      });
      return false;
    }
  }, []);

  const handlePosition = useCallback((position: GeolocationPosition) => {
    console.log('📍 GPS position received. Running:', isRunning, 'StartTime:', startTime);
    
    // Dragy-like precision: Only accept high accuracy readings (under 20m outdoors, 10m for racing)
    const accuracy = position.coords.accuracy;
    const isRacing = isRunning; // More strict during measurement
    const maxAccuracy = isRacing ? 10 : 20;
    
    if (accuracy && accuracy > maxAccuracy) {
      console.log('⚠️ GPS reading rejected - poor accuracy:', accuracy, 'm (max:', maxAccuracy, 'm)');
      setGpsStatus(`Poor GPS signal (${accuracy.toFixed(0)}m) - Move to open area`);
      return;
    }
    
    console.log('✅ GPS reading accepted - accuracy:', accuracy, 'm');
    setGpsStatus(`GPS tracking (±${accuracy?.toFixed(0)}m)`);

    // Report GPS accuracy for real-time feedback
    if (onGpsAccuracyUpdate && position.coords.accuracy) {
      onGpsAccuracyUpdate(position.coords.accuracy);
    }

    const timestamp = position.timestamp;
    const elapsed = startTime ? (performance.now() - startTime) / 1000 : 0;
    
    // Dragy-style speed calculation with enhanced precision
    let speedMs = 0;
    
    // Primary: Use high-precision position-based calculation
    if (lastTimestampRef.current && position.coords.latitude && position.coords.longitude) {
      const prevPos = lastPositionRef.current;
      if (prevPos) {
        const distance = calculateDistance(
          prevPos.latitude, prevPos.longitude,
          position.coords.latitude, position.coords.longitude
        );
        const dt = (timestamp - lastTimestampRef.current) / 1000;
        
        // Enhanced time window validation for 10Hz+ sampling
        if (dt >= 0.05 && dt <= 2.0) { // 50ms to 2s window
          const calculatedSpeed = distance / dt;
          console.log('📏 Position-based speed:', calculatedSpeed.toFixed(3), 'm/s', 'distance:', distance.toFixed(3), 'dt:', dt.toFixed(3));
          speedMs = calculatedSpeed;
        }
      }
    }
    
    // Secondary: GPS velocity as backup/validation
    if (position.coords.speed !== null && position.coords.speed >= 0) {
      const gpsSpeed = position.coords.speed;
      console.log('🛰️ GPS velocity:', gpsSpeed.toFixed(3), 'm/s');
      
      // Use GPS speed if calculation failed or for validation
      if (speedMs === 0) {
        speedMs = gpsSpeed;
        console.log('Using GPS velocity as primary');
      } else {
        // Validate calculated speed against GPS speed
        const speedDiff = Math.abs(speedMs - gpsSpeed);
        const avgSpeed = (speedMs + gpsSpeed) / 2;
        const diffPercent = avgSpeed > 0 ? (speedDiff / avgSpeed) * 100 : 0;
        
        // If speeds differ significantly, use the more conservative value
        if (diffPercent > 25 && avgSpeed > 2.78) { // 25% difference at >10 km/h
          console.log('⚠️ Speed validation failed - using conservative estimate');
          speedMs = Math.min(speedMs, gpsSpeed);
        }
      }
    }
    
    // Store position for next calculation
    lastPositionRef.current = {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude
    };
    
    const speedKmh = speedMs * 3.6; // Convert m/s to km/h
    
    // Enhanced outlier detection and filtering
    const recentPoints = dataPointsRef.current.slice(-15); // Larger window for better filtering
    recentPoints.push({ time: elapsed, speed: speedKmh });
    
    const outliers = outlierDetector.current.detectOutliers(recentPoints);
    const isCurrentOutlier = outliers[outliers.length - 1];
    
    let displaySpeed = speedKmh;
    if (isCurrentOutlier && recentPoints.length >= 5) {
      console.log('🚫 Outlier detected:', speedKmh.toFixed(2), 'km/h - applying filter');
      // Use Savitzky-Golay filter for smooth but responsive filtering
      const filteredPoints = savitzkyGolay.current.filter(recentPoints.slice(-7));
      if (filteredPoints.length > 0) {
        displaySpeed = filteredPoints[filteredPoints.length - 1].speed;
      }
    }
    
    // Sensor fusion with IMU data using Kalman filter
    const { x, y, z } = getAccelerometerData();
    const accelMagnitude = Math.sqrt(x * x + y * y + z * z);
    const dt = lastTimestampRef.current ? (timestamp - lastTimestampRef.current) / 1000 : 0.1;
    
    // Calculate distance increment for running measurements
    if (isRunning && startTime && lastTimestampRef.current) {
      const dtDistance = (timestamp - lastTimestampRef.current) / 1000;
      const distanceIncrement = speedMs * dtDistance;
      onDistanceUpdate(distanceIncrement);
    }
    
    lastTimestampRef.current = timestamp;
    
    // Apply Kalman filter for sensor fusion (GPS + IMU)
    const fusedSpeed = updateKalmanFilter(
      isCurrentOutlier ? displaySpeed : speedKmh, 
      accelMagnitude, 
      dt
    );

    // Ensure non-negative speed
    const finalSpeed = Math.max(0, fusedSpeed);
    
    console.log('🔬 Speed processing:', {
      rawGPS: speedKmh.toFixed(2),
      filtered: displaySpeed.toFixed(2),
      fused: finalSpeed.toFixed(2),
      outlier: isCurrentOutlier,
      accuracy: accuracy?.toFixed(1),
      dt: dt.toFixed(3)
    });
    
    // Always update speed for real-time display
    onSpeedUpdate(finalSpeed);
    
    // Store data point only during active measurement
    if (isRunning && startTime) {
      const dataPoint = { time: elapsed, speed: finalSpeed };
      dataPointsRef.current.push(dataPoint);
      onDataPointAdded(dataPoint);
      console.log('💾 Data point stored:', dataPoint);
    }
  }, [isRunning, startTime, updateKalmanFilter, getAccelerometerData, onSpeedUpdate, onDataPointAdded, onDistanceUpdate, onGpsAccuracyUpdate]);

  const startGPSTracking = useCallback((options?: PositionOptions) => {
    // Dragy-like high-frequency GPS settings for maximum precision
    const dragLikeOptions = {
      enableHighAccuracy: true,
      maximumAge: 50,        // 50ms for 20Hz theoretical max
      timeout: 15000,        // Longer timeout for better signal acquisition
      ...options
    };

    console.log('🎯 Starting Dragy-style GPS tracking:', dragLikeOptions);
    
    if (navigator.geolocation) {
      watchIdRef.current = navigator.geolocation.watchPosition(
        handlePosition,
        (error) => {
          console.error('❌ GPS tracking error:', error);
          let errorMsg = `GPS error: ${error.message}`;
          
          if (error.code === 2) {
            errorMsg = 'GPS unavailable - Move to open area with clear sky view';
          } else if (error.code === 3) {
            errorMsg = 'GPS timeout - Check signal strength';
          }
          
          setGpsStatus(errorMsg);
          toast({
            title: "GPS Error",
            description: errorMsg,
            variant: "destructive",
          });
        },
        dragLikeOptions
      );
      
      console.log('✅ High-frequency GPS tracking started with ID:', watchIdRef.current);
      setGpsStatus('GPS tracking started - Acquiring signal...');
    } else {
      console.error('❌ Geolocation not supported');
      setGpsStatus('Geolocation not supported');
    }
  }, [handlePosition]);

  const stopGPSTracking = useCallback(() => {
    if (watchIdRef.current) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
      console.log('🛑 GPS tracking stopped');
    }
  }, []);

  const resetGPSTracking = useCallback(() => {
    stopGPSTracking();
    lastTimestampRef.current = null;
    lastPositionRef.current = null;
    dataPointsRef.current = [];
    setGpsStatus('Ready to measure');
    console.log('🔄 GPS tracking reset');
  }, [stopGPSTracking]);

  return {
    gpsStatus,
    requestGPSPermission,
    startGPSTracking,
    stopGPSTracking,
    resetGPSTracking,
    setGpsStatus
  };
};