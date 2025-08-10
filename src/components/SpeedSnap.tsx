import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Play, Square, RotateCcw, Download, Zap, TestTube } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useUnits } from '@/contexts/UnitsContext';
import SpeedChart from './SpeedChart';
import { CubicSpline } from '../utils/CubicSpline';
import { MultiPassInterpolator } from '../utils/DataProcessing';
import { useSensorFusion } from '../hooks/useSensorFusion';
import { useGPSTracking } from '../hooks/useGPSTracking';
import { MeasurementDisplay } from './MeasurementDisplay';
import { ResultsPanel } from './ResultsPanel';
import { PlacementGuide } from './PlacementGuide';
import { supabase } from '@/integrations/supabase/client';
import { soundNotifier } from '../utils/sounds';

interface TimingResults {
  '0-20': number | null;
  '0-30': number | null;
  '0-40': number | null;
  '0-60': number | null;
  '0-80': number | null;
  '0-100': number | null;
  '0-120': number | null;
  '0-130': number | null;
  '0-200': number | null;
  '0-250': number | null;
  quarterMile: number | null;
  halfMile: number | null;
}

interface DataPoint {
  time: number;
  speed: number;
}

const SpeedSnap: React.FC = () => {
  const { getTargets, getSpeedUnit } = useUnits();
  const targets = getTargets();
  const [isRunning, setIsRunning] = useState(false);
  const [startTriggered, setStartTriggered] = useState(false);
  const [isMeasuring, setIsMeasuring] = useState(false);
  const [waitingForAcceleration, setWaitingForAcceleration] = useState(false);
  const [speed, setSpeed] = useState(0);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [distance, setDistance] = useState(0);
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);
  const [times, setTimes] = useState<TimingResults>({
    '0-20': null,
    '0-30': null,
    '0-40': null,
    '0-60': null,
    '0-80': null,
    '0-100': null,
    '0-120': null,
    '0-130': null,
    '0-200': null,
    '0-250': null,
    quarterMile: null,
    halfMile: null,
  });
  const [dataPoints, setDataPoints] = useState<DataPoint[]>([]);
  const [hasResults, setHasResults] = useState(false);
  const [targetHit, setTargetHit] = useState(false);
  const [hitTargetLabel, setHitTargetLabel] = useState<string | null>(null);
  const [showPlacementGuide, setShowPlacementGuide] = useState(false);

  const startTimeRef = useRef<number | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const chartRef = useRef<any>(null);
  const multiPassInterpolator = useRef(new MultiPassInterpolator());

  // High-frequency timer for elapsed time display
  const updateTimer = useCallback(() => {
    if (startTimeRef.current && isMeasuring) {
      const elapsed = (performance.now() - startTimeRef.current) / 1000;
      setElapsedTime(elapsed);
    }
    
    if (isMeasuring) {
      animationFrameRef.current = requestAnimationFrame(updateTimer);
    }
  }, [isMeasuring]);

  // Start high-frequency timer when measurement begins
  useEffect(() => {
    if (isMeasuring && !animationFrameRef.current) {
      animationFrameRef.current = requestAnimationFrame(updateTimer);
    } else if (!isMeasuring && animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, [isMeasuring, updateTimer]);

  // Handle acceleration detection callback (Grok's logic implementation)
  const handleAccelerationDetected = useCallback(() => {
    if (startTriggered) {
      console.log('🚀 Acceleration > 0.3 m/s² detected AND START was pressed! Starting measurement...');
      setIsMeasuring(true);
      setWaitingForAcceleration(false);
      setIsRunning(true);
      
      startTimeRef.current = performance.now(); // Start timer immediately when acceleration detected
      console.log('🕐 Start time set:', startTimeRef.current);
      
      initializeKalmanFilter();
      resetGPSTracking();
      
      startGPSTracking({
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 10000,
      });
      
      console.log('📍 GPS tracking started with high accuracy');
    } else {
      console.log('🚫 Acceleration detected but START button not pressed - ignoring');
    }
  }, [startTriggered]);

  // Initialize sensor fusion hook
  const {
    initializeSensors,
    initializeKalmanFilter,
    updateKalmanFilter,
    getAccelerometerData,
    resetSensorFusion,
    waitingForAccelerationRef
  } = useSensorFusion({
    onAccelerationDetected: handleAccelerationDetected,
    waitingForAcceleration,
    accelerationThreshold: 0.3  // Dragy-like threshold for reliable detection
  });

  // Handle speed updates from GPS - show speed when GPS is active
  const handleSpeedUpdate = useCallback((newSpeed: number) => {
    console.log('🏃 Speed update received:', newSpeed.toFixed(2), 'km/h, isMeasuring:', isMeasuring, 'waitingForAcceleration:', waitingForAcceleration);
    
    // CRITICAL FIX: Always show speed when GPS is providing data (for real-time feedback)
    console.log('✅ Setting speed to:', newSpeed.toFixed(2), 'km/h');
    setSpeed(newSpeed);
    
    // If we're getting speed while waiting for acceleration, auto-trigger measurement
    if (waitingForAcceleration && newSpeed > 1 && startTriggered) {
      console.log('🚀 Speed detected while waiting for acceleration - auto-starting measurement');
      handleAccelerationDetected();
    }
  }, [isMeasuring, waitingForAcceleration, startTriggered, handleAccelerationDetected]);

  // Handle data point additions
  const handleDataPointAdded = useCallback((dataPoint: DataPoint) => {
    console.log('📊 Data point added:', dataPoint);
    setDataPoints(prev => [...prev, dataPoint]);
  }, []);

  // Handle distance updates
  const handleDistanceUpdate = useCallback((additionalDistance: number) => {
    setDistance(prev => prev + additionalDistance);
  }, []);

  // Handle GPS accuracy updates
  const handleGpsAccuracyUpdate = useCallback((accuracy: number) => {
    setGpsAccuracy(accuracy);
  }, []);

  // Initialize GPS tracking hook
  const {
    gpsStatus,
    requestGPSPermission,
    startGPSTracking,
    stopGPSTracking,
    resetGPSTracking,
    setGpsStatus
  } = useGPSTracking({
    isRunning,
    startTime: startTimeRef.current,
    updateKalmanFilter,
    getAccelerometerData,
    onSpeedUpdate: handleSpeedUpdate,
    onDataPointAdded: handleDataPointAdded,
    onDistanceUpdate: handleDistanceUpdate,
    onGpsAccuracyUpdate: handleGpsAccuracyUpdate
  });

  // Initialize sensors and permissions
  useEffect(() => {
    const initializeApp = async () => {
      // Request GPS permission first
      const gpsPermitted = await requestGPSPermission();
      if (!gpsPermitted) return;

      // Initialize sensor fusion
      const cleanup = await initializeSensors();
      setGpsStatus(prev => prev + ' ✅ Motion sensors active.');
      
      return cleanup;
    };

    initializeApp();
    initializeKalmanFilter();
  }, []);

  // Check timing milestones in real-time
  useEffect(() => {
    if (!isRunning) return;

    setTimes(prev => {
      const newTimes = { ...prev };
      const elapsed = elapsedTime;

      // Use dynamic targets based on units
      targets.speeds.forEach((target, index) => {
        const key = targets.labels[index] as keyof TimingResults;
        console.log(`Checking target ${key}: speed=${speed.toFixed(1)}, target=${target}, current=${prev[key]}`);
        
        if (speed >= target && !prev[key]) {
          console.log(`🎯 Target ${key} hit! Time: ${elapsed.toFixed(2)}s`);
          newTimes[key] = elapsed;
          setTargetHit(true);
          setHitTargetLabel(key);
          
          // Play sound notification
          soundNotifier.playTargetHit();
          
          // Reset highlighting after 5 seconds
          setTimeout(() => {
            setTargetHit(false);
            setHitTargetLabel(null);
          }, 5000);
          
          toast({
            title: `${target} ${getSpeedUnit()} Reached!`,
            description: `Time: ${elapsed.toFixed(2)}s`,
          });
        }
      });
      return newTimes;
    });
  }, [speed, elapsedTime, isRunning]);

  // Check distance milestones
  useEffect(() => {
    if (!isRunning) return;

    setTimes(prev => {
      const newTimes = { ...prev };
      const elapsed = elapsedTime;

      if (distance >= 402.336 && !prev.quarterMile) {
        newTimes.quarterMile = elapsed;
        setTargetHit(true);
        setHitTargetLabel('quarterMile');
        soundNotifier.playMilestone();
        setTimeout(() => {
          setTargetHit(false);
          setHitTargetLabel(null);
        }, 5000);
        toast({
          title: "Quarter Mile Complete!",
          description: `Time: ${elapsed.toFixed(2)}s`,
        });
      }
      if (distance >= 804.672 && !prev.halfMile) {
        newTimes.halfMile = elapsed;
        setTargetHit(true);
        setHitTargetLabel('halfMile');
        soundNotifier.playMilestone();
        setTimeout(() => {
          setTargetHit(false);
          setHitTargetLabel(null);
        }, 5000);
        stopMeasurement();
        toast({
          title: "Half Mile Complete!",
          description: `Time: ${elapsed.toFixed(2)}s`,
        });
      }
      return newTimes;
    });
  }, [distance, elapsedTime, isRunning]);

  // Dragy-style measurement start with placement guide
  const startMeasurement = useCallback(() => {
    if (isRunning || waitingForAcceleration) return;
    
    console.log('🚀 START button pressed - Dragy mode activated');
    setShowPlacementGuide(true);
  }, [isRunning, waitingForAcceleration]);

  const handlePlacementGuideClose = useCallback(async () => {
    setShowPlacementGuide(false);
    
    // First request GPS permission
    const hasPermission = await requestGPSPermission();
    if (!hasPermission) {
      console.log('❌ No GPS permission, cannot start');
      return;
    }

    // Initialize sensors and Kalman filter
    await initializeSensors();
    initializeKalmanFilter();
    
    // Start high-frequency GPS tracking immediately
    startGPSTracking();
    
    // Set Dragy-style states
    setStartTriggered(true);
    setWaitingForAcceleration(true);
    waitingForAccelerationRef.current = true;
    setSpeed(0);
    setElapsedTime(0);
    setDistance(0);
    setDataPoints([]);
    setTimes({
      '0-20': null,
      '0-30': null,
      '0-40': null,
      '0-60': null,
      '0-80': null,
      '0-100': null,
      '0-120': null,
      '0-130': null,
      '0-200': null,
      '0-250': null,
      quarterMile: null,
      halfMile: null,
    });
    setHasResults(false);
    setGpsStatus('Dragy mode ready - waiting for acceleration...');
    
    console.log('✅ Dragy mode ready - waiting for acceleration trigger');
    
    toast({
      title: "Ready to Launch!",
      description: "Accelerate smoothly to start measurement",
    });
  }, [requestGPSPermission, initializeSensors, initializeKalmanFilter, startGPSTracking]);

  // Stop measurement (Grok's logic implementation)
  const stopMeasurement = useCallback(() => {
    if (!isRunning && !waitingForAcceleration) return;

    // Grok's logic: Set isMeasuring = false, startTriggered = false, speed = 0
    setIsMeasuring(false);
    setStartTriggered(false);
    setIsRunning(false);
    setWaitingForAcceleration(false);
    setSpeed(0); // Set speed display = "0 km/h"
    setGpsStatus('Processing results...');
    startTimeRef.current = null; // Reset timer

    stopGPSTracking();

    // Advanced post-processing with multi-pass interpolation
    if (dataPoints.length >= 4) {
      try {
        console.log('Starting advanced post-processing with', dataPoints.length, 'data points');
        
        setTimes(prev => {
          const newTimes = { ...prev };
          
          // Use multi-pass interpolation for missing times
          if (!prev['0-30'] && dataPoints.some(p => p.speed >= 30)) {
            const time30 = multiPassInterpolator.current.findTimeForSpeed(dataPoints, 30);
            if (time30 !== null) {
              newTimes['0-30'] = time30;
              console.log('Multi-pass interpolation found 0-30 time:', time30);
            }
          }
          
          if (!prev['0-60'] && dataPoints.some(p => p.speed >= 60)) {
            const time60 = multiPassInterpolator.current.findTimeForSpeed(dataPoints, 60);
            if (time60 !== null) {
              newTimes['0-60'] = time60;
              console.log('Multi-pass interpolation found 0-60 time:', time60);
            }
          }
          
          if (!prev['0-100'] && dataPoints.some(p => p.speed >= 100)) {
            const time100 = multiPassInterpolator.current.findTimeForSpeed(dataPoints, 100);
            if (time100 !== null) {
              newTimes['0-100'] = time100;
              console.log('Multi-pass interpolation found 0-100 time:', time100);
            }
          }
          
          if (!prev['0-200'] && dataPoints.some(p => p.speed >= 200)) {
            const time200 = multiPassInterpolator.current.findTimeForSpeed(dataPoints, 200);
            if (time200 !== null) {
              newTimes['0-200'] = time200;
              console.log('Multi-pass interpolation found 0-200 time:', time200);
            }
          }
          
          if (!prev['0-250'] && dataPoints.some(p => p.speed >= 250)) {
            const time250 = multiPassInterpolator.current.findTimeForSpeed(dataPoints, 250);
            if (time250 !== null) {
              newTimes['0-250'] = time250;
            }
          }
          
          return newTimes;
        });
      } catch (error) {
        console.error('Advanced interpolation error:', error);
        
        // Fallback to original cubic spline method
        try {
          const times = dataPoints.map(p => p.time);
          const speeds = dataPoints.map(p => p.speed);
          const spline = new CubicSpline(times, speeds);

          setTimes(prev => {
            const newTimes = { ...prev };
            
            if (!prev['0-30'] && speeds.some(s => s >= 30)) {
              newTimes['0-30'] = spline.findTime(30);
            }
            if (!prev['0-60'] && speeds.some(s => s >= 60)) {
              newTimes['0-60'] = spline.findTime(60);
            }
            if (!prev['0-100'] && speeds.some(s => s >= 100)) {
              newTimes['0-100'] = spline.findTime(100);
            }
            if (!prev['0-200'] && speeds.some(s => s >= 200)) {
              newTimes['0-200'] = spline.findTime(200);
            }
            if (!prev['0-250'] && speeds.some(s => s >= 250)) {
              newTimes['0-250'] = spline.findTime(250);
            }
            
            return newTimes;
          });
        } catch (fallbackError) {
          console.error('Fallback interpolation also failed:', fallbackError);
        }
      }
    }

    // Save performance record to database
    savePerformanceRecord();
    
    setGpsStatus('Measurement complete');
    setHasResults(true);
    
    toast({
      title: "Measurement Complete",
      description: "Check your results below!",
    });
  }, [isRunning, waitingForAcceleration, dataPoints, stopGPSTracking]);

  // Save performance record to database
  const savePerformanceRecord = async () => {
    try {
      const maxSpeed = Math.max(...dataPoints.map(p => p.speed), speed);
      const maxAcceleration = Math.max(...dataPoints.map((p, i) => {
        if (i === 0) return 0;
        const speedDiff = p.speed - dataPoints[i - 1].speed;
        const timeDiff = (p.time - dataPoints[i - 1].time) || 0.1;
        return (speedDiff / 3.6) / timeDiff; // Convert km/h to m/s²
      }));
      
      const measurementDuration = elapsedTime * 1000; // Convert to milliseconds
      
      // Generate a user ID for testing (in production, this would come from auth)
      const userId = '00000000-0000-0000-0000-000000000000';
      
      const { error } = await supabase
        .from('performance_records')
        .insert({
          user_id: userId,
          max_speed: maxSpeed,
          max_acceleration: maxAcceleration,
          measurement_duration: measurementDuration,
        });

      if (error) {
        console.error('Error saving performance record:', error);
      } else {
        console.log('Performance record saved successfully');
      }
    } catch (error) {
      console.error('Failed to save performance record:', error);
    }
  };

  // Reset all data (including Grok's state variables)
  const resetMeasurement = useCallback(() => {
    if (isRunning || waitingForAcceleration) {
      stopMeasurement();
    }
    
    // Reset Grok's state variables
    setStartTriggered(false);
    setIsMeasuring(false);
    setSpeed(0);
    setElapsedTime(0);
    setDistance(0);
    setDataPoints([]);
    setWaitingForAcceleration(false);
    setTimes({
      '0-20': null,
      '0-30': null,
      '0-40': null,
      '0-60': null,
      '0-80': null,
      '0-100': null,
      '0-120': null,
      '0-130': null,
      '0-200': null,
      '0-250': null,
      quarterMile: null,
      halfMile: null,
    });
    setHasResults(false);
    
    resetSensorFusion();
    resetGPSTracking();
    
    toast({
      title: "Reset Complete",
      description: "Ready for next measurement",
    });
  }, [isRunning, waitingForAcceleration, stopMeasurement, resetSensorFusion, resetGPSTracking]);

  // Export results
  const exportResults = useCallback(() => {
    if (!hasResults) return;

    // Export as text
    let text = 'SpeedSnap Results\n';
    text += `Date: ${new Date().toLocaleString()}\n\n`;
    
    if (times['0-30']) text += `0-30 km/h: ${times['0-30'].toFixed(2)} s\n`;
    if (times['0-60']) text += `0-60 km/h: ${times['0-60'].toFixed(2)} s\n`;
    if (times['0-100']) text += `0-100 km/h: ${times['0-100'].toFixed(2)} s\n`;
    if (times['0-200']) text += `0-200 km/h: ${times['0-200'].toFixed(2)} s\n`;
    if (times['0-250']) text += `0-250 km/h: ${times['0-250'].toFixed(2)} s\n`;
    
    if (times.quarterMile) text += `Quarter Mile: ${times.quarterMile.toFixed(2)} s\n`;
    if (times.halfMile) text += `Half Mile: ${times.halfMile.toFixed(2)} s\n`;

    const blob = new Blob([text], { type: 'text/plain' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `speedsnap-results-${new Date().toISOString().split('T')[0]}.txt`;
    link.click();

    // Export chart if available
    if (chartRef.current) {
      chartRef.current.exportChart();
    }

    toast({
      title: "Results Exported",
      description: "Files downloaded successfully",
    });
  }, [hasResults, times]);

  // Simulate complete acceleration test for all measurements
  const simulateSprint = useCallback(() => {
    if (isRunning || waitingForAcceleration) return;

    setIsRunning(true);
    setSpeed(0);
    setElapsedTime(0);
    setDistance(0);
    setDataPoints([]);
    setTimes({
      '0-20': null,
      '0-30': null,
      '0-40': null,
      '0-60': null,
      '0-80': null,
      '0-100': null,
      '0-120': null,
      '0-130': null,
      '0-200': null,
      '0-250': null,
      quarterMile: null,
      halfMile: null,
    });
    setHasResults(false);
    
    // Generate realistic acceleration data up to 300km/h and half mile
    const simulationData: DataPoint[] = [];
    const totalTime = 25.0; // Extended time to reach all milestones
    const timeStep = 0.1; // 100ms intervals
    
    for (let t = 0; t <= totalTime; t += timeStep) {
      // Realistic acceleration curve with decreasing acceleration at higher speeds
      let speed;
      if (t <= 2.0) {
        // Initial strong acceleration (0-50 km/h)
        speed = t * 25;
      } else if (t <= 6.0) {
        // 0-100 km/h phase
        speed = 50 + (t - 2.0) * 12.5;
      } else if (t <= 12.0) {
        // 100-200 km/h phase (slower acceleration)
        speed = 100 + (t - 6.0) * 16.67;
      } else if (t <= 18.0) {
        // 200-250 km/h phase (much slower)
        speed = 200 + (t - 12.0) * 8.33;
      } else {
        // 250-300 km/h phase (very slow)
        speed = 250 + (t - 18.0) * 7.14;
      }
      
      // Add some realistic noise/variance
      speed += (Math.random() - 0.5) * 3;
      speed = Math.max(0, Math.min(speed, 300));
      
      // Calculate approximate distance (very rough estimation)
      const avgSpeed = t > 0 ? speed / 2 : 0; // Average speed approximation
      const distance = (avgSpeed * t * 1000) / 3600; // Convert to meters
      
      simulationData.push({ time: t, speed });
    }
    
    // Animate the simulation
    let currentIndex = 0;
    startTimeRef.current = performance.now();
    
    const animate = () => {
      if (currentIndex >= simulationData.length) {
        // Simulation complete
        setTimeout(() => {
          stopMeasurement();
        }, 500);
        return;
      }
      
      const dataPoint = simulationData[currentIndex];
      setSpeed(dataPoint.speed);
      setElapsedTime(dataPoint.time);
      setDataPoints(prev => [...prev, dataPoint]);
      
      // Update distance for simulation (approximate)
      const avgSpeed = dataPoint.speed / 3.6; // Convert km/h to m/s
      const distanceIncrement = avgSpeed * 0.1; // Distance in 0.1 seconds
      setDistance(prev => prev + distanceIncrement);
      
      // Check for milestones during simulation
      const elapsed = dataPoint.time;
      setTimes(prev => {
        const newTimes = { ...prev };
        
        // Speed milestones
        if (dataPoint.speed >= 30 && !prev['0-30']) {
          newTimes['0-30'] = elapsed;
          toast({
            title: "30 km/h Reached!",
            description: `Time: ${elapsed.toFixed(2)}s`,
          });
        }
        if (dataPoint.speed >= 60 && !prev['0-60']) {
          newTimes['0-60'] = elapsed;
          toast({
            title: "60 km/h Reached!",
            description: `Time: ${elapsed.toFixed(2)}s`,
          });
        }
        if (dataPoint.speed >= 100 && !prev['0-100']) {
          newTimes['0-100'] = elapsed;
          toast({
            title: "100 km/h Reached!",
            description: `Time: ${elapsed.toFixed(2)}s`,
          });
        }
        if (dataPoint.speed >= 200 && !prev['0-200']) {
          newTimes['0-200'] = elapsed;
          toast({
            title: "200 km/h Reached!",
            description: `Time: ${elapsed.toFixed(2)}s`,
          });
        }
        if (dataPoint.speed >= 250 && !prev['0-250']) {
          newTimes['0-250'] = elapsed;
          toast({
            title: "250 km/h Reached!",
            description: `Time: ${elapsed.toFixed(2)}s`,
          });
        }
        
        // Distance milestones (update distance state and check)
        const currentDistance = (avgSpeed * elapsed * 1000) / 3600;
        if (currentDistance >= 402.336 && !prev.quarterMile) {
          newTimes.quarterMile = elapsed;
          toast({
            title: "Quarter Mile Complete!",
            description: `Time: ${elapsed.toFixed(2)}s`,
          });
        }
        if (currentDistance >= 804.672 && !prev.halfMile) {
          newTimes.halfMile = elapsed;
          toast({
            title: "Half Mile Complete!",
            description: `Time: ${elapsed.toFixed(2)}s`,
          });
        }
        
        return newTimes;
      });
      
      currentIndex++;
      setTimeout(animate, 100); // 100ms between updates
    };
    
    toast({
      title: "Full Test Simulation Started",
      description: "Running complete acceleration test (0-300km/h, 1/4 & 1/2 mile)",
    });
    
    animate();
  }, [isRunning, waitingForAcceleration, times, stopMeasurement]);

  return (
    <div className="min-h-screen bg-gradient-background p-4">
      <div className="max-w-md mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Zap className="w-8 h-8 text-primary" />
            <h1 className="text-3xl font-bold bg-gradient-primary bg-clip-text text-transparent">
              SpeedSnap
            </h1>
          </div>
          <p className="text-muted-foreground">Professional Acceleration Timer</p>
        </div>

        {/* GPS Accuracy Warning */}
        {gpsAccuracy !== null && gpsAccuracy > 10 && (
          <Card className="p-4 border-warning bg-warning/10">
            <div className="flex items-center gap-2 text-warning-foreground">
              <Zap className="w-4 h-4" />
              <div className="text-sm">
                <strong>Poor GPS Signal</strong>
                <p className="text-xs mt-1">
                  GPS accuracy: ±{gpsAccuracy.toFixed(1)}m. For our target ±0.1s accuracy, 
                  move to an open area with clear sky view.
                </p>
              </div>
            </div>
          </Card>
        )}

        {/* Main Display Card */}
        <MeasurementDisplay 
          speed={speed}
          elapsedTime={elapsedTime}
          status={gpsStatus}
          isRunning={isRunning}
          targetHit={targetHit}
        />

        {/* Control Buttons */}
        <div className="flex gap-3">
          <Button
            onClick={(isRunning || waitingForAcceleration) ? stopMeasurement : startMeasurement}
            variant={(isRunning || waitingForAcceleration) ? "destructive" : "default"}
            className="flex-1 h-12 text-lg font-semibold"
            disabled={gpsStatus.includes('❌') || gpsStatus.includes('Requesting')}
          >
            {(isRunning || waitingForAcceleration) ? (
              <>
                <Square className="w-5 h-5 mr-2" />
                Stop
              </>
            ) : (
              <>
                <Play className="w-5 h-5 mr-2" />
                Start
              </>
            )}
          </Button>
          
          <Button
            onClick={resetMeasurement}
            variant="outline"
            size="lg"
            className="h-12"
            disabled={isRunning}
          >
            <RotateCcw className="w-5 h-5" />
          </Button>
          
          <Button
            onClick={exportResults}
            variant="outline"
            size="lg"
            className="h-12"
            disabled={!hasResults}
          >
            <Download className="w-5 h-5" />
          </Button>
        </div>

        {/* Simulation Button */}
        <div className="flex justify-center">
          <Button
            onClick={simulateSprint}
            variant="secondary"
            className="w-full h-12 text-lg font-semibold"
            disabled={isRunning || waitingForAcceleration}
          >
            <TestTube className="w-5 h-5 mr-2" />
            Test All Measurements
          </Button>
        </div>

        {/* Results */}
        <ResultsPanel 
          times={times} 
          hasResults={hasResults} 
          isRunning={isRunning || waitingForAcceleration}
          hitTargetLabel={hitTargetLabel}
        />

        {/* Chart */}
        {dataPoints.length > 0 && (
          <Card className="p-4">
            <SpeedChart 
              ref={chartRef}
              dataPoints={dataPoints} 
              times={times} 
            />
          </Card>
        )}

        <PlacementGuide 
          isVisible={showPlacementGuide}
          onClose={handlePlacementGuideClose}
        />
      </div>
    </div>
  );
};

export default SpeedSnap;