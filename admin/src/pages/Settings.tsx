import { useEffect, useRef, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import {
  useGetCurrentOrganizationQuery,
  useUpdateOrganizationMutation,
  useUploadOrgLogoMutation,
  useRemoveOrgLogoMutation,
  useUploadOrgFaviconMutation,
  useRemoveOrgFaviconMutation,
} from "../store/endpoints/organizationsApi";
import { useGetConfigQuery } from "../store/endpoints/configApi";
import { useDeleteMyAccountMutation } from "../store/endpoints/profileApi";
import { useAppDispatch } from "../store/hooks";
import { clearCredentials } from "../store/authSlice";
import { showSuccess, showError } from "../lib/toast";
import { phone as validatePhone } from "../lib/validation";
import { useDialog } from "../components/ui/DialogProvider";
import Loader from "../components/Loader";
import EmailTab from "./settings/EmailTab";
import PasswordForm from "../components/PasswordForm";
import Select from "../components/ui/Select";
import {
  TIMEZONES,
  TIME_FORMATS,
  fmtDateTime,
  setLocaleSettings,
  timezoneLabel,
} from "../lib/datetime";
import { useAuth } from "../store/useAuth";
import { accountSettingsOnly } from "../lib/access";
import PhoneInput from "../components/ui/PhoneInput";
import { TrashIcon } from "../components/icons";

function errMsg(err: unknown): string {
  return (
    (err as { message?: string })?.message ??
    "Something went wrong. Please try again."
  );
}

type Tab = "organization" | "branding" | "email" | "password" | "danger";

const BRANDING_MAX = 5 * 1024 * 1024;

export default function Settings() {
  const { user } = useAuth();
  // A program administrator has their own account here, not the organization.
  const accountOnly = accountSettingsOnly(user?.role);
  const [tab, setTab] = useState<Tab>(accountOnly ? "password" : "organization");

  const { data: config } = useGetConfigQuery();
  const saasEnabled = config?.saasEnabled ?? false;

  const { data: org, isLoading, isError } = useGetCurrentOrganizationQuery(
    undefined,
    { skip: accountOnly }
  );

  if (isLoading && !accountOnly) {
    return <Loader variant="fullPage" message="Loading settings..." />;
  }

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="mt-1 text-sm text-gray-500">
          {accountOnly
            ? "Manage your account."
            : "Manage your organization and account."}
          {!accountOnly &&
            !saasEnabled &&
            " The platform is running in single-organization mode."}
        </p>
      </div>

      {/* The tabs scroll sideways on a phone instead of pushing the page
          across: five of them do not fit 320px. */}
      <div className="-mx-1 flex gap-1 overflow-x-auto border-b border-gray-300 px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {!accountOnly && (
          <>
            <TabButton
              active={tab === "organization"}
              onClick={() => setTab("organization")}
            >
              Organization
            </TabButton>
            <TabButton active={tab === "branding"} onClick={() => setTab("branding")}>
              Branding
            </TabButton>
            {/* Mail credentials let whoever holds them send as the platform,
                so they stay with the platform team. */}
            <TabButton active={tab === "email"} onClick={() => setTab("email")}>
              Email
            </TabButton>
          </>
        )}
        <TabButton active={tab === "password"} onClick={() => setTab("password")}>
          Password
        </TabButton>
        {/* Everyone who signs into the panel can close their own account. */}
        <TabButton active={tab === "danger"} onClick={() => setTab("danger")} danger>
          Delete account
        </TabButton>
      </div>

      {tab === "password" ? (
        <div className="card p-6 sm:p-8">
          <h2 className="text-base font-bold text-gray-900">Change password</h2>
          <p className="mt-1 text-sm text-gray-500">
            Enter your current password and choose a new one.
          </p>
          <div className="mt-5">
            <PasswordForm />
          </div>
        </div>
      ) : tab === "organization" ? (
        <OrganizationTab org={org} isError={isError} />
      ) : tab === "branding" ? (
        <BrandingTab org={org} isError={isError} />
      ) : tab === "email" ? (
        <EmailTab />
      ) : (
        <DangerTab />
      )}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  danger = false,
  children,
}: {
  active: boolean;
  onClick: () => void;
  danger?: boolean;
  children: React.ReactNode;
}) {
  const activeColor = danger ? "text-danger border-danger" : "text-primary border-primary";
  return (
    <button
      onClick={onClick}
      className={`-mb-px shrink-0 whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors ${
        active
          ? activeColor
          : "border-transparent text-gray-500 hover:text-gray-800"
      }`}
    >
      {children}
    </button>
  );
}

