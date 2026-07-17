import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import {
  useGetCurrentOrganizationQuery,
  useUpdateOrganizationMutation,
} from "../store/endpoints/organizationsApi";
import { useGetConfigQuery } from "../store/endpoints/configApi";
import { useDeleteMyAccountMutation } from "../store/endpoints/profileApi";
import { useAppDispatch } from "../store/hooks";
import { clearCredentials } from "../store/authSlice";
import { showSuccess, showError } from "../lib/toast";
import { useDialog } from "../components/ui/DialogProvider";
import Loader from "../components/Loader";
import { TrashIcon } from "../components/icons";

function errMsg(err: unknown): string {
  return (
    (err as { message?: string })?.message ??
    "Something went wrong. Please try again."
  );
}

type Tab = "organization" | "danger";

export default function Settings() {
  const [tab, setTab] = useState<Tab>("organization");

  const { data: config } = useGetConfigQuery();
  const saasEnabled = config?.saasEnabled ?? false;

  const { data: org, isLoading, isError } = useGetCurrentOrganizationQuery();

  if (isLoading) {
    return <Loader variant="fullPage" message="Loading settings..." />;
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="mt-1 text-sm text-gray-500">
          Manage your organization and account.
          {!saasEnabled &&
            " The platform is running in single-organization mode."}
        </p>
      </div>

      <div className="flex gap-1 border-b border-gray-300">
        <TabButton active={tab === "organization"} onClick={() => setTab("organization")}>
          Organization
        </TabButton>
        <TabButton active={tab === "danger"} onClick={() => setTab("danger")} danger>
          Danger
        </TabButton>
      </div>

      {tab === "organization" ? (
        <OrganizationTab
          org={org}
          isError={isError}
        />
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
      className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors ${
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
  const [address, setAddress] = useState("");
  const [description, setDescription] = useState("");

  useEffect(() => {
    if (org) {
      setName(org.name);
      setCode(org.code);
      setContactEmail(org.contact_email ?? "");
      setContactPhone(org.contact_phone ?? "");
      setAddress(org.address ?? "");
      setDescription(org.description ?? "");
    }
  }, [org]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!org) return;
    if (!name.trim()) return showError("Organization name is required.");
    if (!code.trim()) return showError("Organization code is required.");

    try {
      await updateOrganization({
        id: org.id,
        body: {
          name: name.trim(),
          code: code.trim(),
          contactEmail: contactEmail.trim() || undefined,
          contactPhone: contactPhone.trim() || undefined,
          address: address.trim() || undefined,
          description: description.trim() || undefined,
        },
      }).unwrap();
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
            <input
              id="contactPhone"
              className="input-field"
              value={contactPhone}
              onChange={(e) => setContactPhone(e.target.value)}
              maxLength={20}
              placeholder="+91 ..."
            />
          </div>
        </div>

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

        <div className="flex justify-end pt-2">
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? "Saving..." : "Save changes"}
          </button>
        </div>
      </form>
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
