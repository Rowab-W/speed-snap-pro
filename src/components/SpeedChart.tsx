import React, { forwardRef, useImperativeHandle, useRef, useEffect } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ChartOptions,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import annotationPlugin from 'chartjs-plugin-annotation';
import { CubicSpline } from '../utils/CubicSpline';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  annotationPlugin
);

interface DataPoint {
  time: number;
  speed: number;
}

interface TimingResults {
  '0-100': number | null;
  '0-200': number | null;
  '0-250': number | null;
  '0-300': number | null;
  quarterMile: number | null;
  halfMile: number | null;
}

interface SpeedChartProps {
  dataPoints: DataPoint[];
  times: TimingResults;
}

export interface SpeedChartRef {
  exportChart: () => void;
}

const SpeedChart = forwardRef<SpeedChartRef, SpeedChartProps>(({ dataPoints, times }, ref) => {
  const chartRef = useRef<ChartJS<'line'>>(null);

  useImperativeHandle(ref, () => ({
    exportChart: () => {
      if (chartRef.current) {
        const link = document.createElement('a');
        link.href = chartRef.current.toBase64Image();
        link.download = `speedsnap-chart-${new Date().toISOString().split('T')[0]}.png`;
        link.click();
      }
    }
  }));

  // Generate interpolated data
  const generateInterpolatedData = () => {
    if (dataPoints.length < 4) return { times: [], speeds: [] };
    
    try {
      const timesArray = dataPoints.map(p => p.time);
      const speedsArray = dataPoints.map(p => p.speed);
      const spline = new CubicSpline(timesArray, speedsArray);
      
      const interpolatedTimes: number[] = [];
      const interpolatedSpeeds: number[] = [];
      
      const step = (timesArray[timesArray.length - 1] - timesArray[0]) / 100;
      for (let t = timesArray[0]; t <= timesArray[timesArray.length - 1]; t += step) {
        interpolatedTimes.push(t);
        interpolatedSpeeds.push(spline.interpolate(t));
      }
      
      return { times: interpolatedTimes, speeds: interpolatedSpeeds };
    } catch (error) {
      console.error('Interpolation error:', error);
      return { times: [], speeds: [] };
    }
  };

  const interpolatedData = generateInterpolatedData();

  const chartData = {
    labels: dataPoints.map(p => p.time.toFixed(2)),
    datasets: [
      {
        label: 'Actual Speed',
        data: dataPoints.map(p => p.speed),
        borderColor: 'hsl(0 85% 60%)',
        backgroundColor: 'hsla(0 85% 60% / 0.1)',
        pointBackgroundColor: 'hsl(0 85% 60%)',
        pointBorderColor: 'hsl(0 85% 60%)',
        pointRadius: 3,
        pointHoverRadius: 5,
        tension: 0.1,
        fill: false,
      },
      ...(interpolatedData.times.length > 0 ? [{
        label: 'Interpolated',
        data: interpolatedData.speeds.map((speed, index) => ({
          x: interpolatedData.times[index],
          y: speed
        })),
        borderColor: 'hsl(200 100% 50%)',
        backgroundColor: 'hsla(200 100% 50% / 0.1)',
        pointRadius: 0,
        pointHoverRadius: 0,
        tension: 0.4,
        fill: false,
        borderDash: [5, 5],
      }] : [])
    ],
  };

  const annotations: any = {};
  
  // Add vertical lines for timing milestones
  if (times['0-100']) {
    annotations['line100'] = {
      type: 'line',
      xMin: times['0-100'],
      xMax: times['0-100'],
      borderColor: 'hsl(45 100% 60%)',
      borderWidth: 2,
      borderDash: [5, 5],
      label: {
        content: '100 km/h',
        enabled: true,
        position: 'start',
        backgroundColor: 'hsl(45 100% 60%)',
        color: 'hsl(220 15% 8%)',
        font: {
          size: 10,
          weight: 'bold',
        },
        padding: 4,
      },
    };
  }

  if (times['0-200']) {
    annotations['line200'] = {
      type: 'line',
      xMin: times['0-200'],
      xMax: times['0-200'],
      borderColor: 'hsl(120 60% 50%)',
      borderWidth: 2,
      borderDash: [5, 5],
      label: {
        content: '200 km/h',
        enabled: true,
        position: 'start',
        backgroundColor: 'hsl(120 60% 50%)',
        color: 'hsl(0 0% 98%)',
        font: {
          size: 10,
          weight: 'bold',
        },
        padding: 4,
      },
    };
  }

  const options: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index',
      intersect: false,
    },
    plugins: {
      legend: {
        position: 'top',
        labels: {
          color: 'hsl(0 0% 98%)',
          font: {
            size: 12,
          },
        },
      },
      title: {
        display: true,
        text: 'Speed vs Time',
        color: 'hsl(0 0% 98%)',
        font: {
          size: 16,
          weight: 'bold',
        },
      },
      annotation: {
        annotations,
      },
      tooltip: {
        backgroundColor: 'hsl(220 15% 12%)',
        titleColor: 'hsl(0 0% 98%)',
        bodyColor: 'hsl(0 0% 98%)',
        borderColor: 'hsl(0 85% 60%)',
        borderWidth: 1,
        cornerRadius: 8,
        displayColors: true,
        callbacks: {
          title: (context) => `Time: ${context[0].label}s`,
          label: (context) => `${context.dataset.label}: ${context.parsed.y.toFixed(1)} km/h`,
        },
      },
    },
    scales: {
      x: {
        display: true,
        title: {
          display: true,
          text: 'Time (seconds)',
          color: 'hsl(0 0% 98%)',
          font: {
            size: 12,
            weight: 'bold',
          },
        },
        ticks: {
          color: 'hsl(220 10% 65%)',
          font: {
            size: 10,
          },
        },
        grid: {
          color: 'hsl(220 15% 25%)',
          lineWidth: 1,
        },
      },
      y: {
        display: true,
        title: {
          display: true,
          text: 'Speed (km/h)',
          color: 'hsl(0 0% 98%)',
          font: {
            size: 12,
            weight: 'bold',
          },
        },
        ticks: {
          color: 'hsl(220 10% 65%)',
          font: {
            size: 10,
          },
        },
        grid: {
          color: 'hsl(220 15% 25%)',
          lineWidth: 1,
        },
        beginAtZero: true,
      },
    },
  };

  return (
    <div className="h-64 w-full">
      <Line ref={chartRef} data={chartData} options={options} />
    </div>
  );
});

SpeedChart.displayName = 'SpeedChart';

export default SpeedChart;