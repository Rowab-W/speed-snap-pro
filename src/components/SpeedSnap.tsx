import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Play, Square, RotateCcw, Download, Zap, Gauge } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import SpeedChart from './SpeedChart';
import { CubicSpline } from '../utils/CubicSpline';
import { ExtendedKalmanFilter } from '../utils/ExtendedKalmanFilter';

interface TimingResults {
  '0-100': number | null;
  '0-200': number | null;
  '0-250': number | null;
  '0-300': number | null;
  quarterMile: number | null;
  halfMile: number | null;
}

interface DataPoint {
  time: number;
  speed: number;
}

const SpeedSnap: React.FC = () => {
  const [isRunning, setIsRunning] = useState(false);
  const [waitingForAcceleration, setWaitingForAcceleration] = useState(false);
  const [speed, setSpeed] = useState(0);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [distance, setDistance] = useState(0);
  const [status, setStatus] = useState('Requesting permissions...');
  const [times, setTimes] = useState<TimingResults>({
    '0-100': null,
    '0-200': null,
    '0-250': null,
    '0-300': null,
    quarterMile: null,
    halfMile: null,
  });
  const [dataPoints, setDataPoints] = useState<DataPoint[]>([]);
  const [hasResults, setHasResults] = useState(false);

  const startTimeRef = useRef<number | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const lastTimestampRef = useRef<number | null>(null);
  const ekfRef = useRef<ExtendedKalmanFilter | null>(null);
  const accelerometerRef = useRef<{ x: number; y: number; z: number }>({ x: 0, y: 0, z: 0 });
  const chartRef = useRef<any>(null);
  const waitingForAccelerationRef = useRef<boolean>(false);

  // Initialize sensors and permissions
  useEffect(() => {
    const initializeSensors = async () => {
      try {
        // Request geolocation permission
        await new Promise<void>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(
            () => {
              setStatus('GPS permission granted');
              resolve();
            },
            (error) => {
              setStatus(`GPS error: ${error.message}`);
              reject(error);
            },
            { enableHighAccuracy: true }
          );
        });

        // Initialize accelerometer if available
        if ('DeviceMotionEvent' in window) {
          const handleDeviceMotion = (event: DeviceMotionEvent) => {
            if (event.acceleration) {
              accelerometerRef.current = {
                x: event.acceleration.x || 0,
                y: event.acceleration.y || 0,
                z: event.acceleration.z || 0,
              };
              
              // Only check acceleration if we're waiting for it after pressing START
              if (waitingForAccelerationRef.current) {
                const { x, y, z } = accelerometerRef.current;
                const magnitude = Math.sqrt(x * x + y * y + z * z);
                
                if (magnitude > 2) {
                  // Trigger actual measurement start
                  waitingForAccelerationRef.current = false;
                  setWaitingForAcceleration(false);
                  setIsRunning(true);
                  setStatus('Measuring...');
                  
                  startTimeRef.current = performance.now();
                  lastTimestampRef.current = null;
                  ekfRef.current = new ExtendedKalmanFilter();

                  // Clear existing GPS watch and start measurement tracking
                  if (watchIdRef.current) {
                    navigator.geolocation.clearWatch(watchIdRef.current);
                  }

                  if (navigator.geolocation) {
                    watchIdRef.current = navigator.geolocation.watchPosition(
                      handlePosition,
                      (error) => {
                        setStatus(`GPS error: ${error.message}`);
                        setIsRunning(false);
                        setWaitingForAcceleration(false);
                        waitingForAccelerationRef.current = false;
                      },
                      {
                        enableHighAccuracy: true,
                        maximumAge: 0,
                        timeout: 5000,
                      }
                    );
                  }

                  toast({
                    title: "Measurement Started!",
                    description: "Tracking your acceleration now",
                  });
                }
              }
            }
          };

          window.addEventListener('devicemotion', handleDeviceMotion);
          setStatus(prev => prev + ' Motion sensors active.');
          
          return () => {
            window.removeEventListener('devicemotion', handleDeviceMotion);
          };
        } else {
          setStatus(prev => prev + ' Motion sensors not supported. Using GPS only.');
        }
      } catch (error) {
        setStatus('Error accessing sensors. Please allow location access.');
        toast({
          title: "Sensor Error",
          description: "Please allow location access to use SpeedSnap",
          variant: "destructive",
        });
      }
    };

    initializeSensors();
    ekfRef.current = new ExtendedKalmanFilter();
  }, []); // Remove dependency to prevent re-initialization

  // Check for acceleration to trigger actual measurement
  const checkAcceleration = useCallback(() => {
    const { x, y, z } = accelerometerRef.current;
    const magnitude = Math.sqrt(x * x + y * y + z * z);
    
    // Only start measurement if we're waiting for acceleration and conditions are met
    if (magnitude > 2 && waitingForAcceleration && speed < 5) {
      startActualMeasurement();
    }
  }, [waitingForAcceleration, speed]);

  // Prepare for measurement (called when START button is pressed)
  const startMeasurement = useCallback(() => {
    if (isRunning || waitingForAcceleration) return;

    setWaitingForAcceleration(true);
    waitingForAccelerationRef.current = true; // Update ref as well
    setSpeed(0);
    setElapsedTime(0);
    setDistance(0);
    setDataPoints([]);
    setTimes({
      '0-100': null,
      '0-200': null,
      '0-250': null,
      '0-300': null,
      quarterMile: null,
      halfMile: null,
    });
    setHasResults(false);
    setStatus('Waiting for acceleration... (>2 m/s²)');

    // Start GPS tracking to monitor speed
    if (navigator.geolocation) {
      watchIdRef.current = navigator.geolocation.watchPosition(
        (position) => {
          const speedMs = position.coords.speed || 0;
          const speedKmh = speedMs * 3.6;
          setSpeed(speedKmh);
        },
        (error) => {
          setStatus(`GPS error: ${error.message}`);
          setWaitingForAcceleration(false);
          toast({
            title: "GPS Error",
            description: error.message,
            variant: "destructive",
          });
        },
        {
          enableHighAccuracy: true,
          maximumAge: 0,
          timeout: 5000,
        }
      );
    }

    toast({
      title: "Ready to Start",
      description: "Accelerate to begin measurement (>2 m/s² from <5 km/h)",
    });
  }, [isRunning, waitingForAcceleration]);

  // Start actual measurement (called when acceleration is detected)
  const startActualMeasurement = useCallback(() => {
    setWaitingForAcceleration(false);
    setIsRunning(true);
    setStatus('Measuring...');
    
    startTimeRef.current = performance.now();
    lastTimestampRef.current = null;
    ekfRef.current = new ExtendedKalmanFilter();

    // Continue with existing GPS tracking but now for measurement
    if (watchIdRef.current) {
      navigator.geolocation.clearWatch(watchIdRef.current);
    }

    if (navigator.geolocation) {
      watchIdRef.current = navigator.geolocation.watchPosition(
        handlePosition,
        (error) => {
          setStatus(`GPS error: ${error.message}`);
          stopMeasurement();
          toast({
            title: "GPS Error",
            description: error.message,
            variant: "destructive",
          });
        },
        {
          enableHighAccuracy: true,
          maximumAge: 0,
          timeout: 5000,
        }
      );
    }

    toast({
      title: "Measurement Started!",
      description: "Tracking your acceleration now",
    });
  }, []);

  // Handle GPS position updates
  const handlePosition = useCallback((position: GeolocationPosition) => {
    if (!isRunning || !startTimeRef.current || !ekfRef.current) return;

    console.log('GPS Position:', {
      speed: position.coords.speed,
      accuracy: position.coords.accuracy,
      timestamp: position.timestamp
    });

    const speedMs = position.coords.speed || 0;
    const speedKmh = speedMs * 3.6;
    const timestamp = position.timestamp;
    const elapsed = (performance.now() - startTimeRef.current) / 1000;

    // Calculate distance
    if (lastTimestampRef.current) {
      const dt = (timestamp - lastTimestampRef.current) / 1000;
      setDistance(prev => prev + (speedMs * dt));
    }
    lastTimestampRef.current = timestamp;

    // Apply Kalman filter
    const { x, y, z } = accelerometerRef.current;
    const accelMagnitude = Math.sqrt(x * x + y * y + z * z);
    const dt = lastTimestampRef.current ? (timestamp - lastTimestampRef.current) / 1000 : 0.1;
    
    ekfRef.current.predict(dt);
    const fusedSpeed = ekfRef.current.update([speedKmh, accelMagnitude]);

    console.log('Speed data:', {
      rawSpeedKmh: speedKmh,
      fusedSpeed: fusedSpeed,
      accelMagnitude: accelMagnitude
    });

    setSpeed(fusedSpeed);
    setElapsedTime(elapsed);
    
    // Store data point
    setDataPoints(prev => [...prev, { time: elapsed, speed: fusedSpeed }]);

    // Check timing milestones
    setTimes(prev => {
      const newTimes = { ...prev };
      if (fusedSpeed >= 100 && !prev['0-100']) {
        newTimes['0-100'] = elapsed;
        toast({
          title: "100 km/h Reached!",
          description: `Time: ${elapsed.toFixed(2)}s`,
        });
      }
      if (fusedSpeed >= 200 && !prev['0-200']) {
        newTimes['0-200'] = elapsed;
        toast({
          title: "200 km/h Reached!",
          description: `Time: ${elapsed.toFixed(2)}s`,
        });
      }
      if (fusedSpeed >= 250 && !prev['0-250']) {
        newTimes['0-250'] = elapsed;
      }
      if (fusedSpeed >= 300 && !prev['0-300']) {
        newTimes['0-300'] = elapsed;
      }
      return newTimes;
    });

    // Check distance milestones
    setDistance(currentDistance => {
      setTimes(prev => {
        const newTimes = { ...prev };
        if (currentDistance >= 402.336 && !prev.quarterMile) {
          newTimes.quarterMile = elapsed;
          toast({
            title: "Quarter Mile Complete!",
            description: `Time: ${elapsed.toFixed(2)}s`,
          });
        }
        if (currentDistance >= 804.672 && !prev.halfMile) {
          newTimes.halfMile = elapsed;
          stopMeasurement();
          toast({
            title: "Half Mile Complete!",
            description: `Time: ${elapsed.toFixed(2)}s`,
          });
        }
        return newTimes;
      });
      return currentDistance;
    });
  }, [isRunning]);

  // Stop measurement
  const stopMeasurement = useCallback(() => {
    if (!isRunning && !waitingForAcceleration) return;

    setIsRunning(false);
    setWaitingForAcceleration(false);
    setStatus('Processing results...');

    if (watchIdRef.current) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }

    // Process results with interpolation
    if (dataPoints.length >= 4) {
      try {
        const times = dataPoints.map(p => p.time);
        const speeds = dataPoints.map(p => p.speed);
        const spline = new CubicSpline(times, speeds);

        setTimes(prev => {
          const newTimes = { ...prev };
          
          // Interpolate missing times
          if (!prev['0-100'] && speeds.some(s => s >= 100)) {
            newTimes['0-100'] = spline.findTime(100);
          }
          if (!prev['0-200'] && speeds.some(s => s >= 200)) {
            newTimes['0-200'] = spline.findTime(200);
          }
          if (!prev['0-250'] && speeds.some(s => s >= 250)) {
            newTimes['0-250'] = spline.findTime(250);
          }
          if (!prev['0-300'] && speeds.some(s => s >= 300)) {
            newTimes['0-300'] = spline.findTime(300);
          }
          
          return newTimes;
        });
      } catch (error) {
        console.error('Interpolation error:', error);
      }
    }

    setStatus('Measurement complete');
    setHasResults(true);
    
    toast({
      title: "Measurement Complete",
      description: "Check your results below!",
    });
  }, [isRunning, waitingForAcceleration, dataPoints]);

  // Reset all data
  const resetMeasurement = useCallback(() => {
    if (isRunning || waitingForAcceleration) {
      stopMeasurement();
    }
    
    setSpeed(0);
    setElapsedTime(0);
    setDistance(0);
    setDataPoints([]);
    setWaitingForAcceleration(false);
    waitingForAccelerationRef.current = false; // Reset ref as well
    setTimes({
      '0-100': null,
      '0-200': null,
      '0-250': null,
      '0-300': null,
      quarterMile: null,
      halfMile: null,
    });
    setHasResults(false);
    setStatus('Ready to measure');
    
    toast({
      title: "Reset Complete",
      description: "Ready for next measurement",
    });
  }, [isRunning, waitingForAcceleration, stopMeasurement]);

  // Export results
  const exportResults = useCallback(() => {
    if (!hasResults) return;

    // Export as text
    let text = 'SpeedSnap Results\n';
    text += `Date: ${new Date().toLocaleString()}\n\n`;
    
    if (times['0-100']) text += `0-100 km/h: ${times['0-100'].toFixed(2)} s\n`;
    if (times['0-200']) text += `0-200 km/h: ${times['0-200'].toFixed(2)} s\n`;
    if (times['0-250']) text += `0-250 km/h: ${times['0-250'].toFixed(2)} s\n`;
    if (times['0-300']) text += `0-300 km/h: ${times['0-300'].toFixed(2)} s\n`;
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

        {/* Main Display Card */}
        <Card className="p-6 text-center space-y-4 racing-glow">
          <div className="space-y-2">
            <div className={`text-6xl font-bold speed-gradient ${isRunning ? 'pulse-racing' : ''}`}>
              {Math.round(speed)} km/h
            </div>
            <div className="text-2xl text-accent font-mono">
              {elapsedTime.toFixed(2)} s
            </div>
          </div>

          <div className="flex items-center justify-center gap-2">
            <Gauge className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">{status}</span>
          </div>
        </Card>

        {/* Control Buttons */}
        <div className="flex gap-3">
          <Button
            onClick={(isRunning || waitingForAcceleration) ? stopMeasurement : startMeasurement}
            variant={(isRunning || waitingForAcceleration) ? "destructive" : "default"}
            className="flex-1 h-12 text-lg font-semibold"
            disabled={status.includes('❌') || status.includes('Requesting')}
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

        {/* Results */}
        {hasResults && (
          <Card className="p-6 space-y-4">
            <h3 className="text-lg font-semibold text-center">Results</h3>
            <div className="grid grid-cols-2 gap-3">
              {times['0-100'] && (
                <div className="text-center p-3 bg-muted rounded-lg">
                  <div className="text-sm text-muted-foreground">0-100 km/h</div>
                  <div className="text-lg font-bold text-primary">{times['0-100'].toFixed(2)}s</div>
                </div>
              )}
              {times['0-200'] && (
                <div className="text-center p-3 bg-muted rounded-lg">
                  <div className="text-sm text-muted-foreground">0-200 km/h</div>
                  <div className="text-lg font-bold text-accent">{times['0-200'].toFixed(2)}s</div>
                </div>
              )}
              {times['0-250'] && (
                <div className="text-center p-3 bg-muted rounded-lg">
                  <div className="text-sm text-muted-foreground">0-250 km/h</div>
                  <div className="text-lg font-bold text-warning">{times['0-250'].toFixed(2)}s</div>
                </div>
              )}
              {times['0-300'] && (
                <div className="text-center p-3 bg-muted rounded-lg">
                  <div className="text-sm text-muted-foreground">0-300 km/h</div>
                  <div className="text-lg font-bold text-success">{times['0-300'].toFixed(2)}s</div>
                </div>
              )}
              {times.quarterMile && (
                <div className="text-center p-3 bg-muted rounded-lg">
                  <div className="text-sm text-muted-foreground">1/4 Mile</div>
                  <div className="text-lg font-bold text-primary">{times.quarterMile.toFixed(2)}s</div>
                </div>
              )}
              {times.halfMile && (
                <div className="text-center p-3 bg-muted rounded-lg">
                  <div className="text-sm text-muted-foreground">1/2 Mile</div>
                  <div className="text-lg font-bold text-accent">{times.halfMile.toFixed(2)}s</div>
                </div>
              )}
            </div>
          </Card>
        )}

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
      </div>
    </div>
  );
};

export default SpeedSnap;