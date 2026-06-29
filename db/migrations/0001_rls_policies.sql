-- Enable Row Level Security (RLS) on all tenant-isolated tables
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE bucket_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE nora_memory ENABLE ROW LEVEL SECURITY;

-- =========================================================================
-- RLS Policy Definitions
-- =========================================================================

-- 1. Organizations Policies (Access restricted to members of the org)
CREATE POLICY org_access ON organizations
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM org_members 
      WHERE org_members.org_id = organizations.id 
      AND org_members.user_id = auth.uid()
    )
  );

-- 2. Org Members Policies (Users can read/update their own member row or admins can view all)
CREATE POLICY member_access ON org_members
  FOR ALL
  USING (
    org_members.user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM org_members AS parent
      WHERE parent.org_id = org_members.org_id
      AND parent.user_id = auth.uid()
      AND parent.role = 'admin'
    )
  );

-- 3. Org Invites Policies (Only members of the target organization can query invites)
CREATE POLICY invite_access ON org_invites
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM org_members
      WHERE org_members.org_id = org_invites.org_id
      AND org_members.user_id = auth.uid()
    )
  );

-- 4. Threads Policies (Only organization members can interact with thread lanes)
CREATE POLICY thread_access ON threads
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM org_members
      WHERE org_members.org_id = threads.org_id
      AND org_members.user_id = auth.uid()
    )
  );

-- 5. Messages Policies (Only organization members can read or write thread chat bubbles)
CREATE POLICY message_access ON messages
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM threads
      JOIN org_members ON org_members.org_id = threads.org_id
      WHERE threads.id = messages.thread_id
      AND org_members.user_id = auth.uid()
    )
  );

-- 6. Bucket Items Policies (Only organization members can query tasks or assign delegations)
CREATE POLICY bucket_item_access ON bucket_items
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM org_members
      WHERE org_members.org_id = bucket_items.org_id
      AND org_members.user_id = auth.uid()
    )
  );

-- 7. Nora Memory Policies (Only organization members can access pgvector semantic memories)
CREATE POLICY nora_memory_access ON nora_memory
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM org_members
      WHERE org_members.org_id = nora_memory.org_id
      AND org_members.user_id = auth.uid()
    )
  );
