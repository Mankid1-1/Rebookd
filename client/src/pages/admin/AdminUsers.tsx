import DashboardLayout from "@/components/layout/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { Search, Shield, User } from "lucide-react";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useLocation } from "wouter";
import { toast } from "sonner";

export default function AdminUsers() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (user && user.role !== "admin") setLocation("/dashboard");
  }, [user, setLocation]);

  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.admin.users.list.useQuery({ page, limit: 20 }, { retry: false });

  const toggleActive = trpc.admin.users.toggleActive.useMutation({
    onSuccess: () => {
      toast.success("User status updated");
      utils.admin.users.list.invalidate();
    },
    onError: (err: { message: string }) => toast.error(err.message),
  });

  const changeAccountType = trpc.admin.users.changeAccountType.useMutation({
    onSuccess: () => {
      toast.success("Account type updated");
      utils.admin.users.list.invalidate();
    },
    onError: (err: { message: string }) => toast.error(err.message),
  });

  const changeRole = trpc.admin.users.changeRole.useMutation({
    onSuccess: () => {
      toast.success("User role updated");
      utils.admin.users.list.invalidate();
    },
    onError: (err: { message: string }) => toast.error(err.message),
  });

  const users = data?.users ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / 20);

  const filtered = search
    ? users.filter((u: any) =>
        u.name?.toLowerCase().includes(search.toLowerCase()) ||
        u.email?.toLowerCase().includes(search.toLowerCase())
      )
    : users;

  return (
    <DashboardLayout>
      <div className="p-6 space-y-5 max-w-7xl mx-auto">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-warning/10 flex items-center justify-center">
            <Shield className="w-4 h-4 text-warning" />
          </div>
          <div>
            <h1 className="text-2xl font-bold" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Users</h1>
            <p className="text-muted-foreground text-sm">{total} total users</p>
          </div>
        </div>

        <Card className="border-border bg-card">
          <CardContent className="p-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search users..."
                className="pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border bg-card">
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-8 text-center text-muted-foreground text-sm">Loading...</div>
            ) : filtered.length === 0 ? (
              <div className="p-12 text-center">
                <User className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground text-sm">No users found.</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead className="text-muted-foreground text-xs">User</TableHead>
                    <TableHead className="text-muted-foreground text-xs">Role</TableHead>
                    <TableHead className="text-muted-foreground text-xs">Account Type</TableHead>
                    <TableHead className="text-muted-foreground text-xs">Status</TableHead>
                    <TableHead className="text-muted-foreground text-xs">Joined</TableHead>
                    <TableHead className="text-muted-foreground text-xs">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((u: any) => (
                    <TableRow key={u.id} className="border-border">
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center">
                            <User className="w-3.5 h-3.5 text-primary" />
                          </div>
                          <div>
                            <span className="text-sm font-medium block">{u.name || "Unnamed"}</span>
                            <span className="text-xs text-muted-foreground">{u.email || "—"}</span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Select
                          value={u.role}
                          onValueChange={(val) => {
                            if (window.confirm(`Change ${u.email} role to ${val}?`)) {
                              changeRole.mutate({ userId: u.id, role: val as "user" | "admin" });
                            }
                          }}
                        >
                          <SelectTrigger className="h-7 w-24 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="user">User</SelectItem>
                            <SelectItem value="admin">Admin</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Select
                          value={u.accountType || "business"}
                          onValueChange={(val) => {
                            changeAccountType.mutate({ userId: u.id, accountType: val as "business" | "referral" | "both" });
                          }}
                        >
                          <SelectTrigger className="h-7 w-28 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="business">Business</SelectItem>
                            <SelectItem value="referral">Referral</SelectItem>
                            <SelectItem value="both">Both</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={`text-[10px] ${u.active !== false ? "text-success border-success/30" : "text-destructive border-destructive/30"}`}
                        >
                          {u.active !== false ? "Active" : "Suspended"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs text-muted-foreground">
                          {new Date(u.createdAt).toLocaleDateString()}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          className={`h-7 text-xs ${u.active !== false ? "text-destructive hover:text-destructive" : ""}`}
                          onClick={() => {
                            const action = u.active !== false ? "suspend" : "activate";
                            if (window.confirm(`Are you sure you want to ${action} this user?`)) {
                              toggleActive.mutate({ userId: u.id, active: u.active === false });
                            }
                          }}
                        >
                          {u.active !== false ? "Suspend" : "Activate"}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {totalPages > 1 && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Page {page} of {totalPages}</span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(page - 1)}>Previous</Button>
              <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>Next</Button>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
