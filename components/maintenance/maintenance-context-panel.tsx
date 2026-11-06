import MaintenanceOrganizationPicker from "@/components/maintenance/maintenance-organization-picker";

type OrganizationOption = { id: string; name: string };

export default function MaintenanceContextPanel({
  isSystemAdministrator,
  organizationId,
  organizationName,
  organizations,
}: {
  isSystemAdministrator: boolean;
  organizationId?: string;
  organizationName?: string;
  organizations: OrganizationOption[];
}) {
  if (!isSystemAdministrator) return null;

  if (organizationName) {
    return (
      <p className="rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-900">
        Managing organization: <strong>{organizationName}</strong>
      </p>
    );
  }

  return (
    <MaintenanceOrganizationPicker
      organizations={organizations}
      selectedId={organizationId}
    />
  );
}
