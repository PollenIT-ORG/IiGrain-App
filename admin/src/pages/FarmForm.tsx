import { useEffect, useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  useGetFarmQuery,
  useCreateFarmMutation,
  useUpdateFarmMutation,
} from "../store/endpoints/farmsApi";
import { useListUsersQuery } from "../store/endpoints/usersApi";
import { useListOrganizationsQuery } from "../store/endpoints/organizationsApi";
import { showSuccess, showError } from "../lib/toast";
import {
  required,
  requiredSelect,
  positiveNumber,
  isClean,
  MAX_AREA_ACRES,
} from "../lib/validation";
import Loader from "../components/Loader";
import Breadcrumbs from "../components/ui/Breadcrumbs";
import Select from "../components/ui/Select";
import MapPicker, { type LatLng } from "../components/ui/MapPicker";
import { applyServerFieldErrors } from "../lib/serverErrors";
import { useReturnTo } from "../lib/returnTo";

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

export default function FarmForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);
  const back = useReturnTo("/farms");

  const [name, setName] = useState("");
  const [areaAcres, setAreaAcres] = useState("");
  const [location, setLocation] = useState("");
  const [businessEntity, setBusinessEntity] = useState("");
  const [coords, setCoords] = useState<LatLng | null>(null);
  const [ownerId, setOwnerId] = useState("");
  const [orgId, setOrgId] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [errors, setErrors] = useState<Record<string, string | null>>({});

  const { data: farmersData } = useListUsersQuery({
    page: 1,
    limit: 100,
    role: "farmer",
    status: "active",
  });
  const OWNER_OPTIONS = [
    { value: "", label: "Select a farmer" },
    ...(farmersData?.users ?? []).map((u) => ({
      value: u.id,
      label: u.full_name ? `${u.full_name} - ${u.email}` : u.email,
    })),
  ];

  const { data: orgsData } = useListOrganizationsQuery({ page: 1, limit: 100 });
  const ORG_OPTIONS = [
    { value: "", label: "No organization" },
    ...(orgsData?.organizations ?? []).map((o) => ({
      value: o.id,
      label: o.name,
    })),
  ];

  const {
    data: farm,
    isLoading: loading,
    isError: loadError,
  } = useGetFarmQuery(id ?? "", { skip: !isEdit });

  const [createFarm, { isLoading: creating }] = useCreateFarmMutation();
  const [updateFarm, { isLoading: updating }] = useUpdateFarmMutation();
  const saving = creating || updating;

  // On edit, the saved owner may have been deleted or deactivated, so it is not
  // in the active-farmer list and the Select silently falls back to the
  // placeholder. Detect that to warn the user instead of failing on save.
  const ownerMissing =
    isEdit &&
    !!farm?.owner_id &&
    ownerId === farm.owner_id &&
    (farmersData?.users ?? []).every((u) => u.id !== farm.owner_id);

  useEffect(() => {
    if (farm) {
      setName(farm.name);
      setAreaAcres(farm.area_acres ?? "");
      setLocation(farm.location ?? "");
      setBusinessEntity(farm.business_entity ?? "");
      setCoords(
        farm.latitude != null && farm.longitude != null
          ? { lat: farm.latitude, lng: farm.longitude }
          : null
      );
      setOwnerId(farm.owner_id);
      setOrgId(farm.org_id ?? "");
      setIsActive(farm.is_active);
    }
  }, [farm]);

  useEffect(() => {
    if (loadError) {
      showError("Farm not found.");
      navigate("/farms");
    }
  }, [loadError, navigate]);

  function validate(): boolean {
    const next: Record<string, string | null> = {
      name: required(name, "Farm name"),
      owner: requiredSelect(ownerId, "an owner (farmer)"),
      area: positiveNumber(areaAcres, {
        req: true,
        label: "Area",
        max: MAX_AREA_ACRES,
      }),
    };
    setErrors(next);
    return isClean(next);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    const areaNum = areaAcres.trim() === "" ? undefined : Number(areaAcres);

    const body = {
      name: name.trim(),
      areaAcres: areaNum,
      location: location.trim(),
      businessEntity: businessEntity.trim(),
      latitude: coords?.lat ?? null,
      longitude: coords?.lng ?? null,
      ownerId,
      orgId,
      isActive,
    };

    try {
      if (isEdit && id) {
        await updateFarm({ id, body }).unwrap();
        showSuccess("Farm updated.");
      } else {
        await createFarm(body).unwrap();
        showSuccess("Farm created.");
      }
      back.go();
    } catch (err) {
      // Land server conflicts on the right field: a farm-shrink rejection is an
      // area problem, a missing owner is an owner problem. Otherwise toast.
      const placed = applyServerFieldErrors(err, setErrors, [
        { field: "area", test: /acre|farm size|area/i },
        { field: "owner", test: /owner|farmer/i },
      ]);
      if (!placed) showError(errMsg(err));
    }
  }

  if (isEdit && loading) {
    return <Loader variant="fullPage" message="Loading farm..." />;
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Breadcrumbs
          className="mb-2"
          items={[
            { label: "Farms", to: "/farms" },
            ...(isEdit
              ? [{ label: farm?.name ?? "Farm", to: `/farms/${id}` }, { label: "Edit" }]
              : [{ label: "Add farm" }]),
          ]}
        />
        <h1 className="text-2xl font-bold text-gray-900">
          {isEdit ? "Edit farm" : "Add farm"}
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          {isEdit
            ? "Update the farm's details, owner, and organization."
            : "Create a new farm and assign it to a farmer."}
        </p>
      </div>

      <div className="card p-6 sm:p-8">
        <form onSubmit={handleSubmit} className="space-y-5" noValidate>
          <p className="text-xs text-gray-500">
            Fields marked <span className="text-danger">*</span> are required.
          </p>

          <div>
            <label htmlFor="name" className="label">
              Farm name <span className="text-danger">*</span>
            </label>
            <input
              id="name"
              className={`input-field ${errors.name ? "input-error" : ""}`}
              placeholder="North Field"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={150}
            />
            {errors.name && <p className="field-error">{errors.name}</p>}
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label htmlFor="area" className="label">
                Area (acres) <span className="text-danger">*</span>
              </label>
              <input
                id="area"
                type="number"
                min="0"
                max="9999999"
                step="0.01"
                className={`input-field ${errors.area ? "input-error" : ""}`}
                placeholder="200"
                value={areaAcres}
                onChange={(e) => setAreaAcres(e.target.value)}
              />
              {errors.area ? (
                <p className="field-error">{errors.area}</p>
              ) : (
                <p className="mt-1.5 text-xs text-gray-500">
                  Total farm area. Field areas can't exceed this.
                </p>
              )}
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
              />
            </div>
          </div>

          <div>
            <label htmlFor="location" className="label">
              Location
            </label>
            <input
              id="location"
              className="input-field"
              placeholder="Village, district, state"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              maxLength={500}
            />
          </div>

          <div>
            <label htmlFor="businessEntity" className="label">
              Business Entity
            </label>
            <input
              id="businessEntity"
              className="input-field"
              placeholder="Business name (optional)"
              value={businessEntity}
              onChange={(e) => setBusinessEntity(e.target.value)}
              maxLength={200}
            />
          </div>

          <div>
            <label className="label">Map location</label>
            <MapPicker value={coords} onChange={setCoords} />
          </div>

          <div>
            <label htmlFor="owner" className="label">
              Owner (farmer) <span className="text-danger">*</span>
            </label>
            <Select
              id="owner"
              value={ownerId}
              onChange={setOwnerId}
              options={OWNER_OPTIONS}
              placeholder="Select a farmer"
            />
            {errors.owner ? (
              <p className="field-error">{errors.owner}</p>
            ) : ownerMissing ? (
              <p className="field-error">
                The current owner ({farm?.owner_name || farm?.owner_email}) is no
                longer available. Please choose a new owner before saving.
              </p>
            ) : (
              <p className="mt-1.5 text-xs text-gray-500">
                Only users with the farmer role can own a farm.
              </p>
            )}
          </div>

          <div>
            <label htmlFor="org" className="label">
              Organization
            </label>
            <Select
              id="org"
              value={orgId}
              onChange={setOrgId}
              options={ORG_OPTIONS}
              placeholder="No organization"
            />
            <p className="mt-1.5 text-xs text-gray-500">
              Optional. Link this farm to an organization.
            </p>
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
                  : "Create farm"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
