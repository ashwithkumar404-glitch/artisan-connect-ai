import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from './supabaseClient';

const AuthContext = createContext({});

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [artisan, setArtisan] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchUserData = async (userId) => {
    try {
      // 1. Fetch user profile
      const { data: profData, error: profErr } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (profErr) {
        console.error('Error fetching user profile:', profErr.message);
        setProfile(null);
      } else {
        setProfile(profData);
      }

      // 2. Fetch artisan record
      const { data: artData, error: artErr } = await supabase
        .from('artisans')
        .select('*')
        .eq('profile_id', userId)
        .maybeSingle();

      if (artErr) {
        console.error('Error fetching artisan record:', artErr.message);
        setArtisan(null);
      } else {
        setArtisan(artData);
      }
    } catch (err) {
      console.error('Unexpected error fetching user data:', err);
      setProfile(null);
      setArtisan(null);
    }
  };

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return;
      if (session?.user) {
        setUser(session.user);
        fetchUserData(session.user.id).then(() => {
          if (mounted) setLoading(false);
        });
      } else {
        setUser(null);
        setProfile(null);
        setArtisan(null);
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!mounted) return;
      if (session?.user) {
        setUser(session.user);
        await fetchUserData(session.user.id);
      } else {
        setUser(null);
        setProfile(null);
        setArtisan(null);
      }
      setLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const refreshProfile = async () => {
    if (user) {
      await fetchUserData(user.id);
    }
  };

  const signIn = async (email, password) => {
    return await supabase.auth.signInWithPassword({ email, password });
  };

  const signUp = async (email, password, metadata) => {
    return await supabase.auth.signUp({
      email,
      password,
      options: { data: metadata }
    });
  };

  const signOut = async () => {
    return await supabase.auth.signOut();
  };

  const value = {
    user,
    profile,
    artisan,
    loading,
    refreshProfile,
    signIn,
    signUp,
    signOut
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
