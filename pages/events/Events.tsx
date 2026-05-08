/**
 * @file Events.tsx
 *
 * Orchestrator component for the Events tab (~220 lines).
 *
 * Provides tournament discovery across three sub-tabs:
 *
 * 1. **Nearby** -- uses browser geolocation to encode a geohash, then queries
 *    Nostr relays for Kind 30003 tournament events matching geohash `g` tag
 *    prefixes. Results are filtered by haversine distance within the selected
 *    radius (10/25/50/100/250 miles) and sorted closest-first.
 *
 * 2. **Friends** -- queries relays for tournaments where any of the user's
 *    contacts or recent players are registered (via `#p` tag filter).
 *    Groups results by tournament with friend names listed.
 *
 * 3. **Mine** -- fetches tournaments the current user has created or registered
 *    for. Shows the active tournament (if any) prominently, plus historical ones.
 *
 * Each sub-tab's data is lazily fetched when the tab activates and cached
 * via refs to prevent redundant relay queries.
 *
 * Navigation: tapping a tournament card sets it as active and navigates to /tournament.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { TournamentSettings } from '../../types';
import { discoverNearbyTournaments, discoverFriendsTournaments, fetchTournament } from '../../services/nostrService';
import { encodeGeohash, geohashPrefixes, haversineDistance } from '../../utils/geohash';
import { EventsTab, RadiusOption, DiscoveredTournament, FriendsTournamentGroup } from './eventsTypes';
import { EventsNearbyView } from './EventsNearbyView';
import { EventsFriendsView } from './EventsFriendsView';
import { EventsMineView } from './EventsMineView';
import { Icons } from '../../components/Icons';
import { isNative } from '../../services/capacitorService';
import {
  getGeolocationUnsupportedMessage,
  getLocationPermissionDeniedMessage,
} from './locationPermissionCopy';

/**
 * Events page orchestrator -- manages geolocation, relay discovery queries,
 * and tab routing for tournament discovery (nearby, friends, mine).
 */