function OrganizationTab({
  org,
  isError,
}: {
  org: ReturnType<typeof useGetCurrentOrganizationQuery>["data"];
  isError: boolean;
}) {
  const [updateOrganization, { isLoading: saving }] =
    useUpdateOrganizationMutation();

  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contactHours, setContactHours] = useState("");
  const [address, setAddress] = useState("");
  const [description, setDescription] = useState("");
  // How every date and time in the panel is shown.
  const [timezone, setTimezone] = useState("America/Chicago");
  const [timeFormat, setTimeFormat] = useState<"12h" | "24h">("12h");

  useEffect(() => {
    if (org) {
      setName(org.name);
      setCode(org.code);
      setContactEmail(org.contact_email ?? "");
      setContactPhone(org.contact_phone ?? "");
      setContactHours(org.contact_hours ?? "");
      setAddress(org.address ?? "");
      setDescription(org.description ?? "");
      setTimezone(org.timezone ?? "America/Chicago");
      setTimeFormat((org.time_format as "12h" | "24h") ?? "12h");
    }
  }, [org]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!org) return;
    if (!name.trim()) return showError("Organization name is required.");
    if (!code.trim()) return showError("Organization code is required.");
    const phoneErr = validatePhone(contactPhone, { label: "Contact phone" });
    if (phoneErr) return showError(phoneErr);

    try {
      await updateOrganization({
        id: org.id,
        body: {
          name: name.trim(),
          code: code.trim(),
          contactEmail: contactEmail.trim() || undefined,
          contactPhone: contactPhone.trim() || undefined,
          contactHours: contactHours.trim() || undefined,
          address: address.trim() || undefined,
          description: description.trim() || undefined,
          timezone,
          timeFormat,
        },
      }).unwrap();
      // Applied at once, so the dates on screen change with the setting.
      setLocaleSettings({ timezone, timeFormat });
      showSuccess("Organization details updated.");
    } catch (err) {
      showError(errMsg(err));
    }
  }

  if (isError || !org) {
    return (
      <div className="card p-8 text-center">
        <p className="text-gray-600">
          No organization is set up yet. Once an organization exists, its details
          can be edited here.
        </p>
      </div>
    );
  }

  return (
    <div className="card p-6 sm:p-8">
      <h2 className="mb-5 text-sm font-semibold text-gray-900">
        Organization details
      </h2>
      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label htmlFor="name" className="label">
              Organization name <span className="text-danger">*</span>
            </label>
            <input
              id="name"
              className="input-field"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={150}
              required
            />
          </div>
          <div>
            <label htmlFor="code" className="label">
              Code <span className="text-danger">*</span>
            </label>
            <input
              id="code"
              className="input-field font-mono uppercase"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              maxLength={50}
              required
            />
          </div>
        </div>

        <div>
          <label htmlFor="description" className="label">
            Description
          </label>
          <textarea
            id="description"
            className="input-field min-h-[80px]"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={500}
            placeholder="Short description of the organization"
          />
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label htmlFor="contactEmail" className="label">
              Contact email
            </label>
            <input
              id="contactEmail"
              type="email"
              className="input-field"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              maxLength={255}
              placeholder="info@example.org"
            />
          </div>
          <div>
            <label htmlFor="contactPhone" className="label">
              Contact phone
            </label>
            <PhoneInput
              id="contactPhone"
              value={contactPhone}
              onChange={setContactPhone}
              placeholder="Enter phone number"
            />
          </div>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label htmlFor="address" className="label">
              Address
            </label>
            <input
              id="address"
              className="input-field"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              maxLength={500}
              placeholder="City, State"
            />
          </div>
          <div>
            <label htmlFor="contactHours" className="label">
              Office hours
            </label>
            <input
              id="contactHours"
              className="input-field"
              value={contactHours}
              onChange={(e) => setContactHours(e.target.value)}
              maxLength={200}
              placeholder="Mon to Fri, 9am to 5pm"
            />
          </div>
        </div>

        <p className="rounded-lg bg-gray-100 px-4 py-3 text-xs text-gray-500">
          The contact email, phone and office hours above are what the mobile
          app shows on its contact screen. Leave a field empty and the app
          falls back to its built-in default.
        </p>

        {/* One clock for everyone: every date and time in the panel, in emails
            and on contracts is shown this way, whatever machine it is read on. */}
        <div className="border-t border-gray-300 pt-5">
          <h3 className="text-sm font-semibold text-gray-900">Dates and times</h3>
          <p className="mt-1 text-xs text-gray-500">
            Everything in the panel, in emails and on contracts is shown in this
            timezone and on this clock. It is {timezoneLabel()} right now:{" "}
            <span className="font-semibold text-gray-700">{fmtDateTime(new Date())}</span>.
          </p>
          <div className="mt-4 grid gap-5 sm:grid-cols-2">
            <div>
              <label className="label">Timezone</label>
              <Select
                value={timezone}
                onChange={setTimezone}
                options={TIMEZONES}
                placeholder="Choose a timezone"
              />
            </div>
            <div>
              <label className="label">Time format</label>
              <Select
                value={timeFormat}
                onChange={(v) => setTimeFormat(v as "12h" | "24h")}
                options={TIME_FORMATS}
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? "Saving..." : "Save changes"}
          </button>
        </div>
      </form>
    </div>
  );
}

