import { useState } from 'react';
import { MapPin, LocateFixed, Save } from 'lucide-react';
import { saveClassGeofence } from '../services/api';
import type { ClassItem, GeofencePolicy } from '../types';
export function GeofencePanel({
  classItem,
  onSaved,
}: {
  classItem: ClassItem;
  onSaved: (policy: GeofencePolicy) => void;
}) {
  const current = classItem.geofence;
  const [enabled, setEnabled] = useState(current?.enabled || false),
    [latitude, setLatitude] = useState(
      current?.enabled ? String(current.latitude) : '',
    ),
    [longitude, setLongitude] = useState(
      current?.enabled ? String(current.longitude) : '',
    ),
    [radius, setRadius] = useState(
      current?.enabled ? String(current.radiusM) : '200',
    );
  const [busy, setBusy] = useState(false),
    [locating, setLocating] = useState(false),
    [error, setError] = useState<string | null>(null),
    [saved, setSaved] = useState(false);
  const locate = () => {
    setError(null);
    setLocating(true);
    if (!navigator.geolocation) {
      setError(
        'Location is not available in this browser. Enter campus coordinates manually.',
      );
      setLocating(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (fix) => {
        setLatitude(fix.coords.latitude.toFixed(6));
        setLongitude(fix.coords.longitude.toFixed(6));
        setLocating(false);
        setSaved(false);
      },
      () => {
        setError(
          'Allow browser location or enter your campus centre manually.',
        );
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  };
  const save = async () => {
    setError(null);
    setSaved(false);
    setBusy(true);
    try {
      const lat = Number(latitude),
        lng = Number(longitude),
        r = Number(radius);
      if (
        enabled &&
        (!latitude.trim() ||
          !longitude.trim() ||
          !Number.isFinite(lat) ||
          !Number.isFinite(lng) ||
          Math.abs(lat) > 90 ||
          Math.abs(lng) > 180 ||
          !Number.isInteger(r) ||
          r < 25 ||
          r > 5000)
      )
        throw new Error(
          'Enter valid coordinates and a radius from 25 to 5,000 m.',
        );
      const policy: GeofencePolicy = enabled
        ? { enabled: true, latitude: lat, longitude: lng, radiusM: r }
        : { enabled: false };
      await saveClassGeofence(classItem.id, policy);
      onSaved(policy);
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save campus rules.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="space-y-4">
      <label className="flex items-center justify-between gap-4">
        <span>
          <span className="block text-sm font-medium">
            Campus-only check-in
          </span>
          <span className="block text-xs text-slate-400 mt-1">
            Apply a circular attendance boundary to this class.
          </span>
        </span>
        <input
          aria-label="Campus-only check-in"
          type="checkbox"
          checked={enabled}
          onChange={(e) => {
            setEnabled(e.target.checked);
            setSaved(false);
          }}
          className="h-4 w-4 accent-indigo-300"
        />
      </label>
      {enabled && (
        <>
          <div className="flex items-center gap-4 rounded-xl bg-[#142638] border border-[#2a4158] p-4">
            <div className="w-16 h-16 rounded-full border border-dashed border-emerald-400/50 flex items-center justify-center shrink-0">
              <div className="w-8 h-8 rounded-full bg-emerald-400/10 flex items-center justify-center">
                <MapPin size={17} className="text-emerald-300" />
              </div>
            </div>
            <div>
              <p className="text-xs text-slate-200">
                Campus radius: {radius || '—'} m
              </p>
              <p className="text-[11px] text-slate-400 mt-1">
                Choose a centre inside campus and keep the circle within its
                boundary.
              </p>
            </div>
          </div>
          <div className="field-grid">
            <label className="field">
              Centre latitude
              <input
                aria-label="Campus latitude"
                type="number"
                step="any"
                min="-90"
                max="90"
                value={latitude}
                onChange={(e) => {
                  setLatitude(e.target.value);
                  setSaved(false);
                }}
                placeholder="e.g. 12.971600"
              />
            </label>
            <label className="field">
              Centre longitude
              <input
                aria-label="Campus longitude"
                type="number"
                step="any"
                min="-180"
                max="180"
                value={longitude}
                onChange={(e) => {
                  setLongitude(e.target.value);
                  setSaved(false);
                }}
                placeholder="e.g. 77.594600"
              />
            </label>
            <label className="field">
              Radius (metres)
              <input
                aria-label="Campus radius"
                type="number"
                min="25"
                max="5000"
                step="25"
                value={radius}
                onChange={(e) => {
                  setRadius(e.target.value);
                  setSaved(false);
                }}
              />
            </label>
          </div>
          <button
            className="p-button secondary small"
            disabled={locating || busy}
            onClick={locate}
          >
            <LocateFixed size={13} />
            {locating ? 'Getting location…' : 'Use my location as centre'}
          </button>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            Restricted classes require the mobile app. Location and reported
            mock-GPS status are checked at scan and submission. GPS uncertainty
            must fit inside the boundary. Device reports cannot guarantee
            genuine GPS; Developer Options status is unavailable on current
            operating systems.
          </p>
        </>
      )}
      {error && (
        <p role="alert" className="text-xs text-red-300">
          {error}
        </p>
      )}
      {saved && (
        <p role="status" className="text-xs text-emerald-300">
          Campus check-in rules saved.
        </p>
      )}
      <button
        className="p-button small"
        disabled={busy || locating}
        onClick={save}
      >
        <Save size={13} />
        {busy ? 'Saving…' : 'Save campus rules'}
      </button>
    </div>
  );
}
