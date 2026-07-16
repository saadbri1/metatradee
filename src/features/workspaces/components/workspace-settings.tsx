'use client';

/**
 * Workspace settings (Phase 11.0): create a team workspace, switch the managed
 * workspace (server re-validates membership on EVERY action — the selection
 * here is never trusted), members + roles, invitations (link-based; email
 * delivery is a flagged seam). Personal data never appears here by design.
 */
import { useState } from 'react';
import { Users, Link as LinkIcon, ShieldOff } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { FormAlert } from '@/features/auth/components/form-alert';
import {
  createWorkspaceAction,
  listMyWorkspacesAction,
  listMembersAction,
  inviteMemberAction,
  changeMemberRoleAction,
} from '../server/actions';
import type { WorkspaceRole } from '../roles';

const INVITABLE_ROLES: WorkspaceRole[] = ['admin', 'manager', 'coach', 'trader', 'viewer'];

export function WorkspaceSettings() {
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<WorkspaceRole>('trader');
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const workspaces = useQuery({
    queryKey: ['workspaces', 'mine'],
    queryFn: () => listMyWorkspacesAction(),
    staleTime: 30_000,
  });
  const active = selected ?? workspaces.data?.[0]?.id ?? null;
  const members = useQuery({
    queryKey: ['workspaces', 'members', active],
    queryFn: () => listMembersAction(active as string),
    enabled: !!active,
  });

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const r = await createWorkspaceAction(name);
    if (!r.ok) setError(r.error ?? 'Could not create workspace.');
    else {
      setName('');
      qc.invalidateQueries({ queryKey: ['workspaces'] });
    }
  }

  async function onInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!active) return;
    setError(null);
    setInviteUrl(null);
    const r = await inviteMemberAction({ orgId: active, email: inviteEmail, role: inviteRole });
    if (!r.ok || !r.data) setError(r.error ?? 'Could not create the invitation.');
    else {
      setInviteUrl(`${window.location.origin}${r.data.inviteUrl}`);
      setInviteEmail('');
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/30 p-4">
        <ShieldOff className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
        <p className="text-xs text-muted-foreground">
          Workspaces never share your personal data. Trades, journal notes, psychology entries, and
          AI reviews stay private to each member — only strategies, playbooks, reports, tags, and
          templates can be explicitly shared, and every share is revocable.
        </p>
      </div>

      {error ? <FormAlert tone="error">{error}</FormAlert> : null}

      {/* Create */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Create a team workspace</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="flex flex-wrap gap-2" onSubmit={onCreate}>
            <Input
              aria-label="Workspace name"
              placeholder="e.g. Desk Alpha"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="max-w-xs"
            />
            <Button type="submit" disabled={name.trim().length < 2}>
              <Users aria-hidden /> Create
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Switcher + members */}
      {workspaces.data && workspaces.data.length > 0 ? (
        <Card>
          <CardHeader className="flex-row items-center justify-between gap-2 space-y-0">
            <CardTitle className="text-base">Members</CardTitle>
            <div className="w-56">
              <Select value={active ?? undefined} onValueChange={setSelected}>
                <SelectTrigger aria-label="Select workspace">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {workspaces.data.map((w) => (
                    <SelectItem key={w.id} value={w.id}>
                      {w.name} · {w.role}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {members.data && members.data.length > 0 ? (
              <ul className="space-y-2">
                {members.data.map((m) => (
                  <li
                    key={m.user_id}
                    className="flex items-center justify-between gap-2 rounded-md border border-border p-2 text-sm"
                  >
                    <span className="truncate font-mono text-xs">{m.user_id.slice(0, 8)}…</span>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">{m.workspace_role}</Badge>
                      <Select
                        value={m.workspace_role}
                        onValueChange={(role) =>
                          active &&
                          changeMemberRoleAction({
                            orgId: active,
                            memberUserId: m.user_id,
                            role,
                          }).then(() => qc.invalidateQueries({ queryKey: ['workspaces'] }))
                        }
                      >
                        <SelectTrigger className="h-8 w-28" aria-label="Change role">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {INVITABLE_ROLES.map((r) => (
                            <SelectItem key={r} value={r}>
                              {r}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No members yet.</p>
            )}

            {/* Invite */}
            <form
              className="flex flex-wrap items-end gap-2 border-t border-border pt-4"
              onSubmit={onInvite}
            >
              <div className="grid gap-1">
                <label htmlFor="invite-email" className="text-xs text-muted-foreground">
                  Invite by email
                </label>
                <Input
                  id="invite-email"
                  type="email"
                  placeholder="trader@team.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="w-56"
                />
              </div>
              <div className="grid gap-1">
                <label htmlFor="invite-role" className="text-xs text-muted-foreground">
                  Role
                </label>
                <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as WorkspaceRole)}>
                  <SelectTrigger id="invite-role" className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {INVITABLE_ROLES.map((r) => (
                      <SelectItem key={r} value={r}>
                        {r}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" disabled={!inviteEmail}>
                <LinkIcon aria-hidden /> Create invite link
              </Button>
            </form>
            {inviteUrl ? (
              <FormAlert tone="success">
                Share this single-use link (expires in 72h):{' '}
                <span className="break-all font-mono text-xs">{inviteUrl}</span>
              </FormAlert>
            ) : null}
            <p className="text-xs text-muted-foreground">
              Email delivery isn&apos;t configured yet — share the link directly. Invites are
              single-use, expire in 72 hours, and are bound to the invited email.
            </p>
          </CardContent>
        </Card>
      ) : (
        <p className="text-sm text-muted-foreground">
          You have no team workspaces yet. Your personal data and every existing feature work
          exactly as before — teams are purely additive.
        </p>
      )}
    </div>
  );
}
