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
  
  // Data processing filters
  const savitzkyGolay = useRef(new SavitzkyGolayFilter());
  const outlierDetector = useRef(new OutlierDetector(3.0));

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

      // Request permission by attempting to get current position
      console.log('📍 Attempting to get current position...');
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 30000
        });
      });

      console.log('✅ GPS permission granted, initial position:', position);
      setGpsStatus(`GPS ready (accuracy: ${position.coords.accuracy?.toFixed(0)}m)`);
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
        toastMessage = "GPS position unavailable. Please ensure GPS is enabled.";
      } else if (error.code === 3) {
        errorMessage = 'GPS request timeout';
        toastMessage = "GPS request timed out. Please try again.";
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
    
    // Filter out readings with poor accuracy (>15m)
    const accuracy = position.coords.accuracy;
    if (accuracy && accuracy > 15) {
      console.log('GPS reading rejected - poor accuracy:', accuracy, 'm');
      return;
    }

    // Report GPS accuracy if callback provided
    if (onGpsAccuracyUpdate && position.coords.accuracy) {
      onGpsAccuracyUpdate(position.coords.accuracy);
    }

    // Process GPS data for speed calculation regardless of running state
    // This allows speed detection during waiting phase to trigger measurement start

    console.log('GPS Position:', {
      speed: position.coords.speed,
      accuracy: accuracy,
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      timestamp: position.timestamp
    });

    const timestamp = position.timestamp;
    const elapsed = startTime ? (performance.now() - startTime) / 1000 : 0;
    
    // Get speed from GPS or calculate from position change
    let speedMs = 0;
    
    // Prioritize GPS speed when available and reasonable
    if (position.coords.speed !== null && position.coords.speed >= 0) {
      speedMs = position.coords.speed;
      console.log('Using GPS speed:', speedMs, 'm/s');
    } else {
      // Only calculate from position if GPS speed is unavailable and conditions are right
      if (lastTimestampRef.current && position.coords.latitude && position.coords.longitude) {
        const prevPos = lastPositionRef.current;
        if (prevPos) {
          const distance = calculateDistance(
            prevPos.latitude, prevPos.longitude,
            position.coords.latitude, position.coords.longitude
          );
          const dt = (timestamp - lastTimestampRef.current) / 1000;
          
          // Very conservative position-based calculation with strict bounds
          if (dt > 0.5 && dt < 5 && distance < 100) { // Max 100m distance between readings
            const calculatedSpeed = distance / dt;
            console.log('Position-based speed:', calculatedSpeed, 'm/s', 'distance:', distance.toFixed(2), 'dt:', dt.toFixed(2));
            
            // Apply sanity check - reject unrealistic speeds
            if (calculatedSpeed < 100) { // Max 360 km/h seems reasonable for any vehicle
              speedMs = calculatedSpeed;
            } else {
              console.log('Position-based speed rejected as unrealistic:', calculatedSpeed, 'm/s');
              speedMs = 0;
            }
          }
        }
      }
    }
    
    // Store current position for next calculation
    lastPositionRef.current = {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude
    };
    
    let speedKmh = speedMs * 3.6; // Convert m/s to km/h
    
    // Apply realistic speed bounds - reject obviously wrong readings
    if (speedKmh > 400) { // Max realistic speed for any vehicle
      console.log('Speed rejected as unrealistic:', speedKmh, 'km/h');
      speedKmh = 0;
    } else if (speedKmh < 5) {
      // Apply low-pass filter for walking speeds - set to 0 if below 5 km/h to filter GPS noise
      speedKmh = 0;
      console.log('Speed filtered out as noise (< 5 km/h)');
    }
    
    // Apply real-time outlier detection (but still store the point)
    const recentPoints = dataPointsRef.current.slice(-10); // Last 10 points for context
    recentPoints.push({ time: elapsed, speed: speedKmh });
    
    const outliers = outlierDetector.current.detectOutliers(recentPoints);
    const isCurrentOutlier = outliers[outliers.length - 1];
    
    let displaySpeed = speedKmh;
    if (isCurrentOutlier) {
      console.log('Outlier detected:', speedKmh, 'km/h - using filtered value');
      // Don't reject completely, but apply light smoothing
      const filteredPoints = savitzkyGolay.current.filter(recentPoints.slice(-5));
      displaySpeed = filteredPoints.length > 0 ? filteredPoints[filteredPoints.length - 1].speed : speedKmh;
      displaySpeed = Math.max(0, displaySpeed); // Ensure non-negative
    }
    
    // Apply Kalman filter with accelerometer data BEFORE updating lastTimestamp
    const { x, y, z } = getAccelerometerData();
    const accelMagnitude = Math.sqrt(x * x + y * y + z * z);
    const dt = lastTimestampRef.current ? (timestamp - lastTimestampRef.current) / 1000 : 0.1;
    
    // Calculate distance only if we're actually running
    if (isRunning && startTime && lastTimestampRef.current) {
      const dtDistance = (timestamp - lastTimestampRef.current) / 1000;
      onDistanceUpdate(speedMs * dtDistance);
    }
    lastTimestampRef.current = timestamp;
    
    // Use lighter Kalman filtering to avoid amplification - prefer raw GPS when reasonable
    let finalSpeed = speedKmh;
    
    // Only apply Kalman filter if speed seems reasonable and we have good accelerometer data
    if (speedKmh > 0 && speedKmh < 300 && !isCurrentOutlier) {
      const fusedSpeed = updateKalmanFilter(speedKmh, Math.min(accelMagnitude, 20), dt);
      
      // Use Kalman result only if it's close to GPS reading (prevent amplification)
      if (Math.abs(fusedSpeed - speedKmh) < speedKmh * 0.3) { // Max 30% difference
        finalSpeed = fusedSpeed;
      }
    }

    console.log('Speed processing:', {
      rawSpeedKmh: speedKmh.toFixed(2),
      finalSpeed: finalSpeed.toFixed(2),
      isOutlier: isCurrentOutlier,
      accelMagnitude: accelMagnitude.toFixed(3),
      dt: dt.toFixed(3),
      elapsed: elapsed.toFixed(2)
    });

    // Ensure non-negative speed and apply final bounds check
    finalSpeed = Math.max(0, Math.min(finalSpeed, 350)); // Cap at 350 km/h
    
    // Always update speed for acceleration detection, even during waiting
    onSpeedUpdate(finalSpeed);
    
    // Store data point only if we're actively running
    if (isRunning && startTime) {
      const dataPoint = { time: elapsed, speed: finalSpeed };
      dataPointsRef.current.push(dataPoint);
      onDataPointAdded(dataPoint);
    }
  }, [isRunning, startTime, updateKalmanFilter, getAccelerometerData, onSpeedUpdate, onDataPointAdded, onDistanceUpdate]);

  const startGPSTracking = useCallback((options?: PositionOptions) => {
    const defaultOptions = {
      enableHighAccuracy: true,
      maximumAge: 0,
      timeout: 10000,
    };

    console.log('🎯 Starting GPS tracking with options:', { ...defaultOptions, ...options });
    
    if (navigator.geolocation) {
      watchIdRef.current = navigator.geolocation.watchPosition(
        handlePosition,
        (error) => {
          console.error('❌ GPS tracking error:', error);
          setGpsStatus(`GPS error: ${error.message}`);
          toast({
            title: "GPS Error",
            description: error.message,
            variant: "destructive",
          });
        },
        { ...defaultOptions, ...options }
      );
      console.log('✅ GPS watch started with ID:', watchIdRef.current);
    } else {
      console.error('❌ Geolocation not supported');
      setGpsStatus('Geolocation not supported');
    }
  }, [handlePosition]);

  const stopGPSTracking = useCallback(() => {
    if (watchIdRef.current) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
  }, []);

  const resetGPSTracking = useCallback(() => {
    stopGPSTracking();
    lastTimestampRef.current = null;
    lastPositionRef.current = null;
    dataPointsRef.current = [];
    setGpsStatus('Ready to measure');
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