export const Events: React.FC = () => {
  const navigate = useNavigate();
  const {
    currentUserPubkey,
    activeTournament,
    isDirector,
    setActiveTournament,
    recentPlayers,
    contacts,
  } = useApp();

  const [activeTab, setActiveTab] = useState<EventsTab>('nearby');
  const [radius, setRadius] = useState<RadiusOption>(25);

  // Location
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const locationRequested = useRef(false);

  // Nearby
  const [nearbyTournaments, setNearbyTournaments] = useState<DiscoveredTournament[]>([]);
  const [isLoadingNearby, setIsLoadingNearby] = useState(false);

  // Friends
  const [friendsGroups, setFriendsGroups] = useState<FriendsTournamentGroup[]>([]);
  const [isLoadingFriends, setIsLoadingFriends] = useState(false);
  const friendsFetched = useRef(false);

  // Mine
  const [myTournaments, setMyTournaments] = useState<TournamentSettings[]>([]);
  const [isLoadingMine, setIsLoadingMine] = useState(false);
  const mineFetched = useRef(false);

  // --- Geolocation ---
  const requestLocation = useCallback(() => {
    const isNativeRuntime = isNative();

    if (!navigator.geolocation) {
      setLocationError(getGeolocationUnsupportedMessage(isNativeRuntime));
      return;
    }
    locationRequested.current = true;
    setLocationError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          setLocationError(getLocationPermissionDeniedMessage(isNativeRuntime));
        } else {
          setLocationError('Unable to determine your location.');
        }
      },
      { enableHighAccuracy: false, timeout: 10000 }
    );
  }, []);

  // Auto-request location when Nearby tab activates
  useEffect(() => {
    if (activeTab === 'nearby' && !userLocation && !locationError && !locationRequested.current) {
      requestLocation();
    }
  }, [activeTab, userLocation, locationError, requestLocation]);

  // --- Nearby fetch ---
  useEffect(() => {
    if (activeTab !== 'nearby' || !userLocation) return;

    const fetchNearby = async () => {
      setIsLoadingNearby(true);
      try {
        const gh = encodeGeohash(userLocation.lat, userLocation.lng, 6);
        // Radius → geohash precision: 250mi→2, 100mi→2-3, 50mi→3, 25mi→3-4, 10mi→4-5
        const minPrec = radius >= 100 ? 2 : radius >= 25 ? 3 : 4;
        const maxPrec = radius <= 10 ? 5 : radius <= 50 ? 4 : 3;
        const prefixes = geohashPrefixes(gh, minPrec, maxPrec);
        const since = Math.floor(Date.now() / 1000) - (60 * 60 * 24 * 30); // Last 30 days

        const results = await discoverNearbyTournaments(prefixes, since);

        // Compute distances and filter by actual radius
        const withDistance: DiscoveredTournament[] = results
          .filter(t => t.latitude != null && t.longitude != null)
          .map(t => ({
            ...t,
            distanceMiles: haversineDistance(
              userLocation.lat, userLocation.lng,
              t.latitude!, t.longitude!,
            ),
          }))
          .filter(t => t.distanceMiles! <= radius)
          .sort((a, b) => a.distanceMiles! - b.distanceMiles!);

        setNearbyTournaments(withDistance);
      } catch (e) {
        console.warn('Nearby discovery failed:', e);
      } finally {
        setIsLoadingNearby(false);
      }
    };

    fetchNearby();
  }, [activeTab, userLocation, radius]);

  // --- Friends fetch ---
  useEffect(() => {
    if (activeTab !== 'friends' || friendsFetched.current) return;

    const fetchFriends = async () => {
      setIsLoadingFriends(true);
      friendsFetched.current = true;
      try {
        const pubkeys = new Set<string>();
        contacts.forEach(c => pubkeys.add(c.pubkey));
        recentPlayers.forEach(p => pubkeys.add(p.pubkey));
        // Exclude self
        if (currentUserPubkey) pubkeys.delete(currentUserPubkey);

        if (pubkeys.size === 0) {
          setIsLoadingFriends(false);
          return;
        }

        const since = Math.floor(Date.now() / 1000) - (60 * 60 * 24 * 14); // Last 14 days
        const tournaments = await discoverFriendsTournaments(Array.from(pubkeys), since);

        // Group: for each tournament, which friends are registered
        const pubkeySet = pubkeys;
        const nameMap = new Map<string, string>();
        contacts.forEach(c => nameMap.set(c.pubkey, c.name || c.pubkey.slice(0, 8)));
        recentPlayers.forEach(p => nameMap.set(p.pubkey, p.name || p.pubkey.slice(0, 8)));

        const groups: FriendsTournamentGroup[] = tournaments.map(t => {
          const friendPubkeys = t.registeredPlayers.filter(pk => pubkeySet.has(pk));
          const friendNames = friendPubkeys.map(pk => nameMap.get(pk) || pk.slice(0, 8));
          return { tournament: t, friendPubkeys, friendNames };
        }).filter(g => g.friendPubkeys.length > 0);

        setFriendsGroups(groups);
      } catch (e) {
        console.warn('Friends discovery failed:', e);
      } finally {
        setIsLoadingFriends(false);
      }
    };

    fetchFriends();
  }, [activeTab, contacts, recentPlayers, currentUserPubkey]);

  // --- Mine fetch ---
  useEffect(() => {
    if (activeTab !== 'mine' || mineFetched.current || !currentUserPubkey) return;

    const fetchMine = async () => {
      setIsLoadingMine(true);
      mineFetched.current = true;
      try {
        const since = Math.floor(Date.now() / 1000) - (60 * 60 * 24 * 14);
        const tournaments = await discoverFriendsTournaments([currentUserPubkey], since);
        // Filter out the active tournament to avoid duplication
        const filtered = tournaments.filter(t => t.id !== activeTournament?.id);
        setMyTournaments(filtered);
      } catch (e) {
        console.warn('My tournaments fetch failed:', e);
      } finally {
        setIsLoadingMine(false);
      }
    };

    fetchMine();
  }, [activeTab, currentUserPubkey, activeTournament?.id]);

  // --- Navigation ---
  const handleTournamentTap = useCallback((tournament: TournamentSettings) => {
    // If this is the user's active tournament, go straight to it
    if (activeTournament && activeTournament.id === tournament.id) {
      navigate('/tournament');
      return;
    }
    // If the user is registered, set it as active and navigate
    if (currentUserPubkey && tournament.registeredPlayers.includes(currentUserPubkey)) {
      setActiveTournament(tournament);
      navigate('/tournament');
      return;
    }
    // Otherwise, set as active so the lobby view shows (they can register from there)
    setActiveTournament(tournament);
    navigate('/tournament');
  }, [activeTournament, currentUserPubkey, setActiveTournament, navigate]);

  const handleCreateTournament = useCallback(() => {
    navigate('/tournament/create');
  }, [navigate]);

  const tabs: { key: EventsTab; label: string }[] = [
    { key: 'nearby', label: 'Nearby' },
    { key: 'friends', label: 'Friends' },
    { key: 'mine', label: 'Mine' },
  ];

  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col pb-24">
      {/* Header */}
      <div className="p-6 pb-0">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold">Events</h1>
          <button
            onClick={handleCreateTournament}
            className="flex items-center space-x-1.5 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-3 py-1.5 rounded-lg text-sm font-semibold hover:bg-emerald-500/30 transition-colors"
          >
            <Icons.PlusIcon size={16} />
            <span>Create</span>
          </button>
        </div>

        {/* Sub-tabs */}
        <div className="flex bg-slate-800/60 rounded-xl p-1">
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${
                activeTab === tab.key
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="flex-1 p-6 pt-4">
        {activeTab === 'nearby' && (
          <EventsNearbyView
            tournaments={nearbyTournaments}
            isLoading={isLoadingNearby}
            radius={radius}
            setRadius={setRadius}
            userLocation={userLocation}
            locationError={locationError}
            onRequestLocation={requestLocation}
            onTournamentTap={handleTournamentTap}
          />
        )}
        {activeTab === 'friends' && (
          <EventsFriendsView
            groups={friendsGroups}
            isLoading={isLoadingFriends}
            onTournamentTap={handleTournamentTap}
          />
        )}
        {activeTab === 'mine' && (
          <EventsMineView
            activeTournament={activeTournament}
            myTournaments={myTournaments}
            isDirector={isDirector}
            isLoading={isLoadingMine}
            onTournamentTap={handleTournamentTap}
            onCreateTournament={handleCreateTournament}
          />
        )}
      </div>
    </div>
  );
};
