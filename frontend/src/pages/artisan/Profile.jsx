import React, { useState } from 'react';
import Button from '../../components/Button';

export default function Profile() {
  const [profileData, setProfileData] = useState({
    shopName: 'Traditional Crafts Workshop',
    about: 'We create handmade bamboo craft and natural weaves using methods passed down through generations.',
    experience: '12 Years',
    award: 'District Crafts Award (2023)',
    state: 'Andhra Pradesh',
    district: 'NTR District'
  });

  const handleInputChange = (e) => {
    const { id, value } = e.target;
    setProfileData((prev) => ({
      ...prev,
      [id]: value
    }));
  };

  const handleSave = (e) => {
    e.preventDefault();
    alert('Shop Profile Updated (Mock Action)!');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="border-b border-slate-200 pb-4">
        <h2 className="text-xl font-bold text-gov-navy m-0">Shop Profile</h2>
        <p className="text-sm text-slate-500 mt-1">Manage details shown to customers on the public marketplace.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Form Column */}
        <div className="lg:col-span-2">
          <form onSubmit={handleSave} className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm space-y-4">
            {/* Shop Name */}
            <div className="space-y-1.5">
              <label htmlFor="shopName" className="block text-sm font-bold text-slate-700">
                Shop Name / Workshop Label
              </label>
              <input
                id="shopName"
                type="text"
                required
                value={profileData.shopName}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-slate-350 rounded focus:ring-2 focus:ring-gov-navy focus:border-gov-navy"
              />
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
                value={profileData.about}
                onChange={handleInputChange}
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
                type="text"
                required
                value={profileData.experience}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-slate-350 rounded focus:ring-2 focus:ring-gov-navy focus:border-gov-navy"
              />
            </div>

            {/* Awards / Achievements */}
            <div className="space-y-1.5">
              <label htmlFor="award" className="block text-sm font-bold text-slate-700">
                Awards or Recognition (If any)
              </label>
              <input
                id="award"
                type="text"
                value={profileData.award}
                onChange={handleInputChange}
                placeholder="e.g. State Handicraft Board Award"
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
                  required
                  value={profileData.district}
                  onChange={handleInputChange}
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
                  value={profileData.state}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-slate-350 rounded focus:ring-2 focus:ring-gov-navy focus:border-gov-navy"
                />
              </div>
            </div>

            <Button type="submit" variant="primary" className="font-bold w-full sm:w-auto mt-2">
              Save Profile Changes
            </Button>
          </form>
        </div>

        {/* Display Side Card */}
        <div>
          <div className="bg-slate-100 border border-slate-200 rounded-lg p-5 space-y-4">
            <h3 className="font-bold text-gov-navy m-0 text-sm">Profile Visibility</h3>
            <p className="text-xs text-slate-655 leading-relaxed">
              These details are publicly available on the marketplace. Verified craft experience and awards build customer confidence in your products.
            </p>
            <div className="border border-slate-300 rounded p-4 bg-white space-y-2">
              <h4 className="font-bold text-slate-800 text-sm m-0">{profileData.shopName}</h4>
              <p className="text-xs text-slate-500 font-semibold">{profileData.district}, {profileData.state}</p>
              <hr className="border-slate-150" />
              <p className="text-xs text-slate-600 italic">"{profileData.about}"</p>
              <div className="text-[10px] text-emerald-800 font-bold bg-emerald-50 px-2 py-1 rounded inline-block mt-2">
                🏅 {profileData.award || 'No award proof submitted'}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