function BrandingTab({
  org,
  isError,
}: {
  org: ReturnType<typeof useGetCurrentOrganizationQuery>["data"];
  isError: boolean;
}) {
  if (isError || !org) {
    return (
      <div className="card p-8 text-center">
        <p className="text-gray-600">
          No organization is set up yet. Once an organization exists, its logo
          and favicon can be uploaded here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <BrandingItem
        orgId={org.id}
        kind="logo"
        title="Logo"
        specs={[
          "Recommended: 200 x 50 px (wide)",
          "Max size shown: 512 x 256 px",
          "PNG, JPG, WEBP or SVG - transparent PNG looks best",
          "Up to 5 MB",
        ]}
        note="If you remove it, the default app logo is shown."
        url={org.logo_url}
        preview="wide"
      />
      <BrandingItem
        orgId={org.id}
        kind="favicon"
        title="Favicon"
        specs={[
          "Recommended: 64 x 64 px, square",
          "Larger square images are cropped to 64 x 64",
          "PNG or SVG",
          "Up to 5 MB",
        ]}
        note="Used as the browser-tab icon and the app loading icon. If you remove it, the default icon is shown."
        url={org.favicon_url}
        preview="square"
      />
    </div>
  );
}

function BrandingItem({
  orgId,
  kind,
  title,
  specs,
  note,
  url,
  preview,
}: {
  orgId: string;
  kind: "logo" | "favicon";
  title: string;
  specs: string[];
  note: string;
  url: string | null;
  preview: "wide" | "square";
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploadLogo, logoState] = useUploadOrgLogoMutation();
  const [removeLogo, removeLogoState] = useRemoveOrgLogoMutation();
  const [uploadFavicon, faviconState] = useUploadOrgFaviconMutation();
  const [removeFavicon, removeFaviconState] = useRemoveOrgFaviconMutation();

  const uploading = kind === "logo" ? logoState.isLoading : faviconState.isLoading;
  const removing =
    kind === "logo" ? removeLogoState.isLoading : removeFaviconState.isLoading;
  const busy = uploading || removing;

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      showError("Please choose an image file.");
      return;
    }
    if (file.size > BRANDING_MAX) {
      showError("The image must be 5 MB or smaller.");
      return;
    }
    const form = new FormData();
    form.append("file", file, file.name);
    try {
      if (kind === "logo") await uploadLogo({ id: orgId, file: form }).unwrap();
      else await uploadFavicon({ id: orgId, file: form }).unwrap();
      showSuccess(`${title} updated.`);
    } catch (err) {
      showError(errMsg(err));
    }
  }

  async function onRemove() {
    try {
      if (kind === "logo") await removeLogo(orgId).unwrap();
      else await removeFavicon(orgId).unwrap();
      showSuccess(`${title} removed.`);
    } catch (err) {
      showError(errMsg(err));
    }
  }

  return (
    <div className="card p-6 sm:p-8">
      <h2 className="mb-4 text-sm font-semibold text-gray-900">{title}</h2>
      <div className="flex items-center gap-4">
        {url ? (
          <img
            src={url}
            alt={title}
            className={
              preview === "square"
                ? "h-16 w-16 rounded-lg border border-gray-200 object-cover"
                : "h-16 w-32 rounded-lg border border-gray-200 bg-gray-50 object-contain p-1"
            }
          />
        ) : (
          <span
            className={`grid place-items-center rounded-lg border border-dashed border-gray-300 bg-gray-50 text-xs text-gray-400 ${
              preview === "square" ? "h-16 w-16" : "h-16 w-32"
            }`}
          >
            None
          </span>
        )}
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={busy}
              className="btn-secondary text-sm"
            >
              {uploading ? "Uploading..." : url ? "Replace" : "Upload"}
            </button>
            {url && (
              <button
                type="button"
                onClick={onRemove}
                disabled={busy}
                className="text-sm font-medium text-danger hover:underline disabled:opacity-50"
              >
                {removing ? "Removing..." : "Remove"}
              </button>
            )}
          </div>
          <ul className="mt-1 space-y-0.5 text-xs text-gray-500">
            {specs.map((s) => (
              <li key={s} className="flex items-center gap-1.5">
                <span className="h-1 w-1 rounded-full bg-gray-400" />
                {s}
              </li>
            ))}
          </ul>
          <p className="text-xs text-gray-400">{note}</p>
        </div>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={onFile}
      />
    </div>
  );
}

