import React, { createContext, useContext, useState, ReactNode } from 'react';

type Units = 'kmh' | 'mph';

interface UnitsContextType {
  units: Units;
  setUnits: (units: Units) => void;
  convertSpeed: (speed: number) => number;
  getSpeedUnit: () => string;
  getTargets: () => {
    speeds: number[];
    labels: string[];
  };
}

const UnitsContext = createContext<UnitsContextType | undefined>(undefined);

export const useUnits = () => {
  const context = useContext(UnitsContext);
  if (!context) {
    throw new Error('useUnits must be used within a UnitsProvider');
  }
  return context;
};

interface UnitsProviderProps {
  children: ReactNode;
}

export const UnitsProvider: React.FC<UnitsProviderProps> = ({ children }) => {
  const [units, setUnits] = useState<Units>('kmh');

  const convertSpeed = (speed: number): number => {
    if (units === 'mph') {
      return speed * 0.621371; // km/h to mph
    }
    return speed;
  };

  const getSpeedUnit = (): string => {
    return units === 'mph' ? 'mph' : 'km/h';
  };

  const getTargets = () => {
    if (units === 'mph') {
      return {
        speeds: [20, 40, 60, 80, 100, 120], // mph targets
        labels: ['0-20', '0-40', '0-60', '0-80', '0-100', '0-120']
      };
    }
    return {
      speeds: [30, 60, 100, 130, 200, 250], // km/h targets
      labels: ['0-30', '0-60', '0-100', '0-130', '0-200', '0-250']
    };
  };

  const value: UnitsContextType = {
    units,
    setUnits,
    convertSpeed,
    getSpeedUnit,
    getTargets,
  };

  return (
    <UnitsContext.Provider value={value}>
      {children}
    </UnitsContext.Provider>
  );
};