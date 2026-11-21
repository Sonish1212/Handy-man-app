import * as Location from 'expo-location';
import { createContext, useCallback, useContext, useMemo, useState } from 'react';

import { areas, DEFAULT_AREA_ID, nearestArea } from '../data/areas';
import { storage } from './storage';

const STORAGE_KEY = 'selectedAreaId';
const PIN_KEY = 'selectedPin';

const LocationContext = createContext(null);

function readSavedArea() {
  try {
    const id = storage?.getItem(STORAGE_KEY);
    return areas.find((area) => area.id === id) ?? null;
  } catch {
    return null;
  }
}

function readSavedPin() {
  try {
    const pin = JSON.parse(storage?.getItem(PIN_KEY) ?? 'null');
    return Number.isFinite(pin?.lat) && Number.isFinite(pin?.lng) ? pin : null;
  } catch {
    return null;
  }
}

// Where the customer is booking for, shared by every screen and remembered
// on the phone between visits: the area (Baneshwor, …) and, once they have
// placed it on the map, the exact pin of their house.
export function LocationProvider({ children }) {
  const [area, setAreaState] = useState(
    () => readSavedArea() ?? areas.find((item) => item.id === DEFAULT_AREA_ID),
  );
  const [pin, setPinState] = useState(() => (readSavedArea() ? readSavedPin() : null));

  // pin is { lat, lng } from the map, or null when only the area is known.
  const setPlace = useCallback((nextArea, nextPin = null) => {
    setAreaState(nextArea);
    setPinState(nextPin);
    try {
      storage?.setItem(STORAGE_KEY, nextArea.id);
      if (nextPin) storage?.setItem(PIN_KEY, JSON.stringify(nextPin));
      else storage?.removeItem(PIN_KEY);
    } catch {
      // Not saved; the choice still applies until the app closes.
    }
  }, []);

  // Asks for permission and reads the GPS once. Returns { point, area } when
  // the phone is inside our service area, otherwise { error } to show.
  const locateMe = useCallback(async () => {
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) {
        return { error: 'Location permission is off. Choose your area from the list instead.' };
      }
      if (!(await Location.hasServicesEnabledAsync())) {
        return { error: 'Location services are turned off on this phone.' };
      }
      const position =
        (await Location.getLastKnownPositionAsync({ maxAge: 5 * 60 * 1000 })) ??
        (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
      const point = { lat: position.coords.latitude, lng: position.coords.longitude };
      const match = nearestArea(point);
      if (!match) {
        return {
          error:
            'Your phone is outside the areas we serve. We work in Kathmandu, Lalitpur and Bhaktapur: choose your area from the list.',
        };
      }
      return { point, area: match };
    } catch {
      return { error: 'Could not get your location. Choose your area from the list instead.' };
    }
  }, []);

  const value = useMemo(() => ({ area, pin, setPlace, locateMe }), [area, pin, setPlace, locateMe]);

  return <LocationContext.Provider value={value}>{children}</LocationContext.Provider>;
}

export function useLocation() {
  const context = useContext(LocationContext);
  if (!context) throw new Error('useLocation must be used inside LocationProvider');
  return context;
}
