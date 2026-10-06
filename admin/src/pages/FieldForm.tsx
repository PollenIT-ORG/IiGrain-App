import { useEffect, useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  useGetFieldQuery,
  useCreateFieldMutation,
  useUpdateFieldMutation,
  useGetFieldSoilQuery,
  useSaveFieldSoilMutation,
  useListFieldsQuery,
  type SoilBody,
} from "../store/endpoints/fieldsApi";
import { useListFarmsQuery } from "../store/endpoints/farmsApi";
import { useSeedOnce } from "../lib/useSeedOnce";
import { showSuccess, showError } from "../lib/toast";
import Loader from "../components/Loader";
import Select from "../components/ui/Select";
import MapPicker from "../components/ui/MapPicker";
import BoundaryMap from "../components/ui/BoundaryMap";
import {
  areaAcresOf,
  boundaryToRing,
  type LatLng,
  type GeoJSONPolygon,
} from "../lib/geo";
import { applyServerFieldErrors } from "../lib/serverErrors";
import { MAX_AREA_ACRES } from "../lib/validation";
import { useProgramScope } from "../lib/programScope";
import { useReturnTo } from "../lib/returnTo";
import { useProgramCrumbs } from "../lib/useProgramCrumbs";
import Breadcrumbs from "../components/ui/Breadcrumbs";

function errMsg(err: unknown): string {
  return (
    (err as { message?: string })?.message ??
    "Something went wrong. Please try again."
  );
}

const ACTIVE_OPTIONS = [
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
];

const IRRIGATION_OPTIONS = [
  { value: "", label: "Not specified" },
  { value: "Drip", label: "Drip" },
  { value: "Sprinkler", label: "Sprinkler" },
  { value: "Flood", label: "Flood" },
  { value: "Rain-fed", label: "Rain-fed" },
  { value: "Canal", label: "Canal" },
  { value: "Borewell", label: "Borewell" },
];

