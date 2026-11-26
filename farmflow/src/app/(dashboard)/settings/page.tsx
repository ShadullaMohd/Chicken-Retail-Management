import { requireCurrentUser } from "@/lib/auth/session";
import { ROLE_LABELS } from "@/lib/permissions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await requireCurrentUser();

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h2 className="text-2xl font-bold text-[#17212B]">Settings</h2>
        <p className="text-base text-gray-500 mt-0.5">
          Account overview and business configuration
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-[#17212B]">
            Signed-In Account
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-base">
          <div>
            <p className="text-sm text-gray-500">Name</p>
            <p className="font-semibold text-[#17212B]">{user.name}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Email</p>
            <p className="font-semibold text-[#17212B]">{user.email}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Role</p>
            <p className="font-semibold text-[#079B50]">
              {ROLE_LABELS[user.role]}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
