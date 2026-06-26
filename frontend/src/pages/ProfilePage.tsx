import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../lib/auth";

export default function ProfilePage() {
  const { user, profile, saveProfile, signOut } = useAuth();
  const [name, setName] = useState(profile?.displayName ?? "");
  const [phone, setPhone] = useState(profile?.phone ?? "");
  const [city, setCity] = useState(profile?.jurisdiction ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  if (!user) {
    return (
      <div className="empty">
        <p>Sign in to view your profile.</p>
        <Link to="/login" className="btn btn-primary">
          Sign in
        </Link>
      </div>
    );
  }

  const initial = (profile?.displayName || name || "C").charAt(0).toUpperCase();

  async function save() {
    setSaving(true);
    setSaved(false);
    try {
      await saveProfile({
        displayName: name.trim() || "Citizen",
        phone: phone.trim(),
        jurisdiction: city.trim(),
      });
      setSaved(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="profile-page card">
      <div className="profile-head">
        {profile?.photoURL ? (
          <img className="avatar" src={profile.photoURL} alt="" />
        ) : (
          <div className="avatar avatar-initial">{initial}</div>
        )}
        <div>
          <h1>{profile?.displayName || "Your profile"}</h1>
          <p className="muted small">
            {user.isAnonymous ? "Anonymous account" : user.email}
          </p>
        </div>
      </div>

      <div className="field">
        <label>Display name</label>
        <input
          className="input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your name"
        />
      </div>

      <div className="field">
        <label>Phone (optional)</label>
        <input
          className="input"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="Leave blank to stay private"
        />
      </div>

      <div className="field">
        <label>Home city (optional)</label>
        <input
          className="input"
          value={city}
          onChange={(e) => setCity(e.target.value)}
          placeholder="e.g. Bengaluru — centres your map"
        />
      </div>

      {user.isAnonymous && (
        <p className="muted small">
          You're browsing anonymously — only a display name is stored, no email or phone
          required.
        </p>
      )}

      <div className="row gap">
        <button className="btn btn-primary" disabled={saving} onClick={() => void save()}>
          {saving ? "Saving…" : "Save"}
        </button>
        {saved && <span className="muted small">✓ Saved</span>}
      </div>

      <hr className="sep" />
      <button className="btn btn-ghost" onClick={() => void signOut()}>
        Sign out
      </button>
    </div>
  );
}
