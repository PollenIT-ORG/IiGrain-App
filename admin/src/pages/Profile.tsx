import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import {
  useGetMyProfileQuery,
  useUpdateMyProfileMutation,
} from "../store/endpoints/profileApi";
import { showSuccess, showError } from "../lib/toast";
import Loader from "../components/Loader";
import PhoneInput from "../components/ui/PhoneInput";
import AvatarUpload from "../components/AvatarUpload";
import { ROLE_LABELS, type UserRole } from "../types";

function errMsg(err: unknown): string {
  return (
    (err as { message?: string })?.message ??
    "Something went wrong. Please try again."
  );
}

export default function Profile() {
  const { data: user, isLoading: loading } = useGetMyProfileQuery();
  const [updateMyProfile, { isLoading: saving }] =
    useUpdateMyProfileMutation();

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");

  useEffect(() => {
    if (user) {
      setFullName(user.full_name ?? "");
      setPhone(user.phone ?? "");
    }
  }, [user]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    try {
      await updateMyProfile({
        fullName: fullName.trim(),
        phone: phone.trim(),
      }).unwrap();
      showSuccess("Profile updated.");
    } catch (err) {
      showError(errMsg(err));
    }
  }

  if (loading) return <Loader variant="fullPage" message="Loading profile..." />;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">My profile</h1>
        <p className="mt-1 text-sm text-gray-500">
          View and update your account details.
        </p>
      </div>

      <div className="card space-y-5 p-6">
        <AvatarUpload
          avatarUrl={user?.avatar_url ?? null}
          name={user?.full_name || user?.email || "A"}
        />
        <div>
          <p className="text-base font-semibold text-gray-900">
            {user?.full_name || "Administrator"}
          </p>
          <p className="text-sm text-gray-500">{user?.email}</p>
          <span className="mt-1 inline-flex rounded-md bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
            {ROLE_LABELS[user?.role as UserRole] ?? user?.role}
          </span>
        </div>
      </div>

      <div className="card p-6 sm:p-8">
        <h2 className="mb-5 text-base font-semibold text-gray-900">
          Account details
        </h2>
        <form onSubmit={handleSubmit} className="space-y-5" noValidate>
          <div>
            <label htmlFor="fullName" className="label">
              Full name
            </label>
            <input
              id="fullName"
              className="input-field"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              maxLength={100}
              required
            />
          </div>

          <div>
            <label className="label">Email address</label>
            <input
              className="input-field bg-gray-100 text-gray-500"
              value={user?.email ?? ""}
              disabled
            />
          </div>

          <div>
            <label htmlFor="phone" className="label">
              Mobile number
            </label>
            <PhoneInput id="phone" value={phone} onChange={setPhone} />
          </div>

          <div className="flex items-center justify-between pt-2">
            <Link
              to="/profile/change-password"
              className="text-sm font-medium text-primary hover:text-primary-dark"
            >
              Change password
            </Link>
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? "Saving..." : "Save changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
