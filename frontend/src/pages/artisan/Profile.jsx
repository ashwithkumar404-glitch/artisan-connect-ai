import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../lib/AuthContext';
import { supabase } from '../../lib/supabaseClient';
import Button from '../../components/Button';

export default function Profile() {
  const { user, profile, loading: authLoading, refreshProfile } = useAuth();
  const navigate = useNavigate();

  // Local form states
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  
  const [shopName, setShopName] = useState('');
  const [about, setAbout] = useState('');
  const [experience, setExperience] = useState('');
  const [category, setCategory] = useState('Bamboo & Natural Craft');
  const [district, setDistrict] = useState('');
  const [state, setState] = useState('');
  const [verificationStatus, setVerificationStatus] = useState('pending');

  const [isLoading, setIsLoading] = useState(true);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Initial loaded states to optimize updates
  const [initialProfile, setInitialProfile] = useState({});
  const [initialArtisan, setInitialArtisan] = useState({});

  useEffect(() => {
    async function loadArtisanProfile() {
      if (!user) return;
      setIsLoading(true);
      setSubmitError('');

      try {
        let loadedFullName = '';
        let loadedPhone = '';

        if (profile) {
          loadedFullName = profile.full_name || '';
          loadedPhone = profile.phone || '';
          setFullName(loadedFullName);
          setPhone(loadedPhone);
        }

        console.log("Fetching artisan profile from Supabase...");
        const { data: artisan, error } = await supabase
          .from('artisans')
          .select('*')
          .eq('profile_id', user.id)
          .maybeSingle();

        if (error) {
          console.error("Artisan fetch error:", error);
          setSubmitError('Shop profile details could not be loaded from database.');
        } else if (artisan) {
          const loadedShopName = artisan.business_name || '';
          const loadedAbout = artisan.bio || '';
          const loadedExperience = artisan.experience_years ? artisan.experience_years.toString() : '';
          const loadedCategory = artisan.specialization || 'Bamboo & Natural Craft';
          const loadedStatus = artisan.verification_status || 'pending';

          setShopName(loadedShopName);
          setAbout(loadedAbout);
          setExperience(loadedExperience);
          setCategory(loadedCategory);
          setVerificationStatus(loadedStatus);

          // Parse location safely
          const locationVal = artisan.location || '';
          const commaIndex = locationVal.indexOf(',');
          let loadedDistrict = '';
          let loadedState = '';
          if (commaIndex !== -1) {
            loadedDistrict = locationVal.substring(0, commaIndex).trim();
            loadedState = locationVal.substring(commaIndex + 1).trim();
          } else {
            loadedState = locationVal.trim();
          }

          setDistrict(loadedDistrict);
          setState(loadedState);

          // Record initial values
          setInitialProfile({
            full_name: loadedFullName,
            phone: loadedPhone
          });
          setInitialArtisan({
            business_name: loadedShopName,
            bio: loadedAbout,
            experience_years: loadedExperience,
            specialization: loadedCategory,
            district: loadedDistrict,
            state: loadedState
          });
        }
        setHasLoaded(true);
      } catch (err) {
        console.error("Exception loading artisan details:", err);
        setSubmitError(err.message || 'An unexpected error occurred while loading profile details.');
      } finally {
        setIsLoading(false);
      }
    }

    if (user && profile && !hasLoaded) {
      loadArtisanProfile();
    } else if (!user && !authLoading) {
      setIsLoading(false);
    }
  }, [user, profile, authLoading, hasLoaded]);

  const handleSave = async (e) => {
    e.preventDefault();
    setSubmitError('');
    setSuccessMessage('');

    const trimmedFullName = fullName.trim();
    const trimmedPhone = phone.trim();
    const trimmedShopName = shopName.trim();
    const trimmedAbout = about.trim();
    const trimmedExperience = experience.trim();
    const trimmedDistrict = district.trim();
    const trimmedState = state.trim();

    // Check if profile fields changed
    const profileChanged = 
      trimmedFullName !== initialProfile.full_name || 
      trimmedPhone !== initialProfile.phone;

    // Check if artisan fields changed
    const artisanChanged = 
      trimmedShopName !== initialArtisan.business_name ||
      trimmedAbout !== initialArtisan.bio ||
      trimmedExperience !== initialArtisan.experience_years ||
      category !== initialArtisan.specialization ||
      trimmedDistrict !== initialArtisan.district ||
      trimmedState !== initialArtisan.state;

    if (!profileChanged && !artisanChanged) {
      setSuccessMessage('No changes to save.');
      return;
    }

    setIsSubmitting(true);

    try {
      // 1. Update public.profiles if fields changed
      if (profileChanged) {
        console.log("Updating profiles table...");
        const { error: pError } = await supabase
          .from('profiles')
          .update({
            full_name: trimmedFullName || null,
            phone: trimmedPhone || null
          })
          .eq('id', user.id);

        if (pError) throw pError;
      }

      // 2. Update public.artisans if fields changed
      if (artisanChanged) {
        console.log("Updating artisans table...");
        // Combine location safely
        let locationCombined = '';
        if (trimmedDistrict && trimmedState) {
          locationCombined = `${trimmedDistrict}, ${trimmedState}`;
        } else {
          locationCombined = trimmedState || trimmedDistrict;
        }

        const { error: aError } = await supabase
          .from('artisans')
          .upsert({
            profile_id: user.id,
            business_name: trimmedShopName || null,
            bio: trimmedAbout || null,
            experience_years: parseInt(trimmedExperience, 10) || null,
            specialization: category,
            location: locationCombined || null
          }, { onConflict: 'profile_id' });

        if (aError) throw aError;
      }

      // Refresh global context profile
      await refreshProfile();

      // Update initial values state
      setInitialProfile({
        full_name: trimmedFullName,
        phone: trimmedPhone
      });
      setInitialArtisan({
        business_name: trimmedShopName,
        bio: trimmedAbout,
        experience_years: trimmedExperience,
        specialization: category,
        district: trimmedDistrict,
        state: trimmedState
      });

      setSuccessMessage('Shop Profile updated successfully!');
      setTimeout(() => {
        navigate('/artisan');
      }, 1500);
    } catch (err) {
      console.error("Save profile error:", err);
      setSubmitError(err.message || 'Failed to save profile changes. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Helper to render verification status label/styling
  const getStatusBadge = () => {
    switch (verificationStatus.toLowerCase()) {
      case 'approved':
        return (
          <span className="px-2.5 py-1 text-xs font-bold bg-emerald-100 text-emerald-800 rounded border border-emerald-200">
            Approved / Certified
          </span>
        );
      case 'rejected':
        return (
          <span className="px-2.5 py-1 text-xs font-bold bg-red-100 text-red-800 rounded border border-red-200">
            Rejected
          </span>
        );
      case 'under_review':
      case 'under review':
      case 'reviewing':
        return (
          <span className="px-2.5 py-1 text-xs font-bold bg-amber-100 text-amber-800 rounded border border-amber-200">
            Under Review
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-1 text-xs font-bold bg-yellow-100 text-yellow-800 rounded border border-yellow-200">
            Verification Pending
          </span>
        );
    }
  };

  if (isLoading || authLoading) {
    return (
      <div className="min-h-[400px] flex items-center justify-center">
        <div className="flex flex-col items-center space-y-4">
          <div className="w-10 h-10 border-4 border-gov-navy border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm font-semibold text-slate-655">Loading Shop Profile...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="border-b border-slate-200 pb-4">
        <h2 className="text-xl font-bold text-gov-navy m-0">Shop Profile</h2>
        <p className="text-sm text-slate-500 mt-1">Manage details shown to customers on the public marketplace.</p>
      </div>

      {successMessage && (
        <div className="p-3 bg-emerald-50 text-emerald-800 text-sm font-semibold rounded border border-emerald-100">
          {successMessage}
        </div>
      )}

      {submitError && (
        <div className="p-3 bg-red-50 text-red-800 text-sm font-semibold rounded border border-red-100">
          {submitError}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Form Column */}
        <div className="lg:col-span-2">
          <form onSubmit={handleSave} className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm space-y-4">
            
            {/* Read-Only Account Info */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 p-4 rounded border border-slate-150">
              <div>
                <span className="block text-[11px] font-bold text-slate-500 uppercase">Registered Email</span>
                <span className="text-sm font-semibold text-slate-700">{user?.email}</span>
              </div>
              <div>
                <span className="block text-[11px] font-bold text-slate-500 uppercase">Verification Status</span>
                <div className="mt-1">{getStatusBadge()}</div>
              </div>
            </div>

            <div className="border-t border-slate-100 pt-2"></div>

            <h3 className="text-sm font-bold text-gov-navy uppercase tracking-wider mb-2">Personal Information</h3>

            {/* Personal Name */}
            <div className="space-y-1.5">
              <label htmlFor="fullName" className="block text-sm font-bold text-slate-700">
                Artisan Name (Full Name)
              </label>
              <input
                id="fullName"
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full px-3 py-2 border border-slate-350 rounded focus:ring-2 focus:ring-gov-navy focus:border-gov-navy"
              />
            </div>

            {/* Phone Number */}
            <div className="space-y-1.5">
              <label htmlFor="phone" className="block text-sm font-bold text-slate-700">
                Contact Number (Mobile)
              </label>
              <input
                id="phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder={phone ? "" : "Not Provided"}
                className="w-full px-3 py-2 border border-slate-350 rounded focus:ring-2 focus:ring-gov-navy focus:border-gov-navy"
              />
            </div>

            <div className="border-t border-slate-100 pt-2"></div>

            <h3 className="text-sm font-bold text-gov-navy uppercase tracking-wider mb-2">Shop & Craft Details</h3>

            {/* Shop Name */}
            <div className="space-y-1.5">
              <label htmlFor="shopName" className="block text-sm font-bold text-slate-700">
                Shop Name / Workshop Label
              </label>
              <input
                id="shopName"
                type="text"
                required
                value={shopName}
                onChange={(e) => setShopName(e.target.value)}
                className="w-full px-3 py-2 border border-slate-350 rounded focus:ring-2 focus:ring-gov-navy focus:border-gov-navy"
              />
            </div>

            {/* Craft Specialization Category */}
            <div className="space-y-1.5">
              <label htmlFor="category" className="block text-sm font-bold text-slate-700">
                Primary Craft Specialization
              </label>
              <select
                id="category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2 border border-slate-350 rounded focus:ring-2 focus:ring-gov-navy focus:border-gov-navy"
              >
                <option value="Bamboo & Natural Craft">Bamboo & Natural Craft</option>
                <option value="Handloom & Textiles">Handloom & Textiles</option>
                <option value="Pottery">Pottery</option>
                <option value="Wood Craft">Wood Craft</option>
                <option value="Metal Craft">Metal Craft</option>
                <option value="Jewellery">Jewellery</option>
                <option value="Other Handicrafts">Other Handicrafts</option>
              </select>
            </div>

            {/* Shop About */}
            <div className="space-y-1.5">
              <label htmlFor="about" className="block text-sm font-bold text-slate-700">
                About Your Craft (Biography)
              </label>
              <textarea
                id="about"
                rows="4"
                required
                value={about}
                onChange={(e) => setAbout(e.target.value)}
                className="w-full px-3 py-2 border border-slate-350 rounded focus:ring-2 focus:ring-gov-navy focus:border-gov-navy"
              ></textarea>
            </div>

            {/* Craft Experience */}
            <div className="space-y-1.5">
              <label htmlFor="experience" className="block text-sm font-bold text-slate-700">
                Crafting Experience (Years)
              </label>
              <input
                id="experience"
                type="number"
                required
                min="0"
                value={experience}
                onChange={(e) => setExperience(e.target.value)}
                className="w-full px-3 py-2 border border-slate-350 rounded focus:ring-2 focus:ring-gov-navy focus:border-gov-navy"
              />
            </div>

            {/* Location Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label htmlFor="district" className="block text-sm font-bold text-slate-700">
                  District
                </label>
                <input
                  id="district"
                  type="text"
                  value={district}
                  onChange={(e) => setDistrict(e.target.value)}
                  placeholder="e.g. NTR District"
                  className="w-full px-3 py-2 border border-slate-350 rounded focus:ring-2 focus:ring-gov-navy focus:border-gov-navy"
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="state" className="block text-sm font-bold text-slate-700">
                  State
                </label>
                <input
                  id="state"
                  type="text"
                  required
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  placeholder="e.g. Andhra Pradesh"
                  className="w-full px-3 py-2 border border-slate-350 rounded focus:ring-2 focus:ring-gov-navy focus:border-gov-navy"
                />
              </div>
            </div>

            <Button
              type="submit"
              variant="primary"
              disabled={isSubmitting}
              className="font-bold w-full sm:w-auto mt-2"
            >
              {isSubmitting ? 'Saving Changes...' : 'Save Profile Changes'}
            </Button>
          </form>
        </div>

        {/* Display Side Card */}
        <div>
          <div className="bg-slate-100 border border-slate-200 rounded-lg p-5 space-y-4 sticky top-6">
            <h3 className="font-bold text-gov-navy m-0 text-sm">Profile Visibility</h3>
            <p className="text-xs text-slate-655 leading-relaxed">
              These details are publicly available on the marketplace. Verified craft experience and awards build customer confidence in your products.
            </p>
            <div className="border border-slate-300 rounded p-4 bg-white space-y-2">
              <h4 className="font-bold text-slate-800 text-sm m-0">{shopName || 'Unnamed Workshop'}</h4>
              <p className="text-xs text-slate-500 font-semibold">
                {category} &bull; {district ? `${district}, ` : ''}{state || 'Location not specified'}
              </p>
              <hr className="border-slate-150" />
              <p className="text-xs text-slate-600 italic">
                {about ? `"${about}"` : 'No biography added yet.'}
              </p>
              <div className="text-[10px] text-gov-navy font-bold bg-slate-50 px-2 py-1 rounded inline-block mt-2">
                Experience: {experience ? `${experience} Years` : 'Not Specified'}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
