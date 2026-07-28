import { useEffect, useRef, useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  useGetOrganizationQuery,
  useCreateOrganizationMutation,
  useUpdateOrganizationMutation,
} from "../store/endpoints/organizationsApi";
import { showSuccess, showError } from "../lib/toast";
import { applyServerFieldErrors } from "../lib/serverErrors";
import {
  required,
  optionalEmail,
  phone as validatePhone,
  isClean,
} from "../lib/validation";
import Loader from "../components/Loader";
import Select from "../components/ui/Select";
import PhoneInput from "../components/ui/PhoneInput";
import { ChevronLeftIcon } from "../components/icons";

function errMsg(err: unknown): string {
  return (
    (err as { message?: string })?.message ??
    "Something went wrong. Please try again."
  );
}

const STATUS_OPTIONS = [
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
];

export default function OrganizationForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);

  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [address, setAddress] = useState("");
  const [description, setDescription] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [errors, setErrors] = useState<Record<string, string | null>>({});
  const codeManuallyEdited = useRef(false);

  const {
    data: detail,
    isLoading: loading,
    isError: loadError,
  } = useGetOrganizationQuery(id ?? "", { skip: !isEdit });

  const [createOrg, { isLoading: creating }] = useCreateOrganizationMutation();
  const [updateOrg, { isLoading: updating }] = useUpdateOrganizationMutation();
  const saving = creating || updating;

  useEffect(() => {
    if (detail?.organization) {
      const o = detail.organization;
      setName(o.name);
      setCode(o.code);
      codeManuallyEdited.current = true;
      setContactEmail(o.contact_email ?? "");
      setContactPhone(o.contact_phone ?? "");
      setAddress(o.address ?? "");
      setDescription(o.description ?? "");
      setIsActive(o.is_active);
    }
  }, [detail]);

  function handleNameChange(v: string) {
    setName(v);
    if (!isEdit && !codeManuallyEdited.current) {
      const initials = v
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .map((w) => w[0].toUpperCase())
        .join("");
      setCode(initials || "");
    }
  }

  function handleCodeChange(v: string) {
    codeManuallyEdited.current = true;
    setCode(v.toUpperCase());
  }

  useEffect(() => {
    if (loadError) {
      showError("Organization not found.");
      navigate("/organizations");
    }
  }, [loadError, navigate]);

  function validate(): boolean {
    const next: Record<string, string | null> = {
      name: required(name, "Organization name"),
      code: required(code, "Code"),
      contactEmail: optionalEmail(contactEmail),
      contactPhone: validatePhone(contactPhone, { label: "Contact number" }),
    };
    setErrors(next);
    return isClean(next);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    const body = {
      name: name.trim(),
      code: code.trim(),
      contactEmail: contactEmail.trim(),
      contactPhone: contactPhone.trim(),
      address: address.trim(),
      description: description.trim(),
      isActive,
    };
    try {
      if (isEdit && id) {
        await updateOrg({ id, body }).unwrap();
        showSuccess("Organization updated.");
      } else {
        await createOrg(body).unwrap();
        showSuccess("Organization created.");
      }
      navigate("/organizations");
    } catch (err) {
      const placed = applyServerFieldErrors(err, setErrors, [
        { field: "code", test: /code/i },
        { field: "contactEmail", test: /email/i },
        { field: "name", test: /name/i },
      ]);
      if (!placed) showError(errMsg(err));
    }
  }

  if (isEdit && loading) {
    return <Loader variant="fullPage" message="Loading organization..." />;
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <button
          onClick={() => navigate("/organizations")}
          className="mb-2 inline-flex items-center gap-1 text-sm font-medium text-gray-500 hover:text-primary"
        >
          <ChevronLeftIcon width={16} height={16} />
          Back to organizations
        </button>
        <h1 className="text-2xl font-bold text-gray-900">
          {isEdit ? "Edit organization" : "Add organization"}
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          {isEdit
            ? "Update the organization's details."
            : "Create a new organization. You can assign members afterwards."}
        </p>
      </div>

      <div className="card p-6 sm:p-8">
        <form onSubmit={handleSubmit} className="space-y-5" noValidate>
          <p className="text-xs text-gray-500">
            Fields marked <span className="text-danger">*</span> are required.
          </p>

          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label htmlFor="name" className="label">
                Organization name <span className="text-danger">*</span>
              </label>
              <input
                id="name"
                className={`input-field ${errors.name ? "input-error" : ""}`}
                placeholder="Green Valley Cooperative"
                value={name}
                onChange={(e) => handleNameChange(e.target.value)}
                maxLength={150}
              />
              {errors.name && <p className="field-error">{errors.name}</p>}
            </div>

            <div>
              <label htmlFor="code" className="label">
                Code <span className="text-danger">*</span>
              </label>
              <input
                id="code"
                className={`input-field font-mono uppercase ${
                  errors.code ? "input-error" : ""
                }`}
                placeholder="GVC"
                value={code}
                onChange={(e) => handleCodeChange(e.target.value)}
                maxLength={50}
              />
              {errors.code ? (
                <p className="field-error">{errors.code}</p>
              ) : (
                <p className="mt-1.5 text-xs text-gray-500">
                  Auto-generated from name. Edit to customise.
                </p>
              )}
            </div>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label htmlFor="contactEmail" className="label">
                Contact email
              </label>
              <input
                id="contactEmail"
                type="email"
                className={`input-field ${
                  errors.contactEmail ? "input-error" : ""
                }`}
                placeholder="info@example.com"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                maxLength={255}
              />
              {errors.contactEmail && (
                <p className="field-error">{errors.contactEmail}</p>
              )}
            </div>

            <div>
              <label htmlFor="contactPhone" className="label">
                Contact number
              </label>
              <PhoneInput
                id="contactPhone"
                value={contactPhone}
                onChange={setContactPhone}
              />
              {errors.contactPhone && (
                <p className="field-error">{errors.contactPhone}</p>
              )}
            </div>
          </div>

          <div>
            <label htmlFor="address" className="label">
              Address
            </label>
            <input
              id="address"
              className="input-field"
              placeholder="Street, city, state"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              maxLength={500}
            />
          </div>

          <div>
            <label htmlFor="description" className="label">
              Description
            </label>
            <textarea
              id="description"
              className="input-field min-h-[90px] resize-y"
              placeholder="A short description of this organization (optional)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={2000}
            />
          </div>

          <div>
            <label htmlFor="status" className="label">
              Status
            </label>
            <Select
              id="status"
              value={isActive ? "active" : "inactive"}
              onChange={(v) => setIsActive(v === "active")}
              options={STATUS_OPTIONS}
              className="sm:w-48"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => navigate("/organizations")}
            >
              Cancel
            </button>
            <button type="submit" disabled={saving} className="btn-primary">
              {saving
                ? "Saving..."
                : isEdit
                  ? "Save changes"
                  : "Create organization"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