export default function FieldForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);
  const { programId, to, home } = useProgramScope();
  const back = useReturnTo(home("/fields"));
  const programCrumbs = useProgramCrumbs(programId);

  const [farmId, setFarmId] = useState("");
  const [name, setName] = useState("");
  const [areaAcres, setAreaAcres] = useState("");
  const [crop, setCrop] = useState("");
  const [season, setSeason] = useState("");
  const [irrigation, setIrrigation] = useState("");
  const [location, setLocation] = useState("");
  const [coords, setCoords] = useState<LatLng | null>(null);
  const [boundary, setBoundary] = useState<GeoJSONPolygon | null>(null);
  // A drawn outline sets the acres, worked out the same way the server does.
  const drawnAcres = boundary
    ? Math.max(areaAcresOf(boundaryToRing(boundary)), 0.01)
    : null;
  const [sowingDate, setSowingDate] = useState("");
  const [expectedHarvest, setExpectedHarvest] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [errors, setErrors] = useState<Record<string, string | null>>({});

  const [ph, setPh] = useState("");
  const [organicMatter, setOrganicMatter] = useState("");
  const [nitrogen, setNitrogen] = useState("");
  const [phosphorus, setPhosphorus] = useState("");
  const [potassium, setPotassium] = useState("");
  const [moisture, setMoisture] = useState("");
  const [texture, setTexture] = useState("");
  const [soilNotes, setSoilNotes] = useState("");
  const [testedOn, setTestedOn] = useState("");

  const { data: farmsData } = useListFarmsQuery({ page: 1, limit: 100 });
  const FARM_OPTIONS = [
    { value: "", label: "Select a farm" },
    ...(farmsData?.farms ?? []).map((f) => ({
      value: f.id,
      label: f.name,
    })),
  ];

  const selectedFarm = (farmsData?.farms ?? []).find((f) => f.id === farmId);
  const farmArea =
    selectedFarm?.area_acres != null ? Number(selectedFarm.area_acres) : null;
  const { data: farmFieldsData } = useListFieldsQuery(
    { page: 1, limit: 100, farmId },
    { skip: !farmId }
  );
  const otherFieldsArea = (farmFieldsData?.fields ?? [])
    .filter((f) => f.id !== id)
    .reduce((sum, f) => sum + (f.area_acres ? Number(f.area_acres) : 0), 0);
  const remainingAcres =
    farmArea === null ? null : Math.round((farmArea - otherFieldsArea) * 100) / 100;
  // The farm total after saving, when the drawn field needs more than is left.
  const grownFarmAcres =
    drawnAcres !== null && remainingAcres !== null && drawnAcres > remainingAcres
      ? Math.round((otherFieldsArea + drawnAcres) * 100) / 100
      : null;

  const {
    data: field,
    isLoading: loading,
    isFetching: refreshing,
    isError: loadError,
  } = useGetFieldQuery(id ?? "", { skip: !isEdit });

  const { data: soil, isFetching: refreshingSoil } = useGetFieldSoilQuery(id ?? "", { skip: !isEdit });

  const [createField, { isLoading: creating }] = useCreateFieldMutation();
  const [updateField, { isLoading: updating }] = useUpdateFieldMutation();
  const [saveSoil, { isLoading: savingSoil }] = useSaveFieldSoilMutation();
  const saving = creating || updating || savingSoil;

  useSeedOnce(field, field?.id, refreshing, (f) => {
    setFarmId(f.farm_id);
    setName(f.name);
    setAreaAcres(f.area_acres ?? "");
    setCrop(f.crop ?? "");
    setSeason(f.season ?? "");
    setIrrigation(f.irrigation ?? "");
    setLocation(f.location ?? "");
    setCoords(
      f.latitude != null && f.longitude != null
        ? { lat: f.latitude, lng: f.longitude }
        : null
    );
    setSowingDate(f.sowing_date ?? "");
    setExpectedHarvest(f.expected_harvest ?? "");
    setBoundary(f.boundary ?? null);
    setIsActive(f.is_active);
  });

  useSeedOnce(soil ?? undefined, id, refreshingSoil, (s) => {
    setPh(s.ph ?? "");
    setOrganicMatter(s.organic_matter ?? "");
    setNitrogen(s.nitrogen ?? "");
    setPhosphorus(s.phosphorus ?? "");
    setPotassium(s.potassium ?? "");
    setMoisture(s.moisture ?? "");
    setTexture(s.texture ?? "");
    setSoilNotes(s.notes ?? "");
    setTestedOn(s.tested_on ?? "");
  });

  useEffect(() => {
    if (loadError) {
      showError("Field not found.");
      navigate("/fields");
    }
  }, [loadError, navigate]);

  function buildSoilBody(): SoilBody | null {
    const numOrNull = (s: string) => (s.trim() === "" ? null : Number(s));
    const body: SoilBody = {
      ph: numOrNull(ph),
      organicMatter: numOrNull(organicMatter),
      nitrogen: numOrNull(nitrogen),
      phosphorus: numOrNull(phosphorus),
      potassium: numOrNull(potassium),
      moisture: numOrNull(moisture),
      texture: texture.trim() || null,
      notes: soilNotes.trim() || null,
      testedOn: testedOn || null,
    };
    const hasAny = Object.values(body).some((v) => v !== null);
    return hasAny ? body : null;
  }

  function validateSoil(): string | null {
    // Bounds match the backend: pH 0-14, organic matter and moisture are
    // percentages (0-100), nutrients are ppm with a generous cap.
    const checks: Array<[string, string, number, number]> = [
      ["pH", ph, 0, 14],
      ["Organic matter", organicMatter, 0, 100],
      ["Nitrogen", nitrogen, 0, 10000],
      ["Phosphorus", phosphorus, 0, 10000],
      ["Potassium", potassium, 0, 10000],
      ["Moisture", moisture, 0, 100],
    ];
    for (const [label, val, min, max] of checks) {
      if (val.trim() === "") continue;
      const n = Number(val);
      if (Number.isNaN(n) || n < min || n > max) {
        return max === Infinity
          ? `${label} must be a number ≥ ${min}.`
          : `${label} must be between ${min} and ${max}.`;
      }
    }
    return null;
  }

  const harvestError =
    sowingDate && expectedHarvest && expectedHarvest < sowingDate
      ? "Expected harvest cannot be before the sowing date."
      : null;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (harvestError) return;
    // With an outline drawn the server sets the acres, so only a typed value is sent and checked.
    const areaNum =
      boundary || areaAcres.trim() === "" ? undefined : Number(areaAcres);
    const fieldErrors: Record<string, string | null> = {
      farm: farmId ? null : "Please select a farm.",
      name: name.trim() ? null : "Field name is required.",
      area:
        drawnAcres !== null && drawnAcres > MAX_AREA_ACRES
          ? "This boundary is too large. Please check the points."
          : areaNum !== undefined && (Number.isNaN(areaNum) || areaNum <= 0)
            ? "Area must be a number greater than zero."
            : areaNum !== undefined && areaNum > MAX_AREA_ACRES
              ? "Area looks too large. Please check the value."
              : null,
    };
    setErrors(fieldErrors);
    if (fieldErrors.farm || fieldErrors.name || fieldErrors.area) return;

    const soilErr = validateSoil();
    if (soilErr) {
      showError(soilErr);
      return;
    }

    try {
      let fieldId = id;
      if (isEdit && id) {
        await updateField({
          id,
          body: {
            name: name.trim(),
            areaAcres: areaNum,
            crop: crop.trim() || undefined,
            season: season.trim() || undefined,
            irrigation: irrigation || undefined,
            location: location.trim() || undefined,
            latitude: coords?.lat ?? null,
            longitude: coords?.lng ?? null,
            sowingDate: sowingDate || undefined,
            expectedHarvest: expectedHarvest || undefined,
            boundary,
            isActive,
          },
        }).unwrap();
      } else {
        const created = await createField({
          farmId,
          name: name.trim(),
          areaAcres: areaNum,
          crop: crop.trim() || undefined,
          season: season.trim() || undefined,
          irrigation: irrigation || undefined,
          location: location.trim() || undefined,
          latitude: coords?.lat ?? null,
          longitude: coords?.lng ?? null,
          sowingDate: sowingDate || undefined,
          expectedHarvest: expectedHarvest || undefined,
          boundary,
          isActive,
        }).unwrap();
        fieldId = created.id;
      }

      const soilBody = buildSoilBody();
      if (fieldId && soilBody) {
        await saveSoil({ id: fieldId, body: soilBody }).unwrap();
      }

      showSuccess(isEdit ? "Field updated." : "Field created.");
      back.go();
    } catch (err) {
      const placed = applyServerFieldErrors(err, setErrors, [
        { field: "area", test: /acre|area/i },
        { field: "name", test: /field name/i },
      ]);
      if (!placed) showError(errMsg(err));
    }
  }

  if (isEdit && loading) {
    return <Loader variant="fullPage" message="Loading field..." />;
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Breadcrumbs
          className="mb-2"
          items={[
            ...(programId ? programCrumbs : [{ label: "Fields", to: "/fields" }]),
            ...(isEdit
              ? [
                  { label: field?.name ?? "Field", to: to(`/fields/${id}`) },
                  { label: "Edit" },
                ]
              : [{ label: "Add field" }]),
          ]}
        />
        <h1 className="text-2xl font-bold text-gray-900">
          {isEdit ? "Edit field" : "Add field"}
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          {isEdit
            ? "Update this field's details."
            : "Add a new field to a farm."}
        </p>
      </div>

      <div className="card p-6 sm:p-8">
        <form onSubmit={handleSubmit} className="space-y-5" noValidate>
          <p className="text-xs text-gray-500">
            Fields marked <span className="text-danger">*</span> are required.
          </p>

          <div>
            <label htmlFor="farm" className="label">
              Farm <span className="text-danger">*</span>
            </label>
            <Select
              id="farm"
              value={farmId}
              onChange={setFarmId}
              options={FARM_OPTIONS}
              placeholder="Select a farm"
              disabled={isEdit}
            />
            {errors.farm ? (
              <p className="field-error">{errors.farm}</p>
            ) : (
              isEdit && (
                <p className="mt-1.5 text-xs text-gray-500">
                  Farm cannot be changed after creation.
                </p>
              )
            )}
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label htmlFor="name" className="label">
                Field name <span className="text-danger">*</span>
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
            <div>
              <label htmlFor="area" className="label">
                Area (acres)
              </label>
              <input
                id="area"
                type="number"
                min="0"
                max="9999999"
                step="0.01"
                className={`input-field disabled:bg-gray-100 disabled:text-gray-500 ${
                  errors.area ? "input-error" : ""
                }`}
                placeholder="50.5"
                value={drawnAcres !== null ? String(drawnAcres) : areaAcres}
                onChange={(e) => setAreaAcres(e.target.value)}
                disabled={drawnAcres !== null}
              />
              {errors.area ? (
                <p className="field-error">{errors.area}</p>
              ) : drawnAcres !== null ? (
                <p className="mt-1.5 text-xs text-gray-500">
                  Set by the boundary drawn below.{" "}
                  {grownFarmAcres !== null && (
                    <span className="text-amber-600">
                      The farm total grows to {grownFarmAcres} acres to fit it.
                    </span>
                  )}
                </p>
              ) : remainingAcres !== null ? (
                <p className="mt-1.5 text-xs text-gray-500">
                  Optional.{" "}
                  <span
                    className={
                      remainingAcres <= 0 ? "text-danger" : "text-gray-500"
                    }
                  >
                    {remainingAcres <= 0
                      ? "Farm is full - no acres remaining."
                      : `${remainingAcres} acre(s) remaining on this farm.`}
                  </span>
                </p>
              ) : (
                <p className="mt-1.5 text-xs text-gray-500">Optional.</p>
              )}
            </div>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label htmlFor="crop" className="label">
                Crop
              </label>
              <input
                id="crop"
                className="input-field"
                placeholder="Wheat, Corn, Rice..."
                value={crop}
                onChange={(e) => setCrop(e.target.value)}
                maxLength={100}
              />
            </div>
            <div>
              <label htmlFor="season" className="label">
                Season
              </label>
              <input
                id="season"
                className="input-field"
                placeholder="Kharif 2024"
                value={season}
                onChange={(e) => setSeason(e.target.value)}
                maxLength={100}
              />
            </div>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label htmlFor="irrigation" className="label">
                Irrigation
              </label>
              <Select
                id="irrigation"
                value={irrigation}
                onChange={setIrrigation}
                options={IRRIGATION_OPTIONS}
                placeholder="Not specified"
              />
            </div>
            <div>
              <label htmlFor="location" className="label">
                Location / Coordinates
              </label>
              <input
                id="location"
                className="input-field"
                placeholder="GPS coords or description"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                maxLength={500}
              />
            </div>
          </div>

          <div>
            <label className="label">Map location</label>
            <MapPicker value={coords} onChange={setCoords} height={280} />
            <p className="mt-1 text-xs text-gray-500">
              A single point, used to verify an assessor has arrived at the field.
            </p>
          </div>

          <div>
            <label className="label mb-0">Mark boundary</label>
            <div className="mt-2">
              <BoundaryMap value={boundary} onChange={setBoundary} height={340} />
            </div>
            <p className="mt-1 text-xs text-gray-500">
              The field's acres are worked out from the area drawn here.
            </p>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label htmlFor="sowingDate" className="label">
                Sowing date
              </label>
              <input
                id="sowingDate"
                type="date"
                className="input-field"
                value={sowingDate}
                onChange={(e) => setSowingDate(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="expectedHarvest" className="label">
                Expected harvest
              </label>
              <input
                id="expectedHarvest"
                type="date"
                min={sowingDate || undefined}
                className={`input-field ${harvestError ? "input-error" : ""}`}
                value={expectedHarvest}
                onChange={(e) => setExpectedHarvest(e.target.value)}
              />
              {harvestError && <p className="field-error">{harvestError}</p>}
            </div>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label htmlFor="active" className="label">
                Status
              </label>
              <Select
                id="active"
                value={isActive ? "active" : "inactive"}
                onChange={(v) => setIsActive(v === "active")}
                options={ACTIVE_OPTIONS}
              />
            </div>
          </div>

          {!isEdit ? (
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500">
                Soil details
              </h2>
              <p className="mt-1 text-xs text-gray-500">
                Soil readings can be added after the field is enrolled in an
                active program. Create the field first, then open it to record
                soil once it is enrolled.
              </p>
            </div>
          ) : (
          <div className="border-t border-gray-300 pt-5">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500">
              Soil details
            </h2>
            <p className="mt-1 text-xs text-gray-500">
              All optional. Leave blank to skip. One soil record per field. Soil
              nutrient values can only be saved while the field is enrolled in an
              active program.
            </p>

            <div className="mt-4 grid gap-5 sm:grid-cols-3">
              <div>
                <label htmlFor="ph" className="label">
                  pH (0-14)
                </label>
                <input
                  id="ph"
                  type="number"
                  min="0"
                  max="14"
                  step="0.01"
                  className="input-field"
                  placeholder="6.5"
                  value={ph}
                  onChange={(e) => setPh(e.target.value)}
                />
              </div>
              <div>
                <label htmlFor="organicMatter" className="label">
                  Organic matter (%)
                </label>
                <input
                  id="organicMatter"
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  className="input-field"
                  placeholder="3.2"
                  value={organicMatter}
                  onChange={(e) => setOrganicMatter(e.target.value)}
                />
              </div>
              <div>
                <label htmlFor="moisture" className="label">
                  Moisture (%)
                </label>
                <input
                  id="moisture"
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  className="input-field"
                  placeholder="18"
                  value={moisture}
                  onChange={(e) => setMoisture(e.target.value)}
                />
              </div>
            </div>

            <div className="mt-5 grid gap-5 sm:grid-cols-3">
              <div>
                <label htmlFor="nitrogen" className="label">
                  Nitrogen (N)
                </label>
                <input
                  id="nitrogen"
                  type="number"
                  min="0"
                  max="10000"
                  step="0.01"
                  className="input-field"
                  placeholder="40"
                  value={nitrogen}
                  onChange={(e) => setNitrogen(e.target.value)}
                />
              </div>
              <div>
                <label htmlFor="phosphorus" className="label">
                  Phosphorus (P)
                </label>
                <input
                  id="phosphorus"
                  type="number"
                  min="0"
                  max="10000"
                  step="0.01"
                  className="input-field"
                  placeholder="20"
                  value={phosphorus}
                  onChange={(e) => setPhosphorus(e.target.value)}
                />
              </div>
              <div>
                <label htmlFor="potassium" className="label">
                  Potassium (K)
                </label>
                <input
                  id="potassium"
                  type="number"
                  min="0"
                  max="10000"
                  step="0.01"
                  className="input-field"
                  placeholder="30"
                  value={potassium}
                  onChange={(e) => setPotassium(e.target.value)}
                />
              </div>
            </div>

            <div className="mt-5 grid gap-5 sm:grid-cols-2">
              <div>
                <label htmlFor="texture" className="label">
                  Texture
                </label>
                <input
                  id="texture"
                  className="input-field"
                  placeholder="Loam, Clay, Sandy..."
                  value={texture}
                  onChange={(e) => setTexture(e.target.value)}
                  maxLength={50}
                />
              </div>
              <div>
                <label htmlFor="testedOn" className="label">
                  Tested on
                </label>
                <input
                  id="testedOn"
                  type="date"
                  className="input-field"
                  value={testedOn}
                  onChange={(e) => setTestedOn(e.target.value)}
                />
              </div>
            </div>

            <div className="mt-5">
              <label htmlFor="soilNotes" className="label">
                Soil notes
              </label>
              <textarea
                id="soilNotes"
                className="input-field min-h-[80px]"
                placeholder="Any observations about the soil..."
                value={soilNotes}
                onChange={(e) => setSoilNotes(e.target.value)}
                maxLength={2000}
              />
            </div>
          </div>
          )}

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
                  : "Create field"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
