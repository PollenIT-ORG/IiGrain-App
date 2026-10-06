import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  useGetUserQuery,
  useCreateUserMutation,
  useUpdateUserMutation,
} from "../store/endpoints/usersApi";
import { useSeedOnce } from "../lib/useSeedOnce";
import { showSuccess, showError } from "../lib/toast";
import { applyServerFieldErrors } from "../lib/serverErrors";
import { useReturnTo } from "../lib/returnTo";
import {
  required,
  requiredEmail,
  phone as validatePhone,
  isClean,
} from "../lib/validation";
import Loader from "../components/Loader";
import Breadcrumbs from "../components/ui/Breadcrumbs";
import Select from "../components/ui/Select";
import PhoneInput from "../components/ui/PhoneInput";
import { ROLE_LABELS, type UserRole } from "../types";
import { useAuth } from "../store/useAuth";

const ROLES: UserRole[] = [
  "farmer",
  "assessor",
  "program_administrator",
  "program_partner",
  "admin",
];
// Who each role may create. A program administrator looks after the assessors
// and farmers on their programs, and no one above them.
const CREATABLE: Record<string, UserRole[]> = {
  program_administrator: ["farmer", "assessor"],
  admin: ["farmer", "assessor", "program_administrator", "program_partner"],
};

function roleOptions(actorRole: string | undefined) {
  const allowed = CREATABLE[actorRole ?? ""] ?? ROLES;
  return ROLES.filter((r) => allowed.includes(r)).map((r) => ({
    value: r,
    label: ROLE_LABELS[r],
  }));
}

function errMsg(err: unknown): string {
  return (
    (err as { message?: string })?.message ??
    "Something went wrong. Please try again."
  );
}

export default function UserForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);
  const back = useReturnTo("/users");

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<UserRole>("farmer");
  const [errors, setErrors] = useState<Record<string, string | null>>({});
  const { user } = useAuth();
  const roleChoices = useMemo(() => roleOptions(user?.role), [user?.role]);

  const {
    data: existingUser,
    isLoading: loading,
    isFetching: refreshing,
    isError: loadError,
  } = useGetUserQuery(id ?? "", { skip: !isEdit });

  const [createUser, { isLoading: creating }] = useCreateUserMutation();
  const [updateUser, { isLoading: updating }] = useUpdateUserMutation();
  const saving = creating || updating;

  useSeedOnce(existingUser, existingUser?.id, refreshing, (u) => {
    setFullName(u.full_name ?? "");
    setEmail(u.email);
    setPhone(u.phone ?? "");
    setRole((u.role as UserRole) ?? "farmer");
  });

  useEffect(() => {
    if (loadError) {
      showError("User not found.");
      navigate("/users");
    }
  }, [loadError, navigate]);

  function validate(): boolean {
    const next: Record<string, string | null> = {
      fullName: required(fullName, "Full name"),
      phone: validatePhone(phone, { req: true }),
      email: isEdit ? null : requiredEmail(email),
    };
    setErrors(next);
    return isClean(next);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    try {
      if (isEdit && id) {
        await updateUser({
          id,
          body: { fullName: fullName.trim(), phone: phone.trim(), role },
        }).unwrap();
        showSuccess("User updated.");
      } else {
        await createUser({
          fullName: fullName.trim(),
          email: email.trim(),
          phone: phone.trim(),
          role,
        }).unwrap();
        showSuccess("User created.");
      }
      back.go();
    } catch (err) {
      const placed = applyServerFieldErrors(err, setErrors, [
        { field: "email", test: /email/i },
        { field: "phone", test: /phone/i },
      ]);
      if (!placed) showError(errMsg(err));
    }
  }

  if (isEdit && loading) {
    return <Loader variant="fullPage" message="Loading user..." />;
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Breadcrumbs
          className="mb-2"
          items={[
            { label: "Users", to: "/users" },
            ...(isEdit
              ? [
                  {
                    label: existingUser?.full_name || existingUser?.email || "User",
                    to: `/users/${id}`,
                  },
                  { label: "Edit" },
                ]
              : [{ label: "Add user" }]),
          ]}
        />
        <h1 className="text-2xl font-bold text-gray-900">
          {isEdit ? "Edit user" : "Add user"}
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          {isEdit
            ? "Update the user's details and role."
            : "Create a new user. They set their own password from the email we send before they can sign in."}
        </p>
      </div>

      <div className="card p-6 sm:p-8">
        <form onSubmit={handleSubmit} className="space-y-5" noValidate>
          <p className="text-xs text-gray-500">
            Fields marked <span className="text-danger">*</span> are required.
          </p>

          <div>
            <label htmlFor="fullName" className="label">
              Full name <span className="text-danger">*</span>
            </label>
            <input
              id="fullName"
              className={`input-field ${errors.fullName ? "input-error" : ""}`}
              placeholder="Asha Kumari"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              maxLength={100}
            />
            {errors.fullName && <p className="field-error">{errors.fullName}</p>}
          </div>

          <div>
            <label htmlFor="email" className="label">
              Email address {!isEdit && <span className="text-danger">*</span>}
            </label>
            <input
              id="email"
              type="email"
              className={`input-field disabled:bg-gray-100 disabled:text-gray-500 ${
                errors.email ? "input-error" : ""
              }`}
              placeholder="asha@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              maxLength={255}
              disabled={isEdit}
            />
            {errors.email ? (
              <p className="field-error">{errors.email}</p>
            ) : (
              isEdit && (
                <p className="mt-1.5 text-xs text-gray-500">
                  Email cannot be changed.
                </p>
              )
            )}
          </div>

          <div>
            <label htmlFor="phone" className="label">
              Mobile number <span className="text-danger">*</span>
            </label>
            <PhoneInput
              id="phone"
              value={phone}
              onChange={setPhone}
              required
              error={errors.phone}
              hint="Select the country, then enter the number."
            />
          </div>

          {!isEdit && (
            <div className="rounded-lg border border-gray-300 bg-gray-50 px-4 py-3">
              <p className="text-sm font-medium text-gray-800">
                A temporary password is emailed to them
              </p>
              <p className="mt-1 text-xs text-gray-500">
                Nobody here sets or sees it. They cannot use the app until they
                replace it with their own through Forgot password.
              </p>
            </div>
          )}

          <div>
            <label htmlFor="role" className="label">
              Role
            </label>
            <Select
              id="role"
              value={role}
              onChange={(v) => setRole(v as UserRole)}
              options={roleChoices}
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => back.go()}
            >
              Cancel
            </button>
            <button type="submit" disabled={saving} className="btn-primary">
              {saving
                ? "Saving..."
                : isEdit
                  ? "Save changes"
                  : "Create user"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