function DangerTab() {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { confirm } = useDialog();
  const [deleteMyAccount, { isLoading }] = useDeleteMyAccountMutation();

  async function handleDelete() {
    const ok = await confirm({
      title: "Delete your account?",
      message:
        "Your account will be deleted and you'll be signed out immediately. " +
        "This can only be undone by contacting support.",
      confirmLabel: "Delete my account",
      tone: "danger",
    });
    if (!ok) return;

    try {
      await deleteMyAccount().unwrap();
      dispatch(clearCredentials());
      showSuccess("Your account has been deleted.");
      navigate("/login", { replace: true });
    } catch (err) {
      showError(errMsg(err));
    }
  }

  return (
    <div className="card border-danger/30 p-6 sm:p-8">
      <h2 className="text-sm font-semibold text-danger">Delete your account</h2>
      <p className="mt-2 text-sm text-gray-600">
        Permanently remove your account. You will be signed out immediately and
        will no longer be able to log in. This action can only be reversed by
        contacting support.
      </p>
      <div className="mt-5">
        <button
          onClick={handleDelete}
          disabled={isLoading}
          className="btn-danger"
        >
          <TrashIcon width={16} height={16} />
          {isLoading ? "Deleting..." : "Delete my account"}
        </button>
      </div>
    </div>
  );
}
