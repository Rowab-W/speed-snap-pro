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
}

export const useGPSTracking = ({
  isRunning,
  startTime,
  updateKalmanFilter,
  getAccelerometerData,
  onSpeedUpdate,
  onDataPointAdded,
  onDistanceUpdate
}: UseGPSTrackingProps) => {
  const [gpsStatus, setGpsStatus] = useState<string>('Requesting permissions...');
  const watchIdRef = useRef<number | null>(null);
  const lastTimestampRef = useRef<number | null>(null);
  const lastPositionRef = useRef<{ latitude: number; longitude: number } | null>(null);
  const dataPointsRef = useRef<DataPoint[]>([]);
  
  // Data processing filters
  const savitzkyGolay = useRef(new SavitzkyGolayFilter());
  const outlierDetector = useRef(new OutlierDetector(3.0));

  const requestGPSPermission = useCallback(async () => {
    try {
      await new Promise<void>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
          () => {
            setGpsStatus('GPS permission granted');
            resolve();
          },
          (error) => {
            setGpsStatus(`GPS error: ${error.message}`);
            reject(error);
          },
          { enableHighAccuracy: true }
        );
      });
      return true;
    } catch (error) {
      setGpsStatus('Error accessing GPS. Please allow location access.');
      toast({
        title: "GPS Error",
        description: "Please allow location access to use SpeedSnap",
        variant: "destructive",
      });
      return false;
    }
  }, []);

  const handlePosition = useCallback((position: GeolocationPosition) => {
    if (!isRunning || !startTime) {
      console.log('GPS position ignored - not running or no start time');
      return;
    }

    // Filter out readings with poor accuracy (>10m)
    const accuracy = position.coords.accuracy;
    if (accuracy > 10) {
      console.log('GPS reading rejected - poor accuracy:', accuracy, 'm');
      return;
    }

    console.log('GPS Position:', {
      speed: position.coords.speed,
      accuracy: accuracy,
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      timestamp: position.timestamp
    });

    const timestamp = position.timestamp;
    const elapsed = (performance.now() - startTime) / 1000;
    
    // Get speed from GPS or calculate from position change
    let speedMs = 0;
    
    // Always try to calculate speed from position changes for walking speeds
    if (lastTimestampRef.current && position.coords.latitude && position.coords.longitude) {
      const prevPos = lastPositionRef.current;
      if (prevPos) {
        const distance = calculateDistance(
          prevPos.latitude, prevPos.longitude,
          position.coords.latitude, position.coords.longitude
        );
        const dt = (timestamp - lastTimestampRef.current) / 1000;
        if (dt > 0.5 && dt < 10) { // Only use if reasonable time difference
          const calculatedSpeed = distance / dt;
          console.log('Position-based speed:', calculatedSpeed, 'm/s', 'distance:', distance.toFixed(2), 'dt:', dt.toFixed(2));
          speedMs = calculatedSpeed;
        }
      }
    }
    
    // Use GPS speed as fallback or if it's higher (for vehicles)
    if (position.coords.speed !== null && position.coords.speed >= 0) {
      const gpsSpeed = position.coords.speed;
      console.log('GPS speed:', gpsSpeed, 'm/s');
      
      // Use GPS speed if it's significantly higher or if position calculation failed
      if (gpsSpeed > speedMs * 1.5 || speedMs === 0) {
        speedMs = gpsSpeed;
        console.log('Using GPS speed');
      } else {
        console.log('Using calculated speed');
      }
    }
    
    // Store current position for next calculation
    lastPositionRef.current = {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude
    };
    
    const speedKmh = speedMs * 3.6; // Convert m/s to km/h
    
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
    
    // Calculate distance
    if (lastTimestampRef.current) {
      const dtDistance = (timestamp - lastTimestampRef.current) / 1000;
      onDistanceUpdate(speedMs * dtDistance);
    }
    lastTimestampRef.current = timestamp;
    
    const fusedSpeed = updateKalmanFilter(isCurrentOutlier ? 0 : speedKmh, accelMagnitude, dt);

    console.log('Speed processing:', {
      rawSpeedKmh: speedKmh.toFixed(2),
      fusedSpeed: fusedSpeed.toFixed(2),
      isOutlier: isCurrentOutlier,
      accelMagnitude: accelMagnitude.toFixed(3),
      dt: dt.toFixed(3),
      elapsed: elapsed.toFixed(2)
    });

    // Ensure we don't lose speed due to filtering issues
    const finalSpeed = Math.max(0, fusedSpeed);
    
    // Use the fused speed for display and milestone checking
    onSpeedUpdate(finalSpeed);
    
    // Store data point
    const dataPoint = { time: elapsed, speed: finalSpeed };
    dataPointsRef.current.push(dataPoint);
    onDataPointAdded(dataPoint);
  }, [isRunning, startTime, updateKalmanFilter, getAccelerometerData, onSpeedUpdate, onDataPointAdded, onDistanceUpdate]);

  const startGPSTracking = useCallback((options?: PositionOptions) => {
    const defaultOptions = {
      enableHighAccuracy: true,
      maximumAge: 0,
      timeout: 10000,
    };

    if (navigator.geolocation) {
      watchIdRef.current = navigator.geolocation.watchPosition(
        handlePosition,
        (error) => {
          setGpsStatus(`GPS error: ${error.message}`);
          toast({
            title: "GPS Error",
            description: error.message,
            variant: "destructive",
          });
        },
        { ...defaultOptions, ...options }
      );
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