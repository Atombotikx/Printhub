# Fix Missing Orders for Admin

If the Admin Panel is not showing orders from other users, it is because of **active Row Level Security (RLS)** policies on the `orders` table.

By default, users can only see their own data. You need to explicitly allow the Admin to see EVERYTHING.

## Instructions

1.  Go to your **Supabase Dashboard** -> **SQL Editor**.
2.  Paste and Run the following SQL script:

```sql
-- 1. Enable RLS (if not already enabled)
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- 2. Create a Policy for Admin Access
-- Allows 'admin@printhub.com' to SELECT (view), UPDATE, and DELETE all rows
CREATE POLICY "Enable full access for admin" ON orders
    FOR ALL
    USING (auth.jwt() ->> 'email' = 'admin@printhub.com')
    WITH CHECK (auth.jwt() ->> 'email' = 'admin@printhub.com');

-- 3. Ensure customers can still view their own orders
-- (Verify this exists, if not, run it too)
CREATE POLICY "Enable access for owners" ON orders
    FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
```

3.  After running this, refresh the Admin Panel. The orders should appear immediately.